# @oltrem/mail

Oltrem Mail, the add-on a client gets when Mail is ticked at setup (docs/plan.md, docs/setup.md
section 2). It adds a way out for the portal's mail besides the email providers: Cloudflare's own
`send_email` binding, tried first for the messages it may carry. On Workers Free it reaches only
the account's verified addresses, so staff mail and alerts go out through Cloudflare for free
while customers' mail keeps its provider; on Workers Paid it may carry customers' transactional
mail too. Bulk mail never takes it (Cloudflare's rule, mail law M-2). A client without the add-on
sends exactly as before. It also brings the inbox (docs/inbox.md): mail to the business's own
addresses kept in the portal, read safely on a phone and answered from the mailbox's address.

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
  // Mail to a mailbox; without the add-on, every address is refused.
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
| A DMARC record already | kept |
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
| `GET /api/mail/cloudflare` | `mail.read` | the route as it stands: needs, line, mode, plan, staff, sent today, and `may.manage` |
| `POST /api/mail/cloudflare/setup` | `mail.manage` | turn Email Routing on (`domain`, `subdomain`, `replaceMx`, `local`, `name`) |
| `POST /api/mail/cloudflare/staff` | `mail.manage` | ask Cloudflare to verify staff addresses (`emails`, or everyone waiting) |
| `POST /api/mail/cloudflare/check` | `mail.manage` | read Routing, the plan and each address back |
| `POST /api/mail/cloudflare/test` | `mail.manage` | send the test (`to`, the signed-in person when empty) |
| `DELETE /api/mail/cloudflare` | `mail.manage` | stop sending through Cloudflare |
| `POST /api/mail/records` | `mail.manage` | write a sending domain's missing records on Cloudflare (`domain`), then check it again |

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
| Job | `mail.inbox` | hourly; makes again each live mailbox's routing rule that failed (5 a run) and removes mail past `keep_days` (100 messages a run) |
| Health | `mail.inbox` | `fail` without the bucket; `warn` while Mail is off with mailboxes, for a mailbox's problem (a rule, a copy not forwarded, a message not kept), and past 250 MB of rows or 8 GB of stored copies |

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

## The inbox

| Part | How |
|---|---|
| A mailbox | a row (`hello` on the Email Routing domain), at a location, with its own literal routing rule in Cloudflare that sends its mail to this Worker; switching it off disables the rule and refuses its mail; a rule the key may not make is retried every hour and its dashboard step shown meanwhile |
| Arrival | `receive`: an address that is not a live mailbox is refused (`setReject`); a blocked sender (or domain, subdomains too) is dropped and counted; the stream is split: the whole message to the bucket at `mail/inbox/<id>.eml`, the first 128 KB read by postal-mime; one batch writes the message, its search words, its conversation and the mailbox's counts; a failure takes the stored copy back and tells the sender's server so it tries again; a copy goes to the mailbox's forwarding address when it has one |
| Conversations | joined by In-Reply-To and References (the last 20 ids), else by subject and correspondent within 30 days; a Message-ID seen before is kept once |
| Checks | SPF, DKIM and DMARC believed only from Cloudflare's own first Authentication-Results header; a score of 0 to 10 from them and a sender's name that is an address on another domain |
| Rules | when the sender, the subject or a recipient contains words: archive, mark read, label, or spam; per mailbox or every one, with how often each matched |
| Search | an FTS5 index without content over the first 8 KB of each message's text, accents folded; each word matched as a prefix |
| Reading | the Worker passes the stored copy along without reading it (the first 256 KB, all of it with `whole=1`, always as a download); the phone reads it with the reader script, served by the hook `GET /hooks/mail/reader/<version>/<file>` (postal-mime, DOMPurify and `src/reader/reader.js`, built into `src/generated/reader.ts` by `pnpm docs:build`) into a frame that never runs a script (docs/inbox.md section 4) |
| Replying | `POST .../reply` writes through email's Write (its checks, its Undo, the Sent page) from the mailbox's own address, added as a sender by itself the first time, with In-Reply-To and References so the reply and the customer's answer stay in the conversation; a reply taken back with Undo leaves the conversation |
| Room | `GET /api/mail/inbox/usage`: messages, stored bytes, an estimate of the rows; the retention setting keeps both inside the free plan |

| Route | Capability | What it does |
|---|---|---|
| `GET /api/mail/inbox/mailboxes` | `mail.inbox.read` | the mailboxes the person may read or manage, the domain, the locations a new one may go at, and whether the inbox is offered |
| `POST /api/mail/inbox/mailboxes` | `mail.inbox.manage` | add one (`local`, `name`, `scopeId`, `forwardTo`) and its routing rule |
| `PATCH /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | its name, location, forwarding address, or `live` |
| `DELETE /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | delete an empty one and its rule |
| `GET /api/mail/inbox` | `mail.inbox.read` | conversations, 50 a page (`mailbox`, `box`, `q`, `before`) |
| `GET /api/mail/inbox/threads/:id` | `mail.inbox.read` | one conversation and its messages |
| `GET /api/mail/inbox/messages/:id/raw` | `mail.inbox.read` | the stored copy (`whole=1` for all of it) |
| `POST /api/mail/inbox/actions` | `mail.inbox.read` | read, unread, archive, inbox, spam, not spam, or block (manage) for up to 100 conversations |
| `POST /api/mail/inbox/threads/:id/reply` | `mail.inbox.reply` | answer the latest message (`body`, `all`) |
| `GET`, `POST /api/mail/inbox/rules`, `DELETE .../rules/:id` | read; manage | the rules and blocked senders; add and remove a rule |
| `POST`, `DELETE /api/mail/inbox/blocked` | `mail.inbox.manage` | block or unblock an address or `@domain` |
| `GET /api/mail/inbox/usage` | `mail.inbox.read` | the inbox's room |

Home shows the unread conversations, search finds mail by its words, and a privacy search lists
the messages from an address.

## Pages

Inbox (`/email/inbox`), first in the module's pages and in the Email tabs, with its unread count:
a row of mailboxes, a row of Inbox, Archived, Spam and All, a search, and the conversations with a
box each to tick and a row of commands for the ticked ones. A conversation (`/email/inbox/:id`) is
marked read when opened; older messages fold and are fetched only when opened; the reply form
sends from the mailbox, and Undo puts the words back in it. Mailboxes and rules
(`/email/mailboxes`): each mailbox with its state and what stands in its way, add, change, switch
off and delete, the rules, the blocked senders, and the room used against the free plan.

Mail setup (`/email/mail`), in the Email tabs: the route's line, the steps as a checklist, the
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
Never KV (mail law M-3).
