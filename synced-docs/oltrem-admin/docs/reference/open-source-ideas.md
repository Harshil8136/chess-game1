---
title: "Ideas from well-known open-source projects: what Oltrem could adopt"
status: proposed
owner: vendor
last_verified: 2026-11-01
sources: [the projects and pages listed under Sources]
---

# Ideas from well-known open-source projects

> **In plain words.** We read about fifty famous open-source admin tools, CRMs, help desks,
> mailers, job runners, permission engines and UI kits. This page lists what they do well that a
> buyer of an Oltrem portal would notice, ranked by how much a client gains against what it costs
> on Cloudflare's free plan. Most of the best ideas are small: saved views, bulk actions, undo, an
> onboarding checklist. The big builders (drag-and-drop apps, workflow canvases) are on the "do
> not adopt" list. We learn designs only and never copy code (R-03); the licence of each project
> is in the table at the end, and the AGPL and GPL ones are marked so nobody copies from them.

**What already exists, so it is not proposed again:** search with `Ctrl K` (a page, not a
palette), Needs you on Home, "see it as", the audit log viewer and its daily seal, nightly
backups with restore drills, the free-plan budgets on System status, webhooks with retries and a
delivery log, the Modules page (on and off per client), brand colours, a privacy request with
one-file export, and comments on tasks. See the [roadmap](../roadmap.md) and the
[screens README](../../packages/screens/README.md).

**How to read the costs.** "CPU" is per request (limit 10 ms). "D1" counts rows read and written
against 5M and 100k a day, and queries against 50 per request. "KV" counts against 1,000 writes
and 100k reads a day. "Subrequests" counts against 50 per request. Queues on the free plan give
10,000 operations a day, and each message costs about three (write, read, delete).

## 1. Top 15, ranked

### R1. Saved views on every list

