---
title: "Phone tests owed: the Apps page"
status: living
owner: vendor
last_verified: 2026-11-25
sources: [docs/records/2026-11-22-apps-page-and-one-click-connect.md; docs/records/2026-11-23-apps-logs-connected-look.md; docs/records/2026-11-24-everyones-links.md; modules/connect/README.md; modules/developer/README.md]
---

# Phone tests owed: the Apps page

> **In plain words.** The phone tests still owed on Admin, Integrations, Apps, moved here from
> [the flows list](phone-tests-flows.md) on 23 November so each list stays small enough to read
> whole. They run the same way, and a passed or failed line moves to
> [Phone tests owed](phone-tests.md)'s "Passed" or "Failed, to fix" with the date.

### The Apps page and one-click connect, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P376 | Admin, Integrations, Apps | Connected on top when anything is; then All, Chat, Calendar, Spreadsheets, Automation in a sideways row; every app a card with its state on the right (Connect, Add, Create, or how it is doing) | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P377 | Slack, after the relay is set up: Continue to Slack, pick a channel, Allow | Back on Apps, "Slack is connected. A test was sent"; the row is marked for a moment; the test line is in the channel | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P378 | Discord the same way; then press Cancel on Discord's page instead of Authorize | First: connected, the test arrives. Then: "You cancelled on the app’s page, so nothing was connected" | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P379 | Spreadsheets, Google Sheets, pick a list, Create the sheet in Google | Google asks for your account; a new Google Sheet opens with the list filling in; Connected lists it | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P380 | Any other app; paste a Zapier, Make or n8n link (or a Slack Incoming Webhook) | Connected names the app it worked out (Zapier automation, Slack alerts); a Slack Workflow link is refused with what to paste instead | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P381 | A row under Connected: Send test, Pause, Turn on, Delete | Each says what it did; Paused shows a grey dot; Delete asks first | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P382 | Calendar, Outlook, Create my link; then Google Calendar | Outlook's panel offers Outlook.com and work or school; Google's link is a second one, and both rows are listed | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P383 | As a person without the Developer permission | The chat and automation cards are greyed with "Ask an Owner"; Calendar still works | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P384 | Apps, tap Chat, then Calendar | The filter row is near the top; Connected shows only that filter's rows | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |
| P385 | Any other app; paste the address of a Slack channel page (app.slack.com/…) | Refused: it says this is a Slack page and where the webhook link is | [record](records/2026-11-22-apps-page-and-one-click-connect.md) |

### The Apps page: logos, what is running, logs, 23 November

| # | Open | You should see | From |
|---|---|---|---|
| P468 | Admin, Integrations, Apps with the phone in dark mode | Every logo sits on the card with a thin outline, none on a bright white square; Slack and Make are drawn light, Apple Calendar in grey; Zapier shows its orange asterisk | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P469 | The same page in light mode | The logos on white tiles, in their own colours, as before | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P470 | With Airtable connected: the Airtable card | It shows Working (or Not answering) with the base's name, how fast it answered and when; tapping it opens that database's page, not Connect. "Add another" under it opens the Airtable connect page | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P471 | Connected, at the top | One line such as "2 working, 1 needs a look"; the Airtable base is listed among the rows and opens its page | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P472 | A Zapier or Slack card with one connection; then a calendar card with a link made | The card shows that connection's last delivery and opens its page; the calendar card scrolls to its row under Connected | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P473 | Open a calendar link in another app (or a browser), then System, Audit log | A row "connect.received" for that link: its name, whose it is, how many events, the address it came from; the link's own address is not in it | [record](records/2026-11-23-apps-logs-connected-look.md) |
| P474 | A connected database's page, open a table; then the Audit log | A row "data.read-connections-rows" naming the database, with no rows or search words in it | [record](records/2026-11-23-apps-logs-connected-look.md) |

### Everyone's links, 24 November

| # | Open | You should see | From |
|---|---|---|---|
| P512 | As an Owner, Admin, Integrations, Apps | "Everyone's links" beside the title; it lists every calendar and spreadsheet link, whose it is and when it was last used | [record](records/2026-11-24-everyones-links.md) |
| P513 | Delete on someone else's link, then Delete link | It asks first, then says the link is deleted; the list no longer has it, and the Audit log has "connect.end" naming whose it was | [record](records/2026-11-24-everyones-links.md) |
| P514 | As a person without that permission, Apps | No "Everyone's links" button; their own links still under Connected | [record](records/2026-11-24-everyones-links.md) |

### A stopped chat alert on Home, 25 November

| # | Open | You should see | From |
|---|---|---|---|
| P797 | Connect a Slack or Discord alert, then delete the channel or the app's link at the other end; wait for the next change in the portal; then Home | Under Needs you: "<name> is failing", which opens the alert's page; after ten failures in a row it reads "<name> stopped sending" | [Developer](../modules/developer/README.md) |
| P798 | The same Home, as someone who cannot keep the webhooks | No such line | [Developer](../modules/developer/README.md) |
| P895 | Admin, Developer, open a webhook that has deliveries | Above the deliveries: the share delivered, how many wait, the typical and slowest answer | [Developer](../modules/developer/README.md) |
| P896 | The same, for a webhook whose last delivery failed (for example a wrong address) | A notice with when it failed, the answer, and what to do, such as checking the address in Settings | [Developer](../modules/developer/README.md) |
