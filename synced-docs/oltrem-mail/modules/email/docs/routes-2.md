---
title: "@oltrem/email: Routes, continued (2)"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Routes, continued (2)

> Part of [the @oltrem/email README](../README.md).

## Routes, continued

| Route | Capability | What it does |
|---|---|---|
| `GET /messages?status=` | `email.read` | The tenant's newest fifty messages: to whom, through which instance, what became of each |
| `GET /stats` | `email.read` | The last 14 days (UTC), a row each, every day there even when nothing was sent: the messages that left, those still on the way, the problems (failed, bounced, refused, marked as spam), and of those that left, how many were delivered, opened and clicked. Read through the tenant's index on its last change, so it costs one read per message of the fortnight; the Activity page draws its figures and chart from it |
| `GET /primary` | `email.self` | Who the portal's own mail comes from, for every account: `{ name, from, addresses, domains }`, the main address first, each sender address once in lower case, at most 50, and their domains. A portal with no address to send from yet answers empty lists, not a refusal. The Notifications page turns it into a Gmail filter file and a contact card (see `docs/setup.md` section 6.1) |
| `POST /primary/test` | `email.self` | Sends the person a plain test from the main address (`email.primary-test`, untracked, no HTML) that says what to do if it did not land in the main inbox; keyed by the person and the minute, so a second press within the minute sends nothing new (`duplicate: true`) |
| `GET /usage/brief` | `email.read` | The left pane's Sending gauge: `{ used, limit, window }`, every instance's tightest allowance as last kept on it, added up, with no provider asked and no message counted; null when none has a limit |
| `GET /usage` | `email.read` | Each instance that may send: what its provider says is used and left today, this month or on the plan, the tightest window left, and what the portal sent through it today, this week (from Monday) and this month, by its own record (see Allowance) |
| `GET /instances/:id/hook` | `email.manage` at the company | The address to paste into the provider's dashboard for its delivery reports; it carries the instance's secret token, so it needs a sign-in within ten minutes (`KIT-E-2004`) and reading it is audited as `email.hook` |
| `GET /write` | `email.senders.use` | What the Write page needs: the addresses the person may send everyday mail from, whether they may add another (`addFrom`), the company's time zone and today on its clock, [Ready to send](bulk-mails-pipe.md#ready-to-send), the templates for Write (each with its fields, whether it has a message place, a letter's words, and `locked` with why when the person may not use it), whether they may use code (`code`) and save a template (`saveTemplate`), the addresses they wrote to lately (`recent`), and `files: { maxBytes, max }`, the bytes an email's files may be together (0 without the bucket or a provider that takes files). Its reads start together and the services that may send are read once, so the page waits for the slowest read, not their sum |
| `POST /write` | `email.senders.use` | Send an email the person wrote (`senderId`, `to`, `cc`, `bcc`, `subject`, `body`, optional `draftId`, `later: { day, time }`, `templateId`, `templateVersion`, `fields`, `format` `words` or `html`, and `thread` for a reply) from an address they may use for everyday mail, through the queue after the Undo wait, or at the time asked (see Write); audited with the template and its version, and `format` when HTML |
| `POST /written` | `email.senders.use` | Save a draft, new or over the person's draft `id`, with its template, fields and format checked as for a send |
| `GET /written/:id/preview` | `email.senders.use` | One of the person's emails as it will be sent, as its own page under a policy that runs nothing |
| `GET /written?state=` | `email.senders.use` | The person's own drafts (`draft`), scheduled emails (`scheduled`) or sent ones (`sent`: those still in the queue too), newest first, a hundred at most; each carries `delivery`, its message's state and reports, once queued, and `undoUntil` while its Undo wait lasts |
| `GET /written/:id` | `email.senders.use` | One email the person wrote, with its `delivery` and its `files` |
| `POST /written/:id/files?name=` | `email.senders.use` | Attach one file to the person's draft, its content as the body (see Files under Write): 201 with `{ id, name, size, type }`; `KIT-E-1512` for a kind or a size an email may not carry, `KIT-E-1511` once it is no longer a draft |
| `DELETE /written/:id/files/:fileId` | `email.senders.use` | Take one file off the person's draft, from the bucket too |
| `POST /written/:id/undo` | `email.senders.use` | Take back a scheduled email, or a sent one still in the queue: it becomes a draft (`KIT-E-1511` when too late) |
| `DELETE /written/:id` | `email.senders.use` | Delete one of the person's drafts |
| `GET /connect` | `email.manage` | What Email settings starts from: `{ from, name, example, providers, domains }`, the From address and name as set, a full example address on the company's own domain, how many providers can send and how many sending domains are added |
| `GET /ready` | `email.read` | [Ready to send](bulk-mails-pipe.md#ready-to-send): `{ ready, checks: [{ id, title, state, detail, fix, href, read? }], checkedAt, checking? }`, read from what the portal knows; while a check has not passed and its facts are over two minutes old, the services and the domain are asked again after the answer (`checking: true`) |
| `POST /ready/check` | `email.manage` | Check again: each service that may send asked with its key and the answer kept, the From address's domain checked, then the readiness |
| `POST /release` | `email.manage` at the company | The messages held because no provider was ready, released and the first ten sent now that one is, without waiting for `email.release` (which sends the rest); the Email services page calls it when a provider is made the one that sends |
| `POST /canary` | `email.manage` at the company | A test message through one instance (`instanceId`) to the address given (`to`) or the signed-in person's own, from the company's sender address on that provider's own domain when there is one (the client's address otherwise), before it is made the one that sends; the result is kept on the instance as its last probe, and the canary is audited as `email.canary` |
| `GET /home` | `email.read` | The Home card: the messages of the last 24 hours, how many were sent, wait and failed; read through `email_messages_created` (migration `1018`), so only the day's rows |
| `GET /report?days=&to=` | `email.read` | The section on the Reports page's Email tab, from the rows already kept: sent and failed against the period before and one line a day; delivered, the share of those opened, bounced and refused only once a delivery report has come in; each integration's messages, and the addresses with the most temporary bounces (`email_softbounces`) |
| `GET /domains` | `email.senders.manage` | The sending domains with their records, check lines and defaults |
| `POST /domains` | `email.senders.manage` | Add a domain (`domain`, `instanceId`), through the provider where it can, and check it |
| `POST /domains/discover` | `email.senders.manage` | Read the domains and addresses each email provider lists, and add the new ones, or only those in `names` (see Senders) |
| `GET /domains/found` | `email.senders.manage` | What each email provider lists, each marked `here` or not, with what could not be read (`notes`) and how many were read; nothing is added |
| `POST /domains/:domain/check` | `email.senders.manage` | Ask the provider to look again, then check the provider and DNS now |
| `POST /domains/:domain/confirm` | `email.senders.manage` | A person confirms the provider's dashboard shows the domain verified |
| `POST /domains/:domain/default` | `email.senders.manage` | Make an address the domain's default for bulk or everyday mail (`use`, `senderId`) |
| `DELETE /domains/:domain` | `email.senders.manage` | Remove a domain that has no sender address |
| `GET /senders` | `email.senders.manage` | Every sender address, with its domain's state and the defaults it holds |
| `GET /kinds` | `email.senders.manage` | [Which address each kind of mail comes from](senders-and-sending-domains.md#which-address-each-kind-of-mail-comes-from): `{ main, items: [{ kind, title, summary, senderId, sender, problem }], choices: [{ id, email }] }` |
| `PUT /kinds` | `email.senders.manage` at the company | `{ picks: { <kind>: <senderId or ''> } }`: an everyday sender of the company, or empty for the main address; a kind the portal does not send is refused. Answers `{ changed }` |
| `GET /senders/places` | `email.senders.manage` | The places where the person may add a sender address, the company first |
| `GET /senders/usable?use=` | `email.senders.use` | The addresses the person may send bulk or everyday mail from, the defaults first; bulk only from a passing domain |
| `POST /senders` | `email.senders.manage` | Add an address (`email`, `name`, `replyTo`, `scopeId`, `purpose`) |
| `POST /senders/own` | `email.senders.use`, and `email.senders.add` or `email.senders.manage` at the company | Another address from Write (`email`, `name`): for everyday mail, at the company, on a domain here or one a provider lists (see Senders); 201 with the address |
| `PATCH /senders/:id` | `email.senders.manage` | Change its name, reply-to, place or purpose |
| `DELETE /senders/:id` | `email.senders.manage` | Remove it; a default goes last |
| `GET /templates?archived=&use=` | `email.templates.read` | The saved templates, the newest change first, and whether the person may build and paste; `use=bulk` only those for campaigns, `use=everyday` only those for Write |
| `POST /templates` | `email.templates.write` | A new template (`name`, `kind` `blocks` or `html`, `style` `design` or `letter`, `uses`, and a letter's `subject` and `body`); blocks start with three to change, or a heading and a message place for Write |
| `GET /templates/:id?version=` | `email.templates.read` | The template with its checks, merge fields and versions; an older version when one is named |
| `PATCH /templates/:id` | `email.templates.write` | Save `name`, `subject`, `preheader`, `accent`, `uses`, `blocks`, `html` or a letter's `body`, with the `version` edited; a code block needs `email.templates.html` to be added or changed |
| `POST /templates/:id/copy` | `email.templates.write` | A copy, as a new template |
| `POST /templates/:id/archive` | `email.templates.write` | Archive it (`archived` true) or bring it back |
| `POST /templates/:id/revert` | `email.templates.write` | Make an older `version` the current one again |
| `GET /templates/:id/preview?version=&dark=` | `email.templates.read` | The message filled with sample values, as its own page under a policy that runs nothing |
| `POST /templates/:id/test` | `email.templates.write` | Send it to oneself at once; the version is marked as tested |
| `GET /lists?archived=` | `email.lists.read` | The saved lists with their counts, and whether the person may fill and download them |
| `POST /lists` | `email.lists.write` | A new, empty list (`name`, `description`) |
| `POST /lists/forget` | `email.lists.write` | Take an address off every list |
| `GET /lists/sample` | `email.lists.write` | A CSV to fill in: `email`, `name`, `first_name`, `last_name`, `company`, `city` and two rows at example addresses, as `list-sample.csv` |
| `GET /lists/:id?q=&after=` | `email.lists.read` | A list, its counts, its last import's reason, and fifty of its people |
| `PATCH /lists/:id` | `email.lists.write` | Change its name or description |
| `POST /lists/:id/import?mode=&consent=&note=&source=&typed=` | `email.lists.write` | Fill it from the body, a CSV file or typed addresses (`typed=1`), adding or replacing; answers what the import did |
| `GET /lists/:id/suggestions` | `email.lists.write` | The people the signed-in person emailed from Write (their last 100 sent emails, most written to first, up to `SUGGESTED`), lowered, without the ones already on the list: `{ items: [{ email, name }] }` |
| `DELETE /lists/:id/people/:email` | `email.lists.write` | Take one person off |
| `POST /lists/:id/archive` | `email.lists.write` | Archive it (`archived` true) or bring it back |
| `DELETE /lists/:id` | `email.lists.write` | Delete it and its people |
| `GET /lists/:id/download/ready` | `email.lists.export` | `{ ready: true }` when a download would be allowed now; `KIT-E-2004` when it needs a fresh sign-in, so the page shows Confirm it's you |
| `GET /lists/:id/download` | `email.lists.export` | The list as a CSV file; audited |
