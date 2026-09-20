---

title: "Permissions System — RBAC, PLAC and ACM End to End"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-20
verified_against: [code, infra]
owner: harshil
related_docs: [plac-and-audit.md, ARCHITECTURE.md, ../features/USER-MANAGEMENT.md, ../features/SESSION-MANAGEMENT.md, ../security/SECURITY.md, ../reference/RBAC-AT-SCALE.md]
related_code: [src/lib/auth/rbac.ts, src/lib/auth/plac.ts, src/lib/auth/pipeline.ts, src/lib/auth/stages/, src/lib/auth/decide-access.ts, src/lib/auth/session.ts, src/lib/auth/guard.ts, src/lib/auth/routes.ts]
tags: [architecture, security, rbac, plac, authorization, performance]
---

# Permissions System — RBAC, PLAC and ACM End to End

> **TL;DR (non-technical):** Every screen in this admin portal is locked. Who can
> open which screen is decided in two steps: your job title gives you a baseline,
> and an administrator can then open or close individual screens for you
> personally. The decision is worked out once when you sign in, stored next to your
> session, and then re-checked on every single click without touching a database.
> A closed door always beats an open one — except for the two top tiers, the
> account holder and our own support tier, who are let through everywhere by
> design.

This document is the **authority** for the permission model. Where another
document restates any of it, this one wins; where this one disagrees with the
code, the code wins and this document is the bug.

It is written to be read cold, by someone comparing this design against Auth0,
Keycloak, Zanzibar/OpenFGA/SpiceDB, Cerbos, Casbin or a hand-rolled RBAC. Every
number is either **measured** — with its source, sample size and date — or
explicitly labelled as arithmetic. Nothing here is estimated and presented as
observed.

---

## 1. The model in one paragraph

Three layers stack, and they are frequently confused because two of them are
per-page:

| Layer | Name | What it answers | Where it lives |
|---|---|---|---|
| **ACM** | Access Control Map — the page registry | *What pages exist, and what is each one's default minimum rank?* | D1 `admin_pages` |
| **RBAC** | Role-based baseline | *What rank is this person?* | Supabase `admin_authorized_users.role` |
| **PLAC** | Page-Level Access Control | *Has an administrator overridden this person's access to this specific page?* | D1 `admin_page_overrides` |

The three are resolved together, once, into a flat `Record<string, boolean>` — the
**access map** — which is embedded in the session record in KV. Every subsequent
request reads KV and does one hash lookup. There is no policy engine, no policy
language, and no per-request database call on the happy path. *Corrected
2026-09-19: the warm path is **four** KV reads, not one — see §13.1.*

**Resolution order, exactly** (`src/lib/auth/decide-access.ts`):

0. `vendor_support` and `owner` resolve to allow before the map is consulted at
   all (ADR-0002: a self-inflicted lockout of the customer's top tier is the
   worse failure). A deny row written against either tier is stored, shown in
   the access UI, and has no effect.
1. Explicit deny → 2. explicit grant → 3. role baseline.

Steps 1–3 are what `computeAccessMap` folds into the map; step 0 is applied at
read time, on every check. §6.2 states the two predicates in full.

---

## 2. Threat model — what this actually defends

Stating this first, because a permission system can only be judged against what it
is meant to stop.

| # | Threat | Defence |
|---|---|---|
| T1 | An unauthenticated stranger reaches any admin surface | Cloudflare Access sits in front of the entire origin; `workers_dev = false` in `wrangler.toml` means the Access-protected custom domain is the only ingress. *Corrected 2026-09-19: two prefixes are deliberately off Access — `/api/storage/share/` and `/api/storage/request/` are reached anonymously through Access path-based bypass policies and are authorized by an HMAC-signed token instead (`src/lib/auth/routes.ts`, `wrangler.toml`).* |
| T2 | A valid staff member reads a page above their rank | RBAC baseline computed from the page registry |
| T3 | A valid staff member with a page grant escalates to *other* pages | Grants are per-path and capped at the granting actor's own clearance |
| T4 | An administrator elevates themselves | Self-modification is refused outright; grants are capped at the actor's ceiling |
| T5 | A lower tier edits a higher tier's account | Rank supremacy — strictly higher privilege required, on the paths that route through `canManageUser`. **Partial**: see §16 D6/D7. |
| T6 | A revoked user keeps working from a live session | Three-layer revocation, including a Cloudflare API call that kills the edge cookie |
| T7 | A read-only user mutates through the API | Viewer tier refused on every non-idempotent method, before page resolution |
| T8 | An API route ships without a guard | Default-deny in the pipeline plus a CI inventory test |
| T9 | Session theft via XSS | `__Host-` cookie prefix, `HttpOnly`, strict CSP with nonces |
| T10 | Cross-site request forgery | Custom CSRF validation in `src/lib/csrf.ts` |

**What it explicitly does not defend.** It cannot express object-level permissions
("user X may edit document Y"). It has no relationship graph, no inheritance beyond
path prefixes, and no delegation. See §15.

---

## 3. Topology — which store owns which fact

```mermaid
flowchart TD
    U["Browser"] -->|"CF_Authorization JWT"| CFA["Cloudflare Access<br/>identity provider"]
    CFA --> W["Worker — Astro SSR<br/>secure.madagascarhotelags.com"]
    W -->|"JWKS certs — module-scope cached, ~1.7% of requests"| CFA

    W ==>|"WARM PATH — 4 reads, ~97.6% of requests"| KV[("Workers KV<br/>session record + access map")]
    W -->|"cold login only — avg 244 ms"| SB[("Supabase Postgres<br/>admin_authorized_users")]
    W -->|"map re-compute only — 0.65 ms"| D1[("D1<br/>admin_pages + admin_page_overrides")]
    W -.->|"audit, after response via waitUntil"| D1

    W --- SCHED["Scheduled handler<br/>same Worker, every 5 min"]
    SCHED -->|"group membership reconcile"| CFAPI["Cloudflare Access API"]
```

The thick edge is the only one on the hot path. Everything else runs on a cold
login, on a re-compute, or after the response has already been sent.

| Fact | Owner | Read on the hot path? |
|---|---|---|
| Is this a real, active human? | Cloudflare Access (IdP) | Yes — JWT signature |
| Is this email allowed in at all, and at what rank? | Supabase `admin_authorized_users` | **No** — cold login, the 30-minute re-check, and any request carrying a new `authz-changed` mark |
| What pages exist and their default rank | D1 `admin_pages` | No — cached |
| Per-user overrides | D1 `admin_page_overrides` | No — folded into the map |
| The resolved decision | KV, inside the session record | **Yes — the hot-path read**, alongside the three revocation/authz flags read with it (§13.1) |
| Group membership mirror | Cloudflare Access groups | No — reconciled by cron |

