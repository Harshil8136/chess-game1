---
title: "@oltrem/email: Delivery reports; The do-not-mail list; Health; Personal data; Not here yet"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Delivery reports; The do-not-mail list; Health; Personal data; Not here yet

> Part of [the @oltrem/email README](../README.md).

## Delivery reports

Each email instance has a public address, `POST /hooks/email/<instance>/<token>`, which the
client's Access door lets through. The token is made when the instance's key is first pasted,
sealed with it, and kept when a key is pasted again, so the address the provider was given stays
valid. A report is checked twice: the token against the instance's, in constant time, then the
provider's own signature (`@oltrem/providers`); Brevo signs nothing, so its token is its only
guard. An SNS subscription is confirmed at the AWS address the verified message names. Each event
is then kept on its message, sent through that instance, as `last_event` with its time, unless a
later event is already there; SendGrid's ids, which add a suffix after a dot, are matched by
prefix. A repeated report changes nothing, and an event the provider's map does not name is
counted as ignored.

Each report also lands on its message as one write, read in two kinds:

- **The outcome:** delivered, deferred, bounced or refused by the provider, with its time, the
  provider's words (`reason`) and, for a bounce or a refusal, whether it is for good
  (`permanent` 1) or for now (0, or unknown). An outcome for good is never replaced, so a late
  "delayed" cannot hide a bounce.
- **The first times:** the first open by a person, the first open by a machine (Apple's privacy
  proxy opens every image, so Brevo's `proxy_open` is counted apart and never as a reader), the
  first click, the spam report and the unsubscribe. A later report of the same kind changes
  nothing.

Each message keeps its milestones rather than a row per event, so a send of thousands stays well
inside the free plan's daily writes.

## The do-not-mail list

`email_donotmail` is the company's list of addresses never to mail, kept in lower case, one row
an address. `deliver` reads it before every send:

| Reason | What it stops | Put there by |
|---|---|---|
| `bounced` | every message | a bounce for good, or three temporary bounces within 30 days (`email_softbounces` counts them) |
| `refused` | every message | the provider refusing the address for good (Resend's suppressed, Brevo's blocked or invalid) |
| `complained` | every message | a spam report |
| `unsubscribed` | bulk mail only, or every message when the person chose **Every email** | the person's unsubscribe (`@oltrem/campaigns`); with bulk only, a password reset still arrives. The person may take it back themselves (**Mail me again**); no other reason is theirs to undo |
| `manual` | bulk mail only | a person in the portal (`@oltrem/campaigns`) |

A delivery report lists only an address its own message went to: one that names anybody else lists
nobody, so a forged report cannot bar a person from all mail. A report that names nobody is about
the message's one recipient; on a message to several (a copy in Cc), the address is listed only when
the report names it, since the first recipient is not known to be the one that bounced. Resend and
Amazon SES name only the message's recipients, so with several their reports name nobody
(`@oltrem/providers`), and the outcome stays on the message.

Leaving one saved list is not on this list: it is a mark in `email_list_left` (the list, the
address, the message whose link was pressed). The person stays on the list, shown as never mailed
with the words "left this list" (`LEFT_WORD`), counted with those on the do-not-mail list, and
kept across imports, so an import does not bring them back.

An address that unsubscribed and then reports spam moves from bulk only to every message. A
message whose every address is on the list fails at once with the reason, never in silence; one
with some barred sends to the rest and keeps the note in `last_error`. A caller marks bulk mail
with `bulk: true` on `send`.

| Answer | When |
|---|---|
| 200 `{ recorded, ignored }` | the report was checked; `recorded` events were kept |
| 200 `{ subscribed: true }` | an SNS subscription was confirmed |
| 401 `KIT-E-1409` | the token or the signature does not match, or the instance's signing field is not set |
| 404 `KIT-E-0404` | no email instance has that id |

## Health

`email.sending`, in the `email` lane: **fail** while a message of the last day waits for a retry
after every provider refused it, **warn** while one waits for an email provider, **ok** otherwise.
Two failures in a row open a problem (`@oltrem/core-health`).

`email.quota`: **warn** while an instance that may send is down to its last tenth of what its
provider says its plan allows (a provider that says only what is left warns at none), **fail**
when one says none are left, naming the instance and the window; **ok** otherwise, or "no provider
says what is left". It runs hourly (`every: '1h'`, 2026-11-20), since each run asks every provider
whose kept count is older than 15 minutes; a first failure is checked again at the next health
run, as for every check. Sending does not wait for it: it asks for itself before it sends.

`email.domains`: **warn** while a sending domain that passed its check fails it now, or one
added over a day ago has never passed, naming the domain and what is wrong; **ok** otherwise.

`email.kinds`: **warn** while a kind of mail is set to come from an address that was removed or
is now for bulk mail only (its mail comes from the main address meanwhile), naming the kind;
**ok** otherwise.

`email.ready`, for a company with an email service connected: **fail** while a check of
[Ready to send](bulk-mails-pipe.md#ready-to-send) stops every email, **warn** while one may cost mail, naming the
first; **ok** when every check passes.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers each message sent
to the address: its template, its state, the last delivery event, its outcome, its first open,
click, spam report and unsubscribe, and when it was sent; and the address's row on the do-not-mail
list, with its reason, when there is one. The saved lists the address is on are answered too, with
the name and merge fields kept there, the reason and who added it, and when they left it from a link
(`leftAt`). The text of a message is not kept, so it is not in the answer, except an email a person
wrote on the Write page: its words are kept in `email_written` for its writer (to finish a draft,
send it later or take it back), and the answer lists each one written to the address with its
subject and state. A draft stays until its writer sends or deletes it; a sent one is kept for the
Sent list of the next Mail stage. Files attached to an email stay with it, and go within the hour
once it is deleted. The Email page is linked.

## Not here yet

- A screen of the do-not-mail list in this module comes with the later bulk sending stages
  (archive/records/2026-10-28-senders-and-domains.md); until then the list is seen and changed on
  the Campaigns pages. (The daily cap exists: `campaigns.daily_limit`.) Since stage 5 a campaign picks a saved template and a saved
  list, and the campaigns module's engine is what calls `bulk.route` and `bulk.send`.
- A list is filled from a file or typed addresses; filling one from the customers module is
  not built yet.
- The domain calls are written from Resend's and Brevo's API references and tested against
  their documented answers, not yet against live accounts. Resend's sending-only keys cannot
  read domains, so with one the domain is proven by the emails Resend takes (a test to its test
  address when nothing else is known); Resend's refusal words ("The x domain is not verified")
  are matched as its documentation gives them, not yet seen from a live account. The instance's
  own probe (`GET /domains`) may also refuse such a key.
- The generated Modules page of a client lists routes, not public hooks.
