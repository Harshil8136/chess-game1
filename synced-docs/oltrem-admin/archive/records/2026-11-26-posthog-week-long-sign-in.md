---
title: "Continue with PostHog fixed again: its 7-day sign-in accepted, failures in the audit log"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# Continue with PostHog fixed again: its 7-day sign-in accepted, failures in the audit log

**Changed.** The portal refused any analytics sign-in that said it lasts more than a day. PostHog
gives an app that signs in with a client document, like ours, an access token of 7 days
(`_get_token_expires_in` in its OAuth views), so every PostHog sign-in was refused right after
PostHog and the relay had both succeeded. A longer lifetime is now kept as a day and renewed then,
as the renewal already did. Every trip that brings nothing back now writes
`connect.oneclick-finish` to the audit log as `failed` (or `refused` for a cancel) with the step that
stopped it, and logs it; before, the request's own row said "ok".
**Why.** The owner's third try (20:07 UTC) failed with no error anywhere. The relay's request counts
showed the code exchanged at PostHog with no error logged, so the refusal was the portal's; the
portal keeps one log in ten, and its audit rows read "ok". PostHog's source named the 7 days.
**Before → after.** Every PostHog sign-in refused silently → taken. A failed sign-in "ok" in the
audit log → "failed" with its step, such as "PostHog sent back an unusable client".
**Checked.** `pnpm verify` green; a 7-day PostHog sign-in and the audit row of a failure tested.
Phone test P1010. Not checked: a live sign-in, which needs the owner.