The split is the whole design: **identity is centralised, the decision is
edge-local.**

---

## 4. RBAC — the role ladder

Six tiers. Lower number means higher privilege (`src/lib/auth/rbac.ts`).

| Level | Canonical role | Stored value today | Assignable? | Summary |
|---:|---|---|---|---|
| 0 | `vendor_support` | `dev` | No | Supplier support tier. Visible in the registry by design, never in a role picker. |
| 1 | `owner` | `owner` | Yes | Account holder. Full authority. |
| 2 | `admin` | `super_admin` | Yes | Full operational control including settings and users. |
| 3 | `manager` | `admin` | Yes | Day-to-day operations. No user or platform administration. |
| 4 | `staff` | `staff` | Yes | Own area only. |
| 5 | `viewer` | *(none)* | Not yet | Read-only. Refused on every mutation. |

### 4.1 The vocabulary split, and why it exists

The code speaks canonical names; both databases still hold the old ones.
`normalizeRole()` translates on read, `toStoredRole()` on write, and
`ROLE_VOCABULARY` is the single switch that flips after the data migration.

This is not laziness — **the rename collides**. `super_admin` becomes `admin`, and
`admin` becomes `manager`. The string `"admin"` therefore means level 3 before the
migration and level 2 after it, and no amount of looking at a bare row tells you
which. Translating in code behind an explicit flag means the deployed Worker and
the database can never disagree about what a role means. Verified live on
2026-08-23: every `required_role` in D1 `admin_pages` still holds a legacy value,
and the table's CHECK constraint still admits only
`('dev','owner','super_admin','admin','staff')`. *Corrected 2026-09-19: `manager`
**does** persist — as the stored value `admin` — so `viewer` is the one canonical
role with no legacy equivalent and therefore the only one that cannot be written
(`src/lib/auth/rbac.ts`, matching the §4 table above).* `toStoredRole()` **throws**
rather than silently writing a different role. Tracked as C-11 in
[`../MAINTENANCE.md`](../MAINTENANCE.md).

`canManageUser(actor, target)` requires *strictly* higher privilege, so nobody can
act on a peer through it. An untranslatable stored role returns `false` — there is
no safe level at which to compare it. Two account actions do **not** route through
it and check only that the target is not an owner or vendor account; see §16
D6/D7.

### 4.2 Deprecated aliases are load-bearing

`isAdmin` is an alias for `isManagerOrAbove` (level 3) and `isSuperAdmin` for
`isAdminOrAbove` (level 2). The names moved; the levels deliberately did not.
Renaming the helpers without preserving their level would have silently shifted a
privilege boundary at ~200 call sites — invisible in review. (That figure is from
the rename in July 2026 and is history, not a current count; the ratchet counter
for deprecated-alias uses, `E1` in `.ratchet.json`, stands at 70 today.)

---

## 5. ACM — the page registry

D1 `admin_pages`, primary key `path`:

| Column | Purpose |
|---|---|
| `path` | A dashboard route, or a hash-fragment sub-page such as `/dashboard/sessions#revoke` |
| `required_role` | Default minimum rank (legacy vocabulary, see §4.1) |
| `is_active` | `0` removes the page from nav **and from the access map** |
| `parent_path` | Groups sub-features under their page |
| `sort_order`, `category`, `label`, `icon` | Presentation |

**Measured live, 2026-09-16:** 97 rows, **86 active**, **51** of them hash-fragment
sub-pages (49 active). The rise since 2026-08-24 (92/81/47/45) is mostly the cron
control plane, which added `/dashboard/cron` plus `#pause`, `#trigger` and
`#configure` in `migrations/0054`–`0055`.

Hash fragments are the fine-grained layer. `/dashboard/sessions` is the page;
`#revoke`, `#unblock`, `#flush`, `#export` are separately grantable actions within
it. This is how a coarse per-page model reaches action-level granularity without a
policy language.

**A fragment key is not a descendant of its page, and a handler must check both.**
`resolveAccess` matches ancestors with `startsWith(key + '/')`; `#revoke` supplies
no `/`, so `/dashboard/sessions#revoke` inherits nothing from `/dashboard/sessions`.
Check only the page and a deny written on the fragment is ignored — the override is
stored, shown in the access UI, and has no effect at the one point that matters.
Check only the fragment and a user denied the whole page still reaches the action,
because an undefined key resolves `unknown` and `requirePageAccess` permits unknown.
`src/lib/auth/surface-guards.ts` exists to make that pair the default: `denyCron` and
`denySessions` take the page key first, then the action. This was got wrong twice
before it was centralised — see MAINTENANCE.md D-4 and D-5.

**An action key fails CLOSED; a page key does not.** *Added 2026-09-20.* The two
guards in that module differ deliberately. `denySessions` refuses only an explicit
deny, which is `requirePageAccess`'s behaviour and is right for a page: a route
whose page key was never registered must keep working on its own role check.
`denyCron` goes through `placRequireGrant` (`guard.ts`) instead, which requires an
explicit **allow** — because an action key exists only where somebody wrote a
registry row for it, so `unknown` does not mean "no policy applies", it means the
row is missing or `is_active = 0`. Migration `0054` shipped exactly that state:
its three cron fragments were inserted with a NULL `icon` against a NOT NULL
column, `INSERT OR IGNORE` discarded all three silently, and every cron action
check was a no-op for every role until `0055`. Under an explicit-allow check that
same state refuses the action instead of opening it. The rows are asserted in
`test/migrations-replay.test.ts`, so losing one is a failing build. The sessions
fragments are live and active (verified 2026-09-20) and could adopt the same
helper, but `#flush` is deliberately deny-only — it keeps a hardcoded owner check
alongside the PLAC one, so a grant alone must not become a capability — and
`#export` has no server route, so that switch is its own change.

**Only depth-2 paths render as sidebar items** (`computeNavItems`); anything deeper
is reachable but not navigable. That rule is why promoting the sessions screen to a
top-level page required a migration rather than a re-link
(`migrations/0002_promote_sessions_page.sql`).

`is_active = 0` is a soft delete that keeps foreign keys and audit history intact.
It has a consequence worth knowing: the access map is built `WHERE is_active = 1`, so
a deactivated key is **absent** from it rather than denied, and a guard naming one
falls through to longest-prefix matching against its parent. The gate still fails
closed, but it is no longer the gate the code appears to name. That is what happened
to the sessions telemetry endpoint after `migrations/0002_promote_sessions_page.sql`
(MAINTENANCE.md D-3, fixed 2026-09-16).

---

## 6. PLAC — per-user overrides

