---

title: "Sync System — Architecture Review & Improvement Plan"
status: active
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code, live-d1, live-supabase]
owner: harshil
related_code: [src/lib/cms/revalidate.ts, src/lib/sync-outbox.ts, src/workers/sync-revalidate-consumer.ts, src/lib/sync-contract.ts, src/workers/scheduled-log-sync.ts]
tags: [sync, cms, control-plane, reliability, roadmap]
---

# Sync System — Architecture Review & Improvement Plan

> **TL;DR (non-technical):** How content and settings travel from the admin
> portal to the live website, where that pipeline can silently fall behind, and
> what was done about it. **The durability work is shipped and live:** a failed
> publish is persisted to the `sync_outbox` table and redriven by a queue
> consumer, so it no longer silently gives up after three in-request retries.
> What remains open is smaller — dead config keys (C3), the cross-repo
> `sync-contract.ts` parity kept by hand (C4), webhook replay protection (S4)
> and a content-history **UI**.

> **This document is two things.** §0 (the three planes, the fail-safe chain,
> the outbox/DLQ path, read-back semantics and the C4 parity rule) is an
> evergreen architecture description and is re-verified. §2's risk list and §3's
> roadmap are a **dated 2026-06-09 review**: most of it shipped, and §6 is the
> record of what. Read §2 with §6 open, or you will treat closed risks as open.

> **Scope:** the content / config / log sync that flows cf-admin ⇄ cf-astro
> through Cloudflare (D1 / KV / R2 / Queues / edge cache) and Supabase.
> **Grounded against:** live production D1 (`madagascar-db`,
> `[D1_MADAGASCAR_DB_ID]`), live Supabase (`[SUPABASE_PROJECT_REF]`), and the
> code on both repos as of 2026-06-09; re-verified against cf-admin's code and
> live D1 on 2026-09-20 (see §8).
> **Projects:** `cf-admin` (writer), `cf-astro` (reader).

---

## 0. The system as it really is

Three sync planes ride on **one shared substrate**: D1 `madagascar-db`
(`[D1_MADAGASCAR_DB_ID]`) is bound by **both** workers (see both
`wrangler.toml` files), so cf-astro reads cf-admin's `cms_content` and
`service_config` tables **directly**. KV, the edge cache, and the
`cf-astro/src/pages/api/revalidate.ts` webhook exist only to **bust caches faster than D1 read-replica
lag** — they do not move the data; D1 already shares it.

| Plane | Write side (cf-admin) | Transport | Read side (cf-astro) | Cache layers |
|---|---|---|---|---|
| **CMS content** | `updateCmsBlock()` → D1 `cms_content` (`cf-admin/src/lib/cms/storage.ts`) | `revalidateAstro()` → `POST /api/revalidate` (Bearer) | section `.astro` resolvers | edge cache-tag → `cms:*` KV (1h TTL) → D1 → i18n defaults |
| **Service config** | `ServiceConfigRepository` → D1 `service_config` | `flushAstroConfigCache()` → `/api/revalidate {kind:'config'}` | `getServiceConfig()` + `route-policy.ts` resolver | mem 10s → Cache-API 60s → D1 → hardcoded `DEFAULTS` |
| **Login / log sync** | `handleScheduled()` → D1 `admin_login_logs` (**cf-admin**, `src/workers/scheduled-log-sync.ts`, run as the `cf-access-audit-poll` job in the `*/5` batch) | 5-min cron polls CF Access audit-log API | — (cf-astro is not involved) | **D1** watermark: `admin_portal_settings` row `cf-audit-last-synced` |

> **Corrected 2026-09-20** (the row above had two errors that sent debuggers to
> the wrong store and the wrong repo): the watermark is a **D1**
> `admin_portal_settings` row, not KV — `scheduled-log-sync.ts` says so in its
> header, though the constant is still misleadingly named `KV_LAST_SYNCED_KEY` —
> and `handleScheduled()` is **cf-admin's** function, invoked from cf-admin's
> job registry. Nothing in cf-astro runs it.

**The design instinct is strong and must be preserved:** every read fails safe to
the last good value (KV → D1 → hardcoded), so a missing or corrupt store
reproduces current behavior and never crashes a render. **The weaknesses are all
in the *guarantees around the happy path*, not the fallback path.**

### CMS content flow (detail)

