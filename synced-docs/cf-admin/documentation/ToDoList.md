{% raw %}
# cf-admin — Phase 4 Hardening Backlog

> **Context:** This document tracks all remaining hardening items from the senior dev + security audit conducted 2026-05-02. Phases 1–3 of the audit are complete (see `SECURITY.md` for a full record of what was fixed). Everything here is Phase 4: lower-severity polish, defensive hardening, and cleanup that carries no immediate incident risk but should be resolved before any significant traffic spike or security review.
>
> **How to read this doc:** Each item contains the exact file, exact line(s), root cause, why it matters, what the fix looks like, what NOT to do, and current status. Written for an AI IDE or future developer who has zero context from prior conversations.
>
> **Project stack reminder:** Astro 6 SSR + Cloudflare Workers + Preact Islands + Tailwind v4 + D1 (SQLite) + Supabase (Postgres) + Cloudflare Zero Trust for auth. No Node.js runtime — this is `workerd` (V8 isolates). `AbortSignal.timeout()` is natively supported in `workerd`.

---

## Status Legend

| Symbol | Meaning |
|--------|---------|
| ✅ DONE | Already resolved — verified by reading current code |
| 🔴 HIGH | Should be fixed this sprint — real risk, easy fix |
| 🟡 MEDIUM | Fix within 2 weeks — improves resilience or correctness |
| 🟢 LOW | Fix when convenient — polish, no operational risk |

---

## Item 1 — `.gitignore` gap for `.dev.vars`

**Status:** ✅ DONE — Already in `.gitignore` at line 19. No action needed.

**Verification:** Read `e:\1\Madagascar Project\cf-admin\.gitignore`. Line 19 reads:
```
.dev.vars
```

This was listed in the original audit as a gap but was already present. The concern was that `.dev.vars` contains ALL worker secrets in plaintext for local dev (Supabase service role key, Upstash tokens, Resend API key, Cloudflare API tokens, etc.). Accidental commit would be catastrophic. Confirmed it is excluded.

**What `.dev.vars` contains (for context):**
```
SUPABASE_SERVICE_ROLE_KEY=...
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
RESEND_API_KEY=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ZONE_ID=...
CF_API_TOKEN_READ_LOGS=...
CF_API_TOKEN_ZT_WRITE=...
SENTRY_AUTH_TOKEN=...
IP_HASH_SECRET=...
CHATBOT_ADMIN_API_KEY=...
SITE_URL=http://localhost:4321
REVALIDATION_SECRET=...
```

---

## Item 2 — `ActivityCenter.tsx` — Missing fetch timeouts

**Status:** ✅ DONE — All 5 fetch calls have `AbortSignal.timeout(N)` added (5000/8000/15000/10000/10000ms).

**File:** `src/components/admin/logs/ActivityCenter.tsx`

**What ActivityCenter is:** The main audit log viewer in the admin dashboard. It has 4 tabs (Activity, Emails, Consent, Security) and fetches paginated data from internal API routes. It is a Preact island mounted with `client:load`.

**The problem:**
Every `fetch()` call in this component has no timeout. If the Workers API route is slow (D1 query backpressure, rate limit queuing, Supabase latency spike), the fetch hangs indefinitely. The user sees a loading spinner forever. In `workerd`, the Worker itself has a 10ms CPU budget and a 30s wall-clock limit, but the *browser-side* Preact component has no such guard — it will hang until the TCP connection resets.

**Exact lines that need fixing:**

1. **`fetchStats()`** — Line 80:
   ```typescript
   fetch('/api/audit/stats', { cache: 'no-store' })
   ```
   No timeout. Stats are non-critical; if they take >5s something is wrong.

2. **`fetchData()`** — Line 102:
   ```typescript
   const res = await fetch(`${apiMap[activeTab]}?${qs}`, {
     cache: 'no-store',
     headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
   });
   ```
   No timeout. This is the main paginated data load — the one the user is actively waiting for.

