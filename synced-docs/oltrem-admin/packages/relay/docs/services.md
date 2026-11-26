---
title: "@oltrem/relay: The services; Its secrets; The seal key; Setting it up (once, by the Vendor)"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/relay/src; split from packages/relay/README.md]
---

# @oltrem/relay: The services; Its secrets; The seal key; Setting it up (once, by the Vendor)

> Part of [the @oltrem/relay README](../README.md).

## The services

Each is one entry in `src/providers.ts`, data rather than code: the sign-in page and the token
endpoint, the smallest scopes, the names of the two secrets (one for an app without a secret),
PKCE where the service has it, what must be true of the answer and the fields that go back, each
with the start it must have.

| Service | Scope | What goes back to the portal |
|---|---|---|
| Slack | `incoming-webhook` | the webhook address of the channel the person picked, its name, the workspace's name (Slack's access token is dropped) |
| Discord | `webhook.incoming` | the webhook address of the channel the person picked (no bot joins the server; the webhook's own name is not the channel's, so it is not sent) |
| Google | `https://www.googleapis.com/auth/drive.file`, online access, PKCE | only the new sheet's address: the relay creates the Google Sheet itself, with the access token used once and never sent on; no refresh token is asked for |
| Supabase | none sent (the OAuth app is registered with Projects read and Secrets read), PKCE, the app's id and secret as HTTP Basic | the picked project's address, name and secret key (`sb_secret_…`), read by the relay with the Management API token; beside them that token (an hour), its refresh token and how many seconds it lasts, so the portal can read the project's logs, requests, advisors, backups and functions. With several projects and none picked, the list of projects (ref and name) instead, and no token |
| Airtable | `data.records:read schema.bases:read`, PKCE, the integration's id alone (it has no secret) | the access token (an hour), the refresh token (60 days, replaced on each use), how many seconds the access token lasts, and the integration's public id: Airtable has no lasting key an app can make, so the portal keeps these and renews them itself (the data part's README, "Sign in with Airtable"). The one service whose refresh token goes back |

| PostHog | `project:read query:read`, PKCE, no app registered: the client id is the relay's own document at `https://<relay>/client/posthog` (below) | the access token (an hour), the refresh token, how many seconds the access token lasts, the projects the person allowed (`scoped_teams`, as `12345,678`) and the client id: the portal finds the project's name and region with the token and renews the tokens itself (website analytics) |
| Google Analytics | `https://www.googleapis.com/auth/analytics.readonly`, offline access, consent asked each time, PKCE, the Google app above (no new secret) | the access token (an hour), the refresh token and how many seconds the access token lasts; the portal lists the person's properties with the token and renews it through `/renew/google-analytics`, since only the relay holds the app's secret |

A new service is one more entry with its two secrets (and their rows in `tokens.registry.json`), or
none for a service that reads a client document.

**No app to register (PostHog).** An entry with `cimd` signs in with a Client ID Metadata
Document (the IETF draft PostHog follows): the client id is the address `https://<relay>/client/<id>`,
and the relay answers that address with the document the service reads at sign-in: the id
itself, the name "Oltrem" (PostHog refuses a name with its own in it), the one way back
`https://<relay>/back/<id>`, no secret (`token_endpoint_auth_method: none`) and the scopes under
`com.posthog`, kept an hour. PKCE is a must, its verifier made from the seal key as for Airtable.
Nothing is set up at PostHog for it.

**Renewals (Supabase, Google Analytics).** Supabase's access token lasts an hour and its refresh token needs the
app's secret, which only the relay holds. An entry marked `relayRenews` answers
`POST /renew/<id>` with a form `refresh_token`: the relay exchanges it at the service's token
endpoint with the app's id and secret as HTTP Basic and answers `{token, refresh, expires}` in
plain JSON, keeping nothing. The refresh token is itself the credential, so nothing else is
asked. A refusal by the service (400 or 401) is `400 {error: 'refused'}`, which the portal reads
as the sign-in having ended; no app secrets set is 503; anything else 502. Another service, or a
GET, is refused. Google keeps its refresh token on a renewal and answers without one; for an
entry marked `keepsRefresh` the relay hands the one it was given back, while for Supabase, which
spends the old one, an answer without one is a failure. Who calls is not checked: a refresh token
issued to the Vendor's app renews here for anyone holding it. The portals keep theirs sealed under
their own key, so a copy of a portal's database or backup holds none in the clear; a signature
from each portal on its renewals would close the rest, and needs a key per portal (not here yet,
the security review of 2026-11-26).

**The sheet.** For Google the portal puts the spreadsheet link's address and the sheet's title in
the state, sealed to the relay's own key (they open the portal's list to whoever reads them, and
the state passes through addresses others can see). After the code exchange the relay opens them,
writes only an address of that portal's own spreadsheet links (`<portal>/hooks/connect/sheet/<32
letters>.csv`) into `=IMPORTDATA("…")` in the new sheet's first cell, and seals back only the
sheet's `https://docs.google.com/` address. A state without that sealed address is refused before
anyone signs in. The owner's pick of 2026-11-22: a Google token never reaches a portal, so no
portal can reach the files the Vendor's one Google app made for that person from another portal.

