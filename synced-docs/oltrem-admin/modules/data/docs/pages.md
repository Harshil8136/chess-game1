---
title: "@oltrem/data: the pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src/pages.tsx, module.ts, overview.ts, detect.ts]
---

# @oltrem/data: the pages

> Part of [the @oltrem/data README](../README.md).

## Connecting and the tables

| Page | What it shows |
|---|---|
| `/data` (Work, Data) | Every connection: service, address, last check and its age; **Connect a database** for a manager |
| `/data/connect` (and `/connect/custom`) | One box for whatever the service gave (address, key, connection string or up to `PASTE_LINES` (8) lines of an `.env`), which works out the service; a card per service |
| `/data/connect/<service>` | The service's steps (only `https://` links) and its form (Neon's host comes from its string). Without `data.manage`: the steps and "Ask an Owner". Supabase and Airtable offer **Sign in with …** when the connect relay is set, and say why a sign-in brought nothing (`?trip=`); the tokens a sign-in fills are never asked for |
| `/data/connections/<id>` | Commands in a row (Ask in SQL, Rename, Change key, Remove), figures in one line, then the tables as cards per schema or Airtable base (table blue, view violet, key group amber) with their tags: Airtable fields, views and the key's access; Supabase columns, and with the access token rows, size and RLS (off in red). A search from `FIND_FROM` (9) tables. Supabase with the token adds state, size, rows, RLS off count, Postgres and region. Then **Editing** (Airtable and Upstash say rows cannot change here; an ended Airtable sign-in shows **Sign in with Airtable again**) and **Recent changes**, ten at a time. Past `TABLES_MAX` (500) tables or `AIRTABLE_BASES` (10) bases, **Open a table by its name**. A failed check shows only while the tables also fail. An empty key on Change key keeps the saved one only beside another field |
| `…/rows` | One page (`PAGE_ROWS`, 25) read now: commands, search, Airtable views as chips, figures, sort (header on a computer, chips on a phone), Next and First page. A grid with a fixed first column on a computer, a card a row on a phone. Values on one line: an id as 8 characters with Copy, a time in UTC, Yes or No, JSON as `{3 keys}`, numbers right, empty as a dash; each header dotted in its kind's colour. With a primary key the first value opens the row. Saved views keep table, search and sort |
| `…/rows`, hidden columns | Without `data.hidden.read`: masked columns marked and masked, hidden ones counted. A manager's **Hide or mask columns** sets Shown, Masked or Hidden per column |
| `…/row?k=` | One row whole: a card per column with its kind, type and key part. With editing on and `data.edit`, a box per card, **No value** where allowed, locked columns with why, and **Save changes**; `data.delete` adds **Delete row** (one confirm). A refused save keeps what was typed |
| `…/ask` | One SQL question, at most `ANSWER_ROWS` (100) rows, saying what was cut; **Download CSV**; saved questions as chips. For `data.questions.run` on Neon, Turso and Supabase (with the access token) |
| `…/changes/<change>` | By whom, when, each column before and after, **Open the row**, and **Undo** while it can, or why not |

A new connection or key is checked at once: "Connected", or "Saved, but the database did not
answer yet" with why. **Check now** within `CHECK_AGAIN_MS` (30 s) answers the last check.
Nothing read is kept, except a change's values for `KEEP_DAYS` (30) so it can be undone.

## A Supabase project's sections

For `data.insights.read`, ten tabs with icons: Overview, Database, Users, Storage, Functions,
Health, Advice, Usage, Logs, Settings. Settings, Functions, Logs, Advice, requests and backups need
the access token; without it each says how to add one.

| Tab | What it shows |
|---|---|
| Overview | One verdict, then **Needs you**, worst first, each with why and where to fix it (`src/overview.ts`: not healthy, disk, memory or connections past `BUSY` (75%) and `FULL` (90%), public tables with RLS off, Supabase's advice, a failed or two-day-old backup), the figures and what each means, and a card per section |
| Database | The tables page above, with At a glance, Editing and Look closer side by side |
| Users | `USERS_PAGE` (25) a page: email or phone, sign-in way, joined, last sign-in, Confirmed, Blocked. **Invite someone** (`data.edit`); a user's page (`?user=`) has password reset, mark confirmed, Block or Let back in (`data.edit`) and Delete (`data.delete`), each asking first |
| Storage | A file manager: **New bucket** (`data.manage`: name, public, largest file, kinds), inside a bucket **Upload files** and **New folder** (`data.edit`), settings (`data.manage`), Empty and Delete (`data.delete`). A file's page (`?bucket&file`): size, type, image look, Open, Download, **Share link** (7 days), Rename or move, Delete. Bucket cards (amber public, green private) with **Use in Files**; folders first, `FILES_PAGE` (100) at a time |
| Functions | Counts, then a card per Edge Function; its page (`?fn=`) has **Run** (`data.edit`, POST JSON or GET, once, for real), calls, failures, typical and slowest time over an hour, day or 7 days, a chart, and its secrets by name only |
| Health | Memory, disk and connections as shares (past 75% look, past 90% failing), size, load; requests by service over an hour, day or 7 days; backups and point-in-time recovery |
| Advice | Fix now, look at, note; Security then Speed, each with **How to fix**. Four carry SQL (`adviceFix`: RLS off, no fixed search path, a view as owner, an unindexed foreign key) and **Fix it** for `data.manage`, which asks first with what it changes |
| Usage | The plan and a meter per limit (database, disk, files, monthly users, functions) with a link for egress and the bill |
| Logs | A chip per log (API, Database, Auth, Storage, Functions, Realtime) and per stretch, a search, counts by level, the newest `LOGS_PAGE` (100) lines |
| Settings | Services, Sign-in, Security and Extensions as panes, each setting a pill (green on, amber weak: no confirmation, guests, password under 8, built-in mail, no SSL, any IP); **Change these on Supabase** |

## Usage for Neon, Turso and Upstash

`…/usage`, for `data.insights.read`, under Tables and Usage chips; without the connection's API key
it says how to add one ([the usage section](a-supabase-project-beyond-its-tables.md#a-databases-usage)).

| Service | What it shows |
|---|---|
| Neon | This period's compute, active time, storage, written and sent out; project, region, Postgres; the compute's state, size and sleep; each branch |
| Turso | The month's rows read and written, storage, bytes synced; organization, plan, group, region, delete protection; blocked reads or writes first; the account's quotas as meters where Turso gives them |
| Upstash Redis | Today's commands, reads, writes, keys, connections, hit rate; meters where the plan sets a limit (requests, storage, cost against a budget); the other limits; plan, region, copies, eviction, backups; an inactive database said first |
