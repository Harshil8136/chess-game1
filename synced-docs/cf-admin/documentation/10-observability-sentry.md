# Edge Observability & Error Tracking

> **System Status:** Production Ready
> **Last Updated:** April 2026

This document explains the technical implementation of error tracking and observability in the `cf-admin` portal using **Sentry for Cloudflare**.

## 1. Zero-Latency Observability Pipeline

We use `@sentry/cloudflare` to provide unified Edge Observability directly at the CDN layer. This tracks all server-side exceptions, unhandled Promise rejections, and rendering errors without degrading system performance.

### 1.1 Implementation Details

The Sentry Edge Observer is centralized in `sentry.server.config.ts`. 

```typescript
import * as Sentry from '@sentry/cloudflare';

Sentry.init({
  // Hardcoded to bypass Cloudflare Worker environment scope issues across Astro
  dsn: "https://your-dsn-string-here.ingest.us.sentry.io/PROJECT_ID",

  // Monitor application execution
  tracesSampleRate: 1.0,
  
  // CRITICAL: Disable default browser-based integrations (BrowserTracing, etc.)
  // They reference `window`/`document` which do not exist in Cloudflare's workerd runtime.
  // Without this, the Worker crashes on startup with "ReferenceError: window is not defined".
  defaultIntegrations: false,
  
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error', 'warn']
    })
  ]
});
```

> **⚠️ workerd Compatibility Note:** Cloudflare Workers run on the V8-based `workerd` runtime, NOT a browser environment. Sentry's default integrations include browser-specific tracers (`BrowserTracing`, `GlobalHandlers`, `LinkedErrors`) that reference `window` and `document`. These must be disabled via `defaultIntegrations: false` to prevent runtime crashes. Only server-compatible integrations like `captureConsoleIntegration` should be used.

### 1.2 "Capture Console" Integration

To simplify the codebase and maintain the "Lean Edge" philosophy, we intentionally avoided littering the API handlers with `Sentry.captureException()` blocks.

Instead, we enabled the `captureConsoleIntegration`. Any native `console.error` logs in standard JavaScript automatically trigger an event capture and are immediately securely vaulted in Sentry along with the stack trace, metadata, and user agent info.

## 2. Hardcoded Public DSN

During implementation, it was discovered that Astro's Cloudflare adapter and vite environment injection (`env.SENTRY_DSN`) suffered from inconsistent scoping during runtime SSR operations. 

**Architectural Decision:** We hardcoded the raw `DSN` value inside the configuration file.
*   **Security Context:** A Sentry DSN is a public routing key. It is *not* a sensitive cryptographic secret (unlike API keys or JWT signatures). Exposing it purely allows the codebase to push errors to the ingestion endpoint.
*   **Benefits:** Guarantees 100% telemetry uptime, eliminating missing logs caused by environment binding mismatches in standard `wrangler.toml` setups.

## 3. Usage inside Endpoints

Thanks to the automated pipeline, if a D1 database query fails during an `API` request, the developer simply uses:

```typescript
} catch (error) {
  console.error('[Gallery CMS Error]', error);
  return jsonError('Failed to process gallery sync');
}
```

This naturally triggers the Sentry interceptor with the full stack context attached. 
