---
title: "The master key moves into Cloudflare Secrets Store"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# The master key moves into Cloudflare Secrets Store

**Changed.** A portal's master key (the KEK that seals every stored credential) lives in its
account's Secrets Store as `<worker>_kek`, read through the `KEK_STORE` binding. `npm run deploy`
puts it there: a new portal's on its first deploy, an existing portal's only after every data key
in its database names it, then deletes the old Worker secret once the new version answers.
Releases and the fleet bind it on every update. Connector keys stay sealed in the database.
**Why.** The owner picked the hybrid (card of 2026-11-27): a Worker can only read a stored secret,
and an account holds 100 at most, so only the master key fits. A change to it now shows in the
account's audit log, and a person who may deploy Workers cannot replace it.
**Before → after.** KEK as a Worker secret → KEK in Secrets Store, with the Worker secret as the
fallback for a portal that has not moved yet. The fleet key and the client deploy key need
Account Secrets Store Edit.
**Checked.** `pnpm verify`; Secrets Store limits and API from Cloudflare's docs (one store, 100
secrets per account, read-only binding). Not checked: a live deploy against a real store, which
waits for the owner's `npm run deploy`.
