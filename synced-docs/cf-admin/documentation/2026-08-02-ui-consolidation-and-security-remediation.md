---

title: "UI Consolidation & Security Remediation — 2026-08-02"
status: active
audience: [non-technical, ai, technical, operator]
last_verified: 2026-08-02
verified_against: [code]
related_code: [src/components/ui/, src/lib/email/sanitize-html-client.ts, src/components/admin/emails/, src/components/dashboard/DashboardController.tsx, src/components/admin/users/sessions/, src/components/admin/bookings/, src/lib/bookings/constants.ts, src/styles/pages/session-registry.css, .audit-exceptions.json]
related_docs: [reference/DESIGN-SYSTEM.md, reference/coding-standards.md, security/compliance/ACCESSIBILITY.md, MAINTENANCE.md, ../RULESAd.md]
tags: [ui, design-system, security, xss, accessibility, refactor, theming, summary]
---

# UI Consolidation & Security Remediation — 2026-08-02

> **TL;DR (non-technical):** A previous change modernised the Email Portal and
> main Dashboard, but it also removed a security protection, put fake numbers on
> the dashboard, and built its new UI pieces so they only work in dark mode. This
> pass fixed all of that, then reused the (now corrected) UI pieces across User
> Management, the Debug Portal, and Bookings — replacing roughly 600 hardcoded
> colours with theme-aware ones, so the whole admin area now responds to the
> light/dark switch instead of only parts of it. No new third-party libraries
> were added. 15 commits, 55 files, all automated gates passing.

---

## 1. Context — why this pass happened

