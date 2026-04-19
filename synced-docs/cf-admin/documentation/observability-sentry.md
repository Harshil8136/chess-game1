{% raw %}
# Edge Observability & Error Tracking

> **System Status:** Production Ready
> **Last Updated:** April 2026

This document explains the technical implementation of error tracking and observability in the `cf-admin` portal using **Sentry for Cloudflare**.

## 1. Zero-Latency Observability Pipeline

We use `@sentry/cloudflare` to provide unified Edge Observability directly at the CDN layer. This tracks all server-side exceptions, unhandled Promise rejections, and rendering errors without degrading system performance.

### 1.1 Implementation Details

The Sentry Edge Observer is centralized in `sentry.server.config.ts`. 

**Key architectural decisions:**

- **Full trace sampling** is enabled to monitor all application executions.
- **Default browser integrations are disabled** â€” Cloudflare Workers run on the V8-based `workerd` runtime, NOT a browser environment. Sentry's default integrations include browser-specific tracers (`BrowserTracing`, `GlobalHandlers`, `LinkedErrors`) that reference `window` and `document`, which do not exist in the `workerd` runtime. These must be disabled to prevent runtime crashes.
- **Only server-compatible integrations are used** â€” specifically the Console Capture integration for error and warning levels.

> **âš ï¸ workerd Compatibility Note:** Any future integrations added to the Sentry config must be validated against the `workerd` runtime. Browser-targeting integrations will cause `ReferenceError: window is not defined` crashes at Worker startup.

### 1.2 "Capture Console" Integration

To simplify the codebase and maintain the "Lean Edge" philosophy, we intentionally avoided littering the API handlers with explicit Sentry capture calls.

Instead, we enabled the Console Capture integration. Any native `console.error` logs in standard JavaScript automatically trigger an event capture and are immediately securely vaulted in Sentry along with the stack trace, metadata, and user agent info.

## 2. Hardcoded Public DSN

During implementation, it was discovered that Astro's Cloudflare adapter and Vite environment injection suffered from inconsistent scoping during runtime SSR operations. 

**Architectural Decision:** We hardcoded the raw DSN value inside the configuration file.
*   **Security Context:** A Sentry DSN is a public routing key. It is *not* a sensitive cryptographic secret (unlike API keys or JWT signatures). Exposing it purely allows the codebase to push errors to the ingestion endpoint.
*   **Benefits:** Guarantees 100% telemetry uptime, eliminating missing logs caused by environment binding mismatches in standard `wrangler.toml` setups.

## 3. Usage inside Endpoints

Thanks to the automated pipeline, if a database query fails during an API request, the developer simply logs the error using `console.error` with a descriptive module tag. This naturally triggers the Sentry interceptor with the full stack context attached, and a sanitized generic error is returned to the client.

## 4. SSR Hydration Guard & Resilience System

To ensure strict zero-crash rendering resilience, the Admin dashboard leverages an **SSR Hydration Guard** to prevent silent "blank page" crashes.

### 4.1 Global error Safety Net
A global front-end safety net (\window.onerror\ and \window.onunhandledrejection\) is injected directly into the Astro layout (\AdminLayout.astro\). Instead of users experiencing a silent crash loop, unhandled client-side parsing or hydration exceptions trigger an immediate telemetry report to Sentry, allowing near-instantaneous debugging on production.

### 4.2 Preact ErrorBoundary Integration
High-risk UI components (such as interactive data widgets, charts, and API-bound tables) are wrapped in a generic Preact \ErrorBoundary\. 
If a sub-component experiences a rendering exception (e.g., trying to map over an undefined variable due to a malformed API response), the boundary catches the error, sends a detailed crash report to Sentry silently, and gracefully renders a fallback UI component ("Widget Failure") instead of propagating the crash and taking down the entire dashboard structure.
{% endraw %}
