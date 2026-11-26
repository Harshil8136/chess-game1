---
title: "@oltrem/campaigns: errors, not built yet, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src/errors.ts, modules/campaigns/test]
---

# @oltrem/campaigns: errors, not built yet, tests

> Part of [the @oltrem/campaigns README](../README.md).

## Errors

| Code | When |
| --- | --- |
| `KIT-E-2501` | not possible at this stage |
| `KIT-E-2502` | not ready to send (the detail names what is missing) |
| `KIT-E-2503` | the list could not be read |
| `KIT-E-2504` | the list is longer than the settings allow |
| `KIT-E-2505` | an unsubscribed or complaining address stays on the list |

## Not built yet

- The unsubscribe page is English only.
- Opens and clicks are first times, not counts.
- No segments: a file or a saved list.
- The mailbox provider is read from the domain alone (a Google-hosted company domain counts as
  other).
- A sent campaign's files are never removed after a time.
- The watch reads at a run's start, so it pauses at most one run after the limit.

## Tests

In the Workers runtime beside IAM, the email module stood in for (a scripted bulk pipe, saved
templates and lists) over real tables. `campaigns.test.ts` covers the list and merge fields, the
escaped HTML and one-click headers, place access, what blocks a start, the sender, tests, runs
within limits under keys written first, the stages, the unsubscribe scopes and forged links, the
warm-up, figures, the audit, approvals (including alone), unclear people, settling a dead run,
provider stops, pace and hours, people added and taken off mid-run, back to draft, room today, plan
limits, versions, files for everyone and each person, the watch and its pause, the summary, results
by provider, the download, and the health checks, and rows read. `steps.test.ts` holds a draft's
four steps; `add-people`, `from-list`, `page-answers`, `tab-notice` and `unheard` hold the page's
Add people, Send email from a list, answers after a press, the Gmail tab line and the no-reports
notice. The client template's screens test runs a campaign end to end on the pages.
