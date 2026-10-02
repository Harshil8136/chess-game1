---

title: "Email service research: Node.js on the VPS, what the email system still needs, and API Access v2"
status: draft
audience: [owner, technical, ai, operator, non-technical]
last_verified: 2026-10-01
verified_against: [code, infra, docs]
owner: harshil
related_code: [src/lib/email-console.ts, src/lib/email-api-route.ts, src/lib/email-section.ts, src/components/admin/emails/api-access/ApiAccessView.tsx, src/components/admin/emails/api-access/ApiQuickStart.tsx, src/pages/api/emails/api-tokens.ts, src/lib/email/sender-identities.ts, src/lib/auth/security-logging.ts, cf-email-consumer/src/dispatch.ts, cf-email-consumer/src/handlers.ts, cf-email-consumer/src/lib/providers.ts, cf-email-consumer/api/src/store.ts, cf-email-consumer/test/helpers.ts]
related_docs: [../features/EMAIL-API-ACCESS.md, ../features/EMAIL-PORTAL.md, ../features/VPS-CONSOLE.md, ../features/BACKUP-CONSOLE.md, ../operations/incidents/2026-09-26-cron-exceeded-cpu.md, ../runbooks/brevo-webhook.md, ../reference/schema-change-ledger.md, ../MAINTENANCE.md]
tags: [email, research, vps, nodejs, api-access, brevo, cloudflare, deliverability]
---

# Email service research: Node.js on the VPS, what the email system still needs, and API Access v2

> **TL;DR (non-technical):** The owner asked three questions on 2026-10-01.
> **(1)** Could the hotel's email service run as a Node.js program on our own
> server (the VPS)? That means both the API at `email.madagascarhotelags.com`
> and the worker that sends every email. It could, but it should not be the
> main home for email today. One free server with no second copy is a bigger
> risk to booking confirmations than the Cloudflare limits it would remove. A
> move would also mean rebuilding five Cloudflare features by hand. The VPS is
> a good helper for side jobs that may fail without delaying an email.
> **(2)** Before any outside company gets an API token, the email system needs:
>
> - delivery tracking
> - abuse protection
> - an HTML cleaner
> - protection against double sends
> - a sweeper for stuck messages
> - a backup of its database
>
> There are 27 items in all, ranked. **(3)** API Access is a sound first version
> (tokens, limits, activity, settings). It still lacks the views and controls
> that mature email services have:
>
> - usage history
> - a timeline for each message
> - search and export
> - a request log
> - alerts
> - IP and recipient restrictions
> - test tokens
> - webhooks
> - public docs
>
> **(4)** Added later the same day: permissions, and a home of its own for the
> Email API. Today's three permission keys are too coarse. A list of small
> capabilities, like the ones Backups and Server already use, should replace
> them. The Email API should get its own page in the sidebar, and its screens
> should move into the email repository as a private console shown inside the
> admin portal, the way Backups and Server work. It should not move to the
> public `email.madagascarhotelags.com` address.
>
> **Decided on 2026-10-02 (§7.7):** no third Worker, ever, and the VPS idea is
> parked. The Email API now has its own page in the admin portal, with five
> permissions instead of three; the email service enforces the finer rules.
>
> Every item says why it matters, where it lives and roughly how long it takes.
> Apart from §7.7, nothing here is built yet. The owner's decisions are listed in §9.

## 1. Scope, method and status

**The questions (owner, 2026-10-01).**

1. What would it take to run the email service, from cf-email-consumer, on Node.js on our VPS? What are the factors, the likely problems, the pros and cons, and is it good for the long run?
2. What else is necessary, or good to have, in the email system?
3. The Email Portal's API Access system in cf-admin feels very basic. What does it need?
4. (Added the same day.) Can the email API system have more accurate permissions?
5. (Added the same day.) Should the Email API be a separate page in the sidebar, with its code moved into cf-email-consumer, the way cf-backup works?

**Status.** A dated research record with status `draft`: a proposal, nothing built. It changes no earlier decision. Where it recommends one, §9 lists it as an owner decision.

**How it was checked.**

- **Code read** at these commits: cf-email-consumer `b42116d`, cf-admin `cdcab8e`, cf-vps `b398209`, cf-astro `b0e6485`, cf-backup `f46de0b`.
- **Read-only live checks** on 2026-10-01, through the Cloudflare, Supabase and Sentry connectors:
  - the Workers list;
  - row counts in `madagascar-email-db`;
  - the applied migrations and `admin_pages` rows in `madagascar-db`;
  - Supabase ledger counts;
  - Sentry issues for the last 30 days.
- **Official documentation**, fetched on 2026-10-01, from Cloudflare, Oracle Cloud, Node.js, Brevo, Resend, Google, Yahoo, Microsoft, Postmark, SendGrid, Mailgun, Amazon SES and the IETF. Links are in §10.

Docs found to disagree with the code or the live state are listed in §8; they are not fixed here.

## 2. The answers in one page

### Q1. Should `email.madagascarhotelags.com` and the consumer run on Node.js on the VPS?

**Not now. Keep the email path on Cloudflare Workers, and use the VPS as a sidecar.**

**It is feasible.**

- The API handlers already take a Web `Request` and return a `Response`.
- The email database's SQL already runs on Node's built-in SQLite in the test suite.
- The VPS app platform can host a Node container on that hostname.

**It is the wrong home for the path that must never stop:**

- **One host.** It is a single Always Free server with no second copy and no SLA. In 2026 Oracle halved the free allowance by editing its documentation.
- **Missing basics.** The VPS has no off-box backups for app data and no alert when an app fails.
- **Secrets on disk.** The provider keys and the Supabase service-role key would sit on that host's disk.
- **Cloudflare-only features.** Cloudflare Queues push only to Workers, and the shared D1 database is reachable natively only from Workers.
- **Two owner rulings.** It would reverse "Workers-only", and a full move would also break the frozen producer contract (both from the 2026-09-30 platform design).

**The limits that motivate a move are smaller than they look:**

- **Volume.** The ledger records about 2.5 emails on a day that has mail.
- **The binding ceiling.** It is Brevo's 300 emails a day, and no hosting change lifts it.
- **The one real technical risk** is the Workers Free 10 ms CPU limit on the consumer's cold starts.

**Best path under the owner's standing rule of free plans only** (cf-admin [2026-09-26 cron incident](../operations/incidents/2026-09-26-cron-exceeded-cpu.md), §5.1):

1. stay on Workers Free;
2. do the fixes in §5;
3. keep the core portable, so that a move would take about a week if it is ever needed;
4. use the VPS for side jobs.

If the owner ever reconsiders paid plans, Workers Paid ($5 a month) scores highest. It removes the CPU and request ceilings without any migration. §4.7 lists the triggers that would change this answer.

### Q2. What else does the email system need?

The ten most important items; all 27 are in §5.

1. Delivery status, with bounces and complaints feeding the suppression list (phase P2).
2. Request-level abuse protection: a per-token limiter, automatic blocks and an IP allow-list (P4).
3. An HTML cleaner for API mail (P4).
4. **No double sends after a timeout.** Brevo accepts an `idempotencyKey` that lasts 30 minutes; Resend accepts a standard `Idempotency-Key` that lasts 24 hours. (new)
5. A sweeper that re-drives messages stuck in `queued`. On the Free plan the queue keeps a message for only 24 hours. (new)
6. Back up `madagascar-email-db`. Today nothing covers it beyond D1's own 7-day Time Travel. (owner step)
7. **One road for all hotel mail.** Six cf-admin modules send straight to Brevo or Resend. That includes an alert on every admin sign-in. This mail bypasses the queue: no retry, no failover, no place in the budget, and (except invite re-sends) no ledger row. (new)
8. Forward the one-click unsubscribe headers the portal already creates. The consumer drops them today (cf-admin MAINTENANCE.md C-4, follow-up 2).
9. Prove the Resend failover from the hotel's domain, with SPF, DKIM and DMARC aligned at both providers.
10. Check Brevo's terms before reselling the API. They say use is "strictly personal".

### Q3. What should API Access add?

API Access already has these:

- an address for each section;
- token search and status filters;
- a side panel for each token;
- rotate and renew;
- a quick start;
- an activity log with paging;
- settings with a daily-capacity card;
- three server-checked permissions.

It is missing these, in this order:

1. A timeline for each message. The API already returns `delivery`, `delivery_at` and `suppressed`, but the screen never shows them.
2. A rendered preview of each message.
3. Full-text search, date ranges, and filters kept in the address.
4. CSV export.
5. Usage history and charts for each token. No per-day data is stored today.
6. A request log that also shows refused calls.
7. Alerts: budget, limits, failed sign-ins, bounces, expiring tokens.
8. Restrictions on a token: IP addresses, recipient domains, recipients per message, required idempotency.
9. Test tokens, and a "send a test" button.
10. Rotation with an overlap window, so clients do not break during a rotation.
11. Public API docs. Today the quick start links to a file in a private GitHub repository, which a client cannot open.
12. Webhooks to client apps, and templates for API mail.

Details are in §6.

### Q4. More accurate permissions?

**Yes.** Three keys (`#api-view`, `#api-manage`, `#api-config`) are too coarse:

- reading guests' email is bundled with looking at tokens;
- blocking a token needs the same right as creating one;
- the API's off switch shares a key with raising the budget;
- nothing asks for a recent sign-in before a credential is minted.

§7.2 proposes about 25 small capabilities, like the ones Backups and Server use, each with a floor, a default per role, and per-person allow or deny with an expiry. One rule is added: reducing exposure (block, narrow, pause) is cheap; widening it (create, unblock, raise limits, resume) needs a higher role and a sign-in from the last 10 minutes.

### Q5. A separate page, with the code in cf-email-consumer?

**A separate sidebar page: yes. Moving the code into cf-email-consumer: yes, if the email API is going to grow.**

- The move would follow the Backups and Server pattern: a private console Worker with no public address, shown inside the admin portal.
- It is about 6 to 8 days of work. A separate page alone, with the code left in cf-admin, is about 1 to 1.5 days.
- Now is the cheapest moment: one token, no outside users, no per-person grants.
- The console should be a third, private Worker. It should not be served on `email.madagascarhotelags.com`, which must stay the public API only.
- Details are in §7.4 to §7.6.

## 3. Where things stand (verified 2026-10-01)

### 3.1 The service in numbers

| Fact | Value | How it was checked |
|---|---|---|
| Hotel mail in the Supabase ledger | 106 messages since 2026-04-25; 43 days had mail; busiest day 10; 2.5 a day on days with mail; 49 in the last 30 days and 36 in the last 7 | read-only `SELECT` on `email_audit_logs` |
| Email API state (`madagascar-email-db`) | 1 active token; 0 stored API messages (the smoke test removes its rows); 1 `sends` row since the D1 lease went live; about 57 KB in all | read-only `SELECT` |
| Workers sharing the account's Free-plan request pool | 12 | Cloudflare connector |
| Measured daily requests | cf-astro about 2,600, cf-admin about 550, against 100,000 | cf-admin program and spec records |
| Email errors in Sentry, last 30 days | none for the consumer or the API | Sentry connector |
| Consumer CPU | 12 to 13 ms on a cold start and 6 to 7 ms warm, against the Free plan's 10 ms | cf-email-consumer `docs/operations/OPERATIONS.md` |
| API Worker CPU | median 1.6 ms, none over 10 ms | same source |

