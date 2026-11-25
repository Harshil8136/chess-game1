# @oltrem/data

Connected data: a client's own databases and data services, read from the portal and, where a
manager turns editing on, changed from it. The client
keeps their data where it is; the portal adds the screens, the permissions, the audit trail and
the checks their database lacks. The plan is the owner's of 2026-11-22 (phases 2 and 3 of the
database review, "Connected data").

Built 2026-11-22 in two parts: the **dialects** that read each service over its own web API and
the **detector** that tells which service a pasted value belongs to; then the module itself, its
permissions (two then, four since editing), its routes under `/api/data` and the **Data** pages, mounted in the client
template beside the providers module. The providers routes, held by whoever runs email, refuse a
connection of the kind `data`: they neither make, list nor touch one, and the Data routes treat
any other kind as not there.

Editing came on 2026-11-23 (phase 3, batch 7): once a manager presses **Turn on editing** for a
database, a row of Supabase, Neon or Turso opens on its own page to be changed, deleted (an
Owner alone) and undone for 30 days; see [Editing](#editing).

## Permissions

Bit plane 32 ([architecture](../../docs/architecture.md) lists every plane):

| Permission | Level | What it allows |
|---|---|---|
| `data.read` | Manage | See the connected databases, read their tables and rows, check a connection now |
| `data.manage` | Manage | Connect a database, change its key or remove it, turn editing on or off; asks for a fresh sign-in, like an email service's key |
| `data.edit` | Manage | Change a row where editing is on, and undo a change (a deleted row put back included) |
| `data.delete` | Manage, Owner floor | Delete a row where editing is on; only through the Owner role, with a fresh sign-in |
| `data.hidden.read` | Manage | See the columns a manager hid or masked ([Hidden and masked columns](#hidden-and-masked-columns)) |
| `data.questions.run` | Manage | Ask a Neon or Turso database a question in SQL that only reads ([Questions in SQL](#questions-in-sql)); it reads any table and column the key may read |

All six are held at the company itself: a grant at one place gives none. Reading a table runs with
the connection's own key, which reads every row that key may read, whatever place a person works
at, so `data.read` sits in the Manage level (class `admin`) and no ready-made everyday role hands
it out: an Owner gives it to the people who should read the company's own databases. Connect a key
that reads only what those people may see.

## The pages

| Page | What it shows |
|---|---|
| `/data` (Work, Data) | Every connection: its service, address, how its last check went and how long ago; Connect a database for a manager |
| `/data/connect` | One box that takes whatever the service gave (an address, a key, a connection string, or up to 8 lines of an `.env` file) and works out the service; under it a card for each service. `/data/connect/custom`, which the Apps page links, is the same page |
| `/data/connect/<service>` | The service's steps in its own dashboard, with links (only `https://` ones are drawn), and its form: a name and the fields it needs (Neon's host is read from its connection string, so it is not asked for). After a paste the form comes first. Someone without `data.manage` (the Apps page links every card here) sees the steps and "Ask an Owner", not the form. Supabase's and Airtable's pages also offer "Sign in with Supabase" or "Sign in with Airtable" above them when the Apps part's connect relay is set (`GET /api/connect/oneclick`), and say in fixed words, with the service's name, why a sign-in brought nothing (`?trip=`); the Apps part's README, "Supabase, for the data part" and "Airtable, for the data part", has the journey. The tokens a sign-in fills (Airtable's `refresh`, `expires`, `client`) are never asked for |
| `/data/connections/<id>` | The connection's facts and last check; then Editing (on or off, with Turn on editing or Turn off editing for a manager; a service whose rows cannot be changed here, Airtable or Upstash, says so instead; an Airtable sign-in that ended shows Signed out, with Sign in with Airtable again for a manager) and Recent changes (when there are any, or why they could not be read), ten at a time with Older changes and Newest changes; then its tables; Check now, Rename, Change key and Remove (one confirm). When the list of tables is cut (past 500, or past 10 Airtable bases), "Open a table by its name" opens any other the key may read, with how the service names one (Neon's with its schema; Airtable's by its base and table ids). A failed check says in plain words what happened (a refused key, or no answer) with the service's own words under it; it shows only while the tables do not load either, since tables that load now say more than an older check. Change key keeps the saved key when it is left empty only beside another field to change (the address of Supabase, Turso and Upstash); where the key is the only field (Neon, Airtable) it is required |
| `/data/connections/<id>/rows` | One page of a table, read now: Back at the top, a search, a sort by any sortable column (the column's header on a computer, a row of chips above the rows on a phone), Next page and First page (shown even when a page is refused, as is Clear the search); a grid on a computer whose columns scroll sideways under a first column that stays put, and a card for each row on a phone, its first value as the title and every field under it. Since 2026-11-25 every value keeps to one line and is cut with an ellipsis (whole on hover and on the row's page): an ID as its first 8 characters with Copy, a time as `29 Apr 2026 16:49` in UTC, true and false as a dot with Yes or No, JSON as `{3 keys}` or `[4 items]`, a number on the right, no value as a dash; each column's header carries a dot in its kind's colour (ID, number, time, yes or no, JSON, text), worked out from its type or else its first value. In a table with a primary key, each row's first value links to the row's own page. Saved views keep the table, its search and its sort |
| `/data/connections/<id>/row` | One row found by its key (`k`), read whole. With editing on and `data.edit`: a box for each value (a text box for a long or broken one), No value for a column that may be empty, a locked column's value with why, and Save changes; with `data.delete` also Delete row (one confirm, which says rows the database removes with it are not put back). Otherwise the values, and why they cannot be changed, with a link to the database's page for a manager. A refused save keeps what was typed |
| `/data/connections/<id>/rows`, hidden columns | Without `data.hidden.read`: "N columns are hidden from you", a masked column's header marked (masked) and its values masked. For a manager, Hide or mask columns under the rows (closed until opened): each column but the key on one line with a Shown, Masked, Hidden switch, two or three columns across on a wide screen, and Save columns |
| `/data/connections/<id>/ask` | A box for one question in SQL and Ask; the answer as rows (a table on a computer, a card a row on a phone), at most 100, saying when there were more or columns were left out. Download CSV gives the same answer as a file. Saved questions sit in a row of chips above the box: one opens filled in; a name and Save question keeps the typed one, and Remove saved question takes an opened one away. A refusal keeps what was typed. Linked from the database's page for someone with `data.questions.run`, on Neon and Turso only |
| `/data/connections/<id>/changes/<change>` | One change: by whom, when, the row, each column before and after, whole (a deleted row's values), Open the row, and Undo change or Undo delete while it can be undone, or why not |

A connection made from the paste box or a card is checked at once, and the connection page opens
either way: "Connected" when the database answered, "Saved, but the database did not answer yet"
when it did not, with the reason under it. A new key says the same two ways. Check now pressed
again within 30 seconds answers the last check without calling the service. Nothing read from a
client's database is kept, each page being read when it is opened, except a change's values,
kept 30 days so it can be undone.

## The routes

Under `/api/data`; every change to a connection is audited by the providers registry
(`providers.create`, `providers.credential`, `providers.probe`, `providers.option`,
`providers.remove`), and every change to a row by this module ([Editing](#editing)); the target is
the connection. Every read of what is in the database (its tables, a page of rows, one row) is
audited too (`audited` on the route: `data.read-connections-tables`, `data.read-connections-rows`,
`data.read-connections-row`), without what was searched or read (2026-11-23).

| Route | Permission | What it does |
|---|---|---|
| `GET /services` | `data.read`, company | The data services a database can be connected from: fields (never a pattern or a value), steps, help, the connections already made to each (`connected`: id, name, last check), for the Apps page's cards; and whether this person may connect one |
| `GET /connections` | `data.read`, company | The connections and whether this person may manage them |
| `GET /connections/:id` | `data.read`, company | One connection, never its key, and whether this person may change it |
| `POST /connections` | `data.manage`, company | Connect: definition, label, fields; tidied by `prepare`, sealed, checked at once; `201 {id, check}`. The same service at the same address already connected is refused (`KIT-E-4104`, its name in the detail), so a Connect pressed twice or a sign-in come back twice makes one; the pages then open that connection with "This database was already connected". Not Neon: one endpoint serves several databases and roles, which only the secret connection string names |
| `POST /connections/:id/label` | `data.manage`, company | Rename it (`label`, 1 to 60 characters); its key and address stay; audited as `providers.rename` |
| `POST /connections/:id/credential` | `data.manage`, company | A new key or address, checked at once |
| `POST /connections/:id/check` | `data.read`, company | Reach the database with its sealed key; a refusal is a failed check kept on the connection, never an error. Within 30 s of the last check it answers that one instead (`CHECK_AGAIN_MS`) |
| `DELETE /connections/:id` | `data.manage`, company | Remove the connection and its sealed key; the database is not touched |
| `GET /connections/:id/tables` | `data.read`, company | The tables, views or key sets the key may read, at most 500, and whether that is all |
| `GET /connections/:id/rows` | `data.read`, company | One page: `table`, `cursor`, `search`, `sort`, `desc`; with the key's columns (`key`) and each row's link (`links`, null where a key value was cut or empty) |
| `POST /connections/:id/editing` | `data.manage`, company | `{on}`: editing on or off; audited as `providers.option`; a new key keeps it |
| `GET /connections/:id/row` | `data.read`, company | One row by `table` and `k`: each column, whether it can be changed and why not, its value whole when it can; the values seen (`expect`), whether editing is on and what this person may do |
| `POST /connections/:id/row/change` | `data.edit`, company | `{table, k, expect, values}`: only the columns whose value differs from what the form showed, and only while they still hold it; `{changed, id, kept}` |
| `POST /connections/:id/row/delete` | `data.delete`, company | `{table, k}`: the row's values kept first, then the row deleted; the copy dropped only when the database clearly refused |
| `POST /connections/:id/columns` | `data.manage`, company | `{table, columns: {name: show, hide or mask}}`: one table's hidden and masked columns, checked against its columns (one read of the table); a key column is refused; audited as `providers.option` |
| `GET /connections/:id/questions` | `data.questions.run`, company | The questions saved for the database, `{items: [{name, sql}]}` |
| `POST /connections/:id/questions` | `data.questions.run`, company | `{name, sql}` saves a question (the same name replaces it; checked as Ask checks it), `{name, remove: true}` takes it away; at most 20 per database, Neon and Turso only; audited as `data.question-saved` or `data.question-removed` with the count, never the question |
| `POST /connections/:id/ask` | `data.questions.run`, company | `{sql, as?}`: one statement that only reads; `{columns, rows, more, left?}`, at most 100 rows and 60 columns; audited as `data.question` with the row count (and `download: csv` when `as` is `csv`), never the question or its rows |
| `GET /connections/:id/changes` | `data.read`, company | `?after=<change id>`: the next 10 changes still kept, newest first, with `next` (the id to ask after) while more remain; anything past 30 days deleted after the answer |
| `GET /connections/:id/changes/:change` | `data.read`, company | One change, its values before and after, and whether this person may undo it |
| `POST /connections/:id/changes/:change/undo` | `data.edit`, company | Undo a change while the row holds what it made, or put a deleted row back; once; `{undone, id, kept, marked}` |
| `GET /home` | `data.read` | Home's Databases line: how many connections answered their last kept check, of how many |

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

Home's Databases line reads the kept checks, for the whole portal like Home's other cards: "2 of
3" answered, the failing count when a connection's last check failed, "not checked yet" for one
with no check kept, "None" and Off when nothing is connected. Without Database checks it shows the
checks people made, at connect, with Check now or with a new key.

## The services

A connection is a providers instance of the kind `data` ([`@oltrem/providers`](../providers/README.md)):
its key sealed to its row and pinned to the host it was saved for, its definition naming the
dialect. The kit's five, with the smallest key each service offers:

| Service | Dialect | How it is read | The key the guide asks for |
|---|---|---|---|
| Turso | `libsql` | SQL over HTTP, `POST /v2/pipeline` | a token made with `--read-only`; one without it once editing is on |
| Neon | `neon` | Neon's HTTP SQL endpoint, the queries of a read in one read-only batch | a role made with `--access read_only`; one that may write once editing is on |
| Supabase | `postgrest` | the Data API (PostgREST): the OpenAPI description, then `GET` for reads | a secret key: Supabase has no read-only key |
| Airtable | `airtable` | the metadata API, then list records | a personal access token with `data.records:read` and `schema.bases:read` |
| Upstash Redis | `upstash-redis` | REST `POST /pipeline`, read commands only | the Read Only token |

**How each connects (the owner's ask of 2026-11-22: the safest way that is also the easiest).**
Sign-in where the service offers it to any app, otherwise the read-only key above, made in the
service's own dashboard with the steps on its page:

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

Phase 3, batch 9 (2026-11-23): personal data such as phone numbers, per database, for people
without `data.hidden.read`. A manager sets each column of a table Shown, Masked or Hidden on the
table's page; the rules are kept as the connection's `columns` option, so a page reads them with
the connection and no extra call. For a person without the permission:

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

## Questions in SQL

Phase 3, batch 8 (2026-11-23). Someone with `data.questions.run` types one statement on a Neon or Turso
database's Ask page and sees up to 100 rows of what it gives back. The connection's key may be
one that writes (once editing is on), so the database itself keeps a question to reading:

- **Neon** runs it in a read-only batch (`Neon-Batch-Read-Only`) through a cursor
  (`DECLARE … CURSOR FOR`, which takes only a query), after `SET LOCAL statement_timeout` of 3 s,
  and fetches 101 rows.
- **Turso** first asks libSQL to describe it (`describe` in the pipeline) and runs it only when
  SQLite says it only reads (`is_readonly`) and gives back rows; a query (`SELECT`, `WITH`,
  `VALUES`) is wrapped in `SELECT * FROM (…) LIMIT 101`, a `PRAGMA` or an `EXPLAIN` runs as typed.
- **Both** refuse a question with a semicolon in it before anything is sent (a second statement
  could end the read-only transaction), an empty one and one over 10,000 characters. Neon also
  refuses one that does not start with `SELECT`, `WITH`, `VALUES` or `TABLE`.
- Supabase's Data API runs no SQL, so Supabase, Airtable and Upstash have no Ask page.

A question is audited (`data.question`) by who asked, the connection and how many rows came back;
the question and its rows are not kept anywhere, and a refusal is logged by its code and title.
`data.questions.run` is apart from `data.read` because a question reads every column the key may read.

Download CSV (2026-11-24) asks the same question again and gives back the same at most 100 rows as
a file, `answer.csv`, through the kit's CSV writer: a value starting with `=`, `+`, `-`, `@` or a
tab is written with an apostrophe before it, so a spreadsheet shows it rather than runs it. Its
audit row adds `download: csv`, so the log tells a look from a copy that left the portal.

Saved questions (2026-11-24) are shared by everyone who may ask questions of that database: up
to 20 per database, each with a name of up to 60 characters. They are kept as one file in the
portal's bucket, `data/questions/<company>/<connection>.json`, never in a table and never in the
audit log, since a question can name a person; the backup copies it like any file, and removing
the connection deletes it.

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
  write ([Editing](#editing)); the guides still ask for read-only keys until editing is wanted.
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
Hyperdrive; an approval before an edit (optional in the owner's plan); questions in SQL on Supabase (its Data API runs none); editing
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

## Tests

Inside the Workers runtime, every service answered from a script so nothing leaves the machine.

- `test/dialects.test.ts`: for each dialect the address, the headers and the query it sends with
  every value as a parameter and each value read cut; how it reads the answer (typed libSQL
  values, Neon's text rows, PostgREST's list, Airtable's records and its own offset, each Redis
  key's type, time to live and value over several SCAN steps); the next page's cursor; the
  `complete` flag when a listing is cut, an Airtable base cannot be read, or a Redis sample was
  not every key; each probe; the plan's refusals; a changed cursor refused; a table that is not
  there or not listed; a name two Neon tables share; a row of the wrong width; a typed `%` looked
  for as itself; an answer of the wrong shape; a refusal with its words and the key blanked.
- `test/edits.test.ts`: editing through the pipeline on a Turso database played by a fake libSQL
  server that runs each statement on the test's own D1, so the SQL really runs on SQLite: rows
  linked by their key and a view by none, a row opened whole with its locked columns, editing off
  until a manager turns it on and kept through a new key, a reader refused, only the changed
  column written while it holds the old value, audited without its values, the same values
  changing nothing, a stale form refused, a missing value or a locked column refused, the change
  listed, opened and undone once, a delete only an Owner makes and its Undo, a read-only key said
  plainly with no copy left, copies past 30 days pruned, and every copy forgotten on removal.
- `test/editors.test.ts`: Neon's and Supabase's editors against scripted answers: the key from
  `pg_index` and `<pk/>`, the read-only batch for a row and none for a write, the UPDATE or PATCH
  found by the key and the values seen, a delete returning its row, a put-back with
  `OVERRIDING SYSTEM VALUE`, a view and a locked column refused before any write, and a refusal
  said as a read-only key.
- `test/call.test.ts`: no answer in time, no connection, a redirect not followed, an answer that
  is not JSON or is empty, an answer over 2 MB by its length or as it streams, an IP address or
  `localhost` never called, the key never in the address, and every kit data definition with a
  dialect behind it, a row editor only for the SQL services.
- `test/detect.test.ts`: each service told from what was pasted, and the refusals that say what to
  paste instead; several lines put together; another secret in the block never taken for the key;
  the read-only token of two; Neon's psql line and parameters; Supabase's dashboard and pooler.
- `test/airtable-sign-in.test.ts`: a signed-in Airtable connection with most of its hour left
  read as it is; one ending within five minutes renewed with the refresh token and the app id,
  kept and read with, then not renewed again; a refresh token Airtable refuses said as a failed
  check and a refused read with how to come back; Airtable's 409 answered by reading the stored
  tokens back, and still due refused with nothing overwritten; `registry.renew` keeping a renewal
  only over the credential it was opened from; a pasted `pat…` token never renewed.
- `test/module.test.ts`: the routes through the pipeline beside IAM and providers: the two
  permissions; every route held at the company (a manager of one place reads nothing); connecting,
  checked at once and audited, the key never back; tables and rows; a sort or a page link that is
  not one refused; Check now's 30-second cooldown; a new address without its key refused and the
  same address alone keeping the key; a refused key kept as a failed check, then mended; an email
  connection not there on any data route; the timed check (an unchanged answer not written and
  written again after a day, a refused key failing it and kept, no audit row, a key that will not
  open kept as a failed check and tried again only after a day or a new key, a disabled one left
  out, the turn past five) and Home's line (answered, failing, not checked yet, None), with the
  Email services card no longer counting a database; a second connection to the same address
  refused before any call; a rename, audited, refused to a reader and to an empty name; removal.
- `test/pages.test.ts`: every page against the API's answers: the list and its states; the paste
  box, a half paste, a refusal; a service's form, kept as typed but never its key; a reader's view
  of each page; a guide link only when it is `https://`; the connection page's failed check in
  plain words and hidden when the tables load; saved-but-not-answering after a connect or a new
  key; each failure path staying on its page; Change key with and without a key to keep; Rename
  and its refusal; Open a table by its name only when the list is cut, never for Redis keys; a
  sunset date; rows sorted, searched, empty, refused, paged, with Back at the top.
