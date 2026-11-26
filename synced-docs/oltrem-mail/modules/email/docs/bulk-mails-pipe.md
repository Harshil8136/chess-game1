---
title: "@oltrem/email: Bulk mail's pipe; Allowance; Ready to send"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Bulk mail's pipe; Allowance; Ready to send

> Part of [the @oltrem/email README](../README.md).

## Bulk mail's pipe

`createEmail(...).bulk` hands a slice of ready messages to the provider from the tick, not
through the queue (stage 5 of the bulk sending plan): one queue message per email would spend the
free plan's 10,000 queue operations a day at about three each.

| Part | What it does |
|---|---|
| `bulk.route(env, tenantId, senderId, { files? })` | The instance bulk mail from this sender goes through: the one its domain was set up through, while it is active or a failover, else the active instance; never another provider in the middle of a send, since the domain is verified on one. It answers how many messages one call carries (`batch`: 100 for Resend, 1 for a provider without a batch) and whether a call with no answer can be repeated safely (`repeatable`: the provider honours a key), and what the provider says may still go out (`left`: `{ left, window, resets }`, null when it does not say). A sender that was removed, is for everyday mail or whose domain does not pass is the reason it cannot. It also answers the bytes of files one message may carry through it (`files`, 0 when it takes none); with `files: true` the batch is 1 |
| `bulk.send(env, { tenantId, senderId, template, items, key, tag?, files? })` | One slice: through the batch in one call under `key`, or each message its own call, six at a time (a Worker opens six connections at once). The do-not-mail list is read at the send, so a person who left a minute ago is not mailed; so is what no mail reaches (`lists.unreachable`: a no-reply address, or a domain the job found with no mail server), skipped as `no mail reaches it (...)`. Each sent or refused message is kept in `email_messages`, in one statement, so its delivery reports find it. An item may carry `attachments` (links from `files.links`); a slice with them is sent with `files: true`, each message on its own call, since no provider's batch carries files |
| `emailed(env, session, limit)` | The addresses the signed-in person wrote to from Write lately, most written to first (Write's own ranking): a campaign's **Add people**, **From your email** |
| `files` | A campaign's files, kept like Write's in the same tables with the owner `campaign`: `files.on(env)` says whether the portal has a bucket; `files.add(env, { tenantId, campaignId, author, name, origin, person }, body, length)` keeps one (`person` is `*` for everyone, an address, or empty for the list's file column; up to 1,000 files of 1 GB together, `CAMPAIGN_FILES_MAX`, `CAMPAIGN_FILES_BYTES`, each attached one under `FILES_MAX_BYTES`, a larger one a link to download); `files.list`, `files.remove`, `files.removeAll`; `files.links(env, tenantId, campaignId, ids)` writes one fresh link a day long for each file a run sends. The hourly `email.files` job never removes a campaign's file |
| What becomes of each person | `sent`, with the provider's id; `refused` as it is, for good, with the provider's words; `skipped`, on the do-not-mail list; `repeat`, no answer from a provider that honours the key: the same slice is sent again under the same key and answered as the first; `unclear`, no answer from a provider that honours none: it may have been sent, so it is never sent again on its own; `again`, nothing was sent: it goes in a later run. No answer is sorted as for queued mail (`providerFailure`, `src/routes.ts`): a timeout, a broken connection, and a 500, 502 or 504, which until then read as nothing sent, so the next run mailed the same people under a new key; a 503 did not take the request in and is `again` |
| When the run stops | The provider asked to slow down, its allowance is used up, it refused the key, the account or the domain, or it failed: no more calls in this run, the rest `again`, and `stop` says why in words, with the seconds the provider asked to wait |

## Allowance

`createEmail(...).usage` reads what each provider says is used and left, through the providers
module's `usage` block: asked at most every 15 minutes, when the Email home, System health or the
bulk engine needs it, and kept on the instance. Between asks, the counts used on a send's headers
(Resend's) move the kept figures on, after a queued send, a send at once and a bulk slice alike;
that write never fails a send the provider took. A key that may only send cannot read Resend's
count: the headers' counts stay, with the provider's words. Beside it, the portal's own count of
what it sent through each instance today, this week and this month, from `email_messages`. Nothing
is guessed: a figure the provider did not give stays empty.

## Ready to send

Every condition an email needs to leave, from what the portal already knows (`src/ready.ts`),
each with what was found and what to do; added on 2026-10-31 after a day of email refused by a
Brevo account Brevo had not switched on. `GET /ready` answers it, the Write page and the Providers
pages show it first, and `email.ready` raises it in Status.

| Check | Stops mail when | May cost mail when |
|---|---|---|
| An email service sends | none is active or standing by | only one standing by |
| Its key works and the account may send | the last check of its key failed, or a real send was refused for the account (401 or 403): that refusal is kept on the instance at once | it was never checked |
| An address to send from | there is none | |
| Its domain is verified | | it was never checked, or it is not passing (the service has not verified it, or no DMARC) |
| Room left to send | the service says none is left | |
| Everyday email lands in the inbox | | every service that may send tracks each email and cannot stop (`alwaysTracks`: Brevo, Sender), so everyday mail lands in Gmail's Promotions; the fix names a service that does not, such as Resend. Only another service changes it, so it never keeps the page refreshing or the portal asking again (`settled`) |

The last check of each key is fresh: the job `email.ready` asks each service that may send every
hour, and **Check again** (`POST /ready/check`) asks them now and checks the From address's domain.
It also checks itself: while a check has not passed and the facts it stands on (the service's last
answer, the domain's last check: `checkedAt`) are over two minutes old (`SELF_CHECK_MS`), `GET
/ready` and `GET /write` ask the services and check the domain again after their answer has gone
(`checking: true`), and the Write page's panel is a live block that reads it again every 30 seconds,
every 6 while it checks, so the answer shows without a press. A provider's definition says what its
answer must also hold for the account to send (`probe.ready` in `@oltrem/providers`; Brevo's
`relay.enabled`), so an account the provider has not switched on fails the check with what to do,
even though its key works.

Nothing sends a person to another page when the portal can do the step itself (the owner's ask).
With a service connected, a missing From address and a domain never checked carry `read` (`[]` for
every address, or the domain's name), and Write's **Check again** reads them from the service (`POST
/domains/discover`, which keeps its own capability) and checks again in the same press. A missing
service, or a missing address with no service, links to Email settings (`/email/connect`), the one
card that sets the service, domain and address together.

The Write page's blocker is one true sentence: with a key check that failed, an email sent now fails
instead of waiting; otherwise sent emails wait and go once a service is ready. The reasons shown
with a check, a Sent row and a "Not sent" detail are in plain words (`plainReason`, `plainSaid`):
each service's answer once, no codes, the reference at the end; an unclear answer says it is asked
again the same way only, never sent another way, and one from a service that cannot tell a repeat
says it may have been sent and was not sent again.
