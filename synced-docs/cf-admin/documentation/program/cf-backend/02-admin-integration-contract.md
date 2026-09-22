---
title: "cf-backend — 02 cf-admin integration contract"
status: draft
audience: [ai, technical, owner]
owner: harshil
related_docs: [README.md, 01-architecture.md, 06-roadmap.md, ../../features/CRON-CONTROL.md, ../../architecture/PERMISSIONS-SYSTEM.md]
tags: [program, cf-backend, contract, rpc, permissions, cron]
---

# 02 — How cf-admin "loads" cf-backend, and why it cannot break

The requirement: *changes in cf-backend show up in cf-admin automatically (triggers,
commands, execution, UI), and the integration never breaks.* Both halves are
achievable, but only if we are precise about what "automatic" means.

## 1. The model: server-driven UI with a closed vocabulary

cf-backend never ships JavaScript, HTML or CSS into cf-admin. It ships **data**: a
manifest that describes its capabilities and how to present them, using a fixed set of
view primitives that **cf-admin owns and renders with its own design system**.

| Changes in cf-backend… | …appear in cf-admin without a cf-admin deploy? |
|---|---|
| A new job or command, its inputs, labels, help text, danger level, required role | **Yes** |
| New status fields, a new table column, a new report section | **Yes**, if expressed with existing primitives |
| A new *kind* of widget (a primitive cf-admin does not know) | **No.** cf-admin shows "This view needs a newer cf-admin" and keeps working; the primitive ships in a cf-admin release |
| Rich feature UI (the Staff Storage file manager) | **No, by design.** It stays hand-built in cf-admin over a typed RPC API (doc 04) |

**Rejected alternative: loading cf-backend's UI as remote JavaScript** (web components,
iframes, `<script src=storage.…>`). It would give the operations plane the power to
execute arbitrary code inside the admin origin, where the SSO session, CSRF token and
every privileged API live. A compromise of the lower-privilege public Worker would become
a compromise of the admin portal. It would also require widening the CSP. Never do it.

## 2. The manifest

`BackendRPC.manifest()` returns one JSON document. The authoritative schema is
`contract/manifest.schema.json` in cf-backend; a trimmed example:

```json
{
  "contract": { "major": 1, "minor": 3 },
  "build": { "sha": "a1b2c3d4e5f6", "deployedAt": "2026-10-04T09:00:00Z" },
  "capabilities": [
    {
      "id": "db-backup.run",
      "group": "backups",
      "title": "Run a backup now",
      "kind": "action",
      "runner": "github",
      "minRole": "owner",
      "plac": "/dashboard/backend#backup-run",
      "danger": "confirm-typed",
      "cooldownSeconds": 21600,
      "input": {
        "type": "object",
        "properties": { "scope": { "type": "string", "enum": ["full", "supabase"] } },
        "required": ["scope"]
      },
      "result": { "view": "run-handle" }
    },
    {
      "id": "db-backup.runs",
      "group": "backups",
      "title": "Backup history",
      "kind": "query",
      "minRole": "admin",
      "plac": "/dashboard/backend#backup-history",
      "result": { "view": "table", "columns": ["startedAt", "scope", "outcome", "sizes", "verdict"] }
    }
  ]
}
```

**View primitives (v1 vocabulary, owned by cf-admin):** `stat-row`, `table`,
`timeline`, `log`, `markdown-report` (rendered through cf-admin's sanitizer, never raw
HTML), `artifact-list`, `run-handle` (live status with polling), `form` (generated from
the JSON-Schema `input`), `confirm` (`plain` | `confirm-typed`). Adding a primitive is a
**minor** contract bump shipped by cf-admin *first*.

## 3. The RPC surface

```ts
export class BackendRPC extends WorkerEntrypoint<Env> {
  manifest(): Promise<Manifest>;
  health(): Promise<{ ok: boolean; contract: ContractVersion; checks: Check[] }>;
  invoke(actor: Actor, capabilityId: string, input: unknown): Promise<Envelope>;
  // typed domain APIs for hand-built UIs (Staff Storage, doc 04):
  storage: StorageApi;
}

type Actor = { userId: string; email: string; role: CanonicalRole; grants: string[]; sessionId: string };
type Envelope =
  | { ok: true; data: unknown; runId?: string }
  | { ok: false; code: ErrorCode; message: string; retryable: boolean };
```

