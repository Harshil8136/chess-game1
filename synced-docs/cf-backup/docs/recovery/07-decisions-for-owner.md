# 07: Decisions for the owner

Each has a recommended default. If the owner says nothing, work proceeds on the default, and every
default can be changed later.

## 1. How to back up sign-in accounts (`auth.users`)

Today 6 accounts and 12 identities are **not** in any backup. After a disaster, everyone who signs
in to the admin would have to be invited again.

| Choice | What it means | Restores passwords? | Keeps the Vault refused? | Owner effort |
|---|---|---|---|---|
| **a. Read-only views owned by `postgres` (default)** | A small schema of views over `auth.users` and `auth.identities`; only the backup role may read them | Yes (password hashes included) | Yes | Run one SQL file once |
| b. Back up as `postgres` | Put the `postgres` connection string in GitHub | Yes | **No**: the runner could read the Vault | Change one secret |
| c. Auth Admin API | The runner lists users with the service key | **No**: everyone resets their password | Yes, but a service key goes to GitHub | Add one secret |
| d. Accept the gap | Re-invite everyone after a disaster | - | Yes | None |

Default: **a**. Note: the views hold password hashes, so the backup files hold them too. They are
encrypted like everything else.

## 2. Test resources for the rehearsal job

The rehearsal needs somewhere to write that is not production.

- **Default:** a 4th D1 database (free; 10 are allowed) and a second, small R2 bucket with no
  object locks (free up to 10 GB-month in total; the rehearsal uses kilobytes). A test Cloudflare
  token scoped to only those two. Postgres runs in a container on the runner, so there is no second
  Supabase project.
- Alternative: an unlocked prefix in the backup bucket. It is cheaper to set up, but the rehearsal
  token could then reach the real backups.

## 3. The drill key: may a key that decrypts backups live in GitHub?

- **Default: no.** The weekly drill checks the downloaded ciphertext (header, size, checksum) and
  restores the plain files exported in the same run. Decryption of a real backup is proven by a
  person with the recovery kit, monthly for the first 3 months, then quarterly.
- Alternative: each backup is also encrypted to a second "drill" key held as a GitHub secret, so
  the drill decrypts in CI. It is stronger proof every week, but someone with that secret and read
  access to the bucket can read backups.

## 4. Feature freeze on cf-backup

- **Default: yes.** No new console, diagnostics or layout work until the definition of done in
  [06](06-plan.md) is met, about 5 working days plus the 30-day soak. The freeze is lifted after the
  first 7 green scheduled days if the owner wants, with the soak continuing.
- The console stays as it is. Only defects that block a backup are fixed.

## 5. Pause the schedules until Phase 1

- **Default: yes.** Pause the cf-admin daily dispatch (a setting in the console) and comment out
  the Monday fallback cron, so no scheduled run fails while the fixes land. D1 keeps its native
  7-day Time Travel meanwhile. Supabase has no copy either way until Phase 1.

## 6. Rehearsal as staging

The owner decided earlier: no staging. **Default:** the rehearsal job serves as staging for
cf-backup. It uses test resources and costs no money. It is not a copy of production, and it is
the only place where the pipeline runs for real before production.

## 7. GitHub Actions budget for cf-backup

- **Default:** a ceiling of **400 minutes a month** for cf-backup (the estimate is 230 to 280; see
  [06](06-plan.md)). This leaves 1,600 for the other two repositories. If the measured figure
  goes over, the rehearsal first drops its weekly run, then runs only on pull requests that change
  the runner.

## Not a decision, but owed by the owner

- Phase 1: start one runner test and one full backup when told the rehearsal is green.
- Phase 2: run one SQL file in the Supabase SQL editor.
- Phase 4: one restore by hand from the bucket with the recovery kit (about an hour). **Check now
  that the recovery kit (the backup key's private half) is where the kit says it is.** Nothing
  else in this plan can make up for a lost key.
