---
title: "@oltrem/data: A Supabase project beyond its tables; A database's usage (Neon, Turso and Upstash); Questions in SQL"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: A Supabase project beyond its tables; A database's usage (Neon, Turso and Upstash); Questions in SQL

> Part of [the @oltrem/data README](../README.md).

## A Supabase project beyond its tables

Batch 2 of the Supabase makeover. The secret key a Supabase connection holds reads more than the
Data API, so three more pages read, when opened and never kept, one call each:

- **Users** from the Auth admin API (`/auth/v1/admin/users`, 25 a page). Emails and phone numbers
  are personal data, so the page needs `data.insights.read`, which no ready-made role gives, and
  each read is audited like a page of rows, never with what it showed.
- **Storage** from the Storage API: the buckets (`/storage/v1/bucket`), then one folder of a
  bucket (`/storage/v1/object/list/<bucket>`, sorted by name, 100 at a time). A folder is an entry
  with no id. Files are listed, not opened or downloaded. With the access token, the bucket list
  also asks the Management API for the project (its region) and, read-only, each bucket's file
  count and total size from `storage.objects` (batch 9).
- **Health** from the project's metrics page (`/customer/v1/privileged/metrics`, Prometheus text,
  Basic `service_role` and the secret key). Only these lines are read: memory total and available,
  the `/data` disk's size and space left, the load of the last minute, the `postgres` database's
  connections and size, and the most connections allowed. A line that is not there leaves its
  figure out, never a guess.

Another service answers `KIT-E-0422` with "only from Supabase projects". The database's page
returns `canInsights` so the chips show only to those who may open them.

Batch 3 (the same day) reads what the project's key cannot, through Supabase's Management API
(`api.supabase.com`), with an access token a manager may add to the connection (Access token, an
optional field on the form and on Change key: a personal access token made at
supabase.com/dashboard/account/tokens). Only the token goes there, never the project's key, and
the portal only reads with it; a personal access token reaches every project of its account, so Sign in
with Supabase is the narrower way (below). Read, each when a page opens:

