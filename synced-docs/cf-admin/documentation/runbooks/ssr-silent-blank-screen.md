---

title: "Silent Blank Screen (SSR Hydration Failure)"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code]
owner: harshil
tags: [runbook, ssr, preact, observability]
---

# Silent Blank Screen (SSR Hydration Failure)

> **TL;DR (non-technical):** A troubleshooting playbook for a past failure mode — a server-rendered page showing a silent blank screen — and how to diagnose and prevent it.

> **Status of the April 2026 incident:** Resolved & Permanently Hardened.
> **The page stays `active` for the Diagnostic Playbook**, which is the part
> that gets used and the part that had drifted — the history below is kept
> because the three crash patterns still explain most blank screens.
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

### Layer 1: ErrorBoundary → console, and Sentry *if* it is there

Dashboard widgets are wrapped in `<ErrorBoundary sectionName="...">`
(`src/components/ui/ErrorBoundary.tsx`). **Two** mounting files as of
2026-09-19 — `src/components/dashboard/DashboardController.tsx` and
`src/pages/dashboard/bookings/index.astro` (`src/middleware.ts` only mentions
the name in a comment). When a widget crashes:

- **The user sees Spanish UI**, and these are the strings to look for in a
  screenshot or a support ticket: heading `Error en <sectionName>`, body
  `Ocurrió un error inesperado en la interfaz…`, the raw `error.message` in a
  `<pre>`, and a **`Reintentar componente`** button. *(This section promised
  "X is temporarily unavailable" and "Try Again" until 2026-09-19. Neither
  string exists in the product.)*
- `[Preact Island ErrorBoundary Caught in <sectionName>]:` is logged to the
  console unconditionally.
- The Sentry report is **conditional** on a `window.Sentry` global
  (`win?.Sentry?.captureException`), tagged `preact.island_boundary: 'true'`
  and `preact.section_name`. Nothing in this repo assigns `window.Sentry` — the
  browser SDK is an ES-module import — so do not assume a boundary catch
  reached Sentry. The console line is the reliable one.
- Other widgets continue working normally.

### Layer 2: Global error-listener safety net

`AdminLayout.astro` loads `public/scripts/error-capture.js` — a nonce-carrying `<script is:inline src>`, not an inline script body — which registers `window` `error` and `unhandledrejection` **listeners** (`addEventListener`, not the `window.onerror` property this heading claimed until 2026-09-19) **before** any Preact island hydrates. This catches hydration failures that no ErrorBoundary can catch.

What it actually does with what it catches: it returns early if `window.Sentry`
already exists, otherwise buffers into `window.__earlyErrors`, logs
`[Early Error Buffered]:` / `[Early Promise Rejection Buffered]:`, and drains
the buffer to Sentry only if `window.Sentry` appears within ~5 s. **It does not
report to Sentry by itself.** Its one piece of recovery UI is a single
`location.reload()` on a chunk-404. *(Corrected 2026-09-14: this said "an
inline script". Corrected 2026-09-19: the heading and the Sentry claim.
`OPERATIONS.md` §4.2 links here — this runbook owns the description.)*

### Layer 3: Sentry (`@sentry/cloudflare` on the server, `@sentry/astro` in the browser)

Server side, `@sentry/cloudflare`'s `withSentry` wraps the whole Worker in `src/workers/cf-entry.ts` and forwards console output through `consoleLoggingIntegration`; `sentry.server.config.ts` is a deliberate no-op because the `@sentry/astro` server SDK does not run in workerd. Browser side, `sentry.client.config.ts`. *(Corrected 2026-09-14 — this paragraph described the Astro server SDK and a "CaptureConsole" integration, neither of which is what runs; see `OPERATIONS.md` §4.)*

## Diagnostic Playbook — Debugging Future Blank Screens

If a blank screen recurs, follow this checklist in order:

1. **Check the browser console first** — it is the only layer that always
   fires. The real prefixes are:
   - `[Preact Island ErrorBoundary Caught` … (Layer 1)
   - `[Early Error Buffered]:` and `[Early Promise Rejection Buffered]:` (Layer 2)

   *(Until 2026-09-19 this step named `[GlobalErrorCapture]` and
   `[ErrorBoundary]`. Neither string exists anywhere in the repo.)*
2. **Check Sentry** — search the tags `preact.island_boundary` and
   `preact.section_name`. *(`error.source` / `error.section`, which this step
   named until 2026-09-19, are not set by anything and return nothing.)*
   Remember Layer 1's Sentry call is conditional: a miss here does not mean the
   boundary did not fire.
3. **Run the diagnostics page** — `/dashboard/debug/diagnostics`
   (vendor-support only) mounts `SystemDiagnostics.tsx` and POSTs
   `/api/diagnostics/run`, exercising the D1/R2/KV/Supabase/Upstash/Analytics
   probes in `src/lib/diagnostics/`. `/dashboard/debug` itself is only a
   landing hub. *(This step previously said to hit `/api/debug-ssr`, a route that was removed and no longer exists. The hub-vs-page distinction was corrected 2026-09-19.)*
4. **Verify the component**:
   - Does it have `export default`?
   - Does the API route exist in `src/pages/api/`?
   - Does it guard all data props with `if (!data) return <Loading />`?
   - Does it avoid `window`/`document` outside `useEffect`?
5. **Check Cloudflare Workers logs** — Real-time via Wrangler or Cloudflare dashboard
6. **Inspect the HTML** — View page source; if `<body>` is missing or truncated, the SSR pipeline crashed

## Re-verification

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | `src/components/ui/ErrorBoundary.tsx` and `public/scripts/error-capture.js` read line by line; `grep -rln ErrorBoundary src/`; `grep` for every string the Diagnostic Playbook names | **Every string in the playbook was wrong** — the Sentry tags, both console prefixes and the fallback wording — and that is the only part anyone uses under pressure. Playbook rewritten with the real tags (`preact.island_boundary`, `preact.section_name`), the real prefixes and the real Spanish UI text; mounting files corrected from three to **two**; Layer 1's Sentry call marked conditional on a `window.Sentry` global nothing sets; Layer 2's heading corrected from `window.onerror` to listeners; the diagnostics link pointed at `/dashboard/debug/diagnostics`. Not re-derived: the three crash patterns and the April 2026 post-mortem (history) |
| 2026-09-14 | `ls` / `grep` for every file and route this runbook names: `src/components/ui/ErrorBoundary.tsx`, `src/components/navigation/TopBar.tsx`, `src/pages/api/dashboard/metrics.ts`, `/dashboard/debug`, `src/lib/diagnostics/`, `public/scripts/error-capture.js` and its `<script>` tag in `AdminLayout.astro`, the Sentry wiring in `src/workers/cf-entry.ts` | All present. Two paragraphs corrected above (Layer 2's script is a static file, Layer 3 is `withSentry` + `consoleLoggingIntegration`, not the Astro server SDK); the three crash patterns and the April 2026 post-mortem are history and were not re-derived |