The service is tiny. Every capacity question below is about **ceilings and failure modes**, not about load.

### 3.2 The limits that actually bind

| Limit | Value | Who hits it first |
|---|---|---|
| Brevo Free | 300 emails a day, counted per recipient | **the real ceiling**, for all hotel mail plus API mail. The API's shared budget (150 recipients a day by default) exists because of it |
| Resend Free (failover) | 100 a day and 3,000 a month | kept for hotel mail; API mail never fails over |
| Workers Free requests | 100,000 a day for the whole account, reset at 00:00 UTC; past that every Worker answers error 1027 | a flood on the API hostname would also take down the website and the admin portal |
| Workers Free CPU | 10 ms per invocation. An isolate has "some built-in flexibility" for occasional overruns; a consistent overrun is terminated (error 1102) | the consumer, on cold starts |
| Queues Free (on the Free plan since 2026-02-04) | 10,000 operations a day for the account; a normal message costs 3; retention fixed at 24 hours | shared with cf-admin's revalidation queue |
| D1 Free | 5 million rows read and 100,000 written a day for the account, **enforced since 2026-09-01** (over it, queries fail until 00:00 UTC); 500 MB per database | about 2 to 4 writes per email |

### 3.3 The decision this research reopens

The 2026-09-30 platform design (cf-email-consumer `docs/specs/2026-09-30-email-platform-design.md`) recorded this as owner decision 4 of its decision update. Its own §2, decision 1, reads "Workers-only. No VPS, no Containers, no Workers Paid." Decision 4 says:

> "No VPS or nginx for the email path. ... Queues push only to Workers (the alternative, an HTTP pull consumer, polls with an API token and adds a failure mode), and one Oracle Always-Free host with no failover, patched by hand, is a worse home for an email service than Workers. The REST contract (OpenAPI 3.1) stays host-agnostic, so a VPS instance remains an option if the shared Free caps ever bind."

That ruling is tested again here, because four things have changed since:

- the VPS app platform is now built;
- Queues, including pull consumers, are on the Free plan;
- D1's free limits are now enforced;
- Workers VPC (a binding from a Worker to a service behind the Tunnel) exists, and cf-vps already uses it.

## 4. Part 1: running the email service on Node.js on the VPS

### 4.1 What the VPS offers an app today

The VPS is an Oracle Cloud Ampere A1 machine (2 OCPU, 12 GB RAM, 150 GB disk, Ubuntu 26.04 arm64) on a Pay As You Go account, managed as code in cf-vps. Its app platform (phase P3, live) would be the natural home for a Node service.

