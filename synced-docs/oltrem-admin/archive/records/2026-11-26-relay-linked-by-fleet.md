---
title: "The sign-in service linked to every portal by the fleet"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# The sign-in service linked to every portal by the fleet

**Changed.** Each fleet run looks for the sign-in service (the Worker `oltrem-relay` on
workers.dev) in the accounts its key reaches. Each portal with its own address and an empty
"Sign-in service" setting gets the relay's address, saved with its history as `oltrem fleet`, and
its cached settings are cleared so it shows within a minute. A value someone set is never
replaced. The relay's `RELAY_PORTALS` is kept to every portal's address, rewritten only when that
list changes (`relay_mark` in each portal's `oltrem_meta`).
**Why.** The owner, 26 November: "cant we do it automatic", since a non-technical Owner would
never paste a relay address into Settings. The relay was deployed into the Vendor's account the
same day.
**Before → after.** The Vendor pasted the relay's address into each portal's Settings and added
each portal's address to the relay by hand → nobody types either; "Continue with PostHog" appears
on every portal after its next fleet run.
**Checked.** `pnpm verify` green; the fleet tests run the setting's SQL on the real settings
migration (node:sqlite) and cover a second run writing nothing, a new portal, no relay, a relay
in two accounts, and a check run. The relay's workers.dev answers were read live through the API.
Phone test P1008. Not checked: the first live fleet run, which follows this push.