```
Admin saves  ──►  D1 cms_content (authoritative, written FIRST)
                       │
                       ▼  revalidateAstro(env, basePaths, cmsData)   [cf-admin/src/lib/cms/revalidate.ts]
                  POST /api/revalidate  (Bearer REVALIDATION_SECRET, 3× backoff, 5s timeout)
                       │
   cf-astro /api/revalidate:
     1. delete isr:<path># keys (per locale-expanded path)
     2. write cms:<key> KV  (allowlisted + sanitizeHtml, expirationTtl 3600)
     3. pingIndexNow(paths)            (waitUntil)
     4. CF API purge_cache by tag page-<path>   (waitUntil)
                       │
        success ──► RevalidationResult{ success:true }
        3× fail ──► enqueueRevalidation() → D1 sync_outbox + SYNC_QUEUE redrive
                    └─► Sentry.captureMessage("… queued for redrive")
                    └─► sync-revalidate-consumer.ts drains it (DLQ behind it)
```

### Config flow (detail)

cf-astro caches a `ServiceConfigSnapshot` (`cf-astro/src/lib/service-config.ts`): isolate
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

### ✅ Reliability — durability, as found 2026-06-09 (**R1–R4 all closed**; see §6)

> **These four were the top priority of the 2026-06 review and are no longer
> open.** They are kept in the past tense because the roadmap in §3 and the log
> in §6 only make sense against them. Re-verified 2026-09-20.

- **R1 — Fire-and-forget publish.** *(closed — item 1.1)* `revalidateAstro()`
  retried 3× then emitted a Sentry message and **gave up**. A failed publish left
  D1 ahead of the edge for up to **1h** (`cms:*` `expirationTtl: 3600`) or **24h**
  (ISR pages set `s-maxage=86400`; if the cache-tag purge *also* failed).
  **Today:** on a genuine delivery failure (`result.attempts > 0` — not a dev
  bypass or a missing secret) `src/lib/cms/revalidate.ts` persists the publish
  via `enqueueRevalidation()` to `sync_outbox` and enqueues a redrive on
  `SYNC_QUEUE`; `src/workers/sync-revalidate-consumer.ts` drains it, with a DLQ
  behind it. The Sentry message now reads "queued for redrive".
- **R2 — Split self-healing clocks.** *(closed by 1.1 — owner decision, item
  0.6)* `cms:*` KV healed at 1h while ISR/edge HTML healed at 24h, so the two
  layers could disagree for a day after a partial failure. Aligning the TTLs was
  superseded by the redrive: a failure is now retried in minutes rather than
  waited out.
- **R3 — No post-publish verification.** *(closed — item 1.2)* Read-back now
  runs against cf-astro's `/api/cms-status` and surfaces as `verified` on the
  save/rollback response. Advisory, not blocking — see the note in §6.
- **R4 — Booking dual-write has no transaction or reconciliation.** *(closed —
  item 2.1)* The email-retry reconciler is shipped and live, with the
  `booking_attempts` replay columns added by
  `cf-astro/db/migrations/0015_booking_replay_outbox.sql` (applied 2026-09-03).
  Two booking sources of truth remain by design; the reconciler is the bridge.

### 🟠 Correctness / consistency

- **C1 — Content history: wired, still unexercised.** `cms_content_history`
  (`database/legacy_migrations/0026_cms_content_history.sql`, applied
  2026-05-13, since consolidated into `migrations/0000_baseline.sql`) was unwired
  at review time. `recordCmsHistory` has since been wired into `updateCmsBlock()`
  (`src/lib/cms/storage.ts`) and a history/rollback API exists
  (`src/pages/api/content/history.ts`) — items 1.3 / 1.3b. **But live on
  2026-09-20 the table is still 0 rows**: the path has not fired in production in
  three months, so rollback is untested against real data. For contrast,
  `service_config_history` is now **30** rows (3 at review time). A history
  **UI** in the Content Studio is still unbuilt.
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

- **S1** — `cms.ts` posts to cf-astro's `http://internal/api/revalidate`; `config-publisher.ts`
  posts to `https://internal/…` — inconsistent service-binding URL.
- **S2** — cf-astro's `/api/runtime-config` is CDN-cached `max-age=60` **independently** of the
  Cache-API flush, so a config purge still serves stale client config up to 60s
  (no tag to purge it).
- **S3** — Cron watermark advances to `now`, not the last processed `created_at`,
  and `BATCH_LIMIT=100` has **no pagination** → a burst >100 failed logins in one
  5-min window silently drops the overflow.
- **S4** — Webhook auth is a single static Bearer secret — no body HMAC, no
  timestamp/nonce → no replay protection. (Allowlist + sanitize limit blast
  radius, but allowed keys are still poisonable if the secret leaks.)
