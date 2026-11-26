---
title: "@oltrem/mail: capabilities, settings, jobs, health, errors"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src/module.ts, inbox.ts, errors.ts]
---

# @oltrem/mail: capabilities, settings, jobs, health, errors

> Part of [the @oltrem/mail README](../README.md).

## Capabilities and settings

| Kind | Id | What |
| --- | --- | --- |
| Capability (plane 30) | `mail.read` | See the route, staff addresses and forwarding |
| Capability | `mail.manage` | Set them up; on the Owner floor (Routing changes where a domain's mail goes) |
| Capability | `mail.inbox.read` | Read the mailboxes at the person's places, change a conversation's state |
| Capability | `mail.inbox.reply` | Answer from a mailbox's address |
| Capability | `mail.inbox.manage` | Mailboxes, rules, blocked senders (class admin) |
| Setting | `mail.cloudflare_first` | Paid mode only: customers' transactional mail through Cloudflare first; off |
| Setting | `mail.inbox.keep_days` | Remove older mail and its copy; 0 (default) keeps all; the Owner's |
| Setting | `mail.inbox.spam_score` | File mail scoring at least this as spam; 0 (default) files none |

## Jobs

| Job | What it does |
| --- | --- |
| `mail.cloudflare` | Hourly: each route read back once a day, four companies a run; new staff asked |
| `mail.soon` | Every 5 minutes while something is on a short clock (a snooze, a mailbox in its first hour, a verify link sent in the last day, a test being resent, an unsettled alias or domain), else hourly; woken by a snooze or a setup press. Brings back due snoozes (one write); reads back verify links (one listing); resends for a day a test refused only for an unonboarded domain (4 companies a run); remakes failed routing rules (5 mailboxes a run); then forwarding, 8 Cloudflare calls at most |
| `mail.inbox` | Hourly: brings back conversations unanswered three days (one write); removes mail past `keep_days` (100 a run), the conversations emptied (by key) and senders kept only for an unsubscribe |

## Health

| Check | What it says |
| --- | --- |
| `mail.cloudflare` | Warn while a set-up route is not ready, with its line |
| `mail.forwarding` | Warn for a domain or live alias with a problem (a refused rule, a forward that failed); a link not pressed yet is not one |
| `mail.inbox` | Fail without the bucket; warn while Mail is off with mailboxes, for a mailbox's problem, a forwarding link unpressed a day on, or past `DB_WARN_BYTES` (250 MB) of rows or `BUCKET_WARN_BYTES` (8 GB) of copies. Two rows read: the running totals, and rows counted only once the highest message number could pass the line |

## Errors

The `4000`s (`src/errors.ts`):

| Code | Status | When |
| --- | --- | --- |
| `KIT-E-4001` | 409 | The inbox is not ready: no bucket, Mail off, or no Email Routing |
| `KIT-E-4002` | 409 | That address is already a mailbox |
| `KIT-E-4003` | 409 | A mailbox holding mail is switched off, not deleted |
| `KIT-E-4004` | 409 | At a limit: `MAILBOXES_MAX` 200, `RULES_MAX` 50, `BLOCKED_MAX` 500 |
| `KIT-E-4005` | 502 | Cloudflare refused a routing rule; the dashboard step is named |
| `KIT-E-4006` | 409 | No message from outside to answer |
| `KIT-E-4007` | 409 | The mailbox's address could not be made a sender |
| `KIT-E-4008` | 409 | That address forwards already, or is a mailbox |
| `KIT-E-4009` | 409 | The domain cannot move yet, or was not moved by the portal |
