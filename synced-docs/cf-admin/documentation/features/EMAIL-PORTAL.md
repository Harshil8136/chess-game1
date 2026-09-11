---
title: "Email Portal"
status: active
audience: [non-technical, ai, technical, operator, owner]
last_verified: 2026-09-11
verified_against: [code, infra]
owner: harshil
related_code:

- src/pages/dashboard/emails/index.astro
- src/components/admin/emails/_components/EmailPortal.tsx
- src/components/admin/emails/_components/Composer.tsx
- src/components/admin/emails/_components/BrevoTelemetryView.tsx
- src/components/admin/emails/_components/ContactsSuppressionsView.tsx
- src/components/admin/emails/_components/[SUPABASE_PROJECT_REF].tsx
- src/components/admin/emails/_components/DraftsManagerView.tsx
- src/components/admin/emails/_components/[SUPABASE_PROJECT_REF].tsx
- src/components/admin/emails/_components/ManageSenderModal.tsx
- src/components/admin/emails/_components/DnsDiagnosticModal.tsx
- src/components/admin/emails/_components/WebhookTestModal.tsx
- src/components/admin/emails/_components/AiGeneratorModal.tsx
- src/components/admin/emails/_components/QueueLogItem.tsx
- src/components/admin/emails/atoms/SenderSelect.tsx
- src/pages/api/emails/send.ts
- src/pages/api/emails/engine.ts
- src/pages/api/emails/senders.ts
- src/pages/api/emails/suppressions.ts
- src/pages/api/emails/dns-check.ts
- src/pages/api/emails/ai-generate.ts
- src/pages/api/emails/unsubscribe.ts
- src/pages/api/emails/webhook.ts
- src/lib/dal/EmailSuppressionRepository.ts
- src/lib/email/sanitize-html.ts
- src/lib/email/unsubscribe.ts
related_docs:
- ../architecture/ARCHITECTURE.md
- ../architecture/plac-and-audit.md
- USER-MANAGEMENT.md
- DASHBOARD.md
- ../operations/OPERATIONS.md
- ../security/SECURITY.md
- ../runbooks/brevo-webhook.md
tags: [feature, email, queue, brevo, plac, rbac, suppression, deliverability]

---

# Email Portal

> **TL;DR (non-technical):** A staff screen at `/dashboard/emails` for composing and
> sending email from the hotel's own addresses — with attachments, templates, drafts,
> scheduling and a delivery board. Since 2026-09-10 it also carries a Brevo control
> room: live sending quota, per-address sender permissions, an unsubscribe
> suppression list, DNS deliverability diagnostics, and an AI HTML generator.
> Every send is role-gated, rate-limited, sanitised, suppression-filtered and audited.

> **Status:** Production Active — **with one open P1 defect, see §0**
> **Surface:** `/dashboard/emails` (cf-admin)
> **Role floor:** canonical **Manager or above** (stored `admin`/`super_admin`/`owner`/`dev`)
> **Last verified against live code + D1 + Supabase:** 2026-09-11

---

## 0. OPEN DEFECT — sending is broken for Admin and Manager

> **Severity: P1. Verified live 2026-09-11. Not yet fixed.**

**Symptom.** A canonical **Admin** or **Manager** opens the portal, picks a sender
from the dropdown, writes an email, hits Send, and receives:

```
403 — Insufficient permissions. Only OWNER and VENDOR_SUPPORT roles
      can use unmapped custom sender aliases.
```

**Root cause — an asymmetric fallback between two routes:**

| Route | Reads `email_sender_identities` from D1 | Falls back to `DEFAULT_SENDER_IDENTITIES` when empty |
|---|---|---|
| `GET /api/emails/senders` (what the **dropdown** shows) | yes | **yes** — `senders.ts:94` |
| `POST /api/emails/send` (what **enforces**) | yes | **no** — `send.ts:133-141` |

The setting has **never been written**. Verified:

```sql
SELECT COUNT(*) FROM admin_portal_settings WHERE setting_key = 'email_sender_identities';
-- 0
```