3. **`handleExport()`** — Line 142:
   ```typescript
   const res = await fetch('/api/audit/export?source=audit', { method: 'POST' });
   ```
   No timeout. Export downloads CSV of all audit logs — if there are 10k+ rows, this could take 3-8 seconds legitimately, but still needs a ceiling.

4. **`executePrune()`** — Line 163:
   ```typescript
   const res = await fetch('/api/audit/prune?days=30', { method: 'DELETE' });
   ```
   No timeout. Prune is a destructive bulk DELETE across D1. If D1 is under load this hangs.

5. **`executeBulkDelete()`** — Line 216:
   ```typescript
   const res = await fetch(apiMap[activeTab], {
     method: 'DELETE',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({ ids: Array.from(selectedIds) })
   });
   ```
   No timeout. Bulk delete of selected IDs — no ceiling.

**How to fix:**
Add `signal: AbortSignal.timeout(N)` to each fetch options object. Choose timeouts based on expected latency:
- `fetchStats`: 5000ms (stats query is cheap)
- `fetchData`: 8000ms (paginated query, may involve D1 + Supabase)
- `handleExport`: 15000ms (CSV generation can be slow for large datasets)
- `executePrune`: 10000ms (bulk DELETE takes time)
- `executeBulkDelete`: 10000ms (bulk DELETE)

**Example fix for `fetchData`:**
```typescript
const res = await fetch(`${apiMap[activeTab]}?${qs}`, {
  cache: 'no-store',
  headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' },
  signal: AbortSignal.timeout(8000),
});
```

**When `AbortSignal.timeout` fires**, the fetch throws a `DOMException` with `name === 'TimeoutError'`. The existing `catch (err: unknown)` at line 127 already handles it:
```typescript
} catch (err: unknown) {
  setError((err as Error).message || 'Network error');
}
```
So the user would see "The operation was aborted." or "TimeoutError" — not ideal UX but functional. Optionally, check `err instanceof DOMException && err.name === 'TimeoutError'` to show a friendlier "Request timed out. Please try again." message.

**What NOT to do:**
- Do not use `setTimeout` + `AbortController` manually — `AbortSignal.timeout()` is a single-call native API available in all modern browsers and `workerd`.
- Do not set a global timeout of 30s for export and 5s for everything else in the same constant — each operation has different expected latency.

**Why this matters:** Without timeouts, a transient D1 timeout or Workers cold-start can leave the entire audit log panel in an infinite loading state. Admins who rely on this panel during incidents (exactly when D1 might be under load) would be left with a broken UI.

---

## Item 3 — Breadcrumb `<a>` → `<span>` for the current (last) page

**Status:** ✅ DONE — Last crumb is now `<span aria-current="page">` with no `pointerEvents` hack.

**File:** `src/components/navigation/TopBar.tsx`

**Lines:** 94–98

**What TopBar breadcrumb does:**
The component takes `currentPath` (e.g. `/dashboard/users`) and builds an array of `{ label, href }` crumb objects. It renders them as a path like `Dashboard > Users`. The last crumb is the current page.

**The bug — exact code:**
```typescript
{i === breadcrumbs.length - 1 ? (
  <a href={crumb.href} className="text-[13px] font-semibold text-slate-900 dark:text-white" style={{ pointerEvents: 'none', textDecoration: 'none' }}>{crumb.label}</a>
) : (
  <a href={crumb.href} className="text-[13px] text-slate-500 ...">{crumb.label}</a>
)}
```

The last crumb (current page) is rendered as an `<a>` tag with `style={{ pointerEvents: 'none', textDecoration: 'none' }}` to visually and functionally disable it. This is semantically wrong for two reasons:

1. **Screen readers still announce it as a link** — `<a href="...">` is always a link element regardless of CSS. A screen reader user hears "link, Users" even though clicking does nothing. The correct element for non-navigating text is `<span>`.
2. **`pointerEvents: none` doesn't disable keyboard focus** — Tab navigation can still land on the element, and pressing Enter on a focused `<a>` follows the `href` (the `pointerEvents` CSS only affects mouse events, not keyboard). So a keyboard user can accidentally navigate to the current page and trigger an unnecessary page reload.

