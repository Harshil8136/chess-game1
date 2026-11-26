---
title: "@oltrem/email: bulk mail's pipe, the allowance, Ready to send"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/bulk.ts, files.ts, usage.ts, ready.ts, routes.ts]
---

# @oltrem/email: bulk mail's pipe, the allowance, Ready to send

> Part of [the @oltrem/email README](../README.md).

## Bulk mail's pipe

`createEmail(...).bulk` hands slices of messages to the provider from the tick, not the queue (a
queue message per email would spend the free plan's 10,000 queue operations a day).

| Part | What it does |
| --- | --- |
| `bulk.route(env, tenantId, senderId, { files? })` | The instance the sender's domain was set up through while active or a failover, else the active one; never switched mid-send. Answers `batch` (100 for Resend, 1 without a batch), `repeatable` (the provider honours a key), `left` (`{ left, window, resets }` or null) and `files` (bytes a message may carry; `files: true` makes the batch 1). A removed, everyday-only or not-passing sender is the reason it cannot |
| `bulk.send(env, { tenantId, senderId, template, items, key, tag?, files? })` | One slice: one batch call under `key`, or one call each, `PARALLEL` (6) at a time. The do-not-mail list and `lists.unreachable` are read at the send (skipped as `no mail reaches it (...)`). Every result is kept in `email_messages` in one statement. Items with `attachments` go one per call |
| `emailed(env, session, limit)` | The addresses the person wrote to from Write lately, for a campaign's **From your email** |
| `files` | A campaign's files, in Write's tables with owner `campaign`: `on`, `add` (`person` `*`, an address, or empty for the list's file column; `CAMPAIGN_FILES_MAX` 1,000 and `CAMPAIGN_FILES_BYTES` 1 GB; one over `FILES_MAX_BYTES` goes as a link), `list`, `remove`, `removeAll`, `links` (a day-long link per file a run sends). `email.files` never removes them |
| Each person's outcome | `sent` (provider id); `refused` for good, with the words; `skipped` (do-not-mail); `repeat`, no answer from a keyed provider: sent again under the same key; `unclear`, no answer from an unkeyed one: never sent again by itself; `again`, nothing sent (a 503 too): a later run. No answer is sorted by `providerFailure` (`src/routes.ts`) |
| The run stops | On slow down, allowance used up, a refused key, account or domain, or a failure: the rest `again`, `stop` saying why and the seconds to wait |

## Allowance

`createEmail(...).usage` reads each provider's used and left through the providers module's
`usage` block, at most every `USAGE_FRESH_MS` (15 minutes) when a page or the bulk engine needs it,
kept on the instance. Between asks, a send's usage headers (Resend's) move the kept figures on,
never failing a taken send; a send-only key keeps the headers' figures. Beside it, the portal's own
count per instance today, this week and month, from `email_messages`. A figure not given stays
empty.

## Ready to send

Every condition an email needs to leave, from what the portal knows (`src/ready.ts`), each with what
was found and the fix. `GET /ready` answers it; Write and the provider pages show it first;
`email.ready` raises it in Status.

| Check | Stops mail when | May cost mail when |
| --- | --- | --- |
| An email service sends | none active or standing by | only one standing by |
| Its key works and the account may send | the key's last check failed, or a real send was refused for the account (401, 403, kept at once) | never checked |
| An address to send from | none | |
| Its domain is verified | | never checked, or not passing |
| Room left to send | the service says none | |
| Everyday email lands in the inbox | | every service tracks always (`alwaysTracks`: Brevo, Sender), so Promotions; the fix names one that does not. `settled`: never rechecked |

`email.ready` asks each service hourly; **Check again** (`POST /ready/check`) asks now and checks
the From domain. While a check fails and its facts (`checkedAt`) are over `SELF_CHECK_MS` (two
minutes) old, `GET /ready` and `GET /write` check again after answering (`checking: true`); Write's
panel rereads every 30 s, every 6 s while checking. A definition's `probe.ready` names what the
answer must hold for the account to send (Brevo's `relay.enabled`).

The portal does a step itself where it can: with a service connected, a missing From address or an
unchecked domain carries `read`, and **Check again** reads them from the service (`POST
/domains/discover`) first. A missing service links to Email settings (`/email/connect`). Write's
blocker says either that a send now fails (a key check failed) or that mail waits for a ready
service. Reasons are plain words (`plainReason`, `plainSaid`): each answer once, no codes, the
reference last.
