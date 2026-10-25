---
title: "Flows: the consoles, scheduled jobs, email and every switch"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-25
verified_against: [code]
owner: harshil
related_code: [wrangler.toml, src/workers/cf-entry.ts, src/lib/backup-proxy.ts, src/lib/vps-proxy.ts, src/lib/email-console.ts, src/lib/console-signature.ts, src/pages/dashboard/backup/app/[...path].ts, src/pages/dashboard/vps/app/[...path].ts, src/lib/jobs/dispatch.ts, src/lib/jobs/control.ts, src/lib/jobs/runJob.ts, src/workers/scheduled-backup-tick.ts, src/lib/email/queue-mail.ts, src/workers/sync-revalidate-consumer.ts, src/lib/configuration.ts, src/lib/approvals/store.ts]
related_docs: [FLOWS-SIGN-IN-AND-CHECKS.md, ARCHITECTURE.md, PERMISSIONS-SYSTEM.md, ../features/BACKUP-CONSOLE.md, ../features/VPS-CONSOLE.md, ../features/EMAIL-API-ACCESS.md, ../features/CRON-CONTROL.md, ../operations/OPERATIONS.md]
tags: [architecture, flows, mermaid, consoles, jobs, email, settings]
---

# Flows: the consoles, scheduled jobs, email and every switch

> **TL;DR (for everyone):** the admin portal is the front door for several services. It
> forwards the Backups, Server and Email API screens to their own private services, runs every
> scheduled job on one five-minute timer, and hands every email to a queue that the email
> service sends. These pictures show each path, what is checked on the way, and where each
> on/off switch lives. How a person is signed in and checked first is in
> [FLOWS-SIGN-IN-AND-CHECKS](FLOWS-SIGN-IN-AND-CHECKS.md).

Binding names and the Worker's resources are listed in
[OPERATIONS](../operations/OPERATIONS.md) §1; this page names them only to show the paths.

## 1. The portal and its neighbours

```mermaid
flowchart LR
    U["Person on a phone"] --> ACC["Cloudflare Access"]
    ACC --> P["cf-admin Worker<br/>(secure.madagascarhotelags.com)"]
    subgraph STORES["Stores the portal reads and writes"]
        KV[("KV: sessions,<br/>revocation flags, marks")]
        D1[("D1: pages, overrides,<br/>audit log, settings rows,<br/>job control")]
        SB[("Supabase: user directory,<br/>email log")]
        R2[("R2: staff storage")]
    end
    P --> KV
    P --> D1
    P --> SB
    P --> R2
    subgraph PRIVATE["Private services, reached only by service binding"]
        BK["cf-backup<br/>binding BACKUP"]
        VP["cf-vps<br/>binding VPS"]
        EA["cf-email-api Console<br/>binding EMAIL_CONSOLE"]
    end
    P -->|"signed actor header"| BK
    P -->|"signed actor header"| VP
    P -->|"signed actor header"| EA
    P -->|"revalidate, health checks"| AS["cf-astro<br/>binding ASTRO_SERVICE"]
    P -->|"chat proxy"| CB["cf-chatbot<br/>binding CHATBOT_SERVICE"]
    P -->|"EMAIL_QUEUE"| EQ[["Email queue"]]
    EQ --> EC["cf-email-consumer"] --> MAIL["Brevo, Resend as failover"]
    P -->|"SYNC_QUEUE"| SQ[["Revalidation queue"]] --> P
    CRON["Cron: every 5 minutes,<br/>Sunday 02:00 UTC"] --> P
    P -.-> SEN["Sentry and Workers logs"]
```

The three private services have no public address of any kind, so the service binding is the
only way in. That is why they may trust the actor header the portal attaches: nothing else can
send one. Since permissions item #33 the portal also signs that header once
`CONSOLE_SIGNING_KEY` is set on both sides (section 3).

## 2. A console screen: the Backups and Server gateways

