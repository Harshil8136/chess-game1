{% raw %}
# 23 — Deep Codebase Review, Fix Plan & Multi-Benchmark Ratings (2026-07)

|                 |                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Date**        | 2026-07-04                                                                                                                                                                                                                                             |
| **Reviewed at** | commit `e2e4e09`, branch `claude/codebase-architecture-review-llg890`                                                                                                                                                                                  |
| **Scope**       | Full repository (src, db, drizzle, functions, public, scripts, test, .github, all docs/configs) + live Cloudflare account state                                                                                                                        |
| **Method**      | Three parallel deep-dive reviews (architecture/backend, security, frontend/tests/CI/docs), direct line-level verification of every finding cited below, and live verification of Cloudflare bindings via the Cloudflare MCP connector                  |
| **Limitations** | Supabase, Sentry, and PostHog MCP connectors were approval-gated in this session. Those services are assessed from code, migrations, `wrangler.toml`, and prior docs — not live dashboards. Findings that depend on live state are marked accordingly. |

---

## 1. Executive summary

cf-astro is a **genuinely well-engineered small production system** with an unusually mature security core for its size: Zod validation on every body-accepting endpoint, zero raw-SQL injection surface, per-endpoint bearer secrets compared in constant time, origin checks on every mutating route, RLS on all Postgres tables, and a consent/GDPR implementation that actually does what it claims. The infrastructure is real and consistent — every binding in `wrangler.toml` was verified to exist in the Cloudflare account.

The problems cluster in four areas:

1. **Verified broken code paths** — the admin AI content endpoints write to D1 columns that don't exist (CRIT-1), and a whole middleware subsystem (feature flags) does per-request database work that nothing consumes (HIGH-5).
2. **Documentation that has drifted into being actively false** — SECURITY.md and README.md make claims that directly contradict the code's own hard invariants (HIGH-2), which is dangerous in an AI-assisted repo where docs steer future edits.
3. **A missing engineering safety net** — effectively zero tests, no CI gate for typecheck/build/test, watch-mode-only test script (HIGH-3).
4. **Scaling/robustness debt** — per-request Postgres pools that are never closed, no idempotency on booking, unratelimited admin endpoints, PII stored pre-origin-check with no retention policy (MED-6…13).

**Overall rating: as-found 5.5 / 10 (C) → wave 1 7.5 / 10 (B) → wave 2 8.3 / 10 (B+)** (transparent weighted computation in §5.1/§5.1.1; remediation logs in §4.1/§4.2). The request-path code you'd bet the business on (booking, consent, ARCO) was already B+/A− quality; the meta-layer around it (docs, tests, CI, dead code, config truth) was D-grade and is where the remediation work went.

---

## 2. System architecture (as verified)

### 2.1 Platform & request flow

Astro v6, `output: 'static'` with per-route `prerender = false` for SSR; Preact islands; Tailwind v4; deployed to Cloudflare (see MED-13 — the repo is ambiguous between Pages and Workers, and this ambiguity is load-bearing).

```
Request
  │
  ▼
functions/_middleware.ts        (Pages Function layer)
  ├─ malformed-URI rejection
  ├─ Accept: text/markdown → /llms.txt negotiation
  └─ sentryPagesPlugin wrap (per-route tracesSampler from cached service-config)
  │
  ▼
[static asset?] ── yes ──► served directly, headers from public/_headers
  │ no (on-demand routes only: /es/ + /en/ index, legal/arco, /api/*)
  ▼
src/middleware.ts               (Astro middleware — see HIGH-5: mostly dead for static routes)
  ├─ legacy-host 301 (www / pet subdomain → apex)
  ├─ feature-flag load: memory(10s) → Cache API(60s) → D1  [result unused — HIGH-5]
  ├─ static-asset cache-header rewrite                      [dead — duplicated by _headers]
  ├─ trailing-slash 301
  └─ ISR HTML cache: KV get/put keyed isr:${path}#${BUILD_ID}
  │
  ▼
Route handlers (src/pages/**)
```

### 2.2 Data flows

- **Booking** (`api/booking.ts`): D1 dead-letter audit first → burst guard → origin check → rate limit → Zod → single Drizzle transaction (bookings → consent_records → booking_pets → quality_metadata → 2× email_audit_logs) → `EMAIL_QUEUE` dispatch (consumed by the separate `cf-astro-email-consumer` worker) → response with WhatsApp handoff link.
- **Contact** (`api/contact.ts`): origin → rate limit → Zod → blocking insert, then `waitUntil` audit + queue.
- **Consent** (`api/consent.ts`): audit-first D1 → origin → rate limit → Zod → Drizzle insert with IP/geo/fingerprint evidence.
- **ARCO** (`api/arco/submit.ts`): Turnstile + 6-layer file validation (incl. magic bytes) → R2 (`arco-documents`, UUID keys) → Drizzle insert → queue. Retrieval via `api/arco/get-document.ts` behind `ARCO_ADMIN_SECRET`.
- **Telemetry**: consent-gated PostHog loaded only after explicit accept; first-party reverse proxy at `api/ingest/[...path].ts` with header allowlisting and cookie stripping.
- **Config plane**: cf-admin → `api/revalidate.ts` (Bearer) purges ISR KV / writes `cms:*` keys / purges edge cache tags; clients read `api/runtime-config.ts`; rate/telemetry config single-sourced in `src/lib/sync-contract.ts`.
- **Primary datastore**: Supabase Postgres via Drizzle + postgres.js. D1 (`madagascar-db`) serves as dead-letter audit, feature flags, CMS content, service config, and rate-limit fallback.

### 2.3 Verified service inventory (live via Cloudflare MCP, 2026-07-04)

| Binding (wrangler.toml)        | Expected resource                                                                                        | Live account state                                             | Status |
| ------------------------------ | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- | ------ |
| Worker `cf-astro`              | —                                                                                                        | exists, last modified 2026-07-01                               | ✅     |
| `DB` (D1)                      | `madagascar-db` `7fca2a07-…`                                                                             | exists (1.99 MB)                                               | ✅     |
| `SESSION` (KV)                 | `bee123e7…`                                                                                              | exists ("SESSION")                                             | ✅     |
| `ISR_CACHE` (KV)               | `d9cea8c7…`                                                                                              | exists ("ISR_CACHE")                                           | ✅     |
| `ARCO_DOCS` (R2)               | `arco-documents`                                                                                         | exists                                                         | ✅     |
| `IMAGES` (R2)                  | `madagascar-images`                                                                                      | exists                                                         | ✅     |
| `EMAIL_QUEUE` (producer)       | `madagascar-emails` → consumer worker                                                                    | consumer `cf-astro-email-consumer` exists, modified 2026-07-03 | ✅     |
| `ANALYTICS` (Analytics Engine) | `madagascar_analytics`                                                                                   | not listable via MCP; code-verified only                       | ➖     |
| `AI` (Workers AI)              | account binding                                                                                          | code-verified only                                             | ➖     |
| Sibling systems                | `cf-admin-madagascar`, `whatsapp-chatbot`, `cf-chatbot` workers; `EMAIL_IDEMPOTENCY`, `ADMIN_SESSION` KV | all exist                                                      | ✅     |

No orphan or phantom bindings were found. One stale artifact contradicts this inventory: see LOW-20a (`d1.json`).

---

## 3. Findings register

Severity scale: **CRIT** = broken or dangerous now · **HIGH** = materially degrades safety/quality now · **MED** = real risk, needs scheduling · **LOW** = polish/hygiene.

### Critical / High

#### CRIT-1 — Admin AI endpoints write to D1 columns that do not exist _(verified)_

- **Where**: `src/pages/api/admin/generate-faqs.ts:62-64`, `src/pages/api/admin/generate-blog-draft.ts:71-74` vs `db/migrations/0002_cms_content.sql:6-15`
- **Evidence**: the migration defines `cms_content(id, page, type, content, last_updated_by, updated_at)`. Both endpoints run `INSERT OR REPLACE INTO cms_content (block_type, block_key, content_json, updated_at)`. Readers (`src/lib/cms.ts:9,24`) select `content … WHERE page = ? AND id = ?`.
- **Impact**: every invocation of the AI FAQ/blog-draft generation fails at the D1 insert (`no such column`), surfacing as a 500 from the catch block. Even if the insert schema were patched to match nothing could read the drafts back. The feature is dead end-to-end.
- **Fix**: align both INSERTs with the real schema (`id`/`page`/`type`/`content`) or migrate the table — and add a test that round-trips a draft through write→read.

#### HIGH-2 — SECURITY.md and README.md make false security claims

- **Where**: `SECURITY.md` §1/§3/§4/§5/§10; `README.md:69`
- **Evidence** (each verified against code):
  - Claims "all layers fail-closed" — `src/lib/rate-limit.ts:15-18` documents and implements **fail-open** by design (`kvRateCheck` returns allow on error, `burstAllowed` allows when KV is absent).
  - Claims Turnstile protects booking/contact — `src/pages/api/booking.ts:1-12` and `contact.ts` carry banners stating Turnstile is **permanently forbidden** there; only `arco/submit.ts` verifies it. `README.md:69` repeats the false claim ("✅ Invisible" on /api/booking), directly contradicting `AGENTS.md:26-31`.
  - Documents `src/pages/api/webhooks/resend.ts` in detail — **the file/directory does not exist**.
  - Rate-limit table stale (says booking=5; actual 20 in `src/lib/sync-contract.ts:33-40`; omits analytics/mcp/admin keys).
  - Says ARCO accepts `jpg/jpeg/png/pdf` — code (`arco/submit.ts:23`) accepts `jpg/jpeg/png/webp` and **rejects PDF**.
  - Secret-segregation table omits `ARCO_ADMIN_SECRET` — the secret guarding the most sensitive endpoint.
