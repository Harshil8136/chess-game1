---
title: "@oltrem/connect: The page and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/connect/src; split from modules/connect/README.md]
---

# @oltrem/connect: The page and more

> Part of [the @oltrem/connect README](../README.md).

## The page

| Path | Shows |
|---|---|
| `/connect` | Connected (how many work and how many need a look as dots on its title line, then the rows, their health and actions, the databases of the data part among them); the filters; the cards by group, each app's logo a tile in its own colour with the mark in white (the name on its own line from 640 px); "Any other app". Every Connect is a pop-up on this page, never a page of its own: the chat and automation apps, the calendars and sheets, the analytics apps, the databases and "Any other database" (for whoever may connect one; anyone else gets the data part's page, which says why). A card already connected shows its health and how it is doing (its last delivery, use or check) and opens what is running: the webhook's page, the link's row, the database's page, or Connected when there are several; "Add another" sits under it |
| `/connect?show=chat` | the four chat cards and "Any other app"; a card's window, as numbered steps joined by a line: "Continue to Slack" and three steps when one-click is set up, otherwise (or under "Or paste a link instead") the steps with Open <app> on the first and the link on the one that says to paste it; the events and the name folded under Options; "Connect and send a test" |
| `/connect?show=calendar` | Google Calendar, Apple Calendar, Outlook and "Another calendar app"; a card's window makes that app's link; once made, the button that adds it to that app (Outlook.com and Outlook for work or school for Outlook) and the link to copy |
| `/connect?show=sheets` | Google Sheets and Excel; the window's row of lists, forms and invoices, then "Create the sheet in Google" (one-click) or "Create the link"; once made, the `=IMPORTDATA("…")` cell with "Open a new Google Sheet", or the Excel steps |
| `/connect?show=automate` | Zapier, Make, n8n and "Any other app" |
| `/connect?show=data` | the data services the providers part lists (kind `data`), each opening its pop-up (the data part's steps, Name and fields, posted to `/data/connect/<id>`; "Continue with Supabase" or Airtable first where the relay is set up), or once connected its connection's page; "Any other database" a pop-up with the paste box, posted to `/data/connect`. A refused key answers with the data part's page for it, with what was typed |
| `/connect?show=analytics` | PostHog, Plausible, Umami, Cloudflare Web Analytics, Google Analytics, Matomo and Fathom, each opening its pop-up, or once connected its page; greyed with "Ask an Owner" without `connect.analytics.manage`; no filter where the part is not mounted |
| `/connect/analytics/new/<app>` | what the app's pop-up posts to, and still a page for a link to it: the steps in the app with links to its pages, then Name and its fields, "Connect <app>". The pop-up holds the same, each step's link a button on its step; PostHog and Google Analytics, where the relay is set up, start with "Continue with <app>" (three numbered steps, the one main button) and fold the key under "Or connect with a key". A key refused from the pop-up answers with the Apps page, which opens the pop-up again with what was typed and the notice, never the key; from the page, the page. A sign-in that brings nothing back returns to Apps, Analytics, said there |
| `/connect/analytics/<id>` | the app, what it reads and its last check; the last 7 days (the figures with the change on the 7 days before, page views each day, top pages, sources and countries); "Change the key"; Check now, Open in <app> and Disconnect (asked first) beside the title. A sign-in app adds "Reconnect" (at the top when the last check failed) and folds the key under "Or use a key" |
| `/connect/back?confirm=1&p=<app>` | after signing in: "Signed in to <app>." and the projects or properties, each with Connect; Cancel ends the sealed cookie |
| `/connect/links` | Everyone's links, for `connect.links.manage`: the 200 most recently used, each with its person, its health and Delete (asked first); reached by "Links your team made" in the Calendar part of the page (and above the Calendar and Spreadsheets filters), no longer beside the title |
| `/connect/back` | one-click's way back: it redirects to the row made, the new sheet, or the page with why nothing was made; for Supabase it shows "Pick a Supabase project" or "Connect <project>?", and for Airtable "Connect Airtable?", whose Connect posts to `/connect/back` ("Supabase, for the data part", "Airtable, for the data part") |

## The logos

Slack, Discord, Google Chat, Google Calendar, Google Sheets, Zapier, Make, n8n, PostHog, Plausible,
Umami, Cloudflare, Google Analytics, Matomo and Fathom show their own
one-colour mark from the Simple Icons project (CC0 data; each brand keeps its trademark), drawn in
the brand's colour on the logo tile (`src/brands.ts`, the design system's one exception for logos):
white in the light theme, clear in the dark one, where a brand colour too dark to see
(Slack's, Make's) is drawn in the text colour; Apple Calendar's icon is a grey that reads on both (`inkOf`, `@oltrem/core-ui`). Zapier
shows its asterisk, drawn here, since the project's mark is its badge with an unreadable name.
Microsoft asked for its marks to be taken out of that project, so Teams, Outlook and Excel show a
plain icon in their colour. Apple Calendar, "Another calendar app", the spreadsheet rows and "Any
other app" show a plain icon. The page ends with one line saying the names and logos belong to
their owners and only show which app a card connects to.

