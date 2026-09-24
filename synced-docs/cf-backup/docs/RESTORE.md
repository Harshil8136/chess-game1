# Restoring from a cf-backup run

> **For the Owner or the Vendor, on your own machine.** Nothing here runs in the console or in
> GitHub Actions: plaintext and the private key exist only on your machine, and step 9 deletes
> them. The design is the plan of record's doc 03 §8 and doc 09 §5; this page is the procedure.
> Measured restore times live on the console's Runs screen, never here (P-18).

## Before you start

| You need | Where it comes from |
|---|---|
| The run key, e.g. `2026-10-04_full_gh12345678901a1` | Console → Runs. Prefer the newest run whose verdict is `ok`. |
| The run folder | Step 1 |
| The private key (one line, `AGE-SECRET-KEY-1…`) | Console → Keys → Reveal (Owner/Vendor, fresh sign-in, at most 3 reveals a day per person), or your recovery kit |
| `age` 1.3 or newer | github.com/FiloSottile/age/releases (`age --version`) |
| This repository, after `npm ci` | for `npx wrangler`; sign in once with `npx wrangler login` |
| `psql` 17, or Docker | the Postgres restore (Docker can run the drill's own image) |
| A shell with `sha256sum` | Git Bash or WSL on Windows (a PowerShell alternative is in step 2) |

Work in an empty folder and `cd` into it.

## 1. Get the run folder

The console has no one-click archive of a whole run. For a restore, fetch the folder with
`wrangler` (the normal case). The console can download files one at a time: Runs → the run →
Evidence → Run folder detail, or the Files section. Each `data/` file and `checksums.sha256`
needs the `runs.download` capability (Owner or Vendor), a sign-in less than 10 minutes old, and
its own confirmation.

**With Cloudflare working (the normal case):**

```bash
RUN_KEY=2026-10-04_full_gh12345678901a1
PREFIX="v1/runs/full/${RUN_KEY:0:4}/${RUN_KEY:5:2}/$RUN_KEY"     # Supabase-only runs: v1/runs/daily/…
npx wrangler r2 object get "madagascar-backups/$PREFIX/manifest.json" --remote --file manifest.json
npx wrangler r2 object get "madagascar-backups/$PREFIX/checksums.sha256" --remote --file checksums.sha256
node -e "for (const f of require('./manifest.json').files) console.log(f.path)" > files.txt
while read -r path; do
  mkdir -p "$(dirname "$path")"
  npx wrangler r2 object get "madagascar-backups/$PREFIX/$path" --remote --file "$path"
done < files.txt
```

**Without Cloudflare (the account is lost), within 14 days of the run:** every run is also a
GitHub artifact (OD-12). The run id and attempt are in the run key (`gh<run id>a<attempt>`):

```bash
gh run download 12345678901 --repo mascotasmadagascar-cmd/cf-backup --name cf-backup-12345678901-1
cd 2026-10-04_full_gh12345678901a1
```

## 2. Check every file

```bash
sha256sum -c checksums.sha256          # every line must end in OK
```

PowerShell (no output means every file matches):

```powershell
Get-Content checksums.sha256 | ForEach-Object {
  $hash, $path = $_ -split '  ', 2
  if ((Get-FileHash -Algorithm SHA256 $path).Hash.ToLower() -ne $hash) { "MISMATCH $path" }
}
```

`manifest.json` is not in that list: it records every other file's sha256 itself. `report.md`
explains the run's verdict.

## 3. Check that your key opens this run

Save the key as `key.txt`, then compare its fingerprint with the one the run was encrypted to:

```bash
printf %s "$(age-keygen -y key.txt)" | sha256sum | cut -c1-16
node -e "console.log(require('./manifest.json').files.find((f) => f.recipient).recipient)"
```

The two must be equal. If they are not, the run was encrypted to another key: the console's
Keys screen lists every fingerprint, and retired keys stay in Vault (doc 09 §2). cf-backup
cannot re-key an old run to your current key (re-keying is not built), so reveal the key whose
fingerprint matches this run and decrypt with that one.

## 4. Decrypt

```bash
for f in data/d1/*.age data/postgres/*.age; do
  age -d -i key.txt -o "${f%.age}" "$f"
  gunzip -f "${f%.age}"
done
ls data/d1 data/postgres
```

You now have `data/postgres/roles.sql`, `data/postgres/schema.sql`, `data/postgres/data.sql`,
`data/postgres/migrations-history.sql`, and for a full run `data/d1/<database>.sql` plus
`data/d1/<database>.schema.sql` for each D1 database. A Supabase-only run has no `data/d1/`.

> **Not in the backup.** Plan for these before you need them:
>
> - **Sign-in accounts (`auth.*`).** The backup role cannot read Supabase's `auth` schema
>   (Supabase owns it), so every run records `auth.users` as skipped, with a warning. After a
>   loss, accounts are created again: people sign up again or are invited.
> - **Vault secrets**, the backup keys among them: step 5.3 puts them back, the keys from their
>   recovery kits.
> - **Database role passwords:** step 5.1 sets new ones.

## 5. Postgres first (factor B6)

Restore into a **new** Supabase project (if both free project slots are in use, pause the
dormant one first, spike S-7) — Connect → Session pooler URI — or, for a rehearsal, into a local
container of the drill's own image:

```bash
docker run -d --name restore-pg -e POSTGRES_PASSWORD=choose-a-local-password -p 54329:5432 supabase/postgres:17.6.1.104
export NEW_DB_URL="postgresql://postgres:choose-a-local-password@localhost:54329/postgres"
```

Restore in exactly this order, all or nothing:

```bash
psql --single-transaction --variable ON_ERROR_STOP=1 \
  --file data/postgres/roles.sql \
  --file data/postgres/schema.sql \
  --command 'SET session_replication_role = replica' \
  --file data/postgres/data.sql \
  --dbname "$NEW_DB_URL"
psql --single-transaction --variable ON_ERROR_STOP=1 --file data/postgres/migrations-history.sql --dbname "$NEW_DB_URL"
```

Any error stops and rolls the whole file back: fix the cause and rerun on an empty database.
Then check every table against what the dump held:

```bash
cat > counts.mjs <<'EOF'
import { readFileSync } from 'node:fs';
const dumped = JSON.parse(readFileSync('verify/source-counts.json', 'utf8')).databases.postgres.dumped;
const q = (s) => `"${s.replace(/"/g, '""')}"`;
console.log(Object.keys(dumped).map((t) => { const i = t.indexOf('.'); return `SELECT '${t}', count(*), ${dumped[t]} FROM ${q(t.slice(0, i))}.${q(t.slice(i + 1))}`; }).join('\nUNION ALL ') + ';');
EOF
node counts.mjs > counts.sql
psql "$NEW_DB_URL" -At -F ' ' -f counts.sql | awk '$2 != $3 { print "MISMATCH", $0; bad = 1 } END { exit bad }'
```

Then, before anything connects to it:

1. **Reset every login password** (passwords are in no dump, factor B3). List the roles, then set
   a new password for each (`cf_astro_writer`, `backup_reader`, `backup_keyholder`, …):

   ```bash
   psql "$NEW_DB_URL" -At -c "SELECT rolname FROM pg_roles WHERE rolcanlogin AND rolname NOT LIKE 'supabase%' AND rolname NOT IN ('postgres', 'authenticator', 'pgbouncer', 'dashboard_user')"
   psql "$NEW_DB_URL" -c "ALTER ROLE cf_astro_writer WITH PASSWORD 'paste-a-new-generated-password'"
   ```

2. **Update every consumer's secret** if the project changed: cf-astro `npx wrangler secret put DATABASE_URL`
   (in the cf-astro folder); cf-admin and cf-chatbot's Supabase URL and keys; cf-backup's two
   logins with `node scripts/setup/owner-secrets.mjs --only=db` (`SUPABASE_DB_URL`) and `--only=vault`
   (the Hyperdrive config the Worker's `VAULT_DB` binding reads; there is no `SUPABASE_KEYS_URL`
   secret any more). That script names the project it signs in to: point it at the new one first.
3. **Vault secrets are in no dump** (doc 03 §2): re-enter them. For the backup keys, run
   `sql/supabase/02_backup_keys.sql` and `03_backup_keyholder.sql` on the new project, then put each
   key back from its recovery kit: `SELECT backup_private.backup_key_put('<fingerprint>', '<AGE-SECRET-KEY-1…>');`
   (the functions live in schema `backup_private`, doc 09 §6).
4. Run the three compliance counts and the Supabase advisors from cf-admin's
   `documentation/runbooks/disaster-recovery.md` §3.

## 6. D1 second

Within 7 days of the damage, prefer **Time Travel** (in place, minutes): cf-admin's
`documentation/runbooks/disaster-recovery.md` §2. Read its shared-database warning first; `restore`
has no dry run.

From this backup, always into a **new** database, never over production:

```bash
DAY=$(date +%Y%m%d)
npx wrangler d1 create madagascar-db-restore-$DAY --location enam
npx wrangler d1 execute madagascar-db-restore-$DAY --remote --yes --file data/d1/madagascar-db.sql
```

Do the same for `chatbot-kb` and `whatsapp-chatbot`. `chatbot-kb.sql` recreates the `kb_search`
full-text table and rebuilds its index from `knowledge_base`; prove it:

```bash
npx wrangler d1 execute chatbot-kb-restore-$DAY --remote --command "INSERT INTO kb_search(kb_search) VALUES('integrity-check')"
```

Check the counts against the drill's (`verify/restored-counts.json`; the drill restored the same file):

```bash
cat > d1counts.mjs <<'EOF'
import { readFileSync } from 'node:fs';
const counts = JSON.parse(readFileSync('verify/restored-counts.json', 'utf8')).databases[`d1:${process.argv[2]}`];
console.log(Object.keys(counts).map((t) => `SELECT '${t}' AS t, COUNT(*) AS n, ${counts[t]} AS expected FROM "${t.replace(/"/g, '""')}"`).join(' UNION ALL '));
EOF
npx wrangler d1 execute madagascar-db-restore-$DAY --remote --json --command "$(node d1counts.mjs madagascar-db)" \
  | node -e "let s='';process.stdin.on('data',(d)=>s+=d).on('end',()=>{const bad=JSON.parse(s)[0].results.filter((r)=>r.n!==r.expected);console.log(bad.length?bad:'all counts match')})"
