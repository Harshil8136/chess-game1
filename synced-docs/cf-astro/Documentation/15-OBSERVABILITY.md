# 15 — Observability (Sentry + BetterStack)

> **Added:** 2026-04-19
> **Status:** ✅ Fully integrated, build-verified

---

## Overview

The cf-astro project uses a two-layer observability stack, both on free tiers:

| Layer | Service | SDK | Scope | Free Tier |
|-------|---------|-----|-------|-----------|
| **Error Monitoring** | Sentry | `@sentry/browser` | Client-side (browser JS) | 5K errors/month, 30-day retention |
| **Structured Logging** | BetterStack | `@logtail/edge` | Server-side (API routes) | 3GB logs, 3-day retention |

**Both are $0/month** and have zero impact on site performance.

---

## Sentry — Client-Side Error Tracking

### Architecture Decision

We explicitly **rejected** the standard `@sentry/astro` integration and the Sentry Loader Script for this project:

| Approach | Why Rejected |
|----------|-------------|
| `@sentry/astro` | Triggers `TypeError: addEventListener(): useCapture must be false` during prerender with the Cloudflare adapter (`output: 'static'`) |
| Sentry Loader Script | Uncontrollable bundle — loads tracing, replay, and features we don't need, wasting free-tier budget |
| `@sentry/browser` ✅ | Manual, minimal setup. ~20KB gzipped. Full control over integrations. |

### Files

| File | Purpose |
|------|---------|
| `src/scripts/sentry.ts` | Sentry init module — exports `initSentry()` and `captureException` |
| `src/layouts/BaseLayout.astro` | Loads sentry.ts via `requestIdleCallback` (deferred, non-blocking) |
| `astro.config.ts` | Contains `@sentry/vite-plugin` for source map upload |

### Configuration

```typescript
// src/scripts/sentry.ts
init({
  dsn: SENTRY_DSN,
  environment: 'production',
  release: `cf-astro@${buildId}`,
  defaultIntegrations: false,
  integrations: [
    globalHandlersIntegration(),   // window.onerror + unhandledrejection
    breadcrumbsIntegration({ ... }),
    dedupeIntegration(),
    httpContextIntegration(),
  ],
  enableTracing: false,            // Saves 5M span budget entirely
  sampleRate: 1.0,                 // 100% — low traffic site
  maxBreadcrumbs: 30,
});
```

### What's Disabled (and Why)

| Feature | Status | Reason |
|---------|--------|--------|
| Tracing | ❌ Disabled | Saves the entire 5M span/month budget |
| Session Replay | ❌ Disabled | Saves the 50 replay budget; not needed for a marketing site |
| Default Integrations | ❌ Replaced | Using only 4 cherry-picked integrations instead of ~15 defaults |
| Console Breadcrumbs | ❌ Disabled | Noisy in dev; not useful for production error context |

### Noise Filtering

Filters configured to prevent quota waste on non-actionable errors:

- **`ignoreErrors`**: ResizeObserver loops, offline/Safari network errors, ad-blocker rejections, View Transitions AbortError
- **`denyUrls`**: Browser extensions (`chrome-extension://`, `moz-extension://`), third-party scripts (PostHog, Cloudflare Insights)

### Loading Strategy

```
Page Load → Paint → LCP → requestIdleCallback → initSentry()
```

Sentry is loaded **after** the browser is idle, ensuring zero impact on LCP or FID. Safari fallback uses `setTimeout(2000)`.

### Source Maps

Source maps enable readable stack traces in the Sentry dashboard.

```typescript
// astro.config.ts — only activates when SENTRY_AUTH_TOKEN is set
sentryVitePlugin({
  org: 'pet-hotel-madagascar',
  project: 'cf-astro',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  release: { name: `cf-astro@${buildId}` },
  sourcemaps: {
    filesToDeleteAfterUpload: ['./dist/**/*.map'],  // Never serve to users
  },
})
```

**Build with source maps:**
```bash
# Windows (PowerShell)
$env:SENTRY_AUTH_TOKEN="sntrys_..."
npm run build

# Linux/Mac
SENTRY_AUTH_TOKEN="sntrys_..." npm run build
```

### Consent

Sentry is **NOT** gated behind the consent banner. Error monitoring is classified as **operational** (not analytics). It collects:
- Error stack traces
- Browser/OS/URL context
- Click trail breadcrumbs

It does **not** collect: names, emails, session recordings, or behavioral data.

---

## BetterStack — Server-Side Structured Logging

### Architecture

```
API Request → createRequestLogger(request, token)
                    ↓
              Structured log entries (info/warn/error)
                    ↓
              logtail.flush() → Best-effort delivery
```

### Files

| File | Purpose |
|------|---------|
| `src/lib/logger.ts` | Logger factory — `createRequestLogger()` |
| `src/pages/api/booking.ts` | Instrumented with structured logging |

### Usage Pattern

