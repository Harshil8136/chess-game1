---
title: "@oltrem/connect: Using it; Who may do what; A link; One-click sign-in"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/connect/src; split from modules/connect/README.md]
---

# @oltrem/connect: Using it; Who may do what; A link; One-click sign-in

> Part of [the @oltrem/connect README](../README.md).

## Using it

```ts
import { createConnect } from '@oltrem/connect';
import { pages as connectPages } from '@oltrem/connect/pages';
import { withPages } from '@oltrem/core-module';

const connect = createConnect<Env>({
  index: iam.index,
  bindings: (env) => ({ db: env.DB }),
  kek: (env) => env.KEK, // seals the one-click trip
  relay: async (env) => (await settingsFor(env)).get<string>(RELAY_SETTING.key),
  calendars: [{ id: 'bookings', label: 'Bookings', entries: (env, s, from, to) => bookings.store.calendar(env, s, from, to) }],
  sheets: [{ id: 'records', label: 'Lists', choices: /* … */, csv: /* … */ }],
  off: partsOff,
});
const modules = [iam.module, /* ... */ withPages(connect.module, connectPages)];
```

The client template wires four calendar sources (bookings, shifts, time off, tasks, each through
its store's `calendar()`) and three spreadsheet sources (records' lists and forms through their
`exportCsv`, the invoices through `store.csv()`). A source whose module is switched off on the
Features page offers nothing and opens nothing. It adds no binding, secret or variable: one-click
uses the portal's KEK and one setting, `connect.relay` (the Vendor's, under System), the relay's
address. Empty, the cards offer the pasted link only.

## Who may do what

| Capability | Lets them |
|---|---|
| `connect.self` (every account) | see their own links, make their calendar link, delete their own links |
| `connect.share` (bit plane `31`, operate) | make a spreadsheet link. It hands a whole list out of the portal, so an Owner can withhold it, as `files.share` for one file; taken away, the person's spreadsheet links open nothing until it is given back |
| `connect.analytics.manage` (admin, at the company) | connect (by a key or by signing in), check, give a new key to and remove the company's website analytics apps (`/api/connect/analytics`, 2026-11-26); someone without it sees the cards greyed with "Ask an Owner" |
| `connect.links.manage` (admin, at the company) | see everyone's links on `/connect/links` (whose each is, when an app last read it; never a secret) and delete any, audited as `connect.end` with whose it was (`GET /api/connect/links/everyone`, `DELETE /api/connect/links/everyone/:id`, 2026-11-24) |

A chat alert or an automation needs `developer.manage`, checked by the Developer module. Without
it, or with Developer switched off, the two tabs say who can help instead of showing cards that do
nothing.

## A link

A link reads as its person, with the access they hold at the moment an app reads it: a role taken
away, it shows less. Its secret is 24 random bytes (32 letters, digits, `-` and `_`) in the
address, shown once; the table keeps only its SHA-256. One calendar link for each calendar app a
person uses (source `calendar:google-calendar`, `calendar:apple-calendar`, `calendar:outlook`,
or `calendar` for any other): a new one for an app replaces that app's old one only.

A link opens nothing, for good, once:

- its person deletes it;
- an Owner signs the person out, blocks them or switches them off (`iam_principals.signed_out_at`
  at or after the link was made). Switched on again, the person makes new links; the old ones stay
  closed;
- no app read it for 90 days.

Such a link is deleted the next time an app tries it. While a block lasts, the person's links open
nothing. A spreadsheet of something the person may no longer see, or that is gone, opens nothing.

| Limit | Value |
|---|---|
| Spreadsheet links a person keeps | 20, counted in the same statement that writes one |
| What the calendar holds | 30 days back to 180 ahead, at most 200 items from each source |
| How often the last read is written | once an hour at most |
| A link no app read | opens nothing after 90 days |

The invoices sheet holds the customer's address and the totals of every invoice at the places the
person may view, the newest 500: anyone with the link reads them, which the page says when the
link is made.

## One-click sign-in

Slack (`incoming-webhook`), Discord (`webhook.incoming`) and Google (`drive.file`, online access, no
refresh token) in one press, without the portal holding any app's secret. The Vendor runs one
connect relay for every portal (`packages/relay`, its README says how to set it up); the portal
keeps nothing of the service's.

```mermaid
sequenceDiagram
  participant P as Person's browser
  participant W as Portal (behind Access)
  participant R as Connect relay
  participant S as Slack, Discord or Google
  P->>W: Continue to Slack (form post)
  W-->>P: 303 to the relay, trip cookie (10 min, HttpOnly, sealed under the KEK)
  P->>R: /start/slack?state (portal, one-time public key, nonce, expiry)
  R-->>P: 302 to the service's approval page (portal must be in RELAY_PORTALS)
  P->>S: picks the channel or account, Allow
  S-->>P: 302 to the relay with a code
  P->>R: /back/slack?code&state
  R->>S: exchanges the code with the app's secret (Google: then creates the sheet with the token)
  R-->>P: 302 to /connect/back with only the named fields, sealed with the relay's key to the one-time key
  P->>W: /connect/back (through Access, with the trip cookie)
  W->>R: /key (the relay's public seal key)
  W->>W: trip opened: same person, same company, same nonce, same service, in time; seal opened, from the relay's key only
  W-->>P: 303 to the alert row (test sent) or to the new Google Sheet (link written now); cookie cleared
```

What keeps it safe:

- **No secret in a portal.** The apps' ids and secrets are the relay's Worker secrets; the relay
  stores nothing and answers only GET.
- **Only known portals.** The relay sends a person back only to an origin in `RELAY_PORTALS`, and
  refuses any other without a redirect, so a trip cannot land on someone else's site.
