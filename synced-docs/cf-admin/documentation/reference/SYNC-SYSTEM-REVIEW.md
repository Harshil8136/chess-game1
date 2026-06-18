---

title: "Sync System — Architecture Review & Improvement Plan"
status: active
audience: [ai, technical]
last_verified: 2026-06-09
verified_against: [code, live-d1, live-supabase]
owner: harshil
tags: [sync, cms, control-plane, reliability, roadmap]
---

# Sync System — Architecture Review & Improvement Plan

> **TL;DR (non-technical):** How content and settings travel from the admin
> portal to the live website, where that pipeline can silently fall behind, and a
> phased plan to make it provably reliable. **Top priority: durability** — every
> publish should either reach the live site (verified) or land in a visible
> dead-letter queue, never silently lag for hours.

> **Scope:** the content / config / log sync that flows cf-admin ⇄ cf-astro
> through Cloudflare (D1 / KV / R2 / Queues / edge cache) and Supabase.
> **Grounded against:** live production D1 (`madagascar-db`, `7fca2a07…`), live
> Supabase (`zlvmrepvypucvbyfbpjj`), and the code on both repos as of 2026-06-09.
> **Projects:** `cf-admin` (writer), `cf-astro` (reader).

---

## 0. The system as it really is

Three sync planes ride on **one shared substrate**: D1 `madagascar-db`
(`7fca2a07-d7b4-449d-b446-408f9187d3ca`) is bound by **both** workers (see both
`wrangler.toml` files), so cf-astro reads cf-admin's `cms_content` and
`service_config` tables **directly**. KV, the edge cache, and the
`/api/revalidate` webhook exist only to **bust caches faster than D1 read-replica
lag** — they do not move the data; D1 already shares it.

| Plane | Write side (cf-admin) | Transport | Read side (cf-astro) | Cache layers |
|---|---|---|---|---|
| **CMS content** | `updateCmsBlock()` → D1 `cms_content` (`src/lib/cms.ts`) | `revalidateAstro()` → `POST /api/revalidate` (Bearer) | section `.astro` resolvers | edge cache-tag → `cms:*` KV (1h TTL) → D1 → i18n defaults |
| **Service config** | `ServiceConfigRepository` → D1 `service_config` | `flushAstroConfigCache()` → `/api/revalidate {kind:'config'}` | `getServiceConfig()` + `route-policy.ts` resolver | mem 10s → Cache-API 60s → D1 → hardcoded `DEFAULTS` |
| **Login / log sync** | — | 5-min cron polls CF Access audit-log API | `handleScheduled()` → D1 `admin_login_logs` | KV watermark `cf-audit-last-synced` |

**The design instinct is strong and must be preserved:** every read fails safe to
the last good value (KV → D1 → hardcoded), so a missing or corrupt store
reproduces current behavior and never crashes a render. **The weaknesses are all
in the *guarantees around the happy path*, not the fallback path.**

### CMS content flow (detail)

```
Admin saves  ──►  D1 cms_content (authoritative, written FIRST)
                       │
                       ▼  revalidateAstro(env, basePaths, cmsData)   [src/lib/cms.ts]
                  POST /api/revalidate  (Bearer REVALIDATION_SECRET, 3× backoff, 5s timeout)
                       │
   cf-astro /api/revalidate:
     1. delete isr:<path># keys (per locale-expanded path)
     2. write cms:<key> KV  (allowlisted + sanitizeHtml, expirationTtl 3600)
     3. pingIndexNow(paths)            (waitUntil)
     4. CF API purge_cache by tag page-<path>   (waitUntil)
                       │
        success ──► RevalidationResult{ success:true }
        3× fail ──► Sentry.captureMessage("[CMS Sync Error] …")  ←─ then GIVES UP
```

### Config flow (detail)

cf-astro caches a `ServiceConfigSnapshot` (`src/lib/service-config.ts`): isolate
memory (10s) → Cloudflare Cache API (60s) → shared D1 `service_config` →
hardcoded `DEFAULTS`. `flushAstroConfigCache()` (`config-publisher.ts`) posts
`{kind:'config'}` which calls `purgeServiceConfigCache()` — clearing the Cache-API
entry (global) and the calling isolate's memory copy. Client scripts read the
projected, secret-free subset from `GET /api/runtime-config` (CDN-cached 60s).

---

## 1. What is solid (keep, do not touch)

