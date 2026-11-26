---
title: "@oltrem/data: Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src; split from modules/data/README.md]
---

# @oltrem/data: Tests

> Part of [the @oltrem/data README](../README.md).

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
- `test/supabase.test.ts`: the Management API with the access token (only the token sent, its
  words blanked from a refusal, the logs' SQL and time range, advisors sorted, backups,
  functions, a question wrapped and cut to 100 rows, the overview's one catalogue question and
  its refusal, the usage read part by part (the organization's parts named when refused, the
  question needed), the fix said without a token), a Supabase
  project's users, buckets, files and health read from scripted answers (the headers of a secret and a legacy key, Basic for the metrics, a full page
  with a next one, a folder told from a file, a metrics page with figures missing, answers of the
  wrong shape refused), and the three routes through the pipeline: the Owner reads them, a
  manager without `data.insights.read` is refused, a bad page or bucket is refused, another
  service is refused, and users and storage are marked audited.
- `test/warnings.test.ts`: what each service's answer needs a look for: services not healthy
  (one starting left out), read-only mode, the disk at 90%, Turso's blocks and its allowance at
  80%, an Upstash database not active, its requests, storage and cost near the plan; nothing for
  figures under the line or limits not given. `test/usage.test.ts` also runs `data.services`
  through the route's connections: nothing to look at, then a suspended Upstash database failing
  it with its name, and a connection without a key not asked.
- `test/usage.test.ts`: Neon's endpoint from its host and its project found among the key's,
  the figures read with no owner's email kept, only the API key sent and only GETs; Turso's
  organization and database from its host (the longest slug first), its usage and blocks; no key,
  too many projects, another account and answers without the usage refused in words; and the route
  through the pipeline: the Owner reads both, a key added with Change key keeping the database's
  token, a manager without `data.insights.read` refused, the key marked optional. Upstash: the
  database found among the account's by its endpoint, its plan, limits and use, only the account
  and the API key sent in Basic auth; no key or email, and another account's key, refused in words;
  through the route with both optional fields, and an email that does not look like one refused.
- `test/supabase-sign-in.test.ts`: Sign in with Supabase's tokens: when one is due (within five
  minutes or an unknown end; never a pasted token), a renewal through the relay (new fields, the
  relay's 400 as the sign-in ended, any other answer as try again, a relay that is not https), and
  through the pipeline: a due token renewed, kept and read with, then not renewed again; table
  reads never renewing; a refresh token another request just spent read back; no relay, no renewal.
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
