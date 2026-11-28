---
title: "Roadmap: what the kit sells, what is built, what comes next"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [the plan sections 4.4 and 18; modules/*/README.md; archive/proposals/2026-11-28-positioning.md]
---

# Roadmap

> **In plain words.** Who buys Oltrem, the next three things to build, the editions, what is built
> and how the next part is chosen. Each module's README owns what it does and what it does not do yet.

## Who buys, and what comes next

A small business owner who is not technical, with a website and five to ten paid services. The
pitch: stop checking ten dashboards; Oltrem watches your website, email, backups and staff
access, tells you what needs you, and fixes most of it in one press, in your own account. Work
goes to what crosses services, never to copies of a provider's dashboard
([the positioning, with every feature kept, cut or improved](../archive/proposals/2026-11-28-positioning.md)).

Next, ranked by what makes someone pay:

1. **Needs you as a real watcher**: every service, backup, email domain and alert in one list,
   each with its fix and a one-press action; a break is emailed once and closes itself.
2. **The owner's monthly report**: what was watched, fixed and backed up, who has access.
3. **Someone leaves, in one press**: every way in ends at once, with the outside accounts listed.

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

The next part is the highest on the ranked list above that needs no new resource or secret and
that the free plan can carry. One that needs a new kind of resource waits for the owner's yes with the
reason written down (R-09).
