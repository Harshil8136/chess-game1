# @oltrem/core-audit

The one audit log of a client Worker (plan sections 10, 11 and 13): who did what, to what, with
what outcome. One writer, one table, written after the response so it costs the request
nothing, every row hashed so a changed row is found, and never a secret in it. The audit
module adds the page's routes, the export and the daily seal that chains the hashes into the
bucket.

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
| `actor` | an email for a person, a job or module name for the system, the vendor's email |
| `actorKind` | `person`, `system` or `vendor`; the plan's "Vendor actions loud" reads this |
| `action` | `<module>.<verb>`, lower case |
| `target` | what it was done to, as the module names it |
| `outcome` | `ok`, `refused` or `failed`: a refused action is recorded too |
| `details` | short, plain facts, at most 4 KB; a field whose name looks like a credential (`password`, `token`, `apiKey`, `client_secret`, …) is refused with `KIT-E-1102`; a whole record never belongs here |

A bad entry is refused with `KIT-E-1101` in the request, where the programming error is; only
the write itself is deferred. `record(entry)` writes at once and returns the row, for jobs.

## The automatic row

A module does not have to remember the audit. The pipeline tells the app of every change made
through a route (`onChange`, `@oltrem/core-http`), and `createChangeAudit` writes it as a row
after the response:

```ts
const app = createApp({
  // ...
  onChange: createChangeAudit({ db: (env) => env.DB, actorKind: (session) => 'person' }),
});
```

| Field | Value |
|---|---|
| `action` | `<module>.<verb>`: the route's `action`, or its method and fixed path segments |
| `target` | the route's last parameter, the thing changed |
| `outcome` | `ok` below status 400, `failed` from 500, `refused` between: the permission check's and the schema's refusals are recorded too |
| `details` | `method`, `route`, `status`, `ms`, and when there are any the error `code`, the caller's `ip` and `country` |

A module that writes its own row for the request (`record` or `after` with the request id) keeps
its richer row, and the automatic one is not written beside it: the writer remembers, in the
isolate, the request ids a row was asked for (`takeRecorded`), the newest 512.

## Reading and checking

`list({ actor, action, target, module, outcome, since, until, before, limit })` pages newest first (`module` reads every action of one module); the
`before` it returns is the cursor for the next page. `range(since, until, limit)` returns the
rows of a time range oldest first, for the export. `verify({ from, to })` recomputes the hash
of every row in the range and names the rows whose content no longer matches (it also returns
the stored hashes it read, in order, for the seal's chain), so the seal job
and the System status page can say "the log is intact" and mean it. The hash covers every field
but the sequence number; details are stored as canonical JSON (keys sorted), so the same facts
always hash the same.

The storage is the table `oltrem_audit_log`, migration `0003`, which depends on no other
module's table. Rows are text ids and ISO timestamps; the sequence number orders them.

## The audit module

```ts
const audit = createAuditModule<Env>({
  db: (env) => env.DB,
  bucket: (env) => env.FILES,
  actorKind: (session) => (asSession(session).access.kind === 'vendor' ? 'vendor' : 'person'),
});
// audit.module goes in the client's module list, on bit plane 9
```

| Route | Capability | What it answers |
|---|---|---|
| `GET /entries?outcome=&module=&actor=&target=&action=&before=` | `audit.read` | 50 rows, newest first, narrowed by outcome, module, person, what it was done to (`target`, such as an account id: the Users page's "Changes to their account") or one action (`iam.sign-in`: a person's Sign-in history), and the cursor for the next page; `oltrem_audit_log_target` (migration `0059`) keeps the target read to an index |
| `GET /seals` | `audit.read` | the newest 30 daily seals and whether each still holds |
| `GET /export?since=&until=` | `audit.export` (admin class) | whole UTC days as a CSV file, at most 10,000 rows, every cell quoted and a target or detail a spreadsheet would run as a formula defused (`csvFile` of `@oltrem/core-module`); the export is itself recorded as `audit.export` |
| `GET /home` | `audit.read` | the Home card: the rows of the last 24 hours and how the seal stands |

**The daily seal** is optional: the Modules page switches it (`audit.seal`, an extra of the
audit part in `@oltrem/core-config`), and a new portal starts with it off (since 2026-11-12); off,
`audit.seal`, `audit.recheck` and the check `audit.sealed` stop, and the log itself keeps every
row. While on, the job `audit.seal` runs once a day. It closes the UTC day before today:
the hash of the previous seal and of every row of that day, in order, hashed together
(`chainHash`), so each seal depends on all before it. A day with no row is sealed too, which
keeps the chain unbroken. The seal goes into `oltrem_audit_seals` (migration `0016`) and a copy
with every row's hash goes into the bucket at `logs/audit/<day>.json`, where the backup's
lifecycle rules keep it.

**The recheck.** The job `audit.recheck` runs every 15 minutes while it has seals to check, and
every six hours once a run finds none left for the day (it answers `'idle'`). It checks again the newest 7
seals (`RECHECK_SEALS`) not yet checked since today's UTC midnight, the one never checked or
checked longest ago first: a row changed since (its hash no longer matches), a row removed or
added (the chain no longer adds up) or a bucket copy that differs marks the seal broken and names
the problem. One run hashes at most `RECHECK_ROWS` (200) rows again, so it fits a tick's share of
the Free plan's 10 ms of CPU however busy the log is. A seal that fits is read once: `verify`
returns the stored hashes it read (`hashes`), and the chain is computed from them. A larger seal
is checked as a whole first, with the database joining its row hashes into one value
(`group_concat ... ORDER BY seq`), so the Worker does one digest and no work per row; its rows
are then checked in parts over the next runs, and the run that stops partway keeps its place
(the day and the next row) in the bucket at `logs/audit/recheck.json`, removed once no seal is
partly checked. With 96 runs a day this keeps up with about 2,700 rows a day; a busier log is
checked over more than a day, never skipped. The daily seal no longer rechecks: before the
change it rechecked all 7 seals in one run, which took most of a tick's CPU on its own
(`docs/records/2026-11-01-cpu-budget.md`).

**The check.** `audit.sealed`, in the audit lane of System status: failing when a seal is
broken, a warning before the first seal and when the last seal is more than two days old, ok
otherwise.

## Tests

Inside the Workers runtime against a local D1 with the migration applied: a row with every
field and a valid hash, a bad actor, kind, action, outcome or oversized details refused,
credential-like fields refused at any depth while `tokenCount` and `keyName` pass, the deferred
write and its reported failure, the filters and the paging, and a row changed by hand found by
its sequence number. The module's own tests: the seal chained and copied, sealed once a day, an
empty day sealed; a row changed and a row removed after the seal, each found by the next run
and failing the check; a large seal checked over three runs from its kept place, a change late
in it still found, and a row removed from it found by its first run; the entries paged; the CSV export, its quoting, a typed formula defused and its own audit row;
the Home card.
