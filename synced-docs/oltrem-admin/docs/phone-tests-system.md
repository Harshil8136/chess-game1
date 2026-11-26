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

From [record](../archive/records/2026-11-26-scheduled-jobs-side-panel.md):

| # | Open | You should see |
|---|---|---|
| P960 | Admin, Scheduled jobs, on the phone and then a computer | One strip of four tiles at the top (Jobs, Last 24 hours, Next tick, Plan allowance), each with a coloured icon and a green or red line at its foot; Up next and Just ran in their own boxes; each job a row with a coloured pill and an arrow |
| P961 | Tap anywhere on a job's row | The row lights up and the job opens in a panel from the right (the whole screen on a phone), the list still behind it; X, Escape or a tap outside closes it |
| P965 | In the panel: its tabs, then Run now and confirm, then Open as a page | The tabs change inside the panel; after Run now a green note shows in the panel; Open as a page opens the job's full page |

From [record](../archive/records/2026-11-26-scheduled-jobs-panel-polish.md):

| # | Open | You should see |
|---|---|---|
| P966 | On a computer, open a job, press J and K, then the arrows under its name; on the phone, open a job and swipe sideways inside the panel | J or the down arrow opens the next job, K or the up arrow the one before, the open job's row is tinted in the list; the panel never moves left or right, and its tabs stay at its top while it scrolls |

From [record](../archive/records/2026-11-26-scheduled-jobs-notes-and-pause-all.md):

| # | Open | You should see |
|---|---|---|
| P967 | Scheduled jobs: Pause all, pick 1 hour, write a reason, confirm; then Resume all | A green note says every running job is paused, Resume all shows how many; after Resume all every job is back and History lists each change with the reason in quotes |
| P968 | Open a job, Run now with a reason; then Pause it with a reason | The reason shows under the change in Runs and in History; the paused job's card says "Why:" with it |
| P969 | Watch Next tick on the Overview, and a job due within the hour | The seconds count down without a reload, and roll on to the next minute after 0 |

From [record](../archive/records/2026-11-26-scheduled-jobs-panes.md):

| # | Open | You should see |
|---|---|---|
| P962 | All jobs | A box for each part with its letter in the part's colour; each job's row shows its schedule, last run, next run and a thin strip of its last 24 hours |
| P963 | A job's page: Run now, confirm; then Pause for a day, then Resume | A card in the part's colour at the top with the buttons; a green note after Run now; the pill turns amber "Paused" and back |
| P964 | The job's tabs: Overview, Runs, Schedule, Access, About | Every tab's content in boxes with a coloured icon; Runs and Access show coloured pills |

From [record](../archive/records/2026-11-03-easier-setup.md):

| # | Open | You should see |
|---|---|---|
| P55 | Home on a portal whose backups are set up but have no copy yet: press Make it now | "Started" at the bottom right; within minutes Backups lists the copy and the step is ticked (left alone, it starts by itself within a quarter of an hour) |

From [record](../archive/records/2026-11-12-quiet-portal.md):

| # | Open | You should see |
|---|---|---|
| P150 | Settings, Modules, as the Vendor: switch **Nightly backup**, **Restore drill reminder** and **Daily seal** off and save | Saved; System status lists no backup or seal checks and no backup alert comes back; "Make a copy now" still works |

From [record](../archive/records/2026-11-14-quiet-off-and-switches.md):

| # | Open | You should see |
|---|---|---|
| P201 | Nightly backup off, then Home | Last backup reads Off, last, not counted; Get started has Hide |

From [record](../archive/records/2026-11-14-backups-complete.md):

| # | Open | You should see |
|---|---|---|
| P227 | Nightly backup off, no copy yet: Home | Get started says Switch on backups, opening Backups; no Make it now, no drill step |
| P228 | Backups | Database and Files as ticked rows, one Back up now; anything missing listed with its fix |
| P229 | Backups: Database ticked, Back up now | Steps tick themselves every 5 s; the run ends "checksum matches what was sent" |
| P230 | Backups: tick Files, Back up now, twice | "Copying files: N checked"; the second run copies only new files |
| P231 | Backups: untick both, Back up now | Refused: Tick Database, Files or both |

From [record](../archive/records/2026-11-15-backup-alerts-and-budgets-at-midnight.md):

| # | Open | You should see |
|---|---|---|
| P232 | System status between 00:00 and 01:00 UTC (7 to 8 PM in Toronto) | Each daily budget's note says a new day began and its first figure comes within the hour; State OK; no Needs a look for the budgets |
| P233 | Backups: Back up now with Database ticked, then Alerts once it ends ok | The "Error in flow backup.export" alert is resolved (the other backup alert closes itself after a day) |

From [record](../archive/records/2026-11-15-review-team-cpu-and-first-run.md):

| # | Open | You should see |
|---|---|---|
| P248 | System status on the live portal | Requests Cloudflare stopped today reads 0, and neither CPU row makes State Failing |
| P250 | System status: Worker CPU time per request, 95th percentile | Its figure alone, with a note about the first requests after a quiet spell |

From [record](../archive/records/2026-11-22-lighter-database.md):

