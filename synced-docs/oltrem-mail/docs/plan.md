---
title: 'Oltrem Mail: the plan'
status: approved
owner: vendor
last_verified: 2026-11-26
sources: [Cloudflare docs read 2026-11-02 (Email Service, limits, pricing, headers, email handler, Email Routing API; D1 and Workers limits), the free-plan pages of Resend, Brevo, Mailjet, Mailgun, SMTP2GO and Amazon SES read 2026-11-02, the owner's decisions of 2026-11-02, modules/campaigns/src/campaigns.ts]
---

# Oltrem Mail: the plan

Oltrem Mail is every email feature of an Oltrem portal, in its own private repository and always
inside the portal's one Worker, on Cloudflare's free plan. It sends by two routes: an email
provider (Brevo, Resend...) set up with two fields, and Cloudflare's own email set up with one
button; it can also give the business an inbox and forwarding on its own domain. **We run no mail
server and own no IP address**, so there is no reputation to build: both routes send from networks
mailbox providers already know, and what we look after is the domain's records, a slow start and
low complaints. Approved by the owner on 2026-11-02 (section 11); all five phases are built
(section 10). How each part works now: [setup](setup.md), [the inbox](inbox.md) and the three
modules' READMEs.

## 1. Your questions, answered

**Will hosting our own mail hurt delivery?** No: we host none. A new mail server (Postal,
Stalwart) has an IP that Gmail has never seen; ours goes through the provider's servers or
Cloudflare's, with their reputation. What counts on every route is the domain's SPF, DKIM and
DMARC, a modest start and low complaints. Cloudflare's sending was a beta with unmeasured
placement, so providers carry customers' mail and Cloudflare carries staff mail and alerts first.

**How much can we send for free?** As published on 2026-11-02 (the portal reads live figures where
a provider allows):

| Route | Free allowance | Past it |
|---|---|---|
| Cloudflare, Workers Free | No count limit, only to the account's verified addresses (200) from a domain with Email Routing on | Refused |
| Cloudflare, Workers Paid ($5 a month) | 3,000 a month, then $0.35 per 1,000; a daily cap that grows | Refused until the next day |
| Brevo | 300 a day | 1,000 wait in a retry queue, then lost |
| Mailjet | 6,000 a month, 200 a day | Queued 3 days, then deleted |
| Resend | 3,000 a month, 100 a day | Refused |
| Mailgun | 100 a day (supported, not recommended) | Refused |
| SMTP2GO | 1,000 a month | Refused |
| Amazon SES | None lasting; about $0.16 per 1,000; a sandbox at first | Charged |

The recommended setup is one main and one backup provider on one domain: Brevo with Resend (400 a
day, about 12,000 a month) or Brevo with Mailjet (500, about 15,000). More would add records, an
account and SPF lookups against the limit of 10
([setup](setup.md#4-a-backup-provider-and-the-spf-limit)). The portal never sends past a known
limit; Cloudflare's free route carries staff mail and alerts on top.

**How complex is setup?** A provider: type the From address, paste the key (a tap on a logo only
when the key does not name its provider); the portal does the rest and sends a test. Cloudflare:
one button; each staff member presses Cloudflare's confirmation link once.

**Is it worth it?** Yes, for "the simplest, cheapest, safest mail for a small business": one home
for all mail, staff mail and alerts free, an inbox that would otherwise cost $6 to $8 a mailbox a
month, bulk mail that is never sent twice and honours consent, and 12,000 to 15,000 free emails a
month. Not to replace providers for customers' mail on the free plan (Cloudflare forbids it), run
a mail server, or copy Google Workspace.

**Both setups in one repository?** Yes: one Mail setup page, two cards; a business can use both.

## 2. What it is, and is not

It is sending, setup, templates, lists, campaigns, an optional inbox and forwarding, using the
portal's people, roles and pages, phone first. It is not a webmail product with its own sign-in, a
second Worker or service, a public package, a mail server (no port 25), or a calendar or drive.

## 3. Where the code lives

`@oltrem/email`, `@oltrem/campaigns` and `@oltrem/mail` live here; `@oltrem/providers` (also
storage and SMS, and the sealed keys) and the core packages stay in the kit, and every other module
sends through one small interface. The two repositories meet through packed packages, with no
registry or token: ai.md section 5 says how. Package names, tables, routes and hook addresses never
change in a move, so clients upgrade with no data change.

## 4. The two sending routes

- A journal row is written before a message leaves (never sent twice).
- **Staff and alerts:** Cloudflare when every recipient is verified, free on every plan; otherwise
  the provider chain.
- **Customers' transactional mail:** the provider chain; in Paid mode the Owner may put Cloudflare
  first.
- **Campaigns: always providers.** Cloudflare's rule: transactional email only.
- **Failover only when safe.** Every route's answers sort into one list: a recipient problem
  (recorded), a throttle or used-up day (wait, or the backup), a setup problem (stop and say so).
  An unclear answer such as a timeout is never sent by another route; it is asked again only where
  the route knows the message's key (Resend), else it ends as "may have been sent".
- Every route carries `In-Reply-To` and `References` ([threads](inbox.md#5-threads)).

## 5. The records that keep mail trustworthy

| Record | What it does |
|---|---|
| Journal | A row before each message leaves; a retry finds it; a missing Sent copy is restored from it |
| Consent in three scopes | Leaving a series, the newsletter or everything are separate choices |
| Do-not-mail by address | Filled by "leave everything", hard bounces and complaints, contacts or not |
| Checked twice | When a campaign is planned and again just before each send (M-4) |
| Unsubscribe scanners cannot press | The link opens a page whose button acts; mail apps get one-tap headers (Gmail and Yahoo's rule) |
| Every recipient written first | One row per intended message before sending, so a campaign survives a crash |

The checks run as subqueries and `json_each` inside one statement, so D1's 100 bound values never
cap a batch; journal updates go as one `db.batch()`, one query, all or nothing.

## 6. Limits

| Cloudflare rule | Effect |
|---|---|
| Email Sending is transactional only | Campaigns never use it |
| Workers Free: only verified addresses (200 an account), only from routing domains | Free mode is for staff |
| At most 50 recipients and 25 MiB a message; custom headers 16 KB, 20 non-X, 2,048 bytes each | Bulk is one message a person anyway |
| `Date`, `Message-ID` and others are platform-controlled; `In-Reply-To`, `References` allowed | Threads by stored ids |
| Routing replaces the domain's MX; catch-all only at the root; 200 rules a domain; 30 routing or sending domains a zone | A subdomain beside other mailboxes; one rule a mailbox |
| Inbound up to 25 MiB | Only 128 KB read on arrival |

The free plan's budgets bind every part (M-3): 10 ms of CPU per request, cron run and received
message; D1 100,000 rows written and 5,000,000 read a day, 50 queries a request, 100 bound values a
query, 500 MB shared with the portal; no KV writes for mail; 50 outside calls a request, 6 at a time;
R2 10 GB, 1 million writes and 10 million reads a month.

## 7. What one message costs

Estimates from the design: a send writes about 4 rows and reads about 10; each delivery report
about 2 writes; an arrival about 10 writes and one R2 write under 3 ms; opening a message one read
and one range read, no parsing; a page of conversations about 50 reads. At 500 sends and 50
arrivals a day that is about 5,500 rows written (5.5% of the day) and 1,600 requests (under 2%).
Lists page by the last row seen, never OFFSET. A received message takes about 4 KB of D1 (75 MB a
year at 50 a day); R2 holds about 130,000 messages of 75 KB in 10 GB; retention keeps both in bounds.

## 8. Getting mail into the inbox, not spam

1. The domain is checked: one SPF record within 10 lookups, DKIM, DMARC, missing parts in words.
2. Separate addresses for separate jobs: `news.` for campaigns, so complaints never touch password
   links.
3. A slow start: a new domain's campaigns warm up in small daily steps (`campaigns.warmup`).
4. Self-pause at 0.3% complaints or 5% bounces, fed by
   [delivery reports](setup.md#3-delivery-reports-registered-by-themselves).
5. One-tap unsubscribe and a postal address in every bulk mail.
6. A placement test to the person's own Gmail and Outlook; Gmail's tabs in
   [setup section 6](setup.md#6-landing-in-gmails-primary-tab-not-promotions).

## 9. Risks, and what we do about each

| Risk | What we do |
|---|---|
| Cloudflare's placement unmeasured | Staff first; customers only in Paid mode and on the Owner's switch |
| Routing breaks existing mailboxes | Existing MX detected and kept without an explicit choice; a subdomain offered |
| Free allowances change, or a provider loses mail past its limit (Brevo) | Live usage where allowed, a backup, never past a known limit |
| A heavy message passes 10 ms | Only 128 KB read on arrival; the phone parses the rest |
| The inbox fills D1 or R2 | No bodies in D1, a contentless search index, retention, health warnings |
| Cloudflare's plan answer misread | Only an answer naming the plan or the missing right selects Free; anything else "could not check" |
| Forged delivery reports | Signatures, or the long token in the address; a failed check changes nothing |
| A message escapes the reading frame | No `allow-scripts` (a test enforces it), the frame's policy, DOMPurify, links to new tabs |
| The two repositories drift | Each pack names the kit commit it was tested on; the kit's verify runs the vendored mail |
| Spam in the inbox | Unknown addresses refused; Cloudflare's DMARC and blocklist refusals; a score; a block list |

## 10. Built, phase by phase

| Phase | What | Record |
|---|---|---|
| 1 | This repository and the move of email and campaigns, packed both ways | [phase 1](../archive/records/2026-11-02-phase-1-move.md) |
| 2 | The Cloudflare route, its card, Free and Paid modes, one error list, the journal | [phase 2](../archive/records/2026-11-02-phase-2-cloudflare-route.md) |
| 3 | The provider card, records on Cloudflare, delivery reports, the backup, the SPF count | [phase 3](../archive/records/2026-11-02-phase-3-provider-card.md) |
| 4 | The inbox | [phase 4](../archive/records/2026-11-02-phase-4-inbox.md) |
| 5 | Consent in three scopes, do-not-mail, the unsubscribe page and headers, the warm-up | [phase 5](../archive/records/2026-11-02-phase-5-consent.md) |

Later work (forwarding, Gmail's style, settings set once, campaigns as letters) has its records in
[archive/records](../archive/records/README.md). Not built: signed click tracking, mailboxes for AI
agents, importing old mail.

## 11. The owner's decisions

All answered on 2026-11-02.

| # | Question | The owner's answer |
|---|---|---|
| 1 | Approve this plan? | Yes, with seven revisions, now part of it |
| 2 | Move all mail into Oltrem Mail? | Yes: one mail codebase |
| 3 | Widen the portal's Cloudflare key? | Yes, scoped to the client's own zone and account: DNS Edit, Email Routing Rules Edit, Email Routing Addresses Edit, and Email Sending Edit only on Workers Paid |
| 4 | The `send_email` binding in the client template? | Yes: `"send_email": [{ "name": "EMAIL" }]` |
| 5 | How to read received mail? | postal-mime (MIT, no dependencies), 128 KB on arrival |
| 6 | A second Worker for mail? | **Never** (R-09): one Worker is simpler and has one door |

Where the build differs from the letter of a revision, each approved by the owner that day:

| Revision | As written | As built | Why |
|---|---|---|---|
| 1 | Free mode on a 401 or 403 | Only when the answer names the plan or the missing right | An error must not choose a mode (R-10) |
| 2 | Two fields for every provider | Plus one or two for Mailjet, Amazon SES, SMTP | They cannot work with one key |
| 3 | `/api/mail/webhooks/:provider` | `/hooks/email/<provider instance>/<token>` | `/api/` is behind sign-in |
| 3 | Signing secret in the token registry | Sealed in the database (KEK) | The registry holds names only |
| 5 | Sanitized body in D1 | Read from R2 and cleaned on the phone | D1's shared 500 MB |
| 5 | Attachments by R2 byte range | The whole message on a tap, parsed on the phone | An attachment's place is known only by reading up to it |
| 7 | `allow-popups allow-popups-to-escape-sandbox` | Plus `allow-same-origin`, never `allow-scripts` | The portal reads the frame's height |
| 7 | Message-ID on every route | Ours only where the route allows; the route's id stored | Cloudflare refuses one we set |

Also confirmed: Rules Edit plus DNS Edit with the guided tap on a 403; the subdomain toggle and
parent-zone lookup; 128 KB on arrival and 256 KB on open with "Load full message & attachments";
the `ResizeObserver`; the frame's link and form lockdown.

## 12. Ideas borrowed, and from where

Taken as designs, not code; about 35 projects compared in the kit's
`archive/proposals/2026-11-02-mail-projects.md`.

| Idea | Seen in |
|---|---|
| Fail over only when the mail surely was not accepted; one error list | 0list |
| Every recipient written before a campaign; consent checked again; three scopes | big-mailer (kolea) |
| A sent-mail journal; received authentication trusted only from a named server | cmail |
| A mailbox is a row; unknown addresses refused at the door | cf-mail |
| Two provider tracks with a simple choice | Quickinbox |
| Unsubscribe pages scanners cannot press | Ownlist, feedmail |
| Routing rules: store, forward, reject, sort | Mailflare |
| A setup that creates everything and checks it works | CloakMail, Quickinbox |