```mermaid
sequenceDiagram
    autonumber
    participant B as Console in a frame
    participant P as Portal pipeline
    participant G as Gateway route
    participant S as cf-backup or cf-vps
    participant D as D1 audit log
    B->>P: Request under /dashboard/backup/app/ or /dashboard/vps/app/
    P->>P: Access, session, role re-check, page map (as for any page)
    P->>G: Allowed
    G->>G: The console's own page key in the map?<br/>(mayUseBackupConsole, mayUseConsole)
    G->>G: A plain console path? Otherwise 404
    G->>G: Server only: notice accepted this session?
    G->>G: Change: same origin, and not a read-only role
    G->>G: Server only: log retention change? Hold for a second person
    G->>G: Keep allow-listed headers, drop the browser's actor headers
    G->>S: Forward with x-*-actor, request id, signature
    S-->>G: Answer, with x-*-audit for a change
    G->>G: Strip Set-Cookie, stream the body
    G-->>B: The answer, or a fixed-words error page
    G-)D: One audit row per change: reached yes, no or unknown
    G-)S: Backups only: wake the backup-tick job
```

The gateways (`src/pages/dashboard/backup/app/[...path].ts`, `src/pages/dashboard/vps/app/[...path].ts`)
know a path prefix, a header list and the audit call, nothing about backups or servers. The
console key must itself be in the person's map: it is never inherited from `/dashboard`, a
staff-level row, so a missing registry row can never open a root shell. What each person may do
inside the console is decided by the console itself
([cf-backup plan of record 13](../program/cf-backup/13-access-control.md),
`cf-vps/documentation/security/PERMISSIONS.md`).

The Server gateway adds two things: the browser terminal's WebSocket upgrade, allowed only under
`/dashboard/vps/app/api/terminal/`, with an exact Origin check and audited once as
`terminal.open`; and a long timeout for server actions (65 s to the headers, against 10 s for
Backups).

## 3. The signed actor header

```mermaid
flowchart TD
    U["locals.user from the session"] --> A["userActor:<br/>v, kind user, userId, email, role,<br/>signedInAt = confirmedAt(user), requestId"]
    A --> E["Unpadded base64url JSON<br/>in x-backup-actor, x-vps-actor or x-email-actor"]
    E --> K{"CONSOLE_SIGNING_KEY set<br/>on the portal?"}
    K -->|"yes"| S["HMAC-SHA256 over the label, time,<br/>method, URL and the identity headers,<br/>in x-*-signature"]
    K -->|"no"| N["Unsigned, as before item #33"]
    S --> W["The console checks it:<br/>within 60 seconds, same key"]
    N --> W2["The console accepts it only<br/>while it has no key itself"]
    W -->|"wrong or old"| X(["400 bad_signature"])
    W -->|"good"| OK(["The console decides capabilities"])
    W2 --> OK
```

`signedInAt` is the later of the real sign-in and an emailed code, so a console's 10-minute rule
follows the portal's with no change of its own
([FLOWS-SIGN-IN-AND-CHECKS](FLOWS-SIGN-IN-AND-CHECKS.md) §9). The backup-tick job sends a
`system` actor instead (`kind: system`, `job: backup-tick`), which cf-backup accepts only on its
`/internal/*` endpoints. The Email API console's actor also carries the person's Email API
capabilities (`emailApiCaps`), worked out in the portal.

## 4. Scheduled work: one timer, many jobs

