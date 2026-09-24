---

title: "CF-Admin Architecture"
status: active
audience: [ai, technical]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [src/workers/cf-entry.ts, src/lib/auth/pipeline.ts, src/lib/dal, src/lib/jobs, src/lib/signalsCore.ts, wrangler.toml, eslint.config.js]
related_docs: [PERMISSIONS-SYSTEM.md, plac-and-audit.md, ../operations/OPERATIONS.md, ../features/CRON-CONTROL.md, ../security/SECURITY.md]
tags: [architecture, overview, workers, astro, cron]
---

# CF-Admin Architecture

> **TL;DR (non-technical):** How the admin portal is built and why it is fast and
> runs at near-zero cost. It explains the "Lean Edge" approach — authenticating and
> authorizing every request at Cloudflare's edge before rendering, staying inside
> free-tier budgets.

> **Scope.** This is the map, not the territory. Each fact below is owned by
> another document and linked rather than copied: the permission model and request
> lifecycle by [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md), bindings, free-tier
> limits and deploy commands by
> [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md), stack versions by
> [`../../RULESAd.md`](../../RULESAd.md) and `package.json`, security posture by
> [`../security/SECURITY.md`](../security/SECURITY.md) §0.
>
> *Refreshed 2026-09-19.* The previous revision restated all four and was wrong
> about each: a stack banner two minor versions behind, a bindings table missing six
> of eleven bindings, a garbled daily-budget table, and a request lifecycle that
> predated the chunk-10 pipeline decomposition by two weeks. Duplicating another
> document's facts is how they go stale; this pass replaced the copies with links.

**Stack:** Astro SSR on Cloudflare Workers (Free plan) with `@astrojs/cloudflare`,
Preact islands, Tailwind CSS, D1, KV, R2, Queues, Workers AI and Analytics Engine.
Exact versions live in `package.json`; the rules version lives in `RULESAd.md`.

---

## 1. Design philosophy — "Lean Edge"

> **Build the simplest architecture that is genuinely production-grade. Defer
> enterprise complexity until scale demands it. Every millisecond of CPU and every
> kilobyte of JavaScript must justify its existence.**

### Core architecture decisions

| Component | Approach | JS bundle |
|-----------|----------|-----------|
| RBAC + ACM | Hierarchical integers + route registry | 0 KB |
| PLAC | Access map embedded in the KV session record + D1 overrides | ~3 KB |
| Navigation | Full-page SSR navigation — **no** `ClientRouter` / View Transitions | 0 KB |
| CSS architecture | Component-scoped + centralized tokens | 0 KB |
| Security headers | Edge-injected via the middleware sequence | 0 KB |
| Audit logging | `waitUntil()` fire-and-forget D1 writes, after the response | 0 KB |
| API caching | HTTP ETag + `Cache-Control` headers | 0 KB |
| Island communication | In-house signals (`src/lib/signals.ts` over `src/lib/signalsCore.ts`) + `<ToastProvider />` | ~1 KB |

*Corrected 2026-09-19: the island row named "Preact Signals" and a `useApi()` hook.
`@preact/signals` was removed as a dependency on 2026-09-02 — only an `overrides`
pin remains — and `useApi` exists nowhere in `src/`. The per-component CPU column
was also dropped; see §7.*

---

