# @oltrem/data

Connected data: a client's own databases and data services, read from the portal. The client
keeps their data where it is; the portal adds the screens, the permissions, the audit trail and
the checks their database lacks. The plan is the owner's of 2026-11-22 (phases 2 and 3 of the
database review, "Connected data").

Built 2026-11-22 in two parts: the **dialects** that read each service over its own web API and
the **detector** that tells which service a pasted value belongs to; then the module itself, its
two permissions, its routes under `/api/data` and the **Data** pages, mounted in the client
template beside the providers module. The providers routes, held by whoever runs email, refuse a
connection of the kind `data`: they neither make, list nor touch one, and the Data routes treat
any other kind as not there.

## Permissions

Bit plane 32 ([architecture](../../docs/architecture.md) lists every plane):

| Permission | Level | What it allows |
|---|---|---|
| `data.read` | Manage | See the connected databases, read their tables and rows, check a connection now |
| `data.manage` | Manage | Connect a database, change its key or remove it; asks for a fresh sign-in, like an email service's key |

Both are held at the company itself: a grant at one place gives neither. Reading a table runs with
the connection's own key, which reads every row that key may read, whatever place a person works
at, so `data.read` sits in the Manage level (class `admin`) and no ready-made everyday role hands
it out: an Owner gives it to the people who should read the company's own databases. Connect a key
that reads only what those people may see.

## The pages