Nothing seeds it — no migration creates it, and `senders.ts` only persists on the
`create`/`update`/`delete` POST actions (`senders.ts:282,340,395`). Its GET handler
substitutes the five defaults **in memory only**.

So `send.ts` sees `identities = []`, finds no match for any address, falls into the
unmapped-alias branch, and requires `isOwnerOrVendor` — which excludes precisely the
two roles the portal is built for.

**Who is affected right now** (live `admin_authorized_users`, 2026-09-11):

| Stored role | Canonical | Level | Can send today? |
|---|---|---|---|
| `dev` × 1 | `vendor_support` | 0 | ✅ yes |
| `owner` × 1 | `owner` | 1 | ✅ yes |
| `super_admin` × 1 | **`admin`** | 2 | ❌ **blocked** |
| `admin` × 1 | **`manager`** | 3 | ❌ **blocked** |
| `staff` × 2 | `staff` | 4 | ❌ blocked by the role floor (by design) |

**2 of 6 active accounts cannot send.** The owner can, which is why this was not
caught during acceptance.

**Why the test suite passed.** `test/api-email-senders.test.ts` covers `senders.ts`
— the route that *has* the fallback. No test exercises `send.ts` against an empty
`email_sender_identities`, which is the production state. The asymmetry is the bug
and the coverage gap is its mirror image.

**Three ways to fix, cheapest first:**

1. **Seed the setting** (no deploy). One `updateSetting` write of
   `DEFAULT_SENDER_IDENTITIES`, or any sender create/update in the UI as owner.
   Unblocks immediately; leaves the asymmetry for the next fresh environment.
2. **Give `send.ts` the same fallback** (one import + one line). Makes the two
   routes agree by construction. **Recommended** — this is the actual defect.
3. **Both**, plus a regression test asserting a Manager can send with the setting
   absent. This is what closes it permanently.

Tracked in [`../MAINTENANCE.md`](../MAINTENANCE.md). Until fixed, treat the sender
dropdown as showing addresses that only the owner can actually use.

---

## 1. Context / Scope

The Email Portal is the operator surface for **outbound custom email**. It does not
handle transactional auth email (CF Access OTP, Supabase GoTrue recovery — see
[USER-MANAGEMENT.md](USER-MANAGEMENT.md)) nor the automated security-alert fan-out
from the scheduled log-sync worker.

What it covers today:

- **Compose & send** custom HTML from a verified `@madagascarhotelags.com` address,
  with CC/BCC and attachments.
- **Schedule** up to 30 days out.
- **Drafts** — per-operator, autosaved.
- **Templates** — shared, reusable subject + HTML.
- **Queue Logs** — per-message delivery timeline from the Supabase ledger.
- **Brevo Engine** *(new 2026-09-10)* — live account telemetry, quota, settings.
- **Sender management** *(new)* — per-address RBAC clearance.
- **Suppressions** *(new)* — CAN-SPAM/GDPR unsubscribe list, enforced pre-send.
- **DNS diagnostics** *(new)* — live SPF/DKIM/DMARC inspection.
- **AI generator** *(new)* — Workers AI HTML drafting.

---

## 2. Architecture

Sending is **decoupled** from the provider: cf-admin never blocks the operator on
Brevo. It sanitises, filters, writes a ledger row, enqueues, and returns.

```
 Operator (Email Portal island)
        │  POST /api/emails/send
        ▼
 cf-admin API
        ├─① sanitize HTML            (HTMLRewriter — stored-XSS backstop)
        ├─② role floor · PLAC · rate limit · recipient cap
        ├─③ SENDER CLEARANCE         (per-address minRole)   ◄── §0 defect here
        ├─④ SUPPRESSION PARTITION    (drop unsubscribed, audit the drop)
        ├─⑤ INSERT email_audit_logs  (Supabase — queued|scheduled)
        └─⑥ EMAIL_QUEUE.send(job)    (Cloudflare Queue "madagascar-emails")
                      │
                      ▼
        cf-astro-email-consumer  (separate worker/repo) ──▶ Brevo
                      ▲
        Brevo webhooks ──▶ /api/emails/webhook ──▶ update delivery_events
                      ▲
        Queue Logs ─── GET /api/audit/emails?purpose=custom_email
```

