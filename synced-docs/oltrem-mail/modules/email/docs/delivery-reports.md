---
title: "@oltrem/email: delivery reports, the do-not-mail list, health, personal data"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/email.ts, reports.ts, lists.ts]
---

# @oltrem/email: delivery reports, the do-not-mail list, health, personal data

> Part of [the @oltrem/email README](../README.md).

## Delivery reports

Each email instance has a public address, `POST /hooks/email/<instance>/<token>`, let through by
the client's Access door. The token is made when the key is first pasted, sealed with it and kept
across new keys. A report is checked twice: the token in constant time, then the provider's
signature (`@oltrem/providers`; Brevo signs nothing, so its token is its only guard). An SNS
subscription is confirmed at the AWS address the verified message names. SendGrid's suffixed ids
match by prefix; an event the provider's map does not name is counted as ignored.

Each report is one write on its message, which keeps milestones, not a row per event:

- **The outcome:** delivered, deferred, bounced or refused, with its time, the provider's words
  (`reason`) and `permanent` (1 for good). One for good is never replaced.
- **The first times:** the first open by a person, by a machine (Brevo's `proxy_open`, Apple's
  proxy, never counted as a reader), the first click, the spam report and the unsubscribe.

| Answer | When |
| --- | --- |
| 200 `{ recorded, ignored }` | checked; `recorded` events kept |
| 200 `{ subscribed: true }` | an SNS subscription confirmed |
| 401 `KIT-E-1409` | the token or signature does not match, or the signing field is not set |
| 404 `KIT-E-0404` | no email instance has that id |

## The do-not-mail list

`email_donotmail`, one lower-case row an address, read by `deliver` before every send.

| Reason | Stops | Put there by |
| --- | --- | --- |
| `bounced` | every message | a bounce for good, or three soft bounces in 30 days (`email_softbounces`) |
| `refused` | every message | the provider refusing the address for good |
| `complained` | every message | a spam report |
| `unsubscribed` | bulk only, or all with **Every email** | the person (`@oltrem/campaigns`), who alone may undo it (**Mail me again**) |
| `manual` | bulk only | a person in the portal |

A report lists only an address its message went to, so a forged one bars nobody. One naming nobody
means the single recipient; on a message to several it lists nobody (Resend and SES name only
recipients). An unsubscribed address that reports spam moves to every message. A message with every
address barred fails at once with the reason; with some, the rest are sent and `last_error` notes
it. Callers mark bulk mail with `bulk: true`.

Leaving one saved list is a mark in `email_list_left`, not this list: the person stays, shown as
never mailed with "left this list" (`LEFT_WORD`), and an import does not bring them back.

## Health

| Check | Warn | Fail |
| --- | --- | --- |
| `email.sending` | a message of the last day waits for a provider | one waits for a retry after every provider refused it |
| `email.quota` (hourly) | an instance at its last tenth (or, if only "left" is known, none) | a provider says none left |
| `email.domains` | a passing domain now fails, or one added over a day ago never passed | |
| `email.kinds` | a kind's pick was removed or is bulk-only | |
| `email.ready` | a [Ready to send](bulk-mails-pipe.md#ready-to-send) check may cost mail | one stops every email |

Two failures in a row open a problem (`@oltrem/core-health`). Sending never waits on `email.quota`.

## Personal data

For a privacy request (`personal`): each message to the address (template, state, last event,
outcome, first open, click, spam report, unsubscribe, when sent), its do-not-mail row, the saved
lists it is on (name, merge fields, reason, who added it, `leftAt`), and each Write email to it
(subject, state). Message text is not kept, except Write's words in `email_written` for the writer;
an email's files go within the hour of its deletion.

## Not built yet

- Filling a list from the customers module.
- The domain calls follow Resend's and Brevo's references, untested against live accounts;
  Resend's "domain is not verified" words are matched as documented.
- A client's generated Modules page lists routes, not public hooks.
