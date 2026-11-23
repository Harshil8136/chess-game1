# @oltrem/connect

Apps: the portal's work in the apps people already use, set up by someone with no
technical background. One page, from the top (the owner's makeover of 2026-11-22):

- **Connected.** Everything the person has joined to another app, one row each, with its logo, its
  health (Working, Waiting, Trying again, Failing, Paused, Not checked lately) and what can be
  done there: Send test, Pause or Turn on, Delete. The row just made is marked for a moment.
- **The catalogue.** Every app as a card in one grid, with a sideways row of filters: All, Chat,
  Calendar, Spreadsheets, Automation, and Data where the data part is mounted and the person may
  read it (its `/api/data/services` answers): a card for each database service and "Any other
  database", which open the data part's own pages under `/data/connect/`. Each card shows the
  service's logo and how it connects, as the data part answers them; Supabase's says "Sign in"
  once the connect relay is set. A card
  says on its right whether it is connected and how it is doing, or "Ask an Owner" (greyed, still
  there) when it is not the person's to connect.
- **Chat.** A short line in a Slack, Microsoft Teams, Discord or Google Chat channel each time
  something happens. Slack and Discord in one press ("Continue to Slack"), through the Vendor's
  connect relay; any of them by pasting the app's webhook link.
- **Calendar.** The person's own bookings, shifts, days off and tasks' due days in Google
  Calendar, Apple Calendar, Outlook or any other calendar app, each with a link of its own.
- **Spreadsheets.** A list, a form's answers or the invoices in Google Sheets or Excel. With
  one-click, the Google Sheet is created in the person's Drive for them.
- **Supabase and Airtable.** The data part's pages for them sign in through the same relay and
  connect after the person confirms it (below, "Supabase, for the data part", and "Airtable, for
  the data part").
- **Automation.** Each event starts a Zapier, Make or n8n flow.
- **Any other app.** Paste any webhook link: the portal works out which app it is from the address
  (`src/detect.ts`) and sends the chat's line or the signed standard webhook. A link that cannot
  work (a retired Teams connector, a Slack Workflow link, n8n's test address) is refused with what
  to paste instead.

Each card's window has an "Open <app>" button where the app has a page to start from, the steps,
the link checked before anything is sent, the events in words (eight ticked) and an optional name.
Chat alerts and automations are the Developer module's webhooks, made through its API as the
signed-in person: who may make them is decided there. Calendar and spreadsheet links are this
module's.

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
  written only then, so a trip that ends any other way leaves no link behind (the owner's pick of
  2026-11-22).
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

Microsoft Teams and Google Chat can sign in this way only after Microsoft's publisher
verification and Google's app verification, with a refresh token kept for each alert; Zapier and
Make only for apps listed in their stores. Those stay on the pasted link (the owner's choice of
2026-11-22).

## The page

| Path | Shows |
|---|---|
| `/connect` | Connected (one line of how many work and how many need a look, then the rows, their health and actions, the databases of the data part among them); the filters; the cards by group; "Any other app". A card already connected shows its health and how it is doing (its last delivery, use or check) and opens what is running: the webhook's page, the link's row, the database's page, or Connected when there are several; "Add another" sits under it (2026-11-23) |
| `/connect?show=chat` | the four chat cards and "Any other app"; a card's window: "Continue to Slack" when one-click is set up, otherwise (or under "Or paste a webhook link instead") Open <app>, the steps, the link, "Tell me when", the name, "Connect and send a test" |
| `/connect?show=calendar` | Google Calendar, Apple Calendar, Outlook and "Another calendar app"; a card's window makes that app's link; once made, the button that adds it to that app (Outlook.com and Outlook for work or school for Outlook) and the link to copy |
| `/connect?show=sheets` | Google Sheets and Excel; the window's row of lists, forms and invoices, then "Create the sheet in Google" (one-click) or "Create the link"; once made, the `=IMPORTDATA("…")` cell with "Open a new Google Sheet", or the Excel steps |
| `/connect?show=automate` | Zapier, Make, n8n and "Any other app" |
| `/connect?show=data` | the data services the providers part lists (kind `data`), each opening `/data/connect/<id>`, or once connected its connection's page |
| `/connect/back` | one-click's way back: it redirects to the row made, the new sheet, or the page with why nothing was made; for Supabase it shows "Pick a Supabase project" or "Connect <project>?", and for Airtable "Connect Airtable?", whose Connect posts to `/connect/back` ("Supabase, for the data part", "Airtable, for the data part") |

## The logos

Slack, Discord, Google Chat, Google Calendar, Google Sheets, Zapier, Make and n8n show their own
one-colour mark from the Simple Icons project (CC0 data; each brand keeps its trademark), drawn in
the brand's colour on the logo tile (`src/brands.ts`, the design system's one exception for logos):
white in the light theme, clear in the dark one, where a brand colour too dark to see
(Slack's, Make's) is drawn in the text colour; Apple Calendar's icon is a grey that reads on both (`inkOf`, `@oltrem/core-ui`). Zapier
shows its asterisk, drawn here, since the project's mark is its badge with an unreadable name.
Microsoft asked for its marks to be taken out of that project, so Teams, Outlook and Excel show a
plain icon in their colour. Apple Calendar, "Another calendar app", the spreadsheet rows and "Any
other app" show a plain icon. The page ends with one line saying the names and logos belong to
their owners and only show which app a card connects to.

## What is logged

Every read of a calendar or spreadsheet link is an audit row (`connect.received`, through the
app's `onHook`): the link's id as the target, its name, whose it is, how many events or rows went
out, the caller's address and the bytes sent; never the link's address. Every change made on the
page is a row through `onChange`, as everywhere.

## Tables

Migration `0073_connect.sql`, additive and idempotent: `connect_links` (the company, the person,
the kind, its source and name, the secret's hash, when it was made and last read), indexed by the
hash and by person. No secret is kept, so a backup restores the links as they were.

## Personal data

`personal`, "Calendar and spreadsheet links they made": the kind, the name, when each was made and
last read, never a secret.

## Errors

None of its own. A link of a kind or source the person may not make is `KIT-E-0422`; a sheet
without `connect.share` is `KIT-E-0403`; a link that is not theirs is `KIT-E-0404`.

## Not here yet

- One-click for Microsoft Teams, Google Chat, Excel, Zapier and Make (see "One-click sign-in").
- An Owner's list of everyone's links, to delete one; signing the person out ends them all today.
- A row in the audit log for each read of a spreadsheet link.
- Calendar items from modules other than bookings, shifts, time off and tasks.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; what a
person may link; a calendar link's address once, its hash only, the calendar file with escaping
and all-day days, a failing source reported and left out, the last read written hourly; a new
calendar link replacing the old; a link refused when guessed, of the other kind, during a block,
after an Owner's sign-out (deleted), switched off and on again (stays closed), or deleted; 90 days
unread; a spreadsheet link refused without `connect.share`, read as its person, closed when the
list is gone, the module is off or the permission is taken away; the 20-link limit; the privacy
search; the audit rows; folding and entries that do not read; a calendar link for each calendar
app. One-click: set up or not, the relay sent this portal, a key and a nonce, a sealed answer made
into the alert, a trip refused for another person, nonce, service or after ten minutes, a seal for
another trip, an address of another service or a seal not made by the relay's key refused, the
relay's key unreadable said as not available, who may start, a sheet's address sealed so only the
relay opens it, the link written only once the sheet's address comes back, none when the relay
could not make the sheet or names another address, and no second one when the way back is
replayed. The Data filter's cards, drawn where the data part answers and absent where it does not
(`test/pages.test.ts`). The Custom card's guess from each
app's address, the links it refuses and an app's own page pasted by mistake
(`test/detect.test.ts`). Each store's `calendar()` and the invoices' `csv()` have their own tests
in their modules. The client template's screens test makes a calendar and a spreadsheet link as
the Owner, reads both with no sign-in, sees a filter list only its own rows, deletes the links and
sees an address closed, makes a link for two calendar apps, checks the chat and Custom refusals;
and, with the relay set, one-click on the page: the buttons shown, Continue's 303 to the relay
with its cookie, the way back refused for another person, cancelled, then made into the alert with
a test sent and the cookie cleared, and a pasted link sent with Enter taken as the link.