| Platform feature | What it does | Gap for an email service |
|---|---|---|
| App manifest | name, runtime (`node` among others), pinned image, port, `hostname` (one label under `madagascarhotelags.com`, so `email.` qualifies), `access` (behind Cloudflare Access by default, or `public`), memory, CPU weight, volumes, health path, an optional Postgres database | no schedule field; one port and one hostname per app |
| Node template | two-stage build on `node:24-slim`, non-root user, read-only root filesystem | none |
| Containers | Podman with Quadlet, rootful, but each container gets its own user namespace; all capabilities dropped; `NoNewPrivileges`; published on loopback only; instance metadata blocked | **outbound traffic is not restricted**: a compromised container can reach any host |
| Deploy (`vps app apply`, or the console's `app.deploy` action with a Worker-signed ticket) | writes the unit and the nginx site, reloads, then probes the health path 30 times | **a failed health check only prints a warning**, and there is no app rollback command |
| Ingress | Cloudflare Tunnel, then nginx on loopback: real client IP from `CF-Connecting-IP`, 20 requests a second per IP, bodies up to 25 MB | the Tunnel route for a new hostname is added by hand in Cloudflare |
| Postgres 18 | one role and one database per app, over the local socket; a nightly `pg_dump` | **dumps stay on the server for 7 days**; nothing leaves the box |
| App data volumes | mounted into the container | **not backed up at all**, and there are no boot-volume backups (cf-vps owner ruling R1) |
| Secrets | platform services use encrypted systemd credentials | **apps get a root-only plain `.env` file**, passed in as environment variables |
| Logs and alerts | the journal (90 days), a raw local record (30 days), Sentry for security alerts | **app and nginx logs never leave the server**, and nothing alerts when an app crashes or fails its health check |
| Probes (every 5 minutes) | check the public site, the admin redirect and TLS | no app is probed today, though one line in the probe file would add one |
| Workers VPC | the cf-vps Worker already reaches the agent through a `vpc_services` binding | none: the pattern is proven in this account |

Sources: `cf-vps/documentation/specs/2026-09-29-cf-vps-design.md`, `cf-vps/documentation/records/2026-09-29-owner-rulings.md`, `cf-vps/agent/src/cli/manifest.ts`, `cf-vps/agent/src/cli/render.ts`, `cf-vps/agent/src/cli/commands.ts`, `cf-vps/host/50-podman/files/opt/vps/bin/vps-app-fw`, `cf-vps/host/57-postgres`, `cf-vps/host/72-probes`, `cf-vps/templates/node/Dockerfile`.

No cf-vps document proposes hosting email there. The VPS's own alert emails, a P5 idea, were planned to go *through* cf-admin's `EMAIL_QUEUE`, not the other way round.

### 4.2 What "moving it" means, piece by piece

The email service is not one program. It is two Workers and five Cloudflare features stitched together, and each needs its own answer on a VPS.

| Piece | Today, on Cloudflare | On the VPS, with Node.js | Effort | The catch |
|---|---|---|---|---|
| Public REST API (`/v1/*`) | Worker `cf-email-api` on the custom domain | a Node HTTP server in a container, published on the same hostname through the Tunnel | low | the handlers already take a Web `Request` and return a `Response` (`cf-email-consumer/api/src/public.ts`, `handlePublic`); Node needs only a small adapter |
| Console door for cf-admin | the `Console` entrypoint, reached only through the `EMAIL_CONSOLE` service binding, so the `x-email-actor` header can be trusted | a Worker gateway that signs what it forwards over Workers VPC (§4.8) | medium | a service binding has no network path to attack. Anything on the VPS must check signatures instead of trusting a header |
| Queue `madagascar-emails` and its producers | Cloudflare Queues; cf-astro (4 places) and cf-admin (7 places) call `queue.send`; the consumer gets one message per invocation | keep the queue and pull it over HTTP, or replace it with a job table on the VPS | **high** | Queues push only to Workers. Pulling uses short polling only, and a queue has one consumer type at a time (§4.4) |
| Consumer (render, lease, send, retry, dead letters) | Worker `cf-astro-email-consumer` | a long-running Node worker process | medium | the logic is plain TypeScript over `fetch`; the retry ladder and the dead-letter queue are Queues features that would have to be rebuilt |
| Email state (`madagascar-email-db`) | D1 | SQLite on the VPS, or the VPS Postgres | **low on SQLite**, medium on Postgres | the tests already run the real migrations and SQL on `node:sqlite` through a 60-line D1 stand-in (`cf-email-consumer/test/helpers.ts`, `SqliteD1`). On Postgres every statement changes, and one invariant breaks (§4.4, problem 4) |
| Shared `madagascar-db` (sender and suppression lists, read before each API send; dead-letter write to `booking_attempts`) | D1 binding `DB` | the D1 REST API, or a proxy Worker | medium to high | Cloudflare calls the D1 REST API "best suited for administrative use". It shares the account's API limit of 1,200 requests per 5 minutes, and going over blocks every API call for 5 minutes |
| Attachments (R2 bucket `madagascar-images`) | R2 binding | R2's S3-compatible API with an access key | low | one more credential on the VPS |
| Supabase ledger and booking flags | REST, with the service-role key | the same REST calls | none | the service-role key (full access to the hotel's Supabase project) would live on the VPS |
| Logs and error reports | Workers Logs (3 days, 100% sampling) and one Sentry envelope per error | journald, the Sentry Node SDK, a probe | low to medium | app logs do not leave the VPS today, so searchable logs and alerts must be added |
| Deploy and rollback | Workers Builds on push to `main`; `wrangler rollback` in seconds | `vps app apply` | medium | there is no app rollback command, and a release now has to coordinate an image, a database file and a Tunnel route |

### 4.3 Four ways to put it on the VPS

**V1. Everything on the VPS.** The API, the consumer and the database all move to the VPS. A job table replaces the Cloudflare queue, and cf-astro and cf-admin send email over HTTPS instead of calling `queue.send`.

```text
cf-astro / cf-admin --HTTPS (signed)--> Tunnel --> nginx --> email-api (Node) --> SQLite jobs
client apps ---------HTTPS (token)----> Tunnel --> nginx --> email-api (Node)         |
                                                                                     email-worker (Node) --> Brevo / Resend
```

- **Gain:** it frees the email service from every Workers limit.
- **Breaks the producer contract:** owner default B of the 2026-09-30 design freezes the hotel pipeline: the same queue and the same message shapes.
- **Bookings cannot hand over email while the VPS is down.**
  - cf-astro would need its own fallback store.
  - Its booking path already depends on the queue: `booking_attempts`, plus cf-admin's `booking-email-retry` job, which re-sends from D1 (`src/workers/scheduled-booking-retry.ts`).

**V2. The API on the VPS; the consumer stays a Worker.** The VPS accepts API mail and puts a pointer on the Cloudflare queue through the Queues REST API.

- **Gain:** API traffic stops spending the account's Worker requests.
- **Cost:** the consumer would then have to read `api_messages` from the VPS. That is two failure domains for one email.

**V3. The consumer on the VPS, pulling the Cloudflare queue.** Producers keep calling `queue.send` and the VPS polls the queue.

- **Gain:** it removes the 10 ms CPU limit from sending, and nothing else.
- **Cost:** a queue has one consumer type at a time, so the cut-over is all or nothing.

**V4. A sidecar: the Workers stay the email path, the VPS does side jobs.** The VPS runs only work that may fail without delaying a single email. Examples:

- an outside health check of `email.madagascarhotelags.com`;
- a mail sink for tests;
- a DMARC report reader;
- long-term archives.

This is the only shape in which the VPS adds capability without adding a way for booking mail to stop.

### 4.4 Problems we would actually hit

| # | Problem | Applies to | Likelihood | Impact | What it takes |
|---|---|---|---|---|---|
| 1 | **Polling a queue from outside.** HTTP pull is short-polling only: an empty queue answers at once and there is no long poll. No lease extension is documented. Billing is per message; whether an empty pull is also counted is not documented. If it is, a 10-second poll costs 8,640 operations a day against the account's 10,000 | V3 | certain | medium | a poll with back-off (which adds up to one poll interval to every email), and a test that measures the real operation count |
| 2 | **One queue, one consumer type.** A queue cannot have a Worker consumer and a pull consumer at the same time. So there is no gradual cut-over and no automatic fall-back to the Worker | V3 | certain | medium | a hard switch with `wrangler queues consumer` commands, rehearsed in advance |
| 3 | **The shared database is Workers-native.** The send-time sender check, the suppression list and the dead-letter write all use the `DB` binding. From the VPS they go through the D1 REST API or a proxy Worker, which brings a Worker back into the send path | V1 to V3 | certain | high | a proxy Worker, or copies of the two lists on the VPS that may lag |
| 4 | **The shared budget relies on writes happening one at a time.** `reserveQuota` (`cf-email-consumer/api/src/store.ts`) checks the budget with a `SUM` over all tokens inside a single token's `UPDATE`. D1 and SQLite run writes one at a time, so the budget cannot overshoot. On Postgres at its default isolation level, two tokens updating different rows can both pass the check | V1, V2 on Postgres | likely under load | low today | stay on SQLite, or lock one budget row |
| 5 | **A timeout can send an email twice.** If Brevo accepts a message but the reply is lost, the retry sends it again. This is already true today for API mail, which has no ledger row to consult (`cf-email-consumer/src/handlers.ts`, `apiEmail`) | all, including today | rare | medium | Brevo's `idempotencyKey`, §5.1 item 4 |
| 6 | **One host, no failover.** Kernel and OS upgrades, a full disk, a stuck Tunnel, or losing the host: each one stops email until it is fixed. A second `cloudflared` on the same machine protects nothing | V1 to V3 | certain over a year | high | accept recovery in hours, or pay for a second host |
| 7 | **The free host is not guaranteed.** See the list below the table | V1 to V3 | low to medium | high | keep email off the box, or budget for a paid instance |
| 8 | **Secrets move onto a disk we look after.** The Brevo key (it sends as the hotel) and the Supabase service-role key (full database access) would sit in a plain root-only `.env` file, on the host that also runs the console agent and Postgres. The cf-vps owner rulings already declined a broad Cloudflare key on the VPS for this reason (R5): "a server compromise would reach customer data and backups" | V1 to V3 | n/a | high if breached | encrypted systemd credentials, a narrower Supabase key, an egress allow-list |
| 9 | **No backups and no alarms for apps yet.** App data and Postgres dumps never leave the server, and there are no boot-volume backups. Nothing alerts when an app fails, and app logs stay on the box | V1 to V3 | certain until built | high | Litestream or dumps to R2, a probe line, app-level Sentry |
| 10 | **Deploys are unsafe by default.** `vps app apply` prints a warning but still succeeds when the health check fails, and there is no app rollback | V1 to V3 | likely | medium | make a failed health check fail the deploy; keep the previous image tag for a manual rollback |
| 11 | **The zero-dependency rule lapses.** On Workers, the 150 KiB bundle guard (`cf-email-consumer/scripts/check-bundle.mjs`) forces zero runtime dependencies. On Node nothing enforces it, so dependencies creep in, along with their supply-chain risk | V1 to V3 | likely | medium | keep the guard as a CI rule even on Node |
| 12 | **Operations work that Cloudflare does today.** Node security releases (Node 24 enters maintenance on 2026-10-20), base images, disk space, logs, backups and restore drills. All of it on a 2-core machine shared with Postgres and builds | V1 to V3 | certain | medium | about 2 to 4 hours a month of owner time |
| 13 | **The temptation to send mail directly.** See the list below the table | any SMTP plan | n/a | high | never send directly from the VPS; keep an email provider |
| 14 | **Workers VPC is in beta.** It is the clean way for a Worker to reach the VPS without a public route, and cf-vps already depends on it in production. But "features and APIs may change before general availability", and its price after GA is not published | V1, V2 | n/a | low to medium | the Tunnel plus an Access service token as the fallback |

Why the free host is not guaranteed (problem 7):

- **No SLA.** Oracle's Free Tier comes with no service-level agreement.
- **Idle reclamation.** Oracle can reclaim an idle Always Free instance: one whose 7-day 95th percentile of CPU, network and memory are all under 20%. Oracle does not say whether a Pay As You Go account is exempt.
- **Silent cuts.** In 2026 Oracle halved the Always Free A1 allowance to 2 OCPU and 12 GB, and changed only its documentation.
- **Rebuilds can fail.** Re-creating an A1 instance can fail with "Out of host capacity" (`cf-vps/documentation/runbooks/rebuild.md`).

Why sending mail straight from the VPS is a bad idea (problem 13):

- **Port 25 is blocked.** Oracle blocks outbound port 25 by default for accounts created after 2021-06-23.
- **Poor reputation.** Cloud address ranges have a poor sending reputation.
- **Rejections.** Gmail, Yahoo and Microsoft now reject unauthenticated or misaligned mail.

### 4.5 Pros and cons, side by side

| | Stay on Workers (Free or Paid) | Move to Node on the VPS |
|---|---|---|
| **Failure domain** | Cloudflare's global network; no host to lose | one Always Free host in one region; no second copy |
| **Booking mail when something breaks** | the queue holds messages while the consumer is fixed: 24 hours on Free, up to 14 days on Paid | depends on the design. With V1, producers cannot hand mail over at all while the host is down |
| **CPU** | 10 ms per invocation on Free, already exceeded on cold starts; 30 s by default and up to 5 minutes on Paid | no per-request limit |
| **Requests** | Free: 100,000 a day for the whole account, then a hard stop (error 1027). Paid: 10 million a month included, then billed, with no hard stop | API traffic through the Tunnel spends no Worker requests |
| **Libraries** | zero runtime dependencies by design (the 150 KiB bundle guard) | anything in npm, along with its supply-chain risk |
| **Data** | D1, with the Free limits now enforced; Time Travel keeps 7 days on Free | SQLite or Postgres on a local disk; the backups are ours to build and test |
| **Integrations** | queue push, service bindings to cf-admin, the shared D1, R2, version rollback, Workers Builds | each rebuilt over HTTPS with a credential, or through a beta binding |
| **Secrets** | in Cloudflare's secret store, never on a disk we manage | on the VPS disk, next to an internet-facing service |
| **Provider-key lock-down** | Workers' outgoing addresses are shared, so Brevo's "Authorized IPs" feature cannot pin the key | a fixed outgoing address, so Brevo can pin the key to the VPS. A leaked key is then useless anywhere else |
| **Operations** | none beyond deploys | patching, images, disk, logs, backups, restore drills, the Tunnel |
| **Money** | $0, or $5 a month on Paid | $0 for the host while Always Free lasts |
| **Lock-in** | Queues, D1 and bindings are Cloudflare-only APIs | portable Node, SQL and HTTP |
| **Fit with the owner's rules** | matches the 2026-09-30 rulings: Workers-only, zero runtime dependencies, the secrets cap | reverses decision 1, and owner default B (the frozen producer contract) for V1 |

### 4.6 Is it good for the long run? A scored comparison

The weights reflect what matters for a hotel whose booking confirmations must arrive. Scores run from 1 (poor) to 5 (best); §4.4 and §4.5 give the reasons.

| Criterion | Weight | A. Workers Free, with the §5 fixes | B. Workers Paid ($5 a month) | C. Workers path plus VPS sidecar (on Paid) | D. Everything on the VPS (V1) |
|---|---|---|---|---|---|
| Booking-mail reliability | 25% | 4 | 5 | 5 | 2 |
| Security and custody of secrets | 15% | 5 | 5 | 4 | 3 |
| Owner's operating time | 15% | 5 | 5 | 4 | 2 |
| Headroom against limits | 10% | 2 | 5 | 5 | 4 |
| Freedom to build features | 10% | 2 | 3 | 4 | 5 |
| Money | 10% | 5 | 4 | 4 | 5 |
| Effort and risk of getting there | 10% | 5 | 5 | 4 | 1 |
| Portability | 5% | 2 | 2 | 3 | 5 |
| **Weighted score** | | **4.00** | **4.55** | **4.30** | **3.00** |

On the Free plan, column C scores 3.85, close to A.

**How to read it.** A full move scores lowest. It trades a small, known limit (CPU and a shared request pool) for a large, open-ended one: a single host the owner must keep alive, on the one path that must not stop. Paying $5 a month would remove the ceilings that motivate the move, with no migration at all. The VPS earns its place as a helper for work that may fail without delaying an email.

### 4.7 Recommendation, and what would change it

1. **Keep email on Workers.** Do not move `email.madagascarhotelags.com` or the consumer to the VPS now.
2. **Stay within the Free plan, as the owner has ruled, and close the gaps in §5.**
   - The consumer's cold-start CPU is the one real risk. Keep trimming its start-up work towards 10 ms, for example by loading each purpose's templates only when that purpose runs.
   - If CPU errors ever appear, Workers Paid is the fastest fix. That is the owner's call.
3. **Keep the core portable, so a move stays cheap.**
   - The API and consumer logic are already pure functions over Web-standard `Request`, `Response` and `fetch`, and the SQL already runs on SQLite in the tests.
   - Keep it that way, with the Cloudflare-specific parts (the queue and the bindings) in thin adapters.
   - That keeps open the option of a VPS move later, at about a week of work, without paying for it now. It is also the free-plan insurance: if Cloudflare ever enforces the CPU limit strictly, a VPS pull consumer (V3) can take over within a day or two instead of after a full port.
4. **Use the VPS for side jobs (V4):**
   - the outside health check and a daily canary (§5.2, item 16);
   - a staging mail sink (item 25);
   - later, a DMARC report reader (item 24) or a long-term archive.

Revisit a full move if any of these becomes true:

- the consumer starts failing on CPU, and the owner keeps ruling out paid plans;
- the service needs something Workers cannot do, such as a long-lived SMTP listener, a stateful socket, or a library that will not run on Workers;
- the business sells the API to enough clients to justify a dedicated, paid, redundant host: two machines, not one Always Free box;
- Cloudflare's free limits or prices change against this workload.

### 4.8 If the owner decides to move anyway: the safe shape

This is the design to use if a trigger in §4.7 fires, or if the owner overrules the recommendation. It keeps every property the Workers version has today.

**Keep a Worker as the gateway, the way cf-vps does.** cf-admin reaches the VPS console through the `VPS` service binding to the cf-vps Worker, and that Worker signs what it forwards ([VPS Console](../features/VPS-CONSOLE.md)). Do the same for email:

- `EMAIL_CONSOLE` keeps pointing at the `cf-email-api` Worker.
- That Worker checks the actor and signs each request it forwards to the VPS, with Ed25519 as cf-vps already does, over Workers VPC.
- cf-admin and cf-astro change nothing.
- The public hostname keeps Cloudflare's WAF, TLS and DDoS protection in front of it.

**Runtime choices.**

| Choice | Pick | Why |
|---|---|---|
| Node line | Node 24 now (supported until 2028-04-30); Node 26 once it becomes LTS on 2026-10-28 (supported until 2029-04-30) | both ship linux-arm64 builds; Node 24 moves to maintenance on 2026-10-20 |
| HTTP layer | the existing Web-standard handlers behind a small `node:http` adapter, or Hono's Node adapter | no rewrite; the same code keeps running on Workers |
| TypeScript | a build step for the service; Node's type stripping (stable since 24.12) only for scripts | type stripping does not handle enums or parameter properties |
| Database | SQLite in WAL mode with better-sqlite3 (the proven driver; `node:sqlite` is still a release candidate in Node 24 and 26), replicated continuously to R2 with Litestream | the D1 SQL and its one-writer-at-a-time behaviour carry over unchanged. Postgres would need every statement rewritten, plus a lock for the shared budget |
| Queue | a `jobs` table with a lease column, reusing the lease logic already in `sends`; one worker process polls the local table, which is cheap and needs no network | SQLite's single writer is enough at hotel volume. If volume ever needs several workers, pg-boss (on Postgres, with dead letters built in) is the upgrade |
| Process | a container on the VPS app platform, in the `vps-apps` slice with its own memory limit | matches how the VPS runs apps; no new host mechanism |
| Network | inbound only through the Tunnel; outbound limited by a new allow-list to the email providers, Supabase, Sentry and R2 | today container egress is open |
| Secrets | encrypted systemd credentials, not the plain `.env` file apps get today; a narrower Supabase key than service-role, if the ledger allows it | never in an image, a repository or an environment file |
| Logs and alerts | JSON lines to the journal; the Sentry Node SDK; a probe on `/v1/health`; app logs shipped off the box | today app logs stay on the server and nothing alerts on app failure |
| Brevo key lock-down | turn on Brevo's Authorized IPs for the VPS's fixed outgoing address | the one security gain a VPS has over Workers |

**Migration in reversible steps.**

1. **Portable core** (2 to 3 days). Put the queue, the database and the blob store behind small interfaces, and run the existing 252 tests against both the D1 and the Node adapters. Nothing changes in production.
2. **Shadow** (1 to 2 days). Run the Node service on the VPS with its own SQLite, a sandbox token and a separate hostname, and run the production smoke test (`cf-email-consumer/scripts/smoke-api.mjs`) against it.
3. **Move the public API** (1 day, then a week of watching).
   - Point `email.madagascarhotelags.com` at the Tunnel.
   - The VPS accepts messages and puts a pointer on the Cloudflare queue through the Queues REST API, so the consumer does not change yet.
   - Rollback: point the hostname back at the Worker.
4. **Move sending** (2 to 3 days, then two weeks of watching).
   - Switch the queue's consumer to HTTP pull from the VPS.
   - Rollback: re-attach the Worker consumer. Rehearse this first, because a queue has one consumer type at a time.
5. **Retire** the Worker consumer only after a quiet month.

In total: about 7 to 10 working days, then about 2 to 4 hours a month of upkeep.

## 5. Part 2: what the email system still needs

Items already in the email roadmap (cf-email-consumer `docs/program/ROADMAP.md`, phases P2 to P5) carry their phase. The rest are new findings from this review. Effort is in focused working days.

### 5.1 Must-have before anyone outside the hotel holds a token

| # | Item | Why | Where | Effort | Roadmap |
|---|---|---|---|---|---|
| 1 | **Delivery status and bounce suppression.** Forward Brevo's events to the API over a service binding; fill `delivery` and `delivery_at`; add hard bounces, invalid addresses and spam complaints to the suppression list | `sent` means only that Brevo accepted the message. A client cannot tell a bounce from a delivery, and bad addresses keep being mailed | the cf-astro webhook and the email API | 1.5 to 2 | P2 |
| 2 | **Request protection.** A per-token request limiter (the Workers Rate Limiting binding), an automatic block for a token that stays limited, and an optional IP allow-list per token | token limits count emails, not requests. A client stuck in a loop still spends the account's shared Worker requests | email API | 1 to 1.5 | P4 |
| 3 | **Clean the HTML of API mail.** Strip scripts, event handlers, forms and `javascript:` links before sending | a leaked token could send active content from the hotel's own domain. cf-admin already has a sanitizer to port (`src/lib/email/sanitize-html.ts`) | consumer or API | 0.5 | P4 |
| 4 | **No double sends after a timeout.** See the list below the table | API mail has no ledger row to ask, so today a lost reply means a second email (§4.4, problem 5) | consumer (`cf-email-consumer/src/lib/providers.ts`, `cf-email-consumer/src/dispatch.ts`) | 0.5 | new |
| 5 | **Sweep stuck messages.** A scheduled job finds `api_messages` still `queued` after about 15 minutes and puts them back on the queue; the same for `sends` rows left `claimed` past their lease | the Free plan keeps a queue message for 24 hours. If the consumer is broken for longer (a bad deploy, CPU-limit enforcement), the message leaves the queue and its row says `queued` for ever. Today a tile shows "Stuck in queue" but nothing re-drives it | a consumer cron trigger, or cf-admin's tick | 0.5 to 1 | new |
| 6 | **Back up `madagascar-email-db`.** Add it to cf-backup, then do one restore drill | token hashes, accepted messages and the audit trail exist only there. D1 Time Travel alone covers 7 days on Free. See the list below the table | cf-backup (configuration) | 0.25, plus the drill | owner step |
| 7 | **One road for all hotel mail.** Send these through the queue (or count and ledger them): `src/lib/auth/security-logging.ts` (an alert on every admin sign-in), `src/lib/storage/share-email.ts`, `src/lib/storage/notify.ts`, `src/lib/retention-email.ts`, `src/lib/gsc/ops-alert.ts` and `src/pages/api/users/resend-invite.ts` | these six modules post straight to Brevo or Resend. That mail gets none of the queue's retries or failover and has no place in the API budget's arithmetic, and only invite re-sends write a ledger row. Yet it spends the same 300 a day as booking confirmations | cf-admin | 1 to 1.5 | new |
| 8 | **Decide consumer CPU.** Either keep the cold-start diet going, or approve Workers Paid | 12 to 13 ms on a cold start against a 10 ms limit. Cloudflare tolerates occasional overruns but terminates consistent ones | owner, then consumer | decision, then 1 | open (D10 of the v2 plan) |
| 9 | **Prove the failover, and align authentication at both providers.** One real send through Resend from the hotel's domain. SPF, DKIM and a DMARC record aligned with the From domain, for Brevo and for Resend, checked with the Email Portal's DNS diagnostics | the 2026-09-30 design records "the failover may be illusory". Below 5,000 a day Gmail requires SPF or DKIM, plus PTR and TLS. Since November 2025 Gmail has been rejecting non-compliant mail. The 2026-04-24 audit found no DMARC record at the time ([SSL and Lighthouse audit](../security/reviews/2026-04-24-ssl-lighthouse-audit.md)) | owner (DNS) | 0.25 | open |
| 10 | **Check the provider's terms before reselling.** Brevo's terms (version of 2025-10-01) say that use of the service is "strictly personal and shall not be leased, distributed, assigned, rented or transferred to any third party", and they point agencies to a separate agency programme | offering the API to other businesses (the Velox case) needs Brevo's agency or enterprise terms, or a provider whose terms allow it | owner | decision | open (2026-09-30 design, §15) |

How item 4 would work:

1. On every send, pass Brevo an `idempotencyKey`. It goes inside `headers` in the request body, lasts 30 minutes, and is derived from the message key.
2. Treat Brevo's `duplicate_parameter` answer as "already sent", not as a failure.
3. Resend accepts a standard `Idempotency-Key` header and keeps it for 24 hours.
4. For a retry more than 30 minutes later, ask Brevo's events API by tag (`api_msg_<id>`) before sending again.

What item 6 involves:

- **Two lists to update.** Adding the database to `BACKUP_D1_DATABASES` covers the weekly backup. The daily pipeline has its own fixed list of databases (`cf-backup/.github/workflows/secondary-pipeline.yml`), so both lists need the change.
- **Owner rules apply.** cf-backup is owner-locked, so the change is the owner's step.

### 5.2 Should-have in the next few months

| # | Item | Why | Effort |
|---|---|---|---|
| 11 | **Forward the unsubscribe headers.** The portal creates RFC 8058 one-click headers for each recipient (`src/pages/api/emails/send.ts`), but the consumer drops them | still open as follow-up 2 of item C-4 in [MAINTENANCE.md](../MAINTENANCE.md). Gmail and Yahoo require one-click unsubscribe only from bulk senders, but it keeps complaints down, and the endpoint already exists | 0.5 |
| 12 | **Two kinds of suppression.** An unsubscribe stops marketing-type mail, not a booking confirmation; a hard bounce or a complaint stops everything. Store a scope with each entry | today the API applies every entry to every message. The 2026-09-30 design already chose this split (decision 22) | 1 |
| 13 | **One status vocabulary.** The webhook writes `hard_bounce`, `soft_bounce`, `blocked` and `invalid_email`, while backup alerts and the portal expect `bounced` and `failed`. Settle one list, and add `email_error` to cf-astro's schema files | cf-backup receives these statuses as `unknown`. The `email_error` column exists only in the live database | 0.5 |
| 14 | **Harden the Brevo webhook.** cf-astro's endpoint (`cf-astro/src/pages/api/webhooks/brevo.ts`) checks only a shared secret. Add Brevo's published address ranges, a replay window, and a 429 answer when the database is down | Brevo signs nothing, retries only on a timeout or a 429, and discards events answered with a 5xx. cf-admin's twin endpoint (`src/pages/api/emails/webhook.ts`) is not in service ([Brevo webhook runbook](../runbooks/brevo-webhook.md)) | 0.5 |
| 15 | **An alarm that is not email.** A push channel (Telegram or similar) and a daily digest: sent, failed, dead, dropped, budget used | "Email is never the alarm for email" (2026-09-30 design, decision 8). Today Sentry is the only alarm, and platform alert email is off | 1 |
| 16 | **Outside health check.** The VPS probes call `GET /v1/health` and, once a day, send one sandbox message end to end | a check that runs outside Cloudflare notices a Cloudflare-side outage. It is a good, low-risk job for the VPS | 0.5 |
| 17 | **Retention you can run.** A dashboard action, "remove message bodies older than N days" (audited), and an erase-by-address path for ARCO requests | `api_messages` keeps every body for ever. By owner rule nothing deletes automatically, so the purge must be a deliberate, recorded action | 1 |
| 18 | **Reserved room for booking mail.** Hotel mail keeps a guaranteed share of Brevo's 300 a day, whatever the composer, the direct senders (item 7) and the API do | the API budget caps API mail only | 0.5 |
| 19 | **Templates for API clients.** `template_id` plus variables instead of raw HTML; Brevo already stores the portal's templates | consistent branding, smaller requests, and less room for abuse than free HTML | 2 |
| 20 | **Public API docs, an OpenAPI file and sandbox tokens** (`ems_test_...`: validated and recorded, never sent, never counted) | a client can integrate without spending real email | 2 to 3 (P4) |

### 5.3 Good to have later

| # | Item | Effort |
|---|---|---|
| 21 | List and batch endpoints, and cancelling a scheduled message. Scheduled portal mail sits at Brevo for up to 30 days and cannot be cancelled today (P5) | 2 |
| 22 | Webhooks to client apps, signed per the Standard Webhooks spec, with a delivery log and replay (P5) | 2 to 3 |
| 23 | Attachments for API mail, uploaded to R2 first and referenced by id (a queue message carries at most 128 KB) | 1.5 |
| 24 | A DMARC aggregate-report reader, to see who sends as the hotel's domain and whether alignment holds (a good VPS job) | 1 |
| 25 | A staging mail sink (Mailpit or similar), so that tests and template previews never reach a real inbox (a good VPS job) | 0.5 |
| 26 | Inbound mail: Cloudflare Email Routing plus an Email Worker, to attach guest replies to the right booking or inquiry | 2 |
| 27 | Per-client sending domains with DNS verification, for Velox clients who must send from their own domain | 3 to 5 |

## 6. Part 3: API Access v2 in cf-admin

### 6.1 What exists today

API Access is two days old (cf-admin `15ac609`, 2026-09-30, to `cdcab8e`, 2026-10-01) and is more complete than it looks. Owner's guide: [Email API Access](../features/EMAIL-API-ACCESS.md).

| Area | Today |
|---|---|
| Addresses | `/dashboard/emails/api`, `/dashboard/emails/api/tokens`, one token at `/dashboard/emails/api/tokens/<id>`, `/dashboard/emails/api/activity`, `/dashboard/emails/api/settings`; Back and Forward work (`src/lib/email-section.ts`) |
| Status strip | API on or off; active, blocked and expired counts; recipients today against the shared budget (amber at 80%, red at 100%); failed in the last 24 hours; messages stuck for more than 10 minutes |
| Tokens | search by name, id or sender; status chips; "show deleted"; a usage bar per row; an "expires soon" badge; renew for 90 days, edit, block with a reason, unblock, delete (by typing "delete"), rotate; a quick start with a curl example |
| Create and edit | name; permissions (`send`, `read`); senders (from the API-enabled Registered Senders); a per-minute limit of 1 to 600; a per-day limit of 1 to 100,000; expiry presets from 1 hour to 90 days (the default), never, or a chosen date; the secret is shown once |
| Token panel | facts, today's usage, the 8 latest messages and the 10 latest events |
| Activity | filter by token and status; 50 messages a page, with "load older"; the 50 newest events |
| Message detail | every field, the last error, the raw body (up to 20,000 characters), "send it again" for failed or dead mail |
| Settings | master switch; default limits; recipients per message; the shared daily budget; a daily-capacity card (provider usage against the API's budget); the read-only sender list |
| Permissions | `#api-view`, `#api-manage` and `#api-config` on `/dashboard/emails`, owner by default and live in `admin_pages`. Each route checks them, and the email service checks them again |
| Audit | cf-admin audit rows for create, edit, block, rotate, delete, re-queue and settings; the email service's own event trail |
| Tests | 54 tests in 5 files (Console client, routes, form model, senders, section addresses); no render or end-to-end tests for the screens |

### 6.2 How it compares

From each provider's documentation (§10). "Yes" means the feature is documented; a blank cell means it was not found.

| Capability | Hotel API today | Postmark | Resend | SendGrid | Mailgun | Amazon SES | Brevo |
|---|---|---|---|---|---|---|---|
| Key scoped to senders or domain | yes (senders) | per server | domain, on sending keys | | domain sending keys | IAM conditions on From | |
| Fine-grained permissions | 2 (`send`, `read`) | | 2 levels | yes (custom scopes) | roles | yes (IAM) | |
| IP allow-list | | yes | | yes | yes | yes (IAM) | yes (learns, then blocks) |
| Key expiry and rotation | yes (rotation kills the old secret at once) | | | | yes | via IAM | |
| Last used | time only | | yes, with logs per key | | | via IAM | |
| Test or sandbox mode | | yes (sandbox servers) | test addresses | yes (sandbox flag) | yes (test mode) | yes (account sandbox, simulator) | yes (sandbox header) |
| Searchable activity log | token and status filters only | yes (45 days, up to 365) | yes (30 days on Free) | yes (paid add-on) | yes | build your own | yes (API window of 90 days) |
| Timeline for each message | | yes | yes | yes | yes | build your own | yes |
| Request log (refused calls too) | | | yes (API Logs) | | | | |
| Suppression management | shared list, no per-token view | per stream | yes | several kinds of list | per domain | account and per set | yes, with reasons |
| Webhooks to the client | | yes (unsigned) | yes (signed) | yes (signed) | yes (signed) | via SNS | yes (unsigned) |
| Templates | | yes | yes | yes | yes | yes | yes |
| Transactional and broadcast kept apart | | message streams | separate product | subusers, IP pools | IP pools | configuration sets | separate platforms |
| Usage history and charts | today only | yes | usage page | yes | yes | yes | yes |
| Export | | API dump | CSV | CSV | | | |

The hotel API's core is in line with the best:

- hashed secrets shown once;
- idempotency;
- RFC 9457 errors;
- three independent limits plus a shared budget;
- three server-side permission checks;
- a send-time sender check.

What it lacks is the layer of **visibility and control** around that core.

### 6.3 Gaps and proposals

Priority A is next, B follows, and C comes when a client asks.

**Visibility: what happened.**

| # | Proposal | Why | Priority | Effort |
|---|---|---|---|---|
| A1 | **Timeline for each message:** accepted, queued, sent, then delivered, bounced or complained, plus the number of suppressed recipients | the Console already returns `delivery`, `delivery_at` and `suppressed`, but the screen never shows them (`src/lib/email-console-types.ts`, `ApiMessageDelivery`, has no reader). It becomes complete with item 1 of §5.1 | A | 0.5, after P2 |
| A2 | **A rendered preview** in a sandboxed frame (no scripts), with a raw-source toggle | the detail dialog shows raw HTML source (`src/components/admin/emails/api-access/ApiMessageModal.tsx`) | A | 0.5 |
| A3 | **Search and date range** over activity: recipient, subject, message id, idempotency key, "has an error"; filters kept in the address so a view can be shared | today there are two dropdowns and no free text, and filters are lost on navigation | A | 1 |
| A4 | **CSV export** of the filtered activity (capped, for example at 5,000 rows) | the portal's own Activity Logs already export; API mail cannot | A | 0.5 |
| A5 | **Usage history and charts:** each token, each day, over 7, 30 and 90 days (accepted, recipients, sent, failed, bounced, refused) | only today's counters are stored (`cf-email-consumer/migrations/0002_api_access.sql`, columns `day`, `day_count`). Message-based series can be computed from `api_messages` with no new writes; refusals need a small daily counter | A | 1.5 |
| A6 | **A request log:** every call, including refused ones, with time, token, path, status, error code, duration, outgoing country and a hashed IP, kept for 14 to 30 days | the first thing a client developer needs when an integration fails. Today a refusal leaves at most one event per token per reason every 5 minutes, and a call with an unknown token leaves nothing. Workers Analytics Engine, already used by cf-admin and cf-astro, avoids a D1 write per request | A | 1 to 1.5 |
| A7 | **An overview page:** sent and failed today, this week and this month; bounce and complaint rates; budget and provider usage over time; top tokens; top error codes; health (oldest queued message, dead letters) | the status strip shows five numbers and drops the rest of what the Console returns | B | 1 |
| A8 | **Live refresh** every 15 seconds while the page is visible | data loads once, then only on Refresh (`src/components/admin/emails/api-access/useApiAccess.ts`) | B | 0.25 |
| A9 | **API mail in the portal's own views.** Show it, or link it, from Activity Logs and Contacts | operators see the portal's mail and the API's mail in two unconnected places | B | 1 |

**Control: who may do what.**

| # | Proposal | Why | Priority | Effort |
|---|---|---|---|---|
| B1 | **Token restrictions:** allowed recipient domains or addresses, recipients per message for this token, a monthly cap, required `Idempotency-Key`, allowed tags | the token model is thin: two permissions and a shared recipient cap. An internal alerting app, for example, should be able to mail only `@madagascarhotelags.com` | A | 1 |
| B2 | **IP allow-list,** plus the last-used IP (hashed), country and client name on the token panel | a leaked token becomes useless elsewhere, and theft becomes visible (P4 item 5) | A | 0.5 to 1 |
| B3 | **Test tokens** (`ems_test_...`) and a "send a test with this token" button | clients can integrate without real mail, and operators can check a token in one click (P4) | A | 1 to 1.5 |
| B4 | **Rotation with an overlap window.** The old secret keeps working for a chosen 1 to 72 hours | today a rotation refuses the old secret on the very next request, so a client must redeploy at that exact moment | A | 0.5 to 1 |
| B5 | **Token details:** a description, an owner contact, the app or client it belongs to | when a token misbehaves, the screen should say whom to call | B | 0.5 |
| B6 | **Automatic blocks with a reason:** bounces plus complaints over a threshold, a token that stays limited, failed sign-ins from many addresses | P2 and P4 rules, visible as "blocked by system" | B | 1 |
| B7 | **A "hold" switch** (accept and store, but do not send) next to the master switch | an emergency stop that loses nothing (2026-09-30 design, decision 16) | B | 0.5 |
| B8 | **Permission consistency.** See the list below the table | each of these confirms a refusal only after the person has tried | A | 0.5 |

What B8 covers:

- The token form offers only senders the creator's role allows.
- The Registered Senders API switch is hidden from people without `#api-config`.
- The page applies the same role floor as the routes. Today a manager granted `#api-view` sees the tab, and then every call is refused.

**Integration: what a client developer gets.**

| # | Proposal | Why | Priority | Effort |
|---|---|---|---|---|
| C1 | **Public API docs** at the API address (static files, no Worker requests spent), an OpenAPI 3.1 file, and examples in curl, JavaScript, PHP and Python | the quick start's "API reference" links into the private cf-email-consumer repository (`src/components/admin/emails/api-access/ApiQuickStart.tsx`), which a client cannot open (P4) | A | 1.5 to 2 |
| C2 | **Rate-limit headers** on every answer (`RateLimit` and `RateLimit-Policy`, IETF httpapi draft 11) | clients can slow down before they are refused | B | 0.5 |
| C3 | **Webhooks to clients:** an endpoint for each token or client, chosen events, Standard Webhooks signatures, a delivery log, retries and replay, a "send test event" button | clients learn about deliveries and bounces without polling (P5) | C | 2 to 3 |
| C4 | **Templates for API mail.** Pick from the portal's templates and expose `template_id` and variables; a token can be limited to certain templates | §5.2 item 19 | B | 1.5 to 2 |
| C5 | **List and batch endpoints** (P5) | clients can reconcile and send in bulk | C | 2 |
| C6 | **Client self-service** (for Velox): a client manages its own tokens, webhooks and logs, scoped to its project | the long-run shape if the API is sold. It needs a project model; the 2026-09-30 design §5 already sketches one | C | 5 or more |

**Operations and quality.**

| # | Proposal | Why | Priority | Effort |
|---|---|---|---|---|
| D1 | **Alerts:** budget at 80% and 100%, a token limited or blocked, a spike in failed sign-ins, dead letters, a bounce rate over a threshold, provider quota nearly used, a token expiring within 7 days | today expiry shows only as a badge, and nothing notifies anyone | A | 1 |
| D2 | **A better audit trail:** old and new values for limit and setting changes; record the sender sync; delete rows labelled with the token's name, not only its id | edits and settings changes record key names only | B | 0.5 |
| D3 | **Fix stale wording,** in the files listed below the table | the copy predates rotation and the move of senders to Registered Senders | A | 0.25 |
| D4 | **Render tests** for the API Access screens | 54 tests cover the logic, but none renders a screen | B | 1 |
| D5 | **A rate limit on the five cf-admin API Access routes,** like the composer's send route | an admin session in a script loop should not be able to flood the Console | B | 0.25 |

The stale wording (D3) is in these files:

- `src/components/admin/emails/api-access/ApiTokenFormModal.tsx`, which says "create a new token to rotate it";
- `src/components/admin/emails/api-access/ApiTokenSecretModal.tsx`, which says "Your new API token" after a rotation;
- `src/components/admin/emails/api-access/ApiTokensPanel.tsx`, which says "An owner can create one." although `#api-manage` is enough.

### 6.4 Proposed layout

Every address below is served by the existing catch-all page (`src/pages/dashboard/emails/[...section].astro`). A new section only needs adding to its parser (`src/lib/email-section.ts`), and PLAC needs no new page. A section would get its own `#api-*` key only if it needs a separate permission.

| Address | Section | Status |
|---|---|---|
| `/dashboard/emails/api` | **Overview** (A7): numbers, charts, health, alerts | the address exists today and shows the token list |
| `/dashboard/emails/api/tokens` | the token list, with bulk block and unblock | exists |
| `/dashboard/emails/api/tokens/<id>` | **a full token page**: usage chart (A5); settings and restrictions (B1, B2); security (rotation with overlap, last used, refusals); messages; requests (A6); webhooks (C3); history with old and new values (D2) | proposed; today a side panel |
| `/dashboard/emails/api/activity` | messages, with search, date range and export (A3, A4) | exists, without search or export |
| `/dashboard/emails/api/messages/<id>` | one message: timeline, preview, raw source, resend (A1, A2) | proposed, already in the v2 plan; today a dialog |
| `/dashboard/emails/api/requests` | the request log (A6) | proposed |
| `/dashboard/emails/api/webhooks` | endpoints and delivery attempts (C3) | proposed |
| `/dashboard/emails/api/settings` | today's settings, plus alerts (D1), retention (§5.2 item 17) and test tokens (B3) | exists |
| `/dashboard/emails/api/docs` | quick start, examples, a link to the public docs (C1) | proposed |

### 6.5 Where the new data would live

Everything stays in the email service's own database, `madagascar-email-db`. cf-admin keeps no API table, so its RULE #0.9 table cap is untouched. The changes are ordered cheapest first:

1. **Computed on read, with no new writes:** charts and the overview from `api_messages`. Its ids are time-ordered, so a date range is a primary-key range.
2. **New columns on `api_tokens`:**
   - `description` and `contact`;
   - `ip_allow`, `recipient_allow` and `max_recipients`;
   - `require_idempotency` and `environment` (`live` or `test`);
   - `prev_secret_hash` and `prev_secret_until`, for the rotation overlap;
   - `last_used_ip_hash` and `last_used_country`.
3. **One small counter table** for refusals per token per day. It is written at most once per token, per reason, per 5 minutes, as today's `auth.rejected` events already are.
4. **The request log** in Workers Analytics Engine, not D1, so a flood cannot spend D1's daily writes.
5. **Later, for webhooks (C3):** an endpoint table and a delivery table.

### 6.6 Suggested order for API Access

| Step | Content | Effort |
|---|---|---|
| 1 | B8 and D3 (consistency and wording), A8 (refresh), A2 (preview) | 1.5 |
| 2 | A3 and A4 (search and export), A5 (history and charts) | 3 |
| 3 | B1 to B4 (restrictions, IP allow-list, test tokens, rotation overlap), with the email API changes they need | 3 to 4 |
| 4 | A6 (request log), D1 (alerts), A7 (overview) | 3 |
| 5 | C1 (public docs, part of P4) | 2 |
| 6 | A1 once P2 ships; then C3, C4, C5 when a client asks | 1 to 7 |

## 7. Part 4: sharper permissions, and the Email API as its own console

Added on 2026-10-01 at the owner's request: assess two more ideas, without building anything.

1. **More accurate permissions** for the email API system.
2. **A separate sidebar page** for the Email API in cf-admin and, where possible, **moving its code into the cf-email-consumer repository**, the way Backups (cf-backup) and Server (cf-vps) own their consoles.

### 7.1 The permissions today, and why they are too coarse

**Today**

- Three action keys on the Email Portal page control everything: `#api-view`, `#api-manage` and `#api-config` on `/dashboard/emails`.
- Each defaults to the owner, and only the owner or vendor support can grant one to someone else.
- The routes also require Admin or above (canonical Admin, stored `super_admin`).
- The email service checks the same three keys again, from the `caps` list cf-admin sends it ([Email API Access](../features/EMAIL-API-ACCESS.md)).
- Live state (2026-10-01): nobody holds a per-person grant on any Email Portal, Backups or Server key. So today only the owner and vendor support use API Access, and changing the keys costs nothing to migrate.

**What is wrong with three keys**

| # | Problem | Example |
|---|---|---|
| 1 | **Reading mail is bundled with looking at tokens.** `#api-view` shows token metadata, but also every message's recipients and body: personal data | someone asked to watch delivery health also gets to read guests' email |
| 2 | **Routine and dangerous changes share one key.** `#api-manage` covers renaming and renewing, but also creating a token (which mints a credential), rotating it (a new secret is shown), raising its limits, adding senders, unblocking, deleting and re-sending real mail | you cannot let an on-call person block a token without also letting them create one |
| 3 | **The emergency stop shares a key with widening.** `#api-config` covers switching the API off, raising the shared budget (which eats into the hotel's own mail allowance) and allowing a new sender for the API | the person who may pull the plug can also open the tap |
| 4 | **No sign-in freshness.** Creating or rotating a token and raising the budget work on a session up to 24 hours old. Backups and Server already require a sign-in from the last 10 minutes for their dangerous actions; the email actor does not even carry the sign-in time | a laptop left signed in can mint a working token |
| 5 | **Grants are coarse.** A per-person grant has no expiry. It is wiped when the person's role changes, and it cannot be given to a role, only one person at a time | "let one Manager block tokens, for this week only" cannot be expressed |
| 6 | **The screen and the server disagree.** A Manager granted `#api-view` sees the tab, but every call is refused by the Admin floor. The Registered Senders API switch is shown to people the server will refuse | refusals arrive after the click |
| 7 | **The API rides on the Email Portal's door.** All API Access routes sit behind the Email Portal page | API access cannot be given without portal access, and denying the portal silently denies the API |
| 8 | **Nothing scopes a person to their own tokens** | once there are several apps or clients, one person can change every app's token |

One more requirement before any key is renamed or deactivated: every action key must be checked on its exact key, and must refuse when that key is absent. The Server console's page check (`mayUseConsole` in `src/lib/vps-proxy.ts`) already works this way. The maintenance backlog tracks this as item E-11.

### 7.2 A capability catalog for the Email API

The proposal is the model Backups and Server already use (`cf-vps/documentation/security/PERMISSIONS.md`, `cf-backup/src/access/catalog.ts`): a closed list of small **capabilities**, defaults per role, and per-person allow or deny with an expiry and a reason.

Each capability has:

- a **class**: `read` looks; `operate` changes something without widening what the API can do; `admin` widens it, mints a credential, or touches the hotel's own mail allowance;
- a **floor**: the lowest role that may ever hold it, whatever a grant says.

The email version adds one rule the others do not need: **reducing exposure is cheap, widening it is guarded.** Blocking, narrowing and pausing are on a different capability from unblocking, widening and resuming.

| Capability | Class | Allows | Default holders | Floor | Fresh sign-in |
|---|---|---|---|---|---|
| `console.view` | read | open the Email API page; overview numbers | Owner, Vendor, Admin | Manager | |
| `tokens.view` | read | token list and details (never a secret) | Owner, Vendor, Admin | Manager | |
| `messages.view` | read | the message list: time, token, status, error, recipient count, with addresses masked | Owner, Vendor, Admin | Manager | |
| `messages.read_body` | read | full recipient addresses, subject and the rendered body (personal data) | Owner, Vendor | Admin | |
| `requests.view` | read | the request log, with hashed IP addresses | Owner, Vendor, Admin | Manager | |
| `audit.view` | read | the change trail, with old and new values | Owner, Vendor | Admin | |
| `access.view` | read | who holds which capabilities | Owner, Vendor | Admin | |
| `tokens.block` | operate | block a token at once (the emergency action) | Owner, Vendor, Admin | Manager | |
| `tokens.narrow` | operate | lower limits; remove senders or permissions; add IP or recipient restrictions; shorten expiry; rename; describe | Owner, Vendor, Admin | Manager | |
| `api.pause` | operate | switch the API off, or to hold | Owner, Vendor, Admin | Manager | |
| `messages.resend` | operate | re-queue a failed or dead message | Owner, Vendor, Admin | Manager | |
| `messages.test_send` | operate | a test send with a test token | Owner, Vendor, Admin | Manager | |
| `tokens.delete` | operate | delete a token | Owner, Vendor | Admin | |
| `activity.export` | operate | export activity as CSV (bulk personal data) | Owner, Vendor | Admin | yes |
| `tokens.create` | admin | create a token; the secret is shown once | Owner, Vendor | Admin | yes |
| `tokens.widen` | admin | raise limits; add senders or permissions; remove restrictions; extend expiry | Owner, Vendor | Admin | yes |
| `tokens.unblock` | admin | unblock a token | Owner, Vendor | Admin | yes |
| `tokens.rotate` | admin | give a token a new secret; the new secret is shown once | Owner, Vendor | Admin | yes |
| `api.resume` | admin | switch the API back on | Owner, Vendor | Admin | |
| `settings.limits` | admin | default limits for new tokens; recipients per message | Owner, Vendor | Admin | |
| `settings.budget` | admin | the shared daily budget, which comes out of the hotel's own allowance | Owner, Vendor | Owner | yes |
| `senders.allow` | admin | turn on a Registered Sender's API switch (in Email Settings) | Owner, Vendor | Owner | yes |
| `retention.purge` | admin | remove old message bodies; erase by address for an ARCO request | Owner, Vendor | Owner | yes |
| `webhooks.manage` | admin | client webhooks, when they exist | Owner, Vendor | Admin | yes |
| `access.manage` | admin | change role defaults and per-person grants | Owner, Vendor | Owner | yes |

Vendor means vendor support. "Floor: Owner" means only the owner and vendor support can ever hold it. Managers, Staff and Viewers hold nothing by default; the owner can grant a Manager anything with a Manager floor.

How a decision is made, in the same order as Backups and Server:

1. An unknown capability is refused.
2. A capability whose floor is above the person's role is refused, whatever any grant says.
3. A per-person deny wins.
4. A per-person allow that has not expired grants.
5. Otherwise the role's default decides.

On top of that:

- **Fresh sign-in.** The marked capabilities need a sign-in from the last 10 minutes, as on Backups and Server. That needs cf-admin to add `signedInAt` to the email actor (`src/lib/email-console.ts`).
- **Every route names exactly one capability, and the server checks it.** The screen only hides what the person cannot use, from the proposed console's `/api/me` answer.
- **Last-holder guard.** The owner or vendor support must always keep `access.manage`, as on Backups and Server.
- **Later, if clients arrive (Velox):** a scope of "own tokens" or "all tokens" for the token capabilities, so a person can manage only the tokens of their own app. Also a second-person approval for widening beyond set thresholds, for example a token above 500 messages a day or a budget above 200.

**Where the catalog lives** depends on §7.4:

- **If API Access stays in cf-admin:** each capability becomes a PLAC action key on the new page. That works, but PLAC has no expiry, no grant to a role, and no floors except in code. About 25 extra registry rows would approximate the table.
- **If the Email API becomes its own console:** the catalog lives in the email repository, next to the code that enforces it. The policy is stored as one row, `email:access`, in cf-admin's settings table, exactly as `backup:access` and `vps:access` are. cf-admin's Users page gets a small "Email API" panel, like the Server panel (`src/components/admin/users/VpsAccessPanel.tsx`), to edit one person.

### 7.3 Token permissions: what an app may do

Today a token has two permissions (`send`, `read`), a sender list, two limits and an expiry. Proposed:

| Kind | Today | Proposed |
|---|---|---|
| Permissions | `send`, `read` | `messages.send`, `messages.read`, `messages.list`, `messages.cancel` (P5), `templates.use` (§6.3 C4), `suppressions.read`. Keep `send` and `read` as aliases, so existing tokens keep working |
| Where mail may come from | senders (live) | unchanged |
| Where mail may go | anyone | an optional list of allowed recipient domains or addresses (§6.3 B1) |
| Where calls may come from | anywhere | an optional IP allow-list (§6.3 B2) |
| How much | per minute, per day, shared budget | add recipients per message and a monthly cap for this token (§6.3 B1) |
| Environment | live only | `live` or `test` (§6.3 B3) |
| Safety | optional `Idempotency-Key` | optionally require it |

### 7.4 Where the Email API should live: four options

| | Y0. Today | Y1. Own sidebar page, code stays in cf-admin | Y2. Own console in cf-email-consumer, framed in cf-admin (the Backups and Server pattern) | Y3. Own console at `email.madagascarhotelags.com` |
|---|---|---|---|---|
| Where staff click | Email Portal, API Access tab | sidebar, "Email API" | sidebar, "Email API" | a separate web address, outside the admin portal |
| Who owns the screens | cf-admin | cf-admin | cf-email-consumer | cf-email-consumer |
| Who owns "who may do what" | cf-admin (3 keys) | cf-admin (more keys) | the email service's catalog (§7.2); cf-admin decides only who may open the page | a second, separate sign-in and permission system |
| A new feature touches | both repositories | both repositories | the email repository only; cf-admin's gateway does not change | the email repository only |
| Sign-in and audit | cf-admin | cf-admin | cf-admin (identity, the page door, one audit row per change), plus the console's own trail | Cloudflare Access plus new code; audit split from cf-admin |
| Effort | none | 1 to 1.5 days | 6 to 8 days | 8 days or more, plus a security review |
| Risk | none new | low | medium: a two-day-old feature is rebuilt, using a pattern already proven twice | high: an admin screen on the public API's hostname |

**Y3 needs a word.** The public API already runs from this repository at `email.madagascarhotelags.com`, and should stay there. The management screens should not be served from that address. Backups and Server deliberately have no address at all: only cf-admin can reach them, through a service binding, so they can trust the identity cf-admin passes. A console on a public hostname would need its own sign-in and a signed identity, and would split the audit trail. The cf-backup integration record says as much: if a console ever gains a public address, "the actor header must become signed". A client self-service portal at that address may make sense one day (§6.3 C6), but that is a different product, with client sign-in, not the hotel's admin console.

### 7.5 Is it a good idea?

**Yes, with conditions.**

**A separate sidebar page: yes, clearly.** Managing API tokens is an integration and security job, not part of writing email. Its own page:

- gives the API its own door in the permission system (problem 7 in §7.1);
- is where the future pages in §6.4 fit naturally.

**A capability catalog: yes, in either shape.** It costs little if it is designed in from the start. Retrofitting it after more features exist costs more.

**Moving the code into cf-email-consumer (Y2): yes, if the email API is going to grow.** The roadmap's P4 and P5 items, the §6 features and a possible client offer (Velox) all suggest it will.

| For | Against |
|---|---|
| One repository owns the feature end to end: the API, the data, the screens, the permissions, the tests and the docs. Today every feature changes both repositories, and the message shapes are copied by hand (`src/lib/email-console-types.ts` mirrors the email service's Console) | 6 to 8 days of work that adds no new feature by itself |
| A new permission or screen ships with one deploy of one repository; today it also needs a cf-admin migration, a release and a deploy | a third CSP framing exception in cf-admin (`src/lib/security/csp.ts` lists two today); each one is a reviewed exception |
| The same mental model as Backups and Server; the gateway pattern, its tests and its pitfalls are already written down twice | a third Worker to deploy and watch (see below), and its own deploy connection |
| cf-admin shrinks: about 2,900 lines of API Access code leave, and about 900 lines of gateway arrive | two UI code bases to keep visually consistent (the twins read the portal's theme from the parent page) |
| The email service becomes a self-contained product: API, consumer, console and docs in one place. The same console could later absorb the rest of the Email Portal (the 2026-09-30 design's Track 3), if the owner ever wants that | each asset of the console loads through cf-admin's gateway, so it is a cf-admin request; the service-binding call itself is not billed as an extra request |
| **Now is the cheapest moment:** one token, no API messages kept, no per-person grants, a two-day-old feature, and no outside users | deploy order matters in both directions: the console goes first, but cf-admin goes first when the console adds a new audit action |

If the owner expects API Access to stay small and hotel-only, Y1 alone is enough. Doing Y1 now and Y2 later wastes about a day, so it is better to choose once.

**Worker shape for Y2: a third, private Worker.** The admin console should not live inside today's public API Worker.

- `cf-email-api` serves the public `/v1/*` door on `email.madagascarhotelags.com`. Putting the console's screens and admin routes in the same Worker would mean the internet-facing code carries the admin door. Its assets would also need careful gating so they are never served on the public hostname.
- A new Worker, `cf-email-console`, with no route, no `workers.dev` address and no preview URLs, keeps the Backups and Server trust model exactly:
  - its static assets are served only after the Worker runs;
  - it binds the email database (tokens, messages, settings), the queue (for re-sending) and cf-admin's shared database (for its access row only);
  - it holds no secrets.
- The public API Worker then loses its `Console` entrypoint and gets smaller.

### 7.6 If approved: the move in steps

1. **Email repository.** Expected effort: 4 to 5 days.
   - Create the private console Worker. Port its router, actor parsing, capability catalog, stored policy and fresh-sign-in check from cf-backup and cf-vps.
   - Move today's Console routes over, keeping the old entrypoint working during the switch.
   - Add the proposed console route `/api/me`, returning the person's capabilities.
   - Build the screens with Preact under the console's own path, porting today's 12 components (about 2,000 lines) to the console's styles.
   - Add an Access screen.
   - Tests:
     - no public surface;
     - each route has exactly one capability;
     - each change carries an audit action;
     - the floors and the last-holder guard.
2. **cf-admin.** Expected effort: 1.5 to 2 days.
   - Add a gateway twin of `src/lib/vps-proxy.ts` (proxy, audit map, section addresses, the frame page and the gateway route), and the third frameable prefix in `src/lib/security/csp.ts`.
   - Add one migration (the next free number, 0062 today) for the proposed `/dashboard/email-api` page row, with icon `key-round` and the door at Admin (decision O12). Use the exact-key page check, never an inherited one.
   - Add a section rule so the page sits with the Email Portal in the sidebar, and point the `EMAIL_CONSOLE` binding at the new Worker.
   - Add the Users-page panel.
   - The Registered Senders API switch stays in Email Settings, but asks the console whether the person holds `senders.allow`.
   - In the same change, remove the API Access tab, its 5 routes and its client, as the ratchet requires.
   - Redirect the old addresses under the Email Portal's API section to the new page for a release or two.
3. **Order.**
   1. Deploy the console Worker.
   2. Run cf-admin's `npm run release`, which applies the page row before the code.
   3. The owner opens the page once.
   4. After a quiet week, deactivate the three old `#api-*` keys, but only once nothing checks them and E-11 is fixed.
   5. Then remove the old `Console` entrypoint from the public Worker.
4. **Rollback.** Re-deploy the previous cf-admin version. The old tab works for as long as the old entrypoint exists.
5. **Then build §6 in the new home.** Every API Access feature in §6.3 is cheaper to build once in the console than to build in cf-admin and move.

The §6.6 order still applies, but after this move. Decisions O9 to O14 in §9 capture the choices.

### 7.7 The owner's decisions (2026-10-02), and what was built

The owner answered on 2026-10-02.

- **No third Worker, ever.** The email service keeps exactly two: `cf-astro-email-consumer` and `cf-email-api`. That rules out Y2 as §7.5 designed it (it needed `cf-email-console`), and Y3.
- **The VPS stays parked.** Asked to double-check whether the Node.js and nginx already on the VPS could run the API management page instead (300 ms would be fine), the answer is still no, and not because of speed:
  - the tokens and their log live in Cloudflare D1, so the VPS would reach them through the D1 REST API with an account token. Cloudflare lists D1 Edit as an account permission, not a per-database one: the same token could write cf-admin's own database, where the PLAC tables decide who may do what;
  - blocking a leaked token, the emergency action, would then depend on the one server with no failover and no app rollback (§4.1, §4.4);
  - the Node process already there is the server console's read-only agent; an admin app inside it would weaken that console's trust model;
  - cf-admin would still be the door, so the move would save no requests and no code.
- **A separate page, built as Y1 (§7.4), with the rules in the email service.** The page is `/dashboard/email-api`, "Email API" in the sidebar's Tools section after the Email Portal. The screens stay in cf-admin, the only private, signed-in place for them without a third Worker (`cf-email-api` serves the public API). The Console makes the decisions only it can: whether an edit widens a token, whether a settings change is a pause, and what a person without Read mail may see.
- **Five permissions instead of the 25 of §7.2.** The owner was concerned that 25 capabilities would slow sign-in. Checked: sign-in reads every page key in one D1 query and keeps the map in the session it writes anyway, so 25 rows would not measurably slow it; the real cost is 25 switches per person. The five are the page itself, `#respond`, `#read-mail`, `#manage` and `#settings` ([Email API page](../features/EMAIL-API-ACCESS.md), section 3). They fix problems 1, 2, 3, 6 and 7 of §7.1. Problem 4 (fresh sign-in) was declined, problem 5 (grant expiry) is a PLAC limit, and problem 8 (own-token scope) waits for a second app.
- **Defaults:** admins open the page and hold `#respond`; `#read-mail`, `#manage` and `#settings` are the owner's to grant.
- **No 10-minute re-sign-in** for Manage tokens or API settings.
- **No KV writes.** The feature adds none: its rows are in D1, its data in the email database.
- **E-11 fixed in the same change** (O14): action keys, and the new page key, are checked on their exact rows.

Built on 2026-10-02: in cf-email-consumer, commit `1744f1d` (the Console's five permissions, the reduce-or-widen rule, masked addresses, and the old key names still read); in cf-admin, the page, migration `0062`, the routes' new keys, the old addresses' redirect and the E-11 fix. The owner applies `0062` with `npm run release`, and `cf-email-api` deploys from `main` once its Workers Builds connection exists.

## 8. Documentation drift found

Recorded for the owner; not changed in this document.

| Where | Says | Actually |
|---|---|---|
| [Schema change ledger](../reference/schema-change-ledger.md) | migrations 0057 to 0060 are **pending** | all of 0057 to 0061 are applied in `madagascar-db` (`d1_migrations`), and the three `#api-*` rows exist and are active (checked 2026-10-01) |
| cf-email-consumer `docs/program/ROADMAP.md` | P3 (dashboard addresses) "Not started" | cf-admin `0a31247` (2026-10-01) gave every Email Portal section an address and added the token panel, rotation and renewal |
| cf-admin [MAINTENANCE.md](../MAINTENANCE.md) | E-7 (composer senders) open | [Email Portal](../features/EMAIL-PORTAL.md) §0 says it was fixed in code on 2026-10-01, and closes once 0061 is applied. 0061 is applied |
| [Email Portal](../features/EMAIL-PORTAL.md) §3.3 and §5 | only To recipients are checked against the suppression list | To, Cc and Bcc are checked since cf-admin `d653e75` |
| `src/components/admin/emails/api-access/ApiTokenFormModal.tsx` | falls back to 30 a minute and 200 a day when settings have not loaded | the email service's code defaults are 10 and 50 (`cf-email-consumer/api/src/settings.ts`) |
| cf-vps rebuild runbook | Ubuntu 24.04 | the VPS runs 26.04 since 2026-09-30 |

## 9. Decisions for the owner

| # | Decision | Recommendation |
|---|---|---|
| O1 | Where the email service runs | **Workers**, as today. No move to the VPS; the VPS takes side jobs only (§4.7) |
| O2 | Plan | **Stay on Free**, per the standing ruling. Revisit Workers Paid if the consumer ever fails on CPU, or before the first outside client |
| O3 | Portable core | **Yes:** keep the API and consumer logic free of Cloudflare-only calls outside thin adapters (§4.7, step 3) |
| O4 | §5.1 must-haves | **Approve items 1 to 5 and 7** as the work before any outside token; items 6 and 8 to 10 are owner steps and decisions |
| O5 | One road for hotel mail (§5.1 item 7) | **Yes:** move the six direct senders onto the queue, starting with the sign-in alerts |
| O6 | Reselling (§5.1 item 10) | **Ask Brevo** about its agency or enterprise terms before any Velox client gets a token |
| O7 | API Access order | **§6.6**, starting with steps 1 and 2 |
| O8 | VPS side jobs | **Approve** the outside health check and canary (§5.2 item 16) as the first email job on the VPS |
| O9 | Permissions | **Adopt the capability catalog** of §7.2, with floors, the reduce-or-widen split and fresh sign-in, whichever home the Email API gets |
| O10 | Separate sidebar page | **Yes:** "Email API" next to the Email Portal, with its own page door |
| O11 | Where the code lives | **Y2:** a console owned by cf-email-consumer and framed in cf-admin, done now, before more §6 features are built. Y1 only if the API is to stay small and hotel-only (§7.5) |
| O12 | Who may open the page | **Admin and above**, with Admins holding read-only capabilities plus block and pause by default; or **Owner only**, as today |
| O13 | Worker shape | **A third, private Worker** (`cf-email-console`, no address). Never a console on `email.madagascarhotelags.com` (Y3) |
| O14 | Action keys that fail closed | **Fix maintenance item E-11 first:** it is a precondition for renaming or deactivating any key, and it protects the cron keys too |

**The owner's answers to O9 to O14 (2026-10-02, §7.7):** O9, five permissions instead of the catalog, with no fresh sign-in; O10, yes; O11, Y1, with the finer rules in the email service; O12, admins and above, holding view and respond; O13, no third Worker, ever; O14, done.

**Suggested overall order:**

1. the §5.1 fixes that are cheap and close real risks: items 4, 5, 6, 7 and 9, plus maintenance item E-11;
2. if O11 is approved, the move of §7.6 with the capability catalog, before any new API Access feature;
3. P2 (delivery status) alongside API Access steps 1 and 2, built in the new console;
4. P4 (protection and docs) alongside API Access step 3;
5. everything else as clients appear.

None of this needs the VPS, except item 16.

## 10. Sources

All fetched on 2026-10-01. Where a page showed a last-updated date, it is given.

**Cloudflare**

- [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) (updated 2026-09-05) and [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) (updated 2026-08-28)
- [Queues on the Workers Free plan](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/) (2026-02-04)
- [Queues limits](https://developers.cloudflare.com/queues/platform/limits/) and [Queues pull consumers](https://developers.cloudflare.com/queues/configuration/pull-consumers/)
- [D1 free-tier limit enforcement](https://developers.cloudflare.com/changelog/post/2026-09-01-d1-free-tier-limit-enforcement/) (2026-09-01) and [building an API to access D1](https://developers.cloudflare.com/d1/tutorials/build-an-api-to-access-d1/) (updated 2026-08-25)
- [Cloudflare API rate limits](https://developers.cloudflare.com/fundamentals/api/reference/limits/) (updated 2026-08-25)
- [Workers VPC](https://developers.cloudflare.com/workers-vpc/) (updated 2026-09-18)
- [Tunnel replicas and high availability](https://developers.cloudflare.com/tunnel/configuration/#replicas-and-high-availability)
- [Access service tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) (updated 2026-09-22)

**Oracle Cloud**

- [Always Free resources](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)
- [Free Tier FAQ](https://www.oracle.com/cloud/free/faq/)
- Oracle Cloud release notes, the change dated 2021-06-23: outbound port 25 is blocked by default for tenancies created after that date, with an exemption by service request. Not linked, because the note's address contains an id-shaped segment that the public mirror's redaction would rewrite.
- InfoQ on the [2026 Free Tier reduction](https://www.infoq.com/news/2026/07/oracle-cloud-free-tier-limits/). The dates come from press reports; Oracle changed only its documentation.

**Node.js**

- [Release schedule](https://github.com/nodejs/Release)
- [node:sqlite](https://nodejs.org/docs/latest-v26.x/api/sqlite.html), [TypeScript](https://nodejs.org/docs/latest-v26.x/api/typescript.html) and [permissions](https://nodejs.org/docs/latest-v26.x/api/permissions.html)
- [pg-boss](https://github.com/timgit/pg-boss)

**Brevo**

- [API limits](https://developers.brevo.com/docs/api-limits)
- [Pricing](https://www.brevo.com/pricing/)
- [Transactional webhooks](https://developers.brevo.com/docs/transactional-webhooks) and [securing webhooks](https://developers.brevo.com/docs/secured-webhooks)
- [Idempotency in batch sends](https://developers.brevo.com/docs/heterogenous-versions-batch-emails)
- [Email event report](https://developers.brevo.com/reference/getemaileventreport-1)
- [Sandbox mode](https://developers.brevo.com/docs/using-sandbox-mode)
- [Authorized IPs](https://help.brevo.com/hc/en-us/articles/5740111683858-Authorize-and-block-IP-addresses-for-API-and-SMTP-security)
- [Terms of use](https://www.brevo.com/legal/termsofuse/) (version of 2025-10-01)

**Resend**

- [Pricing](https://resend.com/pricing)
- [Rate limits](https://resend.com/docs/api-reference/rate-limit)
- [Idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
- [API keys](https://resend.com/docs/dashboard/api-keys/introduction)
- [Verifying webhooks](https://resend.com/docs/dashboard/webhooks/verify-webhooks-requests)

**Mailbox providers**

- Gmail [sender guidelines](https://support.google.com/a/answer/81126) and [FAQ](https://support.google.com/a/answer/14229414)
- Yahoo [best practices](https://senders.yahooinc.com/best-practices/)
- Microsoft, [Outlook's requirements for high-volume senders](https://techcommunity.microsoft.com/blog/microsoftdefenderforoffice365blog/strengthening-email-ecosystem-outlook%E2%80%99s-new-requirements-for-high%E2%80%90volume-senders/4399730) (updated 2025-04-30)

**Benchmarks**

- Postmark: [message streams](https://postmarkapp.com/message-streams) and [IP allow-listing](https://postmarkapp.com/developer/user-guide/ip-allowlisting)
- SendGrid: [API keys](https://www.twilio.com/docs/sendgrid/ui/account-and-settings/api-keys) and [sandbox mode](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/sandbox-mode)
- Mailgun: [API key roles](https://documentation.mailgun.com/docs/mailgun/user-manual/api-key-mgmt/rbac-mgmt)
- Amazon SES: [controlling access](https://docs.aws.amazon.com/ses/latest/dg/control-user-access.html) and [event publishing](https://docs.aws.amazon.com/ses/latest/dg/monitor-using-event-publishing.html)

**Standards**

- [OWASP API Security Top 10 (2023)](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [RFC 9457, Problem Details](https://www.rfc-editor.org/rfc/rfc9457.html)
- [IETF Idempotency-Key draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/) (expired)
- [IETF RateLimit header fields draft](https://datatracker.ietf.org/doc/draft-ietf-httpapi-ratelimit-headers/) (draft 11, active)
- [Standard Webhooks](https://github.com/standard-webhooks/standard-webhooks/blob/main/spec/standard-webhooks.md)
- [GitHub secret scanning partner program](https://docs.github.com/en/code-security/secret-scanning/secret-scanning-partnership-program/secret-scanning-partner-program)

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-01 | claude | code read of five repositories at the commits in §1; read-only queries on `madagascar-email-db`, `madagascar-db` and the Supabase ledger; Sentry issue search; official documentation | research record; findings as stated, with unconfirmed points marked |
| 2026-10-02 | claude | §7.7 only: the sign-in path (`computeAccessMap`, `createSession`), the KV writes in `src/`, both email Workers' `wrangler.toml`, the VPS agent's plan, Cloudflare's API token permissions page, and read-only queries on `madagascar-db` (`admin_pages`, `admin_page_overrides`, `d1_migrations`) | the owner's decisions and what was built, as stated |

## Related

- [Email API Access](../features/EMAIL-API-ACCESS.md) and [Email Portal](../features/EMAIL-PORTAL.md): the living docs for what exists.
- [VPS Console](../features/VPS-CONSOLE.md) and [Backup Console](../features/BACKUP-CONSOLE.md): the console and gateway pattern that §4.8 and §7 reuse.
- [2026-09-26 cron CPU incident](../operations/incidents/2026-09-26-cron-exceeded-cpu.md): the Free-plan CPU limit, and the owner's no-paid-plan ruling.
- [Brevo webhook runbook](../runbooks/brevo-webhook.md): who owns the live webhook.
- In cf-email-consumer, the design records `docs/specs/2026-09-30-email-platform-design.md` and `docs/specs/2026-10-01-email-api-v2-plan.md`, and `docs/program/ROADMAP.md`.
