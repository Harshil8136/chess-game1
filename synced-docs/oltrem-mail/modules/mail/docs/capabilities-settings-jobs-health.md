---
title: "@oltrem/mail: Capabilities, settings, jobs, health"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src; split from modules/mail/README.md]
---

# @oltrem/mail: Capabilities, settings, jobs, health

> Part of [the @oltrem/mail README](../README.md).

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
| Job | `mail.soon` | every five minutes while something it serves is on a short clock (a snoozed conversation, a mailbox in its first hour, an address whose verify link went out in the last day, a test being sent again, an alias or a forwarding domain not settled in its first day); otherwise it sleeps (an hour a run, which is the pace of everything else it retries), woken by a snooze or by any press that changes the route, a mailbox or forwarding; brings back the snoozed conversations whose time came (one write for all); reads back the addresses Cloudflare emailed a verify link in the last day until each is pressed (one listing for all); sends again, for a day after the press, a route test refused only because the domain is not onboarded for Email Sending, 4 companies a run (one binding call each), so the route turns ready by itself once the dashboard step is taken; makes again the routing rules that failed and asks Cloudflare about forwarding addresses it was never asked about, 5 mailboxes a run, every five minutes in a mailbox's first hour and hourly after; then forwarding, 8 Cloudflare calls at most: the people waiting their turn asked about, the aliases' rules made once a link is pressed, and one domain read back (new, moving, or not read for a day) with its people's links |
| Job | `mail.inbox` | hourly; brings back once the conversations answered three days ago and not since (one write); removes mail past `keep_days` (100 messages a run), the conversations that run emptied (looked up by their key, never by reading every conversation, 2026-11-20), and the senders kept only for their list's unsubscribe once their mail is gone |
| Health | `mail.forwarding` | `warn` for a forwarding domain or a switched-on alias with a problem (a rule Cloudflare refused, a forward that did not go), with what to do; an alias waiting for a link is not a problem |
| Health | `mail.inbox` | `fail` without the bucket; `warn` while Mail is off with mailboxes, for a mailbox's problem (a rule, a copy not forwarded, a message not kept), for a forwarding address whose link has not been pressed a day after Cloudflare emailed it, and past 250 MB of rows or 8 GB of stored copies; the stored bytes are the mailboxes' running totals, and the rows are counted only once the highest message number passes the 250 MB line (below it the count cannot be past it), so an hourly check reads two rows, not every message |

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
