---
title: "cf-backup recovery — 10 Manual backup runbook (for the owner)"
status: active
audience: [owner, operator, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_docs: [README.md, 06-plan.md, 09-lifeboat-spec.md, ../RESTORE.md]
tags: [cf-backup, recovery, runbook, manual-backup, supabase, d1]
---

# 10 — Manual backup runbook

> **TL;DR (non-technical):** Step by step, on your own computer, about 45 minutes: copy the
> Supabase database (sign-in accounts included) and the three D1 databases, lock the copies with
> the backup key, store them in two places, and open one to prove it works. This is the
> business's first real backup. Repeat it weekly until the automated lifeboat is running, and
> until sign-in accounts are in the automated backups.

## 0. Context / Scope

- **Covers:** Stage 0.4 and 0.5 of [06](06-plan.md): a manual backup of Supabase (as the `postgres`
  user, so it includes `auth`) and of `madagascar-db`, `chatbot-kb` and `whatsapp-chatbot`.
- **Does not cover:** restoring. For that, see [RESTORE.md](../RESTORE.md) and [09](09-lifeboat-spec.md) §5.
- **When:** today, then once a week until the lifeboat is green (Stage 1), and until sign-in
  accounts are in the automated backups (Stage 3). Keep the newest four manual copies until then.
- Everything runs on your own machine. Plain-text files exist only there, and step 7 deletes them.

## 1. What you need

| You need | Where it comes from |
|---|---|
| Docker Desktop, running | docker.com (the Supabase CLI runs `pg_dump` in a container) |
| This repository, after `npm ci`, signed in once with `npx wrangler login` | For `npx wrangler` |
| `age` and `age-keygen`, 1.3 or newer | github.com/FiloSottile/age/releases |
| The backup key's public recipient (`age1…`) | Console → Keys (the active key) |
| Your recovery kit (`AGE-SECRET-KEY-1…`) | Your password manager ([06](06-plan.md) 0.1) |
| The Supabase **session pooler** connection string for the `postgres` user, with its password | Supabase dashboard → Connect → Session pooler. Do not reset the password unless you know nothing else uses it |
| A shell | Git Bash or WSL on Windows; Terminal on macOS or Linux |

Work in a new, empty folder, on an encrypted disk (BitLocker or FileVault) if you can.

## 2. Set up the session

```bash
read -rsp 'Session pooler connection string: ' PG_URL; echo; export PG_URL
R='age1…'                       # paste the active recipient from Console → Keys
D=$(date -u +%F)
```

`read -s` keeps the connection string off the screen and out of the shell history.

## 3. Supabase: the official dump, sign-in accounts included

These are the commands of Supabase's own guide
([Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)).
As the `postgres` user they include the `auth` schema: the 6 sign-in accounts and their
identities.

```bash
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f roles.sql --role-only
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f schema.sql
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
ls -l roles.sql schema.sql data.sql          # none of them may be empty
grep '^COPY' data.sql | grep -c auth         # more than 0: sign-in data is in
```

**If the CLI fails** (Docker networking on Windows is the usual cause), use `pg_dump` 17 from the
same image the backup runner pins. This does not need the CLI:

```bash
IMG=public.ecr.aws/supabase/postgres:17.6.1.104
pgd() { docker run --rm -i -e PG_URL --entrypoint sh "$IMG" -c "exec pg_dump \"\$PG_URL\" $*"; }
pgd --schema-only --schema=public --schema=supabase_migrations > schema.sql
pgd --data-only   --schema=public --schema=supabase_migrations > data.sql
pgd --data-only   --table=auth.users --table=auth.identities   > auth-data.sql
ls -l schema.sql data.sql auth-data.sql
```

If the last command is refused, the sign-in accounts are not in this copy: write that down and try
the CLI again another day.

## 4. D1: the three databases

D1 also has 7 days of Time Travel, so Supabase matters more today. D1 still takes two minutes:

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output d1-whatsapp-chatbot.sql
npx wrangler d1 export chatbot-kb --remote --skip-confirmation --output d1-chatbot-kb.sql \
  --table knowledge_base --table bot_config --table model_registry --table system_prompts --table d1_migrations
```

`chatbot-kb` has a full-text search table that D1 will not export, so the last command names the
real tables. If D1 refuses it anyway, save each of those five tables as JSON, plus the schema:

```bash
for t in knowledge_base bot_config model_registry system_prompts d1_migrations; do
  npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT * FROM $t" > "d1-chatbot-kb-$t.json"
done
npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT type, name, sql FROM sqlite_master" > d1-chatbot-kb-schema.json
```

## 5. Encrypt, and store in two places

```bash
shopt -s nullglob
for f in *.sql *.json; do
  gzip -9 "$f"
  age -r "$R" -o "$f.gz.age" "$f.gz" && rm "$f.gz"
done
sha256sum *.age > SHA256SUMS
ls -l *.age

for f in *.age SHA256SUMS; do
  npx wrangler r2 object put "madagascar-backups/lifeboat/manual/$D/$f" --remote --file "$f"
done
```

Then copy the same `*.age` files and `SHA256SUMS` to a second place you control, **not in
Cloudflare**: an external drive or your personal cloud drive. **Only the encrypted files.** They
hold personal data (bookings, consent records, password hashes), so tell whoever keeps the records
of processing (cf-admin's security docs, activity J) where the second copy lives.

## 6. Prove it opens

Save your recovery kit as `key.txt` for a minute, then:

```bash
age-keygen -y key.txt                                   # must equal $R
age -d -i key.txt -o check.sql.gz data.sql.gz.age && gunzip -c check.sql.gz | grep -c '^COPY'
```

A number above 0 means the backup opens with your kit and holds table data.

## 7. Clean up and record

```bash
rm -f key.txt check.sql.gz *.sql *.json
unset PG_URL
```

Keep the `*.age` files and `SHA256SUMS` (they are encrypted). Empty the recycle bin if the files
went there. Send the engineer the date, `ls -l *.age`, and whether sign-in data was included; they go
into the Status table of [06](06-plan.md) §12.

## 8. Operational notes / failure modes

| Symptom | Likely cause | What to do |
|---|---|---|
| `db dump` hangs or cannot connect | Docker's networking on Windows | Use the `pgd` route in §3 |
| `permission denied` on `auth.users` in the `pgd` route | `postgres` lacks access to that table | The CLI route is then the only way to include sign-in accounts |
| `wrangler d1 export chatbot-kb` refuses with `--table` | D1 refuses any database with a virtual table | Use the JSON route in §4 |
| `age-keygen -y key.txt` prints a different `age1…` | The kit is for another (retired) key | Reveal the active key's kit on the Keys screen before going on |
| `wrangler r2 object put` refused | Not signed in, or no R2 access on this account | `npx wrangler login` again; the second copy (§5) still counts |

## 9. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Supabase CLI guide read; CLI version pinned as in `pins.ts` (2.117.0) | §3 commands |
| 2026-09-25 | claude | Live `chatbot-kb` `sqlite_master` (5 real tables, 1 full-text table) | §4 |
| 2026-09-25 | claude | Not yet run by the owner | First run pending |

## 10. Related

- [06-plan.md](06-plan.md) §3: where this runbook sits.
- [09-lifeboat-spec.md](09-lifeboat-spec.md): the same job, automated.
- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