| Page | What it shows |
|---|---|
| `/data` (Work, Data) | Every connection: its service, address, how its last check went and how long ago; Connect a database for a manager |
| `/data/connect` | One box that takes whatever the service gave (an address, a key, a connection string, or up to 8 lines of an `.env` file) and works out the service; under it a card for each service. `/data/connect/custom`, which the Apps page links, is the same page |
| `/data/connect/<service>` | The service's steps in its own dashboard, with links (only `https://` ones are drawn), and its form: a name and the fields it needs (Neon's host is read from its connection string, so it is not asked for). After a paste the form comes first. Someone without `data.manage` (the Apps page links every card here) sees the steps and "Ask an Owner", not the form. Supabase's page also offers "Sign in with Supabase" above them when the Apps part's connect relay is set (`GET /api/connect/oneclick`), and says in fixed words why a sign-in brought nothing (`?trip=`); the Apps part's README, "Supabase, for the data part", has the journey |
| `/data/connections/<id>` | The connection's facts and last check, its tables, Check now, Rename, Change key and Remove (one confirm). When the list of tables is cut (past 500, or past 10 Airtable bases), "Open a table by its name" opens any other the key may read, with how the service names one (Neon's with its schema; Airtable's by its base and table ids). A failed check says in plain words what happened (a refused key, or no answer) with the service's own words under it; it shows only while the tables do not load either, since tables that load now say more than an older check. Change key keeps the saved key when it is left empty only beside another field to change (the address of Supabase, Turso and Upstash); where the key is the only field (Neon, Airtable) it is required |
| `/data/connections/<id>/rows` | One page of a table, read now: Back at the top, a search, a sort by any sortable column (the column's header on a computer, a row of chips above the rows on a phone), Next page and First page (shown even when a page is refused, as is Clear the search); a table on a computer whose columns scroll sideways, and a card for each row on a phone, its first value as the title and every field under it. Saved views keep the table, its search and its sort |

A connection made from the paste box or a card is checked at once, and the connection page opens
either way: "Connected" when the database answered, "Saved, but the database did not answer yet"
when it did not, with the reason under it. A new key says the same two ways. Check now pressed
again within 30 seconds answers the last check without calling the service. Nothing read from a
client's database is kept: each page is read when it is opened.

## The routes

Under `/api/data`; every change is audited by the providers registry (`providers.create`,
`providers.credential`, `providers.probe`, `providers.remove`, the target the connection).

| Route | Permission | What it does |
|---|---|---|
| `GET /services` | `data.read`, company | The data services a database can be connected from: fields (never a pattern or a value), steps, help; and whether this person may connect one |
| `GET /connections` | `data.read`, company | The connections and whether this person may manage them |
| `GET /connections/:id` | `data.read`, company | One connection, never its key, and whether this person may change it |
| `POST /connections` | `data.manage`, company | Connect: definition, label, fields; tidied by `prepare`, sealed, checked at once; `201 {id, check}`. The same service at the same address already connected is refused (`KIT-E-4104`, its name in the detail), so a Connect pressed twice or a sign-in come back twice makes one; the pages then open that connection with "This database was already connected". Not Neon: one endpoint serves several databases and roles, which only the secret connection string names |
| `POST /connections/:id/label` | `data.manage`, company | Rename it (`label`, 1 to 60 characters); its key and address stay; audited as `providers.rename` |
| `POST /connections/:id/credential` | `data.manage`, company | A new key or address, checked at once |
| `POST /connections/:id/check` | `data.read`, company | Reach the database with its sealed key; a refusal is a failed check kept on the connection, never an error. Within 30 s of the last check it answers that one instead (`CHECK_AGAIN_MS`) |
| `DELETE /connections/:id` | `data.manage`, company | Remove the connection and its sealed key; the database is not touched |
| `GET /connections/:id/tables` | `data.read`, company | The tables, views or key sets the key may read, at most 500, and whether that is all |
| `GET /connections/:id/rows` | `data.read`, company | One page: `table`, `cursor`, `search`, `sort`, `desc` |
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
| Turso | `libsql` | SQL over HTTP, `POST /v2/pipeline` | a token made with `--read-only` |
| Neon | `neon` | Neon's HTTP SQL endpoint, the queries of a call in one read-only batch | a role made with `--access read_only` |
| Supabase | `postgrest` | the Data API (PostgREST): the OpenAPI description, then `GET` only | a secret key: Supabase has no read-only key |
| Airtable | `airtable` | the metadata API, then list records | a personal access token with `data.records:read` and `schema.bases:read` |
| Upstash Redis | `upstash-redis` | REST `POST /pipeline`, read commands only | the Read Only token |

**How each connects (the owner's ask of 2026-11-22: the safest way that is also the easiest).**
Sign-in where the service offers it to any app, otherwise the read-only key above, made in the
service's own dashboard with the steps on its page:

| Service | How it connects | Why |
|---|---|---|
| Supabase | Sign in with Supabase (the Apps part's connect relay), or its key | Supabase offers OAuth to any app; its key is a full secret key, so sign-in saves copying it |
| Airtable | its read-only token; sign-in next | Airtable offers OAuth, with a token that lasts an hour and a refresh token that rotates: it needs that token kept with the connection first |
| Neon | the connection string of a read-only role | Neon's OAuth is for approved partners only; a read-only role is narrower than any sign-in |
| Turso | the address and a read-only token | Turso offers no sign-in to other apps |
| Upstash Redis | the REST address and the Read Only token | Upstash offers no sign-in to other apps |

`src/brands.ts` holds each service's logo (Simple Icons, CC0, in its brand colour) and its card's
line; `GET /services` answers them (`mark`, `line`, `signIn`) so the Apps page draws the same
cards, and a service with none keeps its initials.

## What a dialect does

Every dialect gives the same three things (`DataSource`):

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
- **Read only.** The dialects send no statement that changes data; Neon's queries run in a
  read-only batch besides, and the guides ask for read-only keys.
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

A request the page made that cannot be met as asked (the sort, search, cursor or key set above) is
the kit's `KIT-E-0422`.

## Not here yet

A count of reads per connection (it would cost a write on every page read); the Data API's
description and the last good page kept in Cloudflare's cache (today every page of a Supabase table
reads the description again, which a large schema makes slow); AWS, Google Cloud, Azure and
Snowflake through the portal's own identity (no key at all); sign-in through the connect relay for
Airtable (Supabase signs in since 2026-11-22); Postgres and MySQL through Hyperdrive; edits with
approvals and read-only SQL questions (phase 3).

Left on purpose, to come back to:

- a cursor's offset has no upper bound, so a page far down a large table is slow on the
  database's side; the 4 s wait ends the call, not the query;
- an Airtable table in a base past the first 10 can still be opened by its id;
- the portal cannot tell whether a pasted key is truly read only: the guides ask for one;
- the limits above are constants, not settings, until the settings pass.

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
- `test/call.test.ts`: no answer in time, no connection, a redirect not followed, an answer that
  is not JSON or is empty, an answer over 2 MB by its length or as it streams, an IP address or
  `localhost` never called, the key never in the address, and every kit data definition with a
  dialect behind it.
- `test/detect.test.ts`: each service told from what was pasted, and the refusals that say what to
  paste instead; several lines put together; another secret in the block never taken for the key;
  the read-only token of two; Neon's psql line and parameters; Supabase's dashboard and pooler.
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
