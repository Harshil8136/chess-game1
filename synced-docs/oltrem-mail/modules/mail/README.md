# @oltrem/mail

Oltrem Mail, the add-on a client gets when Mail is ticked at setup (docs/plan.md, docs/setup.md
section 2). It adds a way out for the portal's mail besides the email providers: Cloudflare's own
`send_email` binding, tried first for the messages it may carry. On Workers Free it reaches only
the account's verified addresses, so staff mail and alerts go out through Cloudflare for free
while customers' mail keeps its provider; on Workers Paid it may carry customers' transactional
mail too. Bulk mail never takes it (Cloudflare's rule, mail law M-2). A client without the add-on
sends exactly as before. It also brings the inbox (docs/inbox.md): mail to the business's own
addresses kept in the portal, read safely on a phone and answered from the mailbox's address; and
forwarding the way ImprovMX does it (docs/setup.md section 5): aliases to one or several people,
the catch-all, an import of ImprovMX's aliases and a guided move of each domain from ImprovMX,
with Move back.

## Using it

```ts
import type { MailAddon } from '@oltrem/email';
import { createMail } from '@oltrem/mail';
import { pages as mailPages } from '@oltrem/mail/pages';

let mail: MailAddon<Env> | undefined;
const email = createEmail<Env>({ /* ... */ route: () => mail?.route });
mail = createMail<Env>({
  email, bindings, on, settings, binding, token, account, plan, index, report,
  bucket: (env) => env.FILES, // the portal's one bucket: the inbox's stored copies
  worker: () => WORKER_NAME, // the name in the client's wrangler file: each mailbox's rule sends here
  local: (env) => !env.ACCESS_AUD, // optional: on the builder's computer, mailboxes without Email Routing
});
// mount withPages(mail.module, mailPages) beside email.module

export default {
  fetch: app.fetch,
  // Mail to an alias or a mailbox; without the add-on, every address is refused.
  email: (message, env, ctx) =>
    mail ? mail.receive(message, env, ctx) : message.setReject('Unknown recipient'),
};
```

docs/kit-contract.md says what each dependency is and how the kit wires them.

## The Cloudflare route

| Step | What happens |
|---|---|
| Needs | the `mail` part on, the `send_email` binding, the portal's Cloudflare key and the account; the setup page lists what is missing |
| Email Routing | `POST /api/mail/cloudflare/setup` finds the domain's zone (walking up from a subdomain), refuses while the domain receives mail at another provider's MX unless `replaceMx`, and turns Routing on; a 403 answers with the one tap in the dashboard |
| Staff | `POST /api/mail/cloudflare/staff` asks Cloudflare to verify the named addresses, or every person of the portal not verified yet (200 for the account at most); each person presses Cloudflare's link once; the state is read back by Check again and by the job |
| Sending | onboarding a domain for Email Sending has no API, so it is a dashboard tap; the test (`POST /api/mail/cloudflare/test`) tells the states apart and the route sends nothing until a test passed |
| Mode | Paid only when the plan setting says Workers Paid, Free otherwise; a change of plan asks for the test again |
| What it takes | never bulk mail; every recipient a verified staff address, or in Paid mode anyone while `mail.cloudflare_first` is on; from the route's own address unless the message's From is on its domain (the original From becomes the reply address); a message from an address someone picked on another domain is left to its provider |
| Its answers | sorted into email's one list by `cloudflareFailure` (`src/routes.ts`): a refusal for that message, a setup problem, a throttle or a day used up let the providers try; a receiving server's refusal fails the message; Cloudflare's server error or a code it does not know pins the message to Cloudflare (mail law M-1) |
| Stopping | `DELETE /api/mail/cloudflare` forgets the route here; Email Routing and the verified addresses stay in Cloudflare |

## Records on Cloudflare

The records an email provider asks for on a sending domain are written in its Cloudflare zone
with the portal's key, so nobody types them at a DNS host. The provider card does it in the same
press (email's route taker calls `records`); Mail setup lists each domain with records still
missing, with **Write them** (`POST /api/mail/records`). The rule is only to add (`src/records.ts`):

| At the name | What the portal does |
|---|---|
| The record is there (quoted or not, any case) | leaves it |
| Nothing in its way | adds it, not proxied, with the comment "Added by the portal for email" |
| An SPF record already | never a second one: says which `include:` to add to the one there |
| Another mail server (MX) | never replaced, in words |
| A CNAME, or a CNAME wanted beside anything | left to a person, in words |
| A DMARC record already, here or above | kept; none is written under a parent's policy, even when the provider offers one, so a stricter policy above is never weakened (`wantedOf` in `@oltrem/email`); with none anywhere, the provider's own DMARC record, else `v=DMARC1; p=none` |
| A new SPF record past 10 DNS lookups | not written, with the advice to use a subdomain |

A name outside the zone, a key that may not read or add records (403, "make the key again with
Zone, DNS, Edit") and any other refusal are said per record. At most 12 records a press. Each
press is one audit row, `mail.records`, naming every record added; the domain is checked again
after one was added.

The route keeps its id, `cloudflare`, on each message's row where a provider instance's id would
go, so Sent and the counts show it. It reads Cloudflare's answer only through the binding's
error codes; Cloudflare's delivery events are not wired yet.

## Routes

| Route | Capability | What it does |
|---|---|---|
| `GET /api/mail/cloudflare` | `mail.read` | the route as it stands: needs, line, mode, plan, staff, sent today, `main` (the portal's main address, name and domain, from the settings `email.from_address` and `email.from_name`, which the setup form starts from) and `may.manage` |
| `POST /api/mail/cloudflare/setup` | `mail.manage` | turn Email Routing on (`domain`, `subdomain`, `replaceMx`, `local`, `name`) |
| `POST /api/mail/cloudflare/staff` | `mail.manage` | ask Cloudflare to verify staff addresses (`emails`, or everyone waiting) |
| `POST /api/mail/cloudflare/check` | `mail.manage` | read Routing, the plan and each address back |
| `POST /api/mail/cloudflare/test` | `mail.manage` | send the test (`to`, the signed-in person when empty) |
| `DELETE /api/mail/cloudflare` | `mail.manage` | stop sending through Cloudflare |
| `POST /api/mail/records` | `mail.manage` | write a sending domain's missing records on Cloudflare (`domain`), then check it again |
| `GET /api/mail/forwarding` | `mail.read` | forwarding as it stands: each domain (`state`, `was`, `line`, `movable`, `before`, `back`) and each alias (its people with `verified`, `waiting` or `queued`, `state`, `line`, `how`), `mainDomain` (Add a domain starts from it while it is not added yet), and `may.manage` |
| `POST /api/mail/forwarding/domains` | `mail.manage` | add a domain (`domain`): looked up, and Email Routing turned on when it has no MX record |
| `POST /api/mail/forwarding/domains/:domain/check` | `mail.manage` | read it back now, its people's links too, and make the rules left over |
| `DELETE /api/mail/forwarding/domains/:domain` | `mail.manage` | forget a domain with no alias left |
| `POST /api/mail/forwarding/domains/:domain/move` | `mail.manage` | move it from ImprovMX to Cloudflare (setup.md section 5); `KIT-E-4009` until it may |
| `POST /api/mail/forwarding/domains/:domain/back` | `mail.manage` | move it back to ImprovMX |
| `POST /api/mail/forwarding/aliases` | `mail.manage` | forward an address (`address`, `*@` and the domain for the catch-all) to `forwardTo` (1 to 10) |
| `PATCH /api/mail/forwarding/aliases/:id` | `mail.manage` | change its people (`forwardTo`) or switch it off and on (`live`) |
| `DELETE /api/mail/forwarding/aliases/:id` | `mail.manage` | delete it and its rule |
| `POST /api/mail/forwarding/import` | `mail.manage` | take pasted aliases (`text`, ImprovMX's export or one a line; `domain` for lines without one), 500 at a time: `added`, `changed`, `same`, `skipped` with why |
| `GET /api/mail/try` | `mail.read` | `{ local }`: whether Send a test is offered, true only on the builder's own computer |
| `POST /api/mail/try` | `mail.manage` | on the builder's own computer only (404 elsewhere): a test message to `to` (from `from`, or someone@example.org) handed to the Worker as Email Routing would; `went` is `forwarded` (with `forwardedTo`), `kept` or `refused`, with words. Nothing leaves the computer |
| `POST /api/mail/forwarding/import/improvmx` | `mail.manage` | read every alias of the ImprovMX account (`key`, used for this press only and never kept; `domain` for one only), 12 ImprovMX calls a press, and take them as the paste does |
| `GET /api/mail/forwarding/improvmx` | `mail.read` | since 2026-11-12 (`src/improvmx.ts`): `{ connected: false, offered }` before a key, else the account (`email`, `plan`, `premium`), its domains (`forwarding`, `rules`, `aliases` with `forwardTo` and `webhooks`, `more`, `problem`), the domains past the 8 read (`more`) and `problem`, read from ImprovMX in 10 calls at most; and `may.manage` |
| `POST /api/mail/forwarding/improvmx` | `mail.manage` | keep the account's key (`key`): tried on the account first, kept sealed by the providers registry (`improvmx`, kind `forwarding`) only when ImprovMX takes it; a new key replaces the one kept |
| `DELETE /api/mail/forwarding/improvmx` | `mail.manage` | forget the key; the aliases stay at ImprovMX |
| `POST /api/mail/forwarding/improvmx/domains` | `mail.manage` | add a domain (`domain`) to the ImprovMX account |
| `POST /api/mail/forwarding/improvmx/domains/:domain/records` | `mail.manage` | ImprovMX checks the domain's records now: `{ domain, valid, lines: [{ record, expected, found, valid }], words }` |
| `GET /api/mail/forwarding/improvmx/domains/:domain/logs` | `mail.read` | the newest 20 messages ImprovMX forwarded or tried: `at`, `from`, `to`, `forward`, `subject`, `status`, `words` |
| `POST`, `PATCH`, `DELETE /api/mail/forwarding/improvmx/domains/:domain/aliases[/:id]` | `mail.manage` | add an alias (`alias`, `*` for every other address; `forwardTo`, 1 to 10), change its people, delete it, at ImprovMX; each audited by its address, never the key, and none wakes the five-minute job |

Each step answers `{ ok, words, dashboard? }`: what happened in plain words, and the dashboard
step when the portal's key may not do it.

## Capabilities, settings, jobs, health

| Kind | Id | What |
|---|---|---|
| Capability (plane 30) | `mail.read` | see the route and the staff addresses |
| Capability | `mail.manage` | set the route up; on the owner floor, since turning Routing on changes where a domain's mail goes |
| Setting | `mail.cloudflare_first` | Paid mode only: customers' transactional mail through Cloudflare first; off by default |
| Job | `mail.cloudflare` | hourly; each route read back once a day, four companies a run, and new staff asked |
| Health | `mail.cloudflare` | `warn` while a route that is set up is not ready, with its line |

| Capability | `mail.inbox.read` | read the mailboxes at the person's locations, change a conversation's state |
| Capability | `mail.inbox.reply` | answer from a mailbox's address |
| Capability | `mail.inbox.manage` | add, change and switch off mailboxes, rules and blocked senders; on the admin floor |
| Setting | `mail.inbox.keep_days` | mail older than this is removed, with its stored copy; 0 (the default) keeps it all; the Owner's |
| Setting | `mail.inbox.spam_score` | files arriving mail scoring at least this as spam; 0 (the default) files nothing by score |
| Job | `mail.soon` | every five minutes while something it serves is on a short clock (a snoozed conversation, a mailbox in its first hour, an address whose verify link went out in the last day, a test being sent again, an alias or a forwarding domain not settled in its first day); otherwise it sleeps (an hour a run, which is the pace of everything else it retries), woken by a snooze or by any press that changes the route, a mailbox or forwarding (2026-11-12); brings back the snoozed conversations whose time came (one write for all); reads back the addresses Cloudflare emailed a verify link in the last day until each is pressed (one listing for all); sends again, for a day after the press, a route test refused only because the domain is not onboarded for Email Sending, 4 companies a run (one binding call each), so the route turns ready by itself once the dashboard step is taken; makes again the routing rules that failed and asks Cloudflare about forwarding addresses it was never asked about, 5 mailboxes a run, every five minutes in a mailbox's first hour and hourly after; then forwarding, 8 Cloudflare calls at most: the people waiting their turn asked about, the aliases' rules made once a link is pressed, and one domain read back (new, moving, or not read for a day) with its people's links |
| Job | `mail.inbox` | hourly; brings back once the conversations answered three days ago and not since (one write); removes mail past `keep_days` (100 messages a run), and the senders kept only for their list's unsubscribe once their mail is gone |
| Health | `mail.forwarding` | `warn` for a forwarding domain or a switched-on alias with a problem (a rule Cloudflare refused, a forward that did not go), with what to do; an alias waiting for a link is not a problem |
| Health | `mail.inbox` | `fail` without the bucket; `warn` while Mail is off with mailboxes, for a mailbox's problem (a rule, a copy not forwarded, a message not kept), for a forwarding address whose link has not been pressed a day after Cloudflare emailed it, and past 250 MB of rows or 8 GB of stored copies |

The add-on holds the `4000`s of the error codes (`src/errors.ts`):

| Code | Status | When |
|---|---|---|
| `KIT-E-4001` | 409 | the inbox is not ready: no bucket, Mail off, or Email Routing not set up |
| `KIT-E-4002` | 409 | that address is already a mailbox |
| `KIT-E-4003` | 409 | a mailbox that holds mail is switched off, not deleted |
| `KIT-E-4004` | 409 | at a limit: 200 mailboxes, 50 rules, 500 blocked senders |
| `KIT-E-4005` | 502 | Cloudflare refused a routing rule; the answer says the dashboard step |
| `KIT-E-4006` | 409 | the conversation has no message from outside to answer |
| `KIT-E-4007` | 409 | the mailbox's address could not be made a sender for the reply |
| `KIT-E-4008` | 409 | that address forwards already, or is a mailbox |
| `KIT-E-4009` | 409 | the domain cannot move yet (not with ImprovMX, a person has not pressed the link) or was not moved by the portal |

## The inbox

| Part | How |
|---|---|
| A mailbox | a row (`hello` on the Email Routing domain), at a location, with its own literal routing rule in Cloudflare that sends its mail to this Worker; switching it off disables the rule and refuses its mail; a rule the key may not make is retried by `mail.soon` and its dashboard step shown meanwhile |
| Arrival | `receive`: an address that is not a live mailbox is refused (`setReject`); a blocked sender (or domain, subdomains too) is dropped and counted; the stream is split: the whole message to the bucket at `mail/inbox/<id>.eml`, the first 128 KB read by postal-mime; one batch writes the message, its search words, its conversation and the mailbox's counts; a failure takes the stored copy back and, when the mailbox has a forwarding address, sends the message there instead and takes it (the safety copy: nothing lost, the problem recorded), else tells the sender's server so it tries again; a copy goes to the mailbox's forwarding address when it has one, and a problem with that copy clears itself once one goes |
| Forwarding | setting a mailbox's forwarding address asks Cloudflare to email that address its verify link (Email Routing forwards only to verified addresses), so no one opens the dashboard; the mailbox shows `forward`: `waiting` until the link is pressed, read back every five minutes for a day, then `verified`; `unknown` when Cloudflare could not be asked, with why |
| Conversations | joined by In-Reply-To and References (the last 20 ids), else by subject and correspondent within 30 days; a Message-ID seen before is kept once |
| Checks | SPF, DKIM and DMARC believed only from Cloudflare's own first Authentication-Results header; a score of 0 to 10 from them and a sender's name that is an address on another domain |
| Rules | when the sender, the subject or a recipient contains words: archive, mark read, label, or spam; per mailbox or every one, with how often each matched |
| Updates | mail from a list or a machine (List-Id, List-Unsubscribe, Precedence bulk or list, Auto-Submitted other than `no`) goes to Updates, out of the inbox and its unread count; Move to Inbox or Move to Updates on a conversation moves all of its sender's conversations and is remembered for their next mail (`mail_senders`) |
| Unsubscribe | a list's List-Unsubscribe is believed only when Cloudflare's DKIM check passed; with List-Unsubscribe-Post (RFC 8058) the portal POSTs `List-Unsubscribe=One-Click` to its https address for the person (10 s, no redirects followed), records when, and moves the sender to Updates; without it the sender's own https page or mailto address is offered |
| Automatic reply | per mailbox (`PUT .../mailboxes/:id/auto-reply`, `mail.inbox.manage`): on or off, a subject (empty answers `Re:` and theirs, in their conversation), its words, and a first and last day on the company's clock; turning it on makes the mailbox's address a sender, as the first reply does. Sent through email (`email.send`, message key `mail.auto.<tenant>.<message>`, so a message delivered twice is answered once) once the message is kept, at most once a sender in four days (`mail_senders.auto_replied_at`), never to a list or machine, a no-reply, mailer-daemon or notifications address, the mailbox itself, spam, or a sender whose SPF, DKIM and DMARC all failed; a reply that does not go is recorded on the mailbox (and System health) and never fails the delivery. It goes through the provider's route and its daily allowance, not Cloudflare's `message.reply()` (unconfirmed on the free plan), and carries no `Auto-Submitted` header (email has no header option yet) |
| No answer yet | a reply from the portal starts a wait (`waiting_since`); their answer ends it; three days without one, the hourly `mail.inbox` job brings the conversation back to the top of its box once (`nudged`), marked "No answer yet"; never spam, muted or snoozed ones |
| Snooze, mute, sweep | snooze: in three hours, tomorrow at 8 or Monday at 8 on the company's clock (`email.timeZone`), then back at the top of its box, unread; new mail wakes it early. Mute: archived, and new replies stay archived until Unmute. Archive all from sender: every conversation of that sender archived, and, where the person manages the mailbox, an archive rule for their next mail (once, within the 200 rules) |
| Search | an FTS5 index without content over the first 8 KB of each message's text, accents folded; each word matched as a prefix; Gmail's words read first, across every box: `from:`, `to:`, `subject:` (a quoted phrase too), `has:attachment`, `is:unread`, `is:read`, `before:` and `after:` a day (`2026-10-31`), `in:` a box (`inbox`, `updates`, `snoozed`, `archived`, `spam`, `starred`, `anywhere`), and since 2026-11-11 `label:` a label and `is:starred` |
| Reading | the Worker passes the stored copy along without reading it (the first 256 KB, all of it with `whole=1`, always as a download); the phone reads it with the reader script, served by the hook `GET /hooks/mail/reader/<version>/<file>` (postal-mime, DOMPurify, `src/reader/reader.js`, and the list's `src/reader/swipe.js` and `src/reader/keys.js`, built into `src/generated/reader.ts` by `pnpm docs:build`) into a frame that never runs a script (docs/inbox.md section 4) |
| Replying | `POST .../reply` writes through email's Write (its checks, its Undo, the Sent page) from the mailbox's own address, added as a sender by itself the first time at the mailbox's own location (since 2026-11-03; before, at the company), so the people who may reply there are the ones who may send from it, with In-Reply-To and References so the reply and the customer's answer stay in the conversation; a reply taken back with Undo leaves the conversation |
| Stars and labels | since 2026-11-11 (migration 1016): a star on a conversation for the whole team (`mail_threads.starred`); labels put on by a person as well as by a rule, kept on the conversation space-separated, lower-case with spaces as dashes (`labelName`), each with a colour from core-ui's `LABEL_COLORS` in `mail_labels`; a rename follows onto every conversation and rule, a removal takes it off them all |
| Room | `GET /api/mail/inbox/usage`: messages, stored bytes, an estimate of the rows; the retention setting keeps both inside the free plan. `GET /api/mail/inbox/room` (2026-11-11) reads each mailbox's running total (`stored_bytes`, added to on arrival, taken from by retention) for the left pane's Mail storage gauge, without reading a message |

| Route | Capability | What it does |
|---|---|---|
| `GET /api/mail/inbox/mailboxes` | `mail.inbox.read` | the mailboxes the person may read or manage, the domain, the locations a new one may go at, and whether the inbox is offered |
| `POST /api/mail/inbox/mailboxes` | `mail.inbox.manage` | add one (`local`, `name`, `scopeId`, `forwardTo`) and its routing rule |
| `PATCH /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | its name, location, forwarding address, or `live` |
| `PUT /api/mail/inbox/mailboxes/:id/auto-reply` | `mail.inbox.manage` | its automatic reply (`on`, `subject`, `body`, `from`, `until` as `2026-12-24`) |
| `DELETE /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | delete an empty one and its rule |
| `GET /api/mail/inbox` | `mail.inbox.read` | conversations, 50 a page (`mailbox`, `box` of inbox, updates, snoozed, archived, spam, all or starred, `label`, `q`, `before`) |
| `GET /api/mail/inbox/threads/:id` | `mail.inbox.read` | one conversation, its messages, and how its sender lets a person leave their list (`sender.unsubscribe`: one-click, page, email or none) |
| `GET /api/mail/inbox/messages/:id/raw` | `mail.inbox.read` | the stored copy (`whole=1` for all of it) |
| `POST /api/mail/inbox/actions` | `mail.inbox.read` | read, unread, archive, inbox, spam, not spam, snooze (`until`: later, tomorrow, week) and unsnooze, mute and unmute, updates and people (their senders, remembered), sweep, star and unstar, label and unlabel (`label`, made when new), or block (manage) for up to 100 conversations |
| `GET /api/mail/inbox/subscriptions` | `mail.inbox.read` | the senders whose list mail is here, busiest first (100), each with whether one press unsubscribes |
| `POST /api/mail/inbox/unsubscribe` | `mail.inbox.read` | unsubscribe from a sender's list (`email`): `done`, or the sender's own `https` or `mailto` way with why |
| `POST /api/mail/inbox/threads/:id/reply` | `mail.inbox.reply` | answer the latest message (`body`, `all`) |
| `GET`, `POST /api/mail/inbox/rules`, `DELETE .../rules/:id` | read; manage | the rules and blocked senders; add and remove a rule |
| `POST`, `DELETE /api/mail/inbox/blocked` | `mail.inbox.manage` | block or unblock an address or `@domain` |
| `GET /api/mail/inbox/usage` | `mail.inbox.read` | the inbox's room |
| `GET /api/mail/inbox/room` | `mail.inbox.read` | `{ bytes }`: what the stored copies take, from the mailboxes' running totals |
| `GET /api/mail/inbox/labels` | `mail.inbox.read` | the team's labels with their colours: those made, then those only a rule puts on |
| `POST /api/mail/inbox/labels` | `mail.inbox.read` | make a label (`name`, `color`), or rename and recolour one (`was`) |
| `DELETE /api/mail/inbox/labels/:name` | `mail.inbox.manage` | remove a label from every conversation and rule |

Home shows the unread conversations, search finds mail by its words, and a privacy search lists
the messages from an address.

## Pages

Inbox (`/email/inbox`), first in the module's pages and second in the Email tabs after Write (since
2026-11-08 Email in the sidebar opens Write, the client's ask), with its unread count.
Since 2026-11-08 it is drawn as Gmail draws mail (the kit's `MailShell` and `ConversationRow`, the
client's point 7): on a computer the folders with Compose on top (Inbox, Updates, Snoozed,
Archived, Spam, All, then Email's Drafts and Sent), the list, and the open conversation beside it;
on a phone the folders are a sideways row of chips, Compose is the round button in the corner,
and an open conversation takes the screen with a way back to the same list. Each row shows who,
when (08:15 today, 2 Nov this year, on the UTC clock), the subject, and its state and first words.
The list has a row of mailboxes, a search with chips
for unread, attachments and archived, and the conversations with a box each to tick and a row of
commands for the ticked ones (archive, read, unread, three snoozes, Move to Updates or Inbox, mute,
archive all from sender, spam, block). Each change says what it did, with an Undo that sends the
same conversations back (but sweep and block, taken back on Mailboxes). On a phone a conversation
swiped left is archived and swiped right is marked read, through the same commands. Updates lists
the subscriptions with Unsubscribe. A conversation waiting three days for an answer shows "No answer yet". A conversation
(`/email/inbox/:id`) opens beside the list it came from (its view rides on each row's link) and is marked read when opened; it has the same commands, says when it is
snoozed, muted or waiting for an answer, and offers Unsubscribe for list mail; above the reply
box, **Saved replies** are the person's letters from Write (no design, no code), each added
under what is already typed with the person's name filled in; older messages fold and are fetched only when opened; the reply form
sends from the mailbox, and Undo puts the words back in it. Since 2026-11-10 the inbox with no
mailbox yet, or with a setup step still to do, says so beside the same folders, and the inbox's
unread count shows beside Inbox on every Email page (`addMailFolderCounts`). Mailboxes and rules
(`/email/mailboxes`), the last of Email's folders and beside them: each mailbox with its state and what stands in its way, add, change, switch
off and delete, its automatic reply, the rules, the blocked senders, and the room used against the free plan.

Since 2026-11-11 the inbox works as Gmail does (docs/records/2026-11-11-gmail-style-email.md):
the folders in Gmail's groups (Inbox, Starred, Snoozed with Email's Sent and Drafts; Updates,
Archived, Spam and All under More), the labels with their colours and a + to make one, and the
Mail storage gauge under them (`addMailPane`); a top bar with the search, the tick-all box, the
commands once a row is ticked and the Snooze, Label and More menus; on each row the star, the
labels' chips, a paperclip for a file and, on a computer, Archive, Mark read and Snooze on hover;
Quick settings behind the cog (Split or Full, Default or Compact, kept in cookies); Gmail's
keyboard shortcuts (`src/reader/keys.js`, the `?` sheet lists them); and Labels
(`/email/inbox/labels`), to make, rename, recolour and remove labels.

Forwarding (`/email/forwarding`), in the Email settings tabs, in two views since 2026-11-12:
**ImprovMX** (first) and **Cloudflare**. ImprovMX shows Connect ImprovMX with its one field until a
key is kept, then the account with Disconnect and Add a domain, and a pane for each domain with its
state, its aliases (Change, Delete), Add the alias, Check its records and Recent mail
(`?view=improvmx&mail=<domain>`). A visit opens on ImprovMX unless Cloudflare already forwards a
domain and ImprovMX is not connected; ImprovMX is asked only on its own view. Cloudflare, which
rests while ImprovMX is connected (the five-minute job and `mail.forwarding` pass the company by):
the domains, each with where its mail goes,
what stands before its move, and Move from ImprovMX, Move back and Check again; the aliases, each
with its people and whether each pressed Cloudflare's link, Change, Switch off and Delete; a form
to add one; and Import from ImprovMX, which reads the account with its API key in one press (the
key is never kept) or takes a pasted list. On the builder's own computer, Forwarding and
Mailboxes also show **Send a test** (`src/try-here.tsx`): a message to an alias or a mailbox,
handed to the Worker as Email Routing would, and what became of it. Someone who may only read sees
it all and nothing to change.

Mail setup (`/email/mail`), in the Email settings tabs: the route's line, the steps as a checklist, the
form that turns Email Routing on, the sending domains with records missing and **Write them**,
the staff addresses with their state, the test, and Stop. A step that is not ready says whether
Mail is to be ticked at setup or only turned on, on the Modules page.
Someone who may only read sees the steps and nothing to change.

## The tables

Migration `1001_mail_cloudflare.sql`: `mail_cloudflare`, one row a company (the domain, its zone,
what Cloudflare last said about Routing and sending, the mode, the address it sends from, what
stands in the way, when it was tested and checked), and `mail_cloudflare_addresses`, the staff
addresses asked of Cloudflare with the time each was verified. Migration `1002_mail_inbox.sql`:
`mail_mailboxes`, `mail_threads`, `mail_messages` (headers, snippet, attachment names, checks,
score; never the body), `mail_search` (FTS5, no content kept), `mail_blocked` and `mail_rules`.
Migration `1004_mail_familiar.sql`: `mail_threads` gains `updates`, `muted` and `snoozed_until`
(with a partial index on the snoozed ones and one on the correspondent), and `mail_senders`, a
row for a sender a person moved or whose list offers an unsubscribe (the choice, the unsubscribe
addresses, how many and when, when they were left). Migration `1005_mail_answers.sql`:
`mail_mailboxes` gains the automatic reply (`auto_on`, `auto_subject`, `auto_body`, `auto_from`,
`auto_until`, `auto_sender_id`, `auto_sent`), `mail_senders` gains `auto_replied_at`, and
`mail_threads` gains `waiting_since` (with a partial index) and `nudged`. Migration
`1007_mail_forwarding.sql`: `mail_forward_domains`, one row a company and domain (its zone, where
its mail goes, the service it went to, the records a move kept for Move back, whether the move
added Cloudflare to its SPF record), `mail_aliases` (the address, its people as a JSON list, its
rule and whether Cloudflare says what the row says, its counts), and `mail_cloudflare_addresses`
gains `asked_at`, NULL while an address waits its turn to be asked about. Migration
`1008_mail_test_again.sql`: `mail_cloudflare` gains `test_to` and `test_asked_at`, the address a
test refused for a domain not onboarded went to and when it was pressed, cleared when a test
passes. Migration `1016_mail_gmail.sql` (2026-11-11): `mail_threads` gains `starred` (with a
partial index), `mail_labels` holds the team's labels and their colours, and `mail_mailboxes`
gains `stored_bytes`, the running total of its stored copies, started from what was stored.
Never KV (mail law M-3).