| # | Open | You should see |
|---|---|---|
| P348 | Settings, Company, Web addresses to watch: add `https://` and your website, Save; open Admin, System, Status after 15 minutes | A Web addresses row in Services says your site answers, state OK |
| P349 | Settings: add a second line, your website then ` \| ` and words that are not on its page; Status after two runs | The row fails, naming that address with "answered without" and the words, and an alert opens |
| P350 | System status, Email lane | An Email services row says your service answers and accepts its key, checked hourly |
| P351 | Audit log, Export, from a day more than 90 days ago (once the portal is that old) | The file still holds that day's rows |
| P352 | Settings: remove the line of P349, Save; System status after the next run | The Web addresses row is OK again and the alert closes |
| P353 | Privacy: open a request, Find their data | The audit part is titled "What they did in the portal, last 90 days" |

From [record](../archive/records/2026-11-24-public-hooks-rest.md):

| # | Open | You should see |
|---|---|---|
| P510 | Open a shared file's link five times quickly | It opens every time |
| P511 | After the fleet key has Zone WAF Edit and the next push: Cloudflare, the portal's domain, Security, WAF, Rate limiting rules | One rule, `oltrem_hooks` |

From [record](../archive/records/2026-11-24-company-time-zone.md):

| # | Open | You should see |
|---|---|---|
| P529 | Settings, Company: the title reads Company time zone; set America/Mexico_City. After 6 PM there, make an invoice due today | It is taken, not refused as past |

From [record](../archive/records/2026-11-24-audit-log-remade-and-full-width.md):

| # | Open | You should see |
|---|---|---|
| P540 | Admin, System, Audit log | Rows read as sentences under Today, Yesterday and dates, at your own clock's times; the summary line says how many entries and refused |
| P541 | Audit log: type a person's name or a record's name in the search, press Enter | Only rows that mention it; the chips keep the search |
| P542 | Audit log: tap 7 days, then People, then Refused | Each narrows the list; the summary line's count changes with it |
| P543 | Audit log: tap a row that changed something (a role or a setting) | It opens to What changed with Before and After, then the entry; Everything they did lists only that person's rows |
| P544 | Sign in twice, then open the Audit log | Your sign-ins are one row with "2 times" |
| P545 | Users and access, Settings, on a computer | The Options card and the settings card each run the full width, every option with its words |
| P546 | Integrations, Email services, a provider's setup, on a computer | The key steps and the paste form side by side, filling the width; on a phone, one under the other |

From [record](../archive/records/2026-11-24-layout-rules.md):

| # | Open | You should see |
|---|---|---|
| P547 | Users and access, Settings, on a computer, then on a phone | On a computer the setting cards sit side by side and fill the row, with no empty half; on a phone, one under another |
| P548 | Users and access, Roles, open a role with special permissions, on a computer | The permission cards fill the row in as many columns as fit; a module alone takes the whole row |

From [record](../archive/records/2026-11-24-request-charts.md):

| # | Open | You should see |
|---|---|---|
| P560 | A day after the next deploy: System status, Requests | The day's requests and failures, a column an hour, and the slowest routes |

From [record](../archive/records/2026-11-24-backup-second-copy.md):

| # | Open | You should see |
|---|---|---|
| P652 | As an Owner with a bucket joined under Files, Storage: Backups, A second copy outside Cloudflare, pick it, Save, then Back up now | Saved; once the run ends, its row under Runs says a second copy was kept at that bucket and checked by size |

From [record](../archive/records/2026-11-24-audit-log-colour.md):

| # | Open | You should see |
|---|---|---|
| P565 | Admin, System, Audit log | Each row's section shows as a coloured dot and name, the colour of its group in the sidebar; refused rows have a red edge |
| P566 | Sign out and in again, then open the Audit log | Your sign-in row names your browser in a few words, such as Chrome on Android |
| P575 | Audit log on a phone | No label or fact breaks onto a new line inside its words (Tamper check, Chrome on Windows, 4 times); a fact that does not fit moves down whole |

From [record](../archive/records/2026-11-25-alerts-page-remade.md):

