---

title: "Cron Control Plane — Improvement & Permission Remediation Plan"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-09-20
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/cron/index.astro, src/components/admin/cron/CronDashboard.tsx, src/components/admin/cron/JobRow.tsx, src/components/admin/cron/ConfigPanel.tsx, src/components/admin/cron/RunConsole.tsx, src/components/admin/cron/status.ts, src/pages/api/cron/index.ts, src/pages/api/cron/state.ts, src/pages/api/cron/config.ts, src/pages/api/cron/sync.ts, src/pages/api/cron/jobs/[id]/stream.ts, src/lib/auth/surface-guards.ts, src/lib/auth/guard.ts, src/lib/auth/decide-access.ts, src/lib/jobs/runJob.ts, src/lib/jobs/control.ts, src/lib/jobs/registry.ts, src/lib/jobs/tiers.ts, src/lib/dal/CronControlRepository.ts, src/pages/api/users/access.ts, scripts/seed_cron_control.mjs]
related_docs: [../features/CRON-CONTROL.md, ../architecture/PERMISSIONS-SYSTEM.md, ./2026-09-16-cron-control-plane-design.md, ./2026-09-16-cron-control-plane-implementation-plan.md, ../MAINTENANCE.md, ../reference/schema-change-ledger.md, ../../RULESAd.md]
tags: [cron, jobs, control-plane, plac, permissions, ux, plan]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan. It names files and migrations that tasks will create; the
     code-path check is opted out here and enforced once each phase ships. -->

# Cron Control Plane — Improvement & Permission Remediation Plan

> **Phase 0 shipped 2026-09-20.** F-1, F-2, F-3 and F-4 are fixed: migration
> `0056` moves `#trigger` and `#configure` to the `owner` baseline (decision
> **D-1**, approved), `denyCron` and the page's capability flags require an
> explicit allow on an action key, the four registry rows are asserted in
> `test/migrations-replay.test.ts`, and the Sync button is gated on `#trigger`
> with a permission-free Refresh beside it (decision **D-2**, approved).
> `0056` is written and frozen in the manifest but **not yet applied to
> production** — it applies with `npm run release`, since a push does not.
> **Phase 1 shipped 2026-09-20.** F-8, F-9, F-10, F-11, F-12, F-13 and F-15 are
> fixed, along with F-25 to F-28 from phase 4, which were comments in the same
> files. Two tasks changed on contact with the code and are recorded here rather
> than silently dropped:
>
> - **P1-6 (a reason on a manual run) is deferred to phase 2.** The run console
>   starts the job the moment the dialog opens, so asking for a reason first is a
>   flow change, not a field. It belongs with the console's own UX pass. Building
>   the server side now would have shipped a parameter nothing sends.
> - **P1-8 changed shape.** The plan said the seed script should write an audit
>   row. `admin_audit_log` requires `user_id`, `user_email` and `user_role` NOT
>   NULL, and a script has no session to resolve them from — a fabricated actor
>   in the audit trail is worse than a gap in it, because every reader downstream
>   treats those rows as authenticated fact. The script takes `--actor=` instead
>   and stamps it on the settings row, which is the provenance that was missing.
>
> Phases 2–4 are open; the findings register below is unedited.


> **TL;DR (non-technical):** The Scheduled Jobs page works, but three things are
> wrong with it. The permission system around it is largely decorative — the
> account owner literally cannot hand "run a job" or "change settings" to anyone,
> and if a permission row were ever missing the page would open the doors rather
> than close them. A pause quietly erases a job's throttle setting. And the page
> tells an operator less than the data it already has: it never shows failures,
> never refreshes itself, and counts a stopped job's skipped ticks as "runs".
> This plan fixes those in four phases, smallest and most dangerous first.

## 0. Scope, and what this supersedes

**In scope:** `/dashboard/cron`, its four API routes, the PLAC keys that guard
them, the control document, and the dashboard island. **Not in scope:** the job
handlers themselves, the tick dispatcher, Analytics Engine telemetry, and the
wider PLAC model outside this surface (gaps D6/D7/D8 belong to
[`2026-09-16-access-revocation-remediation-design.md`](./2026-09-16-access-revocation-remediation-design.md)).

This plan is the triage record that [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md)
§1 promised and never got: that document says the Sync-telemetry defect was
"logged for triage in `MAINTENANCE.md`", and no such row exists (grepped
2026-09-20). Finding **F-29** closes that loop.