- **S5** — Supabase advisor: **leaked-password protection disabled** — still the
  only open security advisory on the project, and the one item in this doc that
  two `status: active` docs disagree about. The procedure is owned by
  [`../runbooks/supabase-leaked-password-protection.md`](../runbooks/supabase-leaked-password-protection.md);
  settle it there, not here (see item 0.2 in §6).
  *Indexes: acted on* — chunk 14a (2026-09-16) removed five never-used indexes
  and added the two missing FK indexes; see
  [`schema-change-ledger.md`](schema-change-ledger.md).
  *BetterStack:* `BETTERSTACK_SOURCE_TOKEN` returned 401 → logs silently dropped;
  rotated 2026-06-10, observability restored (item 0.1 in §6).

---

## 3. Improvement roadmap (phased — reliability first)

> **Pointer for inbound links.** Several places — `src/lib/sync-contract.ts` and
> two specs — cite "SYNC-SYSTEM-REVIEW.md **§3** (C4)" as the rule that the two
> `sync-contract.ts` files must stay byte-identical. **C4 is in §2**, above; §3
> holds roadmap item 3.1, which is the work that partly closed it. Both are the
> right reading; the section number in those citations is wrong.

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
    (Queues are already used for email). A consumer worker drives cf-astro's
    `/api/revalidate` with **retries + DLQ + automatic redrive**.
    Outcome: a publish is *guaranteed*
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

## 6. Implementation log

Tracking which roadmap items have shipped to the review branch
(`claude/sync-system-architecture-review-0vyjxz`, PRs cf-admin#12 / cf-astro#13).

| Item | Status | Where |
|---|---|---|
| 0.3 — unify internal revalidate URL to `https://internal` | ✅ shipped | `cf-admin/src/lib/cms/revalidate.ts` |
| 0.5 — cache-tag cf-astro's `/api/runtime-config` + purge on `{kind:'config'}` | ✅ shipped | `cf-astro/src/pages/api/{runtime-config,revalidate}.ts` |
| 1.3 — wire `cms_content_history` (append + prune to last 10) | ✅ shipped | `cf-admin/src/lib/cms/storage.ts` (`recordCmsHistory`) |
| 1.3b — history read + **rollback** endpoint (republishes via revalidate) | ✅ shipped | `cf-admin/src/pages/api/content/history.ts` |
| 0.1 — rotate `BETTERSTACK_SOURCE_TOKEN` | ✅ done — rotated in both workers (2026-06-10); observability restored | — |
| 0.2 — Supabase leaked-password protection | ⚠️ **unsettled — do not cite this row.** It said "not applicable, Pro-plan-only", while [`../runbooks/supabase-leaked-password-protection.md`](../runbooks/supabase-leaked-password-protection.md) (also `status: active`) says it is a 30-second dashboard toggle at no cost. Live, the advisor still reports it disabled. A third possibility neither doc states: cf-admin does not use Supabase GoTrue at all (identity is Cloudflare Access), so the setting may simply be inert. **The runbook owns the procedure and the answer**; this row defers to it. | see the runbook |
| 0.4 — dead config keys (wire/delete + assertion) | ⏳ todo (Phase 3 contract territory) | — |
| 0.6 — align self-healing clocks (ISR vs `cms:*` TTL) | ⏸ deferred — superseded by 1.1 redrive (owner decision) | — |
| 1.1 — outbox + Queue-driven revalidation (DLQ) | ✅ shipped + **live in prod** (queues created, config un-gated, `database/legacy_migrations/0033_create_sync_outbox.sql` applied 2026-06-10) | `cf-admin`: `src/lib/sync-outbox.ts`, `src/workers/sync-revalidate-consumer.ts`, `src/lib/cms/revalidate.ts`, `src/workers/cf-entry.ts`, `wrangler.toml` |
| 1.2 — `/api/cms-status` read-back verification | ✅ shipped | `cf-astro/src/pages/api/cms-status.ts`; `cf-admin/src/lib/cms-status.ts` (`verifyCmsLive`), surfaced as `verified` on save/rollback responses |
| 1.4 — `service_config.version` + optimistic concurrency | ✅ shipped | `cf-admin`: `database/legacy_migrations/0034_service_config_version.sql`, `ServiceConfigRepository`, `api/control-plane/config.ts`; doc claims reconciled in `TECHNICAL_OVERVIEW.md` |
| 2.2 — cron watermark + pagination hardening (S3) | ✅ shipped | `cf-admin/src/workers/scheduled-log-sync.ts` |
| 2.1 — booking email-retry reconciler (R4) | ✅ shipped + **live in prod** (migration `0008` applied 2026-06-10; reconciler hardened to skip quietly if the columns are ever absent) | `cf-astro`: migration `0008`, `d1-attempts.ts`, `booking.ts`; `cf-admin`: `workers/scheduled-booking-retry.ts` wired into the 5-min cron |
| 3.1 — shared sync-contract module (C4, partial) | ✅ shipped (in-repo single-source) | `sync-contract.ts` in both repos; cf-astro `RATE_LIMITS` + `DEFAULTS.ratelimit` + CMS allowlist and cf-admin `SITE_LOCALES` now derive from it. Cross-repo agreement = keep the two files in sync (see C4 note below). Sentry defaults vs cf-admin `CONFIG_SPECS` and exact 1.2 hashing still pending. |

> **✅ Production status (verified 2026-06-10 against live `madagascar-db`
> `[D1_MADAGASCAR_DB_ID]`).** All deployment steps are complete and the
> durability pipeline is live:
>
> - Queues `madagascar-sync-revalidate` + `…-dlq` created; `SYNC_QUEUE` producer +
>   consumers un-gated in `wrangler.toml` and deployed.
> - Migrations applied & tracked in `d1_migrations`:
>   `database/legacy_migrations/0033_create_sync_outbox.sql`,
>   `0034_service_config_version.sql`, and cf-astro's `0008` (booking_attempts
>   email-retry). ⚠️ **Cite these by full path, not by bare number.** All three
>   pre-date the `migrations/0000_baseline.sql` consolidation, and `0033` / `0034`
>   in today's `migrations/` are the **blog** tables — different files entirely.
>   That collision is exactly what RULE #0.7b exists to prevent.
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

