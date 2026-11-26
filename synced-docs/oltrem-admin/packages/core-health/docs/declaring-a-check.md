---
title: "@oltrem/core-health: declaring and running checks, status pages, watched addresses, tables, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-health/src/health.ts, watched.ts, test]
---

# @oltrem/core-health: declaring and running checks, status pages, watched addresses, tables, tests

> Part of [the @oltrem/core-health README](../README.md).

## Declaring a check

```ts
export const notes = defineModule({
  id: 'notes',
  version: '1.0.0',
  health: [
    {
      id: 'notes.store',
      lane: 'storage',
      summary: 'The notes table answers',
      run: async (env) => {
        await env.DB.prepare('SELECT 1 FROM notes LIMIT 1').first();
        return { status: 'ok' };
      },
    },
  ],
});
```

| Field | Rule |
|---|---|
| `id` | `<module>.<name>`, stable: the key of its row |
| `lane` | The group on the page (`storage`, `email`, `access`): lower-case letters, digits, dashes |
| `summary` | A few words for Status |
| `every` | Optional interval (`5m`, `1h`), else `CHECK_EVERY` (15m); a check that failed runs on every run until it passes |
| `run(env, ctx)` | `{ status: 'ok' \| 'warn' \| 'fail', message? }`; a throw, no answer in `DEFAULT_TIMEOUT_MS` (5 s) or another shape is a failure with the reason |

`@oltrem/core-module` refuses a bad id, lane, interval or summary when the module loads.

## Running the checks

```ts
const health = createHealth<Env>({ bindings: (env) => ({ db: env.DB }), modules, report });
modules.push(health.module);
```

The `health` module has the job `health.run` (`HEALTH_EVERY`, 5m) and routes under `/api/health`
behind `health.read` (bit plane 6): `GET /checks` (every listed row), `GET /budgets` (each budget
as `items`, the `plan`, its `limits`, the live `queue` backlog, and `key` while a missing key
leaves them unmeasured), `GET /requests` and `GET /requests/key/:subject`
([request figures](cloudflare-plans-budgets.md#request-figures)). Home's Status card is a module
part (how many fail or need a look).

Each run takes, in this order, checks waiting to confirm a failure, checks never run, then the
longest overdue, at most `CHECKS_PER_RUN` (12), so it fits the tick's query budget; the rest come
five minutes later. A run with nothing to confirm or waiting answers `'idle'` and sleeps
`HEALTH_IDLE` (30m); a first failure brings it back in five minutes, so a problem opens within
about 35 minutes. Run now checks at once.

Rows are written in one batch only when a check's status, message (first `MESSAGE_MAX`, 400
characters) or failure count changed, plus one row `STAMPS_ID` (`~checked`, never listed) holding
when each check last ran and how long it took. A pass or a warning resets the count. On the second
failure `onOpen(row, env)` is called once; on the next pass `onClose(row, env)`; a hook's failure
goes to `report(error, checkId)` and the run goes on.

`run(env, ctx)` runs every check at once and returns the ids by status, opened and closed.
`list(env)` returns rows by lane then id, leaving out checks no mounted module declares. Given
`off` (`@oltrem/core-config`), a switched-off module's checks (or a check whose own id is off,
such as `audit.sealed`) are not run or listed, and an open problem of theirs, or of an undeclared
check, is closed through `onClose`.

## Service status

Given `statusPages` (`pages(env)`, and `fetch` for tests), the check `health.status-pages` (lane
`services`, `STATUS_PAGES_EVERY`, 30m) reads each page's `<page>/api/v2/status.json` side by side,
`STATUS_PAGE_MS` (3 s) each, at that address only, 16 KB at most. The template names Cloudflare's
page and those of the sending email services whose definition names one (`status`). Only a major or
critical outage warns, its service first; a minor problem is OK in the page's words; a page that
does not answer or answers another shape is said and stays OK, so it never opens an alert. Outside
words are kept plain, 80 characters. It is an extra that starts off; off, no page is asked.

## Web addresses to watch

Given `watched` (`addresses(env)`, and `fetch` for tests), the check `health.addresses` (lane
`services`, `WATCHED_EVERY`, 15m) and the Owner's setting `health.watched_addresses`
(`WATCHED_SETTING`, Settings, Company): up to `WATCHED_MAX` (10) lines, each `https://…`, optionally
` | ` and words its page must hold (`https://shop.example.com | Add to cart`).

| Result | When |
|---|---|
| Fail (two runs open an alert) | Not 2xx, no answer in `WATCH_WAIT_MS` (4 s), unreachable (cause named), or the words not in the first `WATCH_BYTES_MAX` (64 KB, case ignored) |
| Warn | Slower than `WATCH_SLOW_MS` (2 s), or a 3xx (not followed; where it goes is named) |
| OK | Otherwise, or no lines |

Only public addresses (`publicAddress`, as the developer module's webhooks): `https://`, no user or
password, a dotted name, not a number or an inside name (`.local`, `.internal`, `.corp`). Messages
show host and path, never the query.

## Tables

| Migration | Table | Columns |
|---|---|---|
| `0009` | `oltrem_health` | `id`, `module_id`, `lane`, `status`, `message`, `checked_at`, `ms`, `failures`, `open_since`; written only by the job |
| `0014` | `oltrem_budgets` | `id`, `used`, `day`, `measured_at`, `tried_at`, `problem`; written only by `health.measure` |

## Tests

| File | What it proves |
|---|---|
| `test/health.test.ts` | Rows written; a problem opened on the second failure, `onOpen` once, `onClose` on a pass, a warning resetting the count; throws, timeouts and nonsense recorded with the reason; undeclared rows left out; the tick running the job, writing only changes, sleeping, twelve a run; the contract's refusals |
| `test/budgets.test.ts` | With a stand-in for Cloudflare: one call per measure, every figure read, CPU in ms, size from D1; warn and fail lines; jobs paused and resumed after midnight UTC; a refused or missing key named with its fix, never shown; the key's steps; Workers Paid's month, no pause past 90%; an unreadable plan as free; the queue's backlog |
| `test/status-pages.test.ts` | Declared only with pages; minor OK, major warns without an alert; no answer, 404, another shape, a move or a large answer said and OK; plain words; nothing asked while off |
| `test/watched.test.ts` | Each failure and warning; public addresses only; the query never shown |
| `test/parts.test.ts` | A switched-off module's checks not run or listed, its open problem closed, running again when back on |