D1 `admin_page_overrides`:

```sql
user_id TEXT NOT NULL,            -- Supabase admin_authorized_users.id
page_path TEXT NOT NULL,
granted INTEGER NOT NULL CHECK (granted IN (0, 1)),
granted_by TEXT NOT NULL,
granted_by_email TEXT NOT NULL,
reason TEXT,
PRIMARY KEY (user_id, page_path),
FOREIGN KEY (page_path) REFERENCES admin_pages(path) ON DELETE CASCADE
```

Keyed on `user_id`, not email — an email change does not orphan grants. The cascade
means retiring a page cleans up its overrides.

### 6.1 The resolution query

One batched LEFT JOIN, in `computeAccessMap()` (`src/lib/auth/plac.ts`):

```sql
SELECT p.path, p.required_role, o.granted
FROM admin_pages p
LEFT JOIN admin_page_overrides o
  ON o.user_id = ?1 AND o.page_path = p.path
WHERE p.is_active = 1
ORDER BY p.sort_order
```

Then per row: `granted = 0` → `false` (deny wins absolutely); `granted = 1` →
`true`; otherwise `userLevel <= requiredLevel`.

The assignment goes through a guarded `Reflect.set` that refuses `__proto__` and
`constructor` — a prototype-pollution guard, because the keys are database-supplied
strings written into a plain object.

### 6.2 Checking a decision

One resolver, `resolveAccess()` in `src/lib/auth/decide-access.ts`, answers
`allow | deny | unknown`:

1. `vendor_support` **or `owner`** → `allow`, immediately, before the map is read.
   Both tiers are PLAC-exempt (ADR-0002).
2. No map on the session → `unknown`.
3. Exact match on the normalized path → its value. Keys are page paths *and* hash
   sub-permissions.
4. Otherwise the **longest ancestor across a `/` boundary** → its value. A deny on
   `/dashboard/content` therefore covers `/dashboard/content/blog`. The `/` is what
   makes the match safe: an ancestor key must be followed by a slash, so a key that
   is merely a string prefix of a longer page name never matches it.
5. Otherwise `unknown`.

*Corrected 2026-09-19: prefix matching inherits **whichever value the ancestor
holds**, allow or deny — the earlier claim that "it never grants" was wrong. A
PLAC grant on `/dashboard/users` therefore also opens the unregistered
`/dashboard/users/[id]/access` beneath it.*

Two predicates wrap the resolver, and they differ only on `unknown`:

| Predicate | Used by | `unknown` means |
|---|---|---|
| `decideAccess()` — only an allow opens the door | the middleware page gate (`src/lib/auth/stages/decide.ts`) and the sidebar | **deny** |
| `isExplicitlyDenied()` — only a deny closes it | `requirePageAccess()` / `placDenyResponse()` in `src/lib/auth/guard.ts` | **pass** — the route's own role check still applies |

`requirePageAccess()` additionally throws **403 on a missing map**. That is
fail-closed, deliberately: a session whose policy cannot be read costs a login,
whereas the other way round costs a page.

### 6.3 PLAC in production is barely exercised

**Measured live 2026-09-19: `admin_page_overrides` contains 4 rows, one of them a
deny.** *(It held exactly one row when this section was written on 2026-08-23.)*

This matters for an honest comparison. PLAC is a *designed* capability carrying
real complexity, but essentially all authorization decisions in this deployment are
made by the RBAC baseline. Anyone benchmarking this design should weigh the
override machinery as capability, not as exercised behaviour.

---

## 7. Request lifecycle

`src/middleware.ts` composes three handlers in order:

1. `sentryErrorBoundary` — catches downstream throws, tags them, returns JSON 500
   for `/api/*` and re-throws for pages.
2. `securityHeaders` — CSP with a per-request nonce (`src/lib/security/csp.ts`).
3. `authMiddleware` — everything below (`src/lib/auth/pipeline.ts`, a 77-line
   orchestrator over the stage modules in `src/lib/auth/stages/` since chunk 10).

Ordered, with the file that owns each stage and the store it touches (chunk 10,
2026-09-02; files are under `src/lib/auth/stages/` unless the path says otherwise):

| # | Stage | File | Touches |
|---|---|---|---|
| 1 | Asset, webhook, public-page and public-API classification with the method rules; then the CSRF gate | `classify.ts` | — |
| 2 | Read `__Host-admin_session` → `session:{id}` from KV; refuse a revoked session (`revoked-session:{id}`, `revoked:{userId}`); read the user's `authz-changed:{userId}` mark | `session-stage.ts` | **KV ×4** (record + one bulk read of three keys, billed per key) |
| 3a | Warm session, every 30 min **or at once when the `authz-changed` mark is new**: re-read the identity row; missing, inactive or unrecognised ends the session (no sign-in block); a changed role or a new mark recomputes the map; a Supabase outage keeps the session for up to two intervals since the last good check | `refresh-role.ts` | Supabase HTTP; **D1 ×1** on a role change or a new mark; **KV ×1 read + ×1 write** (`patchSession` stores the verified role, timestamp and mark) |
| 3b | No session: verify the Cloudflare Access assertion (JWKS, RS256, audience, issuer, expiry) | `assertion.ts` | JWKS fetch (cached) |
| 3c | … bot score, header/claim email match, whitelist, revocation flag, stored role, session creation, `cf_sub_id` write-back, login event | `bootstrap.ts` | **Supabase HTTP**, **D1 ×1** (map), **KV ×1 read + ×2 writes** |
| 4 | A usable access map: missing, built for another role or older than 1 h → recompute; bounded fail-open on a D1 error when a prior map exists | `access-map.ts` | **D1 ×1** when recomputing, plus **KV ×1 read + ×1 write** to store the fresh map |
| 5 | The decision, as data: page or API resolution through the one page rule, the viewer-on-mutation refusal, `API_DENY_MODE`, and the audit events each outcome records | `decide.ts` (pure), `../decide-access.ts` | — |
| 6 | Audit rows, after the response, through the Ghost Audit engine | `record.ts` | **D1 ×1 per event, via `waitUntil`** |
| 7 | `locals.user`, then the Decision becomes a Response (`next`, redirect, rewrite, text or JSON) | `../pipeline.ts`, `decision.ts` | — |

Stages 3b–3c run only on a cold login and 3a every 30 minutes; 1, 2 and 4–7
are the warm path. Each stage returns either `continue` with the facts the next
one needs or a `Decision`; `decision.ts` is the only place a `Response` is
built and `record.ts` the only place a row is written, so every stage is
tested on its own against real KV and D1 (`test/pipeline-*.test.ts`).

---

## 8. What happens when someone without access signs in

