# @oltrem/core-audit

The one audit log of a client Worker (plan sections 10, 11 and 13): who did what, to what, with
what outcome. One writer, one table, written after the response so it costs the request
nothing, every row hashed so a changed row is found, and never a secret in it. The daily seal
that chains the hashes into the bucket comes with the audit module in phase 5.

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
`before` it returns is the cursor for the next page. `verify({ from, to })` recomputes the hash
of every row in the range and names the rows whose content no longer matches, so the seal job
and the System health page can say "the log is intact" and mean it. The hash covers every field
but the sequence number; details are stored as canonical JSON (keys sorted), so the same facts
always hash the same.

The storage is the table `oltrem_audit_log`, migration `0003`, which depends on no other
module's table. Rows are text ids and ISO timestamps; the sequence number orders them.

## Tests

Inside the Workers runtime against a local D1 with the migration applied: a row with every
field and a valid hash, a bad actor, kind, action, outcome or oversized details refused,
credential-like fields refused at any depth while `tokenCount` and `keyName` pass, the deferred
write and its reported failure, the filters and the paging, and a row changed by hand found by
its sequence number.
