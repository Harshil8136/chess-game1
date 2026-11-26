---
title: "@oltrem/connect: using it, who may do what, a link, one-click sign-in"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/connect/src/module.ts, links.ts, oneclick.ts, types.ts]
---

# @oltrem/connect: using it, who may do what, a link, one-click sign-in

> Part of [the @oltrem/connect README](../README.md).

## Using it

```ts
const connect = createConnect<Env>({
  index: iam.index,
  bindings: (env) => ({ db: env.DB }),
  kek: (env) => env.KEK, // seals the one-click trip
  relay: async (env) => (await settingsFor(env)).get<string>(RELAY_SETTING.key),
  calendars: [{ id: 'bookings', label: 'Bookings', entries: (env, s, from, to) => bookings.store.calendar(env, s, from, to) }],
  sheets: [{ id: 'records', label: 'Lists', choices: /* … */, csv: /* … */ }],
  registry: providers.registry, // mounts website analytics
  off: partsOff,
});
const modules = [iam.module, /* ... */ withPages(connect.module, connectPages)];
```

The template wires four calendar sources (bookings, shifts, time off, tasks, each store's
`calendar()`) and three sheets (records' lists and forms through `exportCsv`, invoices through
`store.csv()`). A switched-off module's source offers and opens nothing. No binding, secret or
variable is added: one-click uses the KEK and the Vendor's setting `connect.relay` (the relay's
address); empty, the cards offer the pasted link only. Routes sit under `/api/connect`; apps read
the public `/hooks/connect/calendar/<secret>.ics` and `/hooks/connect/sheet/<secret>.csv`.

## Who may do what

| Capability | Lets them |
|---|---|
| `connect.self` (every account) | See, make (calendar) and delete their own links |
| `connect.share` (operate, bit plane 31) | Make a spreadsheet link; it hands a whole list out, so an Owner can withhold it, and taken away the person's sheet links open nothing |
| `connect.analytics.manage` (admin, company) | Connect, check, re-key and remove the website analytics apps |
| `connect.links.manage` (admin, company) | See everyone's links on `/connect/links` and delete any (audited `connect.end` with whose it was) |

A chat alert or automation needs `developer.manage`, checked by the Developer module; without it,
or with Developer off, those tabs say who can help.

## A link

A link reads as its person, with the access they hold when an app reads it. Its secret is 24
random bytes in the address, shown once; the table keeps its SHA-256. One calendar link per
calendar app (`calendar:google-calendar`, `calendar:apple-calendar`, `calendar:outlook`, or
`calendar`); a new one replaces only that app's.

A link closes for good when its person deletes it, when an Owner signs out, blocks or switches off
the person (`iam_principals.signed_out_at` at or after it was made; switched on again, old links
stay closed), or after `idleDays` unread; it is deleted at the next try. During a block, or for a
list the person may no longer see, it opens nothing.

| `LIMITS` | Value |
|---|---|
| `sheets` | 20 spreadsheet links a person, counted in the statement that writes one |
| `pastDays`, `aheadDays` | The calendar holds 30 days back to 180 ahead, 200 items a source |
| `readEvery` | The last read written at most hourly |
| `idleDays` | 90 |
| `reads`, `readWindow` | 60 reads in 10 minutes in one isolate, then `KIT-E-0429` for the rest, before D1 is asked (each refusal logged) |
| `everyone` | 200 links on Everyone's links |

The invoices sheet holds customers' addresses and totals, the newest 500 at the person's places;
the page says anyone with the link reads them.

## One-click sign-in

Slack (`incoming-webhook`), Discord (`webhook.incoming`) and Google (`drive.file`, online access, no
refresh token) in one press, the portal holding no app's secret. The Vendor runs one connect relay
for every portal (`packages/relay`); `ONE_CLICK` lists its services (also Supabase, Airtable,
PostHog, Google Analytics).

