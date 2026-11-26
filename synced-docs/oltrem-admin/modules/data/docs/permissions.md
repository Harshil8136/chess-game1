---
title: "@oltrem/data: Permissions"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: Permissions

> Part of [the @oltrem/data README](../README.md).

## Permissions

Bit plane 32 ([architecture](../../../docs/architecture.md) lists every plane):

| Permission | Level | What it allows |
|---|---|---|
| `data.read` | Manage | See the connected databases, read their tables and rows, check a connection now |
| `data.manage` | Manage | Connect a database, change its key or remove it, turn editing on or off; asks for a fresh sign-in, like an email service's key |
| `data.edit` | Manage | Change a row where editing is on, and undo a change (a deleted row put back included) |
| `data.delete` | Manage, Owner floor | Delete a row where editing is on; only through the Owner role, with a fresh sign-in |
| `data.hidden.read` | Manage | See the columns a manager hid or masked ([Hidden and masked columns](timed-check-and-home.md#hidden-and-masked-columns)) |
| `data.questions.run` | Manage | Ask a Neon, Turso or Supabase database a question in SQL that only reads ([Questions in SQL](a-supabase-project-beyond-its-tables.md#questions-in-sql)); it reads any table and column the key may read |
| `data.insights.read` | Manage | See a connected Supabase project's users, storage, functions, logs, health and advisors ([A Supabase project beyond its tables](a-supabase-project-beyond-its-tables.md#a-supabase-project-beyond-its-tables)), and a Neon, Turso or Upstash Redis database's usage ([A database's usage](a-supabase-project-beyond-its-tables.md#a-databases-usage-neon-turso-and-upstash)) |

All seven are held at the company itself: a grant at one place gives none. Reading a table runs with
the connection's own key, which reads every row that key may read, whatever place a person works
at, so `data.read` sits in the Manage level (class `admin`) and no ready-made everyday role hands
it out: an Owner gives it to the people who should read the company's own databases. Connect a key
that reads only what those people may see.