```mermaid
flowchart TD
    C(["Cron trigger: */5 or Sunday 02:00 UTC"]) --> SCH["scheduled handler<br/>(cf-entry.ts)"]
    SCH --> RC["Read the cron-control row once"]
    RC --> LOOP["For each job registered for this cron"]
    LOOP --> DJ{"decideJobRun"}
    DJ -->|"halt in force"| H1["halted"]
    DJ -->|"job paused, not lapsed"| H2["paused"]
    DJ -->|"not essential and D1 under pressure"| H3["shed"]
    DJ -->|"its interval not yet passed"| H4["interval"]
    DJ -->|"asleep until its own next due time"| H5["sleeping"]
    DJ -->|"run"| INV["Call JobRunner through the Worker's<br/>own loopback binding:<br/>one invocation, its own 10 ms CPU"]
    H1 & H2 & H3 & H4 & H5 --> REC["Recorded in Analytics Engine,<br/>no invocation"]
    INV --> GATE{"Gate: the job's settings say<br/>there is work?"}
    GATE -->|"no"| SKIP["skipped"]
    GATE -->|"yes, or the gate failed"| LEASE{"Lease needed and held<br/>by another run?"}
    LEASE -->|"held"| LH["lease-held"]
    LEASE -->|"free, or no lease"| RUN["Run under a D1 meter"]
    RUN --> REP["Report: outcome, D1 use,<br/>over budget, next due time"]
    REP --> STAMP["One write: interval clocks<br/>and next due times"]
    SKIP --> STAMP
    LH --> STAMP
```

The account has five cron slots, so the portal uses two and multiplexes every job inside them
(`src/lib/jobs/`). Each due job runs in its own invocation since the 2026-09-26 CPU incident, so
one slow job fails alone. Every step after the decision fails open: a gate or lease that errors
still runs the job, because missed work is worse than one extra run. Essential jobs (the
Cloudflare Access sync, booking retries, the backup tick, health checks and others) are never
shed automatically; a person can still pause any job from Cron Control, which is audited
([ARCHITECTURE](ARCHITECTURE.md) §7, [CRON-CONTROL](../features/CRON-CONTROL.md)).

## 5. The backup tick: the portal's timer lent to cf-backup

```mermaid
sequenceDiagram
    autonumber
    participant J as backup-tick job (portal)
    participant B as cf-backup
    participant SB as Supabase email log
    participant Q as Email queue
    J->>B: POST /internal/tick as system actor backup-tick
    B-->>J: Scheduled, reconciled, chores, alerts, awaitingDelivery, nextTickAt
    loop Each alert offered
        J->>SB: Write its email_audit_logs row (queued)
        J->>Q: template_email or custom_email
    end
    J->>B: POST /internal/alerts/ack with the ids queued
    opt Alerts waiting for news
        J->>SB: Read those rows
        J->>B: POST /internal/alerts/delivery
    end
    J->>J: Next due time = nextTickAt (at most 60 minutes)
    Note over J: A change through the Backups gateway<br/>wakes the job again at once
```

cf-backup has no cron trigger of its own: the portal calls it. It answers when it next has work,
so a quiet day costs a call an hour, not 288. An alert that was not acknowledged is offered
again on the next tick; the email service's idempotency key makes a repeat harmless
(`src/workers/scheduled-backup-tick.ts`).

## 6. Email from the portal

```mermaid
flowchart LR
    F["A feature: access change, approval,<br/>sign-in alert, email code, backup alert,<br/>a message written on the Email page"] --> QS["queueSystemEmail or<br/>the Email page's send"]
    QS --> Q[["EMAIL_QUEUE"]]
    Q --> CON["cf-email-consumer:<br/>a lease per message key,<br/>no double send"]
    CON --> BR{"Brevo answers?"}
    BR -->|"yes"| SENT["Sent"]
    BR -->|"no"| RS["Resend failover"] --> SENT
    CON --> LOG[("Supabase email_audit_logs:<br/>queued, sent, failed, bounced")]
    CON -->|"last retry failed"| DLQ["Dead letter: durable copy,<br/>then acknowledged"]
```

The portal never calls an email provider directly: it puts a message on the queue and the email
service sends it, retries it, and records it. The Email Log page reads `email_audit_logs`.
How a message is sent, retried and failed over is owned by cf-email-consumer
(`cf-email-consumer/docs/features/CONSUMER.md`).

## 7. Website content: the revalidation queue

