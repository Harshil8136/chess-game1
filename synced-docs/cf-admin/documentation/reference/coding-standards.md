---

title: "Code Quality Rules"
status: active
audience: [ai, technical]
last_verified: 2026-09-20
verified_against: [code]
owner: harshil
related_code: [eslint.config.js, scripts/ratchet.py, scripts/rules_check.py, scripts/a11y_check.py, src/lib/dal/]
related_docs: [../../RULESAd.md, ../architecture/ARCHITECTURE.md, ../security/compliance/ACCESSIBILITY.md]
tags: [typescript, conventions, ratchet, accessibility, dal]
---

# Code Quality Rules

> **TL;DR (non-technical):** The coding rules every contributor (human or AI) follows: data-access patterns, TypeScript strictness, component structure, and naming.

> **Read the enforcement notes, not just the rules.** Several rules below are
> *targets* a reviewer holds, not gates a build holds. Where a rule is actually
> enforced, this doc names the enforcer (`scripts/ratchet.py`,
> `scripts/rules_check.py`, `scripts/a11y_check.py`, `eslint.config.js`). Where
> it is not, it says so and gives the measured gap. Do not read an unenforced
> target as a description of the codebase as it stands.

## 0. Data Access — API handlers use the DAL

**Rule:** an API handler under `src/pages/api/**` MUST go through a DAL
repository in `src/lib/dal/`, not raw D1 (`.prepare(` / `.batch(` on any binding
alias). SQL for a table lives in that table's repository, once.

- **Enforced:** `scripts/rules_check.py` rule `SEC-03` (OWASP ASVS 5.3.4), part
  of `npm run verify`. It matches `.prepare(`/`.batch(` on *any* alias — until
  2026-09-02 it matched only the literal `env.DB.prepare(`, so
  `const db = env.DB; db.prepare(...)` was invisible.
- **Grandfathered:** 18 handlers are on the exempt list inside `rules_check.py`
  (`src/pages/api/health.ts` is exempt by design — the authenticated branch
  probes bindings directly; the other 17 are a burn-down list). Each vertical
  slice moves its queries into `src/lib/dal/` and deletes its line there. Adding
  a line to that list is not a fix.
- **19 repositories exist today** (`src/lib/dal/*Repository.ts`). Check for one
  that already covers your table before writing a new one — see §8.1.

## 1. TypeScript Strictness

- `moduleResolution: "bundler"` in `tsconfig.json`
- `any` type is **FORBIDDEN** by this standard (unless bypassing a documented upstream type bug).
  ⚠️ **Nothing errors on `any`; a ratchet is what holds the line.**
  `eslint.config.js` sets `@typescript-eslint/no-explicit-any` to `'warn'` for
  the type-debt burn-down, so `any` never fails lint. Since 2026-09-02
  (viability program chunk 4) `scripts/ratchet.py` holds the *count* (500 that
  day) so it cannot rise silently — a new `any` fails `npm run verify` and CI
  unless the baseline is re-locked with a committed `--update --reason`.
  **Read the current count from `.ratchet.json` (`A1`); do not quote it from
  here** — it has moved several times and the baseline has been re-locked
  upward more than once, so the trend is up, not down. Treat this as the rule
  for *new* code and lower the count in the slice you are working on.
  See `RULESAd.md` §8.1.
- All Cloudflare bindings must be strictly typed.

## 2. File Naming

All file names must be unique and descriptive:

- ✅ `LoginForm.tsx`, `AuthLayout.astro`, `rbac.ts`
- ❌ `Form.tsx` (ambiguous), `index.tsx` (without context)

## 3. Component Architecture ("LEGO-Style" Atomic Design)

- **Strict Composition Rule:** Components must follow Atomic Design + Island Architecture. Never create monolithic files.
- **Target size: no component file over 200 lines.** Split when you are past that.
  ⚠️ **Aspirational, not the status quo, and not enforced anywhere:**
  `eslint.config.js` sets `'max-lines': 'off'` globally (marked TEMP, pending
  the god-file split pass), with a 600-line *warning* for three named
  exceptions (`pipeline.ts` left the list on 2026-09-02). Measured 2026-09-20:
  **105 of 196 `.tsx` files under `src/components/` are over 200 lines (54%)**,
  the largest being `BlogManager.tsx`, `PlatformAlertsManager.tsx` and
  `BrevoTelemetryView.tsx`, all over 1,200. The only count anything holds is
  `.ratchet.json` `A14` — `src/` files over **600** lines — which may fall but
  not rise. So 200 is the design target you justify departing from, 600 is the
  line the build defends, and the majority of the tree is already between them.
  See `RULESAd.md` §8.1 for the full enforcement table.
