---
title: "cf-backup remediation — 10 SOP: manual baseline export (Owner)"
status: active
audience: [owner, operator, technical]
last_verified: 2026-09-25
verified_against: [code, infra, live-mcp, research]
owner: harshil
related_docs: [README.md, 06-remediation-plan.md, 09-secondary-pipeline-specification.md, 11-terminology-standard.md, ../RESTORE.md]
tags: [cf-backup, remediation, sop, manual-baseline-export, supabase, d1]
---

# 10 — SOP: manual baseline export

> **TL;DR (non-technical):** A step-by-step procedure, performed on the Owner's own computer in
> about 45 minutes. It exports the Supabase database (authentication records included) and the three
> D1 databases, encrypts the files with the archive encryption key, stores them in two locations,
> and decrypts one to prove it works. The result is the business's first verified recovery point.
> Repeat weekly until the Secondary Pipeline is operating and authentication records are covered by
> the automated pipelines.

## 0. Scope

| | |
|---|---|
| **Purpose** | Stage 0.4 and 0.5 of [06](06-remediation-plan.md): a manual recovery point of Supabase (as the `postgres` user, so `auth` is included) and of `madagascar-db`, `chatbot-kb` and `whatsapp-chatbot` |
| **Out of scope** | Restoring: see [RESTORE.md](../RESTORE.md) and [09](09-secondary-pipeline-specification.md) §5 |
| **Frequency** | Today; then weekly until Stage 1 passes, and until Stage 3 passes (authentication records). Retain the four most recent manual baseline exports until then |
| **Performed by** | The Owner, on the Owner's machine. Plain-text files exist only there, and step 7 deletes them |
| **Duration** | About 45 minutes |

## 1. Prerequisites

| Requirement | Source |
|---|---|
| Docker Desktop, running | docker.com (the Supabase CLI runs `pg_dump` in a container) |
| This repository, after `npm ci`, signed in once with `npx wrangler login` | For `npx wrangler` |
| `age` and `age-keygen`, version 1.3 or later | github.com/FiloSottile/age/releases |
| The archive encryption key's public recipient (`age1…`) | Console → Keys (the active key) |
| The offline recovery key (`AGE-SECRET-KEY-1…`) | The Owner's password manager ([06](06-remediation-plan.md) 0.1); the console calls it the "recovery kit" |
| The Supabase **session pooler** connection string for the `postgres` user, including its password | Supabase dashboard → Connect → Session pooler. Do not reset the password unless nothing else depends on it |
| A shell | Git Bash or WSL on Windows; Terminal on macOS or Linux |

Work in a new, empty directory, on an encrypted disk (BitLocker or FileVault) where possible.

## 2. Session set-up

```bash
read -rsp 'Session pooler connection string: ' PG_URL; echo; export PG_URL
R='age1…'                       # the active recipient from Console → Keys
D=$(date -u +%F)
```

`read -s` keeps the connection string off the screen and out of the shell history.

## 3. Supabase export (official procedure, authentication records included)

These are the commands of Supabase's own procedure
([Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)).
As the `postgres` user they include the `auth` schema: the 6 authentication records and their
identities.

```bash
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f roles.sql --role-only
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f schema.sql
npx supabase@2.117.0 db dump --db-url "$PG_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
ls -l roles.sql schema.sql data.sql          # none may be empty
grep '^COPY' data.sql | grep -c auth         # greater than 0: authentication records included
```

**Alternative if the CLI fails** (Docker networking on Windows is the usual cause): `pg_dump` 17 from
the image the Primary Pipeline pins, without the CLI:

```bash
IMG=public.ecr.aws/supabase/postgres:17.6.1.104
pgd() { docker run --rm -i -e PG_URL --entrypoint sh "$IMG" -c "exec pg_dump \"\$PG_URL\" $*"; }
pgd --schema-only --schema=public --schema=supabase_migrations > schema.sql
pgd --data-only   --schema=public --schema=supabase_migrations > data.sql
pgd --data-only   --table=auth.users --table=auth.identities   > auth-data.sql
ls -l schema.sql data.sql auth-data.sql
```

