---
title: "@oltrem/data: a Supabase project beyond its tables, usage, questions in SQL"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src/dialects/supabase.ts, dialects/usage.ts, dialects/ask.ts, questions.ts, pages.tsx]
---

# @oltrem/data: a Supabase project beyond its tables, usage, questions in SQL

> Part of [the @oltrem/data README](../README.md).

## A Supabase project beyond its tables

With the project's secret key, read when a page opens and never kept, one call each:

- **Users** (`/auth/v1/admin/users`, 25 a page): personal data, so `data.insights.read` (no
  ready-made role gives it), each read audited without what it showed.
- **Storage**: buckets (`/storage/v1/bucket`), then one folder (`/storage/v1/object/list/<bucket>`,
  100 at a time; a folder has no id); files listed, never opened. With the access token, the region
  and each bucket's file count and size from `storage.objects`.
- **Health** (`/customer/v1/privileged/metrics`, Prometheus text, Basic `service_role`): memory,
  the `/data` disk, one-minute load, `postgres` connections and size, the connection limit; a
  missing line leaves its figure out.

Another service answers `KIT-E-0422` ("only from Supabase projects"); `canInsights` hides the chips.

With an **access token** (an optional field; a personal one reaches every project of its account,
so Sign in with Supabase is narrower), through the Management API (`api.supabase.com`), only the
token sent, only reads:

| Page | What it reads |
| --- | --- |
| Requests | `/analytics/endpoints/usage.api-counts?interval=`, by service |
| Logs | `/analytics/endpoints/logs` with the portal's own ClickHouse SQL (newest 100, last hour or day; a search as an escaped `ilike`); audited |
| Advisors | `/advisors/security`, `/advisors/performance`, most serious first; https guide links only |
| Backups, Functions | `/database/backups`, `/functions` |
| Settings | Health (`/health?services=db,rest,auth,storage,realtime,pooler`), sign-in settings (`/config/auth`, never keys or templates), `/ssl-enforcement`, `/network-restrictions` (a count of ranges, never addresses), extensions (`pg_extension`) |
| Ask | `POST /database/query/read-only`, wrapped in `select * from (…) as question limit 101` |

An answer of another shape is refused; with no token, `KIT-E-0422` says how to add one.

**Sign in with Supabase** also seals the Management API's `access` (an hour), `refresh` and
`expires`, never on a form (`DERIVED`). Before a Management read, `supabaseDue` checks for five
minutes left and `supabaseRenew` posts to the connect relay's `/renew/supabase` (https only), kept
with `registry.renew`. The relay's 400 is read back once, else `SUPABASE_SIGN_IN_ENDED`. Key-based
reads never wait on it; with no relay the token is used as it is.

## A database's usage

The Usage tab (for `data.insights.read`) reads each service's management API with an optional key
(GETs only, the key alone as bearer, words blanked; `dialects/usage.ts`), never kept:

| Service | What it reads |
| --- | --- |
| Neon | An API key (best project-scoped): the endpoint id from the host, the key's projects (10 at most, five at a time), then the project's usage ("not for billing") and branches; the owner's email not kept |
| Turso | An API token: the organization as the longest slug ending the host's first label, the database and its month's usage, the account's billing-cycle use and its plan's quotas (`plan_id`) |
| Upstash Redis | The account email (plain config) and a read-only API key in Basic auth: the databases without passwords (`?credentials=hide`), this one by endpoint, its stats (commands, reads, writes, requests, cost, storage, keys, connections, hit rate), plan and limits |
| Supabase | The access token: the project, its organization's plan and entitlements, disk, read-only mode, compute, functions, and one read-only question (database size, Storage files, users and monthly actives). Meters against known limits (`PLAN_ALLOWANCE` in `pages.tsx` for published allowances); egress and the bill link to Supabase |

A key reaching no match says how to make one that does.

## Questions in SQL

With `data.questions.run`, one statement on a Neon or Turso database's Ask page, up to 100 rows. The
database keeps it reading even with a key that writes:

- **Neon**: a read-only batch (`Neon-Batch-Read-Only`), a cursor (`DECLARE … CURSOR FOR`), `SET LOCAL
  statement_timeout` 3 s, 101 rows fetched; it must start `SELECT`, `WITH`, `VALUES` or `TABLE`.
- **Turso**: libSQL's `describe` first, run only when `is_readonly` and it returns rows; queries
  wrapped in `SELECT * FROM (…) LIMIT 101`, `PRAGMA` and `EXPLAIN` as typed.
- **Both** refuse a semicolon, an empty question and one over `QUESTION_MAX` (10,000 characters).
- **Supabase** through the Management API as its read-only role; Airtable and Upstash have none.

Audited `data.question` (who, connection, row count), never the question or rows. **Download CSV**
asks again and writes `answer.csv` through the kit's CSV writer (formula starts escaped), audited
with `download: csv`. Saved questions: `SAVED_MAX` (20) a database, names up to `SAVED_NAME_MAX`
(60), one bucket file at `data/questions/<company>/<connection>.json`, deleted with the connection.