| # | Open | You should see |
|---|---|---|
| P810 | Admin, System, Alerts, on a phone | One search, a Show row and a Kind row that scroll sideways, then one line on who is emailed; no big number boxes; each alert one row with a red or amber edge |
| P811 | Alerts: tap a row | It opens in place: What was seen, What to do, When, Who, Email, the key; Technical details folded; Copy puts the alert on the clipboard |
| P812 | Alerts: I am on it, then Let go, on one alert | It says you are on it, then Nobody on it again; Mine counts it while you hold it |
| P813 | Alerts: add a note, Save note | The row says Has a note; opened, it shows your note, your name and the time |
| P814 | Alerts: Mute emails, 7 days | The row says Emails muted; opened, Muted until a week from now; Unmute emails turns it back |
| P815 | Alerts: tick two open alerts, Mark resolved; then Resolved, tick them, Delete, confirm | Both move to Resolved with Resolved by you; Delete asks first, then both are gone |
| P816 | Sign in from another browser, then Alerts | The access alert opens and the person gets the email; no new "Check what you entered" alert |
| P819 | On a computer, look at the sidebar, then press « and » to fold and open it | It is wide enough that the portal's name, its line and your address read in full, never squeezed; it folds to icons and opens again |
| P820 | On a phone, open the menu, then tap your name at the foot | The drawer keeps its full width; the menu above your name shows the full email, Look and colours in full, every colour dot (wrapping to a second line if needed) and all three theme buttons inside it |
| P821 | Tap Search (sidebar, folded icon or the phone bar's) with nothing typed | A pop-up over the page, not a new page: the box on top, then Opened last (or Go to), each row a coloured icon tile with the page's name over its section; key hints on a computer |
| P822 | Type set in the pop-up | Pages first, then what the portal finds (Settings, Roles), each with its section's icon; no Search everything row; tap one and the pop-up closes on that page |
| P823 | Press Ctrl K, then Esc; open it again and tap outside it | It opens and closes both ways; the page under it never changed |
| P824 | Open an old link to /search | It lands on Home |
| P825 | Files: search a folder for a word that is elsewhere, tap Search all of Files | The pop-up opens with the word already typed |
| P826 | Alerts: open an alert, on a computer and on a phone | What was seen and What to do as two tinted panels; When, Who, Email and The alert as lined-up columns, each headed in its own colour, every fact there; the note box and its button one height; one bar: I am on it, Mark resolved (solid), the Mute track, Copy at the end |
| P841 | Alerts: look at a row before opening it | Severity and kind on top (CRITICAL · ACCOUNT ACCESS), the title, then Open or Resolved and Unassigned or Assigned to you; the time ends in your zone's short name (EST, IST) |
| P842 | Open an alert | Observed activity and Recommended response; Timing, Ownership, Notifications, Classification with plain grey headings; times in your zone with its name; Technical details folded, and opened it gives the event fingerprint with a copy button and both times in UTC |
| P843 | Open a sign-in from a new place alert | Recommended response says what to do if it was them and if it was not, with Open Users and Sign-in history links that open those pages |
| P844 | Tap Resolve incident, pick Other and press Resolve with no words; then type a few words and Resolve | First: refused, asking for a few words. Then: resolved; under Resolved the row and its Ownership show "Other: your words" |
| P845 | Write an internal note in the full-width box, Save note; then Remove note | The note shows with your name and time; removed, it is gone. An empty box cannot be saved |
| P846 | Tick two alerts | A bar appears at the foot: Selected: 2, Assign selected to me, Resolve selected (asks why, optional), Clear selection; Clear selection unticks both and the bar goes |
| P847 | Mute emails for this alert for 1 day; then Unmute | It reads Emails muted until (date and zone) with Unmute; unmuted, the 1, 7, 30 days track is back. Above the list: Email notifications, Quiet hours, Resolved alerts kept 90 days, Times shown in, Edit notification settings |
| P848 | Open a page inside a section, such as a table in Data, and a page with figures, such as Home | Above the title one link with a back arrow (‹ Data), no lone chevron; every figure reads label then number (Open 3) |
| P849 | On a computer, rest the pointer on the bell at the top right | A tooltip says Notifications, with how many are unread when some are; the count stays on the bell's corner |
| P850 | Alerts on a phone and a computer: look at the tick boxes | Each box sits clear of the row's coloured edge, which runs down the whole row, open or closed |
| P851 | Open a sign-in alert on a computer | It fits one screen: the two panels, the facts in one band of label and value, Technical details folded, the note one box beside Add note, and the action bar |

From [record](../archive/records/2026-11-25-audit-log-days-and-words.md):

| # | Open | You should see |
|---|---|---|
| P780 | Admin, System, Audit log, When: 30 days | Under the count, a small chart with a column a day, red where something was refused; tap a column: only that day's rows, the count says that day, "Only Yesterday (show all)" returns |
| P781 | Sign in from a browser you have not used before, then open the Audit log | Your sign-in row says New browser in amber |
| P782 | Audit log, search for "approval" or "invoice" | Every row reads as a sentence; no row shows a dotted code like invoices.pay |

From [record](../archive/records/2026-11-25-audit-log-for-investigations.md):

| # | Open | You should see |
|---|---|---|
| P786 | Audit log, after the next deploy | Under the count, a row of signals: Refused, API key calls, Downloads, New places, each with a number; tap one: only those rows |
| P787 | Open any row you made today | Who and how shows your sign-in time; Where from shows Place (city, region, country) and Network; The entry shows a Fingerprint |
| P788 | Download a list as CSV (a list in Records, or a form's answers), then open the Audit log | A row "downloaded <file> from <section>" with the file named under it; open it: File and Size |
| P789 | Change a setting (for example a daily limit), then open its row | What changed: the old value muted, the new one in green |
| P790 | With an API key, call the portal once with a wrong secret (or ask the Vendor to) | A red row "Someone outside the portal was refused a call with the API key …", the reason in its words; tap Everything this API key did |
| P791 | Open a row, tap Everything from this address, then Everything from <network> | The log narrows to that address, then that network, with a "(show all)" to return |
