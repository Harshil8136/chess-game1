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
  // What the Cloudflare plan allows now, from System health (optional: the free plan's run without).
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
module's, and give it a **Campaigns** section in the sidebar's Messages group, beside Email.

## Who may do what

Four capabilities on bit plane `13`: `campaigns.read` sees the campaigns and their figures;
`campaigns.write` starts a draft, writes its message, picks its template, uploads its list or
picks a saved one, adds people and sends a test to oneself; `campaigns.send` starts, pauses,
resumes and cancels a campaign, sets its pace and decides about unclear people once it runs, and
asks for a fresh sign-in; `campaigns.approve` (class admin, fresh sign-in) answers a large send
someone else asked for, never one the person asked for themselves. Each is read at the campaign's place, or a place above it; a campaign the person may
not read is not found. The sender address a campaign goes out from is one the person may use for
bulk mail: `email.senders.use` at the address's place, on a passing domain; the person who
starts it needs that too. The do-not-mail list is the company's, so reading it and changing it need
`campaigns.send` held at the company itself.

## A campaign, step by step

| Stage                 | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Draft                 | A name and a place; then a subject and a message in plain text with merge fields, and a list. Only a draft is changed or deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The list              | A CSV file of 1 MB at most, saved by any spreadsheet: a heading row, an `email` column (`email_address`, `e_mail`, `mail` and `correo` are read too), a comma or a semicolon between fields. Every other column becomes a merge field named from its heading (`First name` is `first_name`); a `name` column, or `first_name` and `last_name`, is the person's name. Addresses are checked and lowered; a repeated one is counted and left out; a bad row is reported by its number. A new file replaces the list. The setting `campaigns.max_recipients` caps it. The file is read by `readList` of `@oltrem/email` (moved there on 2026-10-28, so saved lists read people the same way). |
| From                  | One of the sender addresses the person may use for bulk mail, its domain passing its check, picked on the page; the domain's default for bulk comes first. It may be changed until the campaign is sent or cancelled, by a writer while it is a draft and by a sender after. |
| Merge fields          | `{{first_name}}` is the person's value; `{{first_name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | there}}`uses`there`when it is empty.`{{email}}`and`{{name}}` always exist. A field the list does not have keeps the campaign from starting. |
| The message           | The text as written, with the footer and an unsubscribe link under it; an HTML version of the same text, every value escaped, paragraphs at blank lines and web addresses made links. The page previews it as the first person of the list will receive it.                                                                                                                                                                                                                                                                                                        |
| A test                | Sent to the signed-in person's own address, as the first person would receive it, its subject marked `[Test]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Template              | Instead of plain text, a saved template of the email module (Messages, Templates), which the person may read. A draft sends the template's version current when it starts; the version is fixed from then on. |
| Saved list            | Instead of a file, a saved list of the email module (Messages, Lists), its people ranked by address. |
| Approval              | A send to more people than `campaigns.approval_over` (1,000 by default; 0 for none) is not started but asked for: an alert says so, and someone else holding `campaigns.approve` says yes (it starts at once, or at its time) or no with a note (it stays a draft, the note on its page). A change to the message, the sender or the list withdraws the ask. |
| Pace                  | Its own messages a run (1 to 1,000), its own cap a day, and its sending hours (from, to, the days) in the company's time zone, the alerts module's `alerts.time_zone`; an end before the start runs overnight. Empty uses the settings. Changed while it runs too. |
| Start                 | Now, or in one, three or 24 hours (any time within 90 days through the API). It needs a subject, a message, someone to send to, merge fields the list has, the footer setting and a sender address on a passing domain; what is missing is named on the page. The portal's address at that moment is where the unsubscribe links point.                                                                                                                                                                                                                                                                 |
| Sending               | The job `campaigns.send` runs every five minutes. Each due campaign, the oldest first, gets the next people in the order of its list: no more than its pace, `campaigns.chunk_size`, a run's share of the Cloudflare plan (below), what is left of `campaigns.daily_limit` for the company that UTC day and its own daily cap. Before any call, the run writes on the campaign which people go under which call's key (the claim); the call is the email module's bulk pipe, one batch call of up to 100 for a provider that takes batches, one call a message for one that does not. Each person comes back sent, refused (failed, without counting towards the day), skipped (on the do-not-mail list a minute ago) or not sent (they go next run). One batch write records every person, the campaign's counters and the run's line for the page, and the run is audited as the system's `campaigns.run`. |
| While it runs         | People are added from a file or a saved list (who is on it already is kept once, who is never mailed is skipped) and people still waiting are taken off by address. The wording or template changes only while it is paused, as a new version; each person keeps the version they got. |
| Waits and stops       | It waits, says why on its page and goes on by itself: outside its sending hours; while its sender cannot carry bulk mail (warning alert); when the day is used up (until 00:05 UTC); when the provider's allowance is used up (until 00:05 UTC, warning alert); when the provider asks to slow down (for the wait it names, at least a minute). A refusal of the key, the account, the domain or the provider counts: three runs in a row and it pauses itself with a critical alert, until a person resumes it. |
| Unclear               | A call that got no answer is sent again under the same key at the next run while the provider honours keys (Resend, for 24 hours; the run size halves after it and grows back). With a provider that honours none, or after 23 hours, the people of that call are unclear: nothing more goes to them until someone holding `campaigns.send` decides to send again, count them as sent or not send them. A run that died half way is settled by what the email module wrote for those keys before anything is sent again. |
| Pause, resume, cancel | A pause stops the chunks until it is resumed; a cancel ends it for good, and who was not sent to stays unsent.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Sent                  | Once nobody waits, the campaign is marked sent and its figures are audited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Each message carries the key `campaigns:<campaign>:<person>`, where the email module's delivery
reports find it. With no email provider ready, or none that may send for the sender's domain, the
campaign waits and its page says why; it goes on once one is.

