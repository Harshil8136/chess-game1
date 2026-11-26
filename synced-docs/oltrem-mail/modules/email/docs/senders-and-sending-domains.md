---
title: "@oltrem/email: senders and sending domains, the SPF limit, the simple provider card"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/senders.ts, spf.ts, connect.ts, connect-page.tsx, card.ts]
---

# @oltrem/email: senders and sending domains, the SPF limit, the simple provider card

> Part of [the @oltrem/email README](../README.md). More: [senders, continued](senders-and-sending-domains-2.md).

## Senders and sending domains

A message names its sender with `senderId`; without one it comes from the sender picked for its
kind of mail, else the client's `from` (the main address). Bulk mail always names one.

**Kinds of mail.** A kind is a module that emails, read from its template ids (`invoices.message`
is Invoices), so modules name no sender. Each comes from the main address unless someone with
`email.senders.manage` for the company picks another on Addresses (`PUT /kinds`, audited
`email.kinds`, rows in `email_kind_senders`). Write and campaigns pick each time. A pick whose
address was removed or is bulk-only is not used (the main address sends; the `email.kinds` check
warns). One D1 read per message. Add a domain starts with the main address's domain.

| Part | What it does |
| --- | --- |
| A sending domain | Added (with `email.senders.manage` for the company) with the instance it sends through. Where the provider has a `domains` block (Resend, Brevo), the portal adds it there and shows the DNS records asked for, each with Copy |
| The check | Live, then by the job `email.domains` (four a run; every 5 minutes while one is new or due, else hourly; woken by a new domain or news from a send). A domain never passed is checked every 5 minutes in its first hour, hourly in its first day (`RECHECK_SOON`), then daily (`RECHECK_MS`). One line per finding: the provider says verified; each record is in public DNS (DKIM by key, SPF by `include`); a DMARC policy covers it (its own or the nearest above, with `sp=`); one SPF record. No answer leaves the state as it was |
| Passing | Verified and covered by DMARC, with no broken SPF. A send-only key (Resend's 401) learns it from sends: an accepted real email proves it, a refusal as unverified fails it (`send_proof`, written at most hourly). With nothing known, it sends one email to the provider's test address (`testInbox`, Resend's `delivered@resend.dev`, which counts against the allowance) at the gaps of `PROBE_GAPS`, never once proven. Where nothing can tell, a person confirms, audited; a later refusal wins |
| Ready for Gmail, Yahoo and Outlook | A line per domain (`inboxesOf`): verified (DKIM, SPF) and DMARC-covered, the 2024 and 2025 sender rules; else what is missing |
| Read from the provider | **Sync with provider** (`GET /domains/found`) lists what each instance may send from, with **Add all** and **Add** (`POST /domains/discover`, optional `names`), from each definition's `identities`. A new domain is added and checked; a new address is added for both kinds with the provider's name, becoming the domain's default where it has none; an address whose domain is not here is skipped. What could not be read is said in words |
| Another address, from Write | `POST /senders/own` (`email.senders.add` or `email.senders.manage`): added for everyday mail when its domain is here or listed by a provider (then added and checked); else `KIT-E-1508`. Audited `email.sender-add` with `from: write` |
| A sender address | On an added domain: the name people see, an optional reply-to, the place whose `email.senders.use` holders may send from it, and bulk, everyday or both. The first of a domain for each kind becomes its default, never left empty |
| A send | `compose` refuses a removed sender or one for the other kind, and bulk mail from a domain not passing, before queuing (`KIT-E-1508`) |

## The SPF limit

`spfLine` and `countSpf` (`src/spf.ts`) count as RFC 7208 does: each `include`, `a`, `mx`, `ptr`,
`exists` and followed `redirect` is one lookup, nested ones too, at most 10 lookups and 2 that find
nothing; a loop is past the limit, a macro counted but not followed. Two SPF records, a count past
either limit, or a provider's include that would pass 10 fail; 9 or 10 pass with a warning to put
the next provider on a subdomain.

## The simple provider card

Email settings, Setup (`/email/connect`, `src/connect-page.tsx`) is the setup in one press: the
From address, an optional subdomain and name, and the key. `POST /connect` (`email.manage` and
`providers.manage` at the company; audited `email.connect`) does each step and answers each in
words (`src/card.ts`):

| Step | What happens |
| --- | --- |
| The provider | From the key's start (`re_` Resend, `xkeysib-` Brevo, `SG.` SendGrid, `api-` SMTP2GO, `AKIA` Amazon SES; `providerOfKey`), else the domain's DNS; only then one tap (`step: 'provider'`) |
| Its fields | The key fills the key field (`cardFields`); a provider needing more asks for exactly those (`step: 'fields'`) |
| Set up | The provider's live instance or a new one, made the sender (the old one its backup), or with **Add it as the backup** first in the failover order |
| The domain | Added and checked (one set up elsewhere is left there). With Oltrem Mail, its records are written on Cloudflare (the route taker's `records`), then checked again |
| The sender | The address becomes a sender for both kinds; `email.from_address` and `email.from_name` are set |
| Reports and a test | Delivery reports registered by API, then a test to the person who pressed |

**The key is asked first**, before anything changes (the definition's probe). Only a clear refusal
(401, 403) stops it: `KIT-E-1513`, "nothing was set up or changed". An unreachable provider is not
a refusal. A refused Connect draws back what was typed, never the key. A failed reports or test
line has **Try again** (`?intent=again`, `what=reports` or `test`). A **Delivery reports** pane
(`#reports`) registers them per instance. The domain line names missing records only when the
provider listed some.

Provider reasons are plain words (`plainReason`, `src/connect.ts`): codes dropped, `reference =
...` moved to the end, a network failure as "could not be reached", 401 or 403 as a refused key,
429 as slow down, 5xx as the service's own fault.

**Easy to start.** Three numbered steps. `GET /connect` fills the From address and name already set
and an example address on the company's domain (`exampleDomain`), offered as a chip (`data-fill`);
each field has an info note (`FormField` `info`). When a provider can send but no domain is here,
opening the page reads the provider's domains (`POST /domains/discover`) or adds the From domain
(`POST /domains`) and checks it. **Where does it land?** sends one test to a Gmail and one to an
Outlook address (`POST /canary` with `to`) to see Inbox or Spam before a campaign.
