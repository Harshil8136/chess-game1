---
title: "Roadmap: what the kit sells, what is built, what comes next"
status: living
owner: vendor
last_verified: 2026-10-27
sources: [the plan sections 4.4 and 18; market research of 2026-10-27 listed at the end]
---

# Roadmap

> **In plain words.** Oltrem sells a ready-made admin portal that any business can use, running in
> the client's own Cloudflare account at almost no hosting cost. This page says what buyers of
> such portals pay for, how the kit's parts group into things a client can buy, which parts are
> built, and the order of what comes next with the reason for each. It never aims the kit at one
> kind of business: every feature here is one any company uses.

## What buyers pay for

The research of 2026-10-27 (sources at the end) read the internal-tool builders (Retool, Appsmith,
Budibase, NocoBase, Jet Admin, UI Bakery), the client-portal products sold to service firms, and
the standards behind audit logs, webhooks and bulk email. Five things come up again and again:

1. **Permissions people trust.** Role-based access, permissions on the data and not only on the
   page, and a log of who changed whose access. Several reviews name a weak permission model as
   the reason a general tool loses to a dedicated portal.
2. **An audit trail by default.** Every action recorded with who, what, to what, when and from
   where, exportable for an auditor. The audit-log products (WorkOS among them) settle on the same
   shape: an actor, an action, targets, a context of address and device, and short metadata.
3. **Files with sharing.** A place to keep documents, shared inside the company by the same rules
   as everything else, and outside it by a link that expires.
4. **Messages that reach people.** Notices to staff, replies to customers, and bulk sends to a
   list, within the mailbox providers' rules: authenticated sending, one-click unsubscribe
   (RFC 8058), a complaint rate under 0.3 per cent, and an opt-out honoured within two days.
5. **Automation and an API.** Things that run on their own (schedules, triggers), an API key for
   other systems, and signed outgoing webhooks so other tools hear about changes (the Standard
   Webhooks scheme: an id, a timestamp and an HMAC signature per delivery).

Pricing in the market is per user: from about 5 to 50 US dollars a user a month, with the
self-hosted tiers of the builders reserved for their enterprise plans. That is the opening:

## Why a client picks Oltrem

| What the client gets | Why it matters against the alternatives |
|---|---|
| It runs in the client's own Cloudflare account, on the free plan | no per-user hosting bill; the client owns the data and the account |
| Ready-made features, not a builder | nothing to assemble: records, forms, people, email, backups work on day one |
| Phone first | every page works on a phone before anything loads, with no app to install |
| Permissions by place | a role holds at one branch or department and not another, with exceptions per person and "see it as" to check |
| Audit, backups and health built in | the log is sealed daily, the database is copied nightly and a drill proves it opens, and System health watches the free plan's limits |
| An AI agent can extend it safely | a contract file, strict gates and a module generator, so a client's own feature is added without breaking the rest |

## Editions: how the modules group into what a client buys

| Edition | Modules | Who it is for |
|---|---|---|
| **Core**, in every portal | people and access (`iam`, `users`), settings, audit, alerts, health, backups, deploys | every client |
| **Work** | records (your own lists), forms and inbox, files, automations, analytics | a team that runs its day in the portal |
| **Messages** | providers, email, campaigns (bulk sends), later SMS and WhatsApp | a business that writes to its customers |
| **Developer** | API keys, outgoing webhooks, the API reference, the jobs page | a business that connects other systems |
| **Website** (later) | the public site shell, its content, SEO, privacy requests, visitor analytics | a business whose website runs on the same account |

An edition is a list of modules mounted in the client's Worker; nothing else changes between them.

## State of each module

| Module | Edition | State |
|---|---|---|
| `iam`, `users` | Core | **built**: places, roles, groups, exceptions, see it as, invitations (one or fifty at a time, each link emailed since 2026-10-27), switching off; since 2026-10-27 a grant ending within the week is emailed to its holder and an overdue access review shows on the health page |
| settings, audit, alerts, health, backup, github | Core | **built** |
| `records` | Work | **built** 2026-10-22: lists with nine kinds of field, CSV export |
| `forms` | Work | **built** 2026-10-22: website forms, an inbox with take, notes and replies |
| `providers`, `email` | Messages | **built**: seven email providers as data, failover, delivery reports |
| `files` | Work | **built** 2026-10-27: a drive per place in the client's bucket, opened by the roles held there, links that end, a trash |
| `campaigns` | Messages | **built** 2026-10-27: a list from a CSV file, merge fields, a test, chunks within a daily limit, one-click unsubscribe, a suppression list fed by bounces and complaints |
| `developer` | Developer | **built** 2026-10-27: the jobs page (every job and flow, its last runs, run soon, pause), webhooks fed by the audit log and signed as Standard Webhooks sign them, with retries and a delivery log, the API reference read from the manifests |
| API keys | Developer | later: a service calls the API through a Cloudflare Access service token today; making one from the Developer page comes later |
| `automations` | Work | **built** 2026-10-27: when an audited action happens (a website form's answer among them) or on a schedule in UTC, send an email or raise an alert, or a client's own action; a log of every run. Actions on records, and chains of steps, later |
| `analytics` | Work | **built** 2026-10-27: the portal's activity counted from the audit log by day, area and action, against the period before; two bar charts, a CSV of the days. A module's own series (emails delivered) later |
| customer sign-in | Work | next: the client's own customers see their records and files |
| `site`, `cms`, `seo`, `privacy`, visitor analytics | Website | later, as plan section 4.4 lists them |
| `sms`, WhatsApp | Messages | later (the owner's card 15) |
| `vps`, `postgres` | Developer | later, optional |

## This round's foundation work

Three changes under every module, done before the new modules so each one uses them:

- **The audit writes itself.** The pipeline records every change made through the API (a POST,
  PUT, PATCH or DELETE) with its outcome, the route, the status and how long it took, including
  the refusals the permission check and the schema make, so no module can forget one. A module
  that writes its own richer row keeps doing so, and the pipeline does not write a second.
- **A module brings its own pages.** The manifest gains the pages and the sidebar entry of the
  module, so a new module is one package mounted in one line, with no edit to the screens package.
- **A new look.** A calmer palette, a glass frame, smooth page transitions in the browsers that
  have them, and pages fetched before the click. A search over every section comes later.

## How a round is chosen

The next module is the one that most clients would use, that needs no new resource or secret, and
that the free plan can carry. A module that needs a new kind of resource waits for the owner's
yes with the reason written down (R-09).

## Sources

Read on 2026-10-27:

- [Retool vs Appsmith comparison, Jet Admin](https://www.jetadmin.io/blog/retool-vs-appsmith-which-is-better-for-internal-tool-development/)
- [Best platforms for building internal tools 2026, UI Bakery](https://uibakery.io/blog/best-platforms-for-building-internal-tools)
- [Appsmith vs Retool 2026, WeWeb](https://www.weweb.io/blog/appsmith-vs-retool-comparison)
- [NocoBase plugins](https://www.nocobase.com/en/plugins)
- [Client portal features for service firms, Assembly](https://assembly.com/blog/client-portal-features)
- [Client portal software for approval workflows, Noloco](https://noloco.io/blog/client-portal-software-for-approval-workflows-in-2026)
- [WorkOS audit logs](https://workos.com/docs/audit-logs/index.md)
- [Gmail and Yahoo sender requirements, Bird](https://bird.com/docs/knowledge-base/deliverability/gmail-yahoo-requirements)
- [The View Transition API, Chrome for Developers](https://developer.chrome.com/docs/web-platform/view-transitions)
