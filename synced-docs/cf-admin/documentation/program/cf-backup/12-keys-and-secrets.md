---
title: "cf-backup — 12 API keys and secrets: the complete list, and exactly how to set each"
status: draft
audience: [owner, operator, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 03-backup-pipeline.md, 05-security-and-compliance.md, 09-key-management.md, 13-access-control.md]
tags: [program, cf-backup, secrets, api-keys, setup, runbook]
---

<!-- docs-check: proposed-paths -->
<!-- Built and deployed 2026-09-23/24; this doc describes the keys as built. Paths in cf-backup's own repository (scripts/setup/…, sql/supabase/…) are named here and do not exist in cf-admin. -->

# 12 — API keys and secrets

> **TL;DR (owner requirement, 2026-09-22: "as few keys as possible, none in cf-admin").**
> The whole backup system runs on **four keys from three providers**, and **cf-admin
> gets none**:
>
> | # | Key | Provider | Lives in | Used for |
> |---|---|---|---|---|
> | 1 | `CLOUDFLARE_API_TOKEN` | Cloudflare | GitHub secret, cf-backup repo | Everything the backup run does at Cloudflare: D1 exports and the monthly drill, uploads to R2 (the S3 keys are *derived* from this token), the usage snapshot, the daily tick dead-man check |
> | 2 | `SUPABASE_DB_URL` | Supabase | GitHub secret, cf-backup repo | `supabase db dump`, as a read-only role |
> | 3 | `GITHUB_APP_PRIVATE_KEY` | GitHub | cf-backup Worker secret | Everything cf-backup does at GitHub: start and cancel runs; read runs, steps and logs; set the public-key variable; list secret *names* for Readiness; read the App's own permissions; count Actions minutes |
> | 4 | The Vault login (`backup_keyholder`) | Supabase | Hyperdrive config `cf-backup-vault`, which the cf-backup Worker binds as `VAULT_DB` | The backup-key screens only: rotate, reveal, the weekly key check. It can call three functions and nothing else |
>
> Everything else is a public value (a variable or a console setting) or a binding.
> cf-admin gains **one service binding and zero secrets**.

## 1. Why four, and not fewer or more

**One per provider, per place it is needed.** GitHub needs to reach Cloudflare and
Supabase (it does the dumping). The cf-backup Worker needs to reach GitHub and the Vault
(it does the managing). The Cloudflare resources the Worker uses (R2, D1) come through
**bindings**, which are not keys. Key 4 is the one binding that carries a credential: the
Hyperdrive config holds the Vault login, and the Worker only ever sees the binding. The
Worker has no email queue of its own: alerts leave through cf-admin's `backup-tick` job
and its `EMAIL_QUEUE` (design D-11).

**Why Supabase has two.** The Supabase credential GitHub holds must **never** be able to
read the backup key. If it could, anyone who could read a GitHub secret could decrypt
every backup, and public-key encryption would protect nothing. So the dump reader (in
GitHub) and the key holder (behind the Worker) are deliberately different roles.

**Key 4 is required, as built.** The only way to create a backup key is the console
(Keys → Rotate), which needs key 4 and key 3. The by-hand `scripts/backup-key-*` commands an
earlier draft planned were not built. Without key 4 there is no backup key, and without a
key the scheduler dispatches no backup: the Supabase slots record "not configured" and the
weekly full slot runs as a check (every export and restore drill, no data kept).

**What was merged away** compared with the 2026-09-21/22 drafts:

| Removed | Where its job went |
|---|---|
| `CLOUDFLARE_DRILL_TOKEN` (D1 Edit, monthly drill) | Key 1 |
| `R2_BACKUP_WRITER_KEY_ID` / `_SECRET` (R2 S3 keys) | **Derived from key 1** at run time: the S3 access key ID is the token's ID and the secret is the SHA-256 of the token value (*confirmed*, R2 API tokens docs) |
| `CF_USAGE_TOKEN` (Worker, analytics) | The runner takes the account snapshot with key 1 on every run. For live D1 figures, the Worker reads cf-admin's existing hourly usage reading from D1 (`cron-control`, read-only) |
| `GITHUB_METER_APP_PRIVATE_KEY` (a second App) | Key 3: one App. Each token the Worker mints is narrowed to the repos and permissions of that call (§6) |
| `BACKUP_PASSPHRASE` (symmetric) | Public-key encryption; the public key is not a secret |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` and share-link keys | Not needed: the storage move is parked |
| `SUPABASE_KEYS_URL` (Worker secret, key 4 until 2026-09-24) | The Hyperdrive config behind `VAULT_DB` (§7). The old secret is read by nothing; delete it |

**The price of fewer keys** (honest): key 1 is broader than three single-purpose tokens
would be. D1 Edit is account-wide, covering every D1 database including production. It is
needed by the monthly real-path drill, and possibly by the export itself (spike S-8).
§4.6 says what a leak could do and how it is contained.

## 2. Where keys do **not** go

| Place | What it holds for backups |
|---|---|
| **cf-admin Worker** | **Nothing new.** One `[[services]]` binding, `BACKUP`, which is not a key. Its env count stays at 42 (RULE #0.8) |
| **cf-admin GitHub repo** | Only during the **bridge** (P0 step 0.0): the existing `backups.yml` needs its own four secrets there. They are deleted when Phase 1 retires that workflow (P1e). They are GitHub *repository* secrets, not cf-admin Worker env vars, so they never counted toward RULE #0.8 |
| cf-astro, cf-chatbot, the email consumer | Nothing |
| Anywhere at rest, outside Supabase Vault | Never a backup private key. The recovery kits live in the Owner's and the Vendor's own password managers (doc 09) |
| Chat, email, tickets, docs, shell history | Never a key value. Paste secrets only at the prompts of `gh secret set` / `wrangler secret put`, or let cf-backup's owner-run `scripts/setup/owner-secrets.mjs` generate and store them |

## 3. Settings that are not keys

| Name | Kind | Where | Value | Set by |
|---|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | GitHub **variable** | cf-backup repo | The account's id (an identifier, not a secret) | Owner, once |
| `BACKUP_AGE_RECIPIENT` | GitHub **variable** | cf-backup repo | The active backup **public** key | cf-backup, on every rotation (doc 09 §3) |
| GitHub App ID | Console setting (`backup:config`, `github.appId`) | Settings → GitHub in the console | The App's number | Owner, once |
| Everything operational: thresholds, cooldowns, alert recipients, notification routing, refresh intervals, the minutes-meter repositories | D1 row `backup:config` | Edited in the console ([13](13-access-control.md) §7) | — | Holders of `config.edit` |

cf-backup's Worker configuration file is `wrangler.json`; it has no `[vars]` for any of
these, and cf-backup has no Sentry DSN.

## 4. Key 1 — `CLOUDFLARE_API_TOKEN`

### 4.1 Exactly what it may do

| Scope | Permission | Why |
|---|---|---|
| Account | **D1 → Edit** | Export the three databases, the query-based `chatbot-kb` export, create and delete the monthly drill database, write the run's `backup_runs` row, and read `backup:status` for the tick dead-man check |
| Account | **Account Analytics → Read** | The account usage snapshot (doc 11 §5.4) |
| Bucket `madagascar-backups` only | **Workers R2 Storage Bucket Item Write, and (as built, Ruling 18) Item Read** | Upload run folders and live heartbeats (Write); `doctor`'s bucket `HEAD` and the previous-manifest `GET`s the size-anomaly and drill-speed verdicts need (Read). Bucket-scoped item permissions work only through the S3 API (*confirmed*), which is what the runner uses |
| Account (*only if needed*) | Workers R2 Storage → Read | Only if the per-bucket usage figure for the *other* buckets needs it (to verify in P0). Read-only |

Nothing else: no Workers scripts, no DNS, no Access, no other buckets' objects.

**Leave Client IP Address Filtering OFF on this token.** GitHub-hosted runners use
changing addresses. With a filter, the token's verify call still passes, but every D1 and
R2 call from the runner is refused: seen on 2026-09-24, when every D1 call answered
"Authentication error" and R2 answered 403 from a runner while the same token worked from
the owner's machine. `doctor` now names both causes (a missing permission, or IP
filtering) when D1 or R2 refuses a token that verified.

### 4.2 What kind of token

An **account API token** (Manage Account → Account API Tokens). It belongs to the account,
not to a person, so it keeps working if someone leaves. New account tokens carry a `cfat_`
prefix that secret scanners recognise (*confirmed*, account API tokens docs). Creating one
needs the Super Administrator role. The runner verifies the token at the account endpoint
first and falls back to the user endpoint, so a user token with the same permissions also
works.

**Expiry: 12 months.** Every run's `doctor` reads the expiry from the token-verify
endpoint and warns within 30 days; Readiness shows that reading (the runner doctor), and
the secrets calendar raises a reminder 30 days ahead.

### 4.3 How to create it

1. **If the account token form offers the bucket-scoped R2 item permission:** Manage Account → Account API Tokens → Create Token → add the permissions in §4.1 → set the expiration date → Create. Copy the value; it is shown once.
2. **If it does not:** create it with one API call. The R2 docs describe a bucket resource of the form `com.cloudflare.edge.r2.bucket.<ACCOUNT_ID>_default_madagascar-backups`, combined in one token with account-level policies. Do it with a short-lived *bootstrap* token that may only create account API tokens, then delete the bootstrap token. Take permission-group ids from the permission-groups list endpoint at that moment; never copy them from a document.

### 4.4 How to store it

```bash
# From any machine with the GitHub CLI signed in as the owner.
# The value is pasted at the prompt, so it never lands in shell history.
gh secret set CLOUDFLARE_API_TOKEN --repo mascotasmadagascar-cmd/cf-backup
gh variable set CLOUDFLARE_ACCOUNT_ID --repo mascotasmadagascar-cmd/cf-backup
```

cf-backup's `scripts/setup/owner-secrets.mjs --only=cf-token` stores the token after
checking it live against D1 and R2 (it reads the value from the owner's local `.dev.vars`,
never from a prompt that echoes).

### 4.5 How the run uses it, including the derived R2 keys

What the runner's plan step does (in TypeScript, `scripts/backup/lib/credentials.ts`), in
shell terms:

```bash
# The verify path is /accounts/<id>/tokens/verify for an account token,
# or /user/tokens/verify for a user token.
TOKEN_ID=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify" | jq -r .result.id)
R2_SECRET=$(printf %s "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)
# S3 client settings: key id = $TOKEN_ID, secret = $R2_SECRET,
# endpoint https://<ACCOUNT_ID>.r2.cloudflarestorage.com, region auto
```

**Checked on every run by `doctor`**: the token is active and not near expiry; a D1
`select 1` answers per database; an R2 `HEAD` on the bucket answers. Each store runs only
when its own checks pass (a D1 failure never stops the Postgres dump, and the reverse).
Readiness shows whether the secret is set; with `keys.status`, when GitHub last updated
it; the Connectors board shows the last run that reached D1 and R2 and the last refusal.

### 4.6 Rotation, and what a leak could do

- **Rotate yearly, or at once on suspicion:** create the new token → `gh secret set` → the next run's `doctor` confirms it → delete the old token.
- **If it leaks,** an attacker could read or change any D1 database, write new objects into `madagascar-backups` (but not delete or overwrite a locked run), and read analytics. They could not touch Workers, DNS, other buckets' objects or anything at Supabase or GitHub.
- **Containment:**
  - revoke the token in the dashboard (one click);
  - restore any damaged D1 database with Time Travel to the minute before the misuse (7 days);
  - review `v1/` for objects the runner did not write (every legitimate object is listed in a manifest).
- **Where it lives limits exposure:** only the cf-backup repo's secrets; referenced only by `db-backup.yml` and `tick-deadman.yml`, which run only on `schedule` and `workflow_dispatch`; owner-only write access with 2FA (doc 05 §3).

## 5. Key 2 — `SUPABASE_DB_URL`

The session-pooler connection string for a **read-only** role, `backup_reader`.

**The role, as built** (cf-backup's `sql/supabase/01_backup_reader.sql`): per-schema read
grants, **not** `pg_read_all_data`.

```sql
revoke pg_read_all_data from backup_reader;
grant usage on schema public, auth, storage, cron, supabase_migrations to backup_reader;
grant select on all tables in schema public, auth, storage, cron, supabase_migrations to backup_reader;
grant select on all sequences in schema public, auth, storage, cron, supabase_migrations to backup_reader;
alter default privileges in schema public grant select on tables to backup_reader;
alter default privileges in schema public grant select on sequences to backup_reader;
alter role backup_reader bypassrls;   -- pg_dump refuses a table whose rows RLS would filter
```

Why not `pg_read_all_data`: it is a predefined role that reads every table and view, and a
per-object `REVOKE` cannot subtract from it. On this project it **could** read
`vault.decrypted_secrets` (proven on 2026-09-23: the Vault-refusal proof printed a
number), which holds the backup private keys. So it was revoked, and the reader holds
per-schema grants instead. **Never grant `pg_read_all_data` to this role**, for example
when rebuilding it in a restored project.

**What it cannot read:** the `auth` part of the grant does not take. Supabase owns the
`auth` schema and gives `postgres` no grant option on it (verified 2026-09-24), so
`auth.*` data, the sign-in accounts among it, is skipped in every run and recorded as a
warning naming `auth.users`. A few other Supabase-owned tables are skipped the same way.
The dump holds everything else.

**Setting and rotating the password:** cf-backup's owner-run
`scripts/setup/owner-secrets.mjs --only=db` generates a password in memory, sets only its
SCRAM verifier on the role, signs in with TLS verified against the pinned Supabase root CA,
proves the role is refused Vault, and stores the session-pooler URL as the GitHub secret.
By hand: Supabase → Connect → **Session pooler** URI, with the user set to
`backup_reader.<project-ref>` and its password, then `gh secret set SUPABASE_DB_URL`. GitHub
runners are IPv4-only and the direct host is IPv6-only, which is why it has to be the
pooler.

**Checked on every run by `doctor`:**

- `select 1` answers through the pooler;
- **`select … from vault.decrypted_secrets` is refused** (`42501`). If the reader can see
  Vault, the check fails and the Postgres stage does not run (factor H13).

**If it leaks:** the readable schemas are exposed (customer data), but nothing is
writable and the backup key is not reachable. Contain it with
`alter role backup_reader nologin` or a new password (`--only=db` again).

## 6. Key 3 — `GITHUB_APP_PRIVATE_KEY`

**One GitHub App**, `cf-backup-madagascar`, owned by the account.

| Setting | Value | Why |
|---|---|---|
| Repository permissions | **Actions: Read & write** (start and cancel runs, read runs, jobs, logs and artifacts) · **Variables: Read & write** (`BACKUP_AGE_RECIPIENT`) · **Secrets: Read-only** (names and dates only; the API cannot return values) · Metadata: Read-only (mandatory) | Nothing more. **No Contents, no Workflows, no Administration**: it cannot change code or workflow files, or push |
| Webhook | Off | cf-backup pulls; nothing is pushed to it |
| Where it can be installed | Only on this account | — |
| Installed on | `cf-backup`, `cf-admin-madagascar`, `cf-astro` | The last two only so the minutes meter can read their Actions usage (Actions: read). The three repositories share the account's free Actions minutes, and the meter counts the repositories listed in Settings → GitHub |

**The Worker narrows every token it mints.** GitHub's installation-token call accepts a
list of repositories and a subset of permissions:

- operations use tokens limited to `cf-backup` and the one permission they need;
- the minutes meter uses tokens limited to **Actions: read**.

Tokens are kept only in the Worker's memory, for at most 50 minutes, never in D1 or R2.

**Create it:**

1. github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Name it, give any homepage URL, **untick Webhook "Active"**, set the permissions above, choose "Only on this account", then Create. Note the **App ID**.
3. **Generate a private key**: a `.pem` file downloads.
4. **Install App** → "Only select repositories" → the three repos above.

**Store it** (from the cf-backup repo folder). GitHub issues the key in PKCS#1 form
(`BEGIN RSA PRIVATE KEY`), while Workers WebCrypto imports **PKCS#8**.
`scripts/setup/owner-secrets.mjs --only=github-key` converts the newest downloaded key and
stores it; by hand:

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in app.pem -out app.pkcs8.pem
npx wrangler secret put GITHUB_APP_PRIVATE_KEY < app.pkcs8.pem
# then delete both .pem files; a lost key is replaced by generating a new one in the App settings
```

The **App ID** is entered in the console: Settings → GitHub (`backup:config`). Until it is
set, every due slot records "not configured" instead of dispatching.

**Checked:** Readiness mints a token and lists the cf-backup repo's secret names (cached
briefly), which proves the App, its installation and the key all work; its GitHub App
permissions card reads the installation's permissions as GitHub states them
(`GET /repos/{owner}/{repo}/installation`) against what the console needs. **No expiry.**