- **The client gets:** a list filtered and sorted the way they like, saved under a name ("Open,
  North, this week"), for themselves or shared with a team. One tap brings it back.
- **From:** Directus [presets and bookmarks](https://docs.directus.io/app/presets-bookmarks),
  Twenty views, Plane views, Frappe saved filters, react-admin saved queries.
- **Fit:** lists already put their filters in the address (`?q=&field=&value=&sort=`). A saved
  view is that address with a name, an owner and, if shared, a place. One small table read by
  `@oltrem/screens`; a chip row of views above each list. Cost: one D1 read per list page, one
  write per save. No KV, no subrequest.
- **Effort:** S.
- **Caveats:** a shared view must never show more than the viewer may see: it stores the filter,
  not the rows, and every load runs the normal permission check.

### R2. Bulk actions

- **The client gets:** tick ten rows, then "Mark done", "Give to…", "Move to place", "Export" or
  "Remove" once, instead of ten times.
- **From:** Django admin actions, Filament bulk actions, react-admin and AdminJS bulk actions.
- **Fit:** the frame script already counts ticks and has "tick all" (`data-check-all`). A module
  declares which of its routes accept a list of ids. The server checks each row's place, writes
  one audit row per record, and answers with what was done and what was refused. Cost: one
  batched D1 write; cap a press at 100 rows to stay under 50 queries and the daily writes.
- **Effort:** S to M (a generic helper, then one line per module).
- **Caveats:** a bulk remove is the riskiest button in any portal; pair it with R4 (undo).

### R3. An onboarding checklist built from real data

- **The client gets:** a "Get started" card on Home for the Owner: name the company, invite a
  second Owner, add a place, connect email and send a test, see the first backup drill pass,
  choose modules. Each step ticks itself when the thing is really done.
- **From:** Frappe workspace [onboarding blocks](https://docs.frappe.io/framework/v14/user/en/desk/workspace/blocks#onboarding),
  the setup flows of Cal.com and Formbricks.
- **Fit:** a module adds an optional `onboarding` step to its manifest: a label, a link and a
  check that reads its own tables. Home shows the card until all pass or the Owner hides it.
  Cost: a few indexed D1 reads, only on Home, only for Owners.
- **Effort:** S.
- **Caveats:** this replaces "sample data". Nothing is invented; an empty list says how to
  start and offers import (R8).

### R4. Undo after remove, close or move

- **The client gets:** after "Remove", a notice says "Removed. Undo" for a few seconds. A slip
  of the thumb on a phone costs nothing.
- **From:** react-admin's default [undoable mode](https://marmelab.com/react-admin/Edit.html)
  (the change waits five seconds, Undo cancels it), soft deletes and restore in Filament, the
  trash in the kit's own files module.
- **Fit:** the server marks the row removed (a `removed_at` column) and the Done notice carries an
  Undo button that posts a restore. A job purges for good after a day (or by R15). Cost: one
  extra D1 write when undone.
- **Effort:** S per module, after one shared helper.
- **Caveats:** side effects must wait too. An email that announces the removal goes through the
  outbox with a short delay, so Undo can still stop it.

### R5. A timeline on every record, with comments and @mentions

- **The client gets:** on any record (a customer, an invoice, a piece of equipment) one column
  says who did what and when, and people can talk there: "@Ana can you check this?".
- **From:** Odoo's chatter, Frappe's timeline and comments, Twenty's record timeline, Django
  admin's History page.
- **Fit:** the history is already in the audit log, keyed by target; the timeline reads it by
  record (an index on the target). Comments become one generic table (module, record, author,
  text) instead of one per module; tasks already have them. A mention notifies (R6). Cost: one or
  two D1 reads per record page; one write per comment.
- **Effort:** M.
- **Caveats:** a comment is seen by whoever may see the record, checked by the module's own
  read rule. Comment text stays out of the hash-chained audit row; the row only says "commented".

### R6. A notifications inbox, with preferences and a daily digest

- **The client gets:** a bell with "Your request was approved", "You were given a task", "Ana
  mentioned you". Each person picks, per kind: in the portal, by email, by push (R10), in a daily
  summary, or not at all.
- **From:** Novu's [Inbox](https://docs.novu.co/platform/inbox/overview), preferences and digest
  steps; Filament database notifications; Plane's inbox; Odoo's followers.
- **Fit:** one `notify(person, kind, link)` call in the core that every module uses instead of
  sending its own email; a table of notifications and one of preferences. A daily job on the
  existing tick sends one digest email per person. Needs you stays for decisions; the bell is
  for news. Cost: one D1 write per recipient per event; the unread count is one indexed read.
- **Effort:** M.
- **Caveats:** modules send their own emails today; moving them to `notify` touches many
  modules. Keep "critical" kinds (sign-in, access given) always on, as Novu does.

### R7. A command palette and keyboard shortcuts

- **The client gets:** `Ctrl K` opens a box over the page: type "inv" and pick "New invoice",
  "Invoices" or a customer's name. `?` lists the shortcuts.
- **From:** [cmdk](https://github.com/pacocoursey/cmdk), Filament global search, Plane, Twenty
  and Chatwoot shortcuts.
- **Fit:** the server sends the pages and actions the person may use (from the sidebar model and
  the manifests), cached in the browser by version; records come from the existing search API as
  they type. Written in the frame script, without a library. Cost: no D1 for pages and actions;
  the usual search cost for records.
- **Effort:** S to M.
- **Caveats:** the frame script is about 20 KiB and the stylesheet sits just under its 64 KiB
  test; keep both small. Without the script, `Ctrl K` still opens the search page.

### R8. Import with column mapping, a dry run and a file of failed rows

- **The client gets:** upload a spreadsheet, match its columns to the fields (guessed by name),
  press "Check only" to see every problem before anything is saved, then import. Rows that fail
  come back as a file to fix and upload again.
- **From:** Filament's [import action](https://filamentphp.com/docs/4.x/actions/import) (mapping,
  failed-rows file, a notice when done), Frappe Data Import, Twenty's import.
- **Fit:** records already imports a CSV, all or nothing. Make it a core helper any module can
  use (customers, assets, campaign lists, invitations): the file lands in R2, the one Workflow
  checks and writes it in steps of a few hundred rows. Cost: rows written equal rows imported;
  CPU split across steps.
- **Effort:** M.
- **Caveats:** a 20,000-row file is a fifth of a day's D1 writes. Show the cost before the
  import and refuse what would break the day's budget.

### R9. Install as an app (PWA), with an offline page

- **The client gets:** "Add to home screen" puts the portal on the phone with its own icon and
  colours, opening full screen like an app, with no app store.
- **From:** Uptime Kuma, Plane and Chatwoot ship web app manifests; the W3C manifest standard.
- **Fit:** a generated `manifest.webmanifest` from the brand settings, and a tiny service worker
  that keeps only the frame and a "You are offline" page. Pages and API answers are never cached
  by it. Cost: static answers; no D1, no KV.
- **Effort:** S.
- **Caveats:** on iPhones, web push (R10) works only for a portal added to the home screen, so
  R9 comes first.

### R10. Push notifications on the phone (Web Push)

- **The client gets:** a buzz on the phone when a decision waits for them, even with the portal
  closed. No paid service.
- **From:** Chatwoot and Novu send web push; the standards are the Push API, RFC 8291 (message
  encryption) and RFC 8292 (VAPID).
- **Fit:** a channel of R6. One table of subscriptions per person and device. The VAPID key pair
  is sealed by `@oltrem/core-crypto` like a provider's credential, so no new Worker secret. The
  queue consumer encrypts with WebCrypto and posts to the push service. Cost: one subrequest
  per device (stay under 40 a run), and queue operations (about 3,300 messages a day).
- **Effort:** M.
- **Caveats:** a push carries only "You have something waiting" and a link, never personal data.
  Remove a subscription when the push service answers 404 or 410. Measure the CPU of one
  encryption before promising volumes.

### R11. Board and calendar views of any list

- **The client gets:** any list with a status becomes columns of cards to move ("New, Doing,
  Done"); any list with a date becomes a month calendar, or a day-by-day agenda on a phone.
- **From:** NocoBase, Twenty, Plane, Frappe and Odoo all offer a kanban and a calendar on any
  collection.
- **Fit:** a view kind next to the table (works with R1): records (a choice field), tasks,
  forms inbox statuses, quotes, bookings. Moving a card is a normal form post that changes one
  field; without the script, each card has a "Move to" select. On a phone, one column at a time
  with a sideways row of column chips (R-12). Cost: the list's usual query, limited to the month
  or to 50 cards a column.
- **Effort:** M.
- **Caveats:** a board needs a cap per column and a "show more", or a big list costs too many
  reads.

### R12. API keys with scopes, expiry, limits and usage

- **The client gets:** "Create key" on the Developer page: a name, what it may do, where, and
  until when. The key is shown once. The page shows when each key was last used and how much.
- **From:** Unkey (scopes, expiry, rate limits, usage), the Better Auth API key plugin, Lucia's
  advice to store only a hash of a token.
- **Fit:** the roadmap lists API keys as "later"; this is the design. Store a SHA-256 hash, never
  the key; scopes are a subset of the creator's own capabilities at a place; an expiry is
  required. Verifying is one KV read (cached by hash) with D1 behind it. Usage is counted in
  memory and written at most once a minute per key. Cost: KV reads share the 100k a day with
  sessions.
- **Effort:** M.
- **Caveats:** a strict rate limit needs Cloudflare's `ratelimit` binding (a new binding: the
  owner's yes under R-09; it counts per location, so it is approximate) or a Durable Object
  (paid, later). Start with no limit and the usage page.

### R13. A security checklist and rotation reminders

- **The client gets:** a "Security" card on System status: two Owners exist, Vendor access ends
  soon, no access review is overdue, the last restore drill passed, and no provider credential,
  webhook secret or API key is older than the chosen number of days. An email reminds before
  each one goes stale.
- **From:** Infisical's secret reminders (repeat every N days) and rotation, Supabase's security
  advisors.
- **Fit:** checks on the existing health runner (`@oltrem/core-health`), reading dates the kit
  already keeps (credentials, rotations, reviews, drills). A setting for the number of days.
  Cost: a handful of D1 reads once a day.
- **Effort:** S.
- **Caveats:** it advises; it never rotates a provider's key by itself, since that needs the
  provider's own dashboard.

### R14. Two-person approval for dangerous actions

- **The client gets:** a few actions (making someone an Owner, removing a list, emptying the
  trash, sending a campaign to thousands, exporting personal data) wait until a second person
  who may do the same confirms.
- **From:** Infisical's approval workflows, Windmill's approval steps; the kit's own approvals
  already forbid deciding your own request.
- **Fit:** a capability marked "needs a second person" on the manifest. The pipeline parks the
  request (sealed by core-crypto), answers "waiting", and lists it in Needs you for the others.
  On confirm, it runs again as the first person, with the permission checked again and both
  names in the audit row. Cost: one write to park, one to confirm.
- **Effort:** M.
- **Caveats:** a small company may have one Owner; the Owner decides whether the rule is on, and
  the checklist (R13) recommends a second Owner.

### R15. A data retention policy

- **The client gets:** one Settings section: keep form answers 24 months, email logs 90 days,
  notifications 90 days, the trash 30 days. Old data goes away on its own, and the log says
  what went.
- **From:** Sentry and Plausible keep data for a fixed window; Zammad schedules deletions for
  data privacy.
- **Fit:** a module declares its kinds of data with a default; a job on the tick deletes in
  small batches (a few hundred rows a run) and writes one audit row per batch. A hold on a record
  stops its deletion. The audit log is never deleted. Cost: deletes count as rows written, so
  batches stay small.
- **Effort:** M.
- **Caveats:** the defaults are a legal choice for each client; the kit offers them and the Owner
  confirms them.

## 2. Next 15, shorter

| # | Idea | From | Fit and cost | Effort |
|---|---|---|---|---|
| N1 | Number cards on Home from a saved view ("Open tasks: 12") | Frappe number cards, Directus Insights, Tremor KPI cards | after R1: one count query per card; no builder | S |
| N2 | Relation fields and custom fields on built-in modules | Twenty, Directus, NocoBase, Frappe custom fields | records gains "link to a customer, person or record"; other modules get a JSON column of extra fields; reads grow with each link | L |
| N3 | Several languages, starting with Spanish | react-admin and Refine i18n, Payload and Strapi localization, Formbricks | the planned i18n fields; words per module; the person's choice in a cookie | L |
| N4 | A public status page | Uptime Kuma, OpenStatus | from the health checks, opt-in, posture only, cached 60 s; Owner posts incidents | S |
| N5 | Passkeys for customers' sign-in | Better Auth passkey plugin, Ory Kratos | WebAuthn beside the emailed code at `/account`; staff passkeys come from the client's identity provider at the door | M |
| N6 | Simple e-signature on quotes | Documenso (AGPL: design only) | typed name and drawn mark, a certificate page with the document's hash, time and address; no certificate-based PDF signing | M |
| N7 | A public booking page | Cal.com | customers pick a free slot of a bookable resource; needs opening hours first | M |
| N8 | Canned replies and reply timers in the forms inbox | Chatwoot, Zammad, Frappe Helpdesk | saved replies per place; "waiting 2 days" shown and sent to the bell | S |
| N9 | Recurring documents | Frappe Auto Repeat, Invoice Ninja | repeat an invoice, task or expense on a schedule, as a job | M |
| N10 | "Who can do this?" | OpenFGA and SpiceDB reverse lookups, Cerbos policy tests | pick a permission and a place, list who holds it and why, from the compiled maps | S |
| N11 | Share one record with one person | Zanzibar ideas: Keto, OpenFGA, SpiceDB | a grant on a single record beside place-based roles; one more check per read | M |
| N12 | Automations: try with the last real event, a step log, a "wait for approval" step | n8n pinned data, Inngest and Trigger.dev run views, Windmill approvals | uses the Workflow's wait for an event; real events only | M |
| N13 | Webhook replay of a time range, and an event catalogue | Inngest replay, Standard Webhooks | retries exist; add "send again everything since 10:00" with a cap | S |
| N14 | A subscriber preference centre and double opt-in for campaigns | listmonk, Mautic | topics per list; a confirm link before the first send | S |
| N15 | A brand page: logo, icon, email header, custom domain guide | shadcn/ui themes, Cloudflare custom domains | the four brand variables exist; add the files in R2 and a guide | S |

## 3. Things NOT to adopt, and why

- **Visual app and page builders** (Appsmith, Budibase, ToolJet, NocoBase blocks, Odoo Studio).
  Oltrem sells ready-made features. A builder is large, costs CPU on every page and moves the
  support burden to the client. The records module already covers "our own list".
- **A workflow canvas with hundreds of connectors** (n8n, Activepieces). Each step is a
  subrequest and CPU, and n8n's licence forbids reselling it. Keep automations to "when, then".
- **A separate permission server** (SpiceDB, OpenFGA, Keto, Permify). It needs its own machine.
  The kit's compiled permission map is faster for a small company; borrow ideas only (N10, N11).
- **Live collaboration and WebSockets** (Twenty, Plane). They need Durable Objects, a new kind of
  resource (R-09). Live blocks that refresh every few seconds already cover a phone.
- **Offline editing with sync.** Conflicts, private data kept on a lost phone, and copies that go
  stale break "the server always decides". The offline page of R9 is enough.
- **Sample or demo data in a client's database.** It breaks R-10 and gets mixed with real rows.
  Demo a separate sandbox portal, plainly named as a demo, instead.
- **Session replay and self-hosted error platforms** (Highlight, Sentry self-hosted). They are
  heavy and record what people type. Health checks and alerts already exist.
- **PDF generation or certificate signing in the Worker.** Too much CPU for 10 ms; the print
  page already saves a PDF in the browser.
- **A feature-flag service** (Unleash, GrowthBook). The Modules page and settings already switch
  things per client.
- **Client-side data grids and big UI kits** (MUI under react-admin, full TanStack Table). They
  would bring a large script to every phone; take their ideas (column choice, row selection)
  into server pages.
- **Running a mail server** (Postal). Deliverability is a job for the email providers.
- **An AI assistant inside the portal.** Workers AI gives 10,000 neurons a day free; useful
  answers need more. Paid, later.

## 4. Project-by-project notes

Stars as read on 2026-11-01 from each GitHub page. "Design only" means AGPL, GPL or a licence that
limits reuse: read the docs, never the code.

| Project | Licence | Stars | Lessons |
|---|---|---|---|
| [react-admin](https://github.com/marmelab/react-admin) | MIT (paid modules apart) | 27.0k | undo by default; saved queries; bulk actions |
| [Refine](https://github.com/refinedev/refine) | MIT | 35.9k | `can()` per action and providers for audit and i18n, like the kit's |
| [AdminJS](https://github.com/SoftwareBrothers/adminjs) | MIT | 9.0k | record, bulk and list actions as one idea with a guard question |
| [Filament](https://github.com/filamentphp/filament) | MIT | 32.3k | import with mapping and failed rows; bulk actions; global search; notifications |
| [Django](https://github.com/django/django) | BSD-3-Clause | 92k | admin actions, list filters, a History page per object |
| [Directus](https://github.com/directus/directus) | MSCL-1.0-GPL, design only | 38.8k | presets and bookmarks (saved views); revisions; flows run from a record |
| [Payload](https://github.com/payloadcms/payload) | MIT | 45.6k | versions and drafts with restore; access rules per field |
| [Strapi](https://github.com/strapi/strapi) | MIT, enterprise folder apart | 73.4k | review stages; content history; scheduled releases |
| [NocoBase](https://github.com/nocobase/nocobase) | own licence, design only | 24.8k | board, calendar and gantt on any collection |
| [Appsmith](https://github.com/appsmithorg/appsmith) | Apache-2.0 | 41.1k | a builder; shows the support cost we avoid |
| [Budibase](https://github.com/Budibase/budibase) | GPL-3.0 overall, design only | 28.4k | buttons on a row that start an automation |
| [ToolJet](https://github.com/ToolJet/ToolJet) | AGPL-3.0, design only | 41.1k | a builder; nothing to adopt |
| [PocketBase](https://github.com/pocketbase/pocketbase) | MIT | 62k | access rules as filter expressions; a small admin with logs and backups |
| [Supabase](https://github.com/supabase/supabase) | Apache-2.0 | 114.0k | security and performance advisors; a usage page against plan limits |
| [Frappe](https://github.com/frappe/frappe) | MIT | 11k | onboarding blocks; timeline and comments; data import; auto repeat |
| [ERPNext](https://github.com/frappe/erpnext) | GPL-3.0, design only | 41k | number cards and workspaces per role |
| [Odoo](https://github.com/odoo/odoo) | LGPL-3.0, design only | 55.4k | the chatter: messages, notes, planned activities, followers |
| [Twenty](https://github.com/twentyhq/twenty) | AGPL-3.0 mostly, design only | 60.2k | views per object (table, board); record timeline; custom fields |
| [Chatwoot](https://github.com/chatwoot/chatwoot) | MIT, enterprise folder apart | 38.5k | canned replies; macros; shortcuts; web push |
| [Zammad](https://github.com/zammad/zammad) | AGPL-3.0, design only | 6.0k | reply timers (SLA); shared overviews; data privacy deletions |
| [Frappe Helpdesk](https://github.com/frappe/helpdesk) | AGPL-3.0, design only | 3.4k | canned responses and a customer portal |
| [Plane](https://github.com/makeplane/plane) | AGPL-3.0, design only | 62k | personal and shared views; an inbox; keyboard first |
| [Cal.com](https://github.com/calcom/cal.com) | MIT as listed (page now "cal.diy") | 49.6k | public booking pages; buffers; reminders |
| [Documenso](https://github.com/documenso/documenso) | AGPL-3.0, design only | 15.6k | signing order; a certificate page of the signing |
| [Formbricks](https://github.com/formbricks/formbricks) | AGPL-3.0 core, design only | 13.1k | conditional questions; partial answers; languages per survey |
| [Invoice Ninja](https://github.com/invoiceninja/invoiceninja) | source-available, design only | 10k | recurring invoices; a client portal; reminders |
| [Akaunting](https://github.com/akaunting/akaunting) | BSL 1.1, design only | 10k | invoices beside accounting; nothing beyond our quotes and invoices now |
| [listmonk](https://github.com/knadh/listmonk) | AGPL-3.0, design only | 24.0k | double opt-in; a subscriber page; bounce handling |
| [Mautic](https://github.com/mautic/mautic) | GPL-3.0, design only | 11k | preference centre; scoring is too much for us |
| [Novu](https://github.com/novuhq/novu) | open core ("Other" on GitHub) | 40.2k | inbox, preferences per kind and channel, digest, critical kinds |
| [Postal](https://github.com/postalserver/postal) | MIT | 16.9k | a mail server; we leave sending to providers |
| [useSend](https://github.com/usesend/useSend) | AGPL-3.0, design only | 4.8k | domain set-up with live DNS checks |
| [n8n](https://github.com/n8n-io/n8n) | Sustainable Use, design only | 209.3k | test with pinned real data; a log of each run step |
| [Activepieces](https://github.com/activepieces/activepieces) | MIT, enterprise folders apart | 25.3k | typed pieces; a clear run history |
| [Trigger.dev](https://github.com/triggerdotdev/trigger.dev) | Apache-2.0 | 17k | idempotency keys; a run view; retries per step |
| [Inngest](https://github.com/inngest/inngest) | not identified by GitHub; check | 6k | replay of failed runs; concurrency and debounce keys |
| [Windmill](https://github.com/windmill-labs/windmill) | not identified by GitHub; check | 18.3k | approval steps that pause a flow |
| [Better Auth](https://github.com/better-auth/better-auth) | MIT | 30.5k | passkey and API key plugins; acting as another user |
| [Lucia](https://github.com/lucia-auth/lucia) | MIT | 10.5k | store a hash of a token, never the token |
| [Ory Keto](https://github.com/ory/keto) | Apache-2.0 | 5.4k | relation tuples for sharing one object |
| [Ory Kratos](https://github.com/ory/kratos) | Apache-2.0 | 14k | passkeys, codes and recovery as flows |
| [OpenFGA](https://github.com/openfga/openfga) | Apache-2.0 | 6.0k | "list objects" and reverse lookups |
| [Casbin](https://github.com/casbin/casbin) | Apache-2.0 | 20.5k | the model and the policy kept apart |
| [Permify](https://github.com/Permify/permify) | AGPL-3.0, design only | 6k | a schema of who relates to what |
| [Cerbos](https://github.com/cerbos/cerbos) | Apache-2.0 | 4.6k | test files for permissions; a playground |
| [SpiceDB](https://github.com/authzed/spicedb) | Apache-2.0 | 7.2k | "expand": why a person has access |
| [Infisical](https://github.com/Infisical/infisical) | MIT, enterprise folders apart | 30.1k | reminders to rotate; change approvals |
| [Unkey](https://github.com/unkeyed/unkey) | FSL-1.1-ALv2, design only | 5.5k | keys with scopes, expiry, limits and usage |
| [Uptime Kuma](https://github.com/louislam/uptime-kuma) | MIT | 93k | status pages with incidents; an app to install |
| [Plausible](https://github.com/plausible/analytics) | AGPL-3.0, design only | 29.7k | visitor counts without cookies (for the Website edition) |
| [Umami](https://github.com/umami-software/umami) | MIT | 39.7k | the same, small; shareable read-only dashboards |
| [OpenStatus](https://github.com/openstatusHQ/openstatus) | AGPL-3.0, design only | 9.2k | incidents and maintenance on a status page |
| [Highlight](https://github.com/highlight/highlight) | not identified by GitHub; check | 9.4k | errors grouped by cause; too heavy to host |
| [Sentry self-hosted](https://github.com/getsentry/self-hosted) | FSL (Sentry), design only | 9.6k | a fixed retention window; grouping by fingerprint |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT | 127.1k | components owned in the repo; themes as variables |
| [Tremor](https://github.com/tremorlabs/tremor) | Apache-2.0 | 3.7k | KPI cards and small charts |
| [cmdk](https://github.com/pacocoursey/cmdk) | MIT | 13.1k | grouped results; fuzzy filter; keyboard first |
| [TanStack Table](https://github.com/TanStack/table) | MIT | 28.5k | table state (sort, columns, selection) kept in the address |
| [workers-sdk](https://github.com/cloudflare/workers-sdk) | Apache-2.0 | 4.7k | starter templates; local runs that match production |
| [Hono](https://github.com/honojs/hono) | MIT | 32.7k | small middleware; rate-limit examples on Workers |

## 5. Sources

Read on 2026-11-01. The GitHub page of each project is linked in the table above; licences were
read from each repository's licence file where GitHub shows "Other".

- [Directus: presets and bookmarks](https://docs.directus.io/app/presets-bookmarks)
- [react-admin: mutation modes and undo](https://marmelab.com/react-admin/Edit.html)
- [react-admin: features](https://marmelab.com/react-admin/Features.html)
- [Filament: import action](https://filamentphp.com/docs/4.x/actions/import)
- [Novu: Inbox](https://docs.novu.co/platform/inbox/overview)
- [Novu: workflow steps, delay and digest](https://docs.novu.co/platform/workflow/digest)
- [Frappe: workspace onboarding block](https://docs.frappe.io/framework/v14/user/en/desk/workspace/blocks#onboarding)
- [Infisical: secret rotation](https://infisical.com/docs/documentation/platform/secret-rotation/overview)
- [Infisical: secret reminders (December 2023 update)](https://infisical.com/blog/infisical-update-december-2023)
- [Unkey: products](https://www.unkey.com/docs/introduction)
- [Cloudflare: Queues on the Workers Free plan](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/)
- [Cloudflare: Queues pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Cloudflare: KV pricing](https://developers.cloudflare.com/kv/platform/pricing/)
- [Cloudflare: D1 enforces free daily limits](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/)
- [Cloudflare: Workers rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Cloudflare: Workflows limits](https://developers.cloudflare.com/workflows/reference/limits/)
- [RFC 8291: message encryption for Web Push](https://www.rfc-editor.org/rfc/rfc8291)
- [RFC 8292: VAPID for Web Push](https://www.rfc-editor.org/rfc/rfc8292)
- [MDN: Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [MDN: web app manifest](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest)
- [Standard Webhooks](https://www.standardwebhooks.com/)
- [shields.io star counts](https://shields.io/) (used where a GitHub page did not show stars)
