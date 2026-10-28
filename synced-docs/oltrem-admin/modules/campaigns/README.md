# @oltrem/campaigns

Bulk email (the owner's request of 2026-10-27): a message written in the portal, sent to a list
read from a CSV file, in chunks within a daily limit the email provider's plan allows. Every
message carries the one-click unsubscribe Gmail and Yahoo ask bulk senders for (RFC 8058), and
the addresses that unsubscribe, complain or bounce are kept on the company's do-not-mail list
(the email module's, since 2026-10-28) and never sent a campaign again. A campaign sits at a place of the company, and the roles held
there decide who may read it, write it and send it, as for every other capability. It goes out
from one of the email module's sender addresses, on a domain that passes its check (since
2026-10-28).

## Using it

```ts
import { CAMPAIGN_TEMPLATE, createCampaigns } from '@oltrem/campaigns';
import { pages as campaignsPages } from '@oltrem/campaigns/pages';
import { withPages } from '@oltrem/core-module';

const email = createEmail<Env>({ /* ... */ templates: [CAMPAIGN_TEMPLATE /* , ... */] });
const campaigns = createCampaigns<Env>({
  bindings: (env) => ({ db: env.DB }),
  email, // anything with the email module's `send` and `senders`
  config: settingsFor, // where the four settings below are read
});
const modules = [iam.module, email.module, withPages(campaigns.module, campaignsPages)];
```

`createCampaigns` returns the `store` (every function the routes and jobs call) and the module
manifest. It stands on the IAM module (sessions, the authorizer, the audit wrapper) and sends
through the email module: the client adds `CAMPAIGN_TEMPLATE` to the email module's templates.
Its pages come from `@oltrem/campaigns/pages`, type-checked against the DOM like the files
module's, and give it a **Campaigns** section in the sidebar's Messages group, beside Email.

## Who may do what

Three capabilities on bit plane `13`: `campaigns.read` sees the campaigns and their figures;
`campaigns.write` starts a draft, writes its message, uploads its list and sends a test to
oneself; `campaigns.send` starts, pauses, resumes and cancels a campaign, and asks for a fresh
sign-in. Each is read at the campaign's place, or a place above it; a campaign the person may
not read is not found. The sender address a campaign goes out from is one the person may use for
bulk mail: `email.senders.use` at the address's place, on a passing domain; the person who
starts it needs that too. The do-not-mail list is the company's, so reading it and changing it need
`campaigns.send` held at the company itself.

## A campaign, step by step

| Stage                 | What happens                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Draft                 | A name and a place; then a subject and a message in plain text with merge fields, and a list. Only a draft is changed or deleted.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| The list              | A CSV file of 1 MB at most, saved by any spreadsheet: a heading row, an `email` column (`email_address`, `e_mail`, `mail` and `correo` are read too), a comma or a semicolon between fields. Every other column becomes a merge field named from its heading (`First name` is `first_name`); a `name` column, or `first_name` and `last_name`, is the person's name. Addresses are checked and lowered; a repeated one is counted and left out; a bad row is reported by its number. A new file replaces the list. The setting `campaigns.max_recipients` caps it. |
| From                  | One of the sender addresses the person may use for bulk mail, its domain passing its check, picked on the page; the domain's default for bulk comes first. It may be changed until the campaign is sent or cancelled, by a writer while it is a draft and by a sender after. |
| Merge fields          | `{{first_name}}` is the person's value; `{{first_name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | there}}`uses`there`when it is empty.`{{email}}`and`{{name}}` always exist. A field the list does not have keeps the campaign from starting. |
| The message           | The text as written, with the footer and an unsubscribe link under it; an HTML version of the same text, every value escaped, paragraphs at blank lines and web addresses made links. The page previews it as the first person of the list will receive it.                                                                                                                                                                                                                                                                                                        |
| A test                | Sent to the signed-in person's own address, as the first person would receive it, its subject marked `[Test]`.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Start                 | Now, or in one, three or 24 hours (any time within 90 days through the API). It needs a subject, a message, someone to send to, merge fields the list has, the footer setting and a sender address on a passing domain; what is missing is named on the page. The portal's address at that moment is where the unsubscribe links point.                                                                                                                                                                                                                                                                 |
| Sending               | The job `campaigns.send` runs every five minutes and hands the next people of each due campaign to the email module, in the order of the file: at most `campaigns.chunk_size` a run, and no more than `campaigns.daily_limit` campaign messages in a UTC day for the company. An address on the do-not-mail list is skipped; a message the email module refuses as it is fails, without counting towards the limit. While the sender's domain does not pass its check, or the address was removed, the campaign waits, its page says why, and it goes on by itself once the domain passes again.                                                                                                                                                |
| Pause, resume, cancel | A pause stops the chunks until it is resumed; a cancel ends it for good, and who was not sent to stays unsent.                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Sent                  | Once nobody waits, the campaign is marked sent and its figures are audited.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

Each message goes through the email module under the key `campaigns:<campaign>:<person>`, so a
chunk run twice sends nobody twice, and the email module's own lease, failover and delivery
reports apply. With no email provider ready the messages wait in the email module and go out
once one is.

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
| `/campaigns`                 | a row of stages (all, drafts, sending, sent) and **Never mailed**; the campaigns of the places the person may see; **New campaign** for a writer, with a row of places when there is more than one                                                                                                                                        |
| `/campaigns?show=suppressed` | the do-not-mail list, found by part of an address, with **Add addresses** and **Take off**                                                                                                                                                                                                                                                |
| `/campaigns/:id`             | the stage and the address it goes out from; what keeps a draft from starting, or why a sending one waits; the **From** choice; the commands (send me a test, send it, pause, resume, cancel, delete the draft); the figures (people, sent, delivered, problems, left the list, today against the limit); the message form, the preview and the list upload for a draft; the first hundred people with a row of their states |

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
| `POST /campaigns/:id/start` (`at`), `/pause`, `/resume`, `/cancel`                                                         | `campaigns.send`                | the stages                                                                                                        |
| `GET /suppressed` (`q`), `POST /suppressed` (`emails`), `POST /suppressed/remove` (`email`)                                | `campaigns.send` at the company | the do-not-mail list                                                                                              |

The hooks `GET` and `POST /hooks/campaigns/u/:token` are the unsubscribe link. Every change is
audited by the module (`campaigns.create`, `.update`, `.delete`, `.import` with its counts and
columns but no address, `.test`, `.start`, `.pause`, `.resume`, `.cancel`, `.suppress`,
`.unsuppress`; the system's `campaigns.unsubscribe` and `campaigns.finish`).

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
email module's `email_senders`.

## Settings

| Key                        | Default                                                                                              | Who changes it |
| -------------------------- | ---------------------------------------------------------------------------------------------------- | -------------- |
| `campaigns.daily_limit`    | 200 (1 to 100,000), below Brevo's free 300 a day with room for the portal's own messages             | an Owner       |
| `campaigns.chunk_size`     | 25 every five minutes (1 to 50)                                                                      | an Owner       |
| `campaigns.max_recipients` | 2,000 (1 to 10,000)                                                                                  | an Owner       |
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
- No segments or saved audiences: each campaign brings its own file. Lists from the records
  module come with automations.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the email module
stood in for and its table real: the manifest; the list (headings as merge fields, bad and repeated rows; the CSV reader itself
is `@oltrem/core-module`'s, tested there); merge fields and fallbacks;
the HTML escaped with its links and the one-click headers; a draft at a place seen and written by
the roles there; the list with a suppressed address; what keeps it from starting; the sender
picked, refused to one who may not use it, and a campaign waiting while its domain fails; a test to
oneself; chunks within the day's limit and the rest the next day; the stages; the unsubscribe
page and its POST, a forged link refused; the figures from the outcomes and the do-not-mail list;
the do-not-mail list's rules; the audit. The client template's screens test runs the pages: a campaign written,
its list uploaded, a sender address added and picked, a test, sending through the cron tick, and an unsubscribe.
