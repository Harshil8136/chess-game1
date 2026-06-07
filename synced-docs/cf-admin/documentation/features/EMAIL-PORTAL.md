---
title: "Email Portal"
status: active
audience: [non-technical, ai, technical, operator]
last_verified: 2026-06-07
verified_against: [code]
owner: harshil
related_code:
  - src/pages/dashboard/emails/index.astro
  - src/components/admin/emails/_components/EmailPortal.tsx
  - src/pages/api/emails/send.ts
  - src/pages/api/emails/cancel.ts
  - src/pages/api/emails/drafts.ts
  - src/pages/api/emails/templates.ts
  - src/pages/api/emails/attachments.ts
  - src/pages/api/audit/emails.ts
related_docs:
  - ../architecture/ARCHITECTURE.md
  - ../architecture/plac-and-audit.md
  - USER-MANAGEMENT.md
  - DASHBOARD.md
  - ../operations/OPERATIONS.md
  - ../security/SECURITY.md
tags: [feature, email, queue, resend, plac, rbac]
---

# Email Portal

> **TL;DR (non-technical):** A staff screen at `/dashboard/emails` for composing
> and sending custom emails from the hotel's own address — with attachments,
> reusable templates, saved drafts, scheduled delivery, and a live delivery-status
> board. Every send is rate-limited, access-controlled, and recorded so we always
> know who sent what, to whom, and whether it arrived.

> **Status:** Production Active
> **Surface:** `/dashboard/emails` (cf-admin) — RBAC role floor + PLAC gated
> **Role floor:** Admin or higher (`admin`, `super_admin`, `owner`, `dev`)
> **Last Updated:** 2026-06-07

> **Audience note:** This document is an architecture-level overview for AI IDE agents
> and contributors. It omits environment-specific values — resource IDs, account
> identifiers, secret values, and DDL live only in infrastructure config, never here.

---

## 1. Context / Scope

The Email Portal is the operator surface for **outbound custom email**. It does **not**
handle transactional auth email (CF Access OTP, Supabase GoTrue recovery — see
[USER-MANAGEMENT.md](USER-MANAGEMENT.md)) nor the automated security-alert fan-out
emitted by the scheduled log-sync worker (see
[OPERATIONS.md](../operations/OPERATIONS.md) §"Email fan-out"). Those paths predate
this feature and remain separate.

What the portal covers:

- **Compose & send** a custom HTML email from a verified `@madagascarhotelags.com`
  address, with optional CC/BCC and file attachments.
- **Schedule** a send up to 30 days in the future, and **cancel** a scheduled send.
- **Drafts** — per-operator work-in-progress saved in D1.
- **Templates ("Presets")** — shared, reusable subject + HTML bodies in D1.
- **Queue Logs** — a per-message delivery timeline read from the Supabase email
  ledger, including provider webhook events.

This doc deliberately does **not** cover the external consumer worker's internals
(see [`cf-email-consumer/README.md`](../cf-email-consumer/README.md), a
separate repo) beyond the contract this app depends on.

---

## 2. Architecture / How it works

Sending is **decoupled** from the provider call: cf-admin never blocks the operator's
request on Resend. It writes a ledger row, enqueues a job, and returns. An external
consumer worker drains the queue and talks to Resend; provider webhooks then update
the same ledger row, which the Queue Logs tab reads back.

```
 Operator (Email Portal island)
        │  POST /api/emails/send
        ▼
 cf-admin API  ──①── validate (role floor · PLAC · rate limit · recipient cap ·
        │             sender domain · schedule window · attachment gates)
        │
        ├──②── INSERT email_audit_logs  (Supabase — status: queued|scheduled)
        │
        └──③── EMAIL_QUEUE.send(job)    (Cloudflare Queue "madagascar-emails")
                      │
                      ▼
        cf-astro-email-consumer  (external worker, repo cf-email-consumer)
                      │  calls Resend API (carries Sentry trace headers)
                      ▼
                   Resend  ──④── delivery webhooks ──▶ update email_audit_logs
                                                       (status + delivery_events)
                      ▲
        Queue Logs tab ─⑤─ GET /api/audit/emails?purpose=custom_email
                            (reads the ledger row + delivery_events timeline)
```