- **3-tier fail-safe reads** on both planes; `DEFAULTS` / i18n parity means an
  empty or corrupt store reproduces today's behavior exactly.
- **`Promise.allSettled` per-key isolation** in `revalidate.ts` — one KV failure
  no longer aborts the batch (fixed 2026-05-13).
- **KV allowlist + value sanitization** — `CMS_KEY_ALLOWLIST` gates keys and
  `sanitizeHtml()` scrubs values, so even a leaked `REVALIDATION_SECRET` can't
  inject `<script>` through `cmsData`.
- **Route-policy resolver** (`route-policy.ts`) — first-match-wins, every rate
  clamped `[0,1]`, dependency-free, fail-safe to legacy buckets on empty/corrupt.
- **Cron robustness** — watermark self-heals on a corrupt value, dedupes by
  `ray_id`, caps alert-email fan-out at 5/batch.

---

## 2. Risks & gaps (prioritized, production-grounded)

### 🔴 Reliability — sync has no durability guarantee  *(TOP PRIORITY)*

- **R1 — Fire-and-forget publish.** `revalidateAstro()` retries 3× then emits a
  Sentry message and **gives up** (`src/lib/cms.ts:374`). A failed publish leaves
  D1 ahead of the edge for up to **1h** (`cms:*` `expirationTtl: 3600`) or **24h**
  (ISR pages set `s-maxage=86400`; if the cache-tag purge *also* failed). There is
  **no durable redrive** — nothing retries after the 3 in-request attempts.
- **R2 — Split self-healing clocks.** `cms:*` KV heals at 1h but ISR/edge HTML
  heals at 24h, so the two cache layers can disagree for up to a day after a
  partial failure.
- **R3 — No post-publish verification.** The admin Content Studio iframe reloads
  with `?v=Date.now()`; nothing reads back from cf-astro to confirm KV/edge
  actually serve the new bytes. **"Saved" ≠ "live."**
- **R4 — Booking dual-write has no transaction or reconciliation.**
  `cf-astro/src/pages/api/booking.ts` writes D1 `booking_attempts` (dead-letter) +
  Supabase `bookings` + `EMAIL_QUEUE` with no saga. The deferred **email-retry
  cron** (scan `booking_attempts WHERE status='queue_error'`) is still open in
  `cf-astro/ToDo.md`. Two booking sources of truth, no reconciler.

### 🟠 Correctness / consistency

- **C1 — Content history is unwired.** `cms_content_history` exists (migration
  `0026`) but has **0 rows** in production — `updateCmsBlock()` never writes it.
  **No content versioning or rollback**, even though `service_config_history` *is*
  populated (3 rows) and the control-plane doc advertises rollback.
- **C2 — `service_config` has no `version` column** (verified live), yet
  `TECHNICAL_OVERVIEW.md` claims "version bumped / version-tracked for change
  detection." Cache invalidation is therefore purely time/flush-based, and
  concurrent edits are silent last-write-wins (no optimistic concurrency).
- **C3 — Dead config keys.** `cloudflare.cf_astro.head_sampling_rate` and
  `cloudflare.cf_admin.observability_enabled` are written to D1 but **never read**
  by `service-config.ts` (`rowsToSnapshot` has no case for them) → editing them in
  the UI does nothing.
- **C4 — Hand-maintained parity in 3 places** that must agree or sync silently
  breaks: `CMS_KEY_ALLOWLIST` (astro) vs admin's emitted keys; `SITE_LOCALES`
  (admin `cms.ts`) vs astro routes; `DEFAULTS` (astro) vs hardcoded source values.
  No shared contract, no test enforcing it.
  - **Partially addressed (Phase 3.1):** a dependency-free `sync-contract.ts` leaf
    module now exists in **both** repos as the single source for `SITE_LOCALES`,
    `RATE_LIMIT_MAX`, and `CMS_KEY_ALLOWLIST`. Within cf-astro, `RATE_LIMITS`,
    `DEFAULTS.ratelimit`, and the revalidate allowlist all derive from it, so that
    `DEFAULTS`-vs-source drift is now **structurally impossible** (no test needed).
    cf-admin's `SITE_LOCALES` derives from its mirror. **Remaining:** the two
    `sync-contract.ts` files are kept in agreement by hand (no shared package, by
    the $0-infra invariant) — keep them identical when editing; and cf-admin's
    `CONFIG_SPECS` sentry/rate-limit defaults are not yet single-sourced.

### 🟡 Smaller but real