Everything below was re-derived against HEAD `1f8cfc3` on 2026-09-20, with the
live figures taken from production D1 through the Cloudflare MCP connector, per
`RULESAd.md` §14 — not copied from another document.

## 1. The ground truth, measured 2026-09-20

| Fact | Value | How it was checked |
|---|---|---|
| Registry rows for this surface | 4, all `is_active = 1`, icons non-null | `SELECT … FROM admin_pages WHERE path LIKE '/dashboard/cron%'` |
| Stored baselines | page `super_admin`; `#pause` `owner`; `#trigger` `dev`; `#configure` `dev` | same query |
| Control document | `v1`, **`rev` 179**, `mode: normal`, `updated_by: cron-tick`, `updated_at 2026-09-20 17:21:06` | `SELECT … FROM admin_portal_settings WHERE setting_key = 'cron-control'` |
| Jobs switched off | `gsc-sync`, `pagespeed-sync` (both seeded reasons) | control document |
| Intervals live | `cron-usage-probe` only, 60 min, `lastRunAt` stamped | control document |
| D1 usage at last probe | 0.34% of daily reads (17,036 rows), 0.14% of writes (143 rows) | control document `usage` |
| PLAC overrides in production | **4 rows total, none on any cron key** | `SELECT … FROM admin_page_overrides` |
| Cron audit rows ever written | **`cron_trigger` × 2**; zero `cron_pause`, `cron_resume`, `config_change` | `SELECT action, COUNT(*) … WHERE action LIKE 'cron_%'` |
| Page registry size | 97 rows, 86 active, 51 hash fragments | `SELECT COUNT(*) … FROM admin_pages` |

Two of those rows carry most of this plan. **`rev` 179** proves the tick writes
the same revision token the dashboard uses for conflict detection (F-9). **Zero
pause/resume/config audit rows against two live pauses** proves the current
control state has no audit provenance at all (F-15).

## 2. Findings register

Severity: 🔴 must fix before anything else · 🟠 fix in this programme · 🔵 improvement.

### A. Permissions — the model does not do what the documents say it does

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **F-1** | 🔴 | **The owner cannot delegate `#trigger` or `#configure` to anybody, ever.** Gate D refuses a grant when `ROLE_LEVEL[actor] > ROLE_LEVEL[page.required_role]`. Both rows store `dev`, which normalises to `vendor_support` (level 0); the owner is level 1, so `1 > 0` refuses every grant. Only vendor support can hand out run-now or configure. [`../features/CRON-CONTROL.md`](../features/CRON-CONTROL.md) §2's "any tier below owner can be granted one action without the others" is true of `#pause` alone. | `src/pages/api/users/access.ts` Gate D; `src/lib/auth/rbac.ts` `ROLE_LEVEL`; live registry rows |
| **F-2** | 🔴 | **A missing or deactivated registry row opens the action instead of closing it.** `requirePageAccess` refuses only an explicit deny and `resolveAccess` answers `unknown` for an undefined key, so `denyCron(session, 'trigger')` permits everyone who can open the page. This already happened: `0054` inserted all three fragments with a NULL `icon` under `INSERT OR IGNORE`, SQLite discarded them silently, and the three checks were no-ops for every role until `0055` repaired them. Nothing in CI asserts the rows exist. | `src/lib/auth/guard.ts` `requirePageAccess`; `src/lib/auth/decide-access.ts` `resolveAccess`; `migrations/0055_cron_control_plane_subpages.sql` header |
| **F-3** | 🔴 | **The server-rendered capability flags fail open the same way.** The page computes `can(action) = resolveAccess(...) !== 'deny'`, so an `unknown` key renders the control. | `src/pages/dashboard/cron/index.astro` |
| **F-4** | 🟠 | **The Sync Telemetry button renders for everyone but requires `#trigger`.** A canonical admin — the only role the baselines actually bind — sees "Sync failed (403)". `a9dd974` also replaced the plain refresh with this button, so the page lost its only refresh that needs no permission. | `src/components/admin/cron/CronDashboard.tsx` header actions vs `src/pages/api/cron/sync.ts` |
| **F-5** | 🟠 | **Controls vanish instead of explaining themselves.** Every action is `{capabilities.x && …}`, so a viewer with page access sees a read-only page with no hint that the actions exist or which key grants them. | `CronDashboard.tsx`, `JobRow.tsx` |
| **F-6** | 🔵 | **The fine-grained model has never gated anybody in production.** Zero cron overrides live; every cron action to date was taken under the owner/vendor bypass. Capability, not exercised behaviour — the same caveat `PERMISSIONS-SYSTEM.md` §6.3 makes globally. | live `admin_page_overrides` |
| **F-7** | 🔵 | **An operator cannot see their own capabilities** without clicking something and discovering a 403. | — |

