---
title: "@oltrem/core-health: Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-health/src; split from packages/core-health/README.md]
---

# @oltrem/core-health: Tests

> Part of [the @oltrem/core-health README](../README.md).

## Tests

Inside the Workers runtime against migrations 0008 and 0009: two checks run and their rows
written; a problem opened on the second failure in a row and not the first, `onOpen` called once,
closed on the next pass with `onClose`, the failure count reset by a warning; a check that throws,
one that does not answer in time and one that answers nonsense recorded as failures with the
reason; the rows listed by lane with an undeclared one left out; the tick running the checks through
the health job beside the scheduler; the job running the checks whose time has come, writing a
row only when a result changed, sleeping unless a failure waits to be confirmed, and taking twelve
checks at most a run; and the contract's refusals of a bad check, migration, setting or error. The budgets, with a stand-in for Cloudflare's API: nothing added without the
option; one call with the token and the UTC day, every figure read, only KV writes counted, the
CPU time in milliseconds and the size from D1; the check warning at 75% and failing at 95%; the
other jobs paused through the scheduler while the health jobs run, and running again after
midnight UTC; a 403 keeping the last figure with the reason; a key Cloudflare refuses on a 400
named with its fix; a missing token named once for the
budgets it leaves unmeasured; the token in no reading; the analytics errors named; and the key's
steps for a refused, narrow or missing key, the form with the recipe's permissions and the
client's, gone once Cloudflare takes the key. Workers
Paid: the month asked from the 1st, the budgets it includes, 96% failing without a pause, the
month's figures not counting once back on the free plan; a plan that cannot be read taken as
free; and the queue's backlog read live, warning at 20 minutes, failing at 90, and a backlog that
cannot be read warning. Service status, with a stand-in for the status pages
(`test/status-pages.test.ts`): declared only when the portal names the pages; a minor problem OK
in the page's words, each page asked at its status address; a major outage warning, its service
named first, and no alert opened; a page that does not answer, answers 404 or another shape said
so and OK; a move not followed and an answer larger than a status not read; an outside page's
words kept plain and short; and nothing asked while its extra is off.