- **S1** — `cms.ts` posts to `http://internal/api/revalidate`; `config-publisher.ts`
  posts to `https://internal/…` — inconsistent service-binding URL.
- **S2** — `/api/runtime-config` is CDN-cached `max-age=60` **independently** of the
  Cache-API flush, so a config purge still serves stale client config up to 60s
  (no tag to purge it).
- **S3** — Cron watermark advances to `now`, not the last processed `created_at`,
  and `BATCH_LIMIT=100` has **no pagination** → a burst >100 failed logins in one
  5-min window silently drops the overflow.
- **S4** — Webhook auth is a single static Bearer secret — no body HMAC, no
  timestamp/nonce → no replay protection. (Allowlist + sanitize limit blast
  radius, but allowed keys are still poisonable if the secret leaks.)
- **S5** — Supabase advisor: **leaked-password protection disabled** (also in
  `ToDo.md`); ~27 unused indexes (benign — never-queried, not yet a problem);
  `BETTERSTACK_SOURCE_TOKEN` returns 401 → logs silently dropped (🔴 in ToDo —
  this blinds the entire observability story below).

---

## 3. Improvement roadmap (phased — reliability first)

### Phase 0 — Quick wins (hours, low risk)

0.1 **Rotate `BETTERSTACK_SOURCE_TOKEN`.** Without it, every "we log failures"
    guarantee below is blind. *(blocks meaningful verification of everything else)*
0.2 Enable Supabase leaked-password protection (dashboard toggle).
0.3 Unify the internal URL to `https://internal/…` in `cms.ts` (match
    `config-publisher.ts`). *(S1)*
0.4 Wire **or** delete the two dead config keys; add a "consumed-by" assertion
    test so dead keys can't reappear. *(C3)*
0.5 Add a cache-tag (e.g. `config`) to `/api/runtime-config` and purge it on the
    `{kind:'config'}` flush, closing the 60s client-stale window. *(S2)*
0.6 Pick **one** self-healing clock: lower ISR `s-maxage` to ~1h **or** raise the
    `cms:*` TTL. *(R2)*

### Phase 1 — Make sync durable & verifiable  ⭐ **PRIMARY FOCUS**

1.1 **Outbox + Queue-driven revalidation** *(the single highest-leverage change)*.
    In the same D1 write that updates `cms_content` / `service_config`, insert a
    `sync_outbox` row and enqueue a revalidation job on a **Cloudflare Queue**
    (Queues are already used for email). A consumer worker drives `/api/revalidate`
    with **retries + DLQ + automatic redrive**. Outcome: a publish is *guaranteed*
    to propagate or land in a **visible DLQ** — eliminating the silent 1–24h
    split-brain in R1/R2. Keep the in-request `revalidateAstro()` call as the fast
    path; the outbox is the safety net that closes the gap when it fails.
    - *Acceptance:* kill cf-astro mid-publish → job retries and reaches
      `Verified live` once it recovers; permanently bad job lands in DLQ with the
      failing payload and is queryable from the admin.
1.2 **Propagation verification (read-back).** Add `GET /api/cms-status` on cf-astro
    (or extend `/api/health`) returning the live `cms:*` content hashes +
    timestamps. After a publish, cf-admin reads it back and shows **"Verified
    live ✓"** vs **"Saved — propagation pending."** Turns the iframe guess into a
    fact. *(R3)*
    - *Acceptance:* the Content Studio per-section badge flips to Verified only
      after the read-back hash matches the just-written value.
1.3 **Wire `cms_content_history`** on every `updateCmsBlock()` (mirror the
    `service_config_history` pattern) → content diff timeline + one-click rollback
    (rollback re-publishes through the same outbox). *(C1)*
1.4 **Add `service_config.version`** + optimistic concurrency (`If-Match`/version
    check on `PATCH /api/control-plane/config`) so concurrent admins can't clobber
    each other, and caches can invalidate on version rather than only on time.
    Reconcile the doc claims in `TECHNICAL_OVERVIEW.md`. *(C2)*

### Phase 2 — Cross-store consistency

2.1 **Booking outbox + reconciliation.** Treat D1 `booking_attempts` as the
    outbox; a reconciler cron compares it against Supabase `bookings` and re-drives
    gaps. Ship the deferred **email-retry cron** as its first consumer. *(R4)*
2.2 **Cron hardening.** Advance the watermark to the last processed `created_at`
    and paginate beyond 100 entries, so failed-login capture is lossless under
    bursts. *(S3)*