- **Atoms/Molecules:** Tiny, focused, reusable sub-components (e.g. `SidebarHeader.tsx`, `SidebarProfile.tsx`, `NavIcon.tsx`).
- **Organisms (Islands):** The primary Preact component that orchestrates atoms/molecules (e.g., `SidebarMenu.tsx`).
- **Astro Shells (`.astro`):** For server-rendered layouts and server-side data fetching.
- **Preact islands (`.tsx`):** Only for interactive UI.
- Use `client:load` for above-fold critical interactivity (like navigation)
- Use `client:idle` for below-fold widgets

### Component Split Pattern

When a component grows too large, follow this three-step extraction pattern:

1. **Shared types file** — Create `[Module]Types.ts` (or `shared.tsx` for co-located micro-components). Move all interfaces, type aliases, constants, and utility functions here. This eliminates circular imports.
2. **Section components** — Extract each logical section of the UI into a focused `[Module][Section].tsx` file. Each receives only the props it needs.
3. **Thin orchestrator** — The original file becomes the orchestrator: it fetches data, manages top-level state, and renders the section components. Target: ≤ 150 lines.

**Example applied (BookingSlideDrawer):**

```
bookings/
├── types.ts                     ← BookingRow, BookingPet, SERVICE_LABELS, ...
├── BookingDossierTab.tsx        ← the dossier tab
├── BookingOperationsSection.tsx ← service, dates, status
├── BookingAuditSection.tsx      ← email log
└── BookingSlideDrawer.tsx       ← orchestrator
```

## 4. Error Handling & Resilience

### 4.1 Core Rules

- Never show white screens — use `ErrorBoundary` component from `src/components/ui/ErrorBoundary.tsx`
- Section-level boundaries: one broken widget **never** crashes the page
- API routes return structured JSON errors with proper HTTP status codes
- Users always have navigation to recover

### 4.2 🚨 SSR Safety — The 3 Crash Patterns

When using `client:load`, the component is rendered *synchronously* during Astro SSR. These 3 patterns will **silently kill the entire HTML stream**, producing a blank page with no error visible to the user:

| # | Pattern | Example | Fix |
|---|---------|---------|-----|
| 1 | **Missing default export** | `export function Widget()` | Must be `export default function Widget()` |
| 2 | **Wrong API route** | `fetch('/api/admin/analytics')` (404) | Verify endpoint exists in `src/pages/api/` |
| 3 | **Unguarded property access** | `data!.property` or `data.nested.value` | Always: `if (!data) return <SkeletonBlock />` first |

**ALWAYS use strict null guards and early returns before accessing any data props in Preact components.**

> **Note on Loading States:** The dashboard enforces a strict "No Blank Loading Screens" policy. Do not use plain text (e.g., "Loading...") or unstyled spinners for primary data fetches. Always use `SkeletonBlock` from `src/components/dashboard/widgets/WidgetShared.tsx` (canonical — `WidgetSharedV2` was merged and deleted) to provide immediate, structure-matching shimmer placeholders.

### 4.3 Mandatory ErrorBoundary Wrapping

Every widget group inside a `client:load` island must be wrapped in `<ErrorBoundary sectionName="...">`:

```tsx
import { ErrorBoundary } from '../ui/ErrorBoundary';

// ✅ CORRECT — crash in WidgetA doesn't affect WidgetB
<ErrorBoundary sectionName="Widget A">
  <WidgetA data={data} />
</ErrorBoundary>
<ErrorBoundary sectionName="Widget B">
  <WidgetB data={data} />
</ErrorBoundary>

// ❌ WRONG — crash in WidgetA takes down WidgetB too
<WidgetA data={data} />
<WidgetB data={data} />
```

### 4.4 Error Capture Infrastructure (Deployed)

Four-layer error shield, all core-level (survives any page/widget changes):