**The correct fix:**
```typescript
{i === breadcrumbs.length - 1 ? (
  <span className="text-[13px] font-semibold text-slate-900 dark:text-white" aria-current="page">
    {crumb.label}
  </span>
) : (
  <a href={crumb.href} className="text-[13px] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white no-underline transition-colors duration-200">
    {crumb.label}
  </a>
)}
```

Key changes:
- `<a>` → `<span>` for the last crumb
- Remove `pointerEvents: none` and `textDecoration: none` (no longer needed)
- Add `aria-current="page"` — this is the ARIA attribute that tells screen readers "this breadcrumb represents the current page"

**What the intermediate crumbs should stay as:** Real `<a>` tags — those ARE navigational links (e.g. clicking "Dashboard" takes you to `/dashboard`).

**Why this matters:** This is primarily an accessibility issue. With `aria-current="page"` missing, screen reader users have no machine-readable way to identify where they are in the navigation hierarchy. The WCAG 2.1 SC 1.3.1 (Info and Relationships) and SC 4.1.2 (Name, Role, Value) both apply here.

---

## Item 4 — Silent `catch {}` blocks audit — fix the real ones

**Status:** ✅ DONE — All silent catches fixed. `ExpandedRow.tsx`: `handleCheckSessions` + `handleLoadLoginHistory` now call `setActionError`; `actionError` displayed in Command Center UI. `UsersTable.tsx`: `handleRoleChange`, `handleSuspend`, `handleDelete` all call `console.error`.

**Background:** A `} catch {}` that completely swallows an exception without logging or surfacing an error to the user means silent failure — the user clicks a button, nothing happens, and there is no indication that an error occurred. This is different from *intentional* silent catches (like a JSON parse fallback that returns a default value).

**Audit results — full classification:**

### ✅ INTENTIONAL — Do not change these:

| File | Line | Why it's OK |
|------|------|-------------|
| `src/lib/formatters.ts:11,22` | `} catch { return '—'; }` | Date formatting fallback — malformed dates become a dash. No error to surface, correct behavior. |
| `src/lib/env.ts:24` | `} catch { // Not in Workers/Miniflare context }` | Has explicit comment. Guards against Workers runtime not being available at build time. |
| `src/lib/env.ts:83,99` | `} catch { return null; }` | Guards optional env accessor. Returns null which all callers handle. |
| `src/components/admin/logs/shared.tsx:109` | `tryParseJSON` | This IS the point — if JSON.parse throws, return the raw string. Correct behavior. |
| `src/components/admin/content/GalleryManager.tsx:26` | URL parse fallback | Returns original URL on parse failure — correct degradation. |
| `src/components/admin/chatbot/BotConfig.tsx:63` | `/* keep defaults on malformed JSON */` | Has explicit comment. Keeps sane defaults on bad config. |
| `src/lib/dal/PageRegistryRepository.ts:236` | Override count fallback | Returns 0 instead of crashing the impact preview. Override count is non-critical. |
| `src/pages/api/users/[id]/session-status.ts:76` | `// Corrupt session entry — skip` | Has comment. Skips malformed KV entries rather than crashing the whole session list. |
| `src/pages/api/media/gallery.ts:28` | JSON parse fallback | Gallery data defaults to `[]` on parse error — correct degradation. |
| `src/components/navigation/TopBar.tsx:179` | Logout redirect fallback | If the `/api/auth/logout` JSON parse fails, falls back to navigating directly. Correct. |
| `src/pages/api/content/services.ts:33` | Pricing JSON parse | Falls back to `{}` if D1 returns unparseable content. Prevents 500 on data corruption. |
| `src/pages/api/users/manage.ts:281` | `// Non-fatal — continue with deletion` | Has comment. Force-kick is best-effort during user deletion. |
| `src/components/admin/bookings/BookingSlideDrawer.tsx:71,90` | Shows `alert(...)` | User IS notified. The `catch` body shows an alert message. |
| `src/components/admin/debug/PageRegistryManager.tsx:102` | `/* silent */` | Preview fails silently. The actual save operation has full error handling. |

