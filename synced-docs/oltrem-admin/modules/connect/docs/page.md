---
title: "@oltrem/connect: the page, logos, logging, tables, errors, tests"
status: living
owner: vendor
last_verified: 2026-11-28
sources: [modules/connect/src/pages.tsx, brands.ts, module.ts, links.ts]
---

# @oltrem/connect: the page, logos, logging, tables, errors, tests

> Part of [the @oltrem/connect README](../README.md).

## The page

Every Connect is a pop-up on `/connect`, never a page of its own. Since 2026-11-28 (the UX laws): a
find box beside the kinds hides the cards that do not match and offers Any other app when none
does; each card is one row (its logo on its colour, name, a line, and the same pill: Connect, Add,
Create or Continue), its edge in the app's colour under the pointer. A connected card has that
edge, a health dot on its logo and its state, opens what runs (the webhook's page, the link's row,
the database, or Connected when several), with "Add another" under it. Connected lists what fails
first, then what waits, then what works.

| Path | Shows |
|---|---|
| `/connect` | The find box and the kinds, Connected (its counts on its title), the cards by kind under headings in the kind's colour, "Any other app" |
| `?show=chat` | Four chat cards; a window of numbered steps: "Continue to Slack" when one-click is set, else (or under "Or paste a link instead") the steps with Open <app> and the link; events and name under Options; "Connect and send a test" |
| `?show=calendar` | Google, Apple, Outlook, "Another calendar app"; once made, the button that adds it (Outlook.com, or work or school) and the link to copy |
| `?show=sheets` | Google Sheets and Excel: lists, forms and invoices, then "Create the sheet in Google" or "Create the link"; the `=IMPORTDATA("…")` cell or the Excel steps |
| `?show=automate` | Zapier, Make, n8n, "Any other app" |
| `?show=data` | The data services (kind `data`), each a pop-up posted to `/data/connect/<id>` ("Continue with Supabase" or Airtable first where the relay is set), or its connection's page; "Any other database" posted to `/data/connect`. A refused key answers with the data part's page and what was typed |
| `?show=analytics` | The seven analytics apps, greyed without `connect.analytics.manage`, absent where the part is not mounted |
| `/connect/analytics/new/<app>` | What the pop-up posts to, also a page: steps, name and fields; PostHog and Google start with "Continue with <app>". A refused key reopens the pop-up with what was typed, never the key |
| `/connect/analytics/<id>` | What it reads, the last check, the last 7 days (figures against the week before, views a day, top pages, sources, countries); Change the key, Check now, Open in <app>, Disconnect (asked first), and Full view (the app's full view on Reports); a sign-in app adds Reconnect (on top after a failed check) |
| `/connect/links` | Everyone's links for `connect.links.manage`: the 200 most recently used, whose, health, Delete (asked first); linked as "Links your team made" |
| `/connect/back` | One-click's way back: to the row made, the new sheet, or why nothing was made; for Supabase "Pick a Supabase project" or "Connect <project>?", for Airtable "Connect Airtable?"; `?confirm=1&p=<app>` lists the analytics sites to connect |

## The logos

Simple Icons marks (CC0; each brand keeps its trademark) in the brand's colour (`src/brands.ts`, the
design system's one exception); on a row, a mark too dark for the dark theme takes the text colour
(`inkOf`). Microsoft removed its marks, so Teams, Outlook and Excel show a plain icon in their
colour, as do Apple Calendar and the generic cards. One line says names and logos belong to their
owners.

## Logging, tables, personal data, errors

- **Audit.** Each read of a calendar or sheet link is `connect.received` (through `onHook`): the
  link's id, name, owner, events or rows sent, caller's address and bytes; never the address. Page
  changes go through `onChange`.
- **Table.** Migration `0073_connect.sql`: `connect_links` (company, person, kind, source, name,
  secret's hash, made, last read), indexed by hash and person. No secret is kept.
- **Personal data** (`personal`): each link's kind, name, made and last read.
- **Errors.** None of its own: a kind or source the person may not make is `KIT-E-0422`, a sheet
  without `connect.share` `KIT-E-0403`, another's link `KIT-E-0404`, too many reads `KIT-E-0429`.

## Not built yet

- Sign in for Plausible, Umami, Cloudflare, Matomo and Fathom (none offers it to an app).
- One-click for Teams, Google Chat, Excel, Zapier and Make.
- Calendar items beyond bookings, shifts, time off and tasks.
- Naming a Google Sheet's account before its link is written: the way back finishes only in the
  browser that started it, so another account could own a sheet only if someone opened a
  stranger's return address within ten minutes. An Owner sees and deletes any link.

## Tests

| File | What it proves |
|---|---|
| `test/connect.test.ts` | The manifest; who may link what; a calendar link shown once, hashed, escaped, read hourly, one per app; refused when guessed, of the other kind, blocked, signed out, switched off, deleted or 90 days unread; sheets read as the person and closed with their list; the 20-link limit; privacy and audit. One-click: the trip and its sealed answers, every refusal, the link written once on return |
| `test/analytics.test.ts` | Each app's answer into one report; refusals in plain words; the routes behind the permission, duplicates refused, no key shown back; sign-in (PostHog's regions and renewal, Google's refusal, another relay refused); Home's line; the daily job |
| `test/pages.test.ts` | The Data and Analytics cards drawn, locked or absent; the find box, each card's filter words, colour and spoken press; Connected failing first; the connect and connection pages; the way back through the pick page |
| `test/detect.test.ts` | The Custom card's guess from each address, the links refused, an app's own page pasted by mistake |

Each store's `calendar()` and the invoices' `csv()` are tested in their modules; the template's
screens test walks a calendar and a sheet link, and one-click with the relay set.