### B. Control-plane correctness

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **F-8** | 🔴 | **A pause/resume round-trip silently erases a job's interval.** The route rebuilds the entry from scratch and carries over only `lastRunAt`; the dashboard never sends `intervalMinutes`. Live, `cron-usage-probe` holds 60 minutes — one pause/resume through the page drops it, and only the in-code `USAGE_PROBE_INTERVAL_MIN` backstop keeps that job from making 288 Cloudflare calls a day. Any other job would have no backstop. | `src/pages/api/cron/state.ts`; `src/workers/scheduled-usage-probe.ts` |
| **F-9** | 🟠 | **The tick bumps the compare-and-swap token the humans use, so the page 409s for no reason.** `stampIntervalClocks` writes `rev + 1`; the dashboard sends the `expectedRev` it captured at page load. The live document is at rev 179, `updated_by: cron-tick`. Any tab open across an hourly stamp fails its first pause with "the control document changed since you loaded it". | `src/lib/jobs/runJob.ts` `stampIntervalClocks`; `CronDashboard.tsx` `setState`/`saveConfig`; live `rev` |
| **F-10** | 🟠 | **No job takes a lease, so a manual run can race a scheduled tick** — including `asset-cleanup`, which deletes R2 objects. `claimLease` is implemented and never reached, and the stream route's docblock claims the opposite. | `src/lib/jobs/runJob.ts`; `src/lib/jobs/registry.ts` (no `leaseSeconds` anywhere); `src/pages/api/cron/jobs/[id]/stream.ts` docblock |
| **F-11** | 🟠 | **`POST /api/cron/sync` has no rate limit.** Every click is one Cloudflare GraphQL call plus a control read and a CAS write, with `force = true` bypassing the probe's own hourly gate. | `src/pages/api/cron/sync.ts`; `scheduled-usage-probe.ts` `force` branch |
| **F-12** | 🔵 | **`/api/cron/sync` is a copy of `/api/cron`'s read model** — catalog parse and job mapping duplicated verbatim. Two copies drift. | both files |

### C. Audit and provenance

| # | Sev | Finding | Evidence |
|---|---|---|---|
| **F-13** | 🟠 | **`POST /api/cron/sync` mutates the control document and writes no audit row**, while state, config and trigger all do. It also stamps `updated_by: cron-usage-probe-manual` rather than the actor. | `src/pages/api/cron/sync.ts` vs `state.ts`/`config.ts`/`stream.ts` |
| **F-14** | 🔵 | **A manual trigger records no reason** — the `cron_trigger` details carry only `{manual, bypassedControl, streamed}`. Both live rows are unexplained. | `stream.ts`; live audit query |
| **F-15** | 🟠 | **The live control state has no audit provenance.** Two jobs are paused in production and no `cron_pause` row exists, because the pauses were written by the seed script. An auditor cannot tell who stopped `gsc-sync`. | live audit query; `scripts/seed_cron_control.mjs` |

### D. Usability and UI

| # | Sev | Finding |
|---|---|---|
| **F-16** | 🟠 | **The page never refreshes and does not say how old it is.** `load()` runs on mount and after a mutation. The only freshness signal is "Last Checked", which is the *probe's* timestamp, not the page's. |
| **F-17** | 🟠 | **Run counts are misleading.** The row renders `health.totalRuns`, which counts every recorded outcome including `disabled` and `shed`, so a paused job advertises ~288 "runs". The honest split is already in the payload as `health.outcomes`. |
| **F-18** | 🟠 | **Failures are invisible.** `outcomes.failed` is fetched and never rendered — the single most operationally important number on the page. |
| **F-19** | 🔵 | **The schedule shown is seeded prose, not the cron expression the Worker uses.** `info.schedule` comes from the D1 catalog and can drift from `wrangler.toml`; the real expression is derivable from the registry arrays. |
| **F-20** | 🔵 | **No last-run time and no next-tick estimate per job**, though `health.lastSeen` is already in the payload. |
| **F-21** | 🟠 | **No interval UI at all**, so the throttle documented in the registry row for `#pause` is API-and-seed-only. |
| **F-22** | 🟠 | **A halt cannot expire.** An incident halt left on silently stops the Access whitelist sync and booking retries; a pause can lapse, a halt cannot. |
| **F-23** | 🔵 | **No search, filter, sort or deep link** to a job — 11 rows today and growing. |
| **F-24** | 🔵 | **A11y gaps:** the pause drawer does not move focus to its reason field or restore it on close, the streaming trace region is not announced, and the skeleton shimmer ignores `prefers-reduced-motion`. |

