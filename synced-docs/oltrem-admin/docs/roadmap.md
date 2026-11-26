---
title: "Roadmap: what the kit sells, what is built, what comes next"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [the plan sections 4.4 and 18; market research of 2026-10-27 listed at the end; modules/*/README.md]
---

# Roadmap

> **In plain words.** Oltrem sells a ready-made admin portal any business can use, in the client's
> own Cloudflare account at almost no hosting cost. This page says what buyers pay for, how the
> parts group into editions, what is built and how the next part is chosen. Every feature is one
> any company uses. Each module's README owns what it does and what it does not do yet.

## What buyers pay for

From the internal-tool builders (Retool, Appsmith, Budibase, NocoBase, Jet Admin, UI Bakery),
client-portal products and the standards behind audit logs, webhooks and bulk email:

1. **Permissions people trust**: roles, permissions on the data, a log of access changes.
2. **An audit trail by default**: who, what, to what, when and from where, exportable.
3. **Files with sharing**: inside by the same rules, outside by a link that ends.
4. **Messages that reach people**: authenticated sending, one-click unsubscribe (RFC 8058), a
   complaint rate under 0.3 per cent, opt-outs honoured within two days.
5. **Automation and an API**: schedules and triggers, API keys, signed webhooks (Standard Webhooks).

The market charges about 5 to 50 US dollars a user a month, self-hosting reserved for enterprise
plans. That is the opening.

| What the client gets | Why it matters |
|---|---|
| Their own Cloudflare account, the free plan | No per-user hosting bill; they own the data |
| Ready-made features, not a builder | Records, forms, people, email and backups work on day one |
| Phone first | Every page works on a phone, no app to install |
| Permissions by place | A role holds at one branch and not another, with exceptions and "see it as" |
| Audit, backups and health built in | A sealed log, nightly copies with a drill, System status watching the free plan |
| An AI agent can extend it safely | A contract file, strict gates and a module generator |

## Editions

An edition is a list of modules mounted in the client's Worker; nothing else changes.

| Edition | Modules |
|---|---|
| **Core**, in every portal | `iam`, `users`, `privacy`, settings, `alerts`, audit, health, `jobs`, `backup`, `github` |
| **Work** | `records`, `forms`, `files`, `tasks`, `approvals`, `announcements`, `bookings`, `timeoff`, `expenses`, `assets`, `timeclock`, `shifts`, `quotes`, `invoices`, `customers`, `automations`, `analytics`, `connect` |
| **Admin** | `data` (connected databases), API keys (`iam`) |
| **Messages** | `providers`, and from Oltrem Mail (packed in `vendor/mail/`) `email`, `campaigns`, `mail` |
| **Developer** | `developer` (webhooks, the API reference) |
| **Website** (later) | The public site shell, content, SEO, visitor analytics |

## State

Every module under `modules/` is **built**; its README says what it does and lists what it does
not do yet. Started or later:

| Part | State |
|---|---|
| `data` | Started: Turso, Neon, Supabase, Airtable and Upstash read and, where turned on, edited with Undo; questions in SQL; a Supabase project's sections; usage. Next: an approval before a change, and links to AWS, Google Cloud, Azure and Snowflake |
| `customers` | Next: customers who sign themselves up, when a client wants it |
| `site`, `cms`, `seo`, visitor analytics | Later (plan 4.4) |
| SMS, WhatsApp | Later |
| `vps`, `postgres` | Later, optional |

## How a round is chosen

The next module is the one most clients would use, that needs no new resource or secret, and that
the free plan can carry. One that needs a new kind of resource waits for the owner's yes with the
reason written down (R-09).

## Sources

Read on 2026-10-27: [Jet Admin, Retool vs Appsmith](https://www.jetadmin.io/blog/retool-vs-appsmith-which-is-better-for-internal-tool-development/);
[UI Bakery, internal tools 2026](https://uibakery.io/blog/best-platforms-for-building-internal-tools);
[WeWeb, Appsmith vs Retool](https://www.weweb.io/blog/appsmith-vs-retool-comparison);
[NocoBase plugins](https://www.nocobase.com/en/plugins);
[Assembly, client portal features](https://assembly.com/blog/client-portal-features);
[Noloco, approval workflows](https://noloco.io/blog/client-portal-software-for-approval-workflows-in-2026);
[WorkOS audit logs](https://workos.com/docs/audit-logs/index.md);
[Bird, Gmail and Yahoo requirements](https://bird.com/docs/knowledge-base/deliverability/gmail-yahoo-requirements).
