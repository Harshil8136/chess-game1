---
title: "@oltrem/data: the timed checks, the services, Airtable sign-in, editing, hidden columns"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/src/module.ts, warnings.ts, brands.ts, changes.ts, dialects/]
---

# @oltrem/data: the timed checks, the services, Airtable sign-in, editing, hidden columns

> Part of [the @oltrem/data README](../README.md).

## The timed checks and Home

Both run under the part's one extra, Database checks (`data.watch`), off on a new portal (and on
one that saved its switches before it existed, core-config migration `0077`).

| Check | What it does |
| --- | --- |
| `data.connections` (lane `data`, `WATCH_EVERY` 1 h) | Calls up to `WATCH_MAX` (5) connections at a time, the rest in turn by the hour (`watchTurn`), each within `WATCH_WAIT_MS` (5 s). Every outcome is kept as a check (only when changed, or daily; never audited), so the page, Home and Status agree. A key that will not open is retried daily, or at once after a change. Any connection not answering fails it with its name and words |
| `data.services` (lane `data`, hourly) | Asks each Supabase, Turso and Upstash connection with an access token or API key what needs a look, `SERVICES_MAX` (3) a run (`src/warnings.ts`). **Fails** when the service stopped something: an unhealthy Supabase service (not one starting), read-only mode, Turso's blocked reads or writes, an inactive Upstash database. **Asks for a look** near a limit: a Supabase disk at `DISK_NEAR` (90%), Turso's rows, storage or sync, or Upstash's requests, storage or cost at `NEAR` (80%), or a service that could not be asked. Supabase is asked three things apart (`watch()`: health, read-only, disk) |

Home's Databases line reads the kept checks: "2 of 3" answered, failing, "not checked yet", or
None and Off. Without Database checks it shows the checks people made.

## The services

A connection is a providers instance of kind `data` ([`@oltrem/providers`](../../providers/README.md)),
its key sealed and pinned to its host.

| Service | Dialect | How it is read | How it connects |
| --- | --- | --- | --- |
| Turso | `libsql` | SQL over HTTP, `POST /v2/pipeline` | The address and a `--read-only` token (one that writes once editing is on); no sign-in offered |
| Neon | `neon` | The HTTP SQL endpoint, a read's queries in one read-only batch | A `--access read_only` role's connection string (OAuth is partners-only) |
| Supabase | `postgrest` | The Data API: the OpenAPI description, then `GET` | Sign in with Supabase (the Apps relay), or the secret key (no read-only key exists) |
| Airtable | `airtable` | The metadata API (fields, views, the key's level, in one call), then records, in a view when picked | Sign in with Airtable, or a token with `data.records:read` and `schema.bases:read` |
| Upstash Redis | `upstash-redis` | REST `POST /pipeline`, read commands only | The REST address and the Read Only token |

`src/brands.ts` holds each logo (Simple Icons, CC0) and line; `GET /services` answers `mark`, `line`,
`signIn` for the Apps page.

## Sign in with Airtable

Four sealed fields: `token` (an hour), `refresh` (60 days, replaced on each use), `expires` (ms) and
`client` (the Vendor's integration id; a public client with PKCE, so the portal renews by itself).
Before each read, `airtableDue` asks whether the token ends within five minutes; if so,
`airtableRenew` posts to `https://airtable.com/oauth2/v1/token` and `registry.renew` keeps the new
three only over the credential opened. Then:

- **409** (another request renewed): the stored tokens are read back; still due, "try again in a
  minute".
- **Refused** (401, `invalid_grant`, `invalid_client`): read back once, else `KIT-E-4101` with
  `SIGN_IN_ENDED` (remove and sign in again, or paste a token); under Database checks a failed check
  shown as "Airtable's sign-in has ended".
- **Anything else:** `KIT-E-4101`, try again.

A pasted `pat…` token is never renewed. Renewals are not audited; the sign-in is (`providers.create`).

## Editing

Off until a manager presses **Turn on editing** (`data.manage`, fresh sign-in), kept as the `edits`
option; a key for another host drops it and the kept changes. The key must then write. Refusals: a
read-only key (`KIT-E-4107`), a value refused with the database's words (`KIT-E-4108`), else
`KIT-E-4101`.

- **What can change:** Supabase, Neon and Turso tables with a primary key (`<pk/>`, `pg_index`,
  `table_xinfo`); never a view, key columns, computed columns, binary, JSON or lists, values over
  `EDIT_MAX` (10,000 characters) or a Supabase number past 2^53. A form keeps at most 32,000
  characters in boxes (`withinForm`). Airtable and Upstash are read only.
- **Types:** for Turso, text in a number column is sent as a number or refused.
- **A change:** only differing values are written, by one UPDATE or PATCH matching the key and each
  old value (`IS`, `IS NOT DISTINCT FROM`, `eq.`, `is.`), values as parameters. No match is
  `KIT-E-4105`; the form shows what changed since, so a second press never overwrites unseen.
- **A delete** (an Owner's) keeps the row first (unless clearly refused); cascades are not put back,
  and the confirm says so.
- **Undo:** once each, only while the values are still what it made (else `KIT-E-4105`); a delete
  is put back (Neon with `OVERRIDING SYSTEM VALUE`); an undo is listed as a change.
- **Kept** in the bucket at `data/changes/<company>/<connection>/<id>.json` (key, values before and
  after, who, when) for `KEEP_DAYS` (30), pruned on listing and hourly, and on removal or a host
  move; left out of backups (`NOT_COPIED`) and of privacy searches.
- **Audit:** `data.row-change`, `data.row-delete`, `data.row-undo` with the table, a numeric key
  (else only key column names), the change id and changed columns, never values; a refusal by code
  and title only.

## Hidden and masked columns

For people without `data.hidden.read`, a manager sets each column Shown, Masked or Hidden, kept as
the `columns` option. A hidden column is left out everywhere; a masked one shows `••••` and its last
four characters when eight or more long. Neither is searched, sorted or sent back by a form; a key
column cannot be hidden. Questions in SQL read every column, so give `data.questions.run` only to
those who may see them. Kept through a new key for the same host.