- **Requests**: `/analytics/endpoints/usage.api-counts?interval=`, by service, oldest first.
- **Logs**: `/analytics/endpoints/logs` with ClickHouse SQL the portal writes itself
  (`select timestamp, severity_text, event_message from logs where source = '…'`, newest 100,
  over the last hour or day; the old `logs.all` endpoint answers 410). A search becomes an
  `ilike` of its words, with `%`, `_`, `\` and quotes kept as text. Lines can name people, so
  each read is audited.
- **Advisors**: `/advisors/security` and `/advisors/performance` (experimental at Supabase), the
  most serious first; a guide link is kept only when it is https.
- **Backups**: `/database/backups`. **Functions**: `/functions`.
- **Settings** (batch 10, 2026-11-25), each part read apart: the services' health
  (`/health?services=db,rest,auth,storage,realtime,pooler`), how people sign in (`/config/auth`:
  sign-ups, email and whether it is confirmed, phone, guests, the outside providers turned on, the
  authenticator app, the shortest password, how long a sign-in lasts, captcha, and whether mail
  leaves through the project's own server; never its keys or templates), SSL (`/ssl-enforcement`),
  who may connect (`/network-restrictions`, as any address or a count of ranges, never the
  addresses) and, read-only, the extensions turned on (`pg_extension`, plpgsql left out).
- **Ask**: `POST /database/query/read-only`, which runs as Supabase's read-only role, wrapped in
  `select * from (…) as question limit 101`; tables are named with their schema.

An answer of another shape is refused, never guessed. With no access token, each says
`KIT-E-0422` with how to add one.

**Sign in with Supabase gives the token (batch 3b, 2026-11-25).** A project connected by Sign in
with Supabase also holds the Management API's tokens from that sign-in, scoped by the Vendor's
sign-in app: `access` (an hour), `refresh` and `expires` (ms), all sealed, never asked for on a
form (`DERIVED`). The refresh token needs the app's secret, which only the connect relay holds,
so before a Management API read `supabaseDue` asks whether the token ends within five minutes and,
when it does and the relay is set, `supabaseRenew` posts the refresh token to the relay's
`/renew/supabase` (https only) and the new tokens are kept with `registry.renew` before the read.
Table, user, storage and health reads use the project's key and never wait on it. The relay's 400
means Supabase refused the refresh token: the stored tokens are read back first, in case another
request renewed them a moment before, and otherwise the read says `SUPABASE_SIGN_IN_ENDED` (paste
an access token with Change key, or remove the database and sign in again). Tokens that cannot be
kept still serve the read and are logged. With no relay set, the token is used as it is.

## A database's usage (Neon, Turso and Upstash)

Batch 4 of the Supabase makeover: Neon and Turso say what a database used through their own
management APIs, which the database's key cannot reach. A manager may add an API key to the
connection (an optional field on the form and on Change key): a Neon API key, best a project-scoped
one made under Organization settings, API keys, or a Turso API token from `turso auth api-tokens
mint`. Neither service has a read-only management key, so the portal only reads with it: GETs to
`console.neon.tech` or `api.turso.tech`, the API key alone as the bearer (never the database's own
key or connection string), its words blanked from a refusal. Read when the Usage page opens
(`dialects/usage.ts`), never kept.

- **Neon**: the endpoint's id from the host (`ep-…`, without `-pooler`); the key's projects
  (`/api/v2/projects`), at most 10, five read at a time for their endpoints until one has it (more
  than 10 asks for a project-scoped key); then the project (`/projects/<id>`: Neon's usage figures
  for the period, "not for billing" in Neon's words) and its branches. The owner's email Neon
  sends with the project is not kept.
- **Turso**: the token's organizations (`/v1/organizations`); the organization is the longest slug
  the host's first label ends with (`<database>-<organization>`), the rest is the database's
  name; then the database (`…/databases/<name>`) and its usage this calendar month
  (`…/databases/<name>/usage`). Beside them (batch 11), the account's use this billing cycle
  (`…/organizations/<org>/usage`) and its plan's quotas from the list of plans
  (`…/organizations/<org>/plans`, the entry named as the organization's `plan_id`); a refusal or
  a plan not in the list leaves the allowance null, and the database's own usage still shows.

- **Upstash Redis**: the Developer API signs in with the account's email and an API key in Basic
  auth, so the connection takes two optional fields, the account email (kept as plain config,
  checked to look like an email) and the API key (sealed); Upstash offers read-only API keys, and
  the guide asks for one. The account's databases without their passwords
  (`api.upstash.com/v2/redis/databases?credentials=hide`), this one found by its endpoint (the
  host's first label, or the whole host), then its stats (`/v2/redis/stats/<id>`): today's commands,
  reads and writes, the month's requests and cost, the storage now, the keys and connections (the
  last point of each series) and the hit rate (hits over hits and misses, over the hours Upstash
  gives). The plan and its limits come with the database. Two GETs to one host.

A key that reaches no matching project, organization or database says how to make one that does.
The Usage tab shows to someone with `data.insights.read` on a Neon, Turso or Upstash connection.

- **Supabase** (batch 7, the owner's ask of 2026-11-25 for its allowance): with the connection's
  access token, the project (`/v1/projects/<ref>`, for its organization), then side by side the
  organization's plan and entitlements (`/v1/organizations/<slug>`, `…/entitlements`, which need
  Organizations read), the disk (`/config/disk/util`), read-only mode (`/readonly`), the compute
  size (`/billing/addons`), the Edge Functions, and one read-only question for the database's
  size, the files in Storage and their size, all users and those signed in since the first of the
  month (UTC). A part the token may not read is left out and named; the project and the question
  must answer. The page shows the plan, compute and whether the database takes changes, then a
  card with a meter for the database, the disk, file storage, monthly active users and Edge
  Functions, each against its limit where one is known: the disk's size and the functions' limit
  from the API, and for the database (Free only), file storage and monthly active users the
  plan's allowance as Supabase publishes it, kept in `PLAN_ALLOWANCE` in `pages.tsx`; then the
  plan's other limits (largest upload, logs and backups kept, point-in-time recovery, Realtime,
  branches, custom domain). Egress, function calls and the bill are not in Supabase's API: a link
  opens its usage page for them. Supabase's live memory, load and connections stay on Health.

## Questions in SQL

Phase 3, batch 8. Someone with `data.questions.run` types one statement on a Neon or Turso
database's Ask page and sees up to 100 rows of what it gives back. The connection's key may be one
that writes (once editing is on), so the database itself keeps a question to reading:

- **Neon** runs it in a read-only batch (`Neon-Batch-Read-Only`) through a cursor
  (`DECLARE … CURSOR FOR`, which takes only a query), after `SET LOCAL statement_timeout` of 3 s,
  and fetches 101 rows.
- **Turso** first asks libSQL to describe it (`describe` in the pipeline) and runs it only when
  SQLite says it only reads (`is_readonly`) and gives back rows; a query (`SELECT`, `WITH`,
  `VALUES`) is wrapped in `SELECT * FROM (…) LIMIT 101`, a `PRAGMA` or an `EXPLAIN` runs as typed.
- **Both** refuse a question with a semicolon in it before anything is sent (a second statement
  could end the read-only transaction), an empty one and one over 10,000 characters. Neon also
  refuses one that does not start with `SELECT`, `WITH`, `VALUES` or `TABLE`.
- **Supabase** through its Management API with the connection's access token, as its read-only role
  ([A Supabase project beyond its tables](#a-supabase-project-beyond-its-tables)). Airtable and
  Upstash have no Ask page.

A question is audited (`data.question`) by who asked, the connection and how many rows came back;
the question and its rows are not kept anywhere, and a refusal is logged by its code and title.
`data.questions.run` is apart from `data.read` because a question reads every column the key may read.

Download CSV asks the same question again and gives back the same at most 100 rows as a file,
`answer.csv`, through the kit's CSV writer: a value starting with `=`, `+`, `-`, `@` or a tab is
written with an apostrophe before it, so a spreadsheet shows it rather than runs it. Its audit row
adds `download: csv`, so the log tells a look from a copy that left the portal.

Saved questions are shared by everyone who may ask questions of that database: up to 20 per
database, each with a name of up to 60 characters. They are kept as one file in the portal's bucket,
`data/questions/<company>/<connection>.json`, never in a table and never in the audit log, since a
question can name a person; the backup copies it like any file, and removing the connection deletes
it.
