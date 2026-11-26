---
title: "@oltrem/relay: Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/relay/src; split from packages/relay/README.md]
---

# @oltrem/relay: Tests

> Part of [the @oltrem/relay README](../README.md).

## Tests

Inside the Workers runtime, with the token endpoints as a fetch the test answers: the
seven entries and their scopes; the portals it reads and the states it accepts; a known portal sent to
Slack with its scope and to Google with a PKCE challenge; an unknown portal refused without a
redirect, at the start and the return; Slack's code exchanged with the app's secret and only the
channel's address sealed back with the relay's key, the access token dropped; Discord's webhook
the same way; Google's sheet made by the relay with the token, only its address sealed back, the
verifier the one whose challenge went out at the start, and no sheet without the portal's own link
sealed to this relay, for another portal's address, a formula with more than the link, or when
Google refuses, answers elsewhere or cannot be reached;
refused, expired (also a state dated too far ahead), not set up (no app secrets, or no seal key)
and failed trips (a refusal, an unreachable token endpoint) said so; only GET; the public seal key
at `/key`; a refusal page that names no setting; a field kept only when the entry names it and it
starts as it must. Supabase: no scope sent and a PKCE challenge, the code exchanged with HTTP
Basic and no secret in the form; the only project's address, name and secret key read once, the
token never sent on; several projects answered as a list with no key read; a sealed project read
only when it is the account's; a project without a secret key answered with its address and name;
no project, or a refusal, failed; the Management API's tokens sent back with the key, and a
renewal through `/renew/supabase` answered with new ones, a refused refresh token as 400. Airtable: its read-only scopes and a PKCE challenge, a state in
Airtable's own rules; the code exchanged with the id alone, no secret and no Basic header, with
the verifier whose challenge went out; the tokens, their lifetime and the id sealed back, nothing
else; not set up without its id; an answer without a refresh token failed. A service it does not
know: back to a listed portal as not set up. PostHog: the client document at `/client/posthog`
with its id, one way back, no secret, a name without PostHog's own and the scopes, kept an hour,
none for a service with an app; the sign-in page given that id and a PKCE challenge; the code
exchanged with the id alone and the verifier; the tokens, the projects allowed and the id sealed
back. Google Analytics: the Google app, offline access and consent; the tokens sealed back; a
renewal Google answers without a refresh token hands back the one given, and a plain 404 without a state, for an unlisted
portal or on the way back.

The deploy script (`scripts/relay-deploy.test.mjs`, on Node): the required secrets read from
`wrangler.jsonc`; a Worker not deployed yet read as having none, any other failure of wrangler's
list reported as it came; the portals asked until named, a service skippable, a secret typed unseen.
