# @oltrem/core-audit

The one audit log of a client Worker: who did what, to what, with what outcome. One writer, one
table (`oltrem_audit_log`, migration `0003`), written after the response, every row hashed so a
changed row is found, never a secret. The audit module adds the page's routes, the export, the
90-day archive and the optional daily seal.

## Recording

```ts
const audit = createAudit({ db: env.DB });

// in a route, after the work: the write runs under waitUntil (plan 11)
audit.after(ctx.waitUntil, {
  actor: identity.email,
  actorKind: 'person',
  action: 'settings.update',
  target: key,
  outcome: 'ok',
  details: { from, to },
  requestId: ctx.requestId,
}, report);
```

| Field | Rule |
|---|---|
| `actor` | An email for a person or the vendor, a job or module name for the system |
| `actorKind` | `person`, `system` or `vendor` |
| `action` | `<module>.<verb>`, lower case |
| `target` | What it was done to, as the module names it |
| `outcome` | `ok`, `refused` or `failed` |
| `details` | Short plain facts, `DETAILS_LIMIT` (4 KB); a field named like a credential (`password`, `token`, `apiKey`, `client_secret`) at any depth is `KIT-E-1102` |

A bad entry is `KIT-E-1101` in the request; only the write is deferred. `record(entry)` writes at
once, for jobs. A module row also carries `name` (the record's name then, shown under "To what"),
`changes` (`{ field: { from, to } }` from `changesOf(before, after, fields?, personal?)`), and
`placeName` or `person`. `changesOf` cuts each side to `FACT_LIMIT` (120), names at most
`CHANGES_LIMIT` (10) fields with the rest in `more`, drops credential-like fields, and keeps a
`personal` field as `{ hidden: true }`, since the log is kept for good and not erased by a privacy
request. `shortFact` cuts one value (a list to `LIST_LIMIT`, 40). `recorded` (`@oltrem/iam`) hands a
module's work `note(facts)`, written whatever the outcome.

## The automatic row

```ts
const app = createApp({
  // ...
  onChange: createChangeAudit({ db: (env) => env.DB, actorKind: (session) => 'person' }),
});
```

The pipeline's `onChange` (`@oltrem/core-http`) is written as a row after the response:

| Field | Value |
|---|---|
| `action`, `target` | The route's `action` (or method and fixed segments), its last parameter |
| `outcome` | `ok` under 400, `failed` from 500, `refused` between (permission and schema refusals too) |
| `actor` | The caller; `outside` (system) for a call refused before anyone was let in |
| `details` | `method`, `route`, `status`, `ms`, and when present `code`, `reason`, `fields`, `download`, `bytesOut`, `notLoggedBefore` |

Every row of a request, a module's own too, gets what the pipeline noted (a fact the module gave
wins; a job's row gets none): `ip`, `country`, `region`, `city` (never finer), `asn`, `network`,
`browser`, `agent` (160 characters), `via` and `key` (an API key's public id; `local` on the owner's
computer) and `session` (the IAM device id).

Rows are written for every change; a read refused outside a page's own render; a read that handed a
file over; a read marked `audited` (connected data, and the audit log itself, `audit.read`, PCI DSS
10.2.1.3); and every API key call. Ordinary reads are not rows. Reads are held back so a stolen key
cannot spend the daily writes: the same read of the same record is quiet for `SAME_READ_QUIET_MS`
(10 minutes), a caller writes `READ_ROWS_A_MINUTE` (10) read rows a minute per isolate, outside
refusals share it per address, and what was held back is counted as `notLoggedBefore`. Changes,
downloads and a known caller's refusals are never held back. A module that writes its own row for
the request keeps it, and the automatic one is skipped (`takeRecorded`, the newest 512 ids).

## The public addresses

`createHookAudit` is the app's `onHook`: each hook call is a row by `outside` (system),
`<module>.received`, target what the handler noted, details `method`, `route` (the pattern, never
the address), `status`, `ms`, `bytesIn`, `bytesOut`, `ip`, `country`, `browser` and the handler's
notes. At most `HOOK_ROWS_A_MINUTE` (30) a route per isolate; the rest are counted on the next row.

## Reading and checking

`list({ actor, action, target, module, outcome, kind, q, count, since, until, before, limit })` pages
newest first (`kind` `people` or `automatic`; `q` anywhere, `%` and `_` literal; `count` adds counts
across every page) with a `before` cursor. `range(since, until, limit)` gives a range oldest first.
`verify({ from, to })` recomputes each row's hash and names those that no longer match, returning the
stored hashes for the seal. The hash covers every field but the sequence; details are canonical
JSON.

## The audit module

```ts
const audit = createAuditModule<Env>({
  db: (env) => env.DB,
  bucket: (env) => env.FILES,
  actorKind: (session) => (asSession(session).access.kind === 'vendor' ? 'vendor' : 'person'),
});
// audit.module goes in the client's module list, on bit plane 9
```

| Route | Needs | What it answers |
|---|---|---|
| `GET /entries` | `audit.read` at the company | Each reading is a row (`audit.read`). 50 newest first, narrowed by `outcome`, `module`, `actor`, `target` (index `oltrem_audit_log_target`, migration `0059`), `action`, `since`, `until`, `kind`, `ip`, `asn`, `key`, `session`, `signal` (`downloads`, `flagged`), `q` (100 characters); `count=1` adds `counts`, `signals` and `days` (in the reader's clock by `offset`, over `countSince`); `before` pages |
| `GET /since?at=` | `audit.read` at the company | Home's What changed: others' changes that went through since `at` (a day back by default, `SINCE_DAYS` 7 at most), by action, the first `SINCE_KINDS` (6) with counts and the total; not the asker, refusals, the system, or sign-ins and sign-outs; one grouped read on `oltrem_audit_log_at`; an extra that starts off (`audit.since`) |
| `GET /seals` | `audit.read` at the company | The newest 30 seals and whether each holds |
| `GET /export?since=&until=` | `audit.export` (admin) at the company | Whole UTC days as CSV, `EXPORT_MAX` (10,000) rows, through `csvFile`; recorded as `audit.export` |

Home's card (a module part): the last 24 hours' rows and the seal, nothing about the seal while
`sealing` answers false.

| Job | Pace | What it does |
|---|---|---|
| `audit.seal` | Daily | Closes yesterday (UTC): the previous seal's hash and each row's, in order (`chainHash`); an empty day too. Into `oltrem_audit_seals` (migration `0016`) and `logs/audit/<day>.json` |
| `audit.recheck` | 15 minutes, idle 6 hours | Rechecks the newest `RECHECK_SEALS` (7) not checked since midnight, oldest check first; a changed, removed or added row or a differing copy marks it broken. At most `RECHECK_ROWS` (200) rows a run; a larger seal is checked whole by the database (`group_concat ... ORDER BY seq`) then in parts, its place kept at `logs/audit/recheck.json`; about 2,700 rows a day keep up |
| `audit.archive` | Hourly, idle daily | Keeps `KEEP_DAYS` (90) in D1: older rows, oldest first, `ARCHIVE_ROWS` (1,000) a run, one UTC day at a time, written whole with hashes to `logs/audit/rows/<day>/<first seq>.json` (`ARCHIVE_PREFIX`) before removal, by the same bounds as the read |

The seal is an extra (`audit.seal`) that starts off; off, the seal, recheck and `audit.sealed`
stop and the log keeps every row. `audit.sealed` (lane `audit`) fails on a broken seal, warns before
the first and when the last is over two days old (its message points at Features). The export reads
archive files for older days, at most `ARCHIVE_FILES` (40), and fails by name (`KIT-E-0500`) on a
missing or wrong file. Archived rows are personal data kept in the bucket until removed by hand;
the privacy search reads only the database's 90 days.

## Tests

Inside the Workers runtime on a local D1: `test/audit.test.ts` (a full row and its hash; bad
actor, kind, action, outcome or size; credential fields at any depth while `tokenCount` passes; the
deferred write; filters and paging; a hand-changed row found), `test/changes.test.ts` (the
automatic row, held-back reads, `notLoggedBefore`), `test/hooks.test.ts` (hook rows and their
limit), `test/module.test.ts` (the seal chained, copied, once a day, an empty day; changes and
removals found; a large seal over three runs; What changed by kind and its exclusions; entries;
the archive and the export reading it; the CSV export and its formula guard; Home with and without the seal).