```typescript
import { createRequestLogger } from '@lib/logger';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request }) => {
  const log = createRequestLogger(
    request,
    (env as any).BETTERSTACK_SOURCE_TOKEN
  );

  log.info('Booking created', { bookingRef, durationMs: 42 });
  log.warn('Validation failed', { errors: fieldErrors });
  log.error('Database error', { error: err.message });
};
```

### Automatic Metadata

Every log entry automatically includes:

| Field | Source | Example |
|-------|--------|---------|
| `url` | `request.url` | `https://madagascarhotelags.com/api/booking` |
| `method` | `request.method` | `POST` |
| `ip` | `cf-connecting-ip` header | `189.203.x.x` |
| `country` | `cf-ipcountry` header | `MX` |
| `userAgent` | `user-agent` header (truncated 120 chars) | `Mozilla/5.0...` |
| `ray` | `cf-ray` header | `8f2a1b3c4d5e6f7-DFW` |

### Dev Mode Fallback

When `BETTERSTACK_SOURCE_TOKEN` is not configured (local dev), the logger falls back to `console.log/warn/error` with structured output — no external calls made.

---

## Environment Variables

### Runtime Secrets (set via `wrangler secret put`)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `BETTERSTACK_SOURCE_TOKEN` | Server (API routes) | BetterStack Logtail source token |
| `SENTRY_DSN` | Server (cf-admin reference) | Sentry DSN for server-side use |

### Build-Time Secrets (set as system env var)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `SENTRY_AUTH_TOKEN` | Build only | Uploaded source maps. Not needed at runtime. |

### Public (embedded in client bundle)

| Variable | Scope | Purpose |
|----------|-------|---------|
| `PUBLIC_SENTRY_DSN` | Client | Sentry DSN (hardcoded in `sentry.ts` — public by nature) |

---

## CSP Headers

The following origins were added to `public/_headers` `connect-src`:

```
connect-src 'self' 
  https://*.posthog.com 
  https://*.ingest.us.sentry.io     ← Sentry error ingestion
  https://in.logs.betterstack.com   ← BetterStack log ingestion
  ...
```

---

## Instrumented API Routes

| Route | Events Logged |
|-------|--------------|
| `POST /api/booking` | `Booking created` (success with ref, service, pet count, duration), `Booking validation failed` (field errors), `Booking failed` (error + stack), `Booking rate limited` |

### Adding Logging to New API Routes

```typescript
import { createRequestLogger } from '@lib/logger';
import { env } from 'cloudflare:workers';

export const POST: APIRoute = async ({ request }) => {
  const log = createRequestLogger(
    request, 
    (env as any).BETTERSTACK_SOURCE_TOKEN
  );

  try {
    // ... your logic
    log.info('Operation completed', { key: 'value', durationMs: Date.now() - t0 });
    return new Response(JSON.stringify({ success: true }));
  } catch (err) {
    log.error('Operation failed', { error: err.message });
    return new Response(JSON.stringify({ success: false }), { status: 500 });
  }
};
```

---

## Free Tier Budget Management

| Service | Budget | Strategy |
|---------|--------|----------|
| **Sentry** | 5,000 errors/month | Tracing/Replay disabled. Noise filtering via `ignoreErrors`/`denyUrls`. Sample rate 1.0 (low traffic). |
| **BetterStack** | 3GB logs/month | Only critical API routes instrumented. No middleware-level logging. Short user-agent strings (120 char max). |

### Monitoring Usage

- **Sentry**: [sentry.io](https://sentry.io) → Settings → Subscription → Usage
- **BetterStack**: [logs.betterstack.com](https://logs.betterstack.com) → Sources → Usage

---

## Sentry + Preact Error Boundaries

The `captureException` function is exported from `src/scripts/sentry.ts` for use in Preact error boundaries:

```typescript
import { captureException } from '@/scripts/sentry';

class ErrorBoundary extends Component {
  componentDidCatch(error: Error) {
    captureException(error);
  }
}
```

This is already used in the cf-admin project's dashboard widgets and can be applied to any Preact island in cf-astro.

---

## Troubleshooting

### Sentry errors not appearing
1. Check browser console for `[Sentry] Init failed` warnings
2. Verify `PUBLIC_SENTRY_DSN` matches the Sentry project DSN
3. Ensure `*.ingest.us.sentry.io` is in CSP `connect-src`
4. Check Sentry dashboard → Issues (errors may take ~60s to appear)

### BetterStack logs not appearing
1. Verify `BETTERSTACK_SOURCE_TOKEN` is set (`wrangler secret put BETTERSTACK_SOURCE_TOKEN`)
2. Check `in.logs.betterstack.com` is in CSP `connect-src`
3. Logs appear in BetterStack dashboard within ~30s
4. In local dev, logs print to console (no external calls)

### Source maps not uploading
1. Ensure `SENTRY_AUTH_TOKEN` is set as a system env var (not `.dev.vars`)
2. Token must have `org:read` and `project:releases` scopes
3. Check build output for "Sentry" lines indicating upload status
