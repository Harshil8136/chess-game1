---
title: "cf-backup — 12 API keys and secrets: the complete list, and exactly how to set each"
status: draft
audience: [owner, operator, ai, technical]
owner: harshil
related_docs: [README.md, 01-architecture.md, 03-backup-pipeline.md, 05-security-and-compliance.md, 09-key-management.md, 13-access-control.md]
tags: [program, cf-backup, secrets, api-keys, setup, runbook]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan: nothing in it is built yet. It names files, scripts and settings that do not exist yet. -->

# 12 — API keys and secrets

> **TL;DR (owner requirement, 2026-09-22: "as few keys as possible, none in cf-admin").**
> The whole backup system runs on **four secrets from three providers**, and **cf-admin
> gets none**:
>
> | # | Secret | Provider | Lives in | Used for |
> |---|---|---|---|---|
> | 1 | `CLOUDFLARE_API_TOKEN` | Cloudflare | GitHub, cf-backup repo | Everything the backup run does at Cloudflare: D1 exports and the monthly drill, uploads to R2 (the S3 keys are *derived* from this token), the usage snapshot |
> | 2 | `SUPABASE_DB_URL` | Supabase | GitHub, cf-backup repo | `supabase db dump`, as a read-only role |
> | 3 | `GITHUB_APP_PRIVATE_KEY` | GitHub | cf-backup Worker | Everything cf-backup does at GitHub: start, cancel, enable/disable runs; read runs, steps and logs; set the public-key variable; list secret *names* for the readiness panel; count Actions minutes |
> | 4 | `SUPABASE_KEYS_URL` | Supabase | cf-backup Worker | The backup-key screens only: rotate, reveal, weekly key check. It can call three functions and nothing else |
>
> Everything else is a public value (a variable) or a binding (no key at all).
> cf-admin gains **one service binding and zero secrets**.

## 1. Why four, and not fewer or more

**One per provider, per place it is needed.** GitHub needs to reach Cloudflare and
Supabase (it does the dumping). The cf-backup Worker needs to reach GitHub and the Vault
(it does the managing). Cloudflare resources the Worker uses (R2, D1, the email queue)
come through **bindings**, which are not keys.

**Why Supabase has two.** The Supabase credential GitHub holds must **never** be able to
read the backup key. If it could, anyone who could read a GitHub secret could decrypt
every backup, and public-key encryption would protect nothing. So the dump reader (in
GitHub) and the key holder (in the Worker) are deliberately different roles. Key 4 is
optional: without it, key rotation, reveal and the weekly check are done by hand in the
Supabase SQL editor (§7.1), and the system runs on **three** keys.

**What was merged away** compared with the 2026-09-21/22 drafts:

