---
title: "Positioning: who buys Oltrem, what to keep, cut or improve, what to build next"
status: proposed
owner: vendor
last_verified: 2026-11-28
sources: [docs/roadmap.md; modules/*/README.md; the owner's question of 2026-11-28 "why not log in to each provider"; market research of 2026-10-27 listed at the end]
---

# Positioning

> **In plain words.** The owner asked why a client would use Oltrem instead of each provider's
> own dashboard. This page answers: who buys, the pitch, every feature marked keep, cut or
> improve, and the next three things to build. The ranked list lives in [the roadmap](../../docs/roadmap.md).

## Who buys, and why

**The buyer:** a small business owner who is not technical, with a website and five to ten paid
services (hosting, email, a booking or shop tool, analytics, storage, a database), and a few
staff. Often through the vendor's managed service.

**Why not log in to each provider?** Each provider shows its own part and nothing else. No
provider can show:

| Only the portal gives | What the owner gets |
|---|---|
| One list across services that acts | "Needs you" says what broke, why, and fixes it in one press |
| One staff sign-in with rules | Staff never hold provider passwords; access ends in one place |
| One audit trail across services | Who did what, anywhere, in one log |
| Backups and data the client owns | Their own Cloudflare account, nightly copies, a restore drill |
| Mail, Files and Jobs built in | Fewer paid tools: newsletters, file sharing, scheduled jobs |

**The pitch:** stop checking ten dashboards: Oltrem watches your website, email, backups and
staff access, tells you what needs you, and fixes most of it in one press, in your own account.

Copying a provider's dashboard into the portal does not sell: the provider's own page is always
fuller. Work goes to what crosses services.

## Every feature: keep, cut or improve

"Cut" means no more building and off by default for a new client; nothing is deleted without the
owner's yes.

| Feature | Call | Why |
|---|---|---|
| Home, "Needs you" | **Improve** | The reason to buy; today a list of links, not a watcher |
| Alerts, System status, health checks | **Improve** | Feed Needs you; the owner should not read a status page |
| Sign-in and access, audit log, backups | Keep | The strongest parts; cross-service proof the client owns |
| Mail (sending, campaigns, inbox), Files | Keep | Replace a newsletter tool, mail forwarding and file sharing |
| Records, forms, tasks, approvals, announcements | Keep | Daily work any business has |
| Bookings, time off, time clock, shifts, expenses, assets, quotes, invoices, customers | Keep, off by default | Built; switched on by kind of business; no more work until a client asks |
| Reports on the portal's own data | Keep | Nobody else has it |
| Reports, Website board (provider views, recordings player) | **Cut** | Copies of PostHog and Cloudflare; keep what is built, a summary and a link out |
| Connected databases editor (`data`) | **Cut** | A developer tool; reading and backups stay |
| Apps page (connections, checks, calendar and sheet links) | Keep | The feed the watcher reads |
| Developer (webhooks, API keys), Scheduled jobs | Keep, vendor only | Not for the owner |
| Automations | Improve, later | Should run the watcher's fixes |
| Fleet auto-deploy | Keep | The managed service's backbone |
| Shared server, Console, Website product | Later | Not what makes someone pay now |

## What to build next, ranked by what makes someone pay

1. **Needs you as a real watcher.** Every connected service, backup, email domain and alert in
   one list; each row names the fix in plain words with a one-press action; a service that stops
   working is emailed once and closes itself when it works again.
2. **The owner's monthly report.** One email: what the portal watched, fixed and backed up, who
   has access, what changed. It shows the value each month, so the client keeps paying.
3. **Someone leaves, in one press.** Their sign-in, sessions, API keys, file links and grants end
   at once, with a list of the outside accounts still to close.

## What the market charges for

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

## Sources

Read on 2026-10-27: [Jet Admin, Retool vs Appsmith](https://www.jetadmin.io/blog/retool-vs-appsmith-which-is-better-for-internal-tool-development/);
[UI Bakery, internal tools 2026](https://uibakery.io/blog/best-platforms-for-building-internal-tools);
[WeWeb, Appsmith vs Retool](https://www.weweb.io/blog/appsmith-vs-retool-comparison);
[NocoBase plugins](https://www.nocobase.com/en/plugins);
[Assembly, client portal features](https://assembly.com/blog/client-portal-features);
[Noloco, approval workflows](https://noloco.io/blog/client-portal-software-for-approval-workflows-in-2026);
[WorkOS audit logs](https://workos.com/docs/audit-logs/index.md);
[Bird, Gmail and Yahoo requirements](https://bird.com/docs/knowledge-base/deliverability/gmail-yahoo-requirements).