### Phase 3 — Shared contract (kills the parity-drift bug class)

3.1 Extract a single **sync-contract module** (versioned) owning: the CMS key
    allowlist, the config-key registry, `SITE_LOCALES`, `DEFAULTS`, and the
    route-policy types. Both repos import it (or generate from it). A CI
    **defaults-parity test** fails the build if astro's `DEFAULTS` drift from
    source or a config key isn't consumed. Removes the three hand-maintained
    agreements in C4.

### Phase 4 — Security hardening

4.1 HMAC-sign the revalidate body + add a timestamp/nonce (replay protection) on
    top of the Bearer secret. *(S4)*
4.2 CSP nonce to drop `unsafe-inline` / `unsafe-eval` (already staged in
    `cf-astro/ToDo.md`).

---

## 4. New features worth adding (build on Phase 1's outbox)

- **Draft → Preview → Scheduled publish** for CMS: edit against a `draft`
  namespace, preview via a signed token, schedule a publish (Queue + cron).
- **Config canary / staged rollout:** apply a config change to a route subset or
  request % before global — the route-policy engine is already shaped for this.
- **Drift detection (Layer B):** scheduled compare of D1 config vs live provider
  state (Sentry sampling, PostHog recording) → surface "live differs from
  intended" in the control plane.
- **Sync-health dashboard:** publish success rate, propagation latency p50/p95,
  DLQ depth, last-verified-live per section — emitted as Analytics Engine events
  from the Queue consumer (the `ANALYTICS` binding already exists).
- **Content rollback & audit timeline** — falls out of Phase 1.3 for free.

---

## 5. Sequencing & definition of "robust"

**Sequence:** Phase 0 now → **Phase 1 (1.1 + 1.2 first** — they de-risk
everything) → Phase 2 → Phase 3 → Phase 4, interleaving §4 features once the
outbox (1.1) lands, since draft/scheduled publishing and the health dashboard all
reuse it.

**The sync is "robust" when:**

1. Every publish either reaches **Verified live** or appears in a **DLQ** within N
   seconds — no silent multi-hour lag.
2. Both content and config have **version history + rollback**.
3. No hand-maintained parity list can drift without **CI failing**.
4. Failed-login capture and booking persistence are **lossless** under
   bursts/outages.

---

## 7. Implementation log