| Removed | Where its job went |
|---|---|
| `CLOUDFLARE_DRILL_TOKEN` (D1 Edit, monthly drill) | Key 1 |
| `R2_BACKUP_WRITER_KEY_ID` / `_SECRET` (R2 S3 keys) | **Derived from key 1** at run time: the S3 access key ID is the token's ID and the secret is the SHA-256 of the token value (*confirmed*, R2 API tokens docs) |
| `CF_USAGE_TOKEN` (Worker, analytics) | The runner takes the account snapshot with key 1, every day. For live D1 figures, the Worker reads cf-admin's existing hourly usage reading from D1 (`cron-control`, read-only) |
| `GITHUB_METER_APP_PRIVATE_KEY` (a second App) | Key 3: one App. Each token the Worker mints is narrowed to the repos and permissions of that call (§6) |
| `BACKUP_PASSPHRASE` (symmetric) | Public-key encryption; the public key is not a secret |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` and share-link keys | Not needed: the storage move is parked |

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
| Anywhere at rest, outside Supabase Vault | Never a backup private key. The two recovery kits live in the Owner's and the Vendor's own password managers (doc 09) |
| Chat, email, tickets, docs, shell history | Never a key value. Paste secrets only into the prompts of `gh secret set` / `wrangler secret put` |

## 3. Settings that are not keys

| Name | Kind | Where | Value | Set by |
|---|---|---|---|---|
| `CLOUDFLARE_ACCOUNT_ID` | GitHub **variable** | cf-backup repo | The account's id (an identifier, not a secret) | Owner, once |
| `BACKUP_AGE_RECIPIENT` | GitHub **variable** | cf-backup repo | The active backup **public** key | cf-backup, on every rotation (doc 09 §3) |
| `GITHUB_APP_ID` | Worker `[vars]` | cf-backup `wrangler.toml` | The App's number | Owner, once |
| Sentry DSN (optional) | Worker `[vars]` | cf-backup `wrangler.toml` | A public identifier | Owner, once |
| Everything operational: thresholds, cooldowns, alert recipients, refresh intervals | D1 row `backup:config` | Edited in the console ([13](13-access-control.md) §7) | — | Holders of `config.edit` |

## 4. Key 1 — `CLOUDFLARE_API_TOKEN`

### 4.1 Exactly what it may do

| Scope | Permission | Why |
|---|---|---|
| Account | **D1 → Edit** | Export the three databases, the query-based `chatbot-kb` export, create and delete the monthly drill database |
| Account | **Account Analytics → Read** | The account usage snapshot (doc 11 §5.4) |
| Bucket `madagascar-backups` only | **Workers R2 Storage Bucket Item Write, and (as built, Ruling 18) Item Read** | Upload run folders and live heartbeats (Write); `doctor`'s bucket `HEAD` and the previous-manifest `GET`s the size-anomaly and drill-speed verdicts need (Read). Bucket-scoped item permissions work only through the S3 API (*confirmed*), which is what the runner uses |
| Account (*only if needed*) | Workers R2 Storage → Read | Only if the per-bucket usage figure for the *other* buckets needs it (to verify in P0). Read-only |

Nothing else: no Workers scripts, no DNS, no Access, no other buckets' objects.

### 4.2 What kind of token

An **account API token** (Manage Account → Account API Tokens). It belongs to the account,
not to a person, so it keeps working if someone leaves. New account tokens carry a `cfat_`
prefix that secret scanners recognise (*confirmed*, account API tokens docs). Creating one
needs the Super Administrator role. Whether D1, R2 and Analytics all accept account tokens
is **to verify** against Cloudflare's compatibility matrix in P0. If one does not, use a
user token with the same permissions.

**Expiry: 12 months.** Every run's `doctor` reads the expiry from the token-verify
endpoint. The console shows the days left and alerts at 30.

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

### 4.5 How the run uses it, including the derived R2 keys

```bash
# In db-backup.yml, once, in the plan step.
# The verify path is /accounts/<id>/tokens/verify for an account token,
# or /user/tokens/verify for a user token.
TOKEN_ID=$(curl -fsS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/tokens/verify" | jq -r .result.id)
R2_SECRET=$(printf %s "$CLOUDFLARE_API_TOKEN" | sha256sum | cut -d' ' -f1)
echo "::add-mask::$R2_SECRET"
# S3 client settings: key id = $TOKEN_ID, secret = $R2_SECRET,
# endpoint https://<ACCOUNT_ID>.r2.cloudflarestorage.com, region auto
```

**Checked on every run by `doctor`**: the token is active and not near expiry; a D1
`select 1` answers; an R2 `HEAD` on the bucket answers. The readiness panel shows the
secret's name, when it was last updated (from GitHub) and its expiry.

### 4.6 Rotation, and what a leak could do

- **Rotate yearly, or at once on suspicion:** create the new token → `gh secret set` → the next run's `doctor` confirms it → delete the old token.
- **If it leaks,** an attacker could read or change any D1 database, write new objects into `madagascar-backups` (but not delete or overwrite a locked run), and read analytics. They could not touch Workers, DNS, other buckets' objects or anything at Supabase or GitHub.
- **Containment:**
  - revoke the token in the dashboard (one click);
  - restore any damaged D1 database with Time Travel to the minute before the misuse (7 days);
  - review `v1/` for objects the runner did not write (every legitimate object is listed in a manifest).
- **Where it lives limits exposure:** only the cf-backup repo's secrets; referenced only by `db-backup.yml`, which runs only on `schedule` and `workflow_dispatch`; owner-only write access with 2FA (doc 05 §3).

## 5. Key 2 — `SUPABASE_DB_URL`

The session-pooler connection string for a **read-only** role, `backup_reader`.

**Create the role** (Supabase → SQL editor; the password is generated, 32+ random characters):

```sql
create role backup_reader with login password '<generated>';
grant pg_read_all_data to backup_reader;          -- spike S-3: confirm it reaches auth and cron
```

It must **never** be able to read backup keys (§1). Two facts decide how that is ensured:

- The three key functions revoke `EXECUTE` from `PUBLIC` (doc 09 §7), so the reader cannot call them.
- **A per-object `REVOKE` does not subtract from `pg_read_all_data`.** It is a predefined role that reads every table and view. So "revoke Vault from the reader" is not a control. The control is a **proof**: as `backup_reader`, `select count(*) from vault.decrypted_secrets` must be refused. If it succeeds, drop `pg_read_all_data` and grant `usage` + `select` only on the schemas the dump needs (`public`, `auth`, `storage`, `cron`, `supabase_migrations`).

**The URL:** Supabase → Connect → **Session pooler** URI, with the user set to
`backup_reader.<project-ref>` and its password. GitHub runners are IPv4-only and the
direct host is IPv6-only, which is why it has to be the pooler.

```bash
gh secret set SUPABASE_DB_URL --repo mascotasmadagascar-cmd/cf-backup
```

**Checked on every run by `doctor`:**

- `select 1` answers through the pooler;
- **`select … from vault.decrypted_secrets` is refused.** If the reader can see Vault, the run **fails** before any dump, with the instruction to switch from `pg_read_all_data` to per-schema grants. `pg_read_all_data` reads every schema, so this is not paranoia (factor H13).

**Rotate:** `alter role backup_reader password '<new>'`, then update the secret. **If it
leaks:** the whole database is readable (customer data), but nothing is writable and the
backup key is not reachable. Contain it with `alter role backup_reader nologin` or a new
password.

## 6. Key 3 — `GITHUB_APP_PRIVATE_KEY`

**One GitHub App**, `cf-backup-madagascar`, owned by the account.

| Setting | Value | Why |
|---|---|---|
| Repository permissions | **Actions: Read & write** (start, cancel, enable/disable, read runs, jobs and logs) · **Variables: Read & write** (`BACKUP_AGE_RECIPIENT`) · **Secrets: Read-only** (names and dates only; the API cannot return values) · Metadata: Read-only (mandatory) | Nothing more. **No Contents, no Workflows, no Administration**: it cannot change code or workflow files, or push |
| Webhook | Off | cf-backup pulls; nothing is pushed to it |
| Where it can be installed | Only on this account | — |
| Installed on | `cf-backup`, `cf-admin-madagascar`, `cf-astro` | The last two only so the minutes meter can read their Actions usage |

**The Worker narrows every token it mints.** GitHub's installation-token call accepts a
list of repositories and a subset of permissions:

- operations use tokens limited to `cf-backup` and the one permission they need;
- the minutes meter uses tokens limited to **Actions: read**.

Tokens live one hour and exist only in memory, never in D1 or R2.

**Create it:**

1. github.com → Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Name it, give any homepage URL, **untick Webhook "Active"**, set the permissions above, choose "Only on this account", then Create. Note the **App ID**.
3. **Generate a private key**: a `.pem` file downloads.
4. **Install App** → "Only select repositories" → the three repos above.

**Store it** (from the cf-backup repo folder). GitHub issues the key in PKCS#1 form
(`BEGIN RSA PRIVATE KEY`), while Workers WebCrypto imports **PKCS#8**, so convert it once:

```bash
openssl pkcs8 -topk8 -inform PEM -outform PEM -nocrypt -in app.pem -out app.pkcs8.pem
npx wrangler secret put GITHUB_APP_PRIVATE_KEY < app.pkcs8.pem
# then delete both .pem files; a lost key is replaced by generating a new one in the App settings
```

`GITHUB_APP_ID` goes into cf-backup's `wrangler.toml` `[vars]`.

**Checked:** the readiness panel mints a token and lists the cf-backup repo's secret names
on every console load (cached briefly), which proves the App, its installation and the key
all work. **No expiry.**

**Rotate:** App settings → Generate a new private key → `wrangler secret put` → delete the
old key in the App settings.

**If it leaks,** an attacker could start, cancel or disable workflows and set variables in
the three repos, and read secret *names*. They could not read secret values or code, or
push. The dangerous move would be setting `BACKUP_AGE_RECIPIENT` to their own public key,
so future backups are encrypted to them. Two checks close that:

1. **Before encrypting**, every run's `doctor` confirms the recipient's fingerprint is the *active* key registered in `backup:key-registry` (read through key 1's D1 access), and refuses to run otherwise.
2. The weekly key check compares the fingerprint in every manifest with the Vault registry (doc 09 §4).

**Containment:** delete the key in the App settings, or suspend the installation (one click
each).

## 7. Key 4 — `SUPABASE_KEYS_URL`

A connection string for a role, `backup_keyholder`, that can do exactly one thing: call
the three backup-key functions of doc 09 §7.

```sql
-- as built (full build, 2026-09-23): the functions live in schema backup_private,
-- which PostgREST does not expose; see cf-backup's sql/supabase/02 and 03.
grant usage on schema backup_private to backup_keyholder;
grant execute on function backup_private.backup_key_put(text, text),
                          backup_private.backup_key_get(text),
                          backup_private.backup_key_list() to backup_keyholder;
-- the password is set with psql's \password or a SCRAM verifier, never plaintext in Studio
```

- **Store it:** `npx wrangler secret put SUPABASE_KEYS_URL` in the cf-backup repo folder (the **transaction-pooler** URL, port 6543, user `backup_keyholder.<project-ref>`, ending `?sslmode=require`; TLS is required and a URL that disables it is refused).
- **As built (OD-24):** reached with the `postgres` driver (postgres.js, pinned exact `3.4.9`) — **the only new dependency this build adds**, over the Supavisor **transaction pooler** (port 6543, not the session pooler keys 2 and this connection type both otherwise use), with `prepare: false` (the transaction pooler does not support prepared statements). Alternatively a Hyperdrive binding, which would keep the credential in Hyperdrive's configuration instead of a Worker secret (Free-plan availability to verify), was not taken.
- **Checked:** by the weekly key check, and on the readiness panel.
- **Rotate:** `alter role backup_keyholder password '<new>'`, then `wrangler secret put`. After a suspected leak, **also rotate the backup key** (doc 09 §6).
- **If it leaks,** an attacker could read the backup private keys, which is exactly this key's job. The ciphertext they open sits at a different provider (Cloudflare R2), behind key 1 or the console. That separation is the point of doc 09.

### 7.1 Running on three keys instead

Leave key 4 out, and do key work by hand. The Owner or Vendor runs the planned
`scripts/backup-key-*` commands on their own machine, with the key-holder URL supplied at
run time and never stored. Everything else is unchanged. What is lost: one-click rotation
and reveal in the console, and the **automatic** weekly key check, which becomes a monthly
manual one. **Default: keep key 4**, since that check is what catches a wrong recipient
within a week.

## 8. Setup order (Phase 0 and 1)

| Step | Action | When |
|---|---|---|
| 1 | Create the private repo `cf-backup` | P0 |
| 2 | Key 1: create, `gh secret set`, set the `CLOUDFLARE_ACCOUNT_ID` variable | P0 |
| 3 | Key 2: create `backup_reader`, run the revokes, `gh secret set` | P0 |
| 4 | Supabase migration: the three key functions and `backup_keyholder` (doc 09 §7) | P0 |
| 5 | **First backup key** (load-bearing, as built): `scripts/backup-key-init` on the Owner's machine, with the key-holder URL supplied at run time; it sets `BACKUP_AGE_RECIPIENT` via `gh`. **Every run's `doctor` fails until `backup:key-registry` holds an active key matching this recipient — the key must exist before the very first dispatch**, not merely before the console | P0 |
| 6 | Key 3: create the App, install it, convert and `wrangler secret put` the key; set `GITHUB_APP_ID` | P1a (the Worker exists) |
| 7 | Key 4: `wrangler secret put SUPABASE_KEYS_URL` | P2e (the key screens) |
| 8 | Open the console: every readiness row green | P2 |

## 9. The rotation calendar

`backup:secrets-calendar` holds **dates only**, never values. The console shows each row,
and cf-backup emails 30 days ahead.

| Secret | Expires | Rotate | Reminder |
|---|---|---|---|
| Key 1 `CLOUDFLARE_API_TOKEN` | 12 months after creation | Yearly | 30 days before expiry |
| Key 2 `SUPABASE_DB_URL` | Never (password) | Yearly, or when anyone with access leaves | Yearly |
| Key 3 `GITHUB_APP_PRIVATE_KEY` | Never | Yearly, or when anyone with access leaves | Yearly |
| Key 4 `SUPABASE_KEYS_URL` | Never (password) | Yearly, and with every backup-key rotation after an incident | Yearly |
| The backup key itself (not an API key) | Never | Yearly (doc 09 §3) | Yearly |
