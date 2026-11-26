---
title: "@oltrem/campaigns: a campaign, step by step"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src/campaigns.ts, list.ts, message.ts, pages.tsx]
---

# @oltrem/campaigns: a campaign, step by step

> Part of [the @oltrem/campaigns README](../README.md).

## Writing it

| Stage | What happens |
| --- | --- |
| Draft | A name and a place, then a subject, plain-text message with merge fields, and people. Only a draft is changed or deleted |
| A file of people | A CSV, 1 MB a request (`readCapped`), read by `@oltrem/email`'s `readList` (the address column by heading or values; other columns become merge fields, `First name` is `first_name`). A larger file is sent from the browser in parts (`data-csv`), the first carrying `total` so an over-long file is refused before any part; past 30 columns the needed ones first. Typos fixed and named unless `fix=0`; repeats counted; bad rows by number; no-reply addresses skipped at the send. `campaigns.max_recipients` caps it. **Download a sample CSV** (`GET /campaigns/:id/sample`, `?blank=1` for headings only) and, before any campaign, `GET /template` (`BLANK_LIST_HEADINGS`) |
| A saved list | Ranked by address. **Send email** on a list opens `/campaigns?list=<id>`: a draft named for the list and the day, on its message step |
| **Add people** | Four cards: **Saved list**, **Type addresses** (`POST /campaigns/:id/list/add?typed=1`, `typedCsv`), **Upload a file**, **From your email** (`GET /campaigns/:id/suggestions`, via `emailed`). Typed and picked people need `confirm=1`. A draft nobody is on takes the first file or list whole; later ones add. Also on every draft step and a running campaign; **Take people off** too |
| From | A bulk sender the person may use, on a passing domain, the domain's bulk default first; changeable until sent or cancelled. An address that also sends everyday mail is warned against (Gmail learns it as Promotions) |
| Merge fields | `{{first_name}}`, or `{{first_name\|there}}` with words for empty; `{{email}}` and `{{name}}` always exist |
| **Personalization** | Each field the message names, in any spelling `@oltrem/email` reads, with its state (From a column, N empty, **N would be blank**, Same text for everyone), **Value from** (a column, a well-known other name such as `Celular` for `phone`, or `SAME_FOR_EVERYONE` `-`) and **Default value**. Saved by `POST /campaigns/:id/fields` (`field_map`). `GET /campaigns/:id` counts blanks once (up to `FIELDS_CHECKED` 5,000); a field anyone would get blank stops the start until it has a default |
| The message | The text with the footer and unsubscribe link, plus an HTML copy as a plain letter (`compose`: no card, a grey footer line), with the one-click unsubscribe headers. The preview is the first person's; above it, the likely Gmail tab (`tabSigns`), naming each promotion sign and the change. It promises nothing |
| Template | Instead of text, a saved template for campaigns the person may read (a Write-only one is refused); its version is fixed at the start |
| Files | Kept by the email module: everyone's, or each person's (an address in the file name, or the list's `file`, `files`, `attachment`, `attachments` or `archivo` column, split by `;`). Over 10 MB, up to 95 MB, goes as a 30-day link. With per-person files, someone without one is skipped and counted first. Sent one email a call through Brevo or Resend; another provider waits and says so. Only a draft takes or loses files |
| A test | To the signed-in person, as the first person gets it, subject `[Test]` |
| Approval | Over `campaigns.approval_over` (1,000; 0 for none) it is asked for, with an alert; another approver says yes (it starts) or no with a note. A change withdraws the ask. When nobody else may approve (up to `PEOPLE_CHECKED` 50 others checked; the Vendor not counted), an Owner or the Vendor with `campaigns.approve` approves alone: **Send it**, `approvedAlone: true`, audited |
| Pace | Messages a run (1 to 1,000), a daily cap, and sending hours and days in the client's `timeZone` (overnight when the end is before the start); empty uses the settings; changeable while running |
| Start | Now, or in 1, 3 or 24 hours (90 days by API). It needs a subject, message, people, filled fields, the footer setting and a passing sender; what is missing is named. Unsubscribe links point at the portal's address then. **Back to draft to change it** undoes a later start before anyone is sent to |

## Sending it

| Stage | What happens |
| --- | --- |
| A run | `campaigns.send` every five minutes while a campaign sends or waits to start, else one query and an hourly sleep; a start or resume wakes it. Each due campaign, oldest first, gets its next people up to its pace, `campaigns.chunk_size`, the run's share of the Cloudflare plan, the company's day left of `campaigns.daily_limit` (UTC) and its own cap. The claim (who goes under which key) is written first, then the bulk pipe is called (batches of 100 where taken). One batch write records everyone, the counters and the run's line; audited as the system's `campaigns.run` |
| Outcomes | Sent; refused (failed, not counted on the day); skipped (do-not-mail, no-reply, a domain with no mail server); not sent (next run) |
| While it runs | People added or waiting ones taken off. The wording or template changes only while paused, as a new version |
| Waits | Outside its hours; a sender that cannot carry bulk (warning); the day or the provider's allowance used up (until 00:05 UTC); slow down (the named wait, a minute at least). Refused key, account, domain or provider three runs in a row (`REFUSALS_TO_PAUSE`) pauses it with a critical alert |
| Unclear | No answer is sent again under the same key next run while the provider honours keys (Resend, 24 hours; the run halves then grows back). Unkeyed, or after 23 hours (`REPEAT_WITHIN_MS`), those people are unclear until someone with `campaigns.send` sends again, counts them sent or not. A run that died is settled from the email module's rows first |
| Pause, resume, cancel | A pause stops runs until resumed; a cancel ends it, the unsent staying unsent |
| **Run now** | `campaigns.run`: the next run at once, within every limit (`POST /campaigns/:id/run`, audited `campaigns.run-now`); a later start starts now. A run holds the campaign four minutes (`held_until`), so pressed mid-run it sends nothing and says so |
| Run log | The newest 20 runs, waits and failures (`run_log`) with who pressed Run now; the page shows eight, refreshed every 10 s. Each run keeps the provider's answers for the unsent (`answers`: words, count, fix), the top five shown |
| A run that fails | Caught for that campaign alone: its page and the audit log (`campaigns.run-failed`) say why, with a warning; the next run settles from the claim. Three in a row pause it, critical |
| The sender's name | Every half hour after 200 sent, the latest 1,000 reports are read: over 0.3% spam or 5% hard bounces pauses it with a critical alert (`campaigns.protect`), not read again for a day |
| Sent | Once nobody waits: marked sent, figures audited, and the starter (the asker, when approved) emailed once with `campaigns.summary` |
| Tidying | **Delete blank drafts** (`POST /campaigns/remove-blank`); finished ones archived singly or with **Archive finished**, under the **Archived** chip, back with **Take out of the archive**; nothing archived is deleted |

Each message carries the key `campaigns:<campaign>:<person>`, where delivery reports find it. With
no provider ready for the sender's domain, the campaign waits and says why.
