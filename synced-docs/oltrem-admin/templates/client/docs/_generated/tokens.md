---
title: "Tokens"
status: generated
source: `tokens.registry.json`
---

# Tokens

> Written by `oltrem docs` from the files named above; never edited by hand. `oltrem docs --check` in verify refuses a stale copy.

Every credential by name only (R-05); no value is written anywhere. 6 name(s), last reviewed 2026-10-21.

## `ACCESS_AUD`

| | |
|---|---|
| Status | planned |
| Provider | Cloudflare |
| Account | the client's Cloudflare Access application |
| Stored in | a Worker secret, set by npm run deploy or with wrangler secret put |
| Scopes | none: `worker` when Access stands on the Worker itself (npm run deploy sets it), or a hostname application's audience tag, an identifier stored as a secret so it is in no file |
| Used by | the IAM module, which refuses a sign-in made for another application |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | none; it changes only if the Access application is made again |
| Why it exists | The Worker must check that a sign-in came through this client's own Access application. |
| Plan | 6 |

## `BACKUP_PUBLIC_KEY`

| | |
|---|---|
| Status | planned |
| Provider | none: a key pair generated offline by the vendor |
| Account | the client's Worker holds the public half; the private half stays offline with the vendor |
| Stored in | a Worker secret, set with wrangler secret put |
| Scopes | none: a public encryption key; it can encrypt a copy and nothing else |
| Used by | the backup module, when it encrypts the nightly export |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | generate a new key pair offline, set the new public key, keep the old private key for the copies made under it |
| Why it exists | A copy in storage must be useless without the offline key. |
| Plan | 9.3 |

## `CLOUDFLARE_ACCOUNT_ID`

| | |
|---|---|
| Status | planned |
| Provider | Cloudflare |
| Account | the client's own Cloudflare account |
| Stored in | a GitHub repository secret in the client repository |
| Scopes | none: an account identifier, not a credential; stored as a secret so it never appears in a public file |
| Used by | the client repository's deploy workflow: oltrem release on main, wrangler-action on a branch; the client repository's operations menu: oltrem operate, from main |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | none; it changes only if the client moves to another account |
| Why it exists | wrangler-action must know which account the deploy token belongs to. |
| Plan | 14.1 |

## `CLOUDFLARE_API_TOKEN`

| | |
|---|---|
| Status | planned |
| Provider | Cloudflare |
| Account | the client's own Cloudflare account; one token per client, made by hand in that account's dashboard |
| Stored in | a GitHub repository secret in the client repository |
| Scopes | Account, Workers Scripts: Edit; Account, D1: Edit; Account, Workers KV Storage: Edit; Account, Workers R2 Storage: Edit; Account, Account Secrets Store: Edit; Account, Queues: Edit |
| Used by | the client repository's deploy workflow: oltrem release on main, wrangler-action on a branch; the client repository's operations menu: oltrem operate, from main |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | make a new token from the same template in the client's dashboard, replace the repository secret, delete the old token; yearly, or at once if exposed |
| Why it exists | GitHub Actions runs the gate and then the deploy, so it needs a token for that one account. A token cannot be created without a token, so this one is made by hand at setup. Phase 0 checks whether GitHub's short-lived identity (OIDC) can replace it; if so this row is retired. |
| Plan | 9.2 and 14.1 |

## `KEK`

| | |
|---|---|
| Status | planned |
| Provider | none: generated locally |
| Account | the client's Worker |
| Stored in | Secrets Store (KEK_STORE, put there by npm run deploy), else a Worker secret; a copy in oltrem-keys.txt |
| Scopes | none: a random key that wraps the provider credentials stored encrypted in the database |
| Used by | the providers core package (envelope encryption) |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | set it to <new> <old>, POST /api/providers/keys/rewrap, then <new> |
| Why it exists | Provider credentials are stored encrypted; the wrapping key stays out of the database. |
| Plan | 8.4 |

## `KIT_OPS_TOKEN`

| | |
|---|---|
| Status | planned |
| Provider | Cloudflare |
| Account | the client's own Cloudflare account; account-owned, not tied to a person |
| Stored in | a Worker secret, set with wrangler secret put |
| Scopes | Account, D1: Edit (for the database export API); Account, Account Analytics: Read (for System status's budgets: the day's use of the free plan) |
| Used by | the jobs workflow inside the client's Worker: the nightly database export; the backup module's Time Travel bookmark route; System status's measure job: the day's use of the free plan, from the GraphQL Analytics API |
| Owner | vendor |
| Created | not yet |
| Expires | never |
| Rotation | make a new token with the same two scopes (the form npm run deploy shows), set it with wrangler secret put, delete the old one; yearly |
| Why it exists | The nightly export calls the database export API, which needs an account token. It is the only token that lives inside a Worker. Widened on 2026-10-21 with Account Analytics Read for System status's budgets. The two Access groups added on 2026-10-31 for the door were taken out on 2026-11-05: the door is set once by the deploy and lets anyone ask for a code, and the portal's own list decides who gets in, so the Worker keeps nothing in step with Access. |
| Plan | 9.3 |