If the last command is refused, this recovery point does not include authentication records: note
it, and retry the CLI procedure on another day.

## 4. D1 export (three databases)

D1 also has 7 days of Time Travel, so Supabase has the higher priority today. D1 takes about two
minutes:

```bash
npx wrangler d1 export madagascar-db    --remote --skip-confirmation --output d1-madagascar-db.sql
npx wrangler d1 export whatsapp-chatbot --remote --skip-confirmation --output d1-whatsapp-chatbot.sql
npx wrangler d1 export chatbot-kb --remote --skip-confirmation --output d1-chatbot-kb.sql \
  --table knowledge_base --table bot_config --table model_registry --table system_prompts --table d1_migrations
```

`chatbot-kb` contains a full-text search table that D1 will not export, so the last command names
the base tables. If D1 still refuses, export each base table as JSON, plus the schema:

```bash
for t in knowledge_base bot_config model_registry system_prompts d1_migrations; do
  npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT * FROM $t" > "d1-chatbot-kb-$t.json"
done
npx wrangler d1 execute chatbot-kb --remote --json --command "SELECT type, name, sql FROM sqlite_master" > d1-chatbot-kb-schema.json
```

## 5. Encryption and storage in two locations

```bash
shopt -s nullglob
for f in *.sql *.json; do
  gzip -9 "$f"
  age -r "$R" -o "$f.gz.age" "$f.gz" && rm "$f.gz"
done
sha256sum *.age > SHA256SUMS
ls -l *.age

for f in *.age SHA256SUMS; do
  npx wrangler r2 object put "madagascar-backups/secondary/manual/$D/$f" --remote --file "$f"
done
```

Then copy the same `*.age` files and `SHA256SUMS` to a second location under the Owner's control,
**outside Cloudflare**: an external drive or a personal cloud drive. **Encrypted files only.** They
contain personal data (bookings, consent records, password hashes), so inform whoever maintains the
records of processing (cf-admin's security documentation, activity J) of the second location.

## 6. Verification

Save the offline recovery key temporarily as `key.txt`, then:

```bash
age-keygen -y key.txt                                   # must equal $R
age -d -i key.txt -o check.sql.gz data.sql.gz.age && gunzip -c check.sql.gz | grep -c '^COPY'
```

A result greater than 0 confirms the recovery point decrypts with the offline recovery key and
contains table data.

## 7. Clean-up and record

```bash
rm -f key.txt check.sql.gz *.sql *.json
unset PG_URL
```

Retain the `*.age` files and `SHA256SUMS` (encrypted). Empty the recycle bin if the files were moved
there. Send engineering the date, the output of `ls -l *.age`, and whether authentication records
were included; these are recorded as evidence in [06](06-remediation-plan.md) §12.

## 8. Troubleshooting

| Symptom | Probable cause | Action |
|---|---|---|
| `db dump` hangs or cannot connect | Docker networking on Windows | Use the alternative in §3 |
| `permission denied` on `auth.users` in the alternative | `postgres` lacks access to that table | The CLI procedure is then the only way to include authentication records |
| `wrangler d1 export chatbot-kb` refused with `--table` | D1 refuses any database containing a virtual table | Use the JSON procedure in §4 |
| `age-keygen -y key.txt` prints a different `age1…` | The offline recovery key belongs to another (retired) key | Reveal the active key on the Keys screen before continuing |
| `wrangler r2 object put` refused | Not signed in, or no R2 access on this account | `npx wrangler login` again; the second location (§5) still counts |

## 9. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-25 | claude | Supabase CLI procedure reviewed; CLI version pinned as in `pins.ts` (2.117.0) | §3 commands |
| 2026-09-25 | claude | Live `chatbot-kb` `sqlite_master` (5 base tables, 1 full-text table) | §4 |
| 2026-09-25 | claude | Procedure not yet performed by the Owner | First execution pending |

## 10. Related

- [06-remediation-plan.md](06-remediation-plan.md) §3: where this procedure sits.
- [09-secondary-pipeline-specification.md](09-secondary-pipeline-specification.md): the same procedure, automated.
- [RESTORE.md](../RESTORE.md): restoring from a cf-backup run.
