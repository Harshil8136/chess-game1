# @oltrem/connect

Connect apps: the portal's work in the apps people already use, set up by someone with no
technical background. One page, four tabs in a sideways row:

- **Chat alerts.** A short line in a Slack, Microsoft Teams, Discord or Google Chat channel each
  time something happens: a form answered, a quote accepted, a booking made.
- **Calendar.** The person's own bookings, shifts, days off and tasks' due days in the calendar on
  their phone (Google Calendar, Apple Calendar, Outlook), kept up to date by the calendar app.
- **Spreadsheets.** A list, a form's answers or the invoices in Google Sheets or Excel, updated by
  the spreadsheet itself.
- **Make, Zapier, n8n.** Each event starts a flow in the other app.

Each service is a card with its own logo where one may be shown (see "The logos" below), one plain
sentence, numbered steps for the other app, one field and one button. Chat alerts and automations
are the Developer module's webhooks, made through its API as the signed-in person: the page adds
the chat formats there, and who may make them is decided there. Calendar and spreadsheet links are
this module's.

## Using it

```ts
import { createConnect } from '@oltrem/connect';
import { pages as connectPages } from '@oltrem/connect/pages';
import { withPages } from '@oltrem/core-module';

const connect = createConnect<Env>({
  index: iam.index,
  bindings: (env) => ({ db: env.DB }),
  calendars: [{ id: 'bookings', label: 'Bookings', entries: (env, s, from, to) => bookings.store.calendar(env, s, from, to) }],
  sheets: [{ id: 'records', label: 'Records', choices: /* … */, csv: /* … */ }],
  off: partsOff,
});
const modules = [iam.module, /* ... */ withPages(connect.module, connectPages)];
```

The client template wires four calendar sources (bookings, shifts, time off, tasks, each through
its store's `calendar()`) and three spreadsheet sources (records' lists and forms through their
`exportCsv`, the invoices through `store.csv()`). A source whose module is switched off on the
Modules page offers nothing and opens nothing. It adds no binding, secret or variable.

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
address, shown once; the table keeps only its SHA-256. One calendar link a person: a new one
replaces the old, whose address stops working.

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

## The page

| Path | Shows |
|---|---|
| `/connect?show=chat` | the four chat cards; a card opens a dialog with the steps, the link from the service, "Tell me when" as chips (eight events ticked) and "Connect Slack"; on Connect the webhook is made and a test sent at once; the person's chat alerts with Working, Not arriving, Waiting or Off, and when the last one was sent |
| `/connect?show=calendar` | "Create my calendar link"; once made, "Add to Google Calendar", "Add to Apple Calendar", "Add to Outlook" and "Add to Outlook for work or school", each opening the app's own add-by-link screen, and the link to copy; the link with when it was last used and "Delete link" |
| `/connect?show=sheets` | the lists, forms and invoices the person may see as a row of choices and "Create a spreadsheet link"; once made, the `=IMPORTDATA("…")` cell for Google Sheets and the Excel steps; the links, each with "Delete link" |
| `/connect?show=automate` | the Zapier, Make and n8n cards and dialogs, as for chat; the person's automations |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /links` | `connect.self` | the person's links without their secrets, what the calendar holds, the sheets they may link and whether they may share |
| `POST /links` (`kind`, `source`) | `connect.self`; `connect.share` for a sheet | makes a link; its address is answered this once |
| `DELETE /links/:id` | `connect.self` | deletes one of the person's own links |
| `GET /hooks/connect/calendar/<secret>.ics` | none: the secret is the check | the calendar file (`text/calendar`, RFC 5545: CRLF, folded at 75 octets, text escaped, timed items in UTC, all-day items as days) |
| `GET /hooks/connect/sheet/<secret>.csv` | none: the secret is the check | the CSV, cells that could start a formula quoted with `'` |

A link that opens nothing answers 404 with one plain sentence: make a new one on the Connect apps
page. Making a link is audited as `connect.calendar` or `connect.sheet` with its name, deleting it
as `connect.end`; reading one is not, but the link keeps when an app last read it.

## The logos

Slack, Discord, Google Chat, Google Calendar, Google Sheets, Zapier, Make and n8n show their own
one-colour mark from the Simple Icons project (CC0 data; each brand keeps its trademark), drawn in
the brand's colour on a white tile (`src/brands.ts`, the design system's one exception for logos).
Microsoft asked for its marks to be taken out of that project, so Teams, Outlook and Excel show a
plain icon in their colour. Apple Calendar shows a plain calendar icon. The page ends with one line
saying the names and logos belong to their owners, who do not endorse the portal.

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

- One press to connect Slack or Discord through their own sign-in, instead of pasting a link:
  the owner's next batch (2026-11-22).
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
search; the audit rows; folding and entries that do not read. Each store's `calendar()` and the
invoices' `csv()` have their own tests in their modules. The client template's screens test makes
a calendar and a spreadsheet link as the Owner, reads both with no sign-in, deletes one and sees
its address closed, and checks the chat refusals.
