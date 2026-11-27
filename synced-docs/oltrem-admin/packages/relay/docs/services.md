---
title: "@oltrem/relay: the services, its secrets, the seal key, setting it up, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/relay/src/index.ts, providers.ts, wrangler.jsonc, scripts]
---

# @oltrem/relay: the services, its secrets, the seal key, setting it up, tests

> Part of [the @oltrem/relay README](../README.md).

## The services

Each is one data entry in `src/providers.ts`: sign-in page, token endpoint, smallest scopes, the
names of its secrets, PKCE where the service has it, what the answer must hold, and the fields that
go back, each with the start it must have.

| Service | Scope and client | What goes back to the portal |
|---|---|---|
| Slack | `incoming-webhook` | The picked channel's webhook address, its name, the workspace's name (the token dropped) |
| Discord | `webhook.incoming` | The picked channel's webhook address (no bot joins) |
| Google | `…/auth/drive.file`, online, PKCE | Only the new sheet's address: the relay creates it with the token, used once |
| Supabase | None sent (the app has Projects and Secrets read), PKCE, id and secret as HTTP Basic | The project's address, name and `sb_secret_…` key, plus the Management API token (an hour), refresh token and lifetime; with several projects and none picked, the list (ref, name) and no token |
| Airtable | `data.records:read schema.bases:read`, PKCE, id alone (no secret) | Access token (an hour), refresh token (60 days, replaced on use), lifetime, the integration's id; the portal renews itself |
| PostHog | `project:read query:read session_recording:read` (recordings since 2026-11-27, for the portal's player, optional in the client document so a declined or newly added scope never stops the sign-in), PKCE, client id `https://<relay>/client/posthog` | Tokens, lifetime, what was allowed (`scoped_teams` as `teams`, `scoped_organizations` as `orgs`), the region that issued the token (`posthog_region` as `region`) and the client id; the portal renews itself |
| Google Analytics | `…/auth/analytics.readonly`, offline, consent each time, PKCE, the Google app | Tokens and lifetime; renewed through `/renew/google-analytics` |

A new service is one entry with its secrets (and their rows in `tokens.registry.json`), or none for
one that reads a client document.

On the way back, only `error=access_denied` is the person saying no (`e=refused`, "You
cancelled"). Any other `error`, or no code, is the service refusing the request: `e=failed`, and the
relay logs the error and up to 200 characters of `error_description`, never the code or the state.

| Flag or case | What it does |
|---|---|
| `cimd` (PostHog) | A Client ID Metadata Document at `https://<relay>/client/<id>`: the id, the name "Oltrem", the one way back `https://<relay>/back/<id>`, `token_endpoint_auth_method: none`, the scopes under `com.posthog`, kept an hour; nothing set up at PostHog |
| `relayRenews` (Supabase, Google Analytics) | `POST /renew/<id>` with a form `refresh_token`: exchanged with the app's id and secret, answered `{token, refresh, expires}`, nothing kept. A service refusal (400, 401) is `400 {error: 'refused'}` (the sign-in ended), no secrets 503, else 502; a GET or another service refused |
| `keepsRefresh` (Google Analytics) | Google answers a renewal without a refresh token, so the one given is handed back; for Supabase, which spends it, that is a failure |
| No `clientSecret` (Airtable) | The code exchanged with the id and PKCE verifier, no Basic header; the verifier made from the seal key, so it is kept nowhere |
| The sheet (Google) | The portal seals the link's address and title to the relay's key in the state; the relay writes only `=IMPORTDATA("<portal>/hooks/connect/sheet/<32 letters>.csv")` into the new sheet and seals back only its `https://docs.google.com/` address. A state without it is refused before sign-in, so a Google token never reaches a portal |
| The project (Supabase) | Lists the account's projects (`GET /v1/projects`); reads a sealed `{project}` only when it is one of them, else the only one, else sends the list; the key is the first `secret` from `GET /v1/projects/<ref>/api-keys?reveal=true`; none sends address and name alone. Three calls |

Who renews is not checked: a refresh token issued to the Vendor's app renews here for anyone holding
it. Portals keep theirs sealed under their own key; a signature from each portal would close the
rest (not built yet).

## Its secrets

Eleven Worker secrets, required in `wrangler.jsonc`, by name only (rows in the token registry):

| Secret | Holds |
|---|---|
| `RELAY_PORTALS` | The portal addresses it may return to, separated by spaces or commas |
| `RELAY_SEAL_KEY` | Its own key pair, from `scripts/seal-key.mjs` |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SUPABASE_CLIENT_ID`, `SUPABASE_CLIENT_SECRET` | Each app's |
| `AIRTABLE_CLIENT_ID` | The integration's public id (it has no secret) |

A service with empty secrets, no seal key, or a service this relay does not know (a newer portal)
answers "not set up" to a listed portal, which offers the other way; otherwise "No such service."
and no redirect.

## The seal key

Every answer is sealed with the relay's key, whose public half is at `https://<relay>/key`; the
portal reads it each time and opens only what it sealed. A trip's state travels in addresses others
can see, so without it anyone could seal an answer of their own. The first deploy makes it; to
replace it, straight into the secret:

```sh
node packages/relay/scripts/seal-key.mjs | pnpm --filter @oltrem/relay exec wrangler secret put RELAY_SEAL_KEY
```

A trip on its way at that moment fails, and the person presses again.

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
8. **Each portal.** Nothing to do when the portals update through the fleet: each run gives every
   portal with its own address the relay's address and keeps `RELAY_PORTALS` to their list
   (docs/reference/fleet.md, step 6). A portal outside the fleet: add its address to
   `RELAY_PORTALS`, and as the Vendor set Settings, System, "Sign-in service for Slack, Discord,
   Google, Supabase, Airtable and PostHog" to `https://<relay>`. The Apps page then offers "Continue to Slack", "Continue to Discord" and "Create the sheet in
   Google", the data part's Connect Supabase and Connect Airtable pages "Continue with Supabase"
   and "Continue with Airtable", and the analytics pages "Continue with PostHog" and "Continue with
   Google Analytics".

## Tests

`test/relay.test.ts`, inside the Workers runtime with the token endpoints answered by the test: the
seven entries and scopes; portals and states accepted; an unknown portal refused without a redirect
at start and return; Slack and Discord exchanged with the secret and only the webhook sealed back;
Google's sheet made by the relay, its verifier, and no sheet without the portal's own sealed link,
for another portal, a formula with more than the link, or a Google failure; refused, expired (or
dated ahead), not set up and failed trips said so; GET only; `/key`; a refusal page naming no
setting; fields kept only as named and prefixed. Supabase: PKCE, HTTP Basic, the only project's key
read once, several as a list, a sealed project only when the account's, none without a key, its
tokens and `/renew/supabase` (a refused token 400). Airtable: scopes, PKCE, the id alone, tokens and
id sealed back, an answer without a refresh token failed. An unknown service: not set up. PostHog:
the client document, the id and PKCE, tokens, projects, organizations and region sealed back; its
own refusal a logged failure, a cancel a refusal. Google Analytics: offline and
consent, a renewal without a refresh token handing back the one given.

`scripts/relay-deploy.test.mjs` (Node): required secrets read from `wrangler.jsonc`, a Worker not yet
deployed read as having none, other wrangler failures reported, portals asked until named, a service
skippable, a secret typed unseen.