- **Only for that trip.** The answer is sealed (ECDH P-256, HKDF-SHA-256, AES-256-GCM) to a key
  made for this one trip, with the service and the nonce as its additional data; the private half
  stays in the person's own browser, sealed under the KEK, so only the portal that started it, in
  that browser, opens it.
- **Only from the relay.** The relay seals with its own key, and the portal reads that key's
  public half from the relay's `/key` and refuses a seal from any other key. A trip's state passes
  through addresses others can see; without this, whoever read it could answer it themselves (the
  security review of 2026-11-22). When the key cannot be read, nothing is opened and the page
  says one step is not available.
- **Only this person, only now.** The trip names the person and the company; it is refused after
  10 minutes, for another person, with another nonce or another service. The cookie is cleared on
  every way back.
- **Checked twice.** The relay keeps only the fields its entry names, each starting as it must
  (`https://hooks.slack.com/services/`, `https://discord.com/api/webhooks/`); the portal checks the
  address again before the Developer module checks it a third time.
- **The same permissions.** Starting a chat needs `developer.manage`, a sheet `connect.share`;
  the alert is made through the Developer API as the person.
- **No Google token in a portal.** For a sheet, the portal chooses the link's secret at the start
  and sends its address to the relay sealed to the relay's key; the relay creates the sheet with
  Google's token (`drive.file`, used once) and sends back only the sheet's address. The link is
  written only then, so a trip that ends any other way leaves no link behind.
- **Supabase and Airtable are confirmed first.** Their answer is held, never saved on the way
  back; see "Supabase, for the data part" below.
- **Cloudflare Access.** The way back is a top-level GET from the person's own browser to
  `/connect/back`, behind the portal's Access door like every page.

### Supabase, for the data part

The data part's Supabase page (`/data/connect/supabase`) offers "Sign in with Supabase" to a
person with `data.manage` at the company once the relay is set. It goes through the same relay, to
Supabase's own OAuth (the app's permissions: Projects Read and Secrets Read), and the relay reads
the project's secret key with Supabase's token, used once there and never sent on. Then:

- **One project, or the one picked:** the relay sends back its address, name and secret key. The
  portal checks the address (`<ref>.supabase.co`) and the key (`sb_secret_…`) again, saves
  nothing, and holds them sealed under the KEK in a second ten-minute cookie
  (`oltrem_connect_trip_held`, HttpOnly, Path=/connect) for this person only. The page asks
  "Connect <project>?" with its address; only Connect, a form post, opens the held answer again
  (`POST /api/connect/oneclick/held` with `use`: the key comes back only then, and only while the
  person still holds `data.manage` at the company and within 10 minutes of the trip's start) and
  saves it through the data part's own
  `POST /api/data/connections`, which checks `data.manage` and a fresh sign-in as always. So a way
  back someone else hands the person cannot connect that someone's database (the security
  review). A refusal there is shown on the same page, the project still held; when the data part
  answers that the project is already connected (`KIT-E-4104`: Connect pressed twice, or the Back
  button), that connection's page opens instead, saying so, and the held answer is let go. After
  Connect, the held cookie keeps only the new connection's id (`made.<id>`, no secret) for the rest
  of the ten minutes, so Back to "Connect <project>?" or Connect pressed again opens that connection
  ("already connected") instead of saying nothing was connected or making a second one. Cancel,
  also a form post, clears the held cookie at once and says "You pressed Cancel" on the data page.
  The sign-in button and the project picker's buttons carry `data-reload`: they leave for the
  relay, another site, which the page script's own form posts cannot follow.
- **Several projects:** a page with one button each; pressing one signs in again with that
  project's ref sent sealed to the relay's key.
- **A project with no secret key yet:** a page saying where in Supabase to make one.
- **Anything else** (cancelled, too slow, refused): back on the Supabase page with the reason in
  fixed words.

The relay also sends back the Management API's access token, its refresh token and how many seconds
it lasts. The portal holds them with the key only when all three read right (printable, no spaces,
at most 4,096 characters, a lifetime of at most a day), and Connect saves them as `access`,
`refresh` and `expires` (ms) beside the key, so the project's logs, requests, advisors, backups and
functions read without pasting a token; the data part renews them through the relay (its README,
"Sign in with Supabase gives the token"). Otherwise the key alone is saved, as before.

Starting it is refused at once, before the trip to Supabase, without `data.manage` held at the
company.

### Airtable, for the data part

The data part's Airtable page (`/data/connect/airtable`) offers "Sign in with Airtable" the same
way and to the same people (batch 5 of the database review, 2026-11-22). The person picks the
bases on Airtable's own page; the Vendor's Airtable integration asks only for `data.records:read`
and `schema.bases:read`. Airtable has no lasting key an app can make, so the relay sends back its
access token (an hour), its refresh token (60 days, replaced on each use) and the integration's
public id. The integration is registered without a client secret, as Airtable allows with PKCE, so
each portal renews the tokens itself and no relay endpoint is needed after the sign-in. The portal
checks the three again (printable, no spaces, a lifetime of at most a day), turns the lifetime into
the time it ends, and holds them in the same sealed cookie. The page asks "Connect Airtable?"
(no address: Airtable has one for everyone), and Connect saves them through
`POST /api/data/connections` as the fields `token`, `refresh`, `expires` and `client`. The way back,
the confirm page and Cancel carry the service (`?p=airtable`, a hidden `service`), so a stale or
cancelled trip lands on the Airtable page, not Supabase's. Airtable has no address to spot a
second connection by, so the `made.<id>` cookie above is what stops Back or a second press from
making one. How the data part renews them is in its README, "Sign in with Airtable".

Microsoft Teams and Google Chat can sign in this way only after Microsoft's publisher verification
and Google's app verification, with a refresh token kept for each alert; Zapier and Make only for
apps listed in their stores. Those stay on the pasted link.