## The Cloudflare plan

The client's plan is the setting `health.cloudflare_plan` of System health (free or Workers
Paid), and the run follows it: on the free plan a run hands out 50 messages at most and makes at
most 40 calls to the provider (50 outside calls a run, 10 kept for the rest), and it stops before
the database writes left today run out (about ten rows written a message, measured by System
health when the operations token is set); on Workers Paid a run hands out up to 1,000 messages
and makes up to 9,990 calls, and writes past the plan's monthly allowance are billed, not
refused. `GET /room` and the **Room today** panel show what is left today: the messages under the
daily limit, the database writes and the messages they leave room for, the run size, and the
events queue's backlog.

## Leaving the list

Every message carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
headers, and a link in its footer, to `/hooks/campaigns/u/<token>`, outside the door. The token
is the person's row and an HMAC of it under the campaign's own random secret, so a link cannot be
made up and nothing secret is sent. Opening the link shows a page that asks, because mail
scanners open links; its button, or a mail app's one-click `POST`, unsubscribes at once and says
so. The address joins the company's do-not-mail list as `unsubscribed`, for bulk mail only,
audited as the system's `campaigns.unsubscribe`. A test message's link only says it was a test.

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
| `/campaigns`                 | a row of stages (all, drafts, sending, sent) and **Never mailed**; **Room today** (messages left, database writes, the events queue, the run size); the campaigns of the places the person may see; **New campaign** for a writer, with a row of places when there is more than one |
| `/campaigns?show=suppressed` | the do-not-mail list, found by part of an address, with **Add addresses** and **Take off**                                                                                                                                                                                                                                                |
| `/campaigns/:id`             | the stage and the address it goes out from; the approval it waits for, with **Yes, send it** and **No, send it back** and a note for whoever may approve; what keeps a draft from starting; the commands (send me a test, send it or ask to send it, pause, resume, cancel, delete the draft); the progress (people, sent, unclear, failed, today against the limit, the next run's size, the last run in words, why it waits, when it should be done), refreshed every ten seconds while it sends; the unclear people and the three decisions; delivered, clicked, problems and who left the list; **From**; **Message** (a template or plain text, while a draft or paused); the preview; **Pace** with the sending hours as a row of days; the list from a file or a saved list, or **Add people** and **Take people off** while it runs; the first hundred people with a row of their states, unclear among them |
| `/campaigns/:id/live`        | the progress alone: what an open campaign page fetches every ten seconds (one row read) and swaps in place, through the frame script's `data-live` blocks |

## Search

The portal's search (`GET /api/campaigns/search?q=`, `campaigns.read`) finds campaigns by name, at
the places the person may see, with their state.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers each campaign
the address was on, with the name and merge fields it
was sent with, its state and when it was sent; the email module answers the address's row on the
do-not-mail list. The Campaigns page is linked.

## The routes

| Routes                                                                                                                     | Capability                      | What they do                                                                                                      |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `GET /places`                                                                                                              | `campaigns.write`               | the places where the person may start a campaign                                                                  |
| `GET /campaigns` (`status`), `GET /campaigns/:id`, `GET /campaigns/:id/recipients` (`status`)                              | `campaigns.read`                | the campaigns; one with its counts, today's sending, the preview and what is missing; its first hundred people    |
| `POST /campaigns`, `PATCH /campaigns/:id`, `DELETE /campaigns/:id`, `POST /campaigns/:id/list`, `POST /campaigns/:id/test` | `campaigns.write`               | a draft; its name, subject and message, and its sender (until it is sent, with `campaigns.send` once it is sending); deleting it; its list (the CSV file as the body, a `bytes` route); a test |
| `POST /campaigns/:id/list/add` (CSV body), `POST /campaigns/:id/use-list` (`listId`, `add`), `POST /campaigns/:id/remove-people` (`emails`) | `campaigns.write`               | people added from a file or a saved list, a draft's list replaced by a saved one, waiting people taken off         |
| `POST /campaigns/:id/pace` (`perRun`, `dailyCap`, `hours`)                                                                 | `campaigns.write` (`campaigns.send` once it runs) | its pace and sending hours                                                                     |
| `GET /campaigns/:id/live`, `GET /room`                                                                                     | `campaigns.read`                | the progress from the campaign's own row; what may still go out today                                             |
| `POST /campaigns/:id/start` (`at`), `/pause`, `/resume`, `/cancel`, `POST /campaigns/:id/decide` (`choice`)                | `campaigns.send`                | the stages (`start` answers `asked: true` when the send waits for approval); the unclear people                    |
| `POST /campaigns/:id/approve` (`yes`, `note`)                                                                              | `campaigns.approve`             | the answer to a large send                                                                                        |
| `GET /suppressed` (`q`), `POST /suppressed` (`emails`), `POST /suppressed/remove` (`email`)                                | `campaigns.send` at the company | the do-not-mail list                                                                                              |

The hooks `GET` and `POST /hooks/campaigns/u/:token` are the unsubscribe link. Every change is
audited by the module (`campaigns.create`, `.update`, `.delete`, `.import` with its counts and
columns but no address, `.use-list`, `.add-people`, `.remove-people`, `.pace`, `.test`, `.start`,
`.approve`, `.refuse`, `.decide`, `.pause`, `.resume`, `.cancel`, `.suppress`, `.unsuppress`; the
system's `campaigns.run` with what each run did, `campaigns.unsubscribe` and `campaigns.finish`
with the final counts).

## Health

`campaigns.reputation`, in the `email` lane, reads the campaign messages of the last seven days
with their outcomes: **warn** above 0.3% spam reports (Gmail's limit) or 5% bounces for good once
at least 100 were sent, **ok** otherwise, with the figures.

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
the counters of the campaigns already there.

## Settings

| Key                        | Default                                                                                              | Who changes it |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| `campaigns.daily_limit`    | 200 (1 to 100,000), below Brevo's free 300 a day with room for the portal's own messages             | an Owner       |
| `campaigns.chunk_size`     | 25 every five minutes (1 to 1,000), unless a campaign sets its own pace; the plan's run size caps it  | an Owner       |
| `campaigns.max_recipients` | 2,000 (1 to 50,000)                                                                                  | an Owner       |
| `campaigns.approval_over`  | 1,000: a send to more people waits for a second person's yes (0 for none)                            | an Owner       |
| `campaigns.footer`         | empty: who sends, why the person receives it, a postal address; a campaign does not start without it | an Owner       |

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
- Stopping by itself on a high spam or bounce rate, a summary to the person who started it, and
  reports by mailbox provider come in stage 6 of the bulk sending plan.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the email module
stood in for (a bulk pipe that records each call and answers as the test scripts it, saved
templates and lists) and its tables real: the manifest; the list (headings as merge fields, bad
and repeated rows); merge fields and fallbacks; the HTML escaped with its links and the
one-click headers; a draft at a place seen and written by the roles there; the list with a
suppressed address; what keeps it from starting; the sender picked, refused to one who may not
use it, and a campaign waiting while its domain fails; a test to oneself; runs within the day's
limit, one batch call under a key written first, and the rest the next day; the stages; the
unsubscribe page and its POST, a forged link refused; the figures from the outcomes and the
do-not-mail list; the do-not-mail list's rules; the audit. The engine: approval asked, refused
with a note, withdrawn by a change, never by the one who asked, given by someone else; a call
without an answer sent again under its key; unclear people and the decision; a run that died
half way settled by what the email module wrote; the provider's stops and the pause after three
refusals, resolved on resume; pace, daily cap and sending hours, overnight and in a time zone;
people added from a file and a saved list and taken off while it runs; the room today; the plan's
run size and database writes; a template's version fixed at the start and a new wording version
while paused. The client template's screens test runs the pages: a campaign written, its list
uploaded, a sender address added and picked, a test, the run waiting with no provider and saying
so, then a provider connected and the run sending in one batch call, the live figures, and an
unsubscribe.
