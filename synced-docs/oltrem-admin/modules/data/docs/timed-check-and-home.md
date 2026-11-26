---
title: "@oltrem/data: The timed check and Home; The services; Sign in with Airtable; Editing; Hidden and masked columns"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: The timed check and Home; The services; Sign in with Airtable; Editing; Hidden and masked columns

> Part of [the @oltrem/data README](../README.md).

## The timed check and Home

`data.connections` (lane `data`, every hour, `WATCH_EVERY`) calls up to five connections at a time
(`WATCH_MAX`, under the six calls a Worker may have open at once); past five, each hour takes the
next five in turn (`watchTurn`), so each is called at least every ceil(count / 5) hours. A call
has at most 5 s for opening the key and the answer (`WATCH_WAIT_MS`); one still running then is
left to its own 4 s limit. Every outcome is a check kept like an answer, a key that would not open
and a call that failed included, so the connection's page and Home say what Status says. It is
kept only when it changed, or once a day, so a database that keeps answering costs one write a
day; the timer's calls are not audited, as nobody pressed anything. A key that would not open (an
audited failure in the providers registry) is tried again once a day, not every hour, or at once
when someone changes it. Any connection that did not answer makes the check fail with its name and
the service's words, and Status opens a problem after two failures in a row, as for any check. It
is the part's one extra, Database checks (`data.watch`), off on a new portal and on a portal that
saved its Modules switches before it existed (core-config migration `0077`).

`data.services` (lane `data`, every hour, under the same extra, batch 2 of the integrations plan)
asks each Supabase, Turso and Upstash connection's own service what needs a look, with the access
token or API key the connection was given; one without it is not asked. At most three a run
(`SERVICES_MAX`, as Turso takes five calls), the rest in turn by the hour, each with 5 s
(`WATCH_WAIT_MS`); nothing is kept but the check's own line (`src/warnings.ts`):

- **It fails**, so Status opens a problem after two runs and the alerts follow, when the service
  has stopped something: a Supabase service not healthy (not one still starting), a Supabase
  database in read-only mode, Turso's blocked reads or writes, an Upstash database not active.
- **It asks for a look** (Status's "to look at", and Home's Status line) when a figure nears its
  limit: a Supabase disk 90% full (`DISK_NEAR`, where Supabase grows it), a Turso account's rows
  read or written, storage or bytes synced, or an Upstash database's requests this month, storage
  or cost against its budget, 80% of the plan (`NEAR`), and a service that could not be asked,
  with its words.

A Supabase project is asked three things apart (`watch()` in `dialects/supabase.ts`: its services'
health, read-only mode and the disk); a part its token may not read is left out, and all three
refused is said.

Home's Databases line reads the kept checks, for the whole portal like Home's other cards: "2 of
3" answered, the failing count when a connection's last check failed, "not checked yet" for one
with no check kept, "None" and Off when nothing is connected. Without Database checks it shows the
checks people made, at connect, with Check now or with a new key.

## The services

A connection is a providers instance of the kind `data` ([`@oltrem/providers`](../../providers/README.md)):
its key sealed to its row and pinned to the host it was saved for, its definition naming the
dialect. The kit's five, with the smallest key each service offers:

| Service | Dialect | How it is read | The key the guide asks for |
|---|---|---|---|
| Turso | `libsql` | SQL over HTTP, `POST /v2/pipeline` | a token made with `--read-only`; one without it once editing is on |
| Neon | `neon` | Neon's HTTP SQL endpoint, the queries of a read in one read-only batch | a role made with `--access read_only`; one that may write once editing is on |
| Supabase | `postgrest` | the Data API (PostgREST): the OpenAPI description, then `GET` for reads | a secret key: Supabase has no read-only key |
| Airtable | `airtable` | the metadata API, then list records (in a view when one is picked); the table list gives each table's fields, views and description and the key's permission level on its base, with no further call | a personal access token with `data.records:read` and `schema.bases:read` |
| Upstash Redis | `upstash-redis` | REST `POST /pipeline`, read commands only | the Read Only token |

