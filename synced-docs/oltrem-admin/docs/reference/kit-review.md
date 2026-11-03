---
title: "Kit review: from fine to best"
status: proposed
owner: vendor
last_verified: 2026-11-03
sources: [this repository at 03319b2, a dry-run build of templates/client, Cloudflare's Workers limits and Workers Logs pages read 2026-11-03 (the limits page again for the startup limit), docs/reference/open-source-ideas.md, docs/reference/browser-caching.md]
---

# Kit review: from fine to best

> **In plain words.** The kit has a great deal built: 25 modules, 12 core packages, strict gates
> and a record for every change. What keeps it at "fine" is not missing features but missing
> **proof and watching**: a server error leaves almost no trace, nothing stops the Worker from
> growing slower, no real client portal has gone through a phase's acceptance, and nothing
> checks the phone-first rule by machine. This page lists what was found on 2026-11-03, the
> evidence, the fix and its order. Feature ideas are in
> [the open-source ideas](open-source-ideas.md); this page is about the kit itself. The order of
> work across all products is in [the product plan](../product-plan.md).

## What was checked

The repository at `03319b2` (main on 2026-11-03): the request pipeline and the client
template's Worker, the verify chain's twelve gates, the size of each package's code and tests, a
dry-run build of `templates/client`, and the documents that say where things stand. Not checked:
the live portal's dashboard (no access from here), a run of the screens on a phone.

## Findings, ranked

| # | Finding | Evidence | Fix | Effort |
|---|---|---|---|---|
| K1 | **A server error leaves almost no trace.** Every module's `report` and the pipeline's 500s end in one `console.error(context, message)`: no stack, no route, no count, nothing in the database, nothing on a page, no alert. Workers Logs keeps 1 request in 10 (`head_sampling_rate: 0.1`), so 9 errors in 10 are never seen at all. | `templates/client/src/index.ts` (`report`), `templates/client/wrangler.jsonc` | an **error log**: each error kept in D1 grouped by its kind (area and message), with a count, first and last seen, the last stack and request id; listed on the Alerts page; emailed once per kind; writes capped so a loop cannot spend the day's D1 writes | M, **done** 2026-11-03 as alerts ([the record](../records/2026-11-03-error-log.md)) |
| K2 | **Nothing holds the Worker's size or CPU.** The client Worker is 1,635 KiB (492 KiB compressed); the measured cold start is about 45 ms of CPU and the 2026-11-01 median was 34 ms against the free plan's 10 ms. No gate fails when a change makes it bigger. | `wrangler deploy --dry-run` of `templates/client`; [browser caching](browser-caching.md) | a size budget gate (the compressed size, ratcheted down as it shrinks), then the cold start cut by loading rarely used modules' code only when their page is opened | S for the gate, **done** 2026-11-03 ([the record](../records/2026-11-03-size-gate.md)); the frame's script compacted, 3.2 KiB less, 2026-11-03 ([notifications](../records/2026-11-03-notifications.md)); the stylesheet and the frame's script served as static files beside the Worker, 498.3 to 477.5 KiB compressed, 2026-11-03 ([look 2](../records/2026-11-03-look-2.md)); the cut **dropped** 2026-11-03: Cloudflare's limits page counts a Worker's global scope against its own startup limit of 1 second, not a request's 10 ms, so code loaded on first use would move that work into a request; `wrangler check startup` measured 98 to 112 ms of local startup. The size-gate record's line that startup comes out of the 10 ms is wrong on that point |
| K3 | **No phase has passed its acceptance.** Every phase's last row waits on a sandbox client: a fresh account and a private client repository. Built is not yet proven. | [where things stand](../status.md) | the owner makes the account; `oltrem new client` and `npm run deploy` then run the acceptance; a record per phase | owner 15 minutes, then S |
| K4 | **The documents that say where things stand are a week old.** Both were last verified 2026-10-27; neither names Mail's add-on, the one-repository-per-client packing or this plan. | [where things stand](../status.md), [the roadmap](../roadmap.md) | bring both up to date; link this page and the plan. The index itself is full (32,726 of 32,768 bytes on 2026-11-03): let the docs gate count a record as indexed when the records' own index page links it, and move the records table there | S; the index split **done** 2026-11-03 ([records index](../records/README.md)); both documents **brought up to date** 2026-11-03 |
| K5 | **Phone first is a rule nothing checks.** R-12 is enforced by review only: no gate looks for a button without a name, a field without a label, a tap target under 44 px or a page wider than a phone. | the twelve gates in [what verify runs](verify.md) | a gate over the HTML every screen renders in its tests: names, labels, the viewport, the tap sizes in the tokens | M; names, labels, alt, ids and the viewport **done** 2026-11-03 over 101 pages ([the record](../records/2026-11-03-phone-a11y-check.md)); tap sizes and page width need a browser in verify, a dependency for the owner's yes |
| K6 | **Tests are uneven.** Some modules carry about one line of test per four of code (`analytics`, `bookings`, `tasks`, `timeclock`) where the core carries one to one; nothing records coverage. | line counts of `src` and `*.test.ts` per package | a coverage figure per package written by the tests gate, held by a ratchet so it can only rise | M, **done** 2026-11-03 on the owner's yes ([the record](../records/2026-11-03-coverage.md)): 37 packages, 83.8% to 100% of lines; the line counts above were a weak proxy, the measured figures are higher |
| K8 | **The screens' stylesheet is at its limit.** It stood at 65,535 bytes against the 64 KiB its test allows (2026-11-03); the bell of the notifications was drawn with classes it already had. The next screen that needs a new rule fails the test. | `packages/screens/test/css.test.ts`; [the notifications record](../records/2026-11-03-notifications.md) | trim before adding: rules only Mail uses could ship with Mail's pages, and long Tailwind lists shared by many screens could become one named rule; the limit itself is kept | S to M; Tailwind's colour fallbacks dropped, 64,133 bytes, 2026-11-03 ([look 2](../records/2026-11-03-look-2.md)); comment words no longer compile to classes and the switch's knob is one named rule, 65,032 to 63,541 bytes, 2026-11-03 |
| K7 | **The phone tests owed are scattered.** Each change since 2026-10-21 lists its own phone steps in its own record or message; nobody can see which are still owed. | the records since 2026-10-21 | one living list of owed phone tests, ticked as they pass | S, **done** 2026-11-03 ([phone tests owed](../phone-tests.md)) |

## Order of work

1. K1 the error log (the owner's standing rule: thorough error logs and flags).
2. K4 the documents, with this page (same push as the plan).
3. K2 the size gate, then K7 the one list of owed tests.
4. K3 as soon as the owner makes the sandbox account.
5. K5, K6 (both done; the cold-start cut of K2 was dropped, see its row).
6. K8 before the next new screen rule.

## Sources

- [Workers limits: CPU time is 10 ms on the free plan, error 1102 when exceeded](https://developers.cloudflare.com/workers/platform/limits/)
- [Workers Logs: 200,000 log events a day on the free plan, and head-based sampling](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