Steps ① ③ and ④ are new as of 2026-09-10 and are the substantive security additions.

**Stores:**

| Store | Object | Holds |
|---|---|---|
| Supabase | `email_audit_logs` | delivery ledger (status, payload, `delivery_events`) |
| D1 | `admin_email_drafts` | per-operator drafts |
| D1 | `admin_email_templates` | shared templates |
| D1 | `admin_email_suppression` | unsubscribe list (PK `email`) |
| D1 | `admin_portal_settings` | engine settings + sender identities |
| R2 (`IMAGES`) | `email-attachments/` | attachment blobs, private prefix |

---

## 3. What shipped 2026-09-10 (commit `5781fb8`)

46 files, +8,049/−1,373. Five new operator surfaces and four new API routes.

### 3.1 Brevo Engine / telemetry — `BrevoTelemetryView.tsx` (1,192 lines)

Live panel reading `GET /api/emails/engine`, which calls Brevo v3 for account, plan,
domains, webhooks and 30-day aggregate stats, merged with D1 engine settings. Shows
daily/monthly quota consumption, plan type, latency, and whether the figures are live
or fallback (`isLiveBrevoData`). Also hosts the branding form (§6) and the
**Webhook Test** modal (`WebhookTestModal.tsx`), which posts a synthetic event to
verify the webhook path end to end.

`POST /api/emails/engine` dispatches three actions: `ping`, `sync_webhook`,
`save_settings`.

### 3.2 Sender management — `senders.ts` + `ManageSenderModal.tsx`

Replaces the old binary `#custom-sender` model with **per-address clearance**. Each
identity carries `{ id, name, email, minRole, active, department, isDefault }`.
`GET` merges D1 policy with live Brevo senders; `POST` supports
`create`/`update`/`delete`/`sync`, all audited, all Admin+.

Guardrails verified in code: external domains rejected; the primary `info@` identity
cannot be deleted (`senders.ts`, covered by test).

The five defaults (`DEFAULT_SENDER_IDENTITIES`, `senders.ts:19`):

| Address | Department | Min role (canonical) |
|---|---|---|
| `info@` | General Support | staff |
| `booking@` | Reservations Desk | staff |
| `admin@` | Executive & Ops | **admin** |
| `team@` | Guest Care | staff |
| `billing@` | Accounts & Billing | **manager** |

> These exist **only in code**. See §0 — they are not in D1, which is the defect.

### 3.3 Suppressions — `suppressions.ts` + `ContactsSuppressionsView.tsx`

A real compliance control, not a UI nicety. `EmailSuppressionRepository.partition()`
splits the recipient list **before the ledger write and before the enqueue**, so a
suppressed address never reaches the queue at all. If every recipient is suppressed
the send is refused with a clear error. Drops are written to the audit log with the
suppressed addresses in `context`.

Table `admin_email_suppression`: `email` (PK), `reason` (default `unsubscribe`),
`source` (default `one_click`), `actor_email`, `ip_hash`, `created_at`.
Live row count on 2026-09-11: **0** — the list works but nobody has unsubscribed yet.

Fed by `/api/emails/unsubscribe` (RFC 8058 one-click, added 2026-07-26 in `06d71af`)
and by manual add/remove in the UI. `buildUnsubscribeHeaders` attaches
`List-Unsubscribe` and `List-Unsubscribe-Post` to every send.

### 3.4 DNS deliverability — `dns-check.ts` + `DnsDiagnosticModal.tsx`

Live DNS-over-HTTPS queries against Cloudflare `1.1.1.1`, cross-referenced with
Brevo's domain-verification telemetry. Inspects SPF, DKIM and DMARC and reports what
is missing. Genuinely useful — deliverability failures are otherwise invisible until
mail starts landing in spam.

