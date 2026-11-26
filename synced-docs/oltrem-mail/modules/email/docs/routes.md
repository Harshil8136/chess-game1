---
title: "@oltrem/email: routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/email.ts, templates.ts, lists.ts, written.ts]
---

# @oltrem/email: routes

> Part of [the @oltrem/email README](../README.md). The public hooks (delivery reports, attached
> files) are in [Delivery reports](delivery-reports.md) and [Write, continued](write-2.md).

Under `/api/email`, through IAM's sessions and check. A fresh sign-in is asked only by
`email.lists.export` and `GET /instances/:id/hook` (never of the Vendor); the page shows **Confirm
it's you** in place (the list page asks `GET /lists/:id/download/ready` first). The templates' and
lists' capabilities are held at the company. `email.write.code` is an `operate` capability that
migration `1017` gives every role holding `email.senders.use`, and it counts wherever held
(`holdsAnywhere`).

## Messages, usage and readiness

| Route | Capability | What it does |
| --- | --- | --- |
| `GET /messages?status=` | `email.read` | The newest 50 messages: to whom, through which instance, what became of each |
| `GET /stats` | `email.read` | The last 14 UTC days, a row each: left, on the way, problems, and delivered, opened, clicked; Activity's figures |
| `GET /home` | `email.read` | The Home card: the last 24 hours sent, waiting and failed, through `email_messages_created` (migration `1018`) |
| `GET /report?days=&to=` | `email.read` | The Reports page's Email tab: sent and failed against the period before, a line a day; delivered, opened, bounced and refused once reports came in; each integration's messages; the most soft-bounced addresses (`email_softbounces`) |
| `GET /primary` | `email.self` | Who the portal's own mail comes from: `{ name, from, addresses, domains }`, at most 50, for the Notifications page's Gmail filter and contact card |
| `POST /primary/test` | `email.self` | A plain untracked test from the main address (`email.primary-test`), keyed by person and minute (`duplicate: true`) |
| `GET /usage/brief` | `email.read` | The pane's Sending gauge `{ used, limit, window }` from the kept allowances; null with no limit |
| `GET /usage` | `email.read` | Each instance: the provider's used and left, the tightest window, and the portal's own count today, this week and month |
| `GET /ready` | `email.read` | [Ready to send](bulk-mails-pipe.md#ready-to-send): `{ ready, checks, checkedAt, checking? }`; facts over two minutes old on a failing check are asked again after the answer |
| `POST /ready/check` | `email.manage` | Each service asked with its key, the From domain checked, then the readiness |
| `POST /release` | `email.manage` (company) | Held messages released, the first ten sent now, the rest by `email.release` |
| `POST /canary` | `email.manage` (company) | A test through one instance (`instanceId`) to `to` or oneself; kept as its last probe; audited `email.canary` |
| `GET /connect` | `email.manage` | Setup's start: `{ from, name, example, providers, domains }` |
| `POST /connect` | `email.manage` and `providers.manage` (company) | [The simple provider card](senders-and-sending-domains.md#the-simple-provider-card) in one press |
| `GET /instances/:id/hook` | `email.manage` (company) | The delivery-report address with its token; fresh sign-in (`KIT-E-2004`), audited `email.hook` |
| `POST /instances/:id/reports` | `email.manage` (company) | Registers that address at the provider by API (Resend, Brevo, Mailjet); audited `email.reports` |
| `DELETE /instances/:id/reports` | `email.manage` (company) | Takes this instance's address away at the provider; audited `email.reports-remove` |

## Write

All need `email.senders.use`; see [Write](write.md).

| Route | What it does |
| --- | --- |
| `GET /write` | The page's data: usable addresses, `addFrom`, the company clock, Ready to send, templates (fields, message place, `locked`), `code`, `saveTemplate`, `recent`, `files: { maxBytes, max }`; reads start together |
| `POST /write` | Send (`senderId`, `to`, `cc`, `bcc`, `subject`, `body`, `draftId`, `later`, `templateId`, `templateVersion`, `fields`, `format`, `thread`) after the Undo wait or at `later`; audited |
| `POST /written` | Save a draft, new or over `id`, checked as a send |
| `GET /written?state=` | Own `draft`, `scheduled` or `sent` emails, newest 100, with `delivery` and `undoUntil` |
| `GET /written/:id` | One, with `delivery` and `files` |
| `GET /written/:id/preview` | As it will be sent, under a policy that runs nothing |
| `POST /written/:id/files?name=` | Attach the body as a file: 201 `{ id, name, size, type }`; `KIT-E-1512` kind or size, `KIT-E-1511` not a draft |
| `DELETE /written/:id/files/:fileId` | Take a file off, from the bucket too |
| `POST /written/:id/undo` | Back to a draft while scheduled or queued (`KIT-E-1511` when too late) |
| `DELETE /written/:id` | Delete a draft |

## Domains, senders and kinds

| Route | Capability | What it does |
| --- | --- | --- |
| `GET /domains` | `email.senders.manage` | The domains with records, check lines and defaults |
| `POST /domains` | `email.senders.manage` | Add (`domain`, `instanceId`), through the provider where it can, and check |
| `GET /domains/found` | `email.senders.manage` | What each provider lists, marked `here`, with `notes`; adds nothing |
| `POST /domains/discover` | `email.senders.manage` | Add what providers list, or only `names` |
| `POST /domains/:domain/check` | `email.senders.manage` | Provider looks again, then provider and DNS checked |
| `POST /domains/:domain/confirm` | `email.senders.manage` | A person confirms it verified |
| `POST /domains/:domain/default` | `email.senders.manage` | Default for bulk or everyday (`use`, `senderId`) |
| `DELETE /domains/:domain` | `email.senders.manage` | Remove one with no sender address |
| `GET /senders` | `email.senders.manage` | Every address, its domain's state and defaults held |
| `GET /senders/places` | `email.senders.manage` | Places the person may add one, the company first |
| `GET /senders/usable?use=` | `email.senders.use` | Usable bulk or everyday addresses, defaults first; bulk only on a passing domain |
| `POST /senders` | `email.senders.manage` | Add (`email`, `name`, `replyTo`, `scopeId`, `purpose`) |
| `POST /senders/own` | `email.senders.use` and `email.senders.add` or `.manage` (company) | Another address from Write; 201 |
| `PATCH /senders/:id` | `email.senders.manage` | Name, reply-to, place or purpose |
| `DELETE /senders/:id` | `email.senders.manage` | Remove; a default goes last |
| `GET /kinds` | `email.senders.manage` | `{ main, items, choices }`: each kind of mail's address |
| `PUT /kinds` | `email.senders.manage` (company) | `{ picks: { <kind>: <senderId or ''> } }`; an unknown kind refused; answers `{ changed }` |

## Saved templates

`.read` sees and previews, `.write` builds and tests, `.html` pastes or changes code
([Saved templates](saved-templates.md)).

| Route | Capability | What it does |
| --- | --- | --- |
| `GET /templates?archived=&use=` | `email.templates.read` | Newest change first; `use=bulk` or `everyday` |
| `POST /templates` | `email.templates.write` | New (`name`, `kind`, `style`, `uses`, a letter's `subject` and `body`) |
| `GET /templates/:id?version=` | `email.templates.read` | With checks, merge fields and versions |
| `PATCH /templates/:id` | `email.templates.write` | Save fields with the `version` edited; code needs `.html` |
| `POST /templates/:id/copy` | `email.templates.write` | A copy |
| `POST /templates/:id/archive` | `email.templates.write` | Archive or bring back (`archived`) |
| `POST /templates/:id/revert` | `email.templates.write` | An older `version` current again |
| `GET /templates/:id/preview?version=&dark=` | `email.templates.read` | Filled with samples, a page that runs nothing |
| `POST /templates/:id/test` | `email.templates.write` | To oneself now; marks the version tested |

## Saved lists

| Route | Capability | What it does |
| --- | --- | --- |
| `GET /lists?archived=` | `email.lists.read` | Lists with counts, and what the person may do |
| `POST /lists` | `email.lists.write` | New, empty (`name`, `description`) |
| `POST /lists/forget` | `email.lists.write` | An address off every list |
| `GET /lists/sample` | `email.lists.write` | `list-sample.csv`, two example rows |
| `GET /lists/:id?q=&after=` | `email.lists.read` | Counts, last import's reason, 50 people |
| `PATCH /lists/:id` | `email.lists.write` | Name or description |
| `POST /lists/:id/import?mode=&consent=&note=&source=&typed=` | `email.lists.write` | From a CSV or typed addresses, adding or replacing |
| `GET /lists/:id/suggestions` | `email.lists.write` | People the person emailed lately, not on the list, up to `SUGGESTED` |
| `DELETE /lists/:id/people/:email` | `email.lists.write` | One person off |
| `POST /lists/:id/archive` | `email.lists.write` | Archive or bring back |
| `DELETE /lists/:id` | `email.lists.write` | Delete it and its people |
| `GET /lists/:id/download/ready` | `email.lists.export` | `{ ready: true }`, or `KIT-E-2004` for a fresh sign-in |
| `GET /lists/:id/download` | `email.lists.export` | The CSV; audited |
