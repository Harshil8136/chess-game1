---
title: "Sign-ins fixed: outside calls Cloudflare Workers refused"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# Sign-ins fixed: outside calls Cloudflare Workers refused

**Changed.** Eleven outside calls asked `fetch` to fail on a redirect with `redirect: 'error'`.
Cloudflare Workers do not support that mode: they throw a TypeError before anything is sent. So
every one of those calls failed live. They are now `redirect: 'manual'`, which hands a redirect
back as it is, and each caller's `res.ok` check refuses it, so a redirect is still never followed.
The calls: the relay's code exchange, sheet, Supabase Management API and renewals; the portal's
read of the relay's key and of a sign-in's projects; the PostHog and Google Analytics renewals;
Airtable and Supabase renewals; two customer-service calls. ESLint now refuses
`redirect: 'error'` in packages, modules and the template.
**Why.** The owner's first real "Continue with PostHog" ended with "The connection did not
finish". The relay's error log said "PostHog: the token endpoint could not be reached" three
times, the call thrown before it left. The tests' stand-in fetch accepted the mode.
**Before → after.** Every one-step sign-in (Slack, Discord, Google, Supabase, Airtable, PostHog,
Google Analytics) failed at its first outside call → it reaches the service.
**Checked.** `pnpm verify` green. The relay's tests now build each call as a real Request in the
Workers runtime, and fail on the old mode (checked by putting it back). A 307 from a token
endpoint is a failure. Phone test P1008 again. Not checked: a live sign-in, which needs the owner.