### 3.5 AI generator — `ai-generate.ts` + `AiGeneratorModal.tsx`

Cloudflare Workers AI (`env.AI.run`) drafts raw HTML email bodies into the composer.
Gated by the new `#ai-generate` PLAC anchor. Has its own quota route
(`ai-quota.ts`).

### 3.6 Workspace redesign

`EmailPortal.tsx` was restructured (−334/+334 net churn) into a workspace shell with
`[SUPABASE_PROJECT_REF]`, and the tab bodies split into `[SUPABASE_PROJECT_REF]`,
`DraftsManagerView` and `QueueLogItem`. `QueueTracker` shrank by ~50% as its row
rendering moved to `QueueLogItem`.

---

## 4. Access control — RBAC + PLAC

Two engines ([plac-and-audit.md](../architecture/plac-and-audit.md)): an RBAC role
floor, then Page-Level Access Control with fragment sub-capabilities. Each capability
defaults to **granted** unless an explicit deny exists; **deny always wins**. The page
resolves them once and passes a `permissions` object to the island; every API route
re-checks independently.

**All ten anchors, with the `required_role` actually stored in D1** (queried live
2026-09-11; shown in stored vocabulary with the canonical name in brackets):

| Capability | `required_role` in D1 | Grants |
|---|---|---|
| `/dashboard/emails` | `admin` [manager] | See the portal; read drafts and templates |
| `…#compose` | `admin` [manager] | Send email |
| `…#attachments` | `admin` [manager] | Attach files |
| `…#templates` | `admin` [manager] | Create/update/delete shared templates |
| `…#ai-generate` | `admin` [manager] | **(new)** AI HTML drafting |
| `…#preview` | `admin` [manager] | Preview and send a test copy to self |
| `…#contacts` | `admin` [manager] | Recent-recipient autocomplete |
| `…#bulk-send` | `super_admin` [admin] | More than one recipient per message |
| `…#custom-sender` | `owner` | Unmapped alias (see §0) |
| `…#queue-logs` | `owner` | Delivery-queue timeline |

**Sender clearance is a second, independent layer.** Even with `#compose`, the
`from` address must satisfy that identity's `minRole` (`send.ts:150-165`). An
unmapped address additionally requires `isOwnerOrVendor` **and** `#custom-sender`.

**Bypasses.** `owner` and `vendor_support` bypass the per-hour rate limit and the
recipient cap. They do **not** bypass PLAC denies, sanitisation or suppression.

---

## 5. Send pipeline — exact order

`POST /api/emails/send`, first failure wins:

| # | Check | Failure |
|---|---|---|
| 1 | `requireAuth` | 401 |
| 2 | `isAdmin` role floor (manager+) | 403 |
| 3 | PLAC `#compose` | 403 |
| 4 | Rate limit 10/hour/user (Upstash; owner+vendor bypass) | 429 + `X-RateLimit-*` |
| 5 | `DB` and `EMAIL_QUEUE` bindings | 500 |
| 6 | Zod `sendEmailSchema` | 400 |
| 7 | **HTML sanitisation** (`sanitizeEmailHtml`, HTMLRewriter) | — rewrites, never rejects |
| 8 | ≥1 recipient | 400 |
| 9 | Recipient cap (`custom_email_max_recipients`, live value **10**) | 400 |
| 10 | `#bulk-send` if >1 recipient | 403 |
| 11 | Domain must be `@madagascarhotelags.com` | 400 |
| 12 | **Sender clearance** by `minRole`, else owner/vendor + `#custom-sender` | 403 ← §0 |
| 13 | `#attachments`; cumulative size ≤ **25 MB** | 403 / 400 |
| 14 | Schedule window: future, ≤30 days | 400 |
| 15 | **Suppression partition**; all-suppressed → refuse | 400 |
| 16 | Ledger insert → enqueue with Sentry trace headers → Ghost Audit | — |

**Why sanitisation matters.** Templates and drafts are shared across operators of
differing privilege, so a lower-privileged author could otherwise plant active markup
that executes in a reviewer's browser. DOMPurify/jsdom crash workerd, so this uses
Workers-native `HTMLRewriter`.

