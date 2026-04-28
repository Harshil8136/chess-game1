{% raw %}
# Edge Feature Routing — Feature Flag Consumption in cf-astro

> **Scope**: `cf-astro` — Covers how the public-facing site consumes feature flags set by `cf-admin`.
>
> **Last Updated**: 2026-04-25

---

## 1. Overview

Feature flags are managed in the `cf-admin` dashboard (Feature Configuration page, DEV-only) and stored in the shared D1 database (`admin_feature_flags` table). The public-facing `cf-astro` site consumes these flags at runtime via its middleware, with a 60-second KV cache layer to minimize D1 reads.

This architecture enables **instant, deployment-free** changes to site behavior — a flag toggled in `cf-admin` propagates to all `cf-astro` edge nodes within 60 seconds.

---

## 2. Architecture Diagram

```
┌─────────────────┐     toggle      ┌─────────────────┐
│   cf-admin      │ ──────────────→ │   D1 Database   │
│ (DEV user)      │  POST /api/     │ admin_feature_   │
│                 │  features/      │ flags            │
└─────────────────┘  toggle         └────────┬────────┘
                                             │
                                             │ SELECT (on cache miss)
                                             ▼
┌─────────────────┐    KV cache     ┌─────────────────┐
│   cf-astro      │ ◄────────────── │   KV Store      │
│ (middleware)     │  60s TTL        │ ISR_CACHE        │
│                 │                 │ key: features:   │
│ locals.features │                 │ global           │
└─────────────────┘                 └─────────────────┘
```

---

## 3. Middleware Implementation

Feature flags are loaded **on every request** in `cf-astro/src/middleware.ts`:

```typescript
// 1. Load Feature Flags (Cached with 60s TTL)
locals.features = {};
try {
  const FLAGS_CACHE_KEY = 'features:global';
  const cachedFlags = await env.ISR_CACHE.get(FLAGS_CACHE_KEY, 'json');
  if (cachedFlags) {
    locals.features = cachedFlags as Record<string, boolean>;
  } else if (env.DB) {
    const { results } = await env.DB.prepare(
      'SELECT flag_key, is_enabled FROM admin_feature_flags'
    ).all();
    const flagsMap: Record<string, boolean> = {};
    for (const row of results) {
      flagsMap[row.flag_key as string] = Boolean(row.is_enabled);
    }
    locals.features = flagsMap;
    if (cfContext?.waitUntil) {
      cfContext.waitUntil(
        env.ISR_CACHE.put(
          FLAGS_CACHE_KEY,
          JSON.stringify(flagsMap),
          { expirationTtl: 60 }
        )
      );
    }
  }
} catch (e) {
  // Silent fallback — site operates without flags
}
```

### 3.1 Cache Strategy

| Property | Value |
|----------|-------|
| **Cache key** | `features:global` |
| **Cache store** | KV (`ISR_CACHE` binding) |
| **TTL** | 60 seconds |
| **Fallback** | Direct D1 query on cache miss |
| **Error behavior** | Silent — `locals.features` defaults to `{}` |

### 3.2 Why KV, Not Caches API?

The Cloudflare Caches API is colo-local (each PoP caches independently). KV provides global consistency — a flag toggle propagates to all edge locations uniformly within the TTL window.

---

## 4. Consuming Flags in Pages & Components

Feature flags are available on `Astro.locals.features` in any `.astro` page or API route:

```astro
---
const features = Astro.locals.features || {};
const showNewBookingFlow = features['new_booking_flow'] ?? false;
---

{showNewBookingFlow && <NewBookingWidget />}
```

For Preact islands, pass flags as props from the Astro page:

```astro
<MyIsland client:load enableBeta={features['beta_ui'] ?? false} />
```

---

## 5. Flag Lifecycle

### 5.1 Creation

Flags are created by inserting rows into `admin_feature_flags` in D1 (typically via a migration or the Feature Configuration UI in `cf-admin`).

### 5.2 Toggle

A DEV user toggles a flag in `cf-admin`. The `POST /api/features/toggle` endpoint:
1. Validates DEV role (403 if not DEV)
2. Updates D1 via `FeatureFlagRepository.setFlagStatus()`
3. Logs the action via `ctx.waitUntil()` (respects Ghost Mode)

### 5.3 Propagation

After a D1 write, the old KV cache entry still has up to 60 seconds remaining on its TTL. The next `cf-astro` request after TTL expiry will trigger a cache miss, D1 read, and KV repopulation.

**Maximum propagation delay**: 60 seconds (KV TTL)

### 5.4 Consumption

`cf-astro` middleware reads from KV (fast path) or D1 (cache miss), attaches the flags map to `locals.features`, and every page/component can branch on any flag.

---

## 6. Performance Impact

| Metric | Hot Path (KV hit) | Cold Path (KV miss) |
|--------|--------------------|--------------------|
| **Latency** | <1ms (KV read) | ~5–10ms (D1 query) |
| **D1 reads** | 0 | 1 (all flags in single query) |
| **KV writes** | 0 | 1 (via `ctx.waitUntil`, post-response) |

The KV write on cache miss uses `ctx.waitUntil()` so it does not block the response.

---

## 7. Security Notes

- Feature flags are **read-only** in `cf-astro` — there is no write endpoint
- Flag management is restricted to DEV role in `cf-admin` (SSR + API guards)
- The D1 table is shared between both projects via the same binding (`DB`)
- No sensitive data is stored in flags — they are simple key-boolean pairs

---

## 8. Related Documentation

- `cf-admin/documentation/edge-command-center.md` — Full architecture of the Feature Configuration UI, Ghost Mode, and Ghost Audit Engine
- `cf-admin/documentation/plac-and-audit.md` — PLAC access control and audit log architecture

{% endraw %}
