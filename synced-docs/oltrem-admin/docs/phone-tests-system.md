---
title: "Phone tests owed: Backups and System status"
status: living
owner: vendor
last_verified: 2026-11-15
sources: [docs/phone-tests.md, which held the older lines until 2026-11-15; the records each line links]
---

# Phone tests owed: Backups and System status

> **In plain words.** The phone tests still owed on Home's backup step, the Backups page and
> System status, split from [Phone tests owed](phone-tests.md) on 2026-11-15 so each list stays
> small enough to read whole. They run the same way, and a passed or failed line moves to that
> list's "Passed" or "Failed, to fix" with the date.

## Owed

| # | Open | You should see | From |
|---|---|---|---|
| P880 | Admin, Scheduled jobs, on the phone and then a computer | One line at the top says whether the jobs are fine, a coloured bar with a segment a job, then Overview, All jobs, Timeline and History in a sideways row; nothing runs off the side | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P881 | Overview, then All jobs, then Timeline | Overview: Needs you, Up next, Just ran. All jobs: a section a part in its colour, one short row a job with its hours bar. Timeline: a row of hour cells for each job | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P882 | Open a job, press Run now, confirm | A green note says it ran and what it did, with its time and queries; History lists "Ran now" with your name | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P883 | The same job: Pause, pick A day, confirm | It shows Paused and "resumes by itself in 1 day"; Overview lists it under Needs you with Resume beside it; press Resume there | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P884 | A job's tabs: Runs, Schedule, Access, About | Schedule lists the next five runs and Run soon; Access lists the three permissions with which you have | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P885 | As someone whose role has only "View the scheduled jobs and check what waits for them" | No Run now or Pause buttons; one line names the permissions they need | [record](records/2026-11-25-scheduled-jobs-remade.md) |
| P55 | Home on a portal whose backups are set up but have no copy yet: press Make it now | "Started" at the bottom right; within minutes Backups lists the copy and the step is ticked (left alone, it starts by itself within a quarter of an hour) | [record](records/2026-11-03-easier-setup.md) |
| P150 | Settings, Modules, as the Vendor: switch **Nightly backup**, **Restore drill reminder** and **Daily seal** off and save | Saved; System status lists no backup or seal checks and no backup alert comes back; "Make a copy now" still works | [record](records/2026-11-12-quiet-portal.md) |
| P201 | Nightly backup off, then Home | Last backup reads Off, last, not counted; Get started has Hide | [record](records/2026-11-14-quiet-off-and-switches.md) |
| P227 | Nightly backup off, no copy yet: Home | Get started says Switch on backups, opening Backups; no Make it now, no drill step | [record](records/2026-11-14-backups-complete.md) |
| P228 | Backups | Database and Files as ticked rows, one Back up now; anything missing listed with its fix | [record](records/2026-11-14-backups-complete.md) |
| P229 | Backups: Database ticked, Back up now | Steps tick themselves every 5 s; the run ends "checksum matches what was sent" | [record](records/2026-11-14-backups-complete.md) |
| P230 | Backups: tick Files, Back up now, twice | "Copying files: N checked"; the second run copies only new files | [record](records/2026-11-14-backups-complete.md) |
| P231 | Backups: untick both, Back up now | Refused: Tick Database, Files or both | [record](records/2026-11-14-backups-complete.md) |
| P232 | System status between 00:00 and 01:00 UTC (7 to 8 PM in Toronto) | Each daily budget's note says a new day began and its first figure comes within the hour; State OK; no Needs a look for the budgets | [record](records/2026-11-15-backup-alerts-and-budgets-at-midnight.md) |
| P233 | Backups: Back up now with Database ticked, then Alerts once it ends ok | The "Error in flow backup.export" alert is resolved (the other backup alert closes itself after a day) | [record](records/2026-11-15-backup-alerts-and-budgets-at-midnight.md) |
| P248 | System status on the live portal | Requests Cloudflare stopped today reads 0, and neither CPU row makes State Failing | [record](records/2026-11-15-review-team-cpu-and-first-run.md) |
| P250 | System status: Worker CPU time per request, 95th percentile | Its figure alone, with a note about the first requests after a quiet spell | [record](records/2026-11-15-review-team-cpu-and-first-run.md) |
| P348 | Settings, Company, Web addresses to watch: add `https://` and your website, Save; open Admin, System, Status after 15 minutes | A Web addresses row in Services says your site answers, state OK | [record](records/2026-11-22-lighter-database.md) |
| P349 | Settings: add a second line, your website then ` \| ` and words that are not on its page; Status after two runs | The row fails, naming that address with "answered without" and the words, and an alert opens | [record](records/2026-11-22-lighter-database.md) |
| P350 | System status, Email lane | An Email services row says your service answers and accepts its key, checked hourly | [record](records/2026-11-22-lighter-database.md) |
| P351 | Audit log, Export, from a day more than 90 days ago (once the portal is that old) | The file still holds that day's rows | [record](records/2026-11-22-lighter-database.md) |
| P352 | Settings: remove the line of P349, Save; System status after the next run | The Web addresses row is OK again and the alert closes | [record](records/2026-11-22-lighter-database.md) |
| P353 | Privacy: open a request, Find their data | The audit part is titled "What they did in the portal, last 90 days" | [record](records/2026-11-22-lighter-database.md) |
| P510 | Open a shared file's link five times quickly | It opens every time | [record](records/2026-11-24-public-hooks-rest.md) |
| P511 | After the fleet key has Zone WAF Edit and the next push: Cloudflare, the portal's domain, Security, WAF, Rate limiting rules | One rule, `oltrem_hooks` | [record](records/2026-11-24-public-hooks-rest.md) |
| P529 | Settings, Company: the title reads Company time zone; set America/Mexico_City. After 6 PM there, make an invoice due today | It is taken, not refused as past | [record](records/2026-11-24-company-time-zone.md) |
| P540 | Admin, System, Audit log | Rows read as sentences under Today, Yesterday and dates, at your own clock's times; the summary line says how many entries and refused | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P541 | Audit log: type a person's name or a record's name in the search, press Enter | Only rows that mention it; the chips keep the search | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P542 | Audit log: tap 7 days, then People, then Refused | Each narrows the list; the summary line's count changes with it | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P543 | Audit log: tap a row that changed something (a role or a setting) | It opens to What changed with Before and After, then the entry; Everything they did lists only that person's rows | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P544 | Sign in twice, then open the Audit log | Your sign-ins are one row with "2 times" | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P545 | Users and access, Settings, on a computer | The Options card and the settings card each run the full width, every option with its words | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P546 | Integrations, Email services, a provider's setup, on a computer | The key steps and the paste form side by side, filling the width; on a phone, one under the other | [record](records/2026-11-24-audit-log-remade-and-full-width.md) |
| P547 | Users and access, Settings, on a computer, then on a phone | On a computer the setting cards sit side by side and fill the row, with no empty half; on a phone, one under another | [record](records/2026-11-24-layout-rules.md) |
| P548 | Users and access, Roles, open a role with special permissions, on a computer | The permission cards fill the row in as many columns as fit; a module alone takes the whole row | [record](records/2026-11-24-layout-rules.md) |
| P560 | A day after the next deploy: System status, Requests | The day's requests and failures, a column an hour, and the slowest routes | [record](records/2026-11-24-request-charts.md) |
| P652 | As an Owner with a bucket joined under Files, Storage: Backups, A second copy outside Cloudflare, pick it, Save, then Back up now | Saved; once the run ends, its row under Runs says a second copy was kept at that bucket and checked by size | [record](records/2026-11-24-backup-second-copy.md) |
| P565 | Admin, System, Audit log | Each row's section shows as a coloured dot and name, the colour of its group in the sidebar; refused rows have a red edge | [record](records/2026-11-24-audit-log-colour.md) |
| P566 | Sign out and in again, then open the Audit log | Your sign-in row names your browser in a few words, such as Chrome on Android | [record](records/2026-11-24-audit-log-colour.md) |
| P575 | Audit log on a phone | No label or fact breaks onto a new line inside its words (Tamper check, Chrome on Windows, 4 times); a fact that does not fit moves down whole | [record](records/2026-11-24-audit-log-colour.md) |
| P810 | Admin, System, Alerts, on a phone | One search, a Show row and a Kind row that scroll sideways, then one line on who is emailed; no big number boxes; each alert one row with a red or amber edge | [record](records/2026-11-25-alerts-page-remade.md) |
| P811 | Alerts: tap a row | It opens in place: What was seen, What to do, When, Who, Email, the key; Technical details folded; Copy puts the alert on the clipboard | [record](records/2026-11-25-alerts-page-remade.md) |
| P812 | Alerts: I am on it, then Let go, on one alert | It says you are on it, then Nobody on it again; Mine counts it while you hold it | [record](records/2026-11-25-alerts-page-remade.md) |
| P813 | Alerts: add a note, Save note | The row says Has a note; opened, it shows your note, your name and the time | [record](records/2026-11-25-alerts-page-remade.md) |
| P814 | Alerts: Mute emails, 7 days | The row says Emails muted; opened, Muted until a week from now; Unmute emails turns it back | [record](records/2026-11-25-alerts-page-remade.md) |
| P815 | Alerts: tick two open alerts, Mark resolved; then Resolved, tick them, Delete, confirm | Both move to Resolved with Resolved by you; Delete asks first, then both are gone | [record](records/2026-11-25-alerts-page-remade.md) |
| P816 | Sign in from another browser, then Alerts | The access alert opens and the person gets the email; no new "Check what you entered" alert | [record](records/2026-11-25-alerts-page-remade.md) |
| P780 | Admin, System, Audit log, When: 30 days | Under the count, a small chart with a column a day, red where something was refused; tap a column: only that day's rows, the count says that day, "Only Yesterday (show all)" returns | [record](records/2026-11-25-audit-log-days-and-words.md) |
| P781 | Sign in from a browser you have not used before, then open the Audit log | Your sign-in row says New browser in amber | [record](records/2026-11-25-audit-log-days-and-words.md) |
| P782 | Audit log, search for "approval" or "invoice" | Every row reads as a sentence; no row shows a dotted code like invoices.pay | [record](records/2026-11-25-audit-log-days-and-words.md) |
| P819 | On a computer, look at the sidebar, then press « and » to fold and open it | It is only as wide as its longest name, with no empty room after the names; it folds to icons and opens again | [record](records/2026-11-25-alerts-page-remade.md) |
| P820 | On a phone, open the menu | The drawer is as wide as its names, no wider | [record](records/2026-11-25-alerts-page-remade.md) |
| P821 | Tap Search (sidebar, folded icon or the phone bar's) with nothing typed | A pop-up over the page, not a new page: the box on top, then Opened last (or Go to), each row a coloured icon tile with the page's name over its section; key hints on a computer | [record](records/2026-11-25-alerts-page-remade.md) |
| P822 | Type set in the pop-up | Pages first, then what the portal finds (Settings, Roles), each with its section's icon; no Search everything row; tap one and the pop-up closes on that page | [record](records/2026-11-25-alerts-page-remade.md) |
| P823 | Press Ctrl K, then Esc; open it again and tap outside it | It opens and closes both ways; the page under it never changed | [record](records/2026-11-25-alerts-page-remade.md) |
| P824 | Open an old link to /search | It lands on Home | [record](records/2026-11-25-alerts-page-remade.md) |
| P825 | Files: search a folder for a word that is elsewhere, tap Search all of Files | The pop-up opens with the word already typed | [record](records/2026-11-25-alerts-page-remade.md) |
| P826 | Alerts: open an alert, on a computer and on a phone | What was seen and What to do as two tinted panels; When, Who, Email and The alert as lined-up columns, each headed in its own colour, every fact there; the note box and its button one height; one bar: I am on it, Mark resolved (solid), the Mute track, Copy at the end | [record](records/2026-11-25-alerts-page-remade.md) |
| P786 | Audit log, after the next deploy | Under the count, a row of signals: Refused, API key calls, Downloads, New places, each with a number; tap one: only those rows | [record](records/2026-11-25-audit-log-for-investigations.md) |
| P787 | Open any row you made today | Who and how shows your sign-in time; Where from shows Place (city, region, country) and Network; The entry shows a Fingerprint | [record](records/2026-11-25-audit-log-for-investigations.md) |
| P788 | Download a list as CSV (a list in Records, or a form's answers), then open the Audit log | A row "downloaded <file> from <section>" with the file named under it; open it: File and Size | [record](records/2026-11-25-audit-log-for-investigations.md) |
| P789 | Change a setting (for example a daily limit), then open its row | What changed: the old value muted, the new one in green | [record](records/2026-11-25-audit-log-for-investigations.md) |
| P790 | With an API key, call the portal once with a wrong secret (or ask the Vendor to) | A red row "Someone outside the portal was refused a call with the API key …", the reason in its words; tap Everything this API key did | [record](records/2026-11-25-audit-log-for-investigations.md) |
| P791 | Open a row, tap Everything from this address, then Everything from <network> | The log narrows to that address, then that network, with a "(show all)" to return | [record](records/2026-11-25-audit-log-for-investigations.md) |
