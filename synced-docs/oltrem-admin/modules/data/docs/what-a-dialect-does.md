---
title: "@oltrem/data: What a dialect does; Finding the service from what was pasted; Using it; Errors; Not here yet"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: What a dialect does; Finding the service from what was pasted; Using it; Errors; Not here yet

> Part of [the @oltrem/data README](../README.md).

## What a dialect does

Every dialect gives the same three things (`DataSource`), and the SQL ones a row's editor
(`edit`, above):

- `probe()`: one cheap call (`SELECT 1`, the Data API's description, Airtable's `whoami`,
  `PING`). It keeps the `Sunset` date and the `Deprecation` mark of the answer (RFC 8594,
  RFC 9745), so a check can warn before an API stops working. A service that refuses or does not
  answer makes the probe throw `KIT-E-4101`; it never returns a quiet "not ok".
- `tables()`: `{ tables, complete }`, the tables, views or collections the key may read, at most
  500. `complete` is false when there were more than a listing holds, so a page can say the list
  is partial instead of showing it as all there is. A Postgres table's id is `<schema>.<name>`
  (never one of Postgres's own catalogs); an Airtable table's is `<base id>/<table id>`, for at
  most 10 bases, five read at a time, a base that cannot be read leaving the others listed and
  the list incomplete; Redis has keys, so its "tables" are every key and each prefix before a
  `:` seen in a sample of 1,000.
- `rows(query)`: one page of 25 rows at most, with the search and the sort done by the database:
  a `LIKE` (Postgres `ILIKE`) over up to 8 text columns, Airtable's `filterByFormula`, a Redis
  `SCAN MATCH` on the key over up to three steps. The page says its columns (name, type, sortable,
  searched), the columns it searched and the order it used, and the cursor of the next page,
  opaque text.

What a page refuses, rather than quietly doing something else (`KIT-E-0422`, said plainly):

- a sort on a column the table lacks or cannot sort (JSON, binary, arrays, Airtable attachments);
- a search on a table with no column of text;
- a cursor changed by hand, or one from another table: following "next" can never loop back to
  the first page;
- a table the listing does not show: SQLite's own tables, Postgres's catalogs, a Redis key set
  that is not "All keys" or a listed prefix.

Without a sort asked for, the rows come in order of the first column that sorts, so pages neither
repeat nor skip rows; Airtable keeps its own order.

How it stays safe and inside the free plan:

- **Only the connection's own host.** Every call is built on the host the key was saved for, and
  a URL anywhere else is refused before it leaves, as is an IP address, `localhost` or a name
  without a dot. The address fields must end in the service's own domain (a data definition
  without such a pattern is refused). Neon's connection string must name the same host as the
  connection.
- **Values as parameters.** Names are quoted, every value travels as a parameter (SQL) or quoted
  inside the filter (PostgREST, Airtable formulas, Redis globs), never pasted into the text. A
  typed `%` or `_` is looked for as itself; PostgREST offers no way to look for a literal `*`, so
  there a typed `*` matches anything.