Tracking which roadmap items have shipped to the review branch
(`claude/sync-system-architecture-review-0vyjxz`, PRs cf-admin#12 / cf-astro#13).

| Item | Status | Where |
|---|---|---|
| 0.3 — unify internal revalidate URL to `https://internal` | ✅ shipped | `cf-admin/src/lib/cms.ts` |
| 0.5 — cache-tag `/api/runtime-config` + purge on `{kind:'config'}` | ✅ shipped | `cf-astro/src/pages/api/{runtime-config,revalidate}.ts` |
| 1.3 — wire `cms_content_history` (append + prune to last 10) | ✅ shipped | `cf-admin/src/lib/cms.ts` (`recordCmsHistory`) |
| 1.3b — history read + **rollback** endpoint (republishes via revalidate) | ✅ shipped | `cf-admin/src/pages/api/content/history.ts` |
| 0.1 — rotate `BETTERSTACK_SOURCE_TOKEN` | ✅ done — rotated in both workers (2026-06-10); observability restored | — |
| 0.2 — Supabase leaked-password protection | ⛔ not applicable — Pro-plan-only feature; project is Free tier ($0-infra invariant). Recorded as an accepted limitation. | — |
| 0.4 — dead config keys (wire/delete + assertion) | ⏳ todo (Phase 3 contract territory) | — |
| 0.6 — align self-healing clocks (ISR vs `cms:*` TTL) | ⏸ deferred — superseded by 1.1 redrive (owner decision) | — |
| 1.1 — outbox + Queue-driven revalidation (DLQ) | ✅ shipped + **live in prod** (queues created, config un-gated, migration `0033` applied 2026-06-10) | `cf-admin`: `sync-outbox.ts`, `workers/sync-revalidate-consumer.ts`, `cms.ts`, `cf-entry.ts`, `wrangler.toml`, migration `0033` |
| 1.2 — `/api/cms-status` read-back verification | ✅ shipped | `cf-astro/src/pages/api/cms-status.ts`; `cf-admin/src/lib/cms-status.ts` (`verifyCmsLive`), surfaced as `verified` on save/rollback responses |
| 1.4 — `service_config.version` + optimistic concurrency | ✅ shipped | `cf-admin`: migration `0034`, `ServiceConfigRepository`, `api/control-plane/config.ts`; doc claims reconciled in `TECHNICAL_OVERVIEW.md` |
| 2.2 — cron watermark + pagination hardening (S3) | ✅ shipped | `cf-admin/src/workers/scheduled-log-sync.ts` |
| 2.1 — booking email-retry reconciler (R4) | ✅ shipped + **live in prod** (migration `0008` applied 2026-06-10; reconciler hardened to skip quietly if the columns are ever absent) | `cf-astro`: migration `0008`, `d1-attempts.ts`, `booking.ts`; `cf-admin`: `workers/scheduled-booking-retry.ts` wired into the 5-min cron |
| 3.1 — shared sync-contract module (C4, partial) | ✅ shipped (in-repo single-source) | `sync-contract.ts` in both repos; cf-astro `RATE_LIMITS` + `DEFAULTS.ratelimit` + CMS allowlist and cf-admin `SITE_LOCALES` now derive from it. Cross-repo agreement = keep the two files in sync (see C4 note below). Sentry defaults vs cf-admin `CONFIG_SPECS` and exact 1.2 hashing still pending. |

> **✅ Production status (verified 2026-06-10 against live `madagascar-db`
> `7fca2a07…`).** All deployment steps are complete and the durability pipeline is
> live:
>
> - Queues `madagascar-sync-revalidate` + `…-dlq` created; `SYNC_QUEUE` producer +
>   consumers un-gated in `wrangler.toml` and deployed.
> - Migrations applied & tracked in `d1_migrations`: `0033` (sync_outbox), `0034`
>   (service_config.version), and cf-astro `0008` (booking_attempts email-retry).
> - Verified columns/tables exist: `sync_outbox`, `service_config.version`,
>   `booking_attempts.email_payload` + `retry_count`.
> - `BETTERSTACK_SOURCE_TOKEN` rotated → observability restored.
>
> **Note on the early "no such column: email_payload" cron errors:** between the
> cf-admin deploy (booking-retry cron went live) and the cf-astro `0008` apply,
> the 5-min reconciler logged that error each tick. It stopped once `0008` was
> applied. The reconciler is now hardened (`scheduled-booking-retry.ts`) to detect
> a missing column and **warn-and-skip** instead of erroring, so any future
> deploy-before-migrate window is fail-soft (mirrors the `service_config.version`
> fallback in `ServiceConfigRepository`).
>
> The one-time provisioning runbook previously lived in `RULESAd.md § "PENDING
> OPS"`; it has been removed now that the steps are done.

> Note on 1.2: verification compares the SHA-256 of the published value against
> the SHA-256 of the value cf-astro stored in `cms:*` KV. These match unless
> `sanitizeHtml` altered the content (rare for normal CMS text), so a mismatch
> means "not yet confirmed," not "broken" — it is advisory in the durable queue
> path (never DLQs a live publish) and a positive "Verified live ✓" signal in the
> admin save response. A future refinement is to share `sanitizeHtml` via the
> Phase 3 contract so the hashes match exactly even for altered content.

> Note on 1.3: the rollback **API** now exists (`GET` history timeline + `POST`
> rollback that re-saves a historical version and republishes through the normal
> revalidate path). A history **UI** in the admin Content Studio is still to build.

---

## 6. Cross-references

- CMS pipeline & fallback chain → [`features/CMS.md`](../features/CMS.md)
- KV quota & failure cascade → [`architecture/KV-RESILIENCE.md`](../architecture/KV-RESILIENCE.md)
- Control plane (config sync) → [`reference/control-plane-design/TECHNICAL_OVERVIEW.md`](./control-plane-design/TECHNICAL_OVERVIEW.md)
- Layer-B connectors → [`features/CONTROL-PLANE-CONNECTORS.md`](../features/CONTROL-PLANE-CONNECTORS.md)
- cf-astro system architecture → `cf-astro/Documentation/SYSTEM-ARCHITECTURE.md`
- Key files: `cf-admin/src/lib/cms.ts`, `cf-admin/src/lib/control-plane/config-publisher.ts`,
  `cf-astro/src/pages/api/revalidate.ts`, `cf-astro/src/lib/service-config.ts`,
  `cf-astro/src/lib/route-policy.ts`, `cf-admin/src/workers/scheduled-log-sync.ts`