### 🔴 MUST FIX — These swallow errors the user or developer needs to know about:

**File:** `src/components/admin/users/ExpandedRow.tsx`

Lines 196, 215, 234 — three completely empty catches in user management action handlers:

```typescript
// Line ~194 (toggle active/inactive)
const data = await res.json() as any;
if (data.success) onRefresh();
} catch {} finally { setActionLoading(null); }
// ^ User clicks "Deactivate" — if the API call throws, nothing happens.
// setActionLoading(null) still runs so spinner disappears.
// User has no idea if the action succeeded or failed.

// Line ~213 (change role)
const data = await res.json() as any;
if (data.success) onRefresh();
} catch {} finally { setActionLoading(null); }
// Same problem — role change failure is completely invisible.

// Line ~232 (delete user)
const data = await res.json() as any;
if (data.success) onRefresh();
} catch {} finally { setActionLoading(null); }
// Deletion failure is invisible to the admin.
```

Lines 245, 254 — session status and login history fetches also silently fail:
```typescript
} catch {} finally { setActionLoading(null); }
// These are read operations (less critical) but still bad — if the fetch fails,
// the section just stays empty with no error message.
```

**Fix:** Add `setError(...)` in each catch block. The component already has a local `setError` / error state pattern in similar areas. Example:
```typescript
} catch (err: unknown) {
  setActionLoading(null);
  setError((err as Error).message || 'Action failed. Please try again.');
}
```

**File:** `src/components/admin/users/UsersTable.tsx`

Lines 90, 99 — two completely empty catches:
```typescript
// Line ~88 (some user table action)
const data = await res.json() as ManageResponse;
if (data.success) onRefresh();
} catch {}
// If this throws (network error, 500), nothing happens. No refresh, no error.

// Line ~97 (another user table action)  
const data = await res.json() as ManageResponse;
if (data.success) onRefresh();
} catch {}
// Same.
```

These should at minimum `console.error(...)` so the error appears in browser devtools, even if the UX shows nothing:
```typescript
} catch (err: unknown) {
  console.error('[UsersTable] Action failed:', err);
}
```

**Why this matters for ExpandedRow specifically:** An admin who deactivates a user to respond to a security incident and gets a silent failure could believe the user is deactivated when they aren't. That's a security incident response failure caused by a missing `console.error`.

---

## Item 5 — cfBotScore — Captured but never enforced

**Status:** ⛔ N/A — Queried `admin_login_logs` on 2026-05-02: all 23 rows have `cf_bot_score = NULL`. Bot Management is a paid Cloudflare feature not active on this account. Per the decision checklist in this item, skip implementation entirely.

**File:** `src/middleware.ts`

**Lines:** 172–173 (capture), 218 (logged during failed login), 321 (logged during successful login)

**What `cfBotScore` is:**
Cloudflare Bot Management assigns a score from 1–99 to every request. 1 = almost certainly a bot. 99 = almost certainly human. It is exposed as `request.cf.botManagementScore` in the Workers runtime.

**Current code:**
```typescript
const cf = (context.request as any).cf;
const cfBotScore: number | null = cf?.botManagementScore ?? null;
```

`cfBotScore` is captured and stored in `admin_login_logs` for forensics — this is correct. But it is NEVER used to gate access. A request with a score of 1 (certainly a bot) can still create a valid KV session and access the admin dashboard, as long as the CF Access JWT is valid.

**Why this is lower priority:**
CF Access itself already provides a strong gate — to even reach the Workers middleware, a request must have a valid RS256-signed CF Access JWT. A bot cannot obtain a valid CF Access JWT (they would need to complete Google OAuth or OTP). So `cfBotScore` is defense-in-depth, not a primary control.

**The free-tier caveat:**
On the Cloudflare Workers free tier, `botManagementScore` may always be `null`. Bot Management is a paid Cloudflare feature (`$10/month`). On free tier, `cf.botManagementScore` is likely `undefined` (casting to null in the current code). Before implementing any gate, **verify that the value is actually non-null in production logs** by checking `admin_login_logs.cf_bot_score` in D1.