## 2. The 5-layer "Lean Edge" stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 5: EXTERNAL PROXY                          │
│  Astro API gateway (/api/chatbot/*) → cf-chatbot Worker (binding)   │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 4: OBSERVER                                │
│  Ghost Audit Engine (waitUntil → D1 admin_audit_log)                │
│  Post-response, zero-latency, fire-and-forget                       │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 3: CACHE                                   │
│  HTTP ETag + Cache-Control headers on API responses                 │
│  KV session record carrying the resolved access map                 │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 2: ACCESS CONTROL                          │
│  Hierarchical RBAC (auth/rbac.ts) + route ACM (auth/routes.ts       │
│  + D1 admin_pages) + Page-Level Access Control (PLAC) overrides     │
├─────────────────────────────────────────────────────────────────────┤
│                    LAYER 1: TRANSPORT                               │
│  Astro SSR + Preact islands + in-house signals                      │
│  Cloudflare Workers → D1 / KV / R2 / Queues / Analytics Engine      │
│  (Hyperdrive: DISABLED — free tier; Observability: logs + traces)   │
└─────────────────────────────────────────────────────────────────────┘
```

*Corrected 2026-09-19: layer 2 named a `registry.ts` that does not exist. The ACM
is `src/lib/auth/routes.ts` plus the D1 `admin_pages` table.*

---

## 3. Request lifecycle

**Owned by [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §7**, which gives every
stage, the store it touches, and each rejection's status code, redirect and audit
row. The diagram that used to sit here described the pre-chunk-10 middleware and
was wrong in five places by the time it was read.

The shape, from `src/lib/auth/pipeline.ts` — a 77-line orchestrator over the stage
modules in `src/lib/auth/stages/`:

```
classify → csrf → session (+ revocation flags + authz mark)
        → role re-check | Access bootstrap
        → access map → decide → record → locals.user → respond
```

Each stage returns either `continue`, carrying the facts the next stage needs, or a
`Decision`. Only `stages/decision.ts` builds a `Response`, and only
`stages/record.ts` writes an audit row — which is what makes every status, header
and KV effect testable in isolation (`test/pipeline-*.test.ts`).

Three handlers compose in `src/middleware.ts`, in order: `sentryErrorBoundary`,
`securityHeaders` (CSP with a per-request nonce), then `authMiddleware`.

After the pipeline, a page render goes through the Data Access Layer (§6), emits
HTML with Preact island placeholders and sets ETag / `Cache-Control`; audit rows
are written after the response through `waitUntil`.

---

## 4. Atomic islands pattern

All front-end code follows this composability hierarchy.

**On the 200-line rule:** it is a design intent, not an enforced limit.
`eslint.config.js` sets `'max-lines': 'off'` globally — turned off "TEMP pending the
god-file split pass" — with a `warn` at 600 lines for **three** named exceptions
(one glob plus two files). *Corrected 2026-09-19: this said four.* File size is also
held by `scripts/ratchet.py` (counter A14, files over 600 lines), which may only
fall. Treat 200 as the target you justify departing from, and 600-as-warning as what
CI will tell you about. `RULESAd.md` §8.1 and
[`../reference/coding-standards.md`](../reference/coding-standards.md) describe the
intent; this note describes the enforcement.

| Level | Role | Rule |
|-------|------|------|
| **Atoms / molecules** | Pure display subcomponents | `SidebarHeader.tsx`, `NavIcon.tsx` |
| **Organisms (islands)** | Stateful wrappers importing atoms | Mounted via `client:load` or `client:idle` |
| **Templates (layouts)** | Raw HTML wrappers (`AdminLayout.astro`) | No reactive state |

---

## 5. Feature-sliced module architecture

Each module is a self-contained unit: pages, components and API handlers.

**Adding a module takes four steps, not two** *(corrected 2026-09-19)*:

1. Create the page folder under `src/pages/dashboard/` and its components under
   `src/components/admin/`.
2. Create the API handlers under `src/pages/api/`.
3. Add an `API_PAGE_MAPPING` entry in `src/lib/auth/routes.ts`. Without it the
   route is **default-denied with a 403**, and `test/api-authz-inventory.test.ts`
   fails CI.
4. Register the page in D1 `admin_pages` — which means a migration, and therefore
   RULE #0.7's three artifacts (ledger row, migration file, verification).

Removing one reverses all four.

### Live module set

Verified against `src/pages/dashboard/` on 2026-09-19. Nineteen dashboard modules:

`alerts` · `arco` · `bookings` · `chatbot` · `content` · `control-plane` · `cron` ·
`debug` · `emails` · `inquiries` · `logs` · `privacy` · `retention` · `seo` ·
`sessions` · `settings` · `storage` · `users`, plus the dashboard home.

`content` has sub-pages `about`, `blog`, `faq`, `gallery`, `hero`, `media`,
`reviews`, `services`. `customers`, `pets`, `analytics` and `reports` exist only as
audit-log enum *modules* in `src/lib/audit.ts`; they are not routes and remain in
the Scale-Up Vault (§9).

*The directory tree that used to fill this section has been deleted rather than
corrected. It listed seven paths that do not exist, two content sub-pages that were
never built, omitted `cron/`, and carried line counts that were off by 3× — the
kind of detail that cannot be kept true by hand. `ls` is authoritative; the module
names above are the part worth writing down.*

Shared library surfaces worth knowing (`src/lib/`): `auth/` (RBAC, PLAC, sessions,
guards and the pipeline), `dal/` (19 repositories), `jobs/` (the scheduled-job
registry, tiers and budgets), `cms/`, `email/`, `storage/`, `control-plane/`,
`ai/`, `schemas/`, `security/`, plus `env.ts` (the single source of truth for
bindings), `audit.ts` and `supabase.ts`.

### The "baseplate" principle

The auth system — middleware, PLAC and the registry — is the Lego baseplate. It
reads from D1 `admin_pages` and enforces page access without knowing what modules
exist. The qualifier is step 3 above: `API_PAGE_MAPPING` **is** a hard-coded module
list, so the API half of a new module does have to touch the baseplate.

### Not-found handling

> **Corrected 2026-08-13.** This section described a spread route at
> `src/pages/dashboard/[...slug].astro` rendering a "Module Under Construction"
> card. That file does not exist — every dashboard route is a real physical page.
> Unmatched paths fall through to
> [`src/pages/404.astro`](../../src/pages/404.astro); denied ones render
> `src/pages/dashboard/access-denied.astro`.

---

## 6. Key systems (summary with cross-references)

### RBAC + PLAC

Six-tier role hierarchy (`vendor_support` > `owner` > `admin` > `manager` >
`staff` > `viewer`) with per-user page-level overrides, resolved once and carried
in the KV session record for an O(1) middleware check. Deny wins — except for
vendor support and owner, who bypass PLAC entirely (ADR-0002).

A role change resets the target's override history and writes an `authz-changed`
mark; **nobody is signed out**, and the target's sessions re-verify on their next
request. *Corrected 2026-09-19: this said role changes "force-logout all active
sessions", which was true until 2026-09-16 and is the behaviour that stranded the
only Owner for 14 hours.*

→ [`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) — the authoritative model
→ [`../features/USER-MANAGEMENT.md`](../features/USER-MANAGEMENT.md) — account lifecycle and the admin UI
→ [`plac-and-audit.md`](plac-and-audit.md) — the Ghost Audit engine

### Security

CSRF via Origin/Referer headers, `__Host-` cookie prefix, edge-injected HTTP
headers (CSP, HSTS, X-Frame-Options), RLS policy matrix, Ghost Protection session
sweeps.

→ [`../security/SECURITY.md`](../security/SECURITY.md)

### CMS & ISR

D1-backed headless CMS with a 2-tier KV injection strategy to bypass D1 replica
lag. Content changes propagate to cf-astro through the `ASTRO_SERVICE` binding,
with the public URL as fallback, and a durable outbox plus queue redrive when both
fail.

→ [`../features/CMS.md`](../features/CMS.md) · [`KV-RESILIENCE.md`](KV-RESILIENCE.md)

### Design system

"Midnight Slate" — Blue-500 accent, 5-level surface elevation, OKLCH color tokens,
two-paradigm CSS (Tailwind utilities + component CSS).

→ [`../reference/DESIGN-SYSTEM.md`](../reference/DESIGN-SYSTEM.md)

### Data Access Layer (DAL)

Repository pattern in `src/lib/dal/` (19 repositories). Controllers — `.astro`
pages and API routes — handle HTTP and auth; repositories hold the D1 SQL;
parameterized queries throughout.

**These are ratchet targets, not achieved states** *(corrected 2026-09-19; the
previous text claimed "zero inline styles" and "zero SQL in UI layers")*. The
baselines in `.ratchet.json` today: **A6** 922 inline `style={`, **A2** 104 raw
`.prepare(` outside the DAL, **A3** 48 of those inside `src/pages/api`. The ratchet
lets these numbers fall and fails the build if they rise; ROADMAP chunks 13.x and 18
are what drives them down.

→ [`../reference/coding-standards.md`](../reference/coding-standards.md)

### Chatbot

Proxied at `/api/chatbot/[...path]` with RBAC gating; admin panels are Preact
islands in `src/components/admin/chatbot/`. The model ladder is owned by the
chatbot doc, not by this one.

→ [`../features/CHATBOT.md`](../features/CHATBOT.md)

---

## 7. Scheduled and queued work

*Added 2026-09-19. The Worker is not only an HTTP handler, and this document said
nothing about the other two entry points.*

`src/workers/cf-entry.ts` exports three handlers:

| Export | Triggered by | What it does |
|---|---|---|
| `fetch` | HTTP | Delegates to Astro's handler |
| `scheduled` | the cron triggers in `wrangler.toml` | Runs the due jobs through the D1 job runner |
| `queue` | `EMAIL_QUEUE` and `SYNC_QUEUE` | Email delivery, and the CMS revalidation redrive |

All three are wrapped by `withSentry`, which is what makes server-side
`Sentry.captureException` work at all. A missing `queue` export fails every deploy
at upload with `Queue handler is missing [code: 11001]` while `astro build` still
passes — regressed once in 2026-08 and now guarded by
`test/worker-entry-contract.test.ts`.

**Two cron expressions** are declared (`*/5 * * * *` and `0 2 * * SUN`) against an
account-wide cap of five, which is why jobs are multiplexed inside the 5-minute
tick rather than given triggers of their own. **Twelve jobs** are registered in
`src/lib/jobs/`, each carrying a criticality tier in `src/lib/jobs/tiers.ts`:

- **essential** — never shed automatically: `cf-access-audit-poll`,
  `cf-access-reconcile`, `booking-email-retry`, `booking-outbox-poke`,
  `cron-usage-probe`, `backup-tick`.
- **deferrable** — shed under D1 pressure: `storage-notifications`,
  `blog-scheduled-publish`, `asset-cleanup`, `staff-storage-reconcile`.
- **idle** — shed under pressure and already off at source: `gsc-sync`,
  `pagespeed-sync`.

Tiers live in code, not in the control row, so a corrupt or hand-edited
`cron-control` document cannot mark the Cloudflare Access whitelist sync as
sheddable. A human pausing a job from the dashboard *can* stop anything, including
an essential one — that is a deliberate, audited act.

The **cron control plane** at `/dashboard/cron` (shipped 2026-09-16, extended
2026-09-17 with a query-trace console and D1 usage reporting, and again
2026-09-20 with per-job throttling, an expiring halt, honest run counts and
failure surfacing) is the operator surface for pausing, resuming, throttling and
triggering jobs. Two of the twelve — the weekly `asset-cleanup` and
`staff-storage-reconcile`, both of which delete — hold a 900 s lease, so a manual
run cannot overlap their scheduled tick; the ten five-minute jobs hold none,
because a lease is a D1 write and writes are the scarcer resource.

→ [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md)

---

## 8. Resource budget

**Owned by [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §3**, which
carries the free-tier limits, and by
[`PERMISSIONS-SYSTEM.md`](PERMISSIONS-SYSTEM.md) §13, which carries the measured
per-request accounting and the capacity arithmetic.

*Two tables were deleted here on 2026-09-19 rather than corrected.* The first was a
per-request CPU budget that itemised a "PLAC KV read ~0.3ms" (there is no separate
PLAC read — the map lives inside the session record) and a "D1 role re-check
~2-3ms" (the re-check reads Supabase, not D1), then summed KV and D1 **I/O** waits
into a **CPU** total. PERMISSIONS §13.3 states the position directly: Worker CPU
time is not measurable from this environment, and no number should be quoted until
it is confirmed with `wrangler tail` or Workers analytics. The second was a daily
budget table whose KV-reads row had a writes figure in it.

The two facts worth carrying here: **KV writes are the binding constraint**, at
1,000/day on the free plan and shared account-wide with cf-astro; and D1 is nowhere
near its ceiling.

---

## 9. Scale-Up Vault (deferred features)

Architecturally sound, not needed until the trigger fires.

| Feature | Trigger condition |
|---------|-------------------|
| **Bitmask entitlements** | >20 granular sub-feature permissions within one page |
| **IndexedDB + SWR + Web Crypto Vault** | 100+ concurrent users approaching the D1 read ceiling, or offline admin needed |
| **Custom fragment orchestration / MFE loader** | 50+ pages **and** initial JS over 100 KB despite Astro code splitting |
| **Global event bus** | 10+ islands on one page with complex cross-dependencies |

---

## 10. Infrastructure & operations

**The binding registry is owned by
[`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) §1**, with the live
IDs. The table that used to sit here listed five bindings and omitted six:
`STAFF_STORAGE`, `SYNC_QUEUE` (and its consumer and dead-letter queue),
`CHATBOT_SERVICE`, `ASTRO_SERVICE`, `AI` and `ASSETS`. In outline: one D1, one KV,
two R2, two Queues, two service bindings, Workers AI, Analytics Engine and the
static-assets binding.

