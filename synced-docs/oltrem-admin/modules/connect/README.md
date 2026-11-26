# @oltrem/connect

Apps (`/connect`): the portal's work in the apps people already use, set up with no technical
background. One page: **Connected** (each link with its logo, health and Send test, Pause or Turn
on, Delete), then every app as a card under a sideways row of filters.

| Filter | What it connects |
|---|---|
| Chat | A line in a Slack, Microsoft Teams, Discord or Google Chat channel per event; Slack and Discord in one press through the Vendor's relay, any of them by a pasted webhook link |
| Calendar | The person's bookings, shifts, days off and tasks' due days in Google Calendar, Apple Calendar, Outlook or any other app, a link each |
| Spreadsheets | A list, a form's answers or the invoices in Google Sheets (created in the person's Drive with one-click) or Excel |
| Automation | Each event starts a Zapier, Make or n8n flow |
| Data | Where the data part is mounted and readable: its services, opening its `/data/connect/` pages; Supabase and Airtable sign in through the relay |
| Analytics | PostHog, Plausible, Umami, Cloudflare Web Analytics, Google Analytics 4, Matomo or Fathom, by a read-only key or (PostHog, Google) by signing in; feeds the Analytics page |
| Any other app | A pasted webhook link, its app worked out from the address (`src/detect.ts`); a link that cannot work (a retired Teams connector, a Slack Workflow link, n8n's test address) is refused with what to paste instead |

A card not the person's to connect is greyed with "Ask an Owner". Each window has **Open <app>**,
the steps, the link checked before anything is sent, the events (eight ticked) and an optional
name. Chat alerts and automations are the Developer module's webhooks, made through its API as the
person; calendar and spreadsheet links are this module's.

## Contents

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; who may do what; a link; one-click sign-in; Supabase and Airtable for the data part |
| [website-analytics](docs/website-analytics.md) | Website analytics; signing in with PostHog or Google |
| [page](docs/page.md) | The page; the logos; logging, tables, personal data, errors; not built yet; tests |