The question this document exists to answer. Every rejection forks: `/api/*` gets
JSON with a status code; a page gets a redirect carrying an `?error=` code, so the
login screen can explain itself.

> **Both halves of that sentence became true on 2026-09-04.** Until then two
> branches did not fork — a request with no `CF-Access-Authenticated-User-Email`
> redirected to `/` even for `/api/*`, and an untranslatable stored role returned
> JSON 403 even on a page — and four `?error=` codes were appended to
> `/cdn-cgi/access/logout`, which is Cloudflare's endpoint and does not forward an
> `error` parameter to the application, so their screens could never render. Both
> are fixed and pinned: `test/pipeline-bootstrap.test.ts` asserts each fork in both
> directions, and `test/error-code-contract.test.ts` fails on any code without a
> card, any card without a code, and any redirect that puts a code on the
> Cloudflare logout endpoint. See [`../MAINTENANCE.md`](../MAINTENANCE.md) C-20 and
> C-21, and
> [`../features/CFZT-EDGE-AUTHENTICATION.md`](../features/CFZT-EDGE-AUTHENTICATION.md)
> §4 for the full code list.

| Trigger | Status | Page behaviour | Audited |
|---|---|---|---|
| No Cloudflare identity header at all | 401 `{"error":"Missing identity"}` | → `/?error=missing_identity` | — |
| No `CF_Authorization` token | 401 `{"error":"Missing auth token"}` | → `/?error=missing_token` | — *(corrected 2026-09-19: `stages/assertion.ts` returns before any login event is emitted)* |
| Invalid or expired JWT | 401 `{"error":"Invalid or expired auth token"}` | → `/?error=expired_token` | — *(same: no event)* |
| JWT valid, **email not in `admin_authorized_users`** | 403 `{"error":"Access denied"}` | → `/?error=access_denied` | **yes — `is_authorized_email = 0`** |
| Account exists but `is_active = 0` **at bootstrap** | 403 `{"error":"Access denied"}` — deliberately the same flat 403 as "not whitelisted", so the API never reveals directory membership | → `/?error=account_inactive` | yes — `account_inactive` |
| Account went inactive **during a warm session** (re-check) | 403 `{"error":"Account inactive"}` + `Clear-Site-Data` | → `/?error=account_inactive` | — (session ends; no sign-in block since 2026-09-16) |
| Identity row gone **during a warm session** | 403 `{"error":"Access denied"}` + `Clear-Site-Data` | → `/?error=access_denied` | — |
| Directory unreachable **at sign-in** | 503 `{"error":"Directory unavailable"}` | → `/?error=directory_unavailable` | yes — `directory_unavailable` |
| Stored role does not translate | 403 `{"error":"Account role not recognised"}` | → `/?error=role_unrecognised` | no — the one refusal in `stages/bootstrap.ts` that emits no login event |
| Warm session carries a revocation flag (`revoked-session:{sessionId}` or `revoked:{userId}`) | 403 `{"error":"Session revoked"}` + `Clear-Site-Data` | → `/?error=session_revoked` | — *(corrected 2026-09-19: `stages/session-stage.ts` emits no event)* |
| **`revoked:{userId}` present at sign-in** (the 24 h block the three-layer force-kick writes) | 403 `{"error":"Access revoked"}` + `Clear-Site-Data` | → `/?error=access_revoked` | yes — LOGIN_FAILED `revocation_block_active` |
| Re-check failed: Supabase unreachable past the grace window (or on a forced re-check), or D1 unreachable while recomputing the map | 503 `{"error":"Verification unavailable"}` + `Clear-Site-Data` | → `/?error=recheck_failed` | Sentry / cooled report |
| Bot score below threshold | 403 `{"error":"Automated traffic blocked"}` | 403 | yes |
| Identity mismatch between JWT and session | 403 `{"error":"Identity verification failed"}` | 403 | yes |
| **PLAC deny on the page** | 403 `{"error":"Forbidden"}` for `/api/*` — `api_authz_deny` | → `/dashboard/access-denied` | **API denials: yes. Page GETs: no** — *corrected 2026-09-19: `stages/decide.ts` records reads nowhere, "to spare the D1 write budget". A page **mutation** is recorded as `page_mutation_attempt` with `granted: false`.* |
| **Viewer attempting a mutation** | 403 | 403 | yes — `viewer_write_blocked` |
| Access map unreadable | 403 `Access policy unavailable for this session` | destroy session → `/?error=system_error` | Sentry |
| CSRF failure | 403 | 403 | — |
| Method not allowed on a public route | 405 | 405 | — |

**The unauthorised-stranger case specifically.** A person with a valid Google
account who is not in `admin_authorized_users` *does* pass Cloudflare Access — the
IdP only proves who they are, not that they belong here. The Worker then fails them
at the whitelist lookup in stage 3c, writes an `admin_login_logs` row with `is_authorized_email = 0`, and
redirects to `/?error=access_denied`. Those rows are what the probes view in the
user registry surfaces: attempted access by people who authenticated successfully
but were never authorised.

### 8.1 Viewer enforcement runs early, on purpose

The read-only check sits **before the page decision is applied** — `decide.ts`
resolves the page first, then refuses the viewer ahead of any deny outcome — and it
covers page routes as well
as `/api/*` — Astro SSR pages accept POST, so an API-only check would leave a
mutation path open. It is deliberately not staged behind `API_DENY_MODE`: that flag
exists to protect legitimate traffic on routes that pre-dated it, and a brand-new
tier has none. A refused mutation is recorded as `viewer_write_blocked` rather than
a generic denial, so the audit trail distinguishes "wrong tier" from "wrong page".

---

## 9. API authorization

`src/lib/auth/routes.ts` holds the route contract:

- `PUBLIC_ROUTES` — `/`, `/privacy`, `/terms`
- `PUBLIC_API_ROUTES` — four named routes: `/api/health`, `/api/emails/unsubscribe`, `/api/auth/logout`, `/api/auth/dev-login`
- `PUBLIC_API_PREFIXES` — two, both token-authorized: `/api/storage/share/`, `/api/storage/request/`
- `WEBHOOK_ROUTES` — `/api/emails/webhook` (signature-verified instead)
- `API_PAGE_MAPPING` — prefix → page entries, matched longest-prefix-first via `API_PAGE_MAPPING_KEYS`. The set is the file itself; do not restate it here.

> *Corrected 2026-09-19.* This list previously carried an `/api/auth/` **prefix**
> and a count of 39 mappings. The prefix was replaced by the two named `/api/auth/`
> routes above on 2026-09-04 (MAINTENANCE C-25) — as a prefix, any file added under
> `src/pages/api/auth/` became unauthenticated and PLAC-exempt the moment it
> existed. The mapping count is 44 today; counts in a doc drift, so
> `src/lib/auth/routes.ts` is now cited instead of copied.

