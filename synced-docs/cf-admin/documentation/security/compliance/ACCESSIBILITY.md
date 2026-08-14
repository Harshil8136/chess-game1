---

title: "Accessibility Conformance Statement (WCAG 2.2 AA)"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-08-13
verified_against: [code, config]
owner: harshil
related_docs: [../../reference/DESIGN-SYSTEM.md, ../../MAINTENANCE.md, ../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
tags: [accessibility, wcag, ada, en301549, compliance]
---

# Accessibility Conformance Statement

> **TL;DR (non-technical):** Where this admin portal stands on accessibility.
> Honest summary: the foundations are better than expected — native dialogs,
> keyboard support, a skip link, a declared page language — and an automated
> guard now runs blocking in CI with **zero findings**. But **we still do not
> claim WCAG 2.2 AA conformance**: the automated guard only covers the
> mechanically checkable criteria, and the ones that need a human tester
> (contrast, focus order, screen-reader announcement, zoom/reflow, motion) have
> never been checked. Zero automated findings is not conformance.

> **Corrected 2026-08-13.** This summary previously said "45 known issues
> remain" while §3 of the same document said "0 findings, all resolved" — the
> TL;DR was never updated when the burn-down completed. The 45 figure was the
> original A11Y-01 ×39 + A11Y-04 ×6 backlog and is now historical.

## Context / Scope

Closes gap **G9** from
[`../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md),
which found no accessibility tracking in any compliance document and no
automated checking in CI.

That audit's research is worth restating, because accessibility is usually
under-prioritised relative to its actual risk: over 5,000 US website-
accessibility lawsuits were filed in 2025, **64% against companies under $25M
revenue**, and there is no small-business exemption under ADA Title III.

**Covers:** `cf-admin`, the authenticated staff portal.
**Does NOT cover:** the public site `cf-astro`, which carries materially higher
exposure (public, unauthenticated, consumer-facing) and needs its own statement.

## 1. Conformance claim

**Target standard:** WCAG 2.2 Level AA.
**Claim: NON-CONFORMANT.** Known defects are listed in §3.

This is a deliberate statement. Claiming conformance without a full audit —
including the manual criteria in §4 — would be exactly the kind of unverifiable
assertion the FTC fined an overlay vendor $1M for in 2025.

**Applicable regimes:** ADA Title III (US, no exemption); Section 508 only if
sold to a US federal agency; EN 301 549 / European Accessibility Act (in force
June 2025) if sold into the EU; ADA Title I for employees using this portal.

## 2. What is in place

Verified in code, not assumed:

| Feature | Where | Criterion |
|---|---|---|
| `<html lang="en">` on every page | `src/layouts/AdminLayout.astro`, `src/pages/404.astro` | 3.1.1 |
| "Skip to main content" link | `AdminLayout.astro` | 2.4.1 |
| Native `<dialog>` + `showModal()` everywhere | Mandated by `RULESAd.md` §7.8 | 2.1.2, 2.4.3 |
| Every dialog has an accessible name | 13 fixed 2026-07-25 | 4.1.2 |
| Email-preview iframes declare `lang` | 5 fixed 2026-07-25 | 3.1.1 |
| ARIA/role markup | 98 component files | 4.1.2 |
| Keyboard handlers on interactive elements | Widespread | 2.1.1 |
| Dark/light themes with OKLCH tokens | `DESIGN-SYSTEM.md` | 1.4.3 (unverified) |
| Automated CI guard | `scripts/a11y_check.py` | — |
| Staff Storage `EditDrawer` rewritten from a `createPortal`-mounted div to native `<dialog>` + `showModal()` | Phase 2, 2026-08 — matches `RenameModal.tsx`'s reference pattern; gained focus trapping, Escape-to-close and a real `::backdrop` for free | 2.1.2, 2.4.3, 4.1.2 |
| Inspect drive tree Trash toggle uses named handler references instead of inline arrow functions in JSX | Phase 2, 2026-08 — a `role="button"` element nested inside another `<button>` (native elements cannot nest); named handlers keep the static guard able to see the required `onKeyDown` | 2.1.1, 4.1.2 |

`showModal()` deserves emphasis: it is mandated in this codebase for a *layout*
reason (the "squished card" bug), but it delivers focus trapping, Escape-to-
close and top-layer rendering for free. An accessibility win arrived as a side
effect of a CSS rule — which is why §4 matters: the things nobody tested are
the things nobody knows about.

## 3. Known defects

From `python scripts/a11y_check.py`, last re-verified **2026-08-13** (0 findings
across **254** files, including the Search Console Sync UI):

| Rule | Criterion | Count | Status |
|---|---|:---:|---|
| A11Y-01 | 4.1.2 — icon-only `<button>` with no accessible name | **0** | ✅ Fixed 2026-08-07 |
| A11Y-02 | 1.1.1 — `<img>` without `alt` | 0 | ✅ |
| A11Y-03 | 4.1.2 — `<dialog>` without an accessible name | **0** | ✅ Fixed 2026-08-07 |
| A11Y-04 | 2.4.4 — link without discernible text | **0** | ✅ Fixed 2026-08-07 |
| A11Y-05 | 2.4.3 — positive `tabindex` | 0 | ✅ |
| A11Y-06 | 3.1.1 — `<html>` without `lang` | 0 | ✅ Fixed 2026-07-25 |

All static accessibility findings are resolved (0 findings). The guard runs in
strict **blocking** mode in `package.json` (`npm run verify`).

**Impact:** a screen-reader user hears "button" with no indication of what it
does. For an icon-only control this is a total loss of function, so despite the
mechanical nature of the fix these are genuine blockers, not cosmetic.

### 3.1 Regression log

Zero is a state, not an achievement — it has to be re-verified after every UI
change. Recorded regressions:

| Date | What happened | Resolution |
|------|---------------|------------|
| 2026-08-13 | Search Console Sync UI took the count to 7 (A11Y-01 ×6, A11Y-04 ×1) while this document, `MAINTENANCE.md` and `RULESAd.md` §9.0 all still recorded zero. `npm run verify` was red. | 6 were **false positives** — `has_text_content()` deleted JSX expression containers wholesale, so a button whose label is rendered by a ternary read as icon-only. Fixed in `scripts/a11y_check.py`, not by adding `aria-label` to buttons that already have visible text (which would risk a WCAG 2.5.3 *Label in Name* mismatch). The 7th was genuine and was labelled. See `MAINTENANCE.md` → Accessibility burn-down and C-16. |

## 4. What has NEVER been tested

The honest core of this document. A green CI run says nothing about any of
these:

| Criterion | Why a static guard cannot see it |
|---|---|
| 1.4.3 / 1.4.11 Contrast | Needs rendered pixels; tokens are OKLCH and themeable |
| 2.4.3 Focus order | Needs a real focus sequence in a browser |
| 1.3.2 Meaningful sequence | Needs reading-order inspection |
| 4.1.3 Status messages | Needs screen-reader announcement testing |
| 1.4.10 Reflow (320px) | Needs viewport testing |
| 1.4.12 Text spacing | Needs rendering |
| 2.3.1 Flashes | Needs animation review |
| 2.5.8 Target size (2.2) | Needs rendered geometry |
| 3.2.x Predictability | Needs human judgement |

**No screen reader (NVDA, JAWS, VoiceOver) has ever been run against this
portal.** No keyboard-only walkthrough has been completed. No user with a
disability has tested it.

## 5. Why a static guard instead of axe-core

Two real constraints, both documented rather than worked around:

1. **Dependency whitelist.** `RULESAd.md` §7.3 blacklists unapproved packages;
   axe-core and pa11y are not on the list.
2. **Authentication.** Every route sits behind Cloudflare Access. A crawler-
   based scanner cannot reach a single page in CI without provisioning real
   Zero Trust credentials — which would mean putting a working admin credential
   into CI, a worse trade than the reduced coverage.

`scripts/a11y_check.py` therefore checks what is checkable from source, in the
same declarative idiom as `scripts/rules_check.py`. It blanks comment bodies
before scanning (preserving line numbers) after prose like "built on a native
`<dialog>`" was reported as an unlabelled dialog — a guard that cries wolf gets
switched off, which is worse than no guard.

## 6. Roadmap

| Step | Effort | Cost |
|---|---|---|
| Burn down the 45 A11Y-01/04 findings; flip the guard to blocking | 1–2 days | $0 |
| Manual keyboard-only walkthrough of every dashboard route | 1 day | $0 |
| Contrast audit of the OKLCH tokens in both themes | 0.5 day | $0 |
| Screen-reader pass (NVDA + VoiceOver) on core flows | 2 days | $0 |
| axe-core against a locally built preview with a dev-login session | 1–2 days | $0 (needs a dependency decision) |
| Third-party audit + VPAT | 1–2 weeks | $3k–$15k |

Only the last produces a defensible external conformance claim.

## 7. Feedback

Accessibility problems: `mascotasmadagascar@gmail.com`. Target response 5
business days. **No formal SLA is offered** — stating one that is not resourced
would be worse than stating none.
