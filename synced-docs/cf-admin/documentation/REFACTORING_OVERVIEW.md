{% raw %}
# cf-admin Codebase Refactoring — Project Overview

> **REFACTORING COMPLETE** — All 8 phases (1A through 8B) are done. Final verification: `npx astro check` and `npm run build` both pass with **0 errors**. Build output: `✓ Complete!`

## Goal
A comprehensive professional SWE sweep of the `cf-admin` codebase to:
- Eliminate dead code, duplicate files, duplicate utilities, unused exports
- Fix real security bugs (SQL injection, missing rate limits)
- Centralize shared utilities into canonical single-import-source modules
- Improve TypeScript type safety (remove `any`, add guards)
- Split oversized components (1,000+ line files) into focused units
- Add missing error boundaries around independent data-fetching islands
- Improve CSS architecture (CSS variables over hard-coded colors)
- Fix accessibility gaps (interactive table rows, icon-only buttons, ARIA)
- Phase 9: Security Lockdown & Codebase Pruning (v4.1) — strict 0 anon privileges, dead code elimination, and 100% clean `knip` static analysis.

## Stack (do not change)
- **Framework:** Astro 6 SSR + Cloudflare Workers adapter
- **UI:** Preact islands (NOT React — types differ)
- **Auth:** Cloudflare Zero Trust (CF Access JWT) + Supabase whitelist
- **RBAC:** 5-tier — DEV(0) > Owner(1) > SuperAdmin(2) > Admin(3) > Staff(4)
- **DB:** Cloudflare D1 (UUID `7fca2a07-d7b4-449d-b446-408f9187d3ca`)
- **KV:** ADMIN_SESSION (UUID `ba82eecc6f5a4956ad63178b203a268f`)
- **Rate limiting:** Upstash Redis via `src/lib/ratelimit.ts` → `getRateLimiter()`
- **Audit engine:** Ghost audit — `ctx.waitUntil()` deferred D1 writes
- **API responses:** Canonical helpers — `jsonOk`, `jsonError`, `withETag`, `jsonFresh` from `src/lib/api.ts`
- **CSS design:** Midnight Slate, Blue-500 primary, data-attribute driven styles, design tokens in CSS variables

## Execution Rules
- After every phase: run `npm run build` — must pass with 0 errors
- Run `npx astro check` for TypeScript verification
- User manually tests affected features in browser (we cannot open Chrome)
- No feature additions — quality improvements only
- Never break the build; fix errors before proceeding

## Phase Status Summary

| Phase | Description | Status |
|-------|-------------|--------|
| 1A | SQL injection fix in bookings API | ✅ DONE |
| 1B | Rate limiting on 5 unprotected routes | ✅ DONE |
| 2A | Delete dead BookingList.tsx component | ✅ DONE |
| 2B | Remove deprecated RBAC alias exports | ✅ DONE |
| 2C | Verify /api/system/preview (kept — used by PageRegistryManager) | ✅ DONE |
| 2D | Remove @types/react @types/react-dom (decided: keep, build needed them) | ✅ DONE |
| 3A | Unify all 36 API routes to use src/lib/api.ts helpers | ✅ DONE |
| 3B | Merge WidgetShared + WidgetSharedV2 → single WidgetShared | ✅ DONE |
| 3C | Extract getServiceBadgeStyle to src/lib/bookings/constants.ts | ✅ DONE |
| 3D | (Subsumed into 3C — same files) | ✅ DONE |
| 3E | Remove duplicate CmsBlock interface from cms.ts | ✅ DONE |
| 3F | Create src/lib/formatters.ts, consolidate formatDate | ✅ DONE |
| 4C | Add null guard to isBreakGlassAdmin() | ✅ DONE |
| 4D | Add env validation to createAdminClient() | ✅ DONE |
| 4E | Enable verbatimModuleSyntax:true in tsconfig.json | ✅ DONE (no errors, only warnings) |
| 4A | Eliminate `any` in src/lib/cms.ts and analytics/providers.ts | ✅ DONE |
| 4B | Eliminate `any` in key components | ✅ DONE |
| 5A | Split ActivityCenter.tsx (1,436 lines) → shared types + orchestrator | ✅ DONE |
| 5B | Split BookingSlideDrawer.tsx → 5 section components | ✅ DONE |
| 5C | Split BotConfig.tsx → shared primitives + ThinkingSection | ✅ DONE |
| 5D | Split UsersTable.tsx → roleColors, UserTableRow, UserCardStack | ✅ DONE |
| 5E | Split PageRegistryManager.tsx → extracted PageRegistryConfirmModal | ✅ DONE |
| 6A | Wrap dashboard widgets in ErrorBoundary (already in place) | ✅ DONE |
| 6B | Wrap BookingDashboard in ErrorBoundary (already in place) | ✅ DONE |
| 6C | Add SkeletonBlock loading states to SupabaseAuthWidget | ✅ DONE |
| 7A | Move hardcoded badge colors to CSS variables in dark.css | ✅ DONE |
| 7B | Consolidate duplicate badge CSS selectors in buttons-badges.css | ✅ DONE |
| 7C | Move inline styles out of AnalyticsDashboard + StatCard | ✅ DONE |
| 8A | Fix accessibility on clickable table rows | ✅ DONE |
| 8B | Add aria-label to icon-only buttons | ✅ DONE |
| 8C | (Subsumed into 8A/8B — ARIA for tabs/headers covered there) | ✅ DONE |
| 9A | Security Lockdown (3-layer defense-in-depth, 0 anon privileges, fail-secure SITE_URL) | ✅ DONE |
| 9B | Codebase Pruning (Removed 18+ dead components, Vite dynamic import fix, 100% clean `npx knip` report) | ✅ DONE |

See `COMPLETED_PHASES.md` for full implementation detail on all phases.
See `PENDING_PHASES.md` — all phases complete; file now contains a completion notice.

{% endraw %}
