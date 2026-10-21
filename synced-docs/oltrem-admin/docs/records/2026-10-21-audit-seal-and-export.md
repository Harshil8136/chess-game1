---
title: "Audit log: the page, the export and the daily seal (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 10, 11 and 13; this repository]
---

# Audit log: the page, the export and the daily seal

> **In plain words.** The portal now has an Audit log page: every action people and the portal
> took, newest first, with a row of chips to show only the refused or failed ones. An Owner can
> download whole days as a spreadsheet file (CSV), and that download is itself written in the
> log. Each night the portal seals the day before: it fingerprints every action of that day
> together with the previous night's seal and keeps a copy of the fingerprints in the bucket.
> If anyone changes or deletes an old action, the next night's check finds it, System health
> turns red, and the alert reaches the people who receive alerts.

## What changed, and why

| What | Why |
|---|---|
| **The audit module** (`createAuditModule` in `@oltrem/core-audit`), on bit plane 9, with `audit.read` and `audit.export` (admin class) | Plan 13: the audit log is read on a page and exported, and both are permissions an Owner gives |
| **The daily seal**: the job `audit.seal` chains each day's row hashes onto the previous seal, stores the seal in `oltrem_audit_seals` (migration `0016`) and a copy with every row's hash in the bucket at `logs/audit/<day>.json`, then rechecks the newest 7 seals | Plan 11: a row's own hash finds a row changed in place, but not a row removed or a whole log rewritten; the chain and the copy outside the database find both |
| **The check `audit.sealed`** in System health | A broken seal opens a problem, and a problem that lasts is an alert, so tampering is told to a person |
| **The export** `GET /api/audit/export?since=&until=`: whole UTC days, at most 10,000 rows, as CSV | Plan 13: the log leaves the portal in a format any spreadsheet opens; the limit keeps one request inside the free plan's CPU |
| **The Audit log page** and its Home card in `@oltrem/screens`; the template mounts the module | The log was written since phase 1 but nobody could read it |

## Decisions taken while building

- **An empty day is sealed too**, so a missing seal always means the job did not run, never
  that nothing happened.
- **The seal closes yesterday, never today**, so a sealed day gets no new row.
- **The recheck covers the newest 7 seals each night.** The whole chain would grow without
  limit; a week is what one run reads cheaply, and an export or a restore drill reads the rest.
- **The export downloads through the API itself.** The form is a plain `GET` to the API route, so
  the browser saves the file; the screen adds nothing between them.
- **"See it as"** (one person's access, read only) is its own change, next.

## How it was verified

- `@oltrem/core-audit`'s module test inside the Workers runtime: yesterday sealed once, chained
  and copied into the bucket; today's row left for tomorrow; an empty day sealed; a row changed
  after its seal found by the next run, and a row removed found as a chain that no longer adds
  up, each failing the check; 52 rows read in two pages; the CSV export with its quoting, its
  file name and its own audit row; a range ending before it starts refused with 422; the Home
  card.
- The template's tests: the module mounted, the seals table migrated, the seal job and the
  check run on the first tick, the page on the first run, and today's export downloaded.
- `pnpm verify` with its twelve gates.

Not verified: the page in a browser or on a phone; the download on a phone; the seal across real
nights, and its cost on a large day, which need the deployed sandbox.