**Why a queue.** Resend calls are pushed off the request lifecycle so a slow or
failing provider never degrades the admin UI, and bursts are smoothed. The
producer binding (`EMAIL_QUEUE` → `madagascar-emails`) is declared in
`wrangler.toml`; the consumer lives in a separate worker/repo. See
[OPERATIONS.md](../operations/OPERATIONS.md) §Queues.

**Local dev has no consumer.** When `import.meta.env.DEV` is set, `send.ts` runs an
inline emulation (`runLocalDispatch`) that resolves attachments from local R2, calls
Resend directly, and writes **mock** `email.sent` / `email.delivered` events so the
Queue Logs timeline is testable without the queue or webhooks. This branch is
`DEV`-only and never runs in production.

**Three stores, three jobs:**

| Store | Binding | Holds | Scope |
|-------|---------|-------|-------|
| Supabase Postgres | `email_audit_logs` | the central delivery ledger (status, payload, `resend_id`, `delivery_events`) | shared with cf-astro |
| D1 | `admin_email_drafts` | per-operator composer drafts | cf-admin |
| D1 | `admin_email_templates` | shared template presets | cf-admin |
| R2 (`IMAGES`) | `email-attachments/` prefix | uploaded attachment blobs | shared bucket, private prefix |

---

## 3. User Interface

`/dashboard/emails` renders a single Preact island, `EmailPortal`, with four tabs.
The page sits in the **TOOLS** sidebar section (`deriveSection` in
`src/lib/auth/plac.ts`).

| Tab | Component | Purpose |
|-----|-----------|---------|
| **Composer** | `Composer` + `RichEditor` | From-prefix selector, To/CC/BCC chips, subject, contenteditable HTML body, attachment uploader, schedule toggle. Actions: Send, Save Draft, Save as Preset. |
| **Drafts** | `DraftsPanel` | List the operator's own drafts; load one back into the composer or delete it. |
| **Presets** | `TemplatesPanel` | List shared templates; apply one to the composer, create a new one, or delete (delete/create gated). |
| **Queue Logs** | `QueueTracker` | Per-message delivery timeline with status legend (Delivered / Queued / Scheduled / Failed / Cancelled). Only rendered when the operator holds `#queue-logs`. |

All cross-island feedback uses a single toast HUD. Destructive actions (delete
draft/template, cancel schedule) confirm first. The **Queue Logs** tab is hidden
entirely for operators without the capability — and the API enforces the same gate,
so the tab and its data cannot drift apart.

---

## 4. Access Control (RBAC + PLAC)

Every entry point is gated by the platform's two-engine model
([plac-and-audit.md](../architecture/plac-and-audit.md)):

- **RBAC role floor** — `admin`, `super_admin`, `owner`, or `dev`. `staff` cannot
  reach any email endpoint.
- **PLAC** — Page-Level Access Control with **fragment sub-capabilities** on the
  page path. Each capability defaults to **granted** unless an explicit deny exists
  (`accessMap[...] === false`); **deny always wins**. The page resolves them once in
  `src/pages/dashboard/emails/index.astro` and passes a `permissions` object to the
  island; the API routes re-check independently via `placDenyResponse`.

| Capability (PLAC anchor)            | Grants                                                        |
|-------------------------------------|--------------------------------------------------------------|
| `/dashboard/emails`                 | See the portal; read drafts and templates                    |
| `…#compose`                         | Send and cancel emails                                        |
| `…#attachments`                     | Attach files to a send                                       |
| `…#templates`                       | Create / update / delete shared template presets             |
| `…#custom-sender`                   | Send from a non-default alias (prefix other than `info`/`booking`) |
| `…#bulk-send`                       | Send to more than one recipient in a single message          |
| `…#queue-logs`                      | View the delivery-queue timeline                             |

**DEV/OWNER bypass.** `dev` and `owner` bypass the per-hour send rate limit and the
recipient-count cap. All other gates still apply to them.

The Queue Logs data route (`GET /api/audit/emails?purpose=custom_email`) additionally
hard-checks `#queue-logs` and is served out of the shared `/dashboard/logs` ledger
endpoint, so it inherits the logs-page deny semantics too.

---

## 5. Send pipeline & validation

`POST /api/emails/send` applies these checks **in order**; the first failure returns a
specific status and message (no throws leak to the client):