**A public client (Airtable).** An entry without a `clientSecret` is an app registered without
one. Its code is exchanged with the id in the form and the PKCE verifier, no secret and no HTTP
Basic header (Airtable refuses one it never issued), and the verifier is made from the relay's own
seal key instead of the app's secret, so it is still the same at the start and the return and
kept nowhere.

**The Supabase project.** The relay always lists the account's projects (`GET /v1/projects`). A
project the portal sealed to the relay in the state (`{project}`) is read only when it is one of
them; with none sealed, the account's only project is read, and with several the list goes back
so the portal can ask which, then start again with that one. The project's secret key comes from
`GET /v1/projects/<ref>/api-keys?reveal=true`, the first of type `secret`; a project without one
sends back its address and name alone, so the portal asks for the key. Three calls in all.

## Its secrets

Eleven Worker secrets, by name only (their rows are in the token registry). `wrangler.jsonc` marks
them required, so a deploy is refused until all eleven are set.

| Secret | Holds |
|---|---|
| `RELAY_PORTALS` | the portal addresses it may send a person back to, separated by spaces or commas, as `portal.example.com https://other.example.com` |
| `RELAY_SEAL_KEY` | the relay's own key pair, made by `scripts/seal-key.mjs`; every answer is sealed with it |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET` | the Slack app's |
| `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` | the Discord application's |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | the Google OAuth client's |
| `SUPABASE_CLIENT_ID`, `SUPABASE_CLIENT_SECRET` | the Supabase OAuth app's |
| `AIRTABLE_CLIENT_ID` | the Airtable integration's id, which is public: it has no secret, and the relay hands it to the portal with the tokens |

A service whose secrets are empty, or a relay without its seal key, answers "not set up" to
the portal, which then offers the other way on the card. So does a service this relay does not
know yet (a portal on a newer kit than the relay), when the state reads and the portal is listed;
otherwise it answers "No such service." and sends nobody anywhere.

## The seal key

The relay seals every answer with its own key, and answers the key's public half at
`https://<relay>/key`. The portal reads it there (over https, from the address the Vendor set) each
time an answer comes back, and opens only what that key sealed. A trip's state travels in addresses
that the service, the browser's history and any proxy can see; without the relay's key, someone who
read it could seal an answer of their own and have the portal make an alert to their channel. The
first deploy makes the key itself (below); to replace it later, straight into the secret, so it
never shows on the screen:

```sh
node packages/relay/scripts/seal-key.mjs | pnpm --filter @oltrem/relay exec wrangler secret put RELAY_SEAL_KEY
```