- **One generic entry point (`invoke`)** means a new capability needs no new cf-admin API route and no new PLAC plumbing. cf-admin has one route, `POST /api/backend/invoke`, which calls it.
- **Typed domain APIs** (`storage.*`) exist only where a hand-built UI needs them.
- **Errors never throw across the boundary.** Every method returns an `Envelope`. `ErrorCode` is a closed union (`forbidden`, `cooldown`, `invalid_input`, `upstream_unavailable`, `not_found`, `conflict`, `contract_mismatch`, `internal`).
- **Coarse-grained calls only** (factor A4). Service-binding CPU is summed across both Workers and each call is a subrequest (50 per request on Free), so it is one RPC per user action or page load, with batching inside cf-backend. No RPC inside loops; a cf-admin test counts RPC calls per route.
- **Every envelope carries a meter** (factor C2): `meter: { queries, rowsRead, rowsWritten }`, summed from D1 `meta` inside cf-backend, so cf-admin's job runner keeps enforcing D1 budgets for jobs that moved.
- **The manifest is cached per isolate for 60 s**, keyed by `build.sha` (factor C5).
- **Correlation:** cf-admin sends a request id with the actor; cf-backend tags its Sentry events (`release = cf-backend@<sha>`) and logs with it (factor D10).

## 4. Permissions: cf-admin decides, cf-backend double-checks

1. **Identity stays in cf-admin.** Access JWT → session → role → PLAC access map, exactly as today. cf-backend has no login and trusts no header.
2. **The binding is the caller identity.** Only Workers that carry a `[[services]]` binding to `cf-backend` can call `BackendRPC`, and only the account owner can add a binding. This replaces the pattern cf-chatbot uses today (a shared literal header), which must not be copied.
3. **cf-admin enforces the page and fragment keys.** A manifest capability names its PLAC key; cf-admin checks **both** `/dashboard/backend` and the capability's `#fragment` in one central guard (the D-4 lesson: fragment keys do not inherit a parent deny).
4. **Role floors by danger level, then optional delegation** (revised after factor C1). Today `requirePageAccess` permits every role when a key has no `admin_pages` row, which would make a brand-new capability open to everyone. The first draft's answer (deny until a migration seeds the row) would break "new capabilities appear automatically". The final rule:
   - cf-admin enforces a **floor per kind/danger**: `query` → admin, `action` → owner, `confirm-typed` → owner. The manifest's `minRole` may **raise** a floor, never lower it.
   - A capability with **no** `admin_pages` row is available to exactly the floor roles, and to nobody else. It is never "unknown → allow".
   - **Delegating** a capability to a specific user below the floor needs its row. The owner creates it with one click ("Allow delegation") in the backend console, which writes the row through the existing pages admin. No migration, no cf-admin release.
   - A test in cf-admin proves an unseeded capability is denied to every role below its floor.
5. **cf-backend re-checks `minRole`** against `actor.role` (defense in depth, in case the admin-side guard is ever misconfigured) and enforces cooldowns and idempotency itself.
6. **Audit stays in one place.** cf-admin writes `admin_audit_log` for every `invoke` of an `action` (actor, capability, input with redaction, envelope outcome, cf-backend `runId`) through the existing `buildAuditDetails` chokepoint.

## 5. The cron control page: a new job kind, not a new cron

`/dashboard/cron` today lists the Worker jobs run by cf-admin's `*/5` tick. Backend
jobs join it as a second kind:

| | `kind: 'worker'` (existing) | `kind: 'external'` (new) |
|---|---|---|
| Who schedules it | cf-admin's `*/5` tick + `decideJobRun()` | The **GitHub schedule** in the cf-backend repo |
| Cron triggers used | Shared `*/5` | **None** |
| Pause / disable | `cron-control` row | cf-backend calls GitHub `PUT …/actions/workflows/{id}/disable` / `enable`, so the state lives where the schedule lives |
| Run now | Existing trigger action | `invoke('db-backup.run')`: owner only, 6 h cooldown, typed confirmation (OD-6) |
| History | Analytics Engine rows | R2 manifests + Analytics Engine data point |
| Tier (`tiers.ts`) | `essential` / `sheddable` | `external`: never sheddable, never dispatched by the tick |

