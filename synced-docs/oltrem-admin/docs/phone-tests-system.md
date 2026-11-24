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