1. **Auth + role floor** — `requireAuth`, then `admin`+ (`401` / `403`).
2. **PLAC `#compose`** — explicit deny → `403`.
3. **Rate limit** — `10` sends / `1 hour` per user (Upstash limiter, key
   `custom-emails`); `429` with `X-RateLimit-*` headers. Bypassed for `dev`/`owner`.
4. **Bindings present** — `DB` and `EMAIL_QUEUE` (`500` if missing).
5. **Body + required fields** — `to`, `subject`, `html` (`400`).
6. **Recipient cap** — total of `to + cc + bcc` must be ≥ 1 and ≤
   `custom_email_max_recipients` (a `PortalSettingsRepository` setting, default `10`);
   over-cap → `400` (bypassed for `dev`/`owner`).
7. **Bulk PLAC** — more than one recipient requires `#bulk-send`.
8. **Sender domain** — the resolved `from` must end with `@madagascarhotelags.com`;
   prefixes `info` and `booking` are open, **any other prefix requires
   `#custom-sender`**. Default sender is `SENDER_EMAIL` (falls back to
   `info@madagascarhotelags.com`).
9. **Attachments PLAC** — any attachment requires `#attachments`.
10. **Schedule window** — `scheduledAt`, if present, must be a valid future timestamp
    within **30 days** (`400` otherwise).

On success: a `trackingId` (UUID) is generated, the ledger row is inserted
(`status: queued` or `scheduled`, recipient + hashed sender IP + full payload), the
job is enqueued with Sentry trace/baggage headers for distributed tracing, and a
post-response Ghost Audit entry is written (`module: logs`, `targetType: custom_email`)
via `ctx.waitUntil` — zero added latency. See
[plac-and-audit.md](../architecture/plac-and-audit.md) for the audit engine.

### Attachments

`POST /api/emails/attachments` (multipart) uploads one file to the `IMAGES` R2 bucket
under `email-attachments/<uuid>/<filename>`, returning the R2 key the composer then
references. Limits: **5 MB** per file (`400` over), rate limit `20` uploads / `1 min`
(key `email-attachments-upload`). Requires the role floor + page PLAC.

### Scheduling & cancellation

A scheduled send lands in the ledger with `status: scheduled` and is dispatched to
Resend with a future `scheduledAt`. `POST /api/emails/cancel` (PLAC `#compose`) looks
up the row, refuses anything not currently `scheduled`, calls Resend's
`/emails/{resend_id}/cancel`, and flips the ledger row to `cancelled` (audited). It
requires a stored `resend_id`, so a job can only be cancelled once the consumer has
registered it with Resend.

---

## 6. Drafts & Templates

| | Drafts (`admin_email_drafts`) | Templates (`admin_email_templates`) |
|---|---|---|
| Scope | **Per operator** (`WHERE user_id = ?`) | **Shared** (global list) |
| Read | page PLAC | page PLAC |
| Write | page PLAC (owner-scoped rows) | **`#templates`** |
| Audited | no | yes (create/update/delete → Ghost Audit) |
| Fields | sender/recipient/subject/`body_html`/cc/bcc/attachments(JSON)/`updated_at` | name/subject/`body_html`/`created_by` |

Drafts persist via the explicit **Save Draft** action (create or update keyed on the
active draft id). *(The composer's helper copy mentions 15-second autosave; the
current implementation saves on demand, not on a timer — tracked in
[MAINTENANCE.md](../MAINTENANCE.md).)*

---

## 7. Queue Logs (delivery tracking)

The Queue Logs tab calls `GET /api/audit/emails?purpose=custom_email`, which reads the
Supabase `email_audit_logs` ledger and returns each row's `status`, `resend_id`,
`email_error`, full `payload`, and the `delivery_events` array (provider webhook
timeline). The tab requests `cache: no-store` so operators see live status.

- **Access:** role floor + page PLAC + a hard `#queue-logs` check; the route is the
  same one the Activity Center's Email Log tab uses, so it also honors
  `/dashboard/logs` denies for `super_admin`+.
- **Statuses:** `queued` → `sent_to_resend`/`sent` → `delivered`, plus `scheduled`,
  `failed`, `bounced`, `cancelled`.
- **Deletion:** `DELETE /api/audit/emails` is **DEV/OWNER-only** (bulk by id),
  audited. See [USER-MANAGEMENT.md](USER-MANAGEMENT.md) for the logs-route guard map.

---

## 8. Key code paths