## Reads too often

A link read more than 60 times in ten minutes in one Worker isolate is refused (`KIT-E-0429`) for
the rest of those ten minutes (`LIMITS.reads`, `LIMITS.readWindow`), before the database is asked:
a calendar app or a sheet reads about once an hour, so only a leaked address read in a loop meets
it, and it cannot spend the portal's free allowance. Each refusal is still logged.

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

- Sign in for Plausible, Umami, Cloudflare, Matomo and Fathom: none of them offers it to an app
  today, so they keep the key.
- One-click for Microsoft Teams, Google Chat, Excel, Zapier and Make (see "One-click sign-in").
- Calendar items from modules other than bookings, shifts, time off and tasks.
- A Google Sheet's Google account named before its link is written. Today the way back only
  finishes in the browser that started it (the trip's cookie), so another person's account can
  own the sheet only if someone opens a stranger's return address within the ten minutes; a
  confirm step naming the account would close even that. An Owner sees and deletes any such
  link under Everyone's links.

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
(`test/pages.test.ts`). Website analytics (`test/analytics.test.ts`): each app's answer read into
one report, Umami's older answers and Cloudflare's missing window before, Google's token checked
against the account's public key, Matomo's one request with a part switched off, Fathom never
past five calls at once, a refusal in plain
words with the fix only where a key fixes it, a report kept and read again at once after a new
key; through the pipeline, the routes behind `connect.analytics.manage`, connecting, a second
connection of the same site and an address of another shape refused, no key shown back, a new key
checked, a check pressed twice calling once, `web` for the Analytics page, removing. The Analytics
cards, locked or absent, and the connect and connection pages (`test/pages.test.ts`). Sign in
with (`test/analytics.test.ts`): the fields a sign-in fills never listed or typed; PostHog signed in
across both regions with a renewal before a read, a client of another relay refused, a key pasted
dropping the tokens; Google's refused renewal said as "sign in again", Home's line, signing in
again into the same connection, and the daily job; the Connect page with Sign in first and the key
folded, and the way back through the pick page to the connection (`test/pages.test.ts`). The Custom card's guess from each
app's address, the links it refuses and an app's own page pasted by mistake
(`test/detect.test.ts`). Each store's `calendar()` and the invoices' `csv()` have their own tests
in their modules. The client template's screens test makes a calendar and a spreadsheet link as
the Owner, reads both with no sign-in, sees a filter list only its own rows, deletes the links and
sees an address closed, makes a link for two calendar apps, checks the chat and Custom refusals;
and, with the relay set, one-click on the page: the buttons shown, Continue's 303 to the relay
with its cookie, the way back refused for another person, cancelled, then made into the alert with
a test sent and the cookie cleared, and a pasted link sent with Enter taken as the link.