```mermaid
sequenceDiagram
  participant P as Browser
  participant W as Portal (behind Access)
  participant R as Relay
  participant S as Slack, Discord or Google
  P->>W: Continue to Slack (form post)
  W-->>P: 303 to the relay, trip cookie (10 min, sealed under the KEK)
  P->>R: /start/slack?state (portal, one-time public key, nonce, expiry)
  R-->>P: 302 to the approval page (portal must be in RELAY_PORTALS)
  P->>S: Allow
  S-->>P: 302 to the relay with a code
  R->>S: exchanges the code (Google: creates the sheet)
  R-->>P: 302 to /connect/back, the named fields sealed to the one-time key
  P->>W: /connect/back with the trip cookie
  W->>R: /key (the relay's public seal key)
  W-->>P: 303 to the alert (test sent) or the new sheet; cookie cleared
```

| Safeguard | How |
|---|---|
| No secret in a portal | App ids and secrets are relay Worker secrets; the relay stores nothing and answers only GET |
| Only known portals | The relay returns only to an origin in `RELAY_PORTALS`, refusing others without a redirect |
| Only that trip | The answer is sealed (ECDH P-256, HKDF-SHA-256, AES-256-GCM) to a key made for the trip, service and nonce as additional data; the private half stays in the browser under the KEK |
| Only from the relay | The portal reads the relay's public key from `/key` and refuses any other seal; unreadable, nothing opens and the page says a step is not available |
| Only this person, now | The trip names person and company; refused after `TRIP_MINUTES` (10), or for another person, nonce or service; the cookie is cleared on every way back |
| Checked three times | The relay keeps only named fields with their prefix (`https://hooks.slack.com/services/`, `https://discord.com/api/webhooks/`); the portal checks again, then the Developer module |
| Same permissions | A chat needs `developer.manage`, a sheet `connect.share`; the alert is made as the person |
| No Google token in a portal | The portal picks the link's secret first and sends its address sealed to the relay, which creates the sheet and returns only its address; the link is written only then |
| Every failure said | A trip that brings nothing back writes `connect.oneclick-finish` to the audit log as `failed` (`refused` when the person cancelled) with the step that stopped it (`why`, never a value it carried), and logs it; the page shows only the reason's notice |

Teams and Google Chat would need Microsoft's and Google's verification and a kept refresh token;
Zapier and Make only for store-listed apps. They stay on the pasted link.

### Supabase and Airtable, for the data part

`/data/connect/supabase` and `/data/connect/airtable` offer the sign-in to `data.manage` at the
company once the relay is set; starting it without that is refused before the trip. The answer is
never saved on the way back: it is held sealed under the KEK in a second 10-minute cookie
(`oltrem_connect_trip_held`, HttpOnly, Path=/connect), and the page asks "Connect <project>?".
Only **Connect** (a form post, `POST /api/connect/oneclick/held` with `use`) opens it, while the
person still holds `data.manage`, and saves it through the data part's `POST /api/data/connections`
(fresh sign-in as always), so a way back someone else hands over cannot connect their database.
Afterwards the cookie keeps only `made.<id>`, so Back or a second press opens that connection
("already connected", also on `KIT-E-4104`). **Cancel** clears it. Buttons leaving for the relay
carry `data-reload`.

| Service | What the relay returns | Saved as |
|---|---|---|
| Supabase (Projects Read, Secrets Read) | Address, name and secret key (checked again: `<ref>.supabase.co`, `sb_secret_…`); several projects give a page of buttons, each signing in again with its ref sealed; none with a key gives where to make one | The key, plus `access`, `refresh`, `expires` when all three read right (printable, at most 4,096 characters, at most a day) |
| Airtable (`data.records:read`, `schema.bases:read`, PKCE without a client secret) | The access token (an hour), the refresh token (60 days, replaced on use) and the integration's id; the page asks "Connect Airtable?" | `token`, `refresh`, `expires`, `client`; each portal renews itself |

The way back, confirm page and Cancel carry the service (`?p=airtable`), so a stale trip lands on
the right page. How the data part renews is in its
[timed checks page](../../data/docs/timed-check-and-home.md#sign-in-with-airtable).
