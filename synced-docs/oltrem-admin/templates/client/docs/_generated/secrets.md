---
title: "Key recipes"
status: generated
source: `src/index.ts` and the manifests of the modules it mounts
---

# Key recipes

> Written by `oltrem docs` from the files named above; never edited by hand. `oltrem docs --check` in verify refuses a stale copy.

Every Worker secret the mounted modules need: what it is for, how to make it, test it, rotate
it and live without it. `secrets.required` in the Worker configuration lists exactly
these names, so wrangler refuses a deploy with one missing; `oltrem doctor` (CF-SEC-02)
checks the two agree. A provider's own key is not here: it is pasted on the portal, stored
sealed, and its recipe is on the provider's definition.

## `ACCESS_AUD`

| | |
|---|---|
| Needed by | `iam` |
| Purpose | Which Cloudflare Access door the portal accepts: worker, when Access stands on the Worker itself and the runtime vouches for each request, or the audience tag of a hostname's Access application. Any other sign-in is refused. |
| Create | npm run deploy sets it to worker and puts Access on this Worker by itself. For a hostname's Access application instead: Zero Trust, Access, Applications, open it, copy its Application Audience (AUD) Tag, run npx wrangler secret put ACCESS_AUD and paste it. |
| Create at | https://one.dash.cloudflare.com/ |
| Scopes | none: the kit makes it |
| Test | Open the portal at its address and sign in at the door: the page loads. A token made for another application is refused with KIT-E-0401, "the token is for another application". |
| Rotate | Nothing to rotate on a schedule: it changes only when the Access application is made again. Then copy the new tag and set it the same way. |
| Without it | Every request past the door is refused with KIT-E-0401, since no token names an empty audience; wrangler also refuses a deploy while it is missing from the required secrets. |

## `BACKUP_PUBLIC_KEY`

| | |
|---|---|
| Needed by | `backup` |
| Purpose | The age public key every backup copy is encrypted to. Only its private half, kept offline by the vendor, opens a copy, so a copy in the bucket is useless to anyone else. |
| Create | On your own computer, with the free age tool: age-keygen -o oltrem-backup-key.txt. Keep that file offline, in the vendor's password manager and one more safe place: without it no copy can ever be opened. The command prints the public key, a line starting age1. Run npx wrangler secret put BACKUP_PUBLIC_KEY and paste that line. |
| Scopes | none: the kit makes it |
| Test | Make a backup by hand, download the copy with npx wrangler r2 object get <bucket>/<key> --remote --file copy.sql.age, then run age -d -i oltrem-backup-key.txt copy.sql.age: the SQL comes out. The monthly restore drill does the same. |
| Rotate | Make a new pair the same way and set the new public key. Keep every old private key for as long as copies made under it are kept. Rotate when the private key may have been seen. |
| Without it | No copy is made, since an unencrypted copy is never written: each run is recorded as failed with KIT-E-1601, or KIT-E-1307 when the key is not an age1 public key. |

## `KEK`

| | |
|---|---|
| Needed by | `providers` |
| Purpose | Wraps the data key that seals every provider credential stored in the database, so the database alone never reveals a key. |
| Create | On a computer with Node, make a key: node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))". Keep it in the vendor's password manager, since a rotation needs it again and Cloudflare never shows a secret back. npm run deploy makes it and puts it in the account's Secrets Store as <worker>_kek, bound as KEK_STORE (2026-11-27); by hand, npx wrangler secret put KEK still works. |
| Scopes | none: the kit makes it |
| Test | Paste a provider's key on the portal: it is stored. KIT-E-1301 means the secret is not set; KIT-E-1302 that it is not one or two keys of 32 bytes. |
| Rotate | Make a new key as above and keep it; set KEK (the stored secret <worker>_kek in Secrets Store, or the Worker secret) to the new key, a space and the old one; call POST /api/providers/keys/rewrap; then set KEK to the new key alone. Do it on the vendor's schedule, and at once when someone who held the key leaves or it may have been seen. |
| Without it | No provider credential can be stored or opened (KIT-E-1301), so no email is sent and Status shows the messages waiting for a retry. If the key is lost, set a new one and paste each provider's key again. |

## `KIT_OPS_TOKEN`

| | |
|---|---|
| Needed by | `backup`, `health` |
| Purpose | Lets the nightly backup ask Cloudflare to export the client's database and the backup page read its Time Travel bookmark, and lets Status read the day's use of the free plan and R2's storage and operations this month (shown on Files, Storage too). It is the only Cloudflare token inside the Worker; the door (Cloudflare Access) needs none, as the deploy sets it once with Cloudflare's own sign-in. |
| Create | In the client's Cloudflare dashboard, Manage account, Account API tokens, Create Token: two permissions, Account, D1, Edit; Account, Account Analytics, Read; on this account only, expiring no sooner than a year. It belongs to the account, not to a person. Then in Workers and Pages open the portal's Worker, Settings, Variables and Secrets, and set KIT_OPS_TOKEN to it as a secret, or run npx wrangler secret put KIT_OPS_TOKEN and paste it. When it is missing or refused, Status shows these steps with the form already filled in. |
| Scopes | Account, D1: Edit; Account, Account Analytics: Read |
| Test | Make a backup by hand on the backup page: its row ends ok within a few minutes. Within fifteen minutes Status shows the day's use of every budget. KIT-E-1602 with 401 or 403 means the token lacks D1 Edit on this account; a budget not measured with HTTP 401 or 403 means it lacks Account Analytics Read. |
| Rotate | Make a new token with the same two permissions, set it as KIT_OPS_TOKEN in the Worker's Variables and Secrets (or with npx wrangler secret put KIT_OPS_TOKEN), make a backup by hand and see the budgets measured again, then delete the old token. Yearly, and at once when someone who saw it leaves. |
| Without it | No copy is made: each run is recorded as failed with KIT-E-1601 and Status shows the backup check failing; Time Travel still covers the last 7 days. Status measures the database's size only, and warns that the day's use is not measured. |