| Layer | What | Where |
|-------|------|-------|
| **`@sentry/cloudflare` `withSentry`** | **Server/Worker capture** — the whole worker (fetch + scheduled + queue) is wrapped, which is what makes server-side `Sentry.captureException` deliver | `src/workers/cf-entry.ts`; library code imports from `src/lib/sentry.ts` |
| **`@sentry/astro`** | **Client capture only**, plus build-time source-map upload | `sentry.client.config.ts`; the `sentry()` integration in `astro.config.ts` is configured for org/project/authToken (source maps) |
| **ErrorBoundary → Sentry** | Per-widget crash capture with section tags | `src/components/ui/ErrorBoundary.tsx` |
| **Global error capture** | Pre-boot safety net (catches hydration failures) — `window` `error` + `unhandledrejection` listeners | `public/scripts/error-capture.js`, loaded by `AdminLayout.astro` via `<script is:inline src>` |

> 🚨 **Never add `Sentry.init(...)` to `sentry.server.config.ts`.** That file is
> a deliberate `export {}` no-op and its header says why: `@sentry/astro`'s
> server SDK is Node-based and does **not** run in Cloudflare's workerd runtime.
> Initialising it there previously needed `defaultIntegrations: false` just to
> stop workerd crashing, and `captureException` was a silent no-op anyway — that
> is the bug that kept server errors out of Sentry. An "empty config file" here
> is the fix, not an oversight. `RULESAd.md` §7's stack table states the same
> split, and [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §4.1b
> records the related trap: `@sentry/cloudflare` exports no `init()` at all.

Client-side errors automatically appear in the Sentry dashboard with:

- Section name tag (which widget crashed)
- Component stack trace (where in the Preact tree)
- Deduplication (same error won't flood) — *SDK behaviour, not re-verified here*

### 4.5 Pre-Deploy Checklist for Preact Islands

Before deploying any new or modified `client:load` component:

- [ ] Component uses `export default function ...`
- [ ] All data props typed with `| null | undefined`
- [ ] Early `if (!data) return <Loading />` guard before any property access
- [ ] No `!` non-null assertions crossing component boundaries
- [ ] No `window`/`document` access outside `useEffect`
- [ ] Widget wrapped in `<ErrorBoundary sectionName="...">` in parent

## 5. TypeScript Fetch Patterns

### Typed JSON responses

TypeScript strict mode enforces a specific pattern when typing `fetch` responses. The type annotation must go on the `json()` call itself — NOT on the callback parameter.

```typescript
// CORRECT — type cast at json(), then destructure in next .then()
fetch('/api/some-endpoint')
  .then(r => r.json() as Promise<MyResponseType>)
  .then(data => {
    // data is typed as MyResponseType here
    console.log(data.someField);
  });

// WRONG — TypeScript strict mode rejects annotating the callback param
fetch('/api/some-endpoint')
  .then((data: MyResponseType) => {  // ❌ ERROR: Parameter 'data' implicitly has an 'any' type
    console.log(data.someField);
  });
```

**Why:** `Response.prototype.json()` returns `Promise<any>`. Annotating the `.then()` callback parameter does not narrow the type — TypeScript requires the cast to be applied to the `Promise` itself via `as Promise<T>`.

### Typed interfaces for all API responses

Never use `const data: any = await res.json()`. Always define a response interface:

```typescript
interface BookingListResponse {
  bookings: BookingRow[];
  total: number;
  page: number;
}

const data = await res.json() as BookingListResponse;
```

For D1 query results that the TypeScript compiler cannot narrow directly, use the double-cast pattern:

```typescript
const { results } = await stmt.all();
const rows = results as unknown as MyRowType[];
```

---

## 6. Accessibility Requirements

> **What is enforced:** `scripts/a11y_check.py` (part of `npm run verify`)
> implements six checks only — `A11Y-01` accessible name on a `<button>`,
> `A11Y-02` `alt` on `<img>`, `A11Y-03` accessible name on `<dialog>`,
> `A11Y-04` link text, `A11Y-05` no positive `tabindex`, `A11Y-06` `<html lang>`.
> **Everything else in this section is reviewer-enforced and currently unmet in
> places.** Measured 2026-09-20: all 9 click-handling `<tr>` elements lack the
> full triad below, 18 click-handling `<div>` elements carry no `role`, and the
> one sortable `<th onClick>` has no `aria-sort`. The honest conformance
> position lives in
> [`../security/compliance/ACCESSIBILITY.md`](../security/compliance/ACCESSIBILITY.md),
> which the script itself names as its owner — new violations belong there, not
> hidden behind a green `verify`.

### Interactive non-button elements

Any non-`<button>` element that is click-activated (e.g., `<tr>`, `<div>`) must have the full interactive triad:

```tsx
<tr
  role="button"
  tabIndex={0}
  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(); }}
  aria-label="View booking BK-00123"
>
```

- `role="button"` — tells assistive technology this is interactive
- `tabIndex={0}` — makes it keyboard-reachable
- `onKeyDown` — activates on Enter and Space (the keyboard equivalents of click)
- `aria-label` — describes the action when the visual text is insufficient

### Icon-only buttons

Every button that contains only an icon (no visible text) must have `aria-label`. The icon itself must have `aria-hidden="true"`.

```tsx
<button aria-label="Close drawer">
  <X className="w-4 h-4" aria-hidden="true" />
</button>
```

Using `title=` alone is not sufficient — `title` is not announced by all screen readers and is hidden on mobile.

⚠️ **The gate is weaker than this rule.** `scripts/a11y_check.py` counts `title`
as an accessible name (`NAME_ATTRS = ("aria-label", "aria-labelledby", "title",
"alt")`), so a `title`-only icon button passes `A11Y-01` and `npm run verify`.
Use `aria-label`; do not take a green check as evidence that you did.

### Tab components

Tab navigation must use the WAI-ARIA tab pattern:

```tsx
<div role="tablist" aria-label="Log Categories">
  <button
    role="tab"
    aria-selected={activeTab === 'audit'}
    aria-controls="tabpanel-audit"
    id="tab-audit"
  >
    Audit
  </button>
</div>
<div
  id="tabpanel-audit"
  role="tabpanel"
  aria-labelledby="tab-audit"
  hidden={activeTab !== 'audit'}
>
  ...
</div>
```

### Sortable table columns

Sortable `<th>` elements must have `aria-sort`:

```tsx
<th
  aria-sort={sortField === 'name'
    ? (sortDir === 'asc' ? 'ascending' : 'descending')
    : 'none'}
  onClick={() => handleSort('name')}
>
  Name
</th>
```

---

## 7. Animation Standards

- All interactive elements must have smooth transitions
- Use the Tailwind utility `duration-[120ms]` for colour-only hover/focus states
- Use `duration-[200ms]` for general hover/focus and control transitions
- Use `duration-[350ms]` for page transitions
- Respect the `prefers-reduced-motion` media query

🚨 **Do not write `var(--duration-[200ms])`.** `src/styles/global.css` declares
three `@theme` entries literally named `--duration-[120ms]`,
`--duration-[200ms]` and `--duration-[350ms]`, but `[` and `]` are not valid CSS
identifier characters — `var(--duration-[200ms])` never resolves, so the whole
declaration containing it is dropped and you silently get **no transition at
all**. Zero files in `src/` use that form, and a rule to use it stood in this
section until 2026-09-20.

What actually works is the Tailwind arbitrary-value utility of the same name
(`@apply transition-colors duration-[200ms]`), which is the mechanism used
everywhere in `global.css` today. The one `var(--duration-…)` call site in the
repo (`src/components/ui/AccessDeniedView.astro`) references
`--duration-normal`, a token that was never defined, and only works because of
its literal `200ms` fallback. Fixing that — renaming the three tokens to
`--duration-fast/normal/slow` so `var()` works — is an open code change, not a
documented pattern. `DESIGN-SYSTEM.md` §2.11 / §6.1 carry the same note.

---

## 8. Config Storage — Reuse the Universal Scoped Table

**Before creating a new D1 table for a feature's settings, check here first.** `admin_portal_settings`
was widened (migration `0037_widen_admin_portal_settings_scoped.sql`, shipped alongside
[Staff Managed Storage](../features/STAFF-MANAGED-STORAGE.md)) into a general-purpose scoped
config store, specifically so features stop each reaching for their own settings table.

The table holds `(setting_key, scope_type, scope_id) → value` rows, where `scope_type` is one of
`'global' | 'role' | 'user'` (`scope_id = ''` for global). `setting_type = 'json'` lets one row hold a
whole bundle of related fields — a single read returns everything a feature's config needs, instead of
one row per field.

**When this fits:** any feature needing global defaults, and/or per-role or per-user overrides of
those defaults. Storage's own config is the reference example — one global row
(`storage_config` / `scope_type='global'`) holds every default (quotas, allowed file types, link
lifetime ceilings, the weekly-cleanup policy), and per-user overrides are additional rows under the
same key with `scope_type='user'`, created only for users who actually have one.

**When it doesn't fit:** data that isn't config — an entity registry (files, bookings, users) still
gets its own table, exactly as before. Storage's own `storage_files` table is the counterexample: file
metadata is not settings, so it's a real table, not a `admin_portal_settings` row.

**How to use it:** `src/lib/dal/PortalSettingsRepository.ts` — `getScopedSetting`,
`listScopedSettings`, `upsertScopedSetting`, `deleteScopedSetting`. The original unscoped methods
(`getSetting`, `getAllSettings`, `getSettingsByCategory`) still work unchanged and are implicitly
scoped to `global` — existing callers needed zero changes when this shipped.

**Note:** `service_config` (`database/legacy_migrations/0028_create_service_config.sql`; now in `migrations/0000_baseline.sql`) is a second, older generic config table already in this
codebase, used by the cf-astro/cf-chatbot control plane. The two are not yet consolidated — that's a
separate cleanup, not something to solve by picking whichever one is more convenient in the moment.
For a *new* feature, prefer `admin_portal_settings` going forward; it's the one with scoping support.
`admin_feature_flags` is a **third**, narrower (boolean-only) mechanism for the same general idea —
same rule applies: don't add a fourth.

### 8.1 The same check applies beyond D1 config tables

This section used to cover only "don't add a new settings table." The check is broader than that, and
it's worth stating explicitly because it's already been skipped three times in this codebase's history
(`service_config` → `admin_portal_settings` → `admin_feature_flags`, none consolidated) — see
[`../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../records/reviews/2026-08-06-data-infrastructure-audit-and-reuse-policy.md)
for the live audit that found this, plus two confirmed-dead tables (`admin_sessions`,
`privacy_requests`) that existed only because nobody checked before adding the next thing.

**Before creating any new D1 table, Supabase table, KV namespace, or external service integration:**

1. Check whether something that already exists covers it (this section, the audit doc above, and a
   grep of `src/` for related repository/table names).
2. If nothing existing fits, check whether a free, open-source, or **already-integrated** service
   (this project already has active connectors for Supabase, Cloudflare, Sentry, PostHog) solves it
   better than bespoke D1/KV plumbing — evaluated honestly per-case, not defaulted either direction.
   The audit doc's §4 has three worked examples (feature flags → adopt PostHog when real targeting is
   needed; ReBAC-style permissions → don't adopt a hosted graph-auth service, it's a new production
   dependency for a need this project doesn't have yet; system config → don't adopt a third-party
   config SaaS, extend the table that already exists).
3. If new infrastructure is genuinely the right call, say why in one line in the PR/commit. This is
   the entire mechanism that keeps this list from growing a fourth entry.

This is now also RULE #0.6 in `RULESAd.md` — a full rules-bible entry, not just a coding-standards note,
because the pattern it guards against has already recurred enough times to earn one.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-14 | `tsconfig.json`, `eslint.config.js` (max-lines off, 600-line warn list, `prerender` guard), `scripts/ratchet.py` + `.ratchet.json` (A1 history), RULE #0.6 and §8.1 in `RULESAd.md`, every file and repository method this doc names, the motion token names in `global.css`. Five corrections above. | Whether `admin_sessions` / `privacy_requests` are dead on the Supabase side; Sentry dedup behaviour |
| 2026-09-20 | `sentry.server.config.ts` (no-op, by design) and `src/workers/cf-entry.ts` (`@sentry/cloudflare` `withSentry`) — §4.4 rewritten; `var(--duration-…)` has 0 valid uses in `src/` — §7 rewritten; `scripts/rules_check.py` SEC-03 + its 18-file exempt list and the 19 `src/lib/dal/*Repository.ts` files — new §0; `scripts/a11y_check.py` (6 checks, `title` accepted as a name) — §6 labelled; 105 of 196 components over 200 lines — §3 labelled; `eslint.config.js` (`no-explicit-any: warn`, `max-lines: off`) and `.ratchet.json` re-read; the `admin_sessions` / `privacy_requests` question closed (renamed `zz_dead_*_20260916` by chunk 14a, removal tracked as D-15). | Sentry client-side dedup behaviour (still an SDK claim, not measured here) |