---

## 6. Engine settings — what is real and what is not

`engine.ts` reads **eleven** settings. Only **one** exists in D1 (verified
2026-09-11); the other ten fall back to hardcoded defaults on every request.

| Setting | In D1? | Default in code | Consumed by the send path? |
|---|---|---|---|
| `custom_email_max_recipients` | ✅ `10` | `send.ts` 10 / `engine.ts` **100** ⚠ | **yes** |
| `email_sender_identities` | ❌ | none (`[]`) | **yes** — §0 defect |
| `brevo_daily_limit` | ❌ | 300 | no — display only |
| `brevo_monthly_limit` | ❌ | 9000 | no — display only |
| `brevo_track_opens` | ❌ | true | no |
| `brevo_track_clicks` | ❌ | true | no |
| `email_logo_url` | ❌ | site logo URL | no |
| `email_brand_color` | ❌ | `#3b82f6` | no |
| `email_footer_address` | ❌ | hardcoded street address | no |
| `email_support_phone` | ❌ | `+52 (449) 123-4567` | no |
| `email_reply_to` | ❌ | `info@…` | no |

Three honest observations:

1. **The branding panel persists settings nothing reads.** `email_logo_url`,
   `email_brand_color`, `email_footer_address`, `email_support_phone` and
   `email_reply_to` are written by `save_settings` and read back into the form — but
   `send.ts` reads only `custom_email_max_recipients` and `email_sender_identities`,
   and the queue payload does not carry them. The panel is **configured but not
   wired**. No customer has ever seen these values.
2. **`+52 (449) 123-4567` is a placeholder.** Harmless today precisely because of (1),
   but it must not be wired up as-is — it would put a fake phone number in customer
   mail, against RULE #0.5.
3. **The recipient-cap defaults disagree** — `send.ts` falls back to 10,
   `engine.ts` to 100. No live impact while the D1 row exists (both read `10`), but
   delete that row and the UI would advertise a cap ten times what is enforced.

**`brevo_api_key` is a dead read.** Six routes do
`settingsRepo.getSetting('brevo_api_key')` as a fallback to `env.BREVO_API_KEY`, but
nothing ever writes it and it is not in `KNOWN_SETTING_KEYS`. `getSetting` is
ungated, so each of those is a real D1 query that always returns `NULL` — six
wasted reads per portal interaction. (Also worth noting: a provider secret in a
settings table would be an anti-pattern; ROADMAP chunk 12 explicitly plans to move
credentials out of that table. The good news is nothing puts it there today.)

---

## 7. Usage allowance and scale

**Provider ceiling.** Brevo's free plan allows **300 emails/day** (~9,000/month),
which the code's defaults mirror exactly. The count resets daily and does not roll
over. Paid tiers start around **$9/month** (Starter, 5k emails/month).

**Platform ceilings, and which binds first:**

| Limit | Value | Binds at |
|---|---|---|
| Per-user send rate | 10/hour (owner/vendor exempt) | 240/day/user in theory |
| Recipients per message | 10 (D1 setting) | — |
| Attachment size | 25 MB cumulative per message | — |
| Brevo free plan | **300/day** | **the real ceiling** |
| Cloudflare Queue | 1M ops/month free | ~33k/day — not binding |
| D1 rows written | 100k/day free | not binding |

With 6 active accounts, the **provider's 300/day is the binding constraint**, and
only if all six sent ~50 messages daily. Actual volume is far below this: the portal
is used for occasional operator correspondence, not campaigns.

**What would change the picture.** Bulk sending to a guest list — a seasonal
promotion to a few hundred contacts — would hit 300/day immediately. That is the
trigger to move to Starter, not a code change.

---

## 8. Where it is used today, and what it is for next

**Current, verified from the live ledger and settings:**

- Operator-to-guest correspondence from `info@` / `booking@` (ad-hoc, low volume).
- Manual follow-up on bookings, alongside the automated booking confirmations that
  run through the *same* queue but a *different* producer (cf-astro).