**Rotate:** App settings → Generate a new private key → store it as above → delete the old
key in the App settings.

**If it leaks,** an attacker could start or cancel workflows and set variables in the
three repos, and read secret *names*. They could not read secret values or code, or push.
The dangerous move would be setting `BACKUP_AGE_RECIPIENT` to their own public key, so
future backups are encrypted to them. Two checks close that:

1. **Before encrypting**, every run's `doctor` confirms the recipient's fingerprint is the *active* key registered in `backup:key-registry` (read through key 1's D1 access), and refuses to run otherwise.
2. The weekly key check compares the fingerprint in the newest manifest, the GitHub variable and the Vault registry (doc 09 §4).

**Containment:** delete the key in the App settings, or suspend the installation (one click
each).

## 7. Key 4 — the Vault login, through Hyperdrive (`VAULT_DB`)

A login role, `backup_keyholder`, that can do exactly one thing: call the three
backup-key functions of doc 09 §7.

```sql
-- as built (cf-backup's sql/supabase/02 and 03): the functions live in schema backup_private,
-- which PostgREST does not expose.
grant usage on schema backup_private to backup_keyholder;
grant execute on function backup_private.backup_key_put(text, text),
                          backup_private.backup_key_get(text),
                          backup_private.backup_key_list() to backup_keyholder;
-- the password is set as a SCRAM verifier, never as plaintext in Studio
```

**As built (2026-09-24):** the login lives in a **Hyperdrive config**, `cf-backup-vault`,
and the Worker reaches Vault through its `VAULT_DB` binding with the `pg` driver.

- **The connection:** the Supavisor **transaction pooler** (port 6543, user
  `backup_keyholder.<project-ref>`), with **`sslmode verify-full`** against Supabase's
  root CA (uploaded to Cloudflare once), and query caching **off**.
- **Why Hyperdrive:** Supabase's pooler certificate chains to Supabase's own private root
  CA. A Worker's TLS verifies only against public roots and cannot be given another CA, so
  a direct connection from the Worker never completes (it showed as "Too many
  subrequests": the old driver reconnected until the per-request limit). Hyperdrive makes
  the TLS connection itself and verifies it against that CA.
- **Store and rotate it:** cf-backup's owner-run
  `scripts/setup/owner-secrets.mjs --only=vault`. It generates a password in memory, sets
  its SCRAM verifier, signs in (TLS verified), proves the role is refused
  `vault.decrypted_secrets` and can list the keys, then creates the Hyperdrive config, or
  updates it on a rotation. Then the binding is added to cf-backup's `wrangler.json`
  (`"hyperdrive": [{ "binding": "VAULT_DB", "id": "<config id>" }]`) and deployed.
- **Status (2026-09-24):** the code is deployed; the config and the binding wait for the
  owner's `--only=vault` run. Until then Keys → Rotate and Reveal and the weekly key check
  answer "VAULT_DB Hyperdrive binding not configured", and Readiness shows the Vault node
  failing with that reason.
- **The old route is retired:** until 2026-09-24 key 4 was a Worker secret,
  `SUPABASE_KEYS_URL`, read by postgres.js. Nothing reads it now; delete it
  (`npx wrangler secret delete SUPABASE_KEYS_URL --name cf-backup`).
- **Checked:** by the weekly key check (it reads each registered key from Vault), and on
  Readiness (a live Vault connection, cached five minutes; the key count is shown only with
  `keys.status`).
- **After a suspected leak, also rotate the backup key** (doc 09 §6).
- **If it leaks,** an attacker could read the backup private keys, which is exactly this
  key's job. The ciphertext they open sits at a different provider (Cloudflare R2), behind
  key 1 or the console. That separation is the point of doc 09.

## 8. Setup order, as built

| Step | Action | Status (2026-09-24) |
|---|---|---|
| 1 | Create the private repo `cf-backup` | Done |
| 2 | Key 1: create (IP filtering off), store it, set the `CLOUDFLARE_ACCOUNT_ID` variable | Done |
| 3 | Supabase: `01_backup_reader.sql`, `02_backup_keys.sql`, `03_backup_keyholder.sql` (the reader with per-schema grants, the three key functions, the key holder) | Done |
| 4 | Key 2: `owner-secrets.mjs --only=db` | Done |
| 5 | Key 3: create the App, install it, `owner-secrets.mjs --only=github-key`; enter the App ID in Settings → GitHub | Done for `cf-backup`. Installing it on `cf-admin-madagascar` and `cf-astro` (Actions: read, for the minutes meter) is pending |
| 6 | Key 4: `owner-secrets.mjs --only=vault`, then the `VAULT_DB` binding in `wrangler.json`, deployed | Pending (owner) |
| 7 | **The first backup key:** console → Keys → Rotate (needs keys 3 and 4). It stores the key in Vault, sets `BACKUP_AGE_RECIPIENT` and records the key in `backup:key-registry`. **Until it exists, no backup is dispatched** (the weekly full slot runs as a check, and the fallback schedule stands down) | Pending (after step 6) |
| 8 | Open Readiness: every failing row names its cause; Run now → Check only proves every export and restore drill before the first backup | After step 7 |

## 9. The rotation calendar

`backup:secrets-calendar` holds **dates only**, never values. The console shows each row
(Settings → Secrets calendar), and the daily check raises a reminder 30 days before an
expiry and once a year for a rotation over 12 months old; Settings → Notifications routes
it.

| Key | Where | Expires | Rotate | Reminder |
|---|---|---|---|---|
| Key 1 `CLOUDFLARE_API_TOKEN` | GitHub Actions secret | 12 months after creation | Yearly | 30 days before expiry |
| Key 2 `SUPABASE_DB_URL` | GitHub Actions secret | Never (password) | Yearly, or when anyone with access leaves | Yearly |
| Key 3 `GITHUB_APP_PRIVATE_KEY` | Worker secret | Never | Yearly, or when anyone with access leaves | Yearly |
| Key 4 `VAULT_DB` (the Vault login) | Hyperdrive config | Never (password) | Yearly (`--only=vault` again), and with every backup-key rotation after an incident | Yearly |
| The backup key itself (not an API key) | Supabase Vault | Never | Yearly (doc 09 §3) | Yearly |

A calendar row saved under key 4's former name, `SUPABASE_KEYS_URL`, is read as
`VAULT_DB`'s until the next save.