## 7. Cross-references

- CMS pipeline & fallback chain → [`features/CMS.md`](../features/CMS.md)
- KV quota & failure cascade → [`architecture/KV-RESILIENCE.md`](../architecture/KV-RESILIENCE.md)
- Control plane (config sync) → [`features/CONTROL-PLANE.md`](../features/CONTROL-PLANE.md) (the design record moved to [`archive/control-plane-design/TECHNICAL_OVERVIEW.md`](../archive/control-plane-design/TECHNICAL_OVERVIEW.md) on 2026-08-23)
- Layer-B connectors → [`features/CONTROL-PLANE-CONNECTORS.md`](../features/CONTROL-PLANE-CONNECTORS.md)
- cf-astro system architecture → `cf-astro/Documentation/SYSTEM-ARCHITECTURE.md`
- Key files: `cf-admin/src/lib/cms/` (`storage.ts`, `revalidate.ts`), `cf-admin/src/lib/control-plane/config-publisher.ts`,
  `cf-astro/src/pages/api/revalidate.ts`, `cf-astro/src/lib/service-config.ts`,
  `cf-astro/src/lib/route-policy.ts`, `cf-admin/src/workers/scheduled-log-sync.ts`

---

## 8. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-08-23 | Original 2026-06-09 review re-stamped; cross-references updated for the control-plane archive move. §2's R1/R2 were already closed by §6's item 1.1 at that date and were not corrected — that is the drift this 2026-09-20 pass repaired. | — |
| 2026-09-20 | **cf-admin code:** `src/lib/cms/revalidate.ts` (outbox fallback on `attempts > 0`, "queued for redrive"), `src/lib/sync-outbox.ts` and `src/workers/sync-revalidate-consumer.ts` both present; `src/workers/scheduled-log-sync.ts` header (**D1** `admin_portal_settings` watermark, not KV) and `src/lib/jobs/registry.ts` (`handleScheduled` runs in **cf-admin** as `cf-access-audit-poll`). **Live D1:** `cms_content_history` **0** rows, `service_config_history` **30** rows (was 3), `sync_outbox` 0. **Result:** R1–R4 restated as closed; the §0 login-sync row corrected on both counts; C1 restated as wired-but-unexercised; bare migration numbers `0026`/`0033`/`0034` replaced with full `database/legacy_migrations/` paths (those numbers now name the blog tables in `migrations/`); S5 split into its three parts; item 0.2 marked unsettled and deferred to the runbook; the partial D1 database id removed from the two places the mirror's redactor does not catch; §6/§7 renumbered so the document runs 0–8. | The **cf-astro** side throughout: S1 (`http://` vs `https://internal`), S2 (`/api/runtime-config` cache tag), S3 pagination, and whether Phase 4.1 (HMAC on the revalidate body, S4) landed there. That repo is out of scope for a cf-admin pass — treat every cf-astro claim in this doc as dated 2026-06-09. |