- Delivery troubleshooting — Queue Logs is the only place a human can see whether a
  given message actually landed.

**Realistic next uses, in the order they would pay off:**

1. **Wire the branding settings** (§6) so templates inherit logo/colour/footer
   centrally instead of each author pasting markup. Highest value per hour of work.
2. **Seasonal guest campaigns** — needs the suppression list (already built) plus a
   paid Brevo tier and a recipient-cap raise.
3. **Template-driven operational mail** — vaccination reminders, pickup reminders.
   The scheduling and template machinery already exist; only the trigger is missing.
4. **Feeding the AI generator from booking context** so a follow-up drafts itself.

---

## 9. Standalone commercial assessment (honest)

The owner asked what this would be worth sold separately. Assessed 2026-09-11 against
what the code actually does.

**What it is.** An operator console layered over a third-party ESP, with RBAC,
per-address sender clearance, audit, suppression and deliverability diagnostics. It
is **not** an ESP, not a marketing-automation platform, and not a campaign builder.

**Honest market position.** As a *standalone SaaS product this is weak.* It sends
through Brevo, so a buyer already paying Brevo gets a console from Brevo. The market
for "a nicer front-end to someone else's ESP" is thin, and the incumbents
(Postmark ~$15/mo, SendGrid, Mailgun) bundle their own dashboards free.

**Where the real value is.** The parts a generic ESP dashboard does *not* give you:

- per-address sender clearance tied to an org's own role model;
- PLAC sub-capabilities, so "can send" and "can send as billing@" are separable;
- every send audited into the same ledger as the rest of the admin platform;
- suppression enforced *server-side before enqueue*, not trusted to the provider;
- deliverability diagnostics in the same screen as sending.

That is integration value, and it only exists **inside** a larger admin platform.

**What to charge — three honest framings:**

| Framing | Realistic price | Reasoning |
|---|---|---|
| **Module in the existing platform** | **$15–40/mo per tenant** | Fits beside the Velox tiers ($59/$149/$299/$499). Defensible as an add-on; not defensible as a standalone line item. |
| **One-off client build** | **$6,000–12,000** | ~8,000 lines with genuine security work (sanitisation, suppression, RBAC, audit). At $75–120/hr that is 60–110 hours, which is about right for a careful build plus tests. |
| **Standalone SaaS** | **don't** | Undifferentiated against the ESPs' own consoles; you would be reselling Brevo with extra steps and owning the support burden. |

**How well does it actually do the job?** Mixed, and worth saying plainly:

- **Strong:** the security model. Sanitisation, pre-enqueue suppression, per-address
  clearance and full audit are better than most in-house email consoles.
- **Strong:** decoupling. A Brevo outage delays delivery; it never breaks the UI.
- **Weak:** the settings layer is largely decorative (§6) — ten of eleven settings
  either aren't stored or aren't read.
- **Weak:** test coverage. One test file for four new routes; the §0 defect shipped
  green because the untested route is the one that enforces.
- **Blocking:** the §0 defect. A product that four of six roles cannot use is not
  shippable to a third party as-is.

**Verdict.** Keep it as a platform module. Fix §0 and wire §6 before it is ever
demonstrated to a paying client.

---

## 10. Operational notes

- **Success toast means *enqueued*, not *delivered*.** Confirm in Queue Logs.
- **No send idempotency.** Each POST mints a fresh `trackingId`; a double-submit
  enqueues twice. Tracked in [`../MAINTENANCE.md`](../MAINTENANCE.md).
- **A scheduled send cannot be cancelled from the portal.** `POST /api/emails/cancel`
  was never built; the claim was removed 2026-09-02.
- **Attachments are private.** Stored under a private R2 prefix, resolved server-side
  by the consumer. The portal stores the key, never a public URL.
- **Orphan sweep.** The Sunday R2 cleanup garbage-collects `email-attachments/`
  against `cms_content`, active drafts and the ledger.
