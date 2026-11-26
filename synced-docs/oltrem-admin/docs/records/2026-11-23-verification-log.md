---
title: "Verification log, 23 November 2026"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commits of this repository from 2026-11-23 and their verify runs]
---

# Verification log, 23 November 2026

> **In plain words.** The rows of 23 November from the
> [verification log](../verification-log.md), moved here unchanged on 2026-11-26 when the log
> reached its size budget, so the log stays small enough to load whole.

| Date | What was checked | What was not |
|---|---|---|
| 2026-11-23 | The locked layout, the user page and the policy editor ([record](2026-11-23-locked-layout-user-page-policy-editor.md)): the screens and core UI tests (`parsePersonPolicy`, `policyChanges`, the editor, the one list), the client template's screens test (Check, broken JSON, a refused Deny, Save and its 13 queries, the overview's order, the line under the name); the user overview, Policy JSON and Name and icon looked at on this computer at 390 and 1440 px; then the full `pnpm verify`. Not checked: a phone, the live portal |
| 2026-11-23 | Editing a connected database ([record](2026-11-23-connected-data-edits.md), P435-P442): the data tests, among them the edits run on a fake Turso over D1 so the SQL runs on SQLite, Neon's and Supabase's editors against scripted answers, the pages tests, the providers and backup tests, ten reviewers (what they caught is in the record), then `pnpm verify` (its summary in the commit) | Not run against a real Supabase, Neon or Turso database, a deployed portal or a phone; of status.md only the Connected data row was re-checked, so its date stays |
| 2026-11-23 | Questions in SQL ([record](2026-11-23-connected-data-questions.md), P443-P446): the data tests (a fake Turso answering `describe` over D1, the Neon request shape, the Ask page) and the core-ui text box test, then `pnpm verify`. Not checked against a live Neon or Turso database |
| 2026-11-23 | Hidden and masked columns ([record](2026-11-23-connected-data-hidden-columns.md), P460-P462): the data tests (a fake Turso over D1: the rules route, rows, row, change and change pages for a reader and an Owner) and the page tests, the providers tests, then `pnpm verify`. Not checked against a live database |
| 2026-11-23 | Files as a file manager, batch 1 ([record](2026-11-23-files-explorer.md), P447-P454): the files module and pages tests, then `pnpm verify` (its summary in the commit) | Not run on a deployed portal or a phone; the browser script's drag, drop and upload panel are not covered by a test |
| 2026-11-23 | Files: Manage access ([record](2026-11-23-files-access.md), P463-P467): the decision tests, the files module and pages tests, migration 0079 applied by the tests' own migration runner, then `pnpm verify` (its summary in the commit) | Not run on a deployed portal or a phone; the migration reaches a live portal through its deploy |
| 2026-11-23 | Files: Limits per person, role and location ([README](../../modules/files/README.md#limits-per-person-role-and-location-2026-11-23), P475-P478): the files module and pages tests, then `pnpm verify` (its summary in the commit) | Not run on a deployed portal or a phone; the setting is new and starts with no limits, so nothing changes for a portal until an Owner sets one |
| 2026-11-23 | Files: Storage locations ([record](2026-11-23-files-storage.md), P479-P483): the store against an in-memory S3 bucket, the files module and pages tests, the providers definitions and routes, migration 0080 applied by the tests' own runner, then `pnpm verify` (its summary in the commit) | Not run against a real S3 service, a deployed portal or a phone; the migration reaches a live portal through its deploy |
| 2026-11-23 | Files: Held for review and Shared links ([record](2026-11-23-files-safety.md), P484-P487): zips, PDFs and names read on their own (`test/safety.test.ts`), the module through the pipeline on real D1 (a zip with a program held, refused, released by Manage only; Shared links), the pages, migration 0081 applied by the tests' own runner, then `pnpm verify` (its summary in the commit) | Not run with real files from the wild, a deployed portal or a phone; the migration reaches a live portal through its deploy |
| 2026-11-23 | Files: Versions, Starred and Recent ([record](2026-11-23-files-versions.md), P488-P491): the module through the pipeline on real D1 and the test bucket (a new version, restore, ten kept and the older content deleted, a held version, stars, Recent per location), the pages, migration 0082 applied by the tests' own runner, then `pnpm verify` (its summary in the commit) | Not run on a deployed portal, against an outside S3 bucket or on a phone; the migration reaches a live portal through its deploy |
| 2026-11-23 | Files: File requests ([record](2026-11-23-files-requests.md), P492-P495): the core's hook that reads its own body (`packages/core-http/test/app.test.ts`), the module through the pipeline on real D1 and the test bucket (made, refused, the page, passcode, files received and held, the count, ended), the pages, migration 0083 applied by the tests' own runner, then `pnpm verify` (its summary in the commit) | Not run from a real phone's browser, on a deployed portal or with large files; the migration reaches a live portal through its deploy |