Commit `e860dff` ("modernize main dashboard… shadcn-style Preact UI primitives,
and live Brevo SMTP telemetry") shipped directly to `main`, as this repo's
[`GITHUB_RULES.md`](../GITHUB_RULES.md) policy prescribes (single operator, no
pull-request gate, `npm run verify` is the only pre-merge control).

A post-merge review of that commit surfaced problems in three distinct classes:

| Class | Finding | Severity |
|-------|---------|----------|
| Security | Client-side HTML sanitisation deleted from the email editor | **Critical** |
| Data integrity | Dashboard KPI cards showing fabricated numbers | **High** |
| Design system | New UI primitives hardcoded to dark mode | **Medium** |
| Hygiene | 12 inert audit exceptions, dead props, one a11y regression | **Low** |

Separately, the operator asked whether the same "shadcn-style primitives"
approach could be extended to User Management, the Debug Portal, and other
areas. That question, plus the fixes above, defined the scope of this pass.

**Key constraint discovered during planning:** the "library" in "use a library
for other pages" could not be an npm package. [`RULESAd.md`](../RULESAd.md) §7.3
operates a strict dependency **whitelist** — anything not listed is *blacklisted
by default* to protect a `<50KB` "Lean Edge" budget, and the policy names
`shadcn/ui`, `Recharts`, and React explicitly as examples requiring prior
operator approval. There is also standing precedent in
[`specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md`](specs/2026-07-26-payload-cms-evaluation-and-dynamic-blog.md)
for rejecting a tool because it assumes a React stack.

So the pass proceeded on the reading that **"the library" is the existing
zero-dependency, hand-rolled Preact primitive set** — extended by writing more
small components in the same idiom. Zero packages were added; `package.json`
dependencies are unchanged.

---

## 2. What was done

### 2.1 Security — restored HTML sanitisation in the email editor

**The regression.** `RichEditor.tsx` was rewritten to do:

```ts
editorRef.current.innerHTML = value || '';
```

The prior implementation ran every incoming value through a `DOMParser`-based
sanitiser (stripping `script`/`iframe`/`object`/`embed`, removing `on*`
attributes, allowlisting `href`/`src` URI schemes) on both the value→DOM sync
**and** on paste. That function and the paste handler were both deleted.

**Why it mattered.** This is reachable through ordinary product flows —
`handleLoadDraft`, `handleUseTemplate`, the Templates panel editor, and the AI
generator's `onInsert` callback all funnel into `setHtml()` → `RichEditor
value={html}` → raw `innerHTML`. `innerHTML` does not execute `<script>`, but it
*does* fire inline handlers such as `<img onerror>` and `<svg onload>`.

A server-side sanitiser (`src/lib/email/sanitize-html.ts`, HTMLRewriter-based)
already existed — but it only runs at **send** time. It offered no protection to
an operator who merely *opens* a poisoned draft or template to edit it. Because
drafts and templates are shared between operators at different privilege tiers,
this was a stored-XSS → privilege-escalation path: a lower-privileged author
could store markup that executes in a higher-privileged reviewer's browser.

**The fix.**

- New `src/lib/email/sanitize-html-client.ts` — a `DOMParser` twin of the
  server sanitiser. It cannot literally reuse the server module because
  `HTMLRewriter` is Workers-only and unavailable in the browser; the two files
  deliberately mirror the same `DANGEROUS_TAGS` / `URI_ATTRS` / `SAFE_URI` rule
  sets and cross-reference each other in comments.
- Applied on the value→DOM effect (with the original "why" comment restored) and
  on paste, for both `text/html` and HTML-looking `text/plain` clipboard payloads.
- Pasted `<style>` blocks are scoped via CSS `@scope` so pasted CSS cannot leak
  out into the admin UI.
- The bare `window.prompt('Enter link URL:')` → `execCommand('createLink', url)`
  flow (no scheme validation at all) was replaced by rewiring
  `LinkPopover.tsx` — a fully-built, already-styled component that was sitting
  orphaned in the tree, unused. Link URLs now pass a scheme allowlist and link
  text is HTML-escaped.

> ⚠️ **Enforcement gap, stated plainly.** `scripts/rules_check.py`'s SEC-08 rule
> only regex-matches the literal `dangerouslySetInnerHTML` JSX prop. It cannot
> see imperative `element.innerHTML = …` assignment. **This fix is therefore not
> CI-enforced and could silently regress again.** A follow-up candidate is a new
> `rules_check.py` rule matching `\.innerHTML\s*=` outside a small allowlist of
> known-sanitised call sites. Logged in §7.

### 2.2 Data integrity — removed fabricated dashboard telemetry

[`RULESAd.md`](../RULESAd.md) RULE #0.5 bans fake data outright: *"No
`Math.random()` chart data, no hardcoded metrics… If real data isn't available,
omit the feature or build the real pipeline — never mock it, even if the user
explicitly asks."*

Four KPI cards violated it:

| Card | What it actually showed | Resolution |
|------|-------------------------|------------|
| Security & Clearance | 100% hardcoded — `"0 Revocations"`, `"100% Security Pass"`, a flat-zero sparkline. Never read the `analytics` prop at all. | **Card removed.** No field in `AnalyticsMetrics` backs a revocations metric. |
| Global Edge Traffic | 6 invented history points + 1 real value; static `"+12.4% vs last 24h"` | **Wired to real data.** `AnalyticsMetrics.cloudflare.timelines.requests` already carries a genuine 24-bucket hourly series from the Cloudflare GraphQL Analytics API. Trend % now computed from first-half vs second-half averages. |
| Supabase Postgres Pool | Invented sparkline; static `"Optimal Pool Latency"` | Sparkline + change text **removed**; real current-value fields retained. |
| Brevo SMTP Quota | Invented sparkline; static `"Live Brevo API Connected"` | Sparkline + change text **removed**; real current-value fields retained. |

**Why "strip" rather than "build a trend pipeline".** `supabase` and `brevo`
have no timeline field in the analytics contract. Building one would mean a
KV-backed rolling-history mechanism inside the analytics caching layer — real
scope, real risk, and orthogonal to fixing a correctness bug. Stripping restores
RULE #0.5 compliance immediately; the history pipeline is logged as optional
future work (§7). This choice was confirmed with the operator before execution.

The grid was rebalanced 4-up → 3-up to absorb the removed card.

### 2.3 Design system — primitives relocated and made theme-aware

The four new primitives (`Card`, `Badge`, `Tabs`, `MetricCard`) hardcoded raw
Tailwind palette values — `bg-black/40`, `text-white`, `text-slate-400`,
`border-white/10`, `bg-emerald-500/15`, and two raw hex sparkline strokes.

This violates [`reference/DESIGN-SYSTEM.md`](reference/DESIGN-SYSTEM.md), which
bans raw hex/rgba in component code, and had a concrete consequence: these
components **and everything built on them** silently ignored the app's
cookie-persisted light/dark toggle. The app ships a full token layer for exactly
this purpose — `src/styles/global.css` maps `--color-surface-*`,
`--color-text-*`, `--color-border-*`, `--color-success|warning|danger|info`, and
`--color-accent` onto per-theme values, and Tailwind v4 auto-generates matching
utilities (`bg-surface-raised`, `text-text-primary`, `border-border-subtle`).

Two changes:

1. **Relocated** `src/components/dashboard/ui/` → `src/components/ui/`. The
   latter is the codebase's established shared-component directory
   (`ErrorBoundary`, `ConfirmDialog`, `ToggleSwitch`, `SlideDrawer`,
   `BottomSheet` all live there and are imported across modules). Since these
   primitives were about to be consumed by Sessions, Debug, and Bookings —
   modules unrelated to "dashboard" — leaving them under `dashboard/` would have
   made every future import read wrong. Confirmed with the operator as a
   decision point rather than assumed.
2. **Converted** every hardcoded value to the token utilities. `MetricCard`'s
   SVG sparkline stroke now uses `var(--color-success)` / `var(--color-danger)`
   directly — SVG attributes accept `var()` natively, so no JS colour lookup is
   needed.

`Tabs` additionally gained the full **WAI-ARIA tab pattern** (`role="tablist"` /
`"tab"` / `"tabpanel"`, `aria-selected`, `aria-controls` ↔ `aria-labelledby`
pairing), which [`reference/coding-standards.md`](reference/coding-standards.md)
§6 documents as mandatory and which the component lacked entirely. Fixing it
once here propagated to every downstream consumer.

### 2.4 Rollout — User Management, Debug Portal, Bookings

With the primitives corrected, they were rolled out in small, independently
revertible commits (no PR gate means blast radius per push is the real safety
net).

**Sessions** (`src/components/admin/users/sessions/`) ran an entirely separate
bespoke `sr-*` CSS class system. `SessionForensicsDrawer.tsx` was the worst
offender in the whole tree — raw hex gradients (`linear-gradient(180deg,
#0f172a 0%, #090d16 100%)`, `backgroundColor: '#060911'`) with zero token usage,
so it never responded to the light theme at all. Migrated to `Card`/`Badge`;
`[SUPABASE_PROJECT_REF]`'s KPI ribbon → `MetricCard`, tab bar → `Tabs`, cards →
`Card`, badges → `Badge`; the two forensic drawers and `ForensicComponents`
followed.

**Debug Portal** was already largely token-driven; only two localised fixes were
needed (`PageRegistryConfirmModal.tsx`'s `bg-[#11141d]`/`text-white/50`, and
`SystemDiagnosticsHistory.tsx`'s hardcoded status-colour map).

**Bookings** (`src/components/admin/bookings/`, 16 files) had **zero**
theme-token usage anywhere — raw slate/white/black Tailwind throughout. The
highest-leverage single fix was `src/lib/bookings/constants.ts`: three shared
functions (`[SUPABASE_PROJECT_REF]`, `getStatusBadgeStyle`, `[SUPABASE_PROJECT_REF]`)
returned raw hex/rgba inline-style objects consumed by six different booking
views. Rewriting those three functions to build colours from `var(--theme-*)`
via a `color-mix()` tint helper fixed all six consumers at the source.

Colour mappings followed design-system precedent rather than being invented:
indigo → `section-violet` (DESIGN-SYSTEM.md explicitly lists indigo among
*eliminated* interactive accents), cyan → `section-cyan`, and the drawer's
`blue-600 → blue-500` gradient tabs flattened onto the single `--theme-accent`
per the "single accent family" rule.

### 2.5 New shared `Menu` primitive

`InlineRoleSelector.tsx` and `OverflowMenu.tsx` were two independent hand-rolled
dropdown implementations. A new `src/components/ui/Menu.tsx`
(`Menu`/`MenuItem`/`MenuSeparator`) generalises the positioning logic
`InlineRoleSelector` already had — portal to `document.body`, fixed coordinates
from the trigger's bounding rect, flip-up when short on space below, clamp
horizontally, reposition on scroll/resize, close on outside-click and Escape.

This is more than de-duplication. `OverflowMenu` previously rendered a
non-portaled `absolute` dropdown **inside a scrollable table** — the same
containing-block clipping trap [`RULESAd.md`](../RULESAd.md) §7.8 documents for
`<dialog>` applies to any `position: fixed` panel inside a scrolling ancestor.
Migrating it onto the portaled `Menu` removed a latent clipping bug, not just
duplicate code.

### 2.6 Structural cleanup

Four files exceeding the 200-line guideline in
[`reference/coding-standards.md`](reference/coding-standards.md) §3 were split
using the documented pattern (shared types/helpers → section components → thin
orchestrator). "At split" is the size immediately before the split — for
`RichEditor` that is larger than its `e860dff` baseline of 234, because the
security fix in §2.1 legitimately added the sanitiser back:

| File | At split | After | Extracted into |
|------|---------:|------:|----------------|
| `[SUPABASE_PROJECT_REF].tsx` | 628 | **487** | `sessionBadges.ts`, `ActiveSessionsPanel`, `AuthHistoryPanel`, `EdgeBlocksPanel` |
| `Composer.tsx` | 393 | **284** | `SaveIndicator`, `ComposerHeader`, `ComposerActionBar` |
| `EmailPortal.tsx` | 347 | **272** | `EmailSidePanel` |
| `RichEditor.tsx` | 332 | **197** | `richEditorBlocks.ts`, `RichEditorToolbar`, `SlashCommandMenu` |

`[SUPABASE_PROJECT_REF]` was over even the raised 600-line threshold
`eslint.config.js` whitelists for it; it is now back under. All four splits are
pure structural extraction with no behavioural change.

### 2.7 Hygiene fixes

- **12 inert audit exceptions removed.** `.audit-exceptions.json` had gained 12
  `protobufjs` GHSA entries plus a `package.json` override. Verified via
  `npm ci` + `npm audit` that `protobufjs` **does not appear anywhere** in the
  resolved dependency tree, and `package-lock.json` showed no diff — the
  override never took effect. Left in place, these would have forced a pointless
  "re-verify and re-date" ritual on expiry (2026-10-23), because
  `audit_gate.py` fails the build on any expired exception *even when the
  advisory itself is irrelevant*. 17 → 5 entries.
- **Dead props fixed.** `MobileComposer` passed `grow` and `variant="borderless"`
  to `RichEditor`, whose rewritten signature silently ignored both — the mobile
  full-screen composer had lost its full-height borderless layout. Support
  restored in `RichEditor`.
- **a11y:** missing `lang="en"` added to the email-preview iframe document
  (`a11y_check.py` rule A11Y-06).
- **Diff noise reverted:** all `package.json` scripts had been prefixed with
  `npx` for no documented reason; reverted.

### 2.8 Two bugs found that were not in the original review

Both surfaced only because the work required reading these files closely:

1. **`session-registry.css` had a phantom CSS variable.** `.sr-btn:hover` and
   `.sr-row-clickable:hover` both referenced `var(--color-surface-hover)` — a
   custom property **defined nowhere in the codebase**. Those hover states had
   silently been doing nothing. Repointed at `--color-surface-elevated`.
2. **The same file's header comment was false.** It opens with *"token-only
   styling… No hardcoded hex. Responds to light/dark via `--color-*` theme
   tokens"* — while its entire Forensic Drawer section was hardcoded hex/rgba
   and never responded to the light theme. The comment is now true.

---

## 3. Impact — measured before/after

All figures produced by running the counts against `e860dff` (before) and `HEAD`
(after), not estimated.

### 3.1 Theme correctness

| Area | Raw colour values before | After |
|------|-------------------------:|------:|
| Bookings module (16 files) | 455 | **0** |
| Sessions (`sessions/` + `session-registry.css`) | 75 | **0** |
| Debug Portal (2 flagged files) | 73 | **0** |
| Shared primitives (`Card`/`Badge`/`Tabs`/`MetricCard`) | 49 | **0** |
| **Total** | **652** | **0** |

Surviving literal colours are deliberate and few: the official WhatsApp brand
green on the WhatsApp CTA, and `text-white` where it sits on a solid
accent/danger/success background.

### 3.2 Accessibility (`scripts/a11y_check.py`)

| Rule | Before | After | Δ |
|------|-------:|------:|--:|
| A11Y-01 (icon-only button lacks accessible name) | 39 | **36** | −3 |
| A11Y-04 (link lacks discernible text) | 5 | 6 | +1 † |
| A11Y-06 (`<html>` lacks `lang`) | 1 | **0** | −1 |

† The +1 is a **checker false positive**, disclosed rather than hidden: the
regex matches an `<a href="${safeUrl}">${safeText}</a>` string inside a
JavaScript template literal in `RichEditor`'s `submitLink` — not JSX. The
rendered link always carries text. This pattern existed in the codebase before
`e860dff` and returned with the `LinkPopover` restoration.

`Tabs` also gained the full ARIA tab pattern, which `a11y_check.py` has no rule
for and therefore does not appear in these counts.

### 3.3 Structure

- Bespoke `sr-*` CSS rules for card/badge/tab/KPI: **20 → 2**; the stylesheet
  shrank 356 → 309 lines.
- Dead `.overflow-menu*` rules removed from `global.css` after the `Menu`
  migration.
- 14 new focused files created; 1 deleted; net **+311 lines** across 55 files
  (1,953 insertions / 1,642 deletions) — the modest net growth is the cost of
  explicit prop interfaces on extracted components, paid back in file sizes now
  under the documented limits.

### 3.4 Dependency budget

**Unchanged.** No npm package added, removed, or upgraded.
`package-lock.json` is untouched by this pass. The `<50KB` "Lean Edge" budget in
[`RULESAd.md`](../RULESAd.md) §7.3 is unaffected.

---

## 4. Rating — before vs after

Scored 1–5 against this repo's own documented standards, not an external
benchmark. "Before" = state at `e860dff`.

| Dimension | Before | After | Basis for the rating |
|-----------|:------:|:-----:|----------------------|
| **Email editor security** | 1 | 4 | Was: unsanitised `innerHTML` from operator-shared drafts, plus unvalidated link URLs — a live stored-XSS path. Now: sanitised on both entry paths + scheme allowlist. Not 5 because the protection is **not CI-enforced** (§2.1). |
| **Dashboard data honesty** | 1 | 5 | Was: one wholly fabricated card and three invented sparklines, in direct breach of RULE #0.5. Now: every rendered value traces to a real `AnalyticsMetrics` field. |
| **Theme correctness** | 2 | 5 | Was: 652 raw colour values; four whole modules dark-only. Now: 0. Rated 5 on code correctness; see the caveat in §6 — not visually verified in a browser. |
| **Design-system adherence** | 2 | 4 | Was: primitives breached the "no raw hex" rule; brand-colour coding contradicted the single-accent rule. Now: token-driven throughout, indigo/cyan mapped to sanctioned section tokens. Not 5 — some `sr-*`/`ios-*`/`diag-*` bespoke class systems still exist for layout. |
| **Component-size discipline** | 2 | 4 | Was: 4 files at 234–619 lines against a documented 200-line limit. Now: 197–487. Not 5 — `[SUPABASE_PROJECT_REF]` (487) is under its whitelisted 600 but still over the general guideline, and `Composer` (284) / `EmailPortal` (272) remain over it too. |
| **Accessibility** | 2 | 3 | Modest, honest movement: −3 A11Y-01, −1 A11Y-06, plus a real ARIA tab implementation. 36 A11Y-01 findings remain repo-wide. `ACCESSIBILITY.md` still correctly claims non-conformance. |
| **Code duplication** | 2 | 4 | Two parallel dropdown implementations unified; six booking views fixed via one shared module; three tab panels extracted from one god-component. |
| **Dependency hygiene** | 3 | 5 | 12 exceptions describing advisories for a package not in the tree, plus an inert override — all removed. Remaining 5 exceptions are genuine and evidence-backed. |

**Composite: 1.9 → 4.3.**

The honest summary: the *severity* of what was wrong was concentrated in two
findings (the XSS regression and the fabricated data), both now resolved. The
*volume* of what was wrong was concentrated in theming, also resolved. What
remains unresolved is mostly pre-existing debt this pass did not claim to
address.

---

## 5. Why these choices, specifically

| Decision | Alternative rejected | Reason |
|----------|---------------------|--------|
| Hand-rolled Preact primitives | Install `shadcn/ui` / Radix / a chart library | RULESAd §7.3 whitelist blacklists them by default; all assume React. Precedent: the Payload CMS evaluation. Adding one requires explicit operator approval, which was not sought because it was not needed. |
| A second, client-side sanitiser | Reuse `sanitize-html.ts` directly | `HTMLRewriter` is a Workers-runtime API and does not exist in the browser. DOMPurify was already rejected repo-wide because `jsdom` crashes the Workers runtime. A mirrored `DOMParser` implementation was the only option that preserves one documented rule set. |
| Strip fake sparklines | Build a KV rolling-history pipeline | Fixing a correctness violation should not be blocked on new infrastructure. Real data was wired where it already existed (Cloudflare timelines); the pipeline is logged as optional work. Operator-confirmed. |
| Move primitives to `src/components/ui/` | Leave under `dashboard/ui/` | They were about to be consumed by three non-dashboard modules. `src/components/ui/` is the established shared location. Operator-confirmed as a decision point. |
| Restore `LinkPopover` | Patch `window.prompt()` with a scheme check | The component was already written, styled, and token-compliant — merely unwired. Restoring it fixes the security gap *and* the mobile UX in one move. Operator-confirmed. |
| Fix `constants.ts` first in Bookings | Fix each of the 16 files individually | Three functions there fed colour into six views. One edit corrected all six. |
| Many small commits | One large commit | No PR gate and no staging environment — per-step revertibility is the only real safety net. |

---

## 6. Verification — and its limits

### What was run, and passed

| Gate | Result |
|------|--------|
| Typecheck (`tsc --noEmit`) | **0 errors** |
| ESLint (`eslint .`) | **0 errors** (276 warnings, all pre-existing `no-explicit-any`) |
| Vitest (`vitest run`) | **347 / 347 passing**, 17 / 17 files |
| `rules_check.py` (SEC-01…10) | **0 violations**, 11 rules |
| `docs_check.py` | **passed**, 0 warnings |
| `audit_gate.py` | **passed in blocking mode**, 0 unexcepted advisories |
| `a11y_check.py` | Improved; see §3.2 |

Every gate was re-run after each of the 15 commits, not only at the end.

### ⚠️ What was NOT verified

Three gaps, stated so nobody assumes more assurance than exists:

1. **`astro check` did not run.** It is the `typecheck` step of
   `npm run verify`, and it fails in the automation sandbox because it opens a
   Cloudflare remote-proxy session requiring `CLOUDFLARE_API_TOKEN`. This
   failure pre-dates this pass. `tsc --noEmit` was substituted and covers all
   `.ts`/`.tsx`; `astro check` additionally validates `.astro` templates. **No
   `.astro` file was modified by this pass**, which bounds the exposure — but
   `npm run verify` should still be run locally to close it.
2. **No browser verification.** The light/dark toggle was never exercised
   visually. The theme work is verified as *code correctness* (zero raw colour
   values remain, tokens resolve per-theme by construction) — not as *rendered
   output*. Contrast and visual regressions across Sessions, Debug, and Bookings
   in both themes remain unverified. This repo has no visual-regression tooling,
   and [`main.md`](../main.md) instructs agents not to drive a browser.
3. **The XSS fix has no automated test.** It was verified by code review against
   the pre-regression implementation. Manual payload testing — pasting
   `<img src=x onerror=alert(1)>` and `<svg onload=alert(1)>`, opening a draft
   containing a `<script>` tag, attempting a `javascript:` link — has **not**
   been performed.

### Recommended manual checks

- [ ] `npm run verify` locally (closes the `astro check` gap)
- [ ] Toggle light/dark on `/dashboard`, `/dashboard/sessions`, `/dashboard/users`, `/dashboard/debug/*`, and the Bookings views
- [ ] Email editor XSS payloads (the three cases above)
- [ ] Mobile composer at a narrow viewport (confirms the `grow`/`variant` fix)
- [ ] Row action menu inside the users table near the viewport bottom edge (confirms `Menu` flip-up and no clipping)

---

## 7. Follow-up candidates

Not done in this pass; recorded so they are not lost.

| Item | Rationale | Size |
|------|-----------|------|
| `rules_check.py` rule for `\.innerHTML\s*=` | The §2.1 fix is not CI-enforced and can silently regress | Small |
| Regression test for the client sanitiser | Payload-based unit tests would make the XSS fix self-guarding | Small |
| KV rolling-history for Supabase/Brevo metrics | Would allow honest sparklines on the two cards that lost them | Medium |
| Remaining A11Y-01 burn-down (36) | `a11y_check.py` is warn-only; intended to flip blocking once clean | Medium |
| Retire remaining `ios-*` / `diag-*` bespoke class systems | Same consolidation rationale as `sr-*` | Medium |
| Arrow-key navigation in `Tabs` | Full WAI-ARIA tabs convention; roles/state are done, roving focus is not | Small |
| `AccessPolicyManager` vs `shared/AccessPolicyGrid` | Suspected duplicate implementations; needs investigation before action | Small |

---

## 8. Change inventory

15 commits on `main`, `e860dff..cf90051`.

| # | Commit | Scope |
|---|--------|-------|
| 1 | `fix(security)` | XSS sanitisation, fabricated data, audit exceptions, `lang`, dead props, `npx` revert |
| 2 | `refactor(ui)` | Primitives moved to `components/ui/`, theme tokens, ARIA tabs |
| 3–5 | `refactor(users)` ×3 | Sessions rollout + `session-registry.css` theme fixes |
| 6 | `refactor(debug)` | Debug Portal token fixes |
| 7 | `feat(ui)` | Shared `Menu` primitive + two call-site migrations |
| 8–12 | `refactor(bookings)` ×5 | Bookings module, `constants.ts` first |
| 13–15 | `refactor(users)` / `refactor(emails)` ×2 | Component splits |

**New files (14):** `sanitize-html-client.ts`, `Badge.tsx`, `Menu.tsx`,
`sessionBadges.ts`, `ActiveSessionsPanel.tsx`, `AuthHistoryPanel.tsx`,
`EdgeBlocksPanel.tsx`, `richEditorBlocks.ts`, `RichEditorToolbar.tsx`,
`SlashCommandMenu.tsx`, `SaveIndicator.tsx`, `ComposerHeader.tsx`,
`ComposerActionBar.tsx`, `EmailSidePanel.tsx`.

**Relocated (4):** `Card.tsx`, `Badge.tsx`, `Tabs.tsx`, `MetricCard.tsx` —
`src/components/dashboard/ui/` → `src/components/ui/`.