**What the fix would look like (only if non-null scores are observed in production):**
```typescript
// After JWT verification, before whitelist check:
if (cfBotScore !== null && cfBotScore < 10) {
  // Extremely high bot confidence even with valid JWT — flag or block
  console.warn(`[MIDDLEWARE] High bot score ${cfBotScore} for ${bootstrapEmail}`);
  // Option A: Block entirely
  return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403, ... });
  // Option B: Allow but add extra KV flag for monitoring
}
```

**Threshold guidance:** Score < 10 is "certain bot" territory. Score 10–29 is "likely bot". Score 30–99 is human range. For an admin panel, blocking < 10 with an alert is reasonable.

**Decision checklist before implementing:**
1. Check `admin_login_logs` D1 table — are there rows where `cf_bot_score` is non-null?
2. If all rows have `null`, bot management is not available on this account — skip this item.
3. If non-null values appear: look at the range. If legitimate admins are scoring 50+ and only bots score < 20, set the threshold at 30.

---

## Item 6 — User-Agent truncation before D1 write

**Status:** 🟡 MEDIUM

**Files:**
- `src/middleware.ts` — lines 197, 304 (two callsites that pass `User-Agent` to `logLoginAttempt`)
- `src/lib/auth/security-logging.ts` — line 67 (where it's bound to the D1 prepared statement)

**The problem:**
`User-Agent` strings are attacker-controlled. A malicious client can send a `User-Agent` of arbitrary length. The HTTP/1.1 spec has no hard limit on header size, and some bots or scanning tools send User-Agent strings that are 2000–5000 characters long. The current code passes the raw value directly to D1:

```typescript
// middleware.ts line 197:
userAgent: request.headers.get('User-Agent') ?? '',

// security-logging.ts line 67:
data.userAgent,   // ← bound directly into D1 prepared statement
```

D1 (SQLite) has a default per-row size limit of 1MB, so this won't cause a hard failure, but:
1. A 5000-character User-Agent wastes significant storage in `admin_login_logs` over time.
2. If the D1 row size ever approaches limits (e.g. very large `details` JSON + 5k UA), it could cause silent truncation or insert failure.
3. The security alert email template (`security-logging.ts` line 209–213) renders the User-Agent directly in HTML inside a `<div>`. An unbounded string makes the email ugly and potentially very large.

**How to fix:**
In `middleware.ts`, truncate before passing to `logLoginAttempt`:

```typescript
// Before (line 197 and 304):
userAgent: request.headers.get('User-Agent') ?? '',

// After:
userAgent: (request.headers.get('User-Agent') ?? '').slice(0, 512),
```

512 characters is more than enough for any real browser UA string. Real-world longest legitimate UAs (legacy IE strings, complex mobile stacks) are under 400 characters. 512 gives headroom.

**Why truncate in middleware, not in `security-logging.ts`?**
The truncation belongs at the ingestion boundary (middleware) because `logLoginAttempt` has a typed interface (`SecurityLogData`) where `userAgent: string`. If the type says `string`, the caller should be responsible for sanitizing before passing. Alternatively, truncate inside `logLoginAttempt` itself as a defensive measure — either location is acceptable.

**One-line fix. No tests needed. Zero risk.** This is the lowest-effort item on the list with zero chance of regression.

---

## Item 7 — ETag base36 encoding — review status

**Status:** ✅ DONE / NOT A BUG — The implementation is correct.

**File:** `src/lib/api.ts` — `fnv1aHash()` function, lines 96–103

**What was flagged:**
The original audit noted an "ETag base36 encoding fix" as needed.

**Actual current code:**
```typescript
function fnv1aHash(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(36); // Base-36 for compact representation
}
```

The ETag is generated as:
```typescript
const etag = `"${fnv1aHash(body)}"`;
```

**Analysis:** `hash.toString(36)` produces a string of characters `[0-9a-z]`. These are all valid characters inside an HTTP ETag value (per RFC 7232, an ETag is `"<opaque-string>"` where the opaque string is any sequence of visible ASCII characters except `"`). Base-36 is subset of that — completely spec-compliant.

**Possible original concern (now moot):** An earlier version of this function may have used `.toString(16)` (hex) and the note was to switch to base-36 for a shorter string. The current code already uses base-36. Verified by reading the current file. No action needed.

---

## Item 8 — `DashboardController.tsx` — Remove unused props interface

**Status:** ✅ DONE — `DashboardControllerProps` interface removed, function signature simplified to `DashboardController()`. Call site in `index.astro` cleaned up (removed dead SSR computation block).

**File:** `src/components/dashboard/DashboardController.tsx`

**Lines:** 13–21

**The problem — exact code:**
```typescript
interface DashboardControllerProps {
    initialStats?: {
        activeUsers: number;
        recentActivity: any[];
        userLevel: number;
    };
}

export default function DashboardController({ }: DashboardControllerProps) {
//                                            ^^ empty destructure — props are never used
```

The `DashboardControllerProps` interface declares `initialStats` as an optional prop. The component's function signature destructures to `{ }` — nothing. The props are completely ignored. The interface is dead code.

**Why this happened:** During a refactor, the component was changed to fetch all data itself via `useEffect` + `fetch('/api/dashboard/metrics')` rather than receiving SSR data as props. The interface was left behind.

**Why it matters:**
1. Any consumer of this component that passes `initialStats` will be silently ignored — there is no compile error because the prop is optional. This creates a false contract.
2. TypeScript shows `DashboardControllerProps` as a type that exists and is used, but the type is meaningless.
3. The `any[]` inside the interface breaks the "zero `any`" policy established in Phase 4A–4B of the earlier refactoring.

**How to find all callers:**
```bash
grep -rn "DashboardController" src/
```
Check if any `.astro` file passes props to `<DashboardController initialStats={...} />`. If yes, verify those props are truly unused before deleting the interface.

**The fix:**
```typescript
// Remove the interface entirely
// Change the function signature from:
export default function DashboardController({ }: DashboardControllerProps) {
// To:
export default function DashboardController() {
```

**Zero risk fix** — removing an unused interface and empty destructure cannot break anything. TypeScript will error if any caller was actually passing and using `initialStats`.

---

## Item 9 — Pricing defaults hardcoded in `services.ts`

**Status:** ✅ DONE — `DEFAULT_PRICE_DOGS_CATS = 286` and `DEFAULT_PRICE_DAYCARE = 200` constants added at top of file; fallback literals replaced.

**File:** `src/pages/api/content/services.ts`

**Lines:** 72–74 (after the Zod validation added in Phase 3):

```typescript
const newPricingData: Record<string, unknown> = {
  dogs: body.dogs,
  cats: body.cats,
  daycare: body.daycare,
  currency: body.currency ?? 'MXN',
  dogs_numeric:    extractNumeric(body.dogs,    286),   // ← hardcoded fallback
  cats_numeric:    extractNumeric(body.cats,    286),   // ← hardcoded fallback
  daycare_numeric: extractNumeric(body.daycare, 200),   // ← hardcoded fallback
};
```

**What `extractNumeric` does:**
```typescript
function extractNumeric(display: unknown, fallback: number): number {
  const str = String(display ?? '').replace(/,/g, '');
  const match = str.match(/\d+(\.\d+)?/);
  return match ? parseFloat(match[0]) : fallback; // fallback used when string has no digits
}
```

The `fallback` value is used when the display string (e.g. `"$286"`) cannot be parsed for a number. Currently `286` (dogs/cats) and `200` (daycare) are magic numbers with no documentation explaining their origin.

**Why this is a problem:**
1. **Magic numbers are documentation debt.** A future developer seeing `extractNumeric(body.dogs, 286)` has no idea where 286 came from (it's the actual price in MXN pesos — 286 pesos/night for dog boarding). If pricing changes, the fallback must be updated manually and the developer has to know to look here.
2. **The fallback is never hit in practice** — Zod's `ServicesBodySchema` (added in Phase 3) validates that `dogs`, `cats`, `daycare` are `string` (or undefined). If they're strings, `extractNumeric` will almost always find digits. But if an admin somehow submits `"no price"` (passes Zod's `z.string()` but has no digits), the number silently becomes the hardcoded fallback.

**The correct fix:**
Extract the fallbacks as named constants with a comment explaining their meaning:

```typescript
// Default prices in MXN pesos — matches initial D1 seed data in migration 0001
const DEFAULT_PRICE_DOGS_CATS = 286;
const DEFAULT_PRICE_DAYCARE = 200;

// Then:
dogs_numeric:    extractNumeric(body.dogs,    DEFAULT_PRICE_DOGS_CATS),
cats_numeric:    extractNumeric(body.cats,    DEFAULT_PRICE_DOGS_CATS),
daycare_numeric: extractNumeric(body.daycare, DEFAULT_PRICE_DAYCARE),
```

**Longer-term fix (optional, higher effort):**
Read the current stored prices from D1 `cms_content` (the `services_pricing` row) and use those as fallbacks. This means the fallback is always the last known good value rather than a hardcoded constant. Only worth doing if pricing is expected to change frequently.

**Why not urgent:** The Zod schema added in Phase 3 already validates that the incoming values are strings. The `extractNumeric` function handles malformed strings by using the fallback. This is purely a code quality / maintainability issue.

---

## Summary Table

| # | Item | File | Status | Priority | Effort |
|---|------|------|--------|----------|--------|
| 1 | `.gitignore` — `.dev.vars` exclusion | `.gitignore:19` | ✅ DONE | — | — |
| 2 | `ActivityCenter.tsx` — fetch timeouts | `src/components/admin/logs/ActivityCenter.tsx:80,102,142,163,216` | ✅ DONE | MEDIUM | — |
| 3 | Breadcrumb `<a>` → `<span>` + `aria-current` | `src/components/navigation/TopBar.tsx:94-98` | ✅ DONE | MEDIUM | — |
| 4 | Silent catch blocks — `ExpandedRow.tsx` + `UsersTable.tsx` | `src/components/admin/users/ExpandedRow.tsx` + `UsersTable.tsx` | ✅ DONE | HIGH | — |
| 5 | cfBotScore access control | `src/middleware.ts:172` | ⛔ N/A — all 23 production rows have `cf_bot_score = null` (Bot Management not on free tier) | LOW | — |
| 6 | User-Agent truncation to 512 chars | `src/middleware.ts:197,304` | ✅ DONE | MEDIUM | — |
| 7 | ETag base36 encoding | `src/lib/api.ts:102` | ✅ DONE / NOT A BUG | — | — |
| 8 | `DashboardController` unused props cleanup | `src/components/dashboard/DashboardController.tsx:13-21` | ✅ DONE | LOW | — |
| 9 | Pricing fallback magic numbers → named constants | `src/pages/api/content/services.ts:72-74` | ✅ DONE | LOW | — |

**Recommended order of implementation:**
1. Item 6 (User-Agent truncation) — 2 minutes, zero risk
2. Item 4 (Silent catches) — 15 minutes, real user-facing impact
3. Item 2 (ActivityCenter timeouts) — 20 minutes, improves incident resilience
4. Item 3 (Breadcrumb `<span>`) — 5 minutes, accessibility
5. Item 8 (DashboardController) — 5 minutes, cleanup
6. Item 9 (Pricing constants) — 5 minutes, code quality
7. Item 5 (cfBotScore) — only after verifying non-null scores in D1 logs

---

## Completed Phases Reference

For the full record of what was fixed in Phases 1–3, see:
- `documentation/SECURITY.md` — §6a (IDOR patterns), §6b (rate limits, Zod schemas, email validation, bounded queries, provider timeouts), §8 (cfJwt fail-close)
- `documentation/OPERATIONS.md` — §5.2 (vars table), §6 (API token registry)

{% endraw %}