Running it again replaces the key at once; a trip on its way at that moment comes back as failed,
and the person presses again.

## Setting it up (once, by the Vendor)

`<relay>` below is the relay's address once deployed, as `oltrem-relay.<your subdomain>.workers.dev`.

1. **Deploy it** to the Vendor's Cloudflare account: `pnpm --filter @oltrem/relay run deploy`
   (`scripts/deploy.mjs`). wrangler refuses `secret put` before the Worker exists, so the first
   deploy asks in the terminal for every secret not set yet: the portals' addresses, then each
   app's client ID and secret (a secret typed unseen; Enter skips a service not set up yet, kept
   blank so it answers "not set up"). It makes the seal key itself, hands them all to wrangler in a
   file deleted straight after, and deploys. Later deploys ask only for a secret added since; a
   skipped service is set any time with `pnpm --filter @oltrem/relay exec wrangler secret put
   <NAME>` (or in the dashboard, under the Worker's Settings, Variables and Secrets).
2. **Slack.** At api.slack.com/apps press Create New App, From scratch, name it and pick any
   workspace of yours. Under OAuth & Permissions add the redirect URL `https://<relay>/back/slack`
   and the bot scope `incoming-webhook`. Under Manage Distribution, activate public distribution
   (no App Directory listing is needed). Copy the Client ID and Client Secret from Basic
   Information.
3. **Discord.** At discord.com/developers/applications press New Application. Under OAuth2 add the
   redirect `https://<relay>/back/discord` and copy the Client ID and Client Secret.
4. **Google.** In console.cloud.google.com make a project and enable the Google Sheets API. Under
   Google Auth Platform: Branding (the app's name and a support address), Audience External and
   Publish app, Data access with the `.../auth/drive.file` scope (Google's non-sensitive level, so
   no verification), then Clients, Create client, Web application, with the authorized redirect URI
   `https://<relay>/back/google`. Copy its Client ID and secret. For Sign in with Google Analytics,
   in the same project enable the Google Analytics Data API and the Google Analytics Admin API, add
   the scope `.../auth/analytics.readonly` under Data access (Google lists it as sensitive: until
   the app is verified, people see "Google hasn't verified this app" and press Advanced, then
   Continue), and add the second redirect URI `https://<relay>/back/google-analytics` to the same
   client.
5. **Supabase.** In supabase.com/dashboard open your organization's settings, OAuth Apps, Add
   application. Give it a name and the redirect URL `https://<relay>/back/supabase`, and under
   permissions set Projects to Read and Secrets to Read, and, for the project's other sections in
   the data part, Database, Edge Functions, Analytics, Auth and Organizations to Read where Supabase lists them (Organizations gives the Usage tab the plan and its limits, Auth the Settings tab's sign-in settings); nothing
   else, and never Write. Copy its Client ID and secret. Connections made before these permissions
   were added sign in again to read those sections.
6. **Airtable.** At airtable.com/create/oauth press Register new OAuth integration. Give it a name
   and the redirect URL `https://<relay>/back/airtable`, then under Scopes tick only
   `data.records:read` and `schema.bases:read`. Do not generate a client secret: the portals renew
   the tokens with the id alone, and adding a secret later would stop every portal's renewals.
   Copy its Client ID into `AIRTABLE_CLIENT_ID`.
7. **PostHog.** Nothing to do: the relay serves its own client document.
8. **Each portal.** Add its address to `RELAY_PORTALS`, and as the Vendor set Settings, System,
   "Sign-in service for Slack, Discord, Google, Supabase, Airtable and PostHog" to `https://<relay>`. The
   Apps page then offers "Continue to Slack", "Continue to Discord" and "Create the sheet in
   Google", the data part's Connect Supabase and Connect Airtable pages "Continue with Supabase"
   and "Continue with Airtable", and the analytics pages "Continue with PostHog" and "Continue with
   Google Analytics".