```mermaid
flowchart LR
    PUB["Publish in the CMS or Blog Studio"] --> FAST{"Revalidate cf-astro now<br/>(ASTRO_SERVICE)"}
    FAST -->|"worked"| DONE(["Done"])
    FAST -->|"failed"| OB["sync_outbox row,<br/>message on SYNC_QUEUE"]
    OB --> CQ["Queue consumer in this Worker:<br/>try again with backoff"]
    CQ -->|"worked"| DONE2(["Row marked done"])
    CQ -->|"retries used up"| DL["Dead-letter queue:<br/>row marked dead, visible"]
```

`src/workers/sync-revalidate-consumer.ts` never throws out of the handler, so one bad message
cannot retry the whole batch.

## 8. Every switch and flag, and where it lives

| Switch | Where it lives | Who changes it | What it does |
|---|---|---|---|
| `API_DENY_MODE` | `wrangler.toml` variable | a deploy | `enforce` refuses an API call the page map does not allow; `shadow` only records it. Production is `enforce` |
| `SESSION_REFRESH_INTERVAL_MS`, `SESSION_MAX_LIFETIME_MS` | `wrangler.toml` variables | a deploy | How often a session re-checks the directory (30 minutes) and its hard end (24 hours) |
| `CONSOLE_SIGNING_KEY` | Worker secret, same value on the consoles | the owner | Present: every console request is signed and checked. Absent: unsigned, as before |
| Page registry and overrides | D1 `admin_pages`, `admin_page_overrides` | Page Registry, Users, access requests | Who may open each page and action key; an override can end on a date |
| `revoked:<userId>`, `revoked-session:<id>` | KV, 24 hours | force-kick, deactivate, delete, lock out | Ends sessions at once and refuses sign-in while set |
| `authz-changed:<userId>` | KV | any permission change | The next request re-reads role and map; nobody is signed out |
| Session fields: `codeConfirmedAt`, `testingPassUntil`, `vpsNoticeVersion` | KV session record | the person (email code, testing pass, server notice) | A recent-sign-in proof; Vendor support's testing pass; the server notice accepted |
| `cron-control` | D1 `admin_portal_settings` row | Cron Control page | Halt everything (with an end), pause one job, throttle intervals, wake a job |
| A job's gate keys | D1 `admin_portal_settings` rows | each feature's page | Lets a job skip a tick with no work (read once per run) |
| `approvals:pending` | D1 `admin_portal_settings` row | the two-person rule | Changes waiting for a second person, 3 days each |
| Configuration catalog (`custom_email_max_recipients`, `blog-suggestions-enabled`, `blog-suggestions-max-pending`) | D1 `admin_portal_settings` rows, named in `src/lib/configuration.ts` | Configuration page | Portal-wide limits and toggles; every other setting lives on its feature's page |
| `backup:*` rows | D1 `admin_portal_settings` | the Backups console | cf-backup's config, status, access policy and key registry (cf-backup reads and writes them) |
| `vps:access` | D1 `admin_portal_settings` | the Server console's Access page | cf-vps role defaults and per-person grants |

Settings live in D1, never in new environment variables (RULE #0.8). The three variables above
predate that rule and are deploy-time on purpose.

## Verification log

| Date | Who | What was checked | Result |
|---|---|---|---|
| 2026-10-25 | claude | Every diagram against the code named in it: `wrangler.toml` bindings, queues and crons; `backup-proxy.ts`, `vps-proxy.ts`, `email-console.ts`, `console-signature.ts`; both gateway routes' rule lists; `jobs/dispatch.ts`, `jobs/control.ts` `decideJobRun`, `jobs/runJob.ts`; `scheduled-backup-tick.ts`; `sync-revalidate-consumer.ts`; `configuration.ts`, `approvals/store.ts`, `CronControlRepository.ts`; the email path against cf-email-consumer's `main.md`. Every mermaid block parsed with mermaid 11.4.1. Not checked: GitHub's own renderer, the live settings rows | pass |
