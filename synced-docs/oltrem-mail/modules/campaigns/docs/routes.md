---
title: "@oltrem/campaigns: routes, health, the warm-up, tables, settings"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src/module.ts, campaigns.ts, modules/campaigns/migrations]
---

# @oltrem/campaigns: routes, health, the warm-up, tables, settings

> Part of [the @oltrem/campaigns README](../README.md).

## The routes

Under `/api/campaigns`. `:id/` stands for `/campaigns/:id/`.

| Routes | Capability | What they do |
| --- | --- | --- |
| `GET /places` | `campaigns.write` | Where the person may start one |
| `GET /campaigns?status=&archived=`, `GET /campaigns/:id`, `GET :id/recipients?status=` | `campaigns.read` | The list; one with counts, today, preview, what is missing, `files`, `withoutFile`; its first 100 people |
| `POST /campaigns`, `PATCH /campaigns/:id`, `DELETE /campaigns/:id`, `POST :id/list` (CSV body), `POST :id/test` | `campaigns.write` | A draft, its fields and sender (`campaigns.send` once sending), deleting, its file, a test |
| `POST :id/files?name=&mode=` (`everyone` or `each`), `DELETE :id/files/:fileId` | `campaigns.write` | A draft's files |
| `POST :id/list/add` (CSV, or `typed=1&confirm=1`), `POST :id/use-list` (`listId`, `add`), `POST :id/remove-people` (`emails`), `GET :id/suggestions` | `campaigns.write` | Adding people, a saved list, taking off waiting people, suggestions `{ items }` |
| `POST :id/fields` (`column`, `fallback` per field) | `campaigns.write` (`.send` while paused) | **Personalization** |
| `GET :id/sample?blank=`, `GET /template` | `campaigns.read` | The sample CSV; `campaign-list-template.csv` |
| `POST /campaigns/remove-blank`, `POST /campaigns/archive-finished`, `POST :id/archive`, `POST :id/unarchive` | `campaigns.write` | Tidying (answers `removed`, `archived`) |
| `POST :id/pace` (`perRun`, `dailyCap`, `hours`) | `campaigns.write` (`.send` once running) | Pace and hours |
| `GET :id/live`, `GET /room`, `GET :id/report` | `campaigns.read` | Progress from one row; room today; by mailbox provider |
| `GET :id/download` | `campaigns.send` | `<name>-results.csv`, audited |
| `POST :id/run` | `campaigns.run` | Answers `ran`, `busy` or `held` |
| `POST :id/start` (`at`), `/unschedule`, `/pause`, `/resume`, `/cancel`, `/decide` (`choice`) | `campaigns.send` | The stages; `start` answers `asked` or `approvedAlone` |
| `POST :id/approve` (`yes`, `note`) | `campaigns.approve` | Never one's own ask, unless nobody else may |
| `GET /suppressed?q=`, `POST /suppressed`, `POST /suppressed/remove` | `campaigns.send` (company) | The do-not-mail list |
| `GET /search?q=`, `GET /report?days=&to=` | `campaigns.read` | Search; the Reports tab |

`GET` and `POST /hooks/campaigns/u/:token` are the unsubscribe link; a broken, unknown or test link
answers a small page saying what to do. Audited: `campaigns.create`, `.update`, `.delete`, `.import`
(counts and columns, no address), `.attach`, `.detach`, `.use-list`, `.add-people`,
`.remove-people`, `.fields`, `.pace`, `.test`, `.start`, `.approve`, `.refuse`, `.decide`,
`.unschedule`, `.pause`, `.resume`, `.cancel`, `.download`, `.suppress`, `.unsuppress`, `.run-now`,
`.archive`, `.unarchive`; the system's `.run`, `.run-failed`, `.protect`, `.unsubscribe`,
`.resubscribe`, `.finish`.

## Health

All in the `email` lane.

| Check | What it says |
| --- | --- |
| `campaigns.reputation` (every 6 h) | Warns over `PAUSE_SPAM` 0.3% or `PAUSE_BOUNCES` 5% across seven days, once 100 were sent |
| `campaigns.timer` | Fails when a campaign has been due over `STALLED_MS` (20 minutes) with no run at all; a campaign waiting for a named reason is not counted |
| `campaigns.reports` | Warns when 20 or more were sent between two hours and `SILENT_MS` (30 minutes) ago with no report on any |

## The warm-up

A domain new to bulk mail sends `WARMUP` campaign messages a day: 50, 100, 150, 250, 400, 600,
900, 1,300, 1,800, 2,500, 3,500, 5,000, 7,000, 10,000, then only the other limits; every campaign
from it that UTC day counts. Day one is `email_domains.bulk_since`. A held campaign says which day
it is on. `campaigns.warmup` turns it off.

## Tables

| Migration | What it makes or adds |
| --- | --- |
| `0020` | `campaigns` (place, name, subject, message, merge fields, stage, start, portal address, link secret, who, when) and `campaigns_recipients` (row, address, name, fields, state, reason, key, when) |
| `0044` | Copies the old suppressions into `email_donotmail` |
| `0046` | `campaigns.sender_id` |
| `0049` | Template and version, saved list, pace and hours, version, approval, engine state, counters (people, sent, skipped, failed, unclear, today); a person's unclear time and version |
| `0050` | `started_by`, `rates_next`, `rates_over`, `n_bounced`, `n_complained`, `summary_at` |
| `1012` | `tally` and `run_log`; index `campaigns_recipients_row` |
| `1014` | `archived_at` |
| `1015` | `field_map` |
| `1020` | Drops `campaigns_suppressed` (widening the do-not-mail list once more); `campaigns_recipients_waiting` replaces the index by state |

Figures read `email_messages` by message key. Pages read the counters kept on the campaign;
providers' reports are read for the people sent to and kept in `tally` a minute while running, ten
minutes after. A 2,000-person campaign reads 10 rows as a draft, 18 sending, 103 for its people and
3 for the list (`test/campaigns.test.ts`, "rows read").

## Settings

All an Owner's.

| Key | Default |
| --- | --- |
| `campaigns.daily_limit` | 200 (1 to 100,000), under Brevo's free 300 |
| `campaigns.chunk_size` | 25 every five minutes (1 to 1,000), capped by the plan's run |
| `campaigns.max_recipients` | 2,000 (1 to 50,000) |
| `campaigns.approval_over` | 1,000 (0 for none) |
| `campaigns.footer` | Empty: who sends, why, a postal address; needed to start |
| `campaigns.warmup` | On |
