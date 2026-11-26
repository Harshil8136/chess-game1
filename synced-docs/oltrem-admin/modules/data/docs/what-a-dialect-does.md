---
title: "@oltrem/data: what a dialect does, detection, using it, errors"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src/dialects/, detect.ts, errors.ts]
---

# @oltrem/data: what a dialect does, detection, using it, errors

> Part of [the @oltrem/data README](../README.md).

## What a dialect does

Every dialect gives three things (`DataSource`), and the SQL ones `edit`:

| Call | What it does |
| --- | --- |
| `probe()` | One cheap call (`SELECT 1`, the Data API's description, Airtable's `whoami`, `PING`), keeping `Sunset` (RFC 8594) and `Deprecation` (RFC 9745); a refusal throws `KIT-E-4101`, never a quiet "not ok" |
| `tables()` | `{ tables, complete }`, at most 500, `complete` false when cut. Ids: `<schema>.<name>` (never Postgres catalogs), `<base id>/<table id>` for Airtable (10 bases, five at a time), and for Redis every key and each `:` prefix in a 1,000-key sample |
| `rows(query)` | One page of 25, searched and sorted by the database (`LIKE` or `ILIKE` over 8 text columns, `filterByFormula`, `SCAN MATCH` over three steps), with its columns, what it searched, its order and an opaque next cursor |

Refused as `KIT-E-0422`: a sort on a missing or unsortable column, a search with no text column, a
changed or foreign cursor (so "next" never loops), a table the listing does not show. Without a
sort, rows follow the first sortable column (Airtable keeps its own).

How it stays safe and inside the free plan:

- **Only the connection's host**: anything else, an IP address, `localhost` or a dotless name is
  refused before it leaves; address fields must end in the service's domain; Neon's string must
  name the same host.
- **Values as parameters** or quoted in filters, never pasted into text; `%` and `_` searched as
  themselves (PostgREST cannot search a literal `*`).
- **Reads stay reads**, Neon's in a read-only batch; writes only from the three row routes
  ([Editing](timed-check-and-home.md#editing)).
- **Bounded**: 4 s a call, body included; answers over 2 MB refused; SQL values cut to 501
  characters, blobs by size, Redis by `GETRANGE` (Supabase and Airtable cannot cut, so wide rows
  meet the 2 MB limit). Two to five calls a page.
- **Refusals with their words**, one line, the key and Neon's password blanked; a wrong shape is
  refused, never read as empty.

## Finding the service from what was pasted

`detectData(pasted)` names the service of one value and the fields it fills: an Airtable `pat…`, a
Supabase `sb_secret_…` key or address, a Neon or Supabase connection string, a Turso `libsql://`
address, an Upstash address; a Supabase publishable key, MongoDB, or another Postgres or MySQL server
is answered with what to paste instead. `detectPasted(pasted)` reads up to 8 lines (`PASTE_LINES`),
`.env` style, put together when they belong to one service: an unnamed key-looking line fills Turso's
or Upstash's key only when it is the only one; a named line is a key only when named as a token, the
read-only one preferred; Neon's `psql` line and parameters and Supabase's dashboard and pooler are
read; lines of two services are refused. `prepare(definitionId, fields)` tidies fields before saving
(`DERIVED` names those filled). The pasted value goes only to the module's route, never to a log;
a key is never shown back.

## Using it

```ts
import { dataSource } from '@oltrem/data';

const opened = await providers.registry.open(env, tenantId, connectionId);
const source = dataSource(opened);
const { tables, complete } = await source.tables();
const page = await source.rows({ table: tables[0].id, search: 'ana', sort: { column: 'name', desc: false } });
```

## Errors

The 41xx block (`src/errors.ts`); a page request that cannot be met as asked is `KIT-E-0422`.

| Code | Status | When |
| --- | --- | --- |
| `KIT-E-4101` | 502 | The service refused, erred, answered in the wrong shape, over 2 MB, or not within 4 s |
| `KIT-E-4102` | 404 | The table is not there, or the key may not read it |
| `KIT-E-4103` | 409 | Not a data service |
| `KIT-E-4104` | 409 | Already connected at that address (never Neon) |
| `KIT-E-4105` | 409 | The row changed after the form opened: nothing saved |
| `KIT-E-4106` | 409 | Editing is off |
| `KIT-E-4107` | 409 | The key may only read |
| `KIT-E-4108` | 422 | The database did not take a value (its words in the detail) |

## Not built yet

A read count per connection; caching the Data API's description (left out: it can go stale); AWS,
Google Cloud, Azure and Snowflake by the portal's identity; Postgres and MySQL through Hyperdrive;
an approval before an edit; editing Airtable and Upstash. Known limits: a deep cursor offset is slow
on the database's side; an Airtable table past 10 bases still opens by id; signing in with Airtable
again makes a second connection; an Airtable sign-in unread for 60 days must sign in again; the
portal cannot tell whether a key only reads until a save (`KIT-E-4107`); the limits are constants;
Supabase does not mark computed columns, so putting such a row back is refused by Postgres.
