---
title: "@oltrem/mail: pages, tables"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src/inbox-pages.tsx, forwarding-pages.tsx, pages.tsx, try-here.tsx, modules/mail/migrations]
---

# @oltrem/mail: pages, tables

> Part of [the @oltrem/mail README](../README.md).

## Pages

| Page | What it holds |
| --- | --- |
| Inbox (`/email/inbox`) | Drawn as Gmail draws mail (`MailShell`, `ConversationRow`): folders in Gmail's groups (Inbox, Starred, Snoozed, Sent, Drafts; Updates, Archived, Spam, All under More), labels with a +, the Mail storage gauge (`addMailPane`); on a phone, chips and a round Compose. Rows show the star, who, when, subject, label chips, a paperclip, and on a computer hover actions. A top bar with search (chips for unread, attachments, archived), tick-all and the commands (archive, read, unread, snoozes, Updates or Inbox, mute, archive all from sender, spam, block), each with Undo (but sweep and block). Swipe left archives, right marks read. Quick settings (Split or Full, Default or Compact, in cookies); Gmail's shortcuts (`src/reader/keys.js`, `?`). Changes show before the answer (`data-optimistic`), restored if refused. Unread count beside Inbox on every Email page (`addMailFolderCounts`) |
| A conversation (`/email/inbox/:id`) | Beside its list, read when opened, with the same commands, its snooze, mute or wait, Unsubscribe for list mail, older messages folded; **Saved replies** (the person's Write letters, name filled in) above the reply box, which sends from the mailbox with Undo |
| Labels (`/email/inbox/labels`) | Make, rename, recolour, remove |
| Mailboxes and rules (`/email/mailboxes`) | Each mailbox with its state and what blocks it; add, change, switch off, delete; automatic reply; rules; blocked senders; the room used |
| Forwarding (`/email/forwarding`) | Under Email's Settings tab, two views. **ImprovMX**: Connect (one field), then the account with Disconnect and Add a domain, and per domain its aliases (Change, Delete), Add the alias, Check its records and Recent mail (`?view=improvmx&mail=<domain>`). **Cloudflare** (resting while ImprovMX is connected, with its jobs): domains with where mail goes, Move from ImprovMX, Move back, Check again; aliases with each person's link state; add; Import from ImprovMX (key never kept) or a paste. Opens on ImprovMX unless only Cloudflare forwards |
| Mail setup (`/email/mail`) | Under Email's Settings tab: the route's line, the steps, the Email Routing form, domains with missing records and **Write them**, staff addresses, the test, Stop; a step not ready says whether Mail is ticked at setup or turned on in Features |

On the builder's computer, Forwarding and Mailboxes show **Send a test** (`src/try-here.tsx`).
Someone who may only read sees everything and nothing to change.

## The tables

Never KV (M-3).

| Migration | What it makes or adds |
| --- | --- |
| `1001` | `mail_cloudflare` (a row a company: domain, zone, Routing and sending states, mode, address, blockers, test and check times) and `mail_cloudflare_addresses` (staff addresses, verified time) |
| `1002` | `mail_mailboxes`, `mail_threads`, `mail_messages` (headers, snippet, attachment names, checks, score; never the body), `mail_search` (FTS5, contentless), `mail_blocked`, `mail_rules` |
| `1004` | Threads' `updates`, `muted`, `snoozed_until`; `mail_senders` (a person's move, unsubscribe ways, when left) |
| `1005` | Mailboxes' automatic reply (`auto_*`); senders' `auto_replied_at`; threads' `waiting_since`, `nudged` |
| `1007` | `mail_forward_domains` (zone, where mail goes, the old service, records kept for Move back, SPF added), `mail_aliases` (people as JSON, rule, in step, counts); addresses' `asked_at` |
| `1008` | `mail_cloudflare.test_to`, `test_asked_at` |
| `1016` | Threads' `starred`; `mail_labels`; mailboxes' `stored_bytes` |
| `1019` | `mail_threads_unread` (Home's card) and `mail_messages_received` (retention) |
| `1022` | Drops the unread `mail_messages_age` index |