### E. Drift and dead code

| # | Sev | Finding |
|---|---|---|
| **F-25** | 🔵 | `runJob.ts` and `control.ts` still claim the control row is "the 13th key on a query this tick already makes". It is not — `readControl` issues its own `SELECT`. The doc was corrected on 2026-09-19; the comments were not. |
| **F-26** | 🔵 | `registry.ts` and `tiers.ts` claim a job without a tier or budget is a compile error. `JobDefinition.id` is `string`, so `JobId` widens to `string` and `Record<JobId, JobTier>` enforces nothing; `test/cron-contract.test.ts` is what actually catches it. |
| **F-27** | 🔵 | `stream.ts` claims it "honours the lease … a manual run must not race a scheduled tick" (see F-10). |
| **F-28** | 🔵 | `FIFTEEN_MIN_JOBS` is an exported empty array kept "for one release" during chunk 7. Chunk 8 shipped. |
| **F-29** | 🔵 | `CRON-CONTROL.md` §1 cites a `MAINTENANCE.md` triage row for the sync defect that was never written. |

## 3. The permission model this surface should have

### 3.1 Target matrix

Stored vocabulary in brackets, because the database still holds the pre-rename words.

| Key | Baseline today | Baseline proposed | vendor_support | owner | admin | manager / staff |
|---|---|---|---|---|---|---|
| `/dashboard/cron` | admin [`super_admin`] | unchanged | bypass | bypass | allow | deny |
| `#pause` | owner [`owner`] | unchanged | bypass | bypass | deny, grantable | deny |
| `#trigger` | vendor_support [`dev`] | **owner [`owner`]** | bypass | bypass | deny, **grantable** | deny |
| `#configure` | vendor_support [`dev`] | **owner [`owner`]** | bypass | bypass | deny, **grantable** | deny |

The change grants nobody anything by itself: an admin is level 2 and still fails
`2 <= 1`, so every baseline decision is identical. What changes is that Gate D
stops refusing the owner's grants, which is the behaviour the feature doc already
describes.

### 3.2 Three rules the code must follow

1. **A page check and an action check, always both.** Already true here via
   `denyCron`; keep it, and keep the helper in `src/lib/auth/surface-guards.ts`
   so the next surface inherits it.
2. **An action fails closed.** For the three cron fragments, a key that resolves
   `unknown` must deny, not pass. Page-level semantics stay as they are —
   `requirePageAccess`'s permissive `unknown` is load-bearing for the rest of the
   portal and is not in scope to change globally.
3. **The registry rows are a CI invariant, not a hope.** The four rows, active,
   with non-null icons and the expected roles, are asserted in the migration
   replay test. `0054` is exactly the failure this catches.

### 3.3 What the operator sees

A control the viewer may not use is **rendered disabled with the key named**
("Requires `/dashboard/cron#pause`"), not hidden. Hiding is why the model is
invisible; naming the key is what makes an access review possible. A small
"Your access" summary in the header states the three capabilities plainly.

## 4. Delivery phases

Each task names its verification. `npm run verify` runs before every push
(`RULESAd.md` §12), and a push does **not** apply migrations — `npm run release`
from a workstation does.

### Phase 0 — permissions (F-1, F-2, F-3, F-4)

