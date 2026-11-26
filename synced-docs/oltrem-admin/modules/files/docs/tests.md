---
title: "@oltrem/files: tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/test]
---

# @oltrem/files: tests

> Part of [the @oltrem/files README](../README.md).

## Tests

Inside the Workers runtime, through the pipeline beside IAM, on a company with two places, four
roles and five people, under `test/`:

| File | What it proves |
|---|---|
| `files.test.ts` | The manifest; names, numbering and depth; each person's places, another place's files unseen and unwritable; download headers, inline images, `Range` 206; the upload limit; rename and move; links (limit, by hand, day, trash, passcode and lock at ten, emailed without the passcode); trash, restore, purge, the job; audit without content; the storage check; customer shares (one company and address, hidden while trashed, ended, the newest 20, email only when asked); kinds and room per person, sum read from its index; copies, bulk trash with one refused; Manage access (restricted folders, None, View only, ends); held files and Release; versions (ten kept, restore, held new version, counted to room); Starred and Recent; file requests (passcode, name, count, held file, one email); the access review; Activity CSV; keep days and legal holds; limits by person, role and location; search by name, folders first, `_` as a letter |
| `access.test.ts` | The Manage access rules on their own |
| `safety.test.ts` | Zips, PDFs and names read on their own |
| `stores.test.ts` | Against an S3 bucket in memory (`fake-s3.ts`) that answers only signed calls: signing, the six checks, a public bucket and a key that cannot list failing; a location's uploads kept, opened, copied and purged there; a service down (`KIT-E-2410`, no row); Storage for Owners only; a connection in use (`KIT-E-2411`); Move ten a press; Bring in once, a program held |
| `pages.test.ts` | The pages against API answers: customer share refusals and queued email, Copy, Undo, links' passcode and Locked, the file manager (order, tree, uploads, bulk bar, grid, details with Activity and CSV), the access review, Keep, copies, Limits and Storage forms |

The client template's screens test runs the pages end to end: an upload, a folder, a move, a link
ended by the trash, and a customer share downloaded from the account page.