`resolveApiAuthz()` returns `public | webhook | mapped | null`. **`null` is
default-deny.** `API_DENY_MODE` in `wrangler.toml` selects the behaviour: `shadow`
allows the request but writes an `api_authz_shadow_deny` audit row recording what
*would* have been blocked; `enforce` returns 403. Any unset or unrecognised value
also enforces — an unreadable config must never silently reopen the gap. It has
been `enforce` since 2026-08-12.

Two independent mechanisms guard API routes, and both must pass:

1. The pipeline's mapping-driven default-deny (above).
2. Per-handler opt-in via `placDenyResponse(actor, pagePath)` from
   `src/lib/auth/guard.ts`.

`test/api-authz-inventory.test.ts` fails CI if any `/api/*` route is unmapped, which
makes "someone shipped a route without a guard" a build error rather than an
incident.

---

## 10. Provisioning gates

`POST /api/users/access` enforces five gates before any override is written
(`src/pages/api/users/access.ts`):

| Gate | Rule | Prevents |
|---|---|---|
| — | Self-modification refused | Elevating yourself |
| **A** | Actor must strictly outrank the target; target's role is **read from the database**, never from the request body | Spoofing a low target role to bypass the hierarchy |
| **B** | Vendor Support and Owner accounts cannot be mutated by lower ranks | A manager editing the account holder |
| **C** | Actor must have access to the page they are granting | Granting a door you cannot open |
| **D** | A page whose required role sits above the **actor's** clearance cannot be granted to anyone | Manufacturing a super-user by accumulating grants |

Gate A reading the target role from the database rather than the payload is the
single most important line in the file; trusting `body.targetUserRole` was a real
finding, hardened 2026-05-25.

*Corrected 2026-09-19: Gate D was described here as the **target's** ceiling. The
code compares the **actor's** level against the page's required level
(`src/pages/api/users/access.ts`), which is what T3 in §2 already said. Grants
above the actor's own clearance are refused; a grant at or below it is allowed
whatever the target's baseline rank.*

> **Gate D makes a `dev` baseline undelegatable by the customer, and that is
> easy to ship by accident.** *Added 2026-09-20.* The comparison is
> `ROLE_LEVEL[actor] > ROLE_LEVEL[page.required_role]`. A row storing `dev`
> normalises to `vendor_support` at level 0, and the owner is level 1, so `1 > 0`
> refuses **every grant the owner attempts** on that key — only vendor support
> can delegate it. `/dashboard/cron#trigger` and `#configure` shipped that way in
> `0054`/`0055` and were moved to the `owner` baseline by
> `migrations/0056_cron_action_roles.sql`, which changed no role's baseline
> access (an admin is level 2 and fails `2 <= 1` either way) and restored the
> owner's ability to delegate. **Before giving a registry row a `dev` baseline,
> decide whether the customer should be able to hand that capability out.** If
> they should, the lowest baseline that permits it is `owner`. The arithmetic is
> pinned in `test/cron-permissions.test.ts`.

---

## 11. Revocation, and how fast it actually takes effect

Three layers (`src/lib/auth/plac.ts`):

1. `revoked:{userId}` written to KV (TTL 24 h) — every session for that user fails
   its next request.
2. All `session:{id}` and `user-session:{userId}:{id}` keys deleted.
3. A Cloudflare Access API call invalidates the `CF_Authorization` cookie at the
   edge, so the user cannot simply re-enter with the token they still hold.

`revoked-session:{sessionId}` (TTL 24 h) does the same for one session — but not
only for that session: `revokeSingleSession` also fires layer 3, the
organisation-wide `POST /accounts/{id}/access/organizations/revoke_user` with
`devices: true`, which ends the user's Cloudflare Access session on every device.
Revoking one browser signs the person out everywhere. Tracked as open defect D8 in
the access-revocation design (§16).