**Observability** — enabled in `wrangler.toml`: invocation logs and traces, both at
head sampling rate 1. Cloudflare dashboard → Workers → Logs.

**Bot management score.** The property is `request.cf.botManagement.score`, and the
gate **is implemented**: `src/lib/auth/stages/bootstrap.ts` refuses a sign-in below
30 and records `bot_score_too_low_*`. It is inert on the free plan, which does not
populate the field — every production `cf_bot_score` row is `null`. *Corrected
2026-09-19: this said `request.cf.botManagementScore` and "gate implementation
blocked until paid plan"; the gate exists, the data does not.*

**Package versions** are owned by `package.json` and pinned by
[`../../RULESAd.md`](../../RULESAd.md). The approved-packages table that used to sit
here had drifted to ranges where `package.json` pins exact versions, and still
listed `@preact/signals`, which is no longer a dependency.

→ [`../operations/OPERATIONS.md`](../operations/OPERATIONS.md) for binding IDs, free
tier limits, the environment registry, Sentry integration and deploy commands.

---

## Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-19 | claude | Refreshed against `06f8ab7`. Read `src/lib/auth/pipeline.ts`, `src/workers/cf-entry.ts`, `src/lib/jobs/tiers.ts`, `eslint.config.js`, `wrangler.toml` `[triggers]`, `package.json`; listed `src/pages/dashboard/`, `src/pages/dashboard/content/`, `src/lib/` and `src/components/admin/`; took ratchet baselines from `.ratchet.json` | Rewritten as an overview that links rather than restates. Removed: the pre-chunk-10 lifecycle diagram, the directory tree, the CPU budget, the daily budget table, the bindings table and the package table. Added §7 on scheduled and queued work. Corrected: the stack banner, island state management, the ACM file name, the ESLint exception count, the add-a-module steps, the role-change behaviour, the "zero inline styles / zero SQL" claims and the bot-score property |