- **Impact**: in a repo whose own AGENTS.md instructs AI tools to treat docs as authority, false security docs are an incident generator: a future contributor "fixing" booking to match SECURITY.md would violate the availability invariant the business chose deliberately.
- **Fix**: rewrite SECURITY.md from code (treat `sync-contract.ts`, `security.ts`, `rate-limit.ts`, endpoint sources as truth); fix README table; add a doc-accuracy check item to the PR checklist.

#### HIGH-3 — No CI quality gate; tests effectively don't exist

- **Where**: `.github/workflows/` (only `security.yml`, `sync-docs.yml`), `test/example.test.ts`, `package.json:17`
- **Evidence**: no workflow runs `astro check`, `astro build`, or vitest. `security.yml` runs `npm audit --omit=dev || true` (non-blocking). The only test is a 12-line `SELECT 1` smoke test. `"test": "vitest"` runs watch mode — it would hang any CI. Deploy is git-auto-deploy/`wrangler deploy` with nothing gating a broken build.
- **Impact**: typecheck/build regressions ship straight to production; CRIT-1 is exactly the class of bug a single integration test would have caught.
- **Fix**: Phase 3 below.

#### HIGH-4 — `sync-docs.yml` mirrors internal docs into an unrelated public repo

- **Where**: `.github/workflows/sync-docs.yml:34`
- **Evidence**: on push, `RULES.md` and `Documentation/` are copied into `Harshil8136/chess-game1` (a public repository) wrapped for Jekyll.
- **Impact**: internal operational documentation — incident reports, security remediation history, architecture, ratings like this one — is published to a public repo on every push to `main`, with no review step.
- **Status (2026-07-05)**: owner confirmed the mirror is **intentional** — the workflow is kept as-is (it captures all of `Documentation/**`, including this report, on merge to `main`). Residual recommendation: make the target repo private or purpose-named, and treat `Documentation/` as public-by-default when writing future docs (no secrets, tokens, or customer data ever).

#### HIGH-5 — Astro middleware is mostly dead for the routes it targets; feature-flag subsystem does work nothing consumes _(high confidence; confirm via generated `_routes.json`)_

- **Where**: `src/middleware.ts:46-92` (flags), `:94-121` (asset headers), `:19-40`/`:131-144` (301s)
- **Evidence**: with `output: 'static'`, only `{es,en}/index.astro`, `{es,en}/legal/arco.astro`, and `/api/*` are on-demand — all other pages are prerendered assets served without invoking Astro middleware. Additionally, `locals.features` is **read nowhere** in the codebase, so the 3-layer flag cache + `SELECT flag_key, is_enabled FROM admin_feature_flags` D1 query is pure per-request waste on the routes where middleware _does_ run. The static-asset header block duplicates `public/_headers` (which is the effective mechanism).
- **Impact**: dead complexity that misleads (recent SEO commits added redirect logic here that never fires for the bulk of pages); wasted D1 round-trip + Cache API put per SSR render.
- **Fix**: delete the flag block (or wire `locals.features` into rendering deliberately), delete the asset-header block, and document that host/trailing-slash canonicalization for static pages lives in Cloudflare Redirect Rules + build output, not middleware.

### Medium

#### MED-6 — New Postgres pool per request; `sql.end()` never called

- **Where**: `src/lib/db/client.ts:30-51` (`max: 5`), 8 `createDb()` call sites
- **Impact**: each request builds a fresh postgres.js pool and abandons it to `idle_timeout`. Under concurrency this multiplies sockets toward the Workers 6-connection cap and Supabase/Supavisor connection limits; `contact.ts:196` extends pool lifetime inside `waitUntil`. Fine at ~50 req/day; a cliff under load or during a crawl.
- **Fix**: module-level lazy singleton per isolate + `ctx.waitUntil(sql.end({ timeout: 5 }))` where a per-request client is genuinely needed.

#### MED-7 — Consent records hardcode `locale: 'es'` on a bilingual site

- **Where**: `src/pages/api/booking.ts` (consent insert `locale: 'es'`, `auditPayload.locale: 'es'`, Spanish-only WhatsApp message `:382`)
- **Impact**: the **legal consent record** misstates the language the user consented in for `/en/` submissions — a compliance-relevant data-quality defect, plus Spanish confirmation UX for English users.
- **Fix**: carry locale in the booking payload (validated by Zod enum) through to consent, audit, and WhatsApp copy.

#### MED-8 — No rate limiting on secret-guarded endpoints

- **Where**: `api/health.ts`, `api/test-services.ts`, `api/cms-status.ts`, `api/revalidate.ts`, `api/arco/get-document.ts`
- **Impact**: unbounded authentication attempts against bearer/header secrets. Worst case is `arco/get-document`: identity documents behind a single static secret plus a brute-forceable `ARCO-\d{6}` ticket namespace — highest-value target, least defended. `timingSafeEq` prevents timing leaks but not volume.
- **Fix**: apply the existing `checkRateLimit` helper (an `admin` key already exists in `RATE_LIMITS`) to all five; consider IP allowlisting or Cloudflare Access for `get-document`.

#### MED-9 — PII handling gaps in telemetry/audit

