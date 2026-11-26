---
title: "@oltrem/data: The routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: The routes

> Part of [the @oltrem/data README](../README.md).

## The routes

Under `/api/data`; every change to a connection is audited by the providers registry
(`providers.create`, `providers.credential`, `providers.probe`, `providers.option`,
`providers.remove`), and every change to a row by this module ([Editing](timed-check-and-home.md#editing)); the target is
the connection. Every read of what is in the database (its tables, a page of rows, one row) is
audited too (`audited` on the route: `data.read-connections-tables`, `data.read-connections-rows`,
`data.read-connections-row`), without what was searched or read.

| Route | Permission | What it does |
|---|---|---|
| `GET /services` | `data.read`, company | The data services a database can be connected from: fields (never a pattern or a value), steps, help, the connections already made to each (`connected`: id, name, last check), for the Apps page's cards; and whether this person may connect one |
| `GET /connections` | `data.read`, company | The connections and whether this person may manage them |
| `GET /backups` | `data.insights.read`, company | Each connected database's own backups for the Backups page: a Supabase project's daily copies, the newest and point-in-time recovery (with its access token), a Neon project's restore window (with its API key); at most five (`BACKUPS_MAX`), side by side, a connection without its key left out and one whose service refused listed with its words; `more` when there are others |
| `GET /connections/:id` | `data.read`, company | One connection, never its key, and whether this person may change it |
| `POST /connections` | `data.manage`, company | Connect: definition, label, fields; tidied by `prepare`, sealed, checked at once; `201 {id, check}`. The same service at the same address already connected is refused (`KIT-E-4104`, its name in the detail), so a Connect pressed twice or a sign-in come back twice makes one; the pages then open that connection with "This database was already connected". Not Neon: one endpoint serves several databases and roles, which only the secret connection string names |
| `POST /connections/:id/label` | `data.manage`, company | Rename it (`label`, 1 to 60 characters); its key and address stay; audited as `providers.rename` |
| `POST /connections/:id/credential` | `data.manage`, company | A new key or address, checked at once |
| `POST /connections/:id/check` | `data.read`, company | Reach the database with its sealed key; a refusal is a failed check kept on the connection, never an error. Within 30 s of the last check it answers that one instead (`CHECK_AGAIN_MS`) |
| `DELETE /connections/:id` | `data.manage`, company | Remove the connection and its sealed key; the database is not touched |
| `GET /connections/:id/tables` | `data.read`, company | The tables, views or key sets the key may read, at most 500, and whether that is all |
| `GET /connections/:id/rows` | `data.read`, company | One page: `table`, `cursor`, `search`, `sort`, `desc`, and for Airtable `view` (a view's id, `viw…`; one not in the table is refused in words), answering the table's `views` and the `view` read; with the key's columns (`key`) and each row's link (`links`, null where a key value was cut or empty) |
| `POST /connections/:id/editing` | `data.manage`, company | `{on}`: editing on or off; audited as `providers.option`; a new key keeps it |
| `GET /connections/:id/row` | `data.read`, company | One row by `table` and `k`: each column, whether it can be changed and why not, its value whole when it can; the values seen (`expect`), whether editing is on and what this person may do |
| `POST /connections/:id/row/change` | `data.edit`, company | `{table, k, expect, values}`: only the columns whose value differs from what the form showed, and only while they still hold it; `{changed, id, kept}` |
| `POST /connections/:id/row/delete` | `data.delete`, company | `{table, k}`: the row's values kept first, then the row deleted; the copy dropped only when the database clearly refused |
| `POST /connections/:id/columns` | `data.manage`, company | `{table, columns: {name: show, hide or mask}}`: one table's hidden and masked columns, checked against its columns (one read of the table); a key column is refused; audited as `providers.option` |
| `GET /connections/:id/questions` | `data.questions.run`, company | The questions saved for the database, `{items: [{name, sql}]}` |
| `POST /connections/:id/questions` | `data.questions.run`, company | `{name, sql}` saves a question (the same name replaces it; checked as Ask checks it), `{name, remove: true}` takes it away; at most 20 per database, Neon, Turso and Supabase only; audited as `data.question-saved` or `data.question-removed` with the count, never the question |
| `POST /connections/:id/ask` | `data.questions.run`, company | `{sql, as?}`: one statement that only reads; `{columns, rows, more, left?}`, at most 100 rows and 60 columns; audited as `data.question` with the row count (and `download: csv` when `as` is `csv`), never the question or its rows |
| `GET /connections/:id/users` | `data.insights.read`, company | `?page=` (1 up): a page of 25 of a Supabase project's users from its Auth admin API, `{users, next}`; audited as `data.read-connections-users` |
| `GET /connections/:id/storage` | `data.insights.read`, company | No query: `{buckets}` (each with `types`, the only kinds of file it takes), and with an access token `stats`: the project's `region` and each bucket's `files` and `bytes` from one read-only question to `storage.objects`, or null when that read was refused (logged, so the buckets still show). `?bucket=&prefix=&offset=`: `{bucket, prefix, files, next}`, 100 at a time; audited as `data.read-connections-storage` |
| `POST /connections/:id/storage/buckets` | `data.manage`, company | `{name, public, sizeMb, types}`: a bucket made in the project's storage; the name lower case letters, digits, dots, dashes or underscores |
| `PATCH /connections/:id/storage/buckets/:bucket` | `data.manage`, company | `{public, sizeMb, types}`: a bucket's settings; `sizeMb` null and `types` empty for none of its own |
| `POST /connections/:id/storage/buckets/:bucket/empty` | `data.delete`, company | Every file in the bucket deleted; the bucket stays. Cannot be undone |
| `DELETE /connections/:id/storage/buckets/:bucket` | `data.delete`, company | An empty bucket deleted; Supabase refuses one that holds files |
| `POST /connections/:id/storage/upload` | `data.edit`, company | `?bucket&path`, the file as the body with its own type and length, 50 MB at most (`UPLOAD_MAX`); a file of that name is refused, never replaced (`x-upsert: false`) |
| `POST /connections/:id/storage/folder` | `data.edit`, company | `{bucket, path}`: a folder made as Supabase's dashboard makes one, an empty `.emptyFolderPlaceholder` inside it, never listed |
| `POST /connections/:id/storage/move` | `data.edit`, company | `{bucket, from, to}`: a file renamed or moved inside its bucket |
| `POST /connections/:id/storage/remove` | `data.delete`, company | `{bucket, paths}`: up to 100 files deleted. Cannot be undone |
| `GET /connections/:id/storage/link` | `data.insights.read`, company, audited | `?bucket&path&download=1&days=7`: `{url, days}`, a signed link to one file for a day or 7 days; the file never passes through the portal |
| `GET /connections/:id/health` | `data.insights.read`, company | Memory, disk, load, connections and the database's size from the project's metrics page, each `null` when it is not given |
| `GET /connections/:id/users/:user` | `data.insights.read`, company, audited | One Auth user, read live from the Auth admin API |
| `POST /connections/:id/users` | `data.edit`, company | `{email}`: someone invited; Supabase sends the invite email |
| `POST /connections/:id/users/:user` | `data.edit`, company | `{act: reset, confirm, block or unblock}`: a password reset email (`/auth/v1/recover`), the email marked confirmed, blocked for Supabase's longest ban or let back in |
| `DELETE /connections/:id/users/:user` | `data.delete`, company | One Auth user deleted. Cannot be undone |
| `POST /connections/:id/advisors/fix` | `data.manage`, company | `{key}`: Supabase's key for one finding; the advice read again, the finding found by its key, and the SQL built from its own names (each quoted) run through the Management API's `database/query`; a caller never sends SQL. `{title, sql}`; a finding gone, or one with no fix here, refused |
| `GET /connections/:id/functions/:slug` | `data.insights.read`, company | `?span=1hr, 1day or 7day`: one Edge Function with its `entrypoint`, `stats` (each stretch's calls, 4xx, 5xx, average and slowest time) and `secrets` (the project's own by name, never a value), each null when Supabase does not give it; with the access token |
| `POST /connections/:id/functions/:slug/run` | `data.edit`, company | `{method: GET or POST, body}`: the function run once with the project's key; `{status, ms, type, body}`, the key blanked from the answer, cut at 20,000 characters, an answer over 1 MB not shown |
| `GET /connections/:id/project` | `data.insights.read`, company | `?part=requests&span=1hr, 1day or 7day` `{requests}`, `advisors` `{advice}`, `backups` `{pitr, backups}`, `functions` `{functions}`, `overview` `{name, region, status, postgres, size, tables}` (each table's schema, kind, estimated rows, size, row security, policies and columns, from one read-only question to the project's catalogue that leaves Supabase's own schemas out and stops at 500), `settings` `{services, auth, ssl, network, extensions, missing}` (each part read apart and named in `missing` when refused), from the Management API with the access token |
| `GET /connections/:id/logs` | `data.insights.read`, company | `?source=&hours=1 or 24&search=`: the newest 100 lines of one log, `{logs}`; audited as `data.read-connections-logs` |
| `GET /connections/:id/usage` | `data.insights.read`, company | A Supabase project's `{supabase}` usage and plan allowance with the access token, or a Neon database's `{neon}` a Turso database's `{turso}` or an Upstash Redis database's `{upstash}` usage with the connection's API key, from the service's API; another service `KIT-E-0422` |
| `GET /connections/:id/changes` | `data.read`, company | `?after=<change id>`: the next 10 changes still kept, newest first, with `next` (the id to ask after) while more remain; anything past 30 days deleted after the answer |
| `GET /connections/:id/changes/:change` | `data.read`, company | One change, its values before and after, and whether this person may undo it |
| `POST /connections/:id/changes/:change/undo` | `data.edit`, company | Undo a change while the row holds what it made, or put a deleted row back; once; `{undone, id, kept, marked}` |
| `GET /home` | `data.read` | Home's Databases line: how many connections answered their last kept check, of how many |
