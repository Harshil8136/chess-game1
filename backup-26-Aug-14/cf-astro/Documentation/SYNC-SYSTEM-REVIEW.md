{% raw %}
# Sync System — Architecture Review & Improvement Plan (cf-astro view)

> **Status:** active · **Last verified:** 2026-06-09 · **Owner:** harshil
> **Canonical document:** `cf-admin/documentation/reference/SYNC-SYSTEM-REVIEW.md`
> (this is the cf-astro-side mirror — the consumer end of the pipeline).

This site (`cf-astro`) is the **read/consumer side** of a sync pipeline driven by
the admin portal (`cf-admin`). Content and runtime config travel cf-admin → here
over a **shared D1 database** (`madagascar-db`, `7fca2a07…`, bound by both apps),
with KV + edge cache + the `/api/revalidate` webhook used only to bust caches
faster than D1 read-replica lag.

## What lives on this side

| Concern                    | File                                                                      | Behavior                                                                                 |
| -------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| CMS read + 3-tier fallback | section `.astro` resolvers                                                | edge tag → `cms:*` KV (1h) → D1 `cms_content` → i18n defaults                            |
| Revalidation webhook       | `src/pages/api/revalidate.ts`                                             | Bearer-auth; purge `isr:*`, inject allowlisted+sanitized `cms:*`, IndexNow, CF tag purge |
| Service config read        | `src/lib/service-config.ts`                                               | mem 10s → Cache-API 60s → D1 `service_config` → hardcoded `DEFAULTS`                     |
| Route-policy resolver      | `src/lib/route-policy.ts`                                                 | first-match-wins, clamped `[0,1]`, fail-safe to legacy                                   |
| Client runtime config      | `src/pages/api/runtime-config.ts`, `src/scripts/runtime-config-client.ts` | secret-free subset, CDN-cached 60s                                                       |
| Booking dual-write         | `src/pages/api/booking.ts`                                                | D1 `booking_attempts` (dead-letter) + Supabase + `EMAIL_QUEUE`                           |

## Top priority: durability (Phase 1)

Previously the pipeline **failed open and silent** — if a publish's revalidation
failed after 3 in-request retries, D1 was ahead of the edge for up to 1h (`cms:*`
TTL) / 24h (ISR `s-maxage`) with no automatic redrive.

**Status (live in prod, verified 2026-06-10):** the durability spine is shipped.

1. **Outbox + Queue-driven revalidation** with retries + DLQ + auto-redrive — live
   (cf-admin consumer; `sync_outbox` migration applied). Guarantees propagate-or-DLQ.
2. **`GET /api/cms-status` read-back** — shipped, so cf-admin verifies content is
   _actually_ live (not just "saved").

cf-astro-side work — all shipped:

- ✅ `GET /api/cms-status` read-back endpoint.
- ✅ `config` cache-tag on `/api/runtime-config`, purged on `{kind:'config'}`.
- ✅ booking email-retry: `booking_attempts` carries the email payload (migration
  `0008`, applied in prod); the reconciler runs in cf-admin's 5-min cron.
- ✅ `sync-contract.ts` single-sources `RATE_LIMITS` / `DEFAULTS.ratelimit` /
  `CMS_KEY_ALLOWLIST` (Phase 3.1).
- ⏳ still open: align the `cms:*` TTL vs ISR `s-maxage` clocks (deferred —
  superseded by the redrive); CSP nonce; webhook HMAC (Phase 4).

See the canonical document for the full findings, phasing, and current status.

{% endraw %}