**How each connects.** Sign-in where the service offers it to any app, otherwise the read-only key
above, made in the service's own dashboard with the steps on its page:

| Service | How it connects | Why |
|---|---|---|
| Supabase | Sign in with Supabase (the Apps part's connect relay), or its key | Supabase offers OAuth to any app; its key is a full secret key, so sign-in saves copying it |
| Airtable | Sign in with Airtable (the Apps part's connect relay), or its read-only token | Airtable offers OAuth to any app, with read-only scopes and the bases picked on its own page: no token to make or paste. The portal renews its tokens ("Sign in with Airtable", below) |
| Neon | the connection string of a read-only role | Neon's OAuth is for approved partners only; a read-only role is narrower than any sign-in |
| Turso | the address and a read-only token | Turso offers no sign-in to other apps |
| Upstash Redis | the REST address and the Read Only token | Upstash offers no sign-in to other apps |

`src/brands.ts` holds each service's logo (Simple Icons, CC0, in its brand colour) and its card's
line; `GET /services` answers them (`mark`, `line`, `signIn`) so the Apps page draws the same
cards, and a service with none keeps its initials.

## Sign in with Airtable

A connection made by Sign in with Airtable (batch 5 of the database review, 2026-11-22; the
journey is in the Apps part's README) holds four sealed fields: `token`, an access token that
lasts an hour; `refresh`, a refresh token that lasts 60 days and that Airtable replaces on each
use; `expires`, when the access token ends, in ms; and `client`, the Vendor's Airtable integration's
public id. The integration has no client secret (a public client, with PKCE at the sign-in), so the
portal renews the tokens itself, and the relay keeps no part in it.

Before each read (the tables, a page of rows, Check now, the timed check), `airtableDue` asks
whether the access token ends within five minutes. When it does, `airtableRenew` posts the refresh
token and the id to `https://airtable.com/oauth2/v1/token`, and `registry.renew` keeps the new
three over the credential that was opened, only while that one is still stored (the providers
README). Then:

- **Airtable answers 409** (renewed a moment ago by another request): the stored tokens are read
  back and used; still due, the read is refused with "Airtable is still renewing the sign-in. Try
  again in a minute".
- **Airtable refuses the refresh token** (401, or `invalid_grant` or `invalid_client`: not used
  for 60 days, or taken back in Airtable): the stored tokens are read back once, in case another
  request renewed them; otherwise `KIT-E-4101` with `SIGN_IN_ENDED`, which says to remove the
  connection and sign in again, or to paste a personal access token with Change key. Under
  Database checks it is a failed check with the same words, which the connection's page shows as
  "Airtable's sign-in has ended" rather than "did not answer", and Status opens a problem after
  two.
- **Not reached, another answer, or no tokens in it:** `KIT-E-4101`, try again in a minute.

A pasted token (`pat…`) is never renewed, even when Change key replaced a sign-in's token and its
refresh token is still sealed beside it. The renewal is not audited (it runs hourly under Database
checks); the sign-in and the save are, as `providers.create`.

## Editing

Off for every database until a manager presses **Turn on editing** on its page (`data.manage`, with
a fresh sign-in; anyone holding Manage, not only an Owner): kept as the connection's `edits`
option (the providers registry's `setOption`). A new key for the same host keeps it; a key or
address for another host drops it, and the data module forgets that connection's kept changes,
which belonged to the old database. Its key must then be allowed to write: the services' steps
still ask for a key that only reads, so Change key takes one that may write. A refused write is
said for what it is: a key that may only read (`KIT-E-4107`), a value the database will not take,
with its own words (`KIT-E-4108`), or, when the service failed on its side or did not answer, the
usual `KIT-E-4101`.

- **What can be changed.** Supabase, Neon and Turso tables with a primary key (from PostgREST's
  `<pk/>`, Postgres's `pg_index`, SQLite's `table_xinfo`). Not a view, the key's own columns, a
  column the database works out, binary data, JSON or a list, a value over 10,000 characters, or a
  Supabase number past 2^53, which comes back rounded (shown, never changed; such a key opens no
  row). A form holds at most 32,000 characters in boxes (`withinForm`): past that the longest
  values are shown, not boxed, so its hidden copy of what it showed stays quick to read back.
  Airtable and Upstash are read only, and their pages offer no switch.
- **Types.** Postgres refuses a value of the wrong kind itself; SQLite would keep text in a number
  column, so for Turso text typed into an INTEGER, REAL or NUMERIC column is sent as a number, or
  refused when it is not one.
- **A change.** The row's form sends every value; only those that differ from what it showed
  (a text box's CR LF read as LF) are written, by one UPDATE (or PATCH) that matches the key and
  each changed column's old value (`IS`, `IS NOT DISTINCT FROM`, `eq.` or `is.`) and returns the
  new ones. No row matched means someone changed or deleted it since: `KIT-E-4105`, nothing
  written. Values travel as parameters, never inside the SQL. A refused save shows the form again
  with what was typed; a column someone changed since shows its value now, and what the form had,
  so a second press never writes over their change unseen. A box that held no value and was typed
  into is saved with the text, even with No value left ticked.
- **A delete** (an Owner's) reads the row whole, keeps its values, then deletes it, and keeps what
  the database returned when that differs. A delete the database clearly refused keeps no copy;
  one with no answer, or none it could read, keeps it, since the row may be gone. Only that row
  is kept: rows in other tables that the database deletes or changes with it (a cascade) are not
  put back by Undo, and the confirm says so.
- **Undo.** A change is undone by changing the columns back while they still hold what it made;
  a delete by putting the kept row back (Neon with `OVERRIDING SYSTEM VALUE` for a key Postgres
  numbers itself). Each is undone once, and an undo is listed as a change of its own. An undo
  over a newer value is refused (`KIT-E-4105`) and writes nothing; one whose mark could not be
  written says so, as the change would still offer Undo.
- **Where the values are kept.** In the portal's one bucket (`FILES`), at
  `data/changes/<company>/<connection>/<id>.json`, the newest first by name: the key and the exact
  values before and after, as the service gave them, and who and when. Kept 30 days
  (`KEEP_DAYS`); older ones are deleted when the database's page lists them and by the hourly
  check (Database checks), and every copy of a connection when it is removed or moved to another
  host. The backup's copy of the files leaves them out (the backup module's `NOT_COPIED`), so none
  outlives the 30 days locked in a backup. A privacy request does not search them: they are a
  client's own rows, which the portal does not own, and they go within 30 days. One that could
  not be kept is reported and the page says the change cannot be undone.
- **The audit log** has a row for each change, delete and undo (`data.row-change`,
  `data.row-delete`, `data.row-undo`): who, the table, the row's key when every key value is a
  number (else only the key's column names: a text key may be an email), the change's id and
  which columns changed, each marked changed without its values. A refusal is logged by its code
  and title, never the database's words, which often quote the row. The log is kept for good and
  a client's rows are often about people, so the values stay only in the kept copy.

## Hidden and masked columns

Phase 3, batch 9: personal data such as phone numbers, per database, for people without
`data.hidden.read`. A manager sets each column of a table Shown, Masked or Hidden on the table's
page; the rules are kept as the connection's `columns` option, so a page reads them with the
connection and no extra call. For a person without the permission:

- a hidden column is left out of the rows, a row's page and a change's page; a masked one shows
  `••••` and its last four characters when it has eight or more, else `••••`;
- neither is searched, sorted or ordered by (either would tell its values), and a sort asked for
  by one is refused as a column the table does not have;
- on a row's page a masked column is locked and neither is in the values the form sends back, so
  a change that names one is refused;
- a key column cannot be hidden or masked: rows are opened by it, and its values are in each
  row's link.

Questions in SQL read every column, so give `data.questions.run` only to people who may see them.
Recent changes still lists which columns a change named. The rules are kept through a new key for
the same database and dropped with a key for another host.