```

Then point the bindings at the new databases: copy each `database_id` from `npx wrangler d1 list`
into cf-admin's `wrangler.toml` and cf-astro's `[[d1_databases]]` (`madagascar-db` is shared by
both), and into the Workers that use `chatbot-kb` and `whatsapp-chatbot`; deploy each. A wrong
binding id fails silently (RULESAd §12).

## 7. Close the gap between the two dumps (factor B6)

Postgres and D1 were dumped minutes apart. Once D1 serves again, drain its outboxes:

```bash
npx wrangler d1 execute madagascar-db --remote --command "SELECT (SELECT COUNT(*) FROM booking_attempts WHERE replay_payload IS NOT NULL) AS bookings_pending, (SELECT COUNT(*) FROM consent_attempts WHERE replay_payload IS NOT NULL) AS consents_pending"
```

Bookings drain through cf-admin's `booking-outbox-poke` job every five minutes (Cron page → Run now
to hurry it). Consents drain on request:

```bash
curl -fsS -X POST https://madagascarhotelags.com/api/consent/replay/ -H "Authorization: Bearer $HEALTH_CHECK_SECRET"
```

Replays insert with "on conflict do nothing", so a second delivery is harmless. Rows that reached
Postgres after its dump no longer carry a payload in D1 and cannot be replayed: the
reconstruction is partial, as doc 03 §8 says.

## 8. Re-apply the erasure log before serving traffic (doc 05 §5, T11)

Deletions granted after this backup was taken must be applied again. Use the newest
`legal_requests` you have — the old project if it still answers, otherwise the restored one and
the ARCO reply trail — and list the requests resolved since the dump started:

```bash
SINCE=$(node -e "console.log(require('./manifest.json').timing.startedAt)")
psql "$OLD_DB_URL" -At -F ',' -c "SELECT ticket_number, email, arco_right, updated_at FROM legal_requests WHERE arco_right IN ('cancellation', 'opposition') AND status = 'RESOLVED' AND updated_at >= '$SINCE' ORDER BY updated_at"
```

For each `cancellation`, on the restored database, do what cf-astro's ARCO runbook §4 does (check
the column names first with `\d bookings`):

```sql
BEGIN;
DELETE FROM booking_pets             WHERE booking_id IN (SELECT id FROM bookings WHERE lower(owner_email) = lower('person@example.com'));
DELETE FROM booking_quality_metadata WHERE booking_id IN (SELECT id FROM bookings WHERE lower(owner_email) = lower('person@example.com'));
DELETE FROM bookings                 WHERE lower(owner_email) = lower('person@example.com');   -- email_audit_logs cascade
DELETE FROM contact_messages         WHERE lower(email) = lower('person@example.com');
COMMIT;
-- consent_records stay: they are legal evidence (ARCO runbook §4).
```

For each `opposition`, repeat the processing stop its reply recorded. Then bring the newer
`legal_requests` rows themselves into the restored database:

```bash
psql "$OLD_DB_URL" -c "\copy (SELECT * FROM legal_requests WHERE updated_at >= '$SINCE') TO 'legal_requests_after.csv' CSV HEADER"
psql "$NEW_DB_URL" <<'SQL'
CREATE TEMP TABLE lr_after (LIKE legal_requests INCLUDING DEFAULTS);
\copy lr_after FROM 'legal_requests_after.csv' CSV HEADER
INSERT INTO legal_requests SELECT * FROM lr_after
  ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, arco_right = EXCLUDED.arco_right, updated_at = EXCLUDED.updated_at;