Core changes this requires in cf-admin (all small, all tested):

- `JobId` / tier types gain the `external` kind, and `decideJobRun()` refuses to dispatch it. This is a compile-time guarantee that the tick can never run a backup.
- The cron page reads backend jobs from the manifest (`group: "backups"`) and merges them into its list; its catalog row (`cron-job-catalog`) is not used for them, because the manifest carries the wording.
- One new essential Worker job, `backend-reconcile` (daily, lease-gated), calls `invoke('db-backup.reconcile')`. That lets cf-backend pull new manifests from R2 and update `backend:backup-status`. The tick's existing batched settings read gains that one key for the dead-man's switch (+1 row read per tick, 0 extra queries).

### 5.1 The readiness panel (P-14, OD-14)

The existing backup workflow failed silently for six days, because nothing showed that
its secrets did not exist. The backend console therefore opens with a **readiness
panel**, served by the `backups.readiness` query capability (floor: admin):

| Check | Source | Never shows |
|---|---|---|
| Each required GitHub secret: present / absent, last updated | GitHub REST "list repository secrets" (names and dates only) with `Secrets: read` on the GitHub App (OD-17) | Secret values (the API cannot return them) |
| Token and key health: Cloudflare token expiry, GitHub App status, backup key (last rotation, weekly key-check result, recovery-kit confirmations) | `backend:secrets-calendar` + `backend:key-registry` (doc 09) | — |
| Workflow enabled / disabled, last run, last `ok` run, age | GitHub API + `backend:backup-status` | — |
| Bucket lock rules present on `v1/runs/full/` and `v1/runs/daily/` | R2 bucket-lock configuration read | — |
| Pending owner steps for the current phase | The phase's chunk record (P-21), mirrored into `backend:readiness-notes` | — |

A red row on this panel is the first signal, days before the dead-man's switch would fire.

## 6. "Never break it": the rules and the machinery

| # | Rule | Enforced by |
|---|---|---|
| 1 | **Semver contract.** cf-admin accepts the same `major`, any `minor`; unknown fields are ignored; unknown primitives render a placeholder | Parser tests in cf-admin over fixtures of every minor |
| 2 | **Expand → migrate → contract.** cf-backend adds before it removes; a field or capability is removed only one release *after* cf-admin stops using it | Consumer fixtures (below) + review checklist |
| 3 | **Consumer-driven contract tests.** cf-admin keeps `test/fixtures/backend-contract/*.json` (the calls it makes and the shapes it reads). cf-backend vendors them via `npm run contract:sync` and its `verify` fails if any fixture breaks | Both repos' `verify` |
| 4 | **Schema drift check.** cf-backend's manifest must validate against `manifest.schema.json`, and cf-admin's vendored copy must hash-match | `contract:check` in both `verify` chains |
| 5 | **Runtime mismatch is visible, not fatal.** `health()` returns the contract version; cf-admin shows a banner on a major mismatch and disables actions (queries still render) | cf-admin health tab + test |
| 6 | **Timeouts and envelopes everywhere.** RPC wrapper: 10 s default, typed errors, no throw into render | Wrapper unit tests |
| 7 | **The public router is a closed table.** A test enumerates every public path and fails on any addition without a matching allow-list entry | cf-backend `test/public-surface.test.ts` |
| 8 | **Deploy order.** cf-backend deploys first (the binding target must exist); cf-admin second. Rollback is the reverse | Runbook in doc 06 |
| 9 | **The deploy runs the gate.** Workers Builds for cf-backend runs `npm run verify` before `wrangler deploy` | Configured in Phase 0 (OD-10) |
| 10 | **Post-deploy smoke.** After a cf-backend deploy, cf-admin's backend health tab calls `health()` and `manifest()`; the owner checks it (no browser automation) | Runbook |
| 11 | **Local dev and tests never need the real backend** (factor C3). cf-admin's tests bind `BACKEND` to a miniflare stub that answers from the consumer fixtures; local dev runs cf-backend in its own `wrangler dev` and resolves it through the dev registry (to verify in Phase 2a) | cf-admin test setup |

What this does **not** promise: a change that breaks the semantics while keeping the
shape (e.g. a job that "succeeds" without doing its work). That is what the backup
verification rules in doc 03 §5 exist for.
