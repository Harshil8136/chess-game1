{% raw %}
# Silent Blank Screen (SSR Hydration Failure)

> **Status:** Resolved & Permanently Hardened (April 2026)  
> **Prevention System:** 3-Layer Error Shield deployed to core infrastructure

## The Symptom
When navigating to the dashboard (or any route doing server-side rendering of Preact islands), the page abruptly loaded as a completely **blank white screen**.
- Normal HTTP 200 response returned by the server.
- No network errors in the browser console.
- Missing HTML `<body>` tags in the DOM completely (HTML streaming was aborted midway).
- The terminal output showed the request started processing but quietly failed to output an HTML document.

## Root Cause Taxonomy — The 3 SSR Crash Patterns

Astro SSR renders `client:load` components **synchronously** on the server. Any unhandled exception during this phase instantly kills the HTML stream, producing a blank page with zero error feedback.

We have identified **3 distinct patterns** that cause this silent crash:

### Pattern 1: Missing Default Export
**Severity:** Fatal — Astro imports `undefined` and the entire render aborts.

```tsx
// ❌ CRASH — Astro's client:load expects a default export
export function DashboardController() { ... }

// ✅ SAFE
export default function DashboardController() { ... }
```

**How it happens:** Astro's island loader does `import Component from './Component'`. If the file only has a named export, `Component` resolves to `undefined`. When Astro tries to render `undefined`, the stream dies.

### Pattern 2: Non-Existent API Route
**Severity:** Functional failure — Dashboard renders but stays stuck on loading forever.

```tsx
// ❌ BROKEN — this endpoint doesn't exist
const res = await fetch('/api/admin/analytics');

// ✅ CORRECT — matches the actual file at src/pages/api/dashboard/metrics.ts
const res = await fetch('/api/dashboard/metrics');
```

**How it happens:** API call 404s silently. The component never transitions out of the loading state. Combined with other issues, can contribute to a page that appears blank.

### Pattern 3: Unguarded Property Access
**Severity:** Fatal — TypeError crashes the SSR pipeline mid-stream.

```tsx
// ❌ CRASH — pg is null during SSR, non-null assertion lies to TypeScript
<PostgresTab pg={pg!} />
// Inside PostgresTab:
const ramUsedPct = fmtPct(pg.ramTotal - pg.ramAvailable, pg.ramTotal);
// → TypeError: Cannot read properties of undefined (reading 'ramTotal')

// ✅ SAFE — guard first, access later
if (!pg) return <LoadingSkeleton />;
const ramUsedPct = fmtPct((pg.ramTotal ?? 0) - (pg.ramAvailable ?? 0), pg.ramTotal ?? 1);
```

**How it happens:** During SSR, async data hasn't been fetched yet. Any component that accesses data properties without a null guard will throw during the synchronous server render phase.

## Postmortem: April 2026 Dashboard Incident

**Timeline:**
1. `DashboardController` was created with a **named export** (Pattern 1)
2. It fetched from `/api/admin/analytics` which **did not exist** (Pattern 2)
3. `initialStats` props from the Astro page were **ignored** (not wired into component)
4. Previously, `SupabaseAuthWidget > PostgresTab` had **unguarded `pg!` access** (Pattern 3)

**Resolution applied:**
- Changed to `export default function DashboardController`
- Fixed API URL to `/api/dashboard/metrics`
- Wired `initialStats` props into component state
- Added null-safety guard in TopBar.tsx for `userName`

## Prevention Infrastructure (Deployed)

### Layer 1: ErrorBoundary → Sentry
Every dashboard widget is now wrapped in `<ErrorBoundary sectionName="...">`. When a widget crashes:
- User sees "X is temporarily unavailable" + "Try Again" button
- Error is reported to Sentry with section tag and component stack
- Other widgets continue working normally

### Layer 2: Global `window.onerror` Safety Net
An inline `<script>` in `AdminLayout.astro` captures errors **before** any Preact island hydrates. This catches hydration failures that no ErrorBoundary can catch.

### Layer 3: Sentry `@sentry/astro` Integration
Framework-level capture via `sentry.server.config.ts` and `sentry.client.config.ts`. All `console.error` calls are automatically captured via the CaptureConsole integration.

## Diagnostic Playbook — Debugging Future Blank Screens

If a blank screen recurs, follow this checklist in order:

1. **Check Sentry** — Look for errors tagged `error.source: error_boundary` or `error.section: *`
2. **Check browser console** — Look for `[GlobalErrorCapture]` or `[ErrorBoundary]` logs
3. **Hit `/api/debug-ssr`** — Returns JSON diagnostics for all SSR subsystems (dev role only)
4. **Verify the component**:
   - Does it have `export default`?
   - Does the API route exist in `src/pages/api/`?
   - Does it guard all data props with `if (!data) return <Loading />`?
   - Does it avoid `window`/`document` outside `useEffect`?
5. **Check Cloudflare Workers logs** — Real-time via Wrangler or Cloudflare dashboard
6. **Inspect the HTML** — View page source; if `<body>` is missing or truncated, the SSR pipeline crashed
{% endraw %}