| Task | Change | Files |
|---|---|---|
| **P0-1** | Migration `0056_cron_action_roles.sql`: `UPDATE admin_pages SET required_role = 'owner' WHERE path IN ('/dashboard/cron#trigger','/dashboard/cron#configure')`. Data only, no schema change. Ledger row in the same commit (RULE #0.7). | `migrations/0056_cron_action_roles.sql`, `documentation/reference/schema-change-ledger.md` |
| **P0-2** | `denyCron` gains fail-closed action semantics: the three fragment keys must resolve `allow` for a non-bypass role. Implemented in `surface-guards.ts` so `denySessions` can adopt it later without a second copy of the reasoning. | `src/lib/auth/surface-guards.ts` |
| **P0-3** | Capability flags require an explicit allow (`=== 'allow'`). | `src/pages/dashboard/cron/index.astro` |
| **P0-4** | Gate the forced probe on `capabilities.trigger`; add a permission-free **Refresh** that re-fetches `/api/cron`. | `CronDashboard.tsx` |
| **P0-5** | Assert the four registry rows in the migration replay test — present, active, non-null icon, expected `required_role`. | `test/migrations-replay.test.ts` |
| **P0-6** | Extend `test/cron-permissions.test.ts`: an unknown action key denies; a page deny still beats an action grant; the owner can now grant `#trigger` (Gate D arithmetic). | `test/cron-permissions.test.ts` |

*Verification:* `npx vitest run test/cron-permissions.test.ts test/cron-api.test.ts test/migrations-replay.test.ts`, then the full `npm run verify`. Apply `0056` with `npx wrangler d1 migrations apply madagascar-db --local` first; production goes through `npm run release`.
*Rollback:* `0057` restoring `dev` on the two rows; P0-2/P0-3 are single-expression reverts.

### Phase 1 — control-plane correctness (F-8 to F-15)

| Task | Change | Files |
|---|---|---|
| **P1-1** | `state.ts` merges into the previous entry instead of rebuilding it, so `intervalMinutes` survives a pause/resume. Resume clears `reason`/`until` explicitly. | `src/pages/api/cron/state.ts` |
| **P1-2** | `stampIntervalClocks` writes the **same** `rev` (CAS still on the current value), so a machine clock write no longer invalidates an operator's token. A human write in between still wins; a lost stamp is already tolerated by design. | `src/lib/jobs/runJob.ts` |
| **P1-3** | Forced probe refuses inside 60 s of the last reading and returns the current read model with "last probed N s ago" rather than a second GraphQL call. | `src/pages/api/cron/sync.ts` |
| **P1-4** | `POST /api/cron/sync` writes a `cron_sync` audit row and stamps `updated_by` with the actor's email. | `src/pages/api/cron/sync.ts`, `src/workers/scheduled-usage-probe.ts` |
| **P1-5** | Extract `buildCronReadModel(env, db, now)`; `/api/cron` and `/api/cron/sync` both call it. | new `src/lib/jobs/read-model.ts`, both routes |
| **P1-6** | Optional reason on a manual run, carried into the `cron_trigger` audit row. | `RunConsole.tsx`, `stream.ts` |
| **P1-7** | Declare `leaseSeconds` on `asset-cleanup`, `staff-storage-reconcile` and `cf-access-reconcile`; state in the registry comment why the five-minute jobs stay leaseless. Correct the `stream.ts` docblock. | `src/lib/jobs/registry.ts`, `stream.ts` |
| **P1-8** | `seed_cron_control.mjs --apply` writes an audit row naming the operator, so a seeded pause has provenance. | `scripts/seed_cron_control.mjs` |

*Verification:* new cases in `test/cron-api.test.ts` (interval survives a resume; the throttled sync returns 200 without probing; sync audits) and `test/cron-control-gate.test.ts` (a stamp leaves `rev` unchanged and a human write still conflicts correctly).

### Phase 2 — usability (F-5, F-7, F-16 to F-20, F-24)

| Task | Change |
|---|---|
| **P2-1** | Honest run counts: "288 ticks · 0 executed · 0 failed" from `health.outcomes`, replacing the bare `totalRuns` chip. |
| **P2-2** | A failure badge per row when `outcomes.failed > 0`, and a header tile counting jobs with failures in 24 h. |
| **P2-3** | "Data as of HH:MM:SS", a Refresh button (from P0-4) and an opt-in 60 s auto-refresh remembered in `localStorage`, default off. |
| **P2-4** | Last run (`health.lastSeen`) and next tick per row. |
| **P2-5** | The true cron expression per job, derived from the registry arrays in the read model, rendered beside the catalog prose. |
| **P2-6** | Disabled-with-reason controls and a "Your access" header summary (§3.3). |
| **P2-7** | A11y: focus into the pause drawer and back on close, `aria-live="polite"` on the trace region, `prefers-reduced-motion` on the skeleton. |

*Verification:* `npm run a11y_check` plus a component test for the counts split; no figure may render as `0` where the source is unavailable (RULE #0.5).

### Phase 3 — features (F-21, F-22, F-23)

| Task | Change |
|---|---|
| **P3-1** | **Interval control** in the pause drawer, gated on `#pause`, with a plain-English preview and "every tick" as the reset. Closes the documented API-and-seed-only gap. |
| **P3-2** | **Halt with an expiry** — `haltUntil` in the control document, lapsing in `decideJobRun` exactly as a pause does, with the banner naming the auto-resume time. |
| **P3-3** | Filter box, status chips and a `?job=<id>` deep link that expands a row. |
| **P3-4** | A "what sheds if usage reaches the threshold" preview on the quota card, computed from the tiers already in the payload. |

### Phase 4 — drift and cleanup (F-25 to F-29)

Correct the four stale code comments, narrow `JobDefinition.id` so the
tier/budget claim becomes true (or correct the comment), delete
`FIFTEEN_MIN_JOBS`, and update `CRON-CONTROL.md` §1/§2/§7 plus a `MAINTENANCE.md`
row pointing at this plan.

## 5. Data, schema and cost

- **One migration, data only:** `0056_cron_action_roles.sql` — two `UPDATE`s on
  `admin_pages`. No new table (RULE #0.9), no new environment variable
  (RULE #0.8), no new KV namespace or binding (RULE #0.6). Numbering follows
  RULE #0.7b: cf-admin owns `0033`+ and `0055` is the current highest.
- **No new storage anywhere else.** Every new field (`haltUntil`, the per-job
  interval) lives in the existing `cron-control` row in `admin_portal_settings`;
  the auto-refresh preference lives in the browser.
- **Cost per tick is unchanged.** P1-2 does not add a write — it changes the
  value written. P1-3 *removes* Cloudflare calls. P2-3's auto-refresh is opt-in
  and costs 2 row reads plus one Analytics Engine query per refresh, only while
  a tab is open with it enabled.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Fail-closed actions (P0-2/P0-3) lock out a grantee if a registry row is ever deactivated | P0-5 makes the rows a CI invariant; owner and vendor support bypass regardless; the failure mode is a refused action, not a broken page |
| `0056` changes a `required_role` that an existing override depends on | Verified live: zero overrides reference any cron key |
| P1-2 lets a human write overwrite a fresh clock stamp | Already the documented tolerance — a lost stamp means a job runs sooner, never that it stops; the next tick re-stamps |
| A lease (P1-7) blocks a legitimate manual run | Leases are declared only on the weekly and change-gated jobs; the run console already reports `leaseHeld` in its `done` event |

## 7. Decisions needed from the owner

| # | Decision | Recommendation |
|---|---|---|
| **D-1** | Move `#trigger` and `#configure` to the `owner` baseline so the owner can delegate them? | **Yes.** It changes no baseline decision and restores the documented intent. The alternative is to accept that only vendor support can delegate them, and correct the feature doc instead. |
| **D-2** | Should the plain refresh be permission-free? | **Yes** — it re-reads the page's own data and costs 2 rows. The forced Cloudflare probe stays on `#trigger`. |
| **D-3** | Should an admin get `#pause` by baseline rather than by grant? | **No.** Keep the deny-by-default posture; the owner can grant it per person once D-1 lands. |
| **D-4** | Auto-refresh default | **Off**, opt-in per browser. |

## 8. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-09-20 | claude | Full read of the cron surface at HEAD `1f8cfc3`; live D1 queries via the Cloudflare MCP connector for `admin_pages`, `admin_portal_settings`, `admin_page_overrides` and `admin_audit_log`; Gate D arithmetic traced through `src/pages/api/users/access.ts` and `ROLE_LEVEL` | 29 findings recorded. Load-bearing: the owner cannot grant `#trigger`/`#configure` (F-1), the action guard and capability flags both fail open on a missing row (F-2/F-3), a pause erases an interval (F-8), and the tick's clock write invalidates the dashboard's CAS token at rev 179 (F-9) |
