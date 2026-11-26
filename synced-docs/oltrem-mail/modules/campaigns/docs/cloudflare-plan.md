---
title: "@oltrem/campaigns: the Cloudflare plan, leaving the list, the pages"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src/campaigns.ts, pages.tsx, module.ts]
---

# @oltrem/campaigns: the Cloudflare plan, leaving the list, the pages

> Part of [the @oltrem/campaigns README](../README.md).

## The Cloudflare plan

The run follows Status's `health.cloudflare_plan`. Free: at most `RUN_MAX.free` (50) messages and
the plan's outside calls less `CALLS_KEPT` (10), stopping before the day's database writes run out
(`WRITES_PER_EMAIL`, about ten rows a message, measured when System health has the operations
token). Workers Paid: up to 1,000 messages, and writes past the allowance are billed, not refused.
`GET /room` and **Room today** show the messages left under the daily limit, the writes and the
messages they allow, the run size and the queue's backlog. A run never hands a provider more than
its `left`; at none, the campaign waits until the time given, else tomorrow.

## Leaving the list

Every message carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
and a footer link to `/hooks/campaigns/u/<token>`, outside the door: the person's row and an HMAC
under the campaign's own secret. Opening it only asks (mail scanners open links); each scope is
one press (M-4):

| Button | What it does |
| --- | --- |
| **Only “the list's name”** | From a saved list: a mark in `email_list_left`; skipped and not added again from that list |
| **All campaigns** (main) | Do-not-mail as `unsubscribed`, bulk only; what a mail app's one-click `POST` (RFC 8058) does |
| **Every email** | `unsubscribed` for every message; never narrowed later |

Each offers **Mail me again**, undoing only the person's own choices (a bounce, spam report or
manual entry stays). Audited as the system's `campaigns.unsubscribe` with its scope, or
`campaigns.resubscribe`. A test's link only says it was a test.

The list is the email module's `email_donotmail`, filled by delivery reports; campaign messages are
marked bulk. On the page an Owner adds addresses (bulk only) and takes off a manual, bounced or
refused one; an unsubscribe or complaint stays (`KIT-E-2505`).

## The pages

| Path | Shows |
| --- | --- |
| `/campaigns` | Stage chips (all, drafts, scheduled, sending, sent, archived) and **Never mailed**; **New campaign** (places as a row when several); **Archive finished** and **Delete blank drafts** with counts, each asking first; then **Blank CSV template** and **Room today** |
| `/campaigns?show=suppressed` | The do-not-mail list, searched by address, with **Add addresses** and **Take off** |
| `/campaigns/:id` | Chips under the title (stage, place, starter, sender, version, approver). A draft has **Four steps to send it** as cards and tabs (`?step=who`, `what`, `check`, `send`), one at a time, opening on the first that needs something, **Next** at the foot; the footer is written in step 3 (**Save the footer**, to `campaigns.footer`). The commands (test, send or ask, back to draft, pause, resume, cancel, delete, archive, **Run now**); an approval with **Yes, send it** and **No, send it back**; the progress and **Run log**, live every 10 s; unclear people and the three decisions; **From** (with no address, each one and the domain check it waits for); **Message**; the Gmail tab line and preview; **Pace** with days as a row; people (or **Add people** and **Take people off**); **Files**; the first 100 people. A refused save keeps what was typed; **Send me a test** says "on its way" only when `/api/email/ready` is ready |
| `/campaigns/:id` (sent) | **By mailbox provider** (Gmail, Microsoft, Yahoo and AOL, Apple, others: people, sent, delivered, opened, clicked, bounced, spam, left); **Download the results**; ten minutes after the last run with no report back, a notice with **Register delivery reports** (`/email/connect#reports`) |
| `/campaigns/:id/live` | The progress alone, one row read, swapped in by `data-live` |

## Search, reports, personal data

- **Search:** `GET /api/campaigns/search?q=` (`campaigns.read`), by name, at visible places.
- **Reports:** `GET /api/campaigns/report?days=&to=` (`campaigns.read`), the Reports page's Email
  tab: people handed out against the period before, a line a day, open and click shares once opens
  are reported, unsubscribes, and each campaign.
- **Personal data** (`personal`): each campaign the address was on, with its name, merge fields,
  state and send time. A campaign's files stay in the bucket behind day-long links and go when the
  draft is deleted.
