---
title: "@oltrem/campaigns: The routes; Health; The warm-up; Tables; Settings"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src; split from modules/campaigns/README.md]
---

# @oltrem/campaigns: The routes; Health; The warm-up; Tables; Settings

> Part of [the @oltrem/campaigns README](../README.md).

## The routes

| Routes                                                                                                                     | Capability                      | What they do                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /places`                                                                                                              | `campaigns.write`               | the places where the person may start a campaign                                                                  |
| `GET /campaigns` (`status`, `archived=1` for the archived ones), `GET /campaigns/:id`, `GET /campaigns/:id/recipients` (`status`)                              | `campaigns.read`                | the campaigns; one with its counts, today's sending, the preview and what is missing; its first hundred people    |
| `POST /campaigns`, `PATCH /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/list`, `POST /campaigns/:id/test` | `campaigns.write`               | a draft; its name, subject and message, and its sender (until it is sent, with `campaigns.send` once it is sending); deleting it; its list (the CSV file as the body, a `bytes` route); a test |
| `POST /campaigns/:id/files` (the file as the body, `name`, `mode` `everyone` or `each`), `DELETE /campaigns/:id/files/:fileId` | `campaigns.write` | a draft's files; the campaign's page lists them with whom each goes to, and `GET /campaigns/:id` answers `files` and `withoutFile` |
| `POST /campaigns/:id/list/add` (CSV body, or typed addresses with `typed=1&confirm=1`), `POST /campaigns/:id/use-list` (`listId`, `add`), `POST /campaigns/:id/remove-people` (`emails`) | `campaigns.write`               | people added from a file, typed addresses or a saved list, a draft's list replaced by a saved one, waiting people taken off         |
| `GET /campaigns/:id/suggestions` | `campaigns.write` | the people the signed-in person emailed from Write who are not on it yet: `{ items: [{ email, name }] }` |
| `POST /campaigns/:id/fields` (`fields`: for each field its `column` and `fallback`), `GET /campaigns/:id/sample` (`blank=1` for the headings alone), `GET /template` | `campaigns.write` (`campaigns.send` while paused); `campaigns.read` | the message's merge fields filled from another column or given words; a sample list to fill in, as a CSV file; a blank list with the usual headings, as `campaign-list-template.csv` |
| `POST /campaigns/remove-blank`, `POST /campaigns/archive-finished`, `POST /campaigns/:id/archive`, `POST /campaigns/:id/unarchive` | `campaigns.write` | blank drafts deleted (answers `removed`); sent and cancelled campaigns archived (answers `archived`), or one archived or taken back |
| `POST /campaigns/:id/pace` (`perRun`, `dailyCap`, `hours`)                                                                 | `campaigns.write` (`campaigns.send` once it runs) | its pace and sending hours                                                                     |
| `GET /campaigns/:id/live`, `GET /room`, `GET /campaigns/:id/report`                                                        | `campaigns.read`                | the progress from the campaign's own row; what may still go out today; its results by mailbox provider             |
| `GET /campaigns/:id/download`                                                                                              | `campaigns.send`                | every person and what became of their message, as a CSV file (`<name>-results.csv`), audited as `campaigns.download` |
| `POST /campaigns/:id/run`                                                                                                  | `campaigns.run`                 | the next run at once: answers `ran` (what it did), `busy` (a run was under way) and `held` (why it waits)        |
| `POST /campaigns/:id/start` (`at`), `/unschedule` (a campaign waiting for its start time, nobody sent to yet, back to a draft), `/pause`, `/resume`, `/cancel`, `POST /campaigns/:id/decide` (`choice`)                | `campaigns.send`                | the stages (`start` answers `asked: true` when the send waits for approval, `approvedAlone: true` when an Owner or the Vendor nobody else can answer gave their own yes); the unclear people                    |
| `POST /campaigns/:id/approve` (`yes`, `note`)                                                                              | `campaigns.approve`             | the answer to a large send; never the asker's own, unless nobody else may approve (see Approval)                  |
| `GET /suppressed` (`q`), `POST /suppressed` (`emails`), `POST /suppressed/remove` (`email`)                                | `campaigns.send` at the company | the do-not-mail list                                                                                              |

The hooks `GET` and `POST /hooks/campaigns/u/:token` are the unsubscribe link; a link that is broken
or no longer known, and the link of a test message, answer a small page that says so and what to do
instead, never a bare error. Every change is audited by the module (`campaigns.create`, `.update`,
`.delete`, `.import` with its counts and columns but no address, `.attach` with the file's name,
`.detach`, `.use-list`, `.add-people`, `.remove-people`, `.pace`, `.test`, `.start` (with
`approvedAlone` when the starter gave their own yes), `.approve`, `.refuse`, `.decide`,
`.unschedule`, `.pause`, `.resume`, `.cancel`, `.download`, `.suppress`, `.unsuppress`, `.run-now`;
the system's `campaigns.run` with what each run did, `campaigns.run-failed` with the reason and how
many in a row, `campaigns.protect` with the figures it paused on, `campaigns.unsubscribe` and
`campaigns.finish` with the final counts).

## Health

`campaigns.reputation`, in the `email` lane, reads the campaign messages of the last seven days
with their outcomes: **warn** above 0.3% spam reports (Gmail's limit) or 5% bounces for good once
at least 100 were sent, **ok** otherwise, with the figures. The two limits are the ones a
campaign pauses itself at (`PAUSE_SPAM`, `PAUSE_BOUNCES`). It runs every six hours (`every: '6h'`,
2026-11-20), since each run reads every campaign message of the seven days; a first failure is
checked again at the next health run, as for every check.

`campaigns.timer`, in the `email` lane, **fails** when a campaign has been due to send for over
20 minutes (`STALLED_MS`) while no campaign had a run at all: the five-minute job is not running
them. A campaign that waits for a reason it names is not counted, nor one that waits its turn
while others use the run.

`campaigns.reports`, in the `email` lane, **warns** when 20 or more campaign messages were sent
between two hours and 30 minutes ago (`SILENT_MS`) and the provider reported on none of them:
its webhook is not set up or not arriving, and without the reports a campaign cannot pause
itself on spam or bounces.

## The warm-up

A sending domain new to bulk mail starts slowly, as mailbox providers expect: 50 campaign
messages on its first day, then 100, 150, 250, 400, 600, 900, 1,300, 1,800, 2,500, 3,500, 5,000,
7,000 and 10,000, then only the other limits (`WARMUP`). The steps count every campaign from that
domain that UTC day. Its first day is `email_domains.bulk_since`, written by the first run that
sends from it; a domain that sent campaigns before this was built counts from its first campaign
message, so it is not slowed again. A campaign held by it says so: "news.example.com is new to
bulk mail, so it warms up: day 1 of 14 allows 50 campaign messages, all sent; it goes on tomorrow
with more." The setting `campaigns.warmup` turns it off, for a domain that is known to providers
already.

## Tables

Migration `0020_campaigns.sql`, additive and idempotent: `campaigns` (each campaign: its place,
name, subject, message, the list's merge fields, stage, start time, the portal's address, its link
secret, who and when), `campaigns_recipients` (each person: the row of the file, address, name,
merge fields, state and reason, message key, when it was handed out) and `campaigns_suppressed` (the
company's addresses never mailed, until 2026-10-28). Migration `0044_campaigns_donotmail.sql` copies
its rows into the email module's `email_donotmail` (bounces and complaints stop every message, the
rest bulk mail only); the table was no longer read or written, and migration
`1020_campaigns_lighter.sql` drops it, after copying its addresses to the do-not-mail list once more
in a way that only ever widens (one on the list for bulk mail only whose row here says spam report
or bounce now stops all mail). The same migration puts `campaigns_recipients_waiting` (only the
people still to be sent, by row) in place of the index by state, so sending a person writes two rows
of theirs, not three. The figures read the email module's `email_messages` by message key: its
outcome and its first open, click, spam report and unsubscribe. Migration
`0046_campaigns_sender.sql` adds the campaign's `sender_id`, one of the email module's
`email_senders`. Migration `0049_campaigns_engine.sql`, additive, adds to `campaigns` its template
and version, its saved list, its pace and hours, the wording's version, the approval (state, who
asked, who answered, when, the note), the engine's state (run size, why it waits and until when,
refusals in a row, the last run, the open claims) and its counters (people, sent, skipped, failed,
unclear, and the day's count), so the progress reads one row; and to `campaigns_recipients` when a
person became unclear and the version they got. It fills the counters of the campaigns already
there. Migration `0050_campaigns_watch.sql`, additive, adds to `campaigns` who started it
(`started_by`), when the reports are read next (`rates_next`) and the latest reading (`rates_over`,
`n_bounced`, `n_complained`), and when its summary was sent (`summary_at`). The email module's
migration `1003_email_consent.sql` adds `email_list_left` (who left which saved list from a link)
and `email_domains.bulk_since` (the warm-up's first day). Migration `1012_campaigns_tally.sql`,
additive, adds to `campaigns` the `tally` (what the providers reported of the people sent to, and
the report by mailbox provider, each with when it was read) and the `run_log`, and the index
`campaigns_recipients_row` (campaign, row number). Migration `1014_campaigns_archive.sql`, additive,
adds `campaigns.archived_at`: when a sent or cancelled campaign was put in the archive, null while
it is on the list. Migration `1015_campaigns_fields.sql`, additive, adds `campaigns.field_map`: for
each merge field the message names, the list's column that fills it and the words used when it is
empty.

### Rows read

D1 counts every row a query passes, and its free plan reads 5 million rows a day. Until
2026-11-10 a campaign's page read about four rows for every person on its list each time it was
opened or saved (8,009 rows for a 2,000-person draft), its people tab two, its report two and the
Campaigns list one: an owner setting up one campaign read 186,000 rows in four hours. Now the
page reads the counters the engine keeps on the campaign; what the providers reported is read
only for the people sent to, and kept on the campaign (`tally`) a minute while it runs and ten
minutes once it is over (an unsubscribe through the campaign's link clears it at once); the report
by mailbox provider is kept ten minutes; and the list is read in order through its index. The same
2,000-person campaign now reads 10 rows as a draft, 18 while sending, 103 for its people and 3 for
the Campaigns list (`test/campaigns.test.ts`, "rows read").

## Settings

| Key                        | Default                                                                                              | Who changes it |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| `campaigns.daily_limit`    | 200 (1 to 100,000), below Brevo's free 300 a day with room for the portal's own messages             | an Owner       |
| `campaigns.chunk_size`     | 25 every five minutes (1 to 1,000), unless a campaign sets its own pace; the plan's run size caps it  | an Owner       |
| `campaigns.max_recipients` | 2,000 (1 to 50,000)                                                                                  | an Owner       |
| `campaigns.approval_over`  | 1,000: a send to more people waits for a second person's yes (0 for none); an Owner or the Vendor nobody else can answer gives their own | an Owner       |
| `campaigns.footer`         | empty: who sends, why the person receives it, a postal address; a campaign does not start without it | an Owner       |
| `campaigns.warmup`         | on: a domain new to bulk mail warms up over 14 days (above)                                          | an Owner       |