**Permission changes do not revoke anything (2026-09-16).** Until then a single
page revoke, an access-request approval, a role change and a page-registry change
all called the three-layer force-kick above, and its `revoked:{userId}` flag
refused every sign-in for 24 hours — which is how the only Owner was locked out
on 2026-09-16 ([`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md)).
Those changes now write a random `authz-changed:{userId}` mark instead. The
session stage reads it in the same bulk KV read as the flags, and a session
whose stored `authzMark` differs re-reads its role from Supabase and its map from
D1 on that request. Grants and revocations therefore both reach a signed-in user
on their next request, subject only to KV's eventual consistency (about 60 s),
and nobody is signed out. The three-layer force-kick is left to force-kick,
deactivation, deletion and the Sessions page's block action; stage 2 of the
remediation retires its user-level flag.

---

## 12. Audit

Authorization events are written to D1 `admin_audit_log` through the execution
context that `getCfContext()` (`src/lib/env.ts`) resolves, and its `waitUntil` —
the insert runs *after* the response is flushed, so the database write is off the
user's critical path entirely. *Corrected 2026-09-19: this said
`context.locals.runtime.waitUntil`; `locals.runtime` throws under Astro 6+, which
is why `src/lib/auth/stages/record.ts` goes through `getCfContext` and binds the
method before calling it.* Sign-in attempts, authorised or not, go to
`admin_login_logs` with full Cloudflare telemetry: IP, user agent, geo, ASN, colo,
TLS version, HTTP protocol, client RTT, Ray ID, Access method, identity provider,
JWT tail and bot score.

**Measured live 2026-09-19:** `admin_audit_log` holds **2** rows — a bulk
`delete` on 2026-09-18 and the `api_mutation_attempt` recording that same call.
`admin_login_logs` holds 349. *(It was 232 / 293 on 2026-08-24; the audit table
has since been cleared twice. See the paragraph below.)*

IPs are stored as an HMAC-SHA256 hash keyed directly by `IP_HASH_SECRET` and
truncated to 16 hex characters (`src/lib/audit-helpers.ts`), computed once per
session creation, so the audit trail carries no raw IP. *Corrected 2026-09-19:
this attributed the hash to `src/lib/crypto/hkdf.ts`; HKDF subkey derivation is
used by the unsubscribe and share-token paths, not by IP hashing.*

The log is **neither complete nor tamper-evident** — no hash chain, no sequence
number, no WORM storage; the table is a retention-purge target; page reads are not
recorded at all (§8); and owner and vendor can bulk-delete rows through
`DELETE /api/audit/logs`, which is what emptied the live table on 2026-09-18. The
snapshot that route takes before deleting is written into the same deletable table.
Tracked as C-9; the agreed remedy — append-only with one gated erasure path — is
designed in
[`../specs/2026-09-06-audit-log-remediation-design.md`](../specs/2026-09-06-audit-log-remediation-design.md)
and is **not shipped** (ROADMAP chunk 19). [`plac-and-audit.md`](plac-and-audit.md)
owns the engine and the deletion paths.

---

## 13. Resource accounting

### 13.1 Operations per request, by path

Derived by reading `src/lib/auth/pipeline.ts` and `src/lib/auth/session.ts`.
This is a code-derived count, not a measurement.

| Path | KV reads | KV writes | D1 | Supabase | External |
|---|---:|---:|---:|---:|---|
| Warm authenticated page | **4** (3 on an isolate-cache hit) | 0 | 0 (+1 audit per event via `waitUntil`) | 0 | 0 |
| Cold login | 1 | **2** | 1 (map) + 1 (audit) | **1 GET + 1 PATCH** | JWKS if cache cold |
| Role re-check (30 min elapsed, or a new `authz-changed` mark) | 4 + 1 | 1 | 1 on a role change or a forced re-check | 1 | 0 |
| PLAC refresh (map > 1 h old) | 4 + 1 | 1 | 1 | 0 | 0 |
| Unauthenticated | 0 | 0 | 1 (login log) | 1 | JWKS if cold |
| Public/asset route | 0 | 0 | 0 | 0 | 0 |

**Why four, not one.** *Corrected 2026-09-19: §1, §3 and §15 all said one, while
§7 already said four.* A warm request reads `session:{id}` — skipped on the
5-second isolate-cache hit — and then does **one bulk `get` of three keys**:
`revoked-session:{sessionId}`, `revoked:{userId}` and `authz-changed:{userId}`
(`src/lib/auth/stages/session-stage.ts`). Cloudflare bills a bulk read **per key**,
so that bulk counts as three operations, not one. The third key arrived with the
2026-09-16 Stage 1 change; before it the warm path was three. The re-check and the
map refresh each add a `patchSession` read **and** write on top
(`src/lib/auth/session.ts`).

Session creation costs **two** KV writes, not one — the record plus the
`user-session:` reverse index that makes per-user revocation possible.

A sidebar render adds one more KV read for the `system:admin_pages_cache_v2` page
registry cache (TTL 1 h), which falls back to D1 with three retries and exponential
backoff — so a warm dashboard page render is **five** reads, or four on an
isolate-cache hit.

### 13.2 Measured latency

**Source: Sentry, `cf-admin` project, 30-day window ending 2026-08-23, 10% trace
sampling (`tracesSampleRate: 0.1` in `src/workers/cf-entry.ts`).** Spans scoped to
the `GET /dashboard` transaction, n = 2,920 transactions.

| Span | Occurrences | avg | p50 | p95 |
|---|---:|---:|---:|---:|
| Supabase `GET admin_authorized_users` | 70 | **243.6 ms** | 198 ms | 401 ms |
| Supabase `PATCH admin_authorized_users` | 50 | 96.8 ms | 113 ms | 125 ms |
| Cloudflare Access JWKS `/cdn-cgi/access/certs` | 50 | 31.4 ms | 28 ms | 47 ms |
| Sign-in alert email (Brevo) | 40 | 145.8 ms | 144 ms | 167 ms |

Whole-transaction `GET /dashboard`: **avg 128.7 ms, p95 219.4 ms**.

**The two ratios that characterise this architecture:**

- The Supabase identity lookup runs on **70 of 2,920 requests — about 2.4%**. The
  KV session cache absorbs roughly **97.6%** of traffic with no origin round trip.
- The JWKS fetch runs on **50 of 2,920 — about 1.7%**; the module-scope certificate
  cache is doing its job.

**So the honest performance story is bimodal, and most descriptions of this system
tell only the fast half.** A warm request resolves authorization from KV, with no
origin round trip. A cold login pays roughly **240 ms to Supabase**, plus ~31 ms
for JWKS if the certificate cache is cold. "Sub-millisecond edge authorization" is
true of the decision, and not true of the login. *Corrected 2026-09-19: this
sentence added "~97 ms for the login-counter write". The PATCH in the table above
is the one-off `cf_sub_id` write-back on first login, not a counter, and it runs
inside `waitUntil` after the response — so it does not sit on the user's path at
all (`src/lib/auth/stages/bootstrap.ts`).*

**Source: Cloudflare D1, live query 2026-08-23.** The exact `computeAccessMap`
query against production:

| Metric | Value |
|---|---|
| Rows returned | 81 |
| **Rows read** (the billing unit) | **173** |
| SQL duration | **0.65 ms** |

That is materially faster than the "~2 ms" budget asserted in the source comments.

**Access map size:** 2,143 bytes of path strings across 81 entries (mean path 26.5
chars, max 44) → roughly **2.9 KB** serialised, comfortably inside KV's 25 MB value
limit and cheap to parse.

### 13.3 Quota ceilings — where this design runs out

Cloudflare limits, from Cloudflare documentation retrieved 2026-08-23:

| Resource | Free | Paid |
|---|---|---|
| Worker CPU time | **10 ms / invocation** | 30 M CPU-ms/mo included |
| KV reads | 100,000 / day | 10 M/mo, then $0.50/M |
| **KV writes** | **1,000 / day** | 1 M/mo, then $5.00/M |
| D1 rows read | 5 M / day | 25 B/mo |
| D1 rows written | 100,000 / day | 50 M/mo |

**The binding constraint is KV writes, not reads** — and this is the single most
useful capacity fact about the design.

The arithmetic (labelled as arithmetic, not measured), **redone 2026-09-19**: one
working day per staff member costs 2 writes at login, plus 1 `patchSession` write
per 30-minute role re-check (~16 in an 8-hour day), plus 1 per hourly access-map
refresh (~8). That is about **26 writes per person per day**, not the ~18 this
section claimed, so roughly **38 concurrent daily users on the free plan** before
writes fail. Every `authz-changed` mark an administrator writes adds to that, as
does each session the target then re-verifies.

**The 1,000 writes/day quota is account-wide, not per Worker.** It is shared with
cf-astro's `ISR_CACHE` — the CMS publish path and its rate-limit fallback, which
writes one KV key per booking and per consent POST. Budgeting cf-admin sessions
against the full 1,000 overstates the headroom. See
[`KV-RESILIENCE.md`](KV-RESILIENCE.md) for the cf-astro side.

Reads scale further, but not as far as this section used to claim: at 4–5 KV reads
per authenticated page request (§13.1), 100,000 reads/day supports roughly
**20,000–25,000 page requests/day**, not 100,000. The asymmetry still holds — the
free tier prices writes 100× higher — and writes remain the binding constraint.

D1 is not close to a limit: 173 rows read per map computation against 5 M/day.

**Worker CPU time is not measurable from here.** No read-only MCP tool exposes
per-invocation CPU, and the portal sits behind Cloudflare Access so it cannot be
driven from this environment. What can be said structurally: the warm path performs
one KV read plus one bulk read of three flag keys, one `JSON.parse` of ~2.9 KB,
and one hash lookup, with no cryptography
— the JWT is verified only when a session is being created. Whether that fits the
10 ms free-plan ceiling should be confirmed with `wrangler tail` or Workers
analytics before anyone quotes a number.

---

## 14. Failure modes

| Dependency fails | Behaviour | Fail-open or closed? |
|---|---|---|
| KV read fails / session missing | Falls through to full JWT + Supabase login | **Closed** |
| Access map missing from session | `requirePageAccess` throws 403 | **Closed** |
| D1 unreachable during map recompute, **no** prior map | Session destroyed → `/?error=system_error` | **Closed** |
| D1 unreachable during map recompute, prior map exists | Prior map extended with a new `computedAt` | **Open, bounded** — serves the last known-good policy rather than locking everyone out |
| Supabase unreachable at login | Login fails | **Closed** |
| JWKS fetch fails | JWT cannot be verified → 401 | **Closed** |
| Page registry cache miss | 3 D1 retries with exponential backoff, then throw | Closed |

Every branch except one fails closed. The exception is deliberate and bounded: an
already-authenticated user with a valid map keeps their existing policy through a
D1 outage rather than being ejected mid-task. That is a defensible trade, and it is
the kind of decision a comparison should surface rather than bury.

**KV eventual consistency.** Workers KV is eventually consistent across regions.
A session write is not guaranteed instantly visible at every edge location, so in
the worst case a just-revoked session could be served briefly from a stale replica —
which is precisely why revocation is *three* layers rather than one, with the
Cloudflare Access cookie invalidation as the backstop that does not depend on KV
propagation.

---

## 15. Where this sits against the industry

Judged honestly, this is a **coarse-grained, per-page ACL with an edge-cached
decision point**. It is not a relationship-based authorization system and does not
try to be.

| Dimension | This system | Zanzibar / OpenFGA / SpiceDB | Auth0 / Keycloak RBAC | Cerbos / Casbin / OPA |
|---|---|---|---|---|
| Model | Role rank + per-page override | Relationship tuples | Roles + scopes | Policy language |
| Granularity | Page and hash-fragment action | Any object, any relation | Role/scope | Arbitrary, policy-defined |
| Decision latency (warm) | KV reads already on the session path, no extra network hop | Network call to the PDP | Token claims, or a network call | Sidecar or network call |
| Decision latency (cold) | ~240 ms measured (Supabase) | PDP round trip | IdP round trip | Sidecar startup |
| Infra to operate | None beyond Cloudflare | A PDP cluster + datastore | Hosted or a Keycloak cluster | A sidecar per service |
| Expresses "user X can edit doc Y" | **No** | Yes | Not natively | Yes |
| Policy change propagation | Denies and grants alike on the next request (§11) | Immediate, consistency-tokened | Token TTL | Immediate |
| Audit of decisions | Mutations and API denials, to D1; page reads are not recorded (§8) | Yes | Varies | Varies |
| Cost at this scale | $0 | A cluster | Per-MAU | Compute per service |

**Where it genuinely wins.** There is no policy decision point to run, scale, patch
or pay for. The decision is co-located with the request and travels inside the
session record, so authorization adds no network hop to a request that was going to
hit KV for the session anyway — the marginal latency cost of authorization is close
to zero. For an admin console with a fixed, small set
of pages and a handful of staff, this is a proportionate design, and its measured
97.6% cache-hit rate shows the caching strategy working as intended.

**Where it would lose.** The moment permissions need to depend on the *object*
rather than the *page* — "this manager may see only their own branch's bookings" —
the model has no way to express it, and the honest answer is a rewrite onto a
relationship model, not an extension. Prefix-based propagation is a weak substitute
for inheritance — and it inherits grants as readily as denies (§6.2), which is a
sharper edge than it looks. *Corrected 2026-09-19: this paragraph also cited "the
one-hour grant delay". Stage 1 removed it on 2026-09-16; §11 has the mechanism.*

Prior comparative research lives in
[`../reference/RBAC-AT-SCALE.md`](../reference/RBAC-AT-SCALE.md) and
[`../reference/PERMISSION-ARCHITECTURE-ASSESSMENT.md`](../reference/PERMISSION-ARCHITECTURE-ASSESSMENT.md);
a proposed successor model is sketched in
[`../reference/DYNAMIC-ROLES-PBAC-DESIGN.md`](../reference/DYNAMIC-ROLES-PBAC-DESIGN.md).
Those are `draft` and forward-looking. **This document describes what is built.**

### 15.1 Compliance mapping

| Framework | Control | Where satisfied |
|---|---|---|
| SOC 2 | CC6.1 logical access | Cloudflare Access + RBAC baseline |
| SOC 2 | CC6.2 registration/authorisation | `admin_authorized_users`, §10 gates |
| SOC 2 | CC6.3 role-based restriction | §4–§6 |
| ISO 27001 | A.9.2 user access management | §10, access-review export |
| ISO 27001 | A.9.4 system access control | §7–§9 |
| OWASP ASVS L2 | V1/V4 access control | [`../security/compliance/ASVS-L2.md`](../security/compliance/ASVS-L2.md) |

*The A.9.x identifiers are ISO/IEC 27001:**2013** Annex A numbering. They were not
re-checked against the 2022 edition, which restructured Annex A.*

---

## 16. Known gaps

| # | Gap | Impact |
|---|---|---|
| C-11 | Role vocabulary migration outstanding; `viewer` cannot be persisted (§4.1). | The read-only tier is enforced in code but unassignable. |
| C-9 | Audit log is neither complete nor tamper-evident (§12). | Page reads are never recorded, and owner/vendor can bulk-delete rows. Append-only is designed, not shipped. |
| D6 | `DELETE /api/users/force-kick` refuses only **owner and vendor** targets, not peers or lower ranks. Anyone who clears the `/dashboard/users` gate — including a staff member holding a PLAC grant on it — can force-kick an admin or a peer, which writes the 24 h `revoked:` sign-in block. The owner-only `/dashboard/users#force-kick` registry row is checked nowhere. | Rank supremacy (T5, §4.1) does not hold on this path. |
| D7 | The Sessions console's `block_account` applies the same owner/vendor-only test, then deactivates the target in Supabase. | A peer can be deactivated. |
| D8 | `revokeSingleSession` calls the organisation-wide `revoke_user` with `devices: true` (§11). | Revoking one session signs the user out on every device. |
| — | 4 overrides in production, 1 of them a deny (§6.3), **none on any cron key** (re-measured 2026-09-20). | PLAC is near-unexercised capability. |
| — | A `dev`-baseline registry row cannot be delegated by the owner at all (§10). Two cron rows shipped that way and were repaired by `0056`; nothing prevents the next one. | A capability the customer can hold but never hand on, with no error explaining why. |
| — | Cold login costs ~240 ms to Supabase (§13.2). | Identity is not edge-local; only the decision is. |

D6, D7 and D8 are open defects recorded in
[`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md)
§2. *Added 2026-09-19; the row claiming "grants propagate in up to 1 h" was removed
in the same pass — Stage 1 replaced it (§11).*

**Closed 2026-09-16:** D-3 (`session-status.ts` gated on a deactivated key) and D-4
(`/api/sessions` mapped to one page while its handlers checked another) are both
fixed and verified against code; the route mapping and all three handlers now agree
on `/dashboard/sessions`. D-5, found while closing them — four sessions
sub-permissions defined in `admin_pages` and enforced nowhere — is fixed in the same
pass. Full history in [`../MAINTENANCE.md`](../MAINTENANCE.md).

---

## 17. What the tests actually pin

| Test | Guarantees |
|---|---|
| `test/rbac-roles.test.ts` | Ladder ordering, translation, `canManageUser` semantics |
| `test/plac.test.ts` | Map computation against a real D1 registry, deny-beats-grant |
| `test/guard-plac.test.ts` | `requirePageAccess` exact match, prefix propagation, fail-closed on a missing map, owner bypass, an unknown key is not a deny |
| `test/decide-access.test.ts` | The one page-access rule: vendor and owner bypass, exact key, longest-ancestor inheritance, unknown vs deny |
| `test/pipeline-session.test.ts`, `test/pipeline-bootstrap.test.ts`, `test/pipeline-decision.test.ts` | Every status, redirect, rewrite, header, KV effect and audit row of the middleware on real KV and D1 (**49** cases today): session read, both revocation flags and the `authz-changed` mark; the 30-minute re-check, **including that a supabase-js 5xx keeps the session inside the grace window and only then ends it with `recheck_failed`**; the Cloudflare Access bootstrap with a real RS256 key and a stubbed identity store; the access-map refresh and its bounded fail-open; the viewer rule; `API_DENY_MODE`; the rows `recordEvents` writes |
| `test/authz-signal.test.ts` | The Stage 1 mark: `markAuthzChanged` writes and TTLs, and `isAuthzStale` comparison (4 cases) |
| `test/api-authz-inventory.test.ts` | **Every `/api/*` route is mapped** — CI fails otherwise |
| `test/cron-permissions.test.ts` | The two-key guard end to end: a page deny reaching the action, an action grant not opening its siblings, a **missing registry row failing closed**, a session with no access map refused, the owner/vendor bypass — and Gate D's arithmetic, which is why `0056` exists (added 2026-09-20) |
| `test/migrations-replay.test.ts` | The four cron registry rows exist, are active, have non-null icons and carry the expected `required_role` — the assertion `0054` needed and did not have (added 2026-09-20) |
| `test/sessionRisk.test.ts` | Session risk scoring |
| `test/cf-access-sync.test.ts` | Group sync behaviour |

---

## Verification log

| Date | Checked by | Method | Result |
|------------|-----------|-------------------------------|------------------------|
| 2026-08-24 | antigravity | Full read of `src/lib/auth/*`; live D1 queries via Cloudflare MCP (registry counts, access-map query timing, schema); Supabase user counts; Vitest auth suite execution (223/223 pass) | pass — all figures verified against live code and database |
| 2026-09-02 | claude | chunk 10: §7 rewritten from the stage modules after the decomposition (`wc -l src/lib/auth/stages/*.ts`, `git show 794bc34`); §17 from the suites that ran (`npx vitest run`: 279 cases across the 11 auth-path files, 717 across the repository). §13.1's KV-read figures were not re-verified here — chunk 10b owns that correction | §7 and §17 match the code at `794bc34` |
| 2026-09-20 | claude | **Scope-limited to the fragment/action model.** Read `guard.ts`, `decide-access.ts`, `surface-guards.ts` and `api/users/access.ts`; traced Gate D's arithmetic for a `dev` baseline; took live D1 counts for `admin_pages` (97 rows, 86 active, 51 fragments) and `admin_page_overrides` (4 rows, none on a cron key) | Three additions: an action key now fails closed where a page key does not (§5), a `dev`-baseline row cannot be delegated by the owner at all (§10, new gap row in §16), and two new test rows in §17. **Not re-derived:** §13's resource accounting, §11's revocation timings, §15.1's control ids |
| 2026-09-19 | claude | Full re-derivation against `06f8ab7`. Read `decide-access.ts`, `guard.ts`, `routes.ts`, `pipeline.ts` and every module in `stages/`, plus `plac.ts`, `session.ts`, `rbac.ts`, `audit-helpers.ts`, `api/users/access.ts`, `api/users/force-kick.ts`, `api/sessions/active-sessions.ts` and `api/audit/logs.ts`; counted `API_PAGE_MAPPING` entries and `it(` cases; took live D1 counts for `admin_page_overrides`, `admin_audit_log` and `admin_login_logs` from the 2026-09-18 fact sheet | 17 corrections applied. Load-bearing: the owner/vendor bypass is now step 0 of §1 and §6.2; prefix matching inherits grants, not only denies; the warm path is 4 KV reads, reconciled across §1/§3/§7/§13/§15; the `/api/auth/` public prefix and the "39 mappings" count are gone; page-GET denials are not audited; Gate D caps at the actor's clearance; §13.3 arithmetic redone (~26 writes → ~38 users); §15/§16's "grant ≤ 1 h" and §17's "5xx revokes like a missing row" retired; D6/D7/D8 added to §16. **Not re-derived:** §13.2's Sentry figures (2026-08-23) and §15.1's ISO control ids |

## Related

- [`plac-and-audit.md`](plac-and-audit.md) — Ghost Audit engine internals
- [`ARCHITECTURE.md`](ARCHITECTURE.md) — the wider request lifecycle
- [`../features/USER-MANAGEMENT.md`](../features/USER-MANAGEMENT.md) — account lifecycle and the admin UI
- [`../features/SESSION-MANAGEMENT.md`](../features/SESSION-MANAGEMENT.md) — the sessions console
- [`../security/SECURITY.md`](../security/SECURITY.md) — route tables and posture
- [`../security/login-forensics.md`](../security/login-forensics.md) — sign-in telemetry
