---
title: "A faster Worker start, and the records' own index (2026-11-03)"
status: record
owner: vendor
last_verified: 2026-11-03
sources: [modules/providers/src/definition.ts; modules/providers/src/definitions/email.ts; scripts/lib/docs.mjs; docs/records/README.md; docs/reference/kit-review.md K2 and K4]
---

# A faster Worker start, and the records' own index

> **In plain words.** Two small fixes from the kit review. First, every time a portal's Worker
> starts, it checked each of the kit's twelve email provider descriptions against their rules
> and copied them, work whose answer never changes; the kit's tests already make the same
> check before anything ships, so the start now skips it. Second, the documentation's main index
> had filled its size budget, so no thread could add a document; the list of dated records moved
> to its own page.

## What the start costs, measured

The client Worker's bundle, built as a deploy builds it, was loaded in Node 22 with a stand-in
for `cloudflare:workers` and profiled (`--cpu-prof`). Node is not workerd, so the figures are
for comparison only:

| Part of the start | CPU, Node, sampled |
|---|---|
| reading and compiling the 1.6 MB bundle | about 115 ms |
| the router learning every route (`createApp`, `mount`) | about 30 ms |
| `warmClock`, kept on purpose ([the CPU budget record](2026-11-01-cpu-budget.md)) | about 22 ms |
| checking the twelve kit email provider definitions (`defineProvider`) | about 16 ms, now gone |

Loading the whole bundle took a median of about 185 ms of CPU after the change against about
209 ms before, five runs each.

## What changed

| Part | Change |
|---|---|
| `@oltrem/providers` | `kitProvider(definition)` freezes a definition the kit ships without checking it; the kit's twelve email definitions use it. `defineProvider`, which checks, stays for a client's own definition. `test/definitions.test.ts` checks every kit definition with `definitionProblems`, as before |
| the docs gate | a file under `docs/records/` is indexed when [the records index](README.md) links it (or the main index does); the main index links the records index |
| `docs/README.md` | the records table moved to `docs/records/README.md` (128 rows); the main index went from 32.7 KB to 13.8 KB |

## How it was verified

- `@oltrem/providers` tests: 93 pass.
- `scripts/phase0.test.mjs`: 18 pass, a new one among them (a record linked from neither index
  is refused; linked from the records index, it passes).
- The full verify chain; its summary is in the commit.
- Not measured: the start on Cloudflare itself (no sandbox).