- **Where**: `api/analytics/track.ts:41` (raw `cf-connecting-ip` written to Analytics Engine blobs — the middleware's own page_view deliberately omits IP); `api/booking.ts:100` (request body stored in D1 dead-letter **before** the origin check, with IP + user-agent, no documented retention/purge)
- **Correction (2026-07-05)**: the body IS PII-redacted before storage — `redactPii()` in `src/lib/db/d1-attempts.ts:27` scrubs known PII keys, exactly as AGENTS.md invariant #2 claims. The original draft of this finding overstated it. What remains valid: IP + UA are stored per attempt including for origin-rejected requests, and there is no retention/purge policy for `booking_attempts`/`consent_attempts`.
- **Fix**: drop raw IP from track.ts blobs (country is enough); add a retention purge (cron on cf-admin or D1 TTL sweep) for the attempt tables and document it.

#### MED-10 — ARCO upload buffers the whole multipart body before any size check

- **Where**: `api/arco/submit.ts:59` (`request.formData()`) vs size check at `:127`; no `content-length` guard (booking/contact have one)
- **Impact**: memory/CPU DoS vector; only the 3/60s rate limit mitigates.
- **Fix**: reject on `content-length > ~6 MB` before parsing.

#### MED-11 — Email provider identity crisis: Resend vs Brevo

- **Where**: `wrangler.toml:70,82,122-123` (BREVO__), `.env.example:35-39` (RESEND__), `README.md:31,52` (Resend as feature) vs `README.md:174` ("RESEND_API_KEY no longer used"), SECURITY.md §5 (nonexistent Resend webhook)
- **Impact**: nobody can tell from the repo which provider and which webhook secret is live; webhook signature verification for the live provider is unconfirmed (the consumer lives in `cf-astro-email-consumer`, outside this repo).
- **Fix**: pick the true provider, purge the other from all four files, and verify/document webhook signature verification in the consumer worker.

#### MED-12 — Booking lacks idempotency; hot path serializes 4 D1 audit writes

- **Where**: `api/booking.ts:100,293,323,375`
- **Impact**: double-click/retry submits create duplicate bookings + duplicate emails (no client dedupe token, no server uniqueness); the awaited audit-state writes add 4 sequential D1 round trips to p50 latency (only the first must precede the response).
- **Fix**: client-generated idempotency UUID persisted with a unique index; `waitUntil` the non-terminal audit updates.

#### MED-13 — Pages-vs-Workers ambiguity is unresolved and load-bearing

- **Where**: `functions/_middleware.ts` + `sentryPagesPlugin` (Pages-only) vs `package.json:13` `cf:deploy` = `wrangler deploy` (Workers) vs `README.md:6,46,164` ("Pages") vs `wrangler.toml:10` comment
- **Impact**: if the site actually deploys as a plain Worker, the Pages Function layer (malformed-URI guard, llms.txt negotiation, **all server-side Sentry capture**) silently never runs — `captureApiError` no-ops are swallowed by design (`src/lib/error-context.ts:60`). Conversely if it's Pages, `cf:deploy` is the wrong command. One of the two is currently a lie.
- **Fix**: decide, then delete the losing half and align deploy scripts, docs, and Sentry init accordingly. Verify server-side Sentry events actually arrive today.

### Low

- **LOW-14 — Dead View-Transitions code**: ClientRouter removed (`BaseLayout.astro:213`) but `astro:after-swap`/`astro:page-load` listeners remain (`BaseLayout.astro:245-268,372`, `Header.astro:444`, `Testimonials.astro:359`). The language-switch scroll-preservation feature is silently dead.
- **LOW-15 — Head asset bugs**: `/icons/apple-touch-icon.png` referenced on every page (`BaseLayout.astro:169`) but missing from `public/icons/` → sitewide 404; favicon declared `type="image/png"` for an `.ico` (`:168`); og:image:type computed as `image/jpeg` for the default PNG (`:129`).
- **LOW-16 — Structured-data risks**: hardcoded `aggregateRating 4.7 / 231 reviews` in JSON-LD (`Testimonials.astro:62,110,190-192`) — unverifiable review counts are a Google policy risk; `ServicePageSchema.astro:206-207` uses raw `JSON.stringify` instead of the `jsonLdSafe` escaper used everywhere else.
- **LOW-17 — CSP weakening**: `script-src 'unsafe-inline' 'unsafe-eval'` and `Cross-Origin-Embedder-Policy: unsafe-none` in `public/_headers` blunt an otherwise excellent header set; `sanitizeHtml` (`src/lib/security.ts:157`) is regex-based — adequate for trusted CMS input, insufficient if content ever becomes user-generated.
- **LOW-18 — i18n/theming dead ends**: hardcoded English aria-labels and mobile hints in islands (`InfiniteGallery.tsx:67`, `ImageLightbox.tsx` incl. never-rendered `mobileHintText` prop); site is forced light-only (`BaseLayout.astro:83,163`) yet ships a full dark-token set and `dark:` variants — unreachable CSS.
- **LOW-19 — Build/asset posture**: Google Fonts loaded from Google's CDN (10 weights across 2 families) — render-path third-party + IP leak at odds with the privacy posture; `sourcemap: true` ships `.map` files to users whenever `SENTRY_AUTH_TOKEN` isn't set at build.
- **LOW-20 — Repo hygiene** (a–h):
  a. `d1.json` — committed UTF-16 artifact with a **stale/wrong DB UUID** (`a88992c4…` vs real `7fca2a07…`).
  b. `main.md` — stray AI prompt note at repo root.
  c. Duplicate vendored skill trees: `.agents/` and `.windsurf/` carry identical ~40-file copies of a Supabase skill.
  d. Two overlapping migration systems (`db/migrations/` = applied truth vs `drizzle/` + meta) with no README pointer to which wins.
  e. `knip.json` configured but unwired (no script/CI) and heavily relaxed.
  f. `src/lib/env.ts` returns `any`, discarding the entire 416 KB generated `worker-configuration.d.ts` type surface; `cms.ts:4-5`/`pricing.ts:5-6` capture env + logger at module import (token unset at first import ⇒ silent no-op logging for the isolate's life).
  g. Doc rot: `README.md:145` references nonexistent `.dev.vars.example`; `README.md:74` links nonexistent `Documentation/Consent_System_Audit.md`; `ToDo.md` claims (changefreq "Done", `/_astro/` robots block "Done") contradicted by code; BetterStack-rotation item still open in ToDo though AGENTS.md says resolved 2026-06-13.
  h. `src/middleware.ts` step comments numbered 0,1,3,4,3a,4,3,5,6 — refactor residue.

### Positives (credited in ratings)

- Zod schemas on every body-accepting endpoint; payload size caps before parse (booking/contact/consent).
- **Zero SQL-injection surface**: Drizzle ORM + parameterized D1 `.prepare().bind()` only; the only literal SQL strings are static.
- Origin allowlist on all mutating public endpoints; per-endpoint dedicated secrets with correct constant-time comparison (`timingSafeEq`, length-padded).
- Consent architecture is **actually correct**: PostHog loads only after explicit accept; reject path still records legal evidence; session recording masks all inputs; remote kill-switch honored.
- Strong `public/_headers`: CSP + HSTS(preload) + XCTO + XFO + Referrer-Policy + tight Permissions-Policy.
- RLS enabled on all 7 Postgres tables with service-role-only policy (`drizzle/0001_db_hardening.sql`).
- Resilience-by-design: D1 dead-letter audit captures every booking attempt even with Supabase down; queue-decoupled email with reconciler path; multi-tier CMS fallback (KV → D1 → static).
- ARCO uploads: 6-layer validation incl. magic bytes, UUID-only R2 keys, private bucket.
- SEO machinery is sophisticated and mostly correct: per-language sitemaps with in-URL hreflang, x-default, AI-crawler-aware robots, canonical enforcement.
- Conservative island hydration; genuinely thorough native-`<dialog>` lightbox; good a11y baseline (skip links, aria-current, alertdialog consent).

---

## 4. Robust phased fix plan

> Ordering rule: nothing in a later phase blocks an earlier one; each phase is independently shippable and verifiable.

### Phase 0 — Same-day, zero-risk (≈ 2–3 h)

| #   | Action                                                                                                                                                   | Files                                                  | Finding         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ | --------------- |
| 0.1 | ~~Delete or re-target the public docs mirror~~ — SKIPPED: owner confirmed the mirror is intentional; treat `Documentation/` as public-by-default instead | `.github/workflows/sync-docs.yml`                      | HIGH-4          |
| 0.2 | Delete stale artifacts                                                                                                                                   | `d1.json`, `main.md`, one of the duplicate skill trees | LOW-20a/b/c     |
| 0.3 | Add real `apple-touch-icon.png`; fix favicon/og:image types                                                                                              | `public/icons/`, `BaseLayout.astro:129,168-169`        | LOW-15          |
| 0.4 | Correct README security table (remove false Turnstile claim, add /api/contact), fix `.dev.vars.example` step + broken doc link                           | `README.md:69,74,145`                                  | HIGH-2, LOW-20g |
| 0.5 | Reconcile ToDo.md claims with reality                                                                                                                    | `ToDo.md`                                              | LOW-20g         |

### Phase 1 — Correctness (≈ 1 day)

| #   | Action                                                                                                                                      | Files                                        | Finding         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------- |
| 1.1 | Fix `cms_content` INSERTs to match migration 0002 (`id`,`page`,`type`,`content`); round-trip test                                           | `generate-faqs.ts`, `generate-blog-draft.ts` | CRIT-1          |
| 1.2 | Delete dead feature-flag block + asset-header block from Astro middleware (or wire `locals.features` in deliberately); clean step numbering | `src/middleware.ts`                          | HIGH-5, LOW-20h |
| 1.3 | Singleton Postgres pool per isolate; `ctx.waitUntil(sql.end())` where per-request clients remain                                            | `src/lib/db/client.ts` + 8 call sites        | MED-6           |
| 1.4 | Thread real locale (Zod-validated) into consent record, audit payload, WhatsApp copy                                                        | `bookingSchema`, `api/booking.ts`            | MED-7           |
| 1.5 | Decide Pages vs Workers; delete losing half; align `cf:deploy`, docs, Sentry init; confirm server-side Sentry events arrive                 | `package.json`, `functions/`, `README.md`    | MED-13          |

### Phase 2 — Security hardening (≈ 1 day)

| #   | Action                                                                                                                                                                                      | Files                                           | Finding |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------- |
| 2.1 | Rate-limit `health`, `test-services`, `cms-status`, `revalidate`, `arco/get-document` (reuse `RATE_LIMITS.admin`)                                                                           | 5 endpoint files                                | MED-8   |
| 2.2 | `content-length` guard before `formData()` on ARCO submit                                                                                                                                   | `arco/submit.ts`                                | MED-10  |
| 2.3 | Drop/hash raw IP in analytics track; add D1 dead-letter retention purge + document it                                                                                                       | `analytics/track.ts`, cf-admin cron or D1 sweep | MED-9   |
| 2.4 | Booking idempotency key (client UUID + unique index) and `waitUntil` non-terminal audit writes                                                                                              | `api/booking.ts`, migration                     | MED-12  |
| 2.5 | Rewrite SECURITY.md from code as source of truth (fail-open stance, real Turnstile scope, real limits/extensions, full secret table incl. ARCO_ADMIN_SECRET; delete Resend-webhook section) | `SECURITY.md`                                   | HIGH-2  |
| 2.6 | Resolve Resend vs Brevo across all config/docs; verify webhook signature verification in the consumer worker                                                                                | `wrangler.toml`, `.env.example`, `README.md`    | MED-11  |

### Phase 3 — CI & testing safety net (≈ 1–2 days)

| #   | Action                                                                                                                                                                      | Files                                      | Finding         |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | --------------- |
| 3.1 | Add `ci.yml`: `npm ci` → `astro check` → `astro build` → `vitest run` on PR + main; make `npm audit` blocking at high severity                                              | `.github/workflows/ci.yml`, `security.yml` | HIGH-3          |
| 3.2 | Add `"test:ci": "vitest run"`; wire `knip` script                                                                                                                           | `package.json`, `knip.json`                | HIGH-3, LOW-20e |
| 3.3 | Meaningful tests: booking/contact/consent Zod schemas (accept + reject), `timingSafeEq`, `assertOrigin`, rate-limit fallback, i18n key parity es↔en, cms_content round-trip | `test/`                                    | HIGH-3, CRIT-1  |
| 3.4 | Point vitest workers pool at `wrangler.toml` instead of duplicated inline miniflare config                                                                                  | `vitest.config.ts`                         | HIGH-3          |

### Phase 4 — Cleanup & performance polish (opportunistic)

| #   | Action                                                                                                      | Finding        |
| --- | ----------------------------------------------------------------------------------------------------------- | -------------- |
| 4.1 | Remove dead View-Transitions listeners (or re-add ClientRouter deliberately)                                | LOW-14         |
| 4.2 | Strip dark-mode tokens/`dark:` variants or un-force light mode                                              | LOW-18         |
| 4.3 | Localize island aria-labels/hints; render or remove `mobileHintText`                                        | LOW-18         |
| 4.4 | Self-host fonts (subset, ≤4 weights)                                                                        | LOW-19         |
| 4.5 | Make `aggregateRating` CMS-driven from real review data or remove it; use `jsonLdSafe` in ServicePageSchema | LOW-16         |
| 4.6 | Type `getEnv()` against generated `Env`; move module-level env/logger capture into request scope            | LOW-20f        |
| 4.7 | Document migration source-of-truth (db/migrations vs drizzle/), or collapse to one system                   | LOW-20d        |
| 4.8 | Evaluate dropping `unsafe-eval` from CSP (PostHog compat check); guard `.map` emission on token presence    | LOW-17, LOW-19 |

---

## 4.1 Remediation status (2026-07-05, this branch)

Phases 0–3 plus the Phase-4 quick wins were implemented on
`claude/codebase-architecture-review-llg890` immediately after this review.
Verified before each commit: `vitest run` 26/26 green, `astro check` 0 errors,
`astro build` clean.

| Finding                                | Status                                                                                                                                  | Where                                                                      |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| CRIT-1 cms_content column mismatch     | ✅ Fixed + regression test                                                                                                              | `generate-faqs.ts`, `generate-blog-draft.ts`, `test/cms-roundtrip.test.ts` |
| HIGH-2 false SECURITY.md/README claims | ✅ Fixed — docs reconciled with code                                                                                                    | `SECURITY.md`, `README.md`, `AGENTS.md`                                    |
| HIGH-3 no CI gate / no tests           | ✅ Fixed — ci.yml (check+build+test), blocking npm audit, 26 tests                                                                      | `.github/workflows/ci.yml`, `security.yml`, `test/*`                       |
| HIGH-4 public docs mirror              | ➖ Kept intentionally (owner decision); Documentation/ treated as public                                                                | `.github/workflows/sync-docs.yml`                                          |
| HIGH-5 dead middleware subsystems      | ✅ Fixed — flag loader + asset rewrite removed, numbering/locale-sniff cleaned                                                          | `src/middleware.ts`, `env.d.ts`                                            |
| MED-6 per-request pool never closed    | ✅ Fixed — `closeDb()` at all 6 call sites via `waitUntil`                                                                              | `src/lib/db/client.ts` + endpoints                                         |
| MED-7 consent locale hardcoded 'es'    | ✅ Fixed — Zod-validated locale threaded from wizard to consent/audit/email/WhatsApp                                                    | `booking.ts`, `schemas/booking.ts`, `BookingWizard.tsx`                    |
| MED-8 unratelimited admin endpoints    | ✅ Fixed — `admin` limit before auth on all five                                                                                        | `health`, `test-services`, `cms-status`, `revalidate`, `arco/get-document` |
| MED-9 analytics IP + retention         | ✅ IP dropped from track.ts · ⏳ retention purge for attempt tables still open (needs cf-admin cron)                                    | `analytics/track.ts`                                                       |
| MED-10 ARCO unbounded body buffer      | ✅ Fixed — 6 MB Content-Length gate before formData()                                                                                   | `arco/submit.ts`                                                           |
| MED-11 Resend vs Brevo confusion       | ✅ Fixed — Brevo confirmed against deployed consumer; all configs/docs aligned · ⏳ webhook signature audit lives in consumer repo      | `.env.example`, `wrangler.toml`, docs                                      |
| MED-12 no booking idempotency          | ✅ Fixed — SESSION-KV replay keyed by per-session client token, 24 h TTL · ⏳ hot-path audit writes still sequential                    | `booking.ts`, `BookingWizard.tsx`                                          |
| MED-13 Pages vs Workers ambiguity      | ✅ Docs standardized on Workers (deployed worker verified) · ⏳ `functions/_middleware.ts` fate + server-Sentry verification still open | `README.md`                                                                |
| LOW-14 dead View-Transitions listeners | ✅ Removed; scroll-restore feature revived on full page loads                                                                           | `BaseLayout`, `Header`, `Testimonials`                                     |
| LOW-15 head asset bugs                 | ✅ Fixed — apple-touch-icon added, favicon/og types corrected                                                                           | `public/icons/`, `BaseLayout.astro`                                        |
| LOW-16 JSON-LD inconsistency           | ✅ `jsonLdSafe` now used in ServicePageSchema · ⏳ hardcoded aggregateRating still open                                                 | `ServicePageSchema.astro`                                                  |
| LOW-20a/b stale artifacts              | ✅ Deleted `d1.json`, `main.md`; ToDo.md claims reconciled                                                                              | repo root                                                                  |
| LOW-17/18/19, LOW-20c–h                | ⏳ Open (CSP tightening, island i18n, dark-CSS strip, font self-hosting, migration dedupe, `getEnv()` typing)                           | see §4 Phase 4                                                             |

Also fixed en route: `npm audit fix` cleared the high-severity undici/ws/@babel/yaml advisories, and two latent type errors were caught by the newly enforced typecheck. One review correction was logged (MED-9: `redactPii` does exist — see the finding).

---

## 4.2 Second remediation wave (2026-07-05 PM — roadmap execution)

Everything in §5.10 executable from the repository, shipped same-day:

| Item                                          | What shipped                                                                                                                                                                                                                                                                |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Server-side Sentry on Workers (R1 structural) | `Sentry.wrapRequestHandler` + async-context strategy wrapping the Astro middleware; release tied to `__BUILD_ID__`; 10% traces. The old Pages-only layer is bypassed-safe. Live event verification remains an owner step.                                                   |
| Doc-accuracy enforcement                      | `test/doc-accuracy.test.ts`: SECURITY.md §4 limits and §8 allowlist checked against `sync-contract.ts`; regression tripwires for the fail-open wording and the phantom webhook. Caught and fixed 4 undocumented allowlist keys on first run.                                |
| Endpoint-handler tests                        | `test/endpoints.test.ts`: booking (origin 403 / Zod 400 / oversize 413 / bad JSON 400), contact, consent, analytics-track (403/400/204), health 401, get-document 401 + ticket-format 400 — real handlers in workerd, dummy bindings, no external I/O. Suite: **44 tests**. |
| Deploy pipeline                               | `.github/workflows/deploy.yml` — build + `wrangler deploy` on main; self-skips until the `CLOUDFLARE_API_TOKEN` secret exists.                                                                                                                                              |
| D1 retention purge (R3)                       | `db/retention-purge.sql` (validated locally) + `.github/workflows/retention-purge.yml` weekly cron; 90-day window documented; consent evidence untouched.                                                                                                                   |
| Self-hosted fonts (R7)                        | DM Sans + Outfit variable woff2 (95 KB total, latin subset incl. es diacritics) in `public/fonts/` + `@font-face`/preload; Google Fonts links, preconnects, and CSP hosts removed; `/fonts/*` immutable-cached. Built HTML verified: 0 googleapis references.               |
| Honest aggregateRating (R5)                   | Computed from the on-page reviews' real `rating` fields; schema omitted entirely when no rated reviews exist; hardcoded 4.7/231 removed.                                                                                                                                    |
| Island a11y i18n                              | `ImageLightbox` gained a typed `labels` API (aria + hints), `InfiniteGallery` forwards it plus `viewImageLabel`; es/en dictionaries extended (parity test keeps them locked); dead `mobileHintText` prop removed.                                                           |
| Live dark-mode inconsistency                  | 5 `dark:` utilities removed — with no `@custom-variant dark`, Tailwind's media-based variant was ACTIVATING partial dark styles for dark-OS users on the forced-light site.                                                                                                 |
| Booking hot path                              | `db_success`/`complete` audit-state writes moved to `waitUntil` (2 fewer sequential D1 round-trips before the response).                                                                                                                                                    |
| Type & module hygiene                         | `getEnv()` returns `Env` (was `any`); cms/pricing loggers now lazy request-scoped; knip config fully clean and enforced in CI.                                                                                                                                              |
| Decision records                              | ADR-0001 (fail-open limits), ADR-0002 (no CAPTCHA on booking), ADR-0003 (audit-first dead-letter) in `docs/adr/`; `db/README.md` documents the two migration trees; `Documentation/ARCO-DSR-RUNBOOK.md` operationalizes the 20-day DSR window.                              |

Deliberately NOT done, with reasons: `wrangler types` CI drift-check (generated
output differs across wrangler versions → pure noise); merging the migration
trees (they target different databases — documented instead); vitest coverage
gate (unsupported by the workers pool today); ESLint baseline, Playwright E2E,
RULES.md split, CSP nonces (each needs staged time, not blocked on anything).

---

## 5. Ratings — full multi-benchmark scorecard

Two columns throughout: **As-found** = state at commit `e2e4e09` (review baseline).
**Post-fix** = state at the head of this branch after remediation phases 0–4
(verified: 26/26 tests, `astro check` 0 errors, clean build).

Scale: 0–10. Method note: everything here is derived from static analysis of the
repository, the live Cloudflare account inventory, and the deployed email-consumer
code. Runtime metrics (Lighthouse, Core Web Vitals, real error rates) were NOT
measured — Sentry/PostHog dashboards were approval-gated in the review session —
and are explicitly excluded rather than guessed.

### 5.1 Primary scorecard (12 dimensions, weighted)

Weights: Security(code) ×2, Reliability ×2, Testing ×1.5, CI/CD ×1.5, all others ×1 (Σ = 15).

| #   | Dimension                       | Weight |     As-found     |     Post-fix     | Movement — why                                                                                                                            |
| --- | ------------------------------- | :----: | :--------------: | :--------------: | ----------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Security — code                 |  2.0   |       8.0        |     **8.8**      | +Rate limits on all 5 admin endpoints, ARCO pre-parse body cap, booking idempotency; − consumer-worker webhook still unaudited            |
| 2   | Security — docs & process       |  1.0   |       3.0        |     **7.5**      | SECURITY.md rewritten from code; README/AGENTS reconciled; mirror declared intentional; − doc-accuracy still not CI-enforced              |
| 3   | Reliability & error handling    |  2.0   |       7.0        |     **7.8**      | +Idempotent booking replay, pool cleanup; − server-Sentry delivery on Workers deploy still unverified (MED-13 residue)                    |
| 4   | Architecture & design           |  1.0   |       6.5        |     **7.3**      | +Dead subsystems removed, platform identity settled in docs; − `functions/_middleware.ts` fate undecided                                  |
| 5   | Code quality & maintainability  |  1.0   |       6.0        |     **7.0**      | +Dead listeners/CSS paths pruned, 2 latent type errors fixed, typecheck now enforced; − `getEnv(): any`, module-load side effects remain  |
| 6   | Performance & caching           |  1.0   |       6.5        |     **7.2**      | +Per-render D1 flag query gone, pools released; − 4 sequential audit writes, 10 font weights, external fonts remain                       |
| 7   | Testing                         |  1.5   |       1.5        |     **6.0**      | +26 real tests incl. D1 round-trip regression guard and i18n parity; − no endpoint-handler/E2E coverage, no coverage tracking             |
| 8   | CI/CD & DevOps                  |  1.5   |       2.5        |     **7.5**      | +Full check/build/test gate on PRs, blocking prod-dep audit; − no automated deploy or preview environments                                |
| 9   | Documentation accuracy          |  1.0   |       3.5        |     **7.8**      | +Every identified falsehood fixed, ToDo reconciled; − RULES.md (70 KB) not line-audited, doc sprawl remains                               |
| 10  | Privacy / GDPR-LFPDPPP          |  1.0   |       7.0        |     **7.6**      | +IP removed from analytics blobs, consent locale corrected; − attempt-table retention purge and Google-Fonts IP leak open                 |
| 11  | Frontend & SEO quality          |  1.0   |       7.5        |     **7.9**      | +touch-icon 404 gone, JSON-LD sinks consistent, scroll-restore revived; − fabricated aggregateRating, island i18n open                    |
| 12  | Infrastructure & config hygiene |  1.0   |       6.0        |     **7.2**      | +Stale artifacts deleted, Brevo aligned everywhere, audit highs cleared; − dual migration systems, knip unwired                           |
|     | **Weighted overall**            |        | **5.5 / 10 (C)** | **7.5 / 10 (B)** | Computed: Σ(score×weight)/15 — 82.0/15 and 112.95/15. _(Corrects the v1 headline figure of 6.4, which did not match its own arithmetic.)_ |

### 5.1.1 Re-score — second remediation wave (2026-07-05 PM)

The owner approved executing the §5.10 roadmap; every item achievable from the
repository was implemented the same day (see §4.2). Third snapshot:

| #   | Dimension                       |  As-found   |   Wave 1    |  **Wave 2**  | What moved it                                                                                                                                                   |
| --- | ------------------------------- | :---------: | :---------: | :----------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Security — code                 |   5.5→8.0   |     8.8     | **9.0 (A)**  | CSP: Google Fonts hosts dropped from style-src/font-src; doc claims now CI-enforced                                                                             |
| 2   | Security — docs & process       |     3.0     |     7.5     | **8.5 (A−)** | `test/doc-accuracy.test.ts` fails CI when SECURITY.md drifts from sync-contract.ts (and immediately caught 4 missing allowlist keys)                            |
| 3   | Reliability & error handling    |     7.0     |     7.8     | **8.4 (B+)** | `Sentry.wrapRequestHandler` in Astro middleware — server-side capture now structurally works on the Workers deploy (R1); non-terminal audit writes backgrounded |
| 4   | Architecture & design           |     6.5     |     7.3     | **7.9 (B)**  | 3 ADRs pin the load-bearing invariants; db/README.md ends the migration-tree confusion                                                                          |
| 5   | Code quality & maintainability  |     6.0     |     7.0     | **7.8 (B)**  | `getEnv()` typed against `Env`; lazy request-scoped loggers; live `dark:` inconsistencies removed; dead `mobileHintText` prop replaced by a real labels API     |
| 6   | Performance & caching           |     6.5     |     7.2     | **7.9 (B)**  | Self-hosted variable fonts: 95 KB / 2 files / first-party+preload replaces 10 remote files via 2 Google connections                                             |
| 7   | Testing                         |     1.5     |     6.0     | **7.5 (B)**  | 44 tests: direct handler tests exercise the real origin/Zod/auth pipeline in workerd; doc-accuracy suite; cms round-trip guard                                  |
| 8   | CI/CD & DevOps                  |     2.5     |     7.5     | **8.3 (B+)** | deploy.yml + retention-purge.yml (activate by adding CLOUDFLARE_API_TOKEN); knip blocking in CI                                                                 |
| 9   | Documentation accuracy          |     3.5     |     7.8     | **8.6 (A−)** | The drift-prone tables are now machine-checked; §8 allowlist corrected                                                                                          |
| 10  | Privacy / GDPR-LFPDPPP          |     7.0     |     7.6     | **8.5 (A−)** | 90-day retention purge implemented + scheduled (R3); Google-Fonts IP disclosure eliminated (R7); ARCO/DSR runbook written                                       |
| 11  | Frontend & SEO quality          |     7.5     |     7.9     | **8.4 (B+)** | aggregateRating now computed from on-page reviews or omitted (R5); lightbox/gallery aria + hints localized es/en; font swap                                     |
| 12  | Infrastructure & config hygiene |     6.0     |     7.2     | **7.8 (B)**  | retention SQL + workflows; knip enforced; migration trees documented (deliberately not merged — different databases)                                            |
|     | **Weighted overall**            | **5.5 (C)** | **7.5 (B)** | **8.3 (B+)** | Σ(score×weight)/15 = 123.9/15                                                                                                                                   |

**What still separates 8.3 from A− (8.5+):** items that need the owner or a
live environment — add the `CLOUDFLARE_API_TOKEN` repo secret (activates
deploys + purge), enable branch protection, verify one real Sentry event in
production, audit the consumer worker's Brevo webhook, Lighthouse/field data,
ESLint baseline, Playwright E2E, and the RULES.md split. All remain itemized
in §5.10 with the done items marked.

### 5.2 Sub-criteria detail (evidence-anchored)

**Security — code (8.0 → 8.8)**

| Sub-criterion                   | As-found | Post-fix | Evidence                                                            |
| ------------------------------- | :------: | :------: | ------------------------------------------------------------------- |
| Input validation coverage       |    9     |    9     | Zod on every body endpoint; size caps pre-parse                     |
| Injection resistance (SQLi/XSS) |    9     |   9.5    | Drizzle/bound params only; all JSON-LD sinks now `jsonLdSafe`       |
| AuthN/AuthZ of admin surface    |    6     |   8.5    | timingSafeEq per-endpoint secrets; now also rate-limited pre-auth   |
| Anti-automation / abuse         |    7     |    8     | Origin+limits+burst guard; Turnstile scoped by deliberate invariant |
| Upload handling                 |    7     |   8.5    | 6-layer validation; now with pre-parse 6 MB gate                    |
| Secrets management              |   8.5    |   8.5    | No live secrets committed; per-endpoint segregation                 |

**Reliability (7.0 → 7.8)**

| Sub-criterion                            | As-found | Post-fix | Evidence                                                       |
| ---------------------------------------- | :------: | :------: | -------------------------------------------------------------- |
| Data durability under dependency failure |    9     |    9     | D1 dead-letter audit-first design                              |
| Duplicate/replay safety                  |    3     |    8     | Was none; now KV idempotency with 24 h replay                  |
| Resource lifecycle                       |    4     |    8     | Pools were never closed; `closeDb()` at all 6 sites            |
| Failure observability                    |    6     |    6     | Sentry wiring intact but Workers-deploy delivery unverified    |
| Graceful degradation                     |    8     |    8     | Fail-open limits, queue retry + reconciler path, CMS fallbacks |

**Testing (1.5 → 6.0)**

| Sub-criterion                    | As-found | Post-fix | Evidence                                            |
| -------------------------------- | :------: | :------: | --------------------------------------------------- |
| Unit coverage of critical logic  |    1     |    7     | Schemas, security helpers, booking ref, i18n parity |
| Regression guards for known bugs |    0     |    8     | cms_content writer↔reader round-trip in workerd     |
| Integration/E2E                  |    1     |    2     | Still none against real endpoint handlers           |
| CI enforcement                   |    0     |    9     | `vitest run` gate on every PR                       |
| Test infrastructure health       |    3     |    7     | Watch-mode default removed; workerd pool works      |

_(Remaining dimensions move for the reasons in the 5.1 table; sub-tables omitted where the movement is a direct sum of the listed fixes.)_

### 5.3 Service-by-service infrastructure review

| Service                                 | Configured in        |       Verified live       |  Rating  | Notes                                                                                                                                      |
| --------------------------------------- | -------------------- | :-----------------------: | :------: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Cloudflare Worker `cf-astro`            | wrangler.toml        |     ✅ (workers_list)     | **8/10** | Healthy, 100% observability sampling; Pages-vs-Workers doc ambiguity now resolved to Workers                                               |
| D1 `madagascar-db`                      | binding `DB`         |       ✅ (1.99 MB)        | **8/10** | Dead-letter + CMS + flags; migrations tracked in `db/migrations`; retention purge for attempt tables still missing                         |
| KV `SESSION`                            | binding              |            ✅             | **8/10** | Astro sessions + (new) booking idempotency store                                                                                           |
| KV `ISR_CACHE`                          | binding              |            ✅             | **7/10** | Build-scoped HTML cache + KV rate-limit fallback; only caches the 4 on-demand pages by design of `output:'static'`                         |
| R2 `arco-documents`                     | binding `ARCO_DOCS`  |            ✅             | **9/10** | Private, UUID keys, magic-byte-validated uploads                                                                                           |
| R2 `madagascar-images`                  | binding `IMAGES`     |            ✅             | **8/10** | Shared with cf-admin; multi-tier resolution with fallbacks                                                                                 |
| Queue `madagascar-emails`               | producer binding     | ✅ (consumer worker live) | **9/10** | Retries + DLQ + reconciler design; decouples email from request path                                                                       |
| Analytics Engine `madagascar_analytics` | binding              |     ➖ code-verified      | **7/10** | $0 telemetry; IP now removed from blobs                                                                                                    |
| Workers AI                              | binding `AI`         |     ➖ code-verified      | **6/10** | Free-tier FAQ/blog drafts; always-remote binding complicates CI (handled by strip step); output not schema-validated                       |
| Supabase PostgreSQL                     | DATABASE_URL         |    ➖ code/migrations     | **8/10** | RLS on all 7 tables, least-privilege writer role, hardening migration; connection hygiene now fixed app-side                               |
| Upstash Redis                           | REST URL/token       |     ➖ code-verified      | **8/10** | Sliding-window primary with KV fallback; deliberate fail-open documented                                                                   |
| Brevo (via consumer)                    | consumer worker      |      ✅ (code read)       | **7/10** | Live provider confirmed; webhook signature verification not auditable from this repo                                                       |
| Sentry                                  | client + functions/  |     ➖ code-verified      | **5/10** | Client init solid; server capture depends on the Pages plugin layer whose execution on a Workers deploy is unconfirmed — top residual risk |
| PostHog                                 | consent-gated loader |     ➖ code-verified      | **8/10** | Exemplary consent gating, first-party proxy, input masking                                                                                 |
| BetterStack (Logtail)                   | source token         |     ➖ code-verified      | **7/10** | Structured request loggers; module-load token capture is a footgun (LOW-20f)                                                               |
| GitHub Actions                          | 3 workflows          |            ✅             | **7/10** | Was 2/10: no gate, advisory-only audit; now check/build/test gate + blocking audit; docs mirror intentional                                |

### 5.4 OWASP Top 10 (2021) assessment

| Category                            |      Status      | Assessment                                                                                                       |
| ----------------------------------- | :--------------: | ---------------------------------------------------------------------------------------------------------------- |
| A01 Broken Access Control           |     ✅ Pass      | Per-endpoint secrets, constant-time compare, now rate-limited; no user-auth surface to break                     |
| A02 Cryptographic Failures          |     ✅ Pass      | HSTS+preload, TLS-only, no custom crypto beyond HMAC/compare via Web Crypto                                      |
| A03 Injection                       |     ✅ Pass      | Zero raw-SQL interpolation; consistent output escaping (`jsonLdSafe` now universal)                              |
| A04 Insecure Design                 |     ⚠️ Watch     | Deliberate fail-open limits + no-CAPTCHA booking are documented business decisions; brute-force cap now in place |
| A05 Security Misconfiguration       |     ⚠️ Watch     | Strong `_headers`, but CSP retains `unsafe-inline`/`unsafe-eval`; COEP `unsafe-none`                             |
| A06 Vulnerable Components           | ✅ Pass (was ❌) | High-severity advisories cleared; audit now blocking at high for prod deps                                       |
| A07 Identification & AuthN Failures |     ✅ Pass      | No password auth surface; secrets are long random bearer values                                                  |
| A08 Software & Data Integrity       |     ⚠️ Watch     | No SRI (all first-party assets — low exposure); queue payloads internal-only                                     |
| A09 Logging & Monitoring Failures   |     ⚠️ Watch     | Rich logging designed in, but server-side Sentry delivery unverified on Workers deploy                           |
| A10 SSRF                            |     ✅ Pass      | Only outbound fetches are pinned hosts (PostHog proxy is path-allowlisted, traversal-guarded)                    |

**OWASP summary: 6 pass · 4 watch · 0 fail** (as-found: 5 pass · 4 watch · 1 fail).

### 5.5 ISO/IEC 25010 quality characteristics (scored)

| Characteristic                  | As-found | Post-fix | Basis                                                                         |
| ------------------------------- | :------: | :------: | ----------------------------------------------------------------------------- |
| Functional suitability          |   5.5    | **7.5**  | AI-CMS feature was broken end-to-end (CRIT-1); now fixed with regression test |
| Performance efficiency          |   6.5    | **7.2**  | Waste removed from render path; hot-path audit serialization remains          |
| Compatibility                   |   5.0    | **6.5**  | Platform identity settled in docs; `functions/` layer still ambiguous in code |
| Usability (incl. accessibility) |   7.0    | **7.2**  | Good a11y baseline; island aria-label i18n still pending                      |
| Reliability                     |   7.0    | **7.8**  | See 5.2                                                                       |
| Security                        |   6.5    | **8.2**  | Code was strong; process/docs were the drag and are now aligned               |
| Maintainability                 |   5.5    | **7.0**  | Enforced typecheck + tests + dead-code removal; doc sprawl remains            |
| Portability                     |   5.0    | **6.0**  | Wrangler-native; CI proves builds reproduce outside the owner's machine       |

### 5.6 Twelve-Factor alignment

| Factor              | Verdict | Note                                                                                 |
| ------------------- | :-----: | ------------------------------------------------------------------------------------ |
| I Codebase          |   ✅    | Single repo, tracked deploys                                                         |
| II Dependencies     |   ✅    | Lockfile committed; audit now blocking                                               |
| III Config          |   ✅    | Bindings + secrets outside code; `.env.example` documents every var                  |
| IV Backing services |   ✅    | All attached as swappable bindings/URLs                                              |
| V Build/release/run |   ⚠️    | Build gate now exists; release step is still a manual `cf:deploy`                    |
| VI Processes        |   ✅    | Stateless Workers; state in D1/KV/Postgres                                           |
| VII Port binding    |   ✅    | Platform-managed                                                                     |
| VIII Concurrency    |   ✅    | Isolate model; pool caps respected (and now released)                                |
| IX Disposability    |   ✅    | Fast cold-start; queue decoupling                                                    |
| X Dev/prod parity   |   ⚠️    | Miniflare dev vs prod bindings; vitest miniflare config still hand-duplicated        |
| XI Logs             |   ✅    | Structured request loggers + CF observability at 100% sampling                       |
| XII Admin processes |   ⚠️    | Migrations manual (`db:migrate:remote`); no scripted Postgres migration path from CI |

### 5.7 Accessibility (WCAG 2.2 areas — static review, not audited with AT)

| Area                       |  Rating  | Evidence                                                                                 |
| -------------------------- | :------: | ---------------------------------------------------------------------------------------- |
| Structure & landmarks      | **8/10** | Skip link, banner/navigation roles, labelled sections                                    |
| Keyboard & focus           | **8/10** | Native `<dialog>` lightbox with full keyboard nav; focus-visible styles                  |
| Forms                      | **7/10** | Wizard has explicit error states + aria; recent a11y commit (851c59e) addressed SR hints |
| Motion sensitivity         | **6/10** | `prefers-reduced-motion` blocks exist; 60 s marquee drag-resume path unverified          |
| Language parity of AT text | **5/10** | Hardcoded English aria-labels in islands for Spanish users (LOW-18, open)                |
| Contrast                   | **7/10** | Forced-light palette consistent; not instrument-measured                                 |

### 5.8 SEO sub-ratings

| Aspect                                        |  Rating  | Evidence                                                                                              |
| --------------------------------------------- | :------: | ----------------------------------------------------------------------------------------------------- |
| Crawl architecture (sitemaps/hreflang/robots) | **9/10** | Per-language sitemaps with in-URL hreflang + x-default; AI-crawler-aware robots                       |
| Canonicalization                              | **8/10** | Trailing-slash policy + host 301s + GSC-driven fixes (e2e4e09 lineage)                                |
| Structured data                               | **6/10** | Rich and now consistently escaped, but hardcoded `4.7/231` aggregateRating is a policy risk (open)    |
| Meta/OG hygiene                               | **8/10** | Was 7: og:image:type and touch-icon bugs fixed                                                        |
| Performance signals                           | **7/10** | Preloaded LCP hero, lazy islands; external fonts are the main drag (static assessment; no field data) |

### 5.9 Residual risk register (post-fix, ranked)

| #   | Risk                                                                |         Likelihood          |           Impact            | Mitigation path                                                                                       |
| --- | ------------------------------------------------------------------- | :-------------------------: | :-------------------------: | ----------------------------------------------------------------------------------------------------- |
| R1  | Server-side Sentry silently not delivering on Workers deploy        |           Medium            | High (blind to prod errors) | Verify an event end-to-end; decide `functions/` layer fate; init Sentry in the Worker entry if needed |
| R2  | Consumer-worker Brevo webhook signature unverified                  |           Medium            |           Medium            | Audit `cf-astro-email-consumer` repo                                                                  |
| R3  | Attempt-table PII (IP/UA) retained indefinitely in D1               | High (certain accumulation) |     Medium (compliance)     | Retention purge cron on cf-admin                                                                      |
| R4  | CSP `unsafe-inline`/`unsafe-eval` narrows XSS containment           |             Low             |           Medium            | Staged nonce/hash rollout (already in ToDo)                                                           |
| R5  | Fabricated aggregateRating triggers a structured-data manual action |             Low             |           Medium            | Drive from real review data or remove                                                                 |
| R6  | Dual migration systems drift (db/ vs drizzle/)                      |           Medium            |           Medium            | Declare one source of truth in README                                                                 |
| R7  | Google Fonts IP leak inconsistent with privacy posture              |  Certain (by design today)  |             Low             | Self-host subset fonts                                                                                |

### 5.10 Roadmap to A-grade — how each dimension gets to A+/A/A− (or B+ minimum)

Grade bands used throughout: **A+ ≥ 9.5 · A 9.0–9.4 · A− 8.5–8.9 · B+ 8.0–8.4 · B 7.0–7.9 · C 5.0–6.9 · D 3.0–4.9 · F < 3.0**

Legend: 🔧 = code change in this repo · 🖥️ = owner action (dashboard/other repo/legal) · ⏱ = rough effort.

#### 1. Security — code: 8.8 (A−) → target A/A+ (9.2–9.6)

| Action                                                                                                                                                                    | Points |    ⏱    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :-----: |
| 🖥️ Audit `cf-astro-email-consumer`'s Brevo webhook: confirm signature verification with `timingSafeEq` + replay window (closes R2)                                        |  +0.2  |  1–2 h  |
| 🔧 CSP: replace `unsafe-inline`/`unsafe-eval` in `script-src` with nonces/hashes; verify PostHog compat in staging (closes R4; already a ToDo item)                       |  +0.3  | 0.5–1 d |
| 🖥️ Put Cloudflare Access (or IP allowlist via WAF rule) in front of `/api/arco/get-document/` — second factor beyond the header secret for the identity-document endpoint |  +0.2  |   1 h   |
| 🖥️ Enable Supabase leaked-password protection + schedule annual secret rotation for the 4 admin secrets (calendar entry is enough)                                        |  +0.1  |  30 m   |
| **A+ extra:** third-party penetration test or at least an automated DAST pass (OWASP ZAP baseline scan in CI against a preview URL).                                      |

#### 2. Security — docs & process: 7.5 (B) → target A− (8.5+)

| Action                                                                                                                                                                                                                                                                                   | Points |     ⏱     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :-------: |
| 🔧 Make doc-accuracy machine-checked: a small vitest that imports `RATE_LIMIT_MAX`/`CMS_KEY_ALLOWLIST` from `sync-contract.ts` and asserts the SECURITY.md §4 table contains the same numbers (parse the markdown). Docs can then never silently drift again — the CI gate fails instead |  +0.5  |   2–3 h   |
| 🔧 Generate the secret-inventory table (§7/§13) from a single JSON source rendered into both SECURITY.md and `.env.example` comments                                                                                                                                                     |  +0.3  |    2 h    |
| 🖥️ Quarterly 30-minute doc-vs-code review on the calendar; record date in SECURITY.md header (this review models the format)                                                                                                                                                             |  +0.2  | recurring |

#### 3. Reliability & error handling: 7.8 (B) → target A− (8.5+)

| Action                                                                                                                                                                                                                                                                                                                             | Points |   ⏱   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :---: |
| 🔧🖥️ **Verify server-side Sentry end-to-end** (top residual risk R1): trigger a deliberate error on a low-traffic admin endpoint in production and confirm the event arrives. If it doesn't: init `@sentry/cloudflare` in the Worker entry (the `functions/` Pages layer never runs on a Workers deploy) and delete the dead layer |  +0.4  | 2–4 h |
| 🖥️ Uptime monitoring: BetterStack heartbeat hitting `/api/health/` with the bearer secret every 5 min + alert channel                                                                                                                                                                                                              |  +0.2  | 30 m  |
| 🖥️ DLQ alerting: notification when `madagascar-emails-dlq` receives a message (queue metrics → email/webhook)                                                                                                                                                                                                                      |  +0.1  | 30 m  |
| 🔧 `waitUntil` the non-terminal D1 audit writes in booking (keep audit-first for the initial PENDING row)                                                                                                                                                                                                                          |  +0.1  |  1 h  |
| **A extra:** synthetic booking canary — a cron that runs a full booking against a staging path and alerts on failure.                                                                                                                                                                                                              |

#### 4. Architecture & design: 7.3 (B) → target B+/A− (8.0–8.5)

| Action                                                                                                                                                                                                                         | Points |   ⏱   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :---: |
| 🔧 Resolve the `functions/` layer after the Sentry verification above: either it runs (Pages) and docs change back, or it doesn't (Workers) and the file is deleted with its llms.txt/URI logic moved into `src/middleware.ts` |  +0.4  |  2 h  |
| 🔧 Collapse to ONE migration system: declare `db/migrations/` (D1) + `drizzle/` (Postgres) explicitly in a `db/README.md` — they serve different databases, so the fix is documentation + naming, not deletion                 |  +0.2  |  1 h  |
| 🔧 Extract `booking.ts` (460+ lines) into `src/lib/booking-service.ts` steps (audit / validate / persist / dispatch) — testability improves with it                                                                            |  +0.3  | 0.5 d |
| 🔧 Write 3 one-page ADRs for the load-bearing invariants (fail-open limits, no-CAPTCHA booking, audit-first) so the reasoning survives tool/AI churn                                                                           |  +0.1  |  2 h  |

#### 5. Code quality & maintainability: 7.0 (B) → target B+/A− (8.0–8.5)

| Action                                                                                                               | Points |   ⏱   |
| -------------------------------------------------------------------------------------------------------------------- | :----: | :---: |
| 🔧 Type `getEnv()` against the generated `Env` from `worker-configuration.d.ts` (kill the `any`) and fix the fallout |  +0.4  | 0.5 d |
| 🔧 Add ESLint (`eslint-plugin-astro` + typescript-eslint) + Prettier check to CI                                     |  +0.3  | 2–3 h |
| 🔧 Remove module-scope `getEnv()`/logger captures in `cms.ts`/`pricing.ts` (move into request scope)                 |  +0.2  |  1 h  |
| 🔧 Strip unreachable `dark:` variants + dark tokens (or re-enable dark mode deliberately)                            |  +0.1  |  2 h  |

#### 6. Performance & caching: 7.2 (B) → target B+/A− (8.0–8.5)

| Action                                                                                                                                           | Points |   ⏱   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :---: |
| 🔧 Self-host fonts: subset DM Sans + Outfit to ≤4 weights total, `@font-face` with `font-display: swap` (also closes privacy risk R7)            |  +0.4  | 3–4 h |
| 🔧 Lighthouse CI in Actions against a preview deploy with budget assertions — converts this whole dimension from static guesses to measured fact |  +0.3  |  3 h  |
| 🔧 `waitUntil` non-terminal audit writes (shared with dim 3)                                                                                     |  +0.1  |   —   |
| 🖥️ Enable Smart Placement on the worker (D1/Supabase calls dominate; placement near ENAM helps)                                                  |  +0.1  | 15 m  |

#### 7. Testing: 6.0 (C) → target B+ (8.0), then A− (8.5+)

| Action                                                                                                                                                                                                             | Points |   ⏱   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :---: |
| 🔧 Endpoint-handler tests via the workerd pool's `SELF` fetch: booking/contact/consent 403 (bad origin), 400 (Zod), 413 (oversize), health/get-document 401 — none of these paths need Postgres, so they run today |  +0.8  |  1 d  |
| 🔧 Coverage reporting (`vitest --coverage`) with a ratcheting threshold (start 50%, raise 5 pts per month to 75%) enforced in CI                                                                                   |  +0.5  |  2 h  |
| 🔧 Playwright E2E: boot `wrangler dev --local` in CI (proven to work — this review's smoke test did exactly that) and drive the booking wizard to the validation step; assert consent banner gating of PostHog     |  +0.7  | 1–2 d |
| **A territory** additionally needs: a mocked-Postgres (or staging-DB) happy-path booking test and queue-consumer contract tests in the consumer repo.                                                              |

#### 8. CI/CD & DevOps: 7.5 (B) → target A− (8.5+)

| Action                                                                                                                                                                                                      | Points |   ⏱   |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :---: |
| 🔧🖥️ Deploy pipeline: `wrangler deploy` from Actions on main (needs `CLOUDFLARE_API_TOKEN` repo secret) — removes the manual `cf:deploy` from a laptop; keep `[ai]` intact there since the token is present |  +0.5  | 2–3 h |
| 🔧🖥️ Per-PR preview deploys (`wrangler versions upload` → preview URL posted to the PR); the Origin allowlist already accepts `*.mascotasmadagascar.workers.dev`                                            |  +0.3  |  3 h  |
| 🖥️ Branch protection on `main`: require the CI check, forbid force-push (Settings → Branches — cannot be done from this session)                                                                            |  +0.2  | 10 m  |
| 🔧 Add Lighthouse CI + coverage gates (shared with dims 6–7)                                                                                                                                                |   —    |   —   |
| **A+ extra:** staged rollout with `wrangler versions` gradual deployment + automatic rollback on error-rate spike.                                                                                          |

#### 9. Documentation accuracy: 7.8 (B) → target A− (8.5+)

| Action                                                                                                                                                                    | Points |   ⏱   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----: | :---: |
| 🔧 The machine-checked doc test from dim 2 (biggest single lever — accuracy becomes enforced, not aspirational)                                                           |  +0.4  |   —   |
| 🔧 Prune RULES.md (70 KB): split into `RULES.md` (current, <15 KB) + `Documentation/ARCHIVE-RULES-HISTORY.md`; fix any claims contradicted by code found during the split |  +0.3  | 0.5 d |
| 🔧 One `Documentation/README.md` index with a freshness date per doc; delete or merge the 3 overlapping status docs (20/21/22 series overlap)                             |  +0.2  |  2 h  |

#### 10. Privacy / GDPR-LFPDPPP: 7.6 (B) → target A− (8.5+)

| Action                                                                                                                                                                                                                                                                   | Points |     ⏱     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :-------: |
| 🔧🖥️ D1 retention purge (closes R3): scheduled job on cf-admin — `DELETE FROM booking_attempts/consent_attempts WHERE created_at < date('now','-90 days')` (keep consent_records in Postgres forever — legal evidence); document the 90-day window in the privacy notice |  +0.4  |    3 h    |
| 🔧 Self-hosted fonts (closes R7, shared with dim 6)                                                                                                                                                                                                                      |  +0.2  |     —     |
| 🖥️ DSR (ARCO) runbook: a one-pager for who does what within the 20-business-day window when a request arrives                                                                                                                                                            |  +0.2  |    2 h    |
| 🖥️ Annual LFPDPPP notice review date with counsel (ToDo already tracks the clause revision)                                                                                                                                                                              |  +0.1  | recurring |

#### 11. Frontend & SEO quality: 7.9 (B) → target A− (8.5+)

| Action                                                                                                                                                                         | Points |     ⏱     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :----: | :-------: |
| 🔧 aggregateRating (closes R5): render from real review data via CMS (`happy_clients` block already exists) with a real count, or remove the block — never a hardcoded 4.7/231 |  +0.3  |    2 h    |
| 🔧 Localize island a11y text: pass aria-labels/hints from the i18n dicts as props into `InfiniteGallery`/`ImageLightbox`; render or delete `mobileHintText`                    |  +0.2  |   2–3 h   |
| 🔧 Measured Core Web Vitals via Lighthouse CI (shared with dim 6) + fix what it finds                                                                                          |  +0.2  |     —     |
| 🖥️ GSC monitoring cadence for the canonical/redirect fixes already shipped                                                                                                     |  +0.1  | recurring |

#### 12. Infrastructure & config hygiene: 7.2 (B) → target B+/A− (8.0–8.5)

| Action                                                                                                                                   | Points |  ⏱  |
| ---------------------------------------------------------------------------------------------------------------------------------------- | :----: | :-: |
| 🔧 `wrangler types` regeneration check in CI (fail if `worker-configuration.d.ts` is stale vs wrangler.toml)                             |  +0.3  | 1 h |
| 🔧 knip in CI as a non-blocking report first, blocking once clean for a month (config is now clean — this review fixed the last 3 hints) |  +0.2  | 1 h |
| 🔧 db/README.md declaring the two migration systems' scopes (shared with dim 4)                                                          |  +0.2  |  —  |
| 🔧 Single generated env-var inventory (shared with dim 2)                                                                                |  +0.2  |  —  |

#### Sequencing — three sprints to a straight-A board

- **Sprint 1:** ✅ Sentry Workers-path wiring (live verification still owner) · ✅ endpoint-handler tests (coverage gate blocked: vitest-pool-workers doesn't support coverage yet) · ✅ deploy pipeline (🖥️ needs CLOUDFLARE_API_TOKEN secret; branch protection is dashboard-only) · ✅ doc-accuracy test.
- **Sprint 2:** ✅ D1 retention purge (workflow + SQL; activates with the same secret) · ✅ self-hosted fonts (+ CSP font hosts removed) · ⏳ CSP nonces (needs staged prod testing) · 🖥️ consumer webhook audit (other repo) · ⏳ Lighthouse CI.
- **Sprint 3:** ⏳ ESLint baseline · ✅ typed getEnv · ⏳ booking-service extraction · ⏳ RULES.md split · ✅ aggregateRating + island i18n · ⏳ Playwright E2E.

**Result: weighted 8.3/10 (B+) — see §5.1.1.** Executed 2026-07-05, same day as the review.

**Projected board after all three sprints: weighted ≈ 8.6/10 (A−), no dimension below B+ (8.0).** The only items capping A+ are external-verification ones (pen test, real-user Web Vitals history, staged rollouts) that simply take calendar time.

### 5.11 The one-paragraph verdict (updated post-remediation)

As found, this was **good code with no safety net and a documentation layer that
lied about it** — a transparent weighted 5.5/10 where the request-path
engineering scored A− and everything meta scored D. After phases 0–4 on this
branch, the computed score is **7.5/10 (B)**: the four cheap-and-dangerous
problems (broken cms_content writes, false security docs, missing CI gate,
zero tests) are gone, and what remains is a short, known list — verify server
Sentry delivery, audit the consumer webhook, add the D1 retention purge,
tighten CSP, and finish the frontend polish items. None of the remaining items
is silent: each is named in §5.9 with an owner-actionable path.

---

## 6. Full verification battery — run log (2026-07-05, main @ 8918a89 + this commit)

Every runnable check for this project was executed. Results:

| #   | Check                                   | Command                                                     | Result                                                                                                      |
| --- | --------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1   | Unit + integration tests (workerd pool) | `npm test` (`vitest run`)                                   | ✅ 26/26 passed, 5 files                                                                                    |
| 2   | Typecheck                               | `astro check`                                               | ✅ 0 errors, 0 warnings (129 files; 35 hints)                                                               |
| 3   | Production build                        | `astro build`                                               | ✅ complete (~26 s)                                                                                         |
| 4   | Prod-dependency audit                   | `npm audit --omit=dev --audit-level=high`                   | ✅ pass — no high/critical                                                                                  |
| 5   | Full-tree audit (informational)         | `npm audit`                                                 | ⚠️ 6 low/moderate, all in the esbuild→astro chain; fix requires Astro major                                 |
| 6   | Dead code / dependency scan             | `npm run knip`                                              | ✅ clean (3 stale config hints found & fixed in this commit)                                                |
| 7   | D1 migration validity                   | `wrangler d1 migrations apply --local`                      | ✅ all 8 migrations apply cleanly                                                                           |
| 8   | Deploy config + bundle validation       | `wrangler deploy --dry-run`                                 | ✅ bundles; every binding + var resolves                                                                    |
| 9   | Runtime smoke — pages                   | `wrangler dev --local` + curl                               | ✅ `/` → 301 `/es/` · `/es/`, `/en/` → 200 · robots/sitemap → 200                                           |
| 10  | Runtime smoke — ISR cache               | second hit on `/es/`                                        | ✅ `X-ISR-Cache: HIT`, correct `CDN-Cache-Control`                                                          |
| 11  | Runtime smoke — CSRF fail-closed        | POST `/api/booking/` without/with evil Origin               | ✅ 403 both (production-build behavior)                                                                     |
| 12  | Runtime smoke — admin auth              | GET `/api/arco/get-document/` without secret                | ✅ 401                                                                                                      |
| 13  | Runtime smoke — secret hygiene          | GET `/api/health/` in secretless env                        | ✅ 500 "Secret not configured" (correct fail-closed message, no leak)                                       |
| 14  | CI on GitHub runners                    | `ci.yml` run #1 on main                                     | ✅ success (88 s: check + build + tests)                                                                    |
| 15  | Security workflow                       | `security.yml` on main                                      | ✅ success (audit now blocking)                                                                             |
| 16  | Docs mirror                             | `sync-docs.yml` on main                                     | ✅ success — Documentation/ incl. this report published to the mirror                                       |
| 17  | Wave-2 test suite                       | `vitest run` after roadmap execution                        | ✅ 44/44 (7 files) — incl. handler-level and doc-accuracy suites                                            |
| 18  | Wave-2 typecheck/build                  | `astro check` + `astro build`                               | ✅ 0 errors; build clean; `dist/client/fonts/` contains both woff2; 0 `fonts.googleapis` refs in built HTML |
| 19  | Retention purge SQL                     | `wrangler d1 execute --local --file db/retention-purge.sql` | ✅ executes cleanly                                                                                         |

Not runnable from this environment (documented, not skipped silently): live Sentry
event verification (needs production traffic + dashboard), Lighthouse/Web-Vitals
field data (needs deployed URL access), Supabase advisor scan (connector
approval-gated), and consumer-worker webhook audit (separate repo).

---

_Review artifacts: findings verified at commit `e2e4e09` (2026-07-04); remediation
and re-scores verified 2026-07-05 (merged to `main`) — 26/26 tests, `astro check` 0 errors, clean `astro build`. Cloudflare
inventory and the email-consumer provider verified live via MCP; Supabase/Sentry/
PostHog assessed from code only (connector approval unavailable in the session).
Line numbers reference the commit noted per finding._

{% endraw %}
