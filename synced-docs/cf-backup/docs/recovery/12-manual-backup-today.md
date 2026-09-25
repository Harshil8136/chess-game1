# 12: A manual backup, today (for the owner)

Stage 0.3 of [10](10-robust-plan.md). About 45 minutes. It gives the business its **first real
backup**, including the sign-in accounts, which no automated path covers yet. Repeat it once a
week until the lifeboat ([11](11-lifeboat.md)) is green. Keep the newest four manual copies until
Stage 3 is green.

Everything runs on your own machine. Plain-text files exist only there, and step 7 deletes them.

## What you need

| You need | Where it comes from |
|---|---|
| Docker Desktop, running | docker.com (the Supabase CLI runs `pg_dump` in a container) |
| This repository, after `npm ci`, signed in once with `npx wrangler login` | for `npx wrangler` |
| `age` and `age-keygen`, 1.3 or newer | github.com/FiloSottile/age/releases |
| The backup key's public recipient (`age1…`) | Console → Keys (the active key) |
| Your recovery kit (`AGE-SECRET-KEY-1…`) | Your password manager (Stage 0.1) |
| The Supabase **session pooler** connection string for the `postgres` user, with its password | Supabase dashboard → Connect → Session pooler. Do not reset the password unless you know nothing else uses it |
| A shell | Git Bash or WSL on Windows; Terminal on macOS or Linux |

Work in a new, empty folder, on a disk that is encrypted (BitLocker or FileVault) if you can.

## 1. Set up the session

```bash
read -rsp 'Session pooler connection string: ' PG_URL; echo; export PG_URL
R='age1…'                       # paste the active recipient from Console → Keys
D=$(date -u +%F)
```

`read -s` keeps the connection string out of the screen and out of the shell history.

## 2. Supabase: the official dump, sign-in accounts included

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

If the last command is refused, the sign-in accounts are not in this copy. Write that down, and
try the CLI again another day.

## 3. D1: the three databases

D1 also has 7 days of Time Travel, so Supabase matters more today. D1 still takes two minutes:

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output d1-whatsapp-chatbot.sql
npx wrangler d1 export chatbot-kb --remote --skip-confirmation --output d1-chatbot-kb.sql \
  --table knowledge_base --table bot_config --table model_registry --table system_prompts --table d1_migrations
```

`chatbot-kb` has a full-text search table that D1 will not export, so the last command names the
real tables. If D1 refuses it anyway, save each of those five tables as JSON instead, plus the
schema:

```bash
for t in knowledge_base bot_config model_registry system_prompts d1_migrations; do
  npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT * FROM $t" > "d1-chatbot-kb-$t.json"
done
npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT type, name, sql FROM sqlite_master" > d1-chatbot-kb-schema.json
```

## 4. Encrypt

```bash
shopt -s nullglob
for f in *.sql *.json; do
  gzip -9 "$f"
  age -r "$R" -o "$f.gz.age" "$f.gz" && rm "$f.gz"
done
sha256sum *.age > SHA256SUMS
ls -l *.age
```

## 5. Store it in two places

```bash
for f in *.age SHA256SUMS; do
  npx wrangler r2 object put "madagascar-backups/lifeboat/manual/$D/$f" --remote --file "$f"
done
```

Then copy the same `*.age` files and `SHA256SUMS` to a second place you control, not in
Cloudflare: an external drive, or your personal cloud drive. **Only the encrypted files.** They
hold personal data (bookings, consent records, password hashes), so tell whoever keeps the
records of processing (cf-admin's security docs, activity J) where the second copy lives.

## 6. Prove it opens

Save your recovery kit as `key.txt` for a minute, then:

```bash
age-keygen -y key.txt                                   # must equal $R
age -d -i key.txt -o check.sql.gz data.sql.gz.age && gunzip -c check.sql.gz | grep -c '^COPY'
```

A number above 0 means the backup opens with your kit and holds table data.

## 7. Clean up

```bash
rm -f key.txt check.sql.gz *.sql *.json
unset PG_URL
```

Keep the `*.age` files and `SHA256SUMS` (they are encrypted). Empty the recycle bin if the files
went there.

## 8. Record it

Send the engineer the date, the file names and sizes (`ls -l *.age`), and whether sign-in data was
included. They go into the Status table of [10](10-robust-plan.md) as Stage 0.3's evidence.
