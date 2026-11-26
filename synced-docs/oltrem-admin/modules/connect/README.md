# @oltrem/connect

Apps: the portal's work in the apps people already use, set up by someone with no technical
background. One page, from the top:

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
- **Analytics.** The website analytics app the company already counts its visitors with:
  PostHog, Plausible, Umami (Cloud or its own server), Cloudflare Web Analytics, Google Analytics
  4, Matomo (Cloud or its own server) or Fathom, connected with a read-only key, or for PostHog and
  Google Analytics by signing in (below, "Website analytics"). Its figures feed the Analytics page.
- **Any other app.** Paste any webhook link: the portal works out which app it is from the address
  (`src/detect.ts`) and sends the chat's line or the signed standard webhook. A link that cannot
  work (a retired Teams connector, a Slack Workflow link, n8n's test address) is refused with what
  to paste instead.

Each card's window has an "Open <app>" button where the app has a page to start from, the steps,
the link checked before anything is sent, the events in words (eight ticked) and an optional name.
Chat alerts and automations are the Developer module's webhooks, made through its API as the
signed-in person: who may make them is decided there. Calendar and spreadsheet links are this
module's.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; Who may do what; A link; One-click sign-in |
| [website-analytics](docs/website-analytics.md) | Website analytics |
| [page](docs/page.md) | The page; The logos; Reads too often; What is logged; Tables; Personal data; Errors; Not here yet; Tests |