- **Server errors reach Sentry via `@sentry/cloudflare`** (`withSentry` in
  `cf-entry.ts`). `@sentry/astro`'s server SDK is a silent no-op in workerd.

### Schema and migrations

`5781fb8` added **zero migrations** — the feature reuses existing tables, which is
RULE #0.9 working as intended. Two standing items, both predating it:

- `migrations/0008_email_suppression.sql` (authored 2026-07-26, applied 2026-08-04)
  sits in cf-admin's series at a number **RULE #0.7b assigns to cf-astro** (which
  owns `0001`–`0032`; cf-admin owns `0033`+). The live `d1_migrations` ledger now
  carries three different files numbered `0008`. It is already inside the "26
  duplicate numbers" main.md records, and because the ledger keys on *filename* all
  three applied correctly — so this is untidy, not broken. **Do not renumber an
  applied migration.**
- That migration has no row in
  [`../reference/schema-change-ledger.md`](../reference/schema-change-ledger.md).
  **This is correct, not a gap** — the ledger records that it only tracks changes
  from **2026-08-12 forward** and is deliberately not backfilled; this migration was
  applied 2026-08-04. (An earlier draft of this section called it a RULE #0.7
  violation. It is not, and the ledger's own scope note is the authority.)

---

## 11. Verification log

| Date | Checked by | Method | Result |
|------------|-----------|-------------------------------|------------------------|
| 2026-06-07 | claude | code read | pass — schema-provisioning gap noted |
| 2026-06-07 | claude | deep UI + backend review | corrected sender-IP wording; added ledger detail |
| 2026-06-07 | claude | mobile-first redesign | bottom tab bar, `MobileComposer`, autosave, `#preview`/`#contacts` |
| 2026-09-11 | claude | full re-audit of `5781fb8` — read all 4 new API routes + `send.ts`; live D1 (`admin_portal_settings`, `admin_pages`, `admin_email_*`, `d1_migrations`); live Supabase (`admin_authorized_users`) | **P1 defect found (§0)**: `email_sender_identities` absent from D1; `senders.ts` falls back, `send.ts` does not → canonical Admin and Manager get 403 on every send. 2 of 6 active accounts blocked |
| 2026-09-11 | claude | `SELECT` over the 11 engine settings | only `custom_email_max_recipients` exists; 10 fall back to code defaults; 5 branding settings are written but read by nothing in the send path (§6) |
| 2026-09-11 | claude | `grep` for `brevo_api_key` readers/writers + `KNOWN_SETTING_KEYS` | 6 reads, 0 writes, not a known key — a dead D1 read on every portal interaction |
| 2026-09-11 | claude | `admin_pages` query | 10 PLAC anchors live, incl. new `#ai-generate`; `required_role` recorded in §4 |
| 2026-09-11 | claude | `git show --stat 5781fb8`; `d1_migrations` query; ledger scope note | 0 migrations in the commit — RULE #0.9 reuse working as intended. `0008_email_suppression.sql` applied 2026-08-04; its absence from the schema-change ledger is **correct** (that ledger starts 2026-08-12 and is not backfilled), and its number collides with cf-astro's series but is already inside the 26 duplicates main.md records |
| 2026-09-11 | claude | Brevo plan limits cross-checked against vendor pricing pages | 300/day, ~9,000/month free — code defaults are accurate, not invented |

---

## 12. Related

- [ARCHITECTURE.md](../architecture/ARCHITECTURE.md) — Lean Edge stack, request lifecycle
- [plac-and-audit.md](../architecture/plac-and-audit.md) — PLAC + Ghost Audit
- [USER-MANAGEMENT.md](USER-MANAGEMENT.md) — RBAC hierarchy, role vocabulary
- [DASHBOARD.md](DASHBOARD.md) — Email Queue health widget
- [OPERATIONS.md](../operations/OPERATIONS.md) — bindings, queue, secrets registry
- [brevo-webhook.md](../runbooks/brevo-webhook.md) — webhook verification runbook
- [SECURITY.md](../security/SECURITY.md) — CSRF, session model
