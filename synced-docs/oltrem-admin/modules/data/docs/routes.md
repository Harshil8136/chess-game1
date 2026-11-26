---
title: "@oltrem/data: routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src/module.ts]
---

# @oltrem/data: routes

> Part of [the @oltrem/data README](../README.md).

## The routes

Under `/api/data`, every route held at the company. Connection changes are audited by the providers
registry (`providers.create`, `credential`, `probe`, `option`, `rename`, `remove`), row changes by
this module ([Editing](timed-check-and-home.md#editing)). Reads of tables, rows and a row are audited
too (`data.read-connections-tables`, `-rows`, `-row`), never with what was searched or read.
`:id/` stands for `/connections/:id/`.

| Route | Permission | What it does |
| --- | --- | --- |
| `GET /services` | `data.read` | Services with fields (never a pattern or value), steps, help and `connected`, for the Apps cards; whether the person may connect |
| `GET /connections`, `GET /connections/:id` | `data.read` | Connections (never a key) and what the person may do |
| `GET /backups` | `data.insights.read` | Each database's own backups (Supabase with its token, Neon with its key), `BACKUPS_MAX` (5) side by side, `more` |
| `POST /connections` | `data.manage` | Connect: tidied (`prepare`), sealed, checked; `201 {id, check}`; the same address twice is `KIT-E-4104` (not Neon) |
| `POST :id/label` | `data.manage` | Rename (1 to 60 characters) |
| `POST :id/credential` | `data.manage` | A new key or address, checked |
| `POST :id/check` | `data.read` | Check with the sealed key; a refusal is a kept failed check; within `CHECK_AGAIN_MS` (30 s) the last one answers |
| `DELETE /connections/:id` | `data.manage` | Remove the connection and key; the database is untouched |
| `GET :id/tables` | `data.read` | Up to 500, and whether that is all |
| `GET :id/rows` | `data.read` | `table`, `cursor`, `search`, `sort`, `desc`, Airtable `view`; answers `views`, `key`, `links` |
| `POST :id/editing` | `data.manage` | `{on}` |
| `GET :id/row` | `data.read` | One row by `table` and `k`: each column, editable or why not, `expect`, what the person may do |
| `POST :id/row/change` | `data.edit` | `{table, k, expect, values}` → `{changed, id, kept}` |
| `POST :id/row/delete` | `data.delete` | `{table, k}`, the row kept first |
| `POST :id/columns` | `data.manage` | `{table, columns: {name: show, hide or mask}}`; key columns refused |
| `GET`, `POST :id/questions` | `data.questions.run` | Saved questions; `{name, sql}` saves, `{name, remove: true}` removes; 20 a database; audited `data.question-saved` or `-removed` |
| `POST :id/ask` | `data.questions.run` | `{sql, as?}` → `{columns, rows, more, left?}`, 100 rows and 60 columns; audited `data.question` |
| `GET :id/changes?after=`, `GET :id/changes/:change` | `data.read` | The next 10 kept changes; one with before and after and whether undoable |
| `POST :id/changes/:change/undo` | `data.edit` | Once → `{undone, id, kept, marked}` |
| `GET :id/usage` | `data.insights.read` | `{supabase}`, `{neon}`, `{turso}` or `{upstash}`; others `KIT-E-0422` |
| `GET :id/users?page=`, `GET :id/users/:user` | `data.insights.read` | Supabase Auth users, 25 a page; audited `data.read-connections-users` |
| `POST :id/users`, `POST :id/users/:user` | `data.edit` | Invite `{email}`; `{act: reset, confirm, block or unblock}` |
| `DELETE :id/users/:user` | `data.delete` | Delete an Auth user |
| `GET :id/storage` | `data.insights.read` | `{buckets}` (with `types`) and with a token `stats`; `?bucket=&prefix=&offset=` lists 100; audited `data.read-connections-storage` |
| `POST :id/storage/buckets`, `PATCH .../:bucket` | `data.manage` | Make or change a bucket (`public`, `sizeMb`, `types`) |
| `POST .../:bucket/empty`, `DELETE .../:bucket` | `data.delete` | Empty a bucket; delete an empty one |
| `POST :id/storage/upload?bucket&path` | `data.edit` | The body as a file, `UPLOAD_MAX` (50 MB), never replacing (`x-upsert: false`) |
| `POST :id/storage/folder`, `/move` | `data.edit` | A folder (with `.emptyFolderPlaceholder`); rename or move in its bucket |
| `POST :id/storage/remove` | `data.delete` | Up to 100 files |
| `GET :id/storage/link?bucket&path&download=1&days=7` | `data.insights.read` | A signed link for a day or 7; audited |
| `GET :id/health` | `data.insights.read` | Memory, disk, load, connections, size, each `null` when not given |
| `POST :id/advisors/fix` | `data.manage` | `{key}`: the finding read again and its SQL built from its own quoted names, run by the Management API; a caller never sends SQL → `{title, sql}` |
| `GET :id/functions/:slug?span=` | `data.insights.read` | One Edge Function: `entrypoint`, `stats`, `secrets` by name |
| `POST :id/functions/:slug/run` | `data.edit` | `{method, body}` once with the project's key → `{status, ms, type, body}`, key blanked, cut at 20,000 characters |
| `GET :id/project?part=` | `data.insights.read` | `requests`, `advisors`, `backups`, `functions`, `overview` (one catalogue question, 500 tables at most), `settings` (with `missing`) |
| `GET :id/logs?source=&hours=&search=` | `data.insights.read` | The newest 100 lines; audited `data.read-connections-logs` |
| `GET /home` | `data.read` | Home's Databases line (a module part) |