- **Reads stay reads.** Every read sends no statement that changes data, and Neon's reads run in
  a read-only batch besides. A write goes out only from the three row routes (change, delete,
  undo), for a database whose editing is on, a person with the permission, and a key that may
  write ([Editing](timed-check-and-home.md#editing)); the guides still ask for read-only keys until editing is wanted.
- **Bounded.** One call waits at most 4 s, body included, and an answer over 2 MB is refused
  rather than read whole. The SQL dialects read each value cut to 501 characters and a blob by
  its size alone; Redis reads a string's first 501 bytes (`GETRANGE`) and a collection's size; a
  cell longer than 500 characters shows with an ellipsis. Supabase and Airtable cannot cut a
  value on their side, so a very wide row there meets the 2 MB limit instead. A page is two to
  five calls.
- **Refusals with their words.** A refusal is `KIT-E-4101` with the service's words, cut to one
  line, the key and Neon's password blanked. An answer of the wrong shape is refused, never read
  as an empty list.

## Finding the service from what was pasted

`detectData(pasted)` reads one pasted value and names the service it belongs to, with the fields
it fills: an Airtable token (`pat…`), a Supabase secret key (`sb_secret_…`) or project address, a
Neon or Supabase connection string, a Turso `libsql://` address, an Upstash address. A Supabase
publishable key, a MongoDB string, or a Postgres or MySQL server elsewhere is answered with what
to paste instead.

`detectPasted(pasted)` is what the paste box calls: several lines at once, up to 8, read one by
one and put together when they all belong to one service. An `.env` file's `NAME=`, `export` and
quotes are dropped and its `#` comments skipped, so a service's own block of settings can be
pasted as it is. A line no rule places that looks like a key fills the key of a service whose
keys have no telling start (Turso, Upstash), only when there is exactly one such line. What is
still missing is named; lines of two services are refused. A line with a name is taken for the key
only when its name says it is a token (`…_TOKEN`, `…_AUTH_…`), so a session secret or a payment key
in the same block is never sent to the service; of several tokens, the one named read-only is taken
(Vercel KV gives both). What each service shows in its own words is read too: Neon's
`psql '…'` line, Neon's parameters one by one (which open Neon's form asking for the whole
string), a Supabase dashboard address and a Supabase pooler string, both of which name the project.
`prepare(definitionId, fields)` tidies
the fields before they are saved (a host without its `https://` or path, Neon's host read from its
connection string; `DERIVED` names the fields filled in this way).

The pasted value can be a secret. The page reads it from a form post, sends it only to the
module's own route, and never writes it to a log or an audit row (the registry audits the field
names only). A key is never shown back: when the form comes back, half filled in or refused, the
other fields keep their values and the notice asks for the key again.

## Using it

```ts
import { dataSource } from '@oltrem/data';

const opened = await providers.registry.open(env, tenantId, connectionId);
const source = dataSource(opened);
const { tables, complete } = await source.tables();
const page = await source.rows({ table: tables[0].id, search: 'ana', sort: { column: 'name', desc: false } });
```

## Errors

The 41xx block of the kit's range (`src/errors.ts`):

| Code | Status | When |
|---|---|---|
| `KIT-E-4101` | 502 | The service refused the request, answered with an error, an answer of the wrong shape or over 2 MB, or not within 4 s |
| `KIT-E-4102` | 404 | The table, view or collection is not there, or the key may not read it |
| `KIT-E-4103` | 409 | That is not a database: the connection, or the service asked for, is not a data service |
| `KIT-E-4104` | 409 | That database is already connected: the same service at the same address (never Neon); the detail says the name it is saved as |
| `KIT-E-4105` | 409 | The row changed after the form was opened: nothing saved |
| `KIT-E-4106` | 409 | Editing is off for this database |
| `KIT-E-4107` | 409 | The database refused a write: the key may only read |
| `KIT-E-4108` | 422 | The database did not take a value (its own words in the detail): nothing changed |

A request the page made that cannot be met as asked (the sort, search, cursor or key set above) is
the kit's `KIT-E-0422`.

## Not here yet

A count of reads per connection (it would cost a write on every page read); the Data API's
description kept in Cloudflare's cache (today every page of a Supabase table reads the description
again, which a large schema makes slow; left out on 2026-11-24, since a cached description can be
out of date after a table changes or follow a key that was replaced, for one request saved); AWS, Google Cloud, Azure and
Snowflake through the portal's own identity (no key at all); Postgres and MySQL through
Hyperdrive; an approval before an edit (optional in the owner's plan); editing
Airtable and Upstash.

Left on purpose, to come back to:

- a cursor's offset has no upper bound, so a page far down a large table is slow on the
  database's side; the 4 s wait ends the call, not the query;
- an Airtable table in a base past the first 10 can still be opened by its id;
- signing in with Airtable again makes a new connection beside the old one (Airtable has no address
  to tell them apart by): remove the old one;
- a signed-in Airtable connection read by nobody for 60 days (with Database checks off) loses its
  refresh token and is signed in again;
- two renewals that Airtable both accepted at the same moment (it answers the second with a 409,
  so this should not happen) would keep the first one stored, whose tokens the second replaced;
- the portal cannot tell whether a pasted key is truly read only, nor, when editing is turned on,
  whether it may write: the first save says so plainly (`KIT-E-4107`);
- the limits above are constants, not settings, until the settings pass;
- Supabase's description does not mark a column Postgres works out, so putting back a deleted row
  of such a table is refused by Postgres;
- a kept copy holds the client's row for 30 days, and one past 30 days stays in the bucket until
  that database's changes are next listed or the hourly check reaches it.