SQL
```

D1 `booking_attempts` / `consent_attempts` rows for the same people are purged through cf-admin's
`/dashboard/retention` (ARCO runbook §3).

## 9. Clean up

```bash
rm -f key.txt data/d1/*.sql data/postgres/*.sql counts.sql counts.mjs d1counts.mjs legal_requests_after.csv files.txt
docker rm -f restore-pg                                                  # if you used the local container
npx wrangler d1 delete madagascar-db-restore-$DAY --skip-confirmation    # only if this was a rehearsal
```

Keep the encrypted `.age` files; delete everything that was decrypted.

## 10. Record it

Twice a year, rehearse this whole page end to end (doc 03 §8 step 7, OD-15). Write down the run
key, who did it, the date, how long each step took (that is the real recovery time) and every
problem, in `docs/records/<date>-restore-rehearsal.md`.

Then record the decrypt in the console: Keys → Restore proof, with the run key and the date.
The console shows the newest proof's age, and when it is more than six months old (or none
exists while a good backup does) the daily check raises a key reminder through the alerts.

## Break-glass backup from your machine (P-19)

When GitHub Actions cannot run a backup, run the same pipeline yourself. It needs Node 22.18 or
newer (24 recommended), Docker running, `age`, and the Supabase CLI 2.117.0 on your PATH
(`AGE_BIN` / `SUPABASE_BIN` can point elsewhere). Paste the secrets without echo, so they never
reach your shell history:

```bash
read -rs CLOUDFLARE_API_TOKEN && export CLOUDFLARE_API_TOKEN     # paste, then Enter
read -rs SUPABASE_DB_URL && export SUPABASE_DB_URL
export CLOUDFLARE_ACCOUNT_ID=your-account-id BACKUP_AGE_RECIPIENT=age1your-active-recipient
npm ci
npm run backup:local -- --scope full        # --mode drill adds the real-path D1 drill; --no-upload keeps it on disk only
```

(PowerShell 7: `$env:CLOUDFLARE_API_TOKEN = Read-Host -MaskInput`, and the same for `SUPABASE_DB_URL`.)

It writes `backup-local/work/out/<runKey>/` in the same shape as a GitHub run (trigger `local`),
uploads it to R2 unless you pass `--no-upload`, and records a `backup_runs` row with trigger
`local` — it refuses to start while another backup is running. Afterwards,
`backup-local/work/plain/` must be empty: the seal step deletes the plaintext it encrypted;
delete anything left there by hand.
