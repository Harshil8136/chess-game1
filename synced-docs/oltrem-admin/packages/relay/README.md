# @oltrem/relay

The connect relay: one Cloudflare Worker in the Vendor's own account, for every portal, that makes
one-click sign-in possible without any portal holding an app's secret (2026-11-22, the owner's
one-click connect). It holds the sign-in apps' ids and secrets, sends the person to the service's
own approval page, exchanges the code that comes back, keeps only the fields the portal needs and
seals them to the portal's one-time key with its own seal key. It stores nothing: no table and no
key-value store, and its logs keep errors only, not the addresses of requests (a trip's state rides
in them).

```text
portal  --302-->  /start/<service>?state=...        the portal must be listed in RELAY_PORTALS
relay   --302-->  the service's sign-in and approval page
service --302-->  /back/<service>?code=...&state=...
relay   exchanges the code with the app's secret (Airtable: its id alone), keeps only the fields its entry names,
        seals them to the portal's one-time key with RELAY_SEAL_KEY, and
        --302-->  <portal>/connect/back?p=<service>&n=<nonce>&r=<sealed>
```

How the portal starts and finishes a trip, and why each check is there, is in
[the connect module's README](../../modules/connect/README.md#one-click-sign-in).

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
| Supabase | none sent (the OAuth app is registered with Projects read and Secrets read), PKCE, the app's id and secret as HTTP Basic | only the picked project's address, name and secret key (`sb_secret_…`): the relay reads them with the Management API token, used once and never sent on; the refresh token is dropped. With several projects and none picked, the list of projects (ref and name) instead |
| Airtable | `data.records:read schema.bases:read`, PKCE, the integration's id alone (it has no secret) | the access token (an hour), the refresh token (60 days, replaced on each use), how many seconds the access token lasts, and the integration's public id: Airtable has no lasting key an app can make, so the portal keeps these and renews them itself (the data part's README, "Sign in with Airtable"). The one service whose refresh token goes back |

A new service is one more entry with its two secrets (and their rows in `tokens.registry.json`).

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
time an answer comes back, and opens only what that key sealed. A trip's state travels in
addresses that the service, the browser's history and any proxy can see; without the relay's key,
someone who read it could seal an answer of their own and have the portal make an alert to their
channel (found in the security review of 2026-11-22). The key is made once, straight into the
secret, so it never shows on the screen:

```sh
node packages/relay/scripts/seal-key.mjs | pnpm --filter @oltrem/relay exec wrangler secret put RELAY_SEAL_KEY
```

Running it again replaces the key at once; a trip on its way at that moment comes back as failed,
and the person presses again.

## Setting it up (once, by the Vendor)

`<relay>` below is the relay's address once deployed, as `oltrem-relay.<your subdomain>.workers.dev`.

1. **Deploy it** to the Vendor's Cloudflare account: `pnpm --filter @oltrem/relay run deploy`
   after making the seal key (above) and setting the other ten secrets with
   `pnpm --filter @oltrem/relay exec wrangler secret put <NAME>` (or in the dashboard, under the
   Worker's Settings, Variables and Secrets).
2. **Slack.** At api.slack.com/apps press Create New App, From scratch, name it and pick any
   workspace of yours. Under OAuth & Permissions add the redirect URL `https://<relay>/back/slack`
   and the bot scope `incoming-webhook`. Under Manage Distribution, activate public distribution
   (no App Directory listing is needed). Copy the Client ID and Client Secret from Basic
   Information.
3. **Discord.** At discord.com/developers/applications press New Application. Under OAuth2 add the
   redirect `https://<relay>/back/discord` and copy the Client ID and Client Secret.
4. **Google.** In console.cloud.google.com make a project and enable the Google Sheets API. Under
   Google Auth Platform: Branding (the app's name and a support address), Audience External and
   Publish app, Data access with the `.../auth/drive.file` scope (Google's non-sensitive level,
   so no verification), then Clients, Create client, Web application, with the authorized
   redirect URI `https://<relay>/back/google`. Copy its Client ID and secret.
5. **Supabase.** In supabase.com/dashboard open your organization's settings, OAuth Apps, Add
   application. Give it a name and the redirect URL `https://<relay>/back/supabase`, and under
   permissions set Projects to Read and Secrets to Read, nothing else. Copy its Client ID and
   secret.
6. **Airtable.** At airtable.com/create/oauth press Register new OAuth integration. Give it a name
   and the redirect URL `https://<relay>/back/airtable`, then under Scopes tick only
   `data.records:read` and `schema.bases:read`. Do not generate a client secret: the portals renew
   the tokens with the id alone, and adding a secret later would stop every portal's renewals.
   Copy its Client ID into `AIRTABLE_CLIENT_ID`.
7. **Each portal.** Add its address to `RELAY_PORTALS`, and as the Vendor set Settings, System,
   "Sign-in service for Slack, Discord, Google, Supabase and Airtable" to `https://<relay>`. The
   Apps page then offers "Continue to Slack", "Continue to Discord" and "Create the sheet in
   Google", and the data part's Connect Supabase and Connect Airtable pages "Sign in with Supabase"
   and "Sign in with Airtable".

## Tests

Inside the Workers runtime, with the token endpoints as a fetch the test answers: the five
entries and their scopes; the portals it reads and the states it accepts; a known portal sent to
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
no project, or a refusal, failed. Airtable: its read-only scopes and a PKCE challenge, a state in
Airtable's own rules; the code exchanged with the id alone, no secret and no Basic header, with
the verifier whose challenge went out; the tokens, their lifetime and the id sealed back, nothing
else; not set up without its id; an answer without a refresh token failed. A service it does not
know: back to a listed portal as not set up, and a plain 404 without a state, for an unlisted
portal or on the way back.
