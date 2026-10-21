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

## Reading and checking

`list({ actor, action, outcome, since, until, before, limit })` pages newest first; the
`before` it returns is the cursor for the next page. `range(since, until, limit)` returns the
rows of a time range oldest first, for the export. `verify({ from, to })` recomputes the hash
of every row in the range and names the rows whose content no longer matches, so the seal job
and the System health page can say "the log is intact" and mean it. The hash covers every field
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
| `GET /entries?outcome=&before=` | `audit.read` | 50 rows, newest first, and the cursor for the next page |
| `GET /seals` | `audit.read` | the newest 30 daily seals and whether each still holds |
| `GET /export?since=&until=` | `audit.export` (admin class) | whole UTC days as a CSV file, at most 10,000 rows; the export is itself recorded as `audit.export` |
| `GET /home` | `audit.read` | the Home card: the rows of the last 24 hours and how the seal stands |

**The daily seal.** The job `audit.seal` runs once a day. It closes the UTC day before today:
the hash of the previous seal and of every row of that day, in order, hashed together
(`chainHash`), so each seal depends on all before it. A day with no row is sealed too, which
keeps the chain unbroken. The seal goes into `oltrem_audit_seals` (migration `0016`) and a copy
with every row's hash goes into the bucket at `logs/audit/<day>.json`, where the backup's
lifecycle rules keep it. Each run then rechecks the newest 7 seals: a row changed since (its
hash no longer matches), a row removed or added (the chain no longer adds up) or a bucket copy
that differs marks the seal broken and names the problem.

**The check.** `audit.sealed`, in the audit lane of System health: failing when a seal is
broken, a warning before the first seal and when the last seal is more than two days old, ok
otherwise.

## Tests

Inside the Workers runtime against a local D1 with the migration applied: a row with every
field and a valid hash, a bad actor, kind, action, outcome or oversized details refused,
credential-like fields refused at any depth while `tokenCount` and `keyName` pass, the deferred
write and its reported failure, the filters and the paging, and a row changed by hand found by
its sequence number. The module's own tests: the seal chained and copied, sealed once a day, an
empty day sealed; a row changed and a row removed after the seal, each found by the next run
and failing the check; the entries paged; the CSV export, its quoting and its own audit row;
the Home card.