- Page + PLAC resolution → `src/pages/dashboard/emails/index.astro`
- Island shell + tabs → `src/components/admin/emails/_components/EmailPortal.tsx`
- Composer / editor → `src/components/admin/emails/_components/Composer.tsx`,
  `src/components/admin/emails/atoms/RichEditor.tsx`
- Send + validation + enqueue + local-dev emulation → `src/pages/api/emails/send.ts`
- Cancel scheduled → `src/pages/api/emails/cancel.ts`
- Drafts CRUD (D1) → `src/pages/api/emails/drafts.ts`
- Templates CRUD (D1) → `src/pages/api/emails/templates.ts`
- Attachment upload (R2) → `src/pages/api/emails/attachments.ts`
- Queue-log read/delete (Supabase) → `src/pages/api/audit/emails.ts`
- Recipient-cap setting → `src/lib/dal/PortalSettingsRepository.ts`
  (`custom_email_max_recipients`)
- Sidebar section routing (`/dashboard/emails` → TOOLS) → `src/lib/auth/plac.ts`
  (`deriveSection`)

---

## 9. Configuration / Bindings

Names only — never values. See [OPERATIONS.md](../operations/OPERATIONS.md) for the
canonical registry.

| Binding / var | Kind | Role in the portal |
|---------------|------|--------------------|
| `EMAIL_QUEUE` → `madagascar-emails` | Cloudflare Queue (producer) | Decouples Resend from the request; drained by the external consumer |
| `DB` | D1 | Drafts, templates, Ghost Audit rows, recipient-cap setting |
| `IMAGES` | R2 bucket | Attachment storage under `email-attachments/` |
| `SESSION` | KV | Session + PLAC access map (auth) |
| `RESEND_API_KEY` | secret | Provider key — cancellation and DEV-only local emulation (production sends go through the consumer) |
| `SENDER_EMAIL` | var | Default `from`; must be on `@madagascarhotelags.com` |
| `ADMIN_EMAIL` | var | Platform contact address |
| Upstash Redis (`UPSTASH_REDIS_REST_*`) | secret | Backs the send + upload rate limiters |

---

## 10. Operational notes / Runbook

- **Provider misconfig is fail-soft on cancel/dev only.** Production sends never call
  Resend in-request; a Resend outage delays delivery (jobs stay queued) but does not
  error the operator's send.
- **Schema provisioning gap.** `admin_email_drafts`, `admin_email_templates`, the
  `/dashboard/emails` PLAC page seed, and the `custom_email_max_recipients` portal
  setting are referenced by code but have **no migration file** under `migrations/`.
  They must be provisioned out-of-band until a migration is added — tracked in
  [MAINTENANCE.md](../MAINTENANCE.md). If drafts/templates 500 with a missing-table
  error, this is the cause.
- **Recipient cap is a runtime setting**, not a constant — adjust
  `custom_email_max_recipients` in portal settings rather than editing code.
- **Attachments are private.** They live under a private R2 prefix and are resolved
  server-side by the consumer (or the dev emulator); the portal stores only the R2
  key, never a public URL.
- **Ledger is the source of truth for "did it send".** The composer's success toast
  means *enqueued*, not *delivered* — confirm final state in Queue Logs.

---

## 11. Verification log

| Date       | Checked by | Method                         | Result |
|------------|-----------|--------------------------------|--------|
| 2026-06-07 | claude    | code read (`src/pages/api/emails/*`, `src/components/admin/emails/*`, `wrangler.toml`, `src/env.d.ts`) | pass — schema-provisioning gap noted in §10 |

---

## 12. Related

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Lean Edge stack, request lifecycle, DAL pattern
- [plac-and-audit.md](../architecture/plac-and-audit.md) — PLAC resolution + Ghost Audit Engine
- [USER-MANAGEMENT.md](USER-MANAGEMENT.md) — RBAC hierarchy, logs-route guard map (incl. `api/audit/emails.ts`)
- [DASHBOARD.md](DASHBOARD.md) — Email Queue health widget + Resend delivery stats
- [OPERATIONS.md](../operations/OPERATIONS.md) — bindings, queue, secrets registry, free-tier limits
- [SECURITY.md](../security/SECURITY.md) — CSRF, session model, security posture
- [`cf-email-consumer/README.md`](../cf-email-consumer/README.md) — external queue-consumer worker (separate repo)
</content>
</invoke>
