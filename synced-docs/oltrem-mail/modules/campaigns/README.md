# @oltrem/campaigns

Bulk email (the owner's request of 2026-10-27): a message written in the portal, sent to a list
read from a CSV file, in chunks within a daily limit the email provider's plan allows. Every
message carries the one-click unsubscribe Gmail and Yahoo ask bulk senders for (RFC 8058), and
the addresses that unsubscribe, complain or bounce are kept on the company's do-not-mail list
(the email module's, since 2026-10-28) and never sent a campaign again. A campaign sits at a place of the company, and the roles held
there decide who may read it, write it and send it, as for every other capability. It goes out
from one of the email module's sender addresses, on a domain that passes its check (since
2026-10-28).

Since 2026-10-28 (stage 5 of the bulk sending plan) a campaign is written in a saved template or
as plain text, goes to a CSV file or a saved list, and is sent by an engine that never loses a
message in silence: every five minutes it hands each due campaign's next people to the email
module's bulk pipe in batch calls, as many as the client's Cloudflare plan, the day's limit and
the campaign's own pace allow; a call without an answer is sent again under the same key, or left
to a person to decide; the provider's stops hold the campaign, and three refusals in a row pause
it with an alert. A send to more people than one person may send to alone waits for a second
person's yes. People may be added and taken off while it runs, and its page refreshes its figures
every ten seconds.

Since the same day (stage 6) a sending campaign watches itself: above 0.3% spam reports or 5%
bounces over its latest messages it pauses itself to protect the sender's name; a run that fails
is said on its page and tried again, and the third failure in a row pauses it; System status
says when the timer stops running the campaigns or the provider's reports stop arriving. Once it
is done, the person who started it is emailed how it went, and its page shows the results by
mailbox provider with a download of every person and what became of their message.

## Using it

```ts
import { CAMPAIGN_TEMPLATE, createCampaigns } from '@oltrem/campaigns';
import { pages as campaignsPages } from '@oltrem/campaigns/pages';
import { withPages } from '@oltrem/core-module';

const email = createEmail<Env>({ /* ... */ templates: [CAMPAIGN_TEMPLATE /* , ... */] });
const campaigns = createCampaigns<Env>({
  bindings: (env) => ({ db: env.DB }),
  // The email module's `send`, `senders`, `bulk`, `templates` and `lists`.
  email,
  config: settingsFor, // where the five settings below are read
  // What the Cloudflare plan allows now, from System status (optional: the free plan's run without).
  capacity: async (env) => ({ plan, external, writesLeft, queue }),
  alerts: { raise, resolve }, // the alerts module's, for waits, pauses and approvals (optional)
  timeZone: async (env) => 'Europe/Madrid', // sending hours are read in it (optional: UTC)
});
const modules = [iam.module, email.module, withPages(campaigns.module, campaignsPages)];
```

`createCampaigns` returns the `store` (every function the routes and jobs call) and the module
manifest. It stands on the IAM module (sessions, the authorizer, the audit wrapper) and sends
through the email module: the client adds `CAMPAIGN_TEMPLATE` to the email module's templates.
Its pages come from `@oltrem/campaigns/pages`, type-checked against the DOM like the files
module's, and give it a **Campaigns** entry in the sidebar's Messages group, after Email, with the email module's Templates and Lists as its tabs (2026-10-29).

## Who may do what

Five capabilities on bit plane `13`: `campaigns.read` sees the campaigns and their figures;
`campaigns.write` starts a draft, writes its message, picks its template, uploads its list or
picks a saved one, adds people and sends a test to oneself; `campaigns.send` starts, pauses,
resumes and cancels a campaign, sets its pace and decides about unclear people once it runs, and
asks for a fresh sign-in; `campaigns.approve` (class admin, fresh sign-in) answers a large send
someone else asked for, never one the person asked for themselves; `campaigns.run` (class operate,
since 2026-11-10) presses **Run now** on a sending campaign: its next run at once, instead of at the
next five minutes, then the Run log shows what it did. Each is read at the campaign's place, or a place above it; a campaign the person may
not read is not found. The sender address a campaign goes out from is one the person may use for
bulk mail: `email.senders.use` at the address's place, on a passing domain; the person who
starts it needs that too. The do-not-mail list is the company's, so reading it and changing it need
`campaigns.send` held at the company itself.

## A campaign, step by step

| Stage                 | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Draft                 | A name and a place; then a subject and a message in plain text with merge fields, and a list. Only a draft is changed or deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The list              | A CSV file of 1 MB at most a request, saved by any spreadsheet: a heading row, an `email` column (`email_address`, `e_mail`, `mail` and `correo` are read too; since 2026-11-11 also any heading that says email or correo, or the column whose values are mostly addresses), a comma or a semicolon between fields. Since 2026-11-11 the page reads a larger file on the phone or computer and sends it in parts of about 600,000 characters, the first replacing the list and the rest added, saying which part goes (`data-csv` of the kit's frame script); the first part carries `total`, the people of the whole file, so a file longer than `campaigns.max_recipients` allows is refused before any part is taken; past 30 columns the address, the name, the files and the columns the message needs are kept first and the rest named back. **Download a sample CSV** (`GET /campaigns/:id/sample`) gives the email and name columns and one for each field the message names, with three example people at example.com. Every other column becomes a merge field named from its heading (`First name` is `first_name`); a `name` column, or `first_name` and `last_name`, is the person's name. Addresses are checked and lowered; a likely misspelling (`gmial.com`, `.con`) is put right and named, unless the person ticks **Keep the addresses exactly as written** (`fix=0`); a repeated one is counted and left out; a bad row is reported by its number; a no-reply address is counted, and skipped when it sends. A new file replaces the list. The setting `campaigns.max_recipients` caps it. The file is read by `readList` of `@oltrem/email` (moved there on 2026-10-28, so saved lists read people the same way). |
| From                  | One of the sender addresses the person may use for bulk mail, its domain passing its check, picked on the page; the domain's default for bulk comes first. It may be changed until the campaign is sent or cancelled, by a writer while it is a draft and by a sender after. |
| Merge fields          | `{{first_name}}` is the person's value; `{{first_name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | there}}`uses`there`when it is empty.`{{email}}`and`{{name}}` always exist. A field the list does not have keeps the campaign from starting. |
| The message           | The text as written, with the footer and an unsubscribe link under it; an HTML version of the same text, every value escaped, paragraphs at blank lines and web addresses made links. The page previews it as the first person of the list will receive it.                                                                                                                                                                                                                                                                                                        |
| A test                | Sent to the signed-in person's own address, as the first person would receive it, its subject marked `[Test]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Template              | Instead of plain text, a saved template of the email module (Email, Templates) made for campaigns, which the person may read; one made for the Write page alone is refused. A draft sends the template's version current when it starts; the version is fixed from then on. |
| Saved list            | Instead of a file, a saved list of the email module (Campaigns, Lists), its people ranked by address. |
| Files                 | PDF, Office, picture, text or ZIP files a draft sends (since 2026-11-08), kept by the email module in the client's bucket: up to 1,000 of 1 GB together, 10 MB attached in each email; a file over 10 MB, up to 95 MB, is a link to download at the end of the email that works for 30 days, and needs no provider that takes files. With the script, the files chosen go straight to the campaign's route, several at once. A file is for **everyone**, or for **each person**: it goes to the one person whose address its name carries (`Invoice ann@example.com (October).pdf`), or to whoever's list row names it in a `file`, `files`, `attachment`, `attachments` or `archivo` column (several split by `;`). While the campaign has a file for each person, who has none of their own is skipped with why, and the page counts them before it starts. Each email is then its own call, through Brevo or Resend (which download each file from a link that lasts a day); a sender on another provider waits and says so. Only a draft takes or loses files; deleting it removes them. |
| Approval              | A send to more people than `campaigns.approval_over` (1,000 by default; 0 for none) is not started but asked for: an alert says so, and someone else holding `campaigns.approve` says yes (it starts at once, or at its time) or no with a note (it stays a draft, the note on its page). A change to the message, the sender or the list withdraws the ask. |
| Pace                  | Its own messages a run (1 to 1,000), its own cap a day, and its sending hours (from, to, the days) in the company's time zone, the alerts module's `alerts.time_zone`; an end before the start runs overnight. Empty uses the settings. Changed while it runs too. |
| Start                 | Now, or in one, three or 24 hours (any time within 90 days through the API). It needs a subject, a message, someone to send to, merge fields the list has, the footer setting and a sender address on a passing domain; what is missing is named on the page. The portal's address at that moment is where the unsubscribe links point. Until a campaign started for later sends to anyone, **Back to draft to change it** (`campaigns.send`) makes it a draft again: everything may be changed, and it is started (and approved, if needed) again.                                                                                                                                                                                                                                                                 |
| Sending               | The job `campaigns.send` runs every five minutes. Each due campaign, the oldest first, gets the next people in the order of its list: no more than its pace, `campaigns.chunk_size`, a run's share of the Cloudflare plan (below), what is left of `campaigns.daily_limit` for the company that UTC day and its own daily cap. Before any call, the run writes on the campaign which people go under which call's key (the claim); the call is the email module's bulk pipe, one batch call of up to 100 for a provider that takes batches, one call a message for one that does not. Each person comes back sent, refused (failed, without counting towards the day), skipped (on the do-not-mail list a minute ago, a no-reply address, or at a domain the email module found with no mail server) or not sent (they go next run). One batch write records every person, the campaign's counters and the run's line for the page, and the run is audited as the system's `campaigns.run`. |
| While it runs         | People are added from a file or a saved list (who is on it already is kept once, who is never mailed is skipped) and people still waiting are taken off by address. The wording or template changes only while it is paused, as a new version; each person keeps the version they got. |
| Waits and stops       | It waits, says why on its page and goes on by itself: outside its sending hours; while its sender cannot carry bulk mail (warning alert); when the day is used up (until 00:05 UTC); when the provider's allowance is used up (until 00:05 UTC, warning alert); when the provider asks to slow down (for the wait it names, at least a minute). A refusal of the key, the account, the domain or the provider counts: three runs in a row and it pauses itself with a critical alert, until a person resumes it. |
| Unclear               | A call that got no answer is sent again under the same key at the next run while the provider honours keys (Resend, for 24 hours; the run size halves after it and grows back). With a provider that honours none, or after 23 hours, the people of that call are unclear: nothing more goes to them until someone holding `campaigns.send` decides to send again, count them as sent or not send them. A run that died half way is settled by what the email module wrote for those keys before anything is sent again. |
| Pause, resume, cancel | A pause stops the chunks until it is resumed; a cancel ends it for good, and who was not sent to stays unsent.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Run now               | Since 2026-11-10, someone holding `campaigns.run` makes a sending campaign's next run at once (since 2026-11-11 also one set to start later: it starts now, its start time moved to the moment of the press), as the five-minute run would make it: within the day's limit, its pace and hours, the plan's run and the provider's allowance (`POST /campaigns/:id/run`, audited as `campaigns.run-now`). A run holds its campaign for four minutes (`held_until`), so the five-minute run and Run now never run the same campaign at once: pressed while a run is under way, it says so and sends nothing. A campaign that waits (today's limit used, outside its hours) says why instead. |
| Run log               | Since 2026-11-10 the campaign keeps its newest 20 runs, waits and failures in words (`run_log`), newest first, with who pressed Run now: the page shows the latest eight inside the progress, refreshed every ten seconds while it sends. Since 2026-11-11 a run also keeps the provider's own answers for the people it did not send to (`answers`: failed, skipped or unclear, its words, how many, and the fix read from the words: a wrong address, the key, the sending domain, the provider's limit, the do-not-mail list, a file, or the download), the five most frequent shown under the run. |
| Fields in the message | Since 2026-11-11 the page lists each merge field the message or its template names, in whatever spelling it is written (`{{first_name}}`, `*|FNAME|*`, `{first_name}` and the others `@oltrem/email` reads), with the list's column that fills it: the same name, a well-known other name (`phone` from `Phone number`, `Celular` or `Mobile`; `first_name` from `Nombre`), or one picked from a row of the list's columns; and the words used when a person's value is empty. Saved with `POST /campaigns/:id/fields` (`field_map`, audited as `campaigns.fields`) on a draft, or a paused campaign by whoever may send it; the preview shows them filled in, and a field with a column or words no longer holds the start. |
| Tidying the list      | Since 2026-11-11, **Delete blank drafts** removes in one press every draft the person may write that has no subject, message, template, saved list, people or files (`POST /campaigns/remove-blank`, each audited as `campaigns.delete`); a sent or cancelled campaign is **archived** off the list, one at a time or all with **Archive finished** (`POST /campaigns/:id/archive`, `POST /campaigns/archive-finished`), shown under the **Archived** chip and taken back with **Take out of the archive** (`POST /campaigns/:id/unarchive`), audited as `campaigns.archive` and `campaigns.unarchive`. Nothing archived is deleted. |
| A run that fails      | A run that throws (the database busy, a bug) is caught for that campaign alone: the others still run, the reason is on its page and in the audit log (`campaigns.run-failed`) with a warning alert, and the next run tries again, settling from the claim it wrote. The third failure in a row pauses it with a critical alert, until a person resumes it. |
| The sender's name     | Every half hour, once 200 were sent, the run reads the reports on the campaign's latest messages (at most 1,000): above 0.3% spam reports (Gmail's limit) or 5% bounces for good it pauses itself before sending more, says which on its page and raises a critical alert (audited as `campaigns.protect`). A person looks at who complained or bounced, cleans the list and resumes it; the same reports are not read again for a day. The page shows the latest figures while it sends. |
| Sent                  | Once nobody waits, the campaign is marked sent and its figures are audited. The person who started it (the one who asked, when a second person approved) is emailed once, with the template `campaigns.summary`: the counts and a link to its page. |

Each message carries the key `campaigns:<campaign>:<person>`, where the email module's delivery
reports find it. With no email provider ready, or none that may send for the sender's domain, the
campaign waits and its page says why; it goes on once one is.

## The Cloudflare plan

The client's plan is the setting `health.cloudflare_plan` of System status (free or Workers
Paid), and the run follows it: on the free plan a run hands out 50 messages at most and makes at
most 40 calls to the provider (50 outside calls a run, 10 kept for the rest), and it stops before
the database writes left today run out (about ten rows written a message, measured by System
health when the operations token is set); on Workers Paid a run hands out up to 1,000 messages
and makes up to 9,990 calls, and writes past the plan's monthly allowance are billed, not
refused. `GET /room` and the **Room today** panel show what is left today: the messages under the
daily limit, the database writes and the messages they leave room for, the run size, and the
events queue's backlog.

A run never hands the provider more than it says is left (2026-10-28, `left` from the email
module's `bulk.route`): past its allowance some providers drop the mail. When it says none are
left, the campaign waits with words such as "Resend says no emails are left today; it goes on at
2026-10-29 00:00 UTC", until the time the provider gave, or tomorrow when it gave none.

## Leaving the list

Every message carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
headers, and a link in its footer, to `/hooks/campaigns/u/<token>`, outside the door. The token
is the person's row and an HMAC of it under the campaign's own random secret, so a link cannot be
made up and nothing secret is sent. Opening the link shows a page that asks, because mail
scanners open links; nothing changes until a button is pressed. The page offers three scopes
(2026-11-02, mail law M-4), each one press:

| Button                             | What it does                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Only “the list's name”**         | Shown when the campaign came from a saved list. A mark in `email_list_left`: the person stays on the list, is skipped by any campaign still sending from it, and is not added from it again.           |
| **All campaigns** (the main button) | The do-not-mail list as `unsubscribed`, for bulk mail only. A mail app's one-click `POST` (RFC 8058) does this one.                                                                                     |
| **Every email**                    | The do-not-mail list as `unsubscribed` for every message; a later "all campaigns" never narrows it.                                                                                                     |

Each says what it did and offers **Mail me again**, which takes back the person's own choices (the
`unsubscribed` row and their list marks) with no one at the company needed; a bounce, a spam report
or an address added by hand is not the person's to undo, and the page says the address stays off.
Each press is audited as the system's `campaigns.unsubscribe` with its scope, or
`campaigns.resubscribe`. A test message's link only says it was a test.

The list is the email module's `email_donotmail` (its README says who is put there and what each
reason stops): the delivery reports add bounces for good, three temporary bounces in 30 days,
refusals by the provider and spam reports the moment they arrive, for every message the portal
sends, so the hourly `campaigns.listen` job of before is gone. Messages a campaign hands out are
marked as bulk mail. On the page an Owner may add addresses by hand (bulk mail only) and take off
one that was added by hand, bounced or refused; an unsubscribe or a complaint stays for good
(`KIT-E-2505`): that person signs up again through a form of the company's.

## The pages

| Path                         | Shows                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/campaigns`                 | a row of stages (all, drafts, scheduled, sending, sent, archived) and **Never mailed**; **Archive finished** and **Delete blank drafts** with their counts, each asking first; **Room today** (messages left, database writes, the events queue, the run size); the campaigns of the places the person may see; **New campaign** for a writer, with a row of places when there is more than one |
| `/campaigns?show=suppressed` | the do-not-mail list, found by part of an address, with **Add addresses** and **Take off**                                                                                                                                                                                                                                                |
| `/campaigns/:id`             | the stage and the address it goes out from; the approval it waits for, with **Yes, send it** and **No, send it back** and a note for whoever may approve; on a draft, **Four steps to send it** (since 2026-11-08): who gets it, what it says and from whom, check it, when it goes, each done or what it still needs with a link to where it is done; since 2026-11-10 the steps are also a row of tabs and a draft shows one step at a time (`?step=who`, `what`, `check`, `send`), opening on the first that still needs something, with **Next** at its foot; a missing campaign footer is written in step 3 itself (**Save the footer**, saved to the `campaigns.footer` setting by whoever may change it), not looked for in Settings; the commands (send me a test, send it or ask to send it, **Back to draft to change it** while it waits for its start time, pause, resume, cancel, delete the draft, **Archive** or **Take out of the archive** once sent or cancelled); **Run now** for whoever holds `campaigns.run`; the progress (people, sent, unclear, failed, today against the limit, the next run's size, the **Run log**, why it waits, when it should be done), refreshed every ten seconds while it sends; the unclear people and the three decisions; delivered, clicked, problems and who left the list; **From**; **Message** (a template or plain text, while a draft or paused); the preview; **Pace** with the sending hours as a row of days; the list from a file or a saved list, or **Add people** and **Take people off** while it runs; **Files**, with whom each goes to and how many people have none of their own; the first hundred people with a row of their states, unclear among them |
| `/campaigns/:id` (sent)      | after the figures, **By mailbox provider**: Gmail, Microsoft, Yahoo and AOL, Apple and the others, with the people, sent, delivered, opened, clicked, bounced, spam reports and who left, read from each address's domain (on a phone card: sent, bounced and spam); **Download the results** for whoever may send |
| `/campaigns/:id/live`        | the progress alone: what an open campaign page fetches every ten seconds (one row read) and swaps in place, through the frame script's `data-live` blocks |

## Search

The portal's search (`GET /api/campaigns/search?q=`, `campaigns.read`) finds campaigns by name, at
the places the person may see, with their state.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers each campaign
the address was on, with the name and merge fields it
was sent with, its state and when it was sent; the email module answers the address's row on the
do-not-mail list. The Campaigns page is linked. A campaign's files (an invoice, a statement) are
personal data too: they stay with the campaign in the client's bucket, reached only by a link
that lasts a day, and go when the draft is deleted.

## The routes

| Routes                                                                                                                     | Capability                      | What they do                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /places`                                                                                                              | `campaigns.write`               | the places where the person may start a campaign                                                                  |
| `GET /campaigns` (`status`, `archived=1` for the archived ones), `GET /campaigns/:id`, `GET /campaigns/:id/recipients` (`status`)                              | `campaigns.read`                | the campaigns; one with its counts, today's sending, the preview and what is missing; its first hundred people    |
| `POST /campaigns`, `PATCH /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/list`, `POST /campaigns/:id/test` | `campaigns.write`               | a draft; its name, subject and message, and its sender (until it is sent, with `campaigns.send` once it is sending); deleting it; its list (the CSV file as the body, a `bytes` route); a test |
| `POST /campaigns/:id/files` (the file as the body, `name`, `mode` `everyone` or `each`), `DELETE /campaigns/:id/files/:fileId` | `campaigns.write` | a draft's files; the campaign's page lists them with whom each goes to, and `GET /campaigns/:id` answers `files` and `withoutFile` |
| `POST /campaigns/:id/list/add` (CSV body), `POST /campaigns/:id/use-list` (`listId`, `add`), `POST /campaigns/:id/remove-people` (`emails`) | `campaigns.write`               | people added from a file or a saved list, a draft's list replaced by a saved one, waiting people taken off         |
| `POST /campaigns/:id/fields` (`fields`: for each field its `column` and `fallback`), `GET /campaigns/:id/sample` | `campaigns.write` (`campaigns.send` while paused); `campaigns.read` | the message's merge fields filled from another column or given words; a sample list to fill in, as a CSV file |
| `POST /campaigns/remove-blank`, `POST /campaigns/archive-finished`, `POST /campaigns/:id/archive`, `POST /campaigns/:id/unarchive` | `campaigns.write` | blank drafts deleted (answers `removed`); sent and cancelled campaigns archived (answers `archived`), or one archived or taken back |
| `POST /campaigns/:id/pace` (`perRun`, `dailyCap`, `hours`)                                                                 | `campaigns.write` (`campaigns.send` once it runs) | its pace and sending hours                                                                     |
| `GET /campaigns/:id/live`, `GET /room`, `GET /campaigns/:id/report`                                                        | `campaigns.read`                | the progress from the campaign's own row; what may still go out today; its results by mailbox provider             |
| `GET /campaigns/:id/download`                                                                                              | `campaigns.send`                | every person and what became of their message, as a CSV file (`<name>-results.csv`), audited as `campaigns.download` |
| `POST /campaigns/:id/run`                                                                                                  | `campaigns.run`                 | the next run at once: answers `ran` (what it did), `busy` (a run was under way) and `held` (why it waits)        |
| `POST /campaigns/:id/start` (`at`), `/unschedule` (a campaign waiting for its start time, nobody sent to yet, back to a draft), `/pause`, `/resume`, `/cancel`, `POST /campaigns/:id/decide` (`choice`)                | `campaigns.send`                | the stages (`start` answers `asked: true` when the send waits for approval); the unclear people                    |
| `POST /campaigns/:id/approve` (`yes`, `note`)                                                                              | `campaigns.approve`             | the answer to a large send                                                                                        |
| `GET /suppressed` (`q`), `POST /suppressed` (`emails`), `POST /suppressed/remove` (`email`)                                | `campaigns.send` at the company | the do-not-mail list                                                                                              |

The hooks `GET` and `POST /hooks/campaigns/u/:token` are the unsubscribe link. Every change is
audited by the module (`campaigns.create`, `.update`, `.delete`, `.import` with its counts and
columns but no address, `.attach` with the file's name, `.detach`, `.use-list`, `.add-people`, `.remove-people`, `.pace`, `.test`, `.start`,
`.approve`, `.refuse`, `.decide`, `.unschedule`, `.pause`, `.resume`, `.cancel`, `.download`, `.suppress`,
`.unsuppress`, `.run-now`; the system's `campaigns.run` with what each run did, `campaigns.run-failed` with
the reason and how many in a row, `campaigns.protect` with the figures it paused on,
`campaigns.unsubscribe` and `campaigns.finish` with the final counts).

## Health

`campaigns.reputation`, in the `email` lane, reads the campaign messages of the last seven days
with their outcomes: **warn** above 0.3% spam reports (Gmail's limit) or 5% bounces for good once
at least 100 were sent, **ok** otherwise, with the figures. The two limits are the ones a
campaign pauses itself at (`PAUSE_SPAM`, `PAUSE_BOUNCES`).

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
name, subject, message, the list's merge fields, stage, start time, the portal's address, its
link secret, who and when), `campaigns_recipients` (each person: the row of the file, address,
name, merge fields, state and reason, message key, when it was handed out) and
`campaigns_suppressed` (the company's addresses never mailed, until 2026-10-28). Migration
`0044_campaigns_donotmail.sql` copies its rows into the email module's `email_donotmail`
(bounces and complaints stop every message, the rest bulk mail only); the table is no longer read
or written, and dropping it is a later step with the owner's yes. The figures read the email
module's `email_messages` by message key: its outcome and its first open, click, spam report and
unsubscribe. Migration `0046_campaigns_sender.sql` adds the campaign's `sender_id`, one of the
email module's `email_senders`. Migration `0049_campaigns_engine.sql`, additive, adds to
`campaigns` its template and version, its saved list, its pace and hours, the wording's version,
the approval (state, who asked, who answered, when, the note), the engine's state (run size, why
it waits and until when, refusals in a row, the last run, the open claims) and its counters
(people, sent, skipped, failed, unclear, and the day's count), so the progress reads one row;
and to `campaigns_recipients` when a person became unclear and the version they got. It fills
the counters of the campaigns already there. Migration `0050_campaigns_watch.sql`, additive, adds
to `campaigns` who started it (`started_by`), when the reports are read next (`rates_next`) and
the latest reading (`rates_over`, `n_bounced`, `n_complained`), and when its summary was sent
(`summary_at`). The email module's migration `1003_email_consent.sql` adds `email_list_left`
(who left which saved list from a link) and `email_domains.bulk_since` (the warm-up's first day).
Migration `1012_campaigns_tally.sql` (2026-11-10), additive, adds to `campaigns` the `tally` (what
the providers reported of the people sent to, and the report by mailbox provider, each with when
it was read) and the `run_log`, and the index `campaigns_recipients_row` (campaign, row number).
Migration `1014_campaigns_archive.sql` (2026-11-11), additive, adds `campaigns.archived_at`: when a
sent or cancelled campaign was put in the archive, null while it is on the list. Migration
`1015_campaigns_fields.sql` (2026-11-11), additive, adds `campaigns.field_map`: for each merge
field the message names, the list's column that fills it and the words used when it is empty.

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
| `campaigns.approval_over`  | 1,000: a send to more people waits for a second person's yes (0 for none)                            | an Owner       |
| `campaigns.footer`         | empty: who sends, why the person receives it, a postal address; a campaign does not start without it | an Owner       |
| `campaigns.warmup`         | on: a domain new to bulk mail warms up over 14 days (above)                                          | an Owner       |

## Errors

The module owns the `2500` to `2599` block: `KIT-E-2501` not possible at this stage, `KIT-E-2502`
not ready to send (the detail names what is missing), `KIT-E-2503` the list could not be read,
`KIT-E-2504` the list is longer than the settings allow, `KIT-E-2505` an address that
unsubscribed or complained stays on the list.

## Not here yet

- The unsubscribe page speaks English only; its words come from the client later.
- Opens and clicks are the first of each message, not a count of every open; an open by Apple's
  privacy proxy is not counted as a reader's.
- No segments: a campaign brings a file or a saved list. Lists from the records module come with
  automations.
- The mailbox provider is read from the address's domain only; a company domain hosted by Google
  or Microsoft counts under the others.
- A sent campaign keeps its files; nothing removes them yet after a time.
- The watch reads its figures at the start of a run, so it pauses at most one run (50 messages
  on the free plan) after the limit is crossed.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the email module
stood in for (a bulk pipe that records each call and answers as the test scripts it, saved
templates and lists) and its tables real: the manifest; the list (headings as merge fields, bad
and repeated rows); merge fields and fallbacks; the HTML escaped with its links and the
one-click headers; a draft at a place seen and written by the roles there; the list with a
suppressed address; what keeps it from starting; the sender picked, refused to one who may not
use it, and a campaign waiting while its domain fails; a test to oneself; runs within the day's
limit, one batch call under a key written first, and the rest the next day; the stages; the
unsubscribe page and its POST, a forged link refused; the three scopes, Mail me again and a
bounce it may not undo; who left a saved list skipped while a campaign sends and not added from
it again; the warm-up's first day, its hold and the next day's step; the figures from the outcomes and the
do-not-mail list; the do-not-mail list's rules; the audit. The engine: approval asked, refused
with a note, withdrawn by a change, never by the one who asked, given by someone else; a call
without an answer sent again under its key; unclear people and the decision; a run that died
half way settled by what the email module wrote; the provider's stops and the pause after three
refusals, resolved on resume; pace, daily cap and sending hours, overnight and in a time zone;
people added from a file and a saved list and taken off while it runs; a scheduled campaign back to a draft, by a sender only, and not once it sends; the room today; the plan's
run size and database writes; a template's version fixed at the start and a new wording version
while paused. Files: one for everyone and each person's own by the address in its name or the
list's file column, the page's count of who has none, each person sent only theirs and who has
none skipped, none added once it is sent, a file over 10 MB sent as a link to download, one taken off and all removed with the draft. The watch: a run that fails said on its page, tried again and paused at the
third, then resumed and sent; a campaign pausing itself above 0.3% spam reports over 220
reported messages, its alert and audit, and resumed without reading them again; the summary sent
once to the person who started it; the results by mailbox provider; the download refused to a
writer, its file and its audit; the reports check ok and then warning, and the timer check
failing while nothing ran and ok after a run. `steps.test.ts` holds a draft's four steps: a ready draft, what is missing sorted into its step with its link, and people without their own file. The client template's screens test runs the pages: a campaign written, its list
uploaded, a sender address added and picked, a test, the run waiting with no provider and saying
so, then a provider connected and the run sending in one batch call, the live figures, the
results by mailbox provider and the download, the summary waiting in the outbox, **Bulk mail
today** on the Email home, and an unsubscribe.
