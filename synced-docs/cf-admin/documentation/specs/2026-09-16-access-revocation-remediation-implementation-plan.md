---
title: "Access Revocation Remediation — Implementation Plan"
status: draft
audience: [ai, technical, owner]
last_verified: 2026-09-16
verified_against: [code]
owner: harshil
related_code: [src/lib/auth/plac.ts, src/lib/auth/session.ts, src/lib/auth/pipeline.ts, src/lib/auth/stages/session-stage.ts, src/lib/auth/stages/refresh-role.ts, src/lib/auth/stages/bootstrap.ts, src/lib/auth/surface-guards.ts, src/lib/auth/cf-access-reconcile.ts, src/pages/api/users/manage.ts, src/pages/api/users/access.ts, src/pages/api/users/force-kick.ts, src/pages/api/sessions/active-sessions.ts, src/pages/api/system/pages.ts, src/pages/index.astro]
related_docs: [./2026-09-16-access-revocation-remediation-design.md, ../architecture/PERMISSIONS-SYSTEM.md, ../features/SESSION-MANAGEMENT.md, ../program/ROADMAP.md, ../../RULESAd.md]
tags: [auth, sessions, revocation, plac, incident, plan]
---

<!-- docs-check: proposed-paths -->
<!-- This is a plan. It names files each task will create; the code-path check
     is opted out here and enforced on the chunk records once each stage ships. -->

# Access Revocation Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A permission change never locks anyone out, a lockout is never invisible, and deactivating an account is the only way to keep someone out.

**Architecture:** A new `authz-changed:<userId>` KV mark, read in the session stage's existing bulk read, makes a live session re-verify its role and page map against Supabase and D1 on its next request. That replaces every "sign the user out so their permissions refresh" call. Sign-out no longer writes a user-level sign-in block, so `revoked:<userId>` is retired from every reader and writer. One pure function decides who may act on whom, including a last-active-Owner guard.

**Tech Stack:** Astro 7 SSR, Preact 10 islands, TypeScript strict, Workers KV (bulk `get(keys[])`), D1, Supabase (supabase-js), Vitest 4 under `@cloudflare/vitest-pool-workers` 0.22.

**Spec:** [`2026-09-16-access-revocation-remediation-design.md`](./2026-09-16-access-revocation-remediation-design.md). Defect IDs (D1–D14) and decision IDs (OD-1–OD-5) below refer to it.

## Global Constraints

Every task's requirements implicitly include this section.

- **Stage 0 is done by the owner before any code:** lift the Owner's block from the vendor account → Sessions → **Active Edge Blocks** tab → Lift Block. Do not delete `revoked:[D1_DATABASE_UUID]` from a script.
- **Shared checkout.** `E:\1\Madagascar Project\cf-admin` is used by a concurrent session. Execute in a worktree: `git fetch && git worktree add .claude/worktrees/access-revocation -b fix/access-revocation origin/main` (inside `cf-admin`, so Node resolves `node_modules` upward; never junction `node_modules`, and never `git worktree remove --force` a tree containing a junction). Stage explicit files only, never directories.
- **RULE #0.5** — no invented data. Every count and message states what actually happened (for example `accessRevoked: false` when Cloudflare did not confirm).
- **RULE #0.6 / #0.8 / #0.9** — no new D1 table, KV namespace, or environment variable. The new KV key lives in the existing `SESSION` namespace.
- **RULE #0.7 / #0.7b** — the only migration is `0056` in Task 9 and it needs the owner's sign-off before it is applied. Three artifacts: the file, the applied migration, a row in `documentation/reference/schema-change-ledger.md`. Freeze with `node scripts/migrations_manifest.mjs`.
- **SEC-03** — no new raw `.prepare(` in `src/pages/api/**`. **SEC-05** — `getEnv(context)` only. **SEC-06 / SEC-07** — no new API route; `/api/sessions/*` stays mapped by prefix.
- **Error-code contract** — `test/error-code-contract.test.ts` matches only literal `?error=<code>` strings in `src/`. Never build a redirect code with a template, and never leave a retired code in a comment.
- **Ratchet** — `npm run ratchet` must pass. A rise needs `python scripts/ratchet.py --update --reason "<why>"`. **Never run `--update` with `--no-eslint`**: it writes a baseline missing A1/A1b/A1c. A new file must land in the same commit as its first importer (A17); a route must not outlive its UI (A18).
- **KV budget (Workers Free, verified 2026-09-16)** — 100,000 reads/day, 1,000 writes/day, 1,000 lists/day; bulk reads are billed per key. Do not add a per-request `kv.list`.
- **Commits** end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- **Single-file test run:** `npx vitest run test/<file>.test.ts`. **Full gate:** `npm run verify`.

---

## Stage 1 — Stop the lockouts

Ships on its own. After it deploys, no permission change can lock anyone out, and a Supabase blip cannot either.

### Task 1: The authorization-change mark and warm-session re-verification

Covers D1 (mechanism), D4 (outage handling), OD-2.

**Files:**

- Create: `src/lib/auth/authz-signal.ts`
- Modify: `src/lib/auth/session.ts` (two exported timing helpers, one session field)
- Modify: `src/lib/auth/stages/session-stage.ts` (whole file)
- Modify: `src/lib/auth/pipeline.ts:35-40`
- Modify: `src/lib/auth/stages/refresh-role.ts` (whole file)
- Test: `test/authz-signal.test.ts` (create), `test/pipeline-session.test.ts` (modify)

**Interfaces:**

- Produces: `authzChangedKey(userId: string): string`; `markAuthzChanged(kv: KVNamespace, userIds: readonly string[], env: Pick<CfEnv, 'SESSION_MAX_LIFETIME_MS'>): Promise<void>`; `isAuthzStale(mark: string | null, sessionMark: string | undefined): boolean`; `sessionLifetimeSeconds(env): number`; `roleRecheckIntervalMs(env): number`; `AdminSession.authzMark?: string`; `KnownSession { session: AdminSession; authzMark: string | null }`; `refreshRole(context, env, known: KnownSession, pathname: string)`.

- [ ] **Step 1: Write the failing unit test**

Create `test/authz-signal.test.ts`:

```ts
// test/authz-signal.test.ts
/**
 * The mark that replaces "sign the user out so their permissions refresh"
 * (access revocation remediation, design §4.1). A mark must be new on every
 * change, because a session re-verifies only when the value differs from the
 * one it stored.
 */
import { describe, it, expect } from 'vitest';
import { env } from './fixtures/env';
import { authzChangedKey, isAuthzStale, markAuthzChanged } from '../src/lib/auth/authz-signal';

describe('markAuthzChanged', () => {
  it('writes one mark per distinct user, and a different mark on the next change', async () => {
    await markAuthzChanged(env.SESSION, ['mark-u1', 'mark-u2', 'mark-u1'], env);
    const first = await env.SESSION.get(authzChangedKey('mark-u1'));
    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await env.SESSION.get(authzChangedKey('mark-u2'))).toMatch(/^[0-9a-f-]{36}$/);

    await markAuthzChanged(env.SESSION, ['mark-u1'], env);
    expect(await env.SESSION.get(authzChangedKey('mark-u1'))).not.toBe(first);
  });
});

describe('isAuthzStale', () => {
  it('is false when no change is recorded', () => {
    expect(isAuthzStale(null, undefined)).toBe(false);
    expect(isAuthzStale(null, 'm1')).toBe(false);
  });

  it('is true for a mark the session has not stored yet', () => {
    expect(isAuthzStale('m2', 'm1')).toBe(true);
    expect(isAuthzStale('m2', undefined)).toBe(true);
  });

  it('is false once the session has stored the mark', () => {
    expect(isAuthzStale('m2', 'm2')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/authz-signal.test.ts`
Expected: FAIL — `Failed to resolve import "../src/lib/auth/authz-signal"`.

- [ ] **Step 3: Add the session timing helpers and the session field**

In `src/lib/auth/session.ts`, add to `interface AdminSession` directly after `accessMap?: PageAccessMap;`:

```ts
  /**
   * The `authz-changed:` mark this session last re-verified against
   * (authz-signal.ts). A different mark in KV means an administrator changed
   * this user since, and the next request re-reads role and page map.
   */
  authzMark?: string;
```

Change the `patchSession` parameter type from
`Partial<Pick<AdminSession, 'role' | 'lastRoleCheckedAt' | 'accessMap' | 'displayName' | 'lastActiveAt'>>`
to
`Partial<Pick<AdminSession, 'role' | 'lastRoleCheckedAt' | 'accessMap' | 'displayName' | 'lastActiveAt' | 'authzMark'>>`.

Add directly after `function getSessionTiming(...) { ... }`:

```ts
/** Session lifetime in whole seconds, floored at 60 — the TTL of every per-session KV key. */
export function sessionLifetimeSeconds(env: Pick<CfEnv, 'SESSION_MAX_LIFETIME_MS'>): number {
  const maxLifetime = parseInt(env.SESSION_MAX_LIFETIME_MS ?? '') || DEFAULT_MAX_LIFETIME;
  return Math.max(60, Math.floor(maxLifetime / 1000));
}

/** How often a warm session re-reads its role from the directory. */
export function roleRecheckIntervalMs(env: Pick<CfEnv, 'SESSION_REFRESH_INTERVAL_MS'>): number {
  return parseInt(env.SESSION_REFRESH_INTERVAL_MS ?? '') || DEFAULT_ROLE_RECHECK_INTERVAL;
}
```

- [ ] **Step 4: Create the signal module**

Create `src/lib/auth/authz-signal.ts`:

```ts
/**
 * The authorization-change mark (access revocation remediation, stage 1).
 *
 * Until 2026-09-16 a change to a user's page access or role was made to take
 * effect by signing the user out with forceLogoutUser, which also wrote a
 * 24-hour sign-in block. That stranded the only Owner for more than 14 hours
 * (documentation/specs/2026-09-16-access-revocation-remediation-design.md).
 *
 * A change now writes a random mark under `authz-changed:<userId>`. The session
 * stage reads the mark in the same bulk KV read as the revocation flags, and a
 * live session whose stored mark differs re-verifies role and page map against
 * Supabase and D1 on that request, then stores the mark. Nobody is signed out.
 *
 * Call this AFTER the database change has committed. The mark is read before
 * the directory lookup, so a session that stores mark M looked the user up
 * after M existed — and M exists only after the change. Comparing random values
 * instead of timestamps means no two Workers have to agree on the time.
 */
import { sessionLifetimeSeconds } from './session';

export const AUTHZ_CHANGED_PREFIX = 'authz-changed:';

export function authzChangedKey(userId: string): string {
  return `${AUTHZ_CHANGED_PREFIX}${userId}`;
}

export async function markAuthzChanged(
  kv: KVNamespace,
  userIds: readonly string[],
  env: Pick<CfEnv, 'SESSION_MAX_LIFETIME_MS'>,
): Promise<void> {
  // A mark older than the longest session has no session left to act on.
  const expirationTtl = sessionLifetimeSeconds(env);
  await Promise.all(
    [...new Set(userIds)].map((id) => kv.put(authzChangedKey(id), crypto.randomUUID(), { expirationTtl })),
  );
}

/** True when an administrator changed this user after the session last re-verified. */
export function isAuthzStale(mark: string | null, sessionMark: string | undefined): boolean {
  return mark !== null && mark !== sessionMark;
}
```

- [ ] **Step 5: Run the unit test to verify it passes**

Run: `npx vitest run test/authz-signal.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing pipeline tests**

In `test/pipeline-session.test.ts`, replace the three `it(...)` blocks titled
`'an inactive identity revokes: flag written, session destroyed, redirect'`,
`'an unrecognised stored role revokes rather than guessing a privilege level'` and
`'an identity outage (HTTP 500) is indistinguishable from a missing row and revokes the session'`
with the following (the role-change and D1-failure tests in that `describe` stay unchanged):

```ts
  it('an inactive identity ends the session with account_inactive and writes no sign-in block', async () => {
    restore();
    restore = withFetch(identityStub({ users: [{ ...USER, is_active: false }], jwks: keys.jwks })).restore;
    const id = sessionId();
    await putSession(id, { patch: { lastRoleCheckedAt: Date.now() - 31 * MIN } });
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('/?error=account_inactive');
    expect(await env.SESSION.get(`session:${id}`)).toBeNull();
    // Design D4: this stage wrote a 24-hour `revoked:` flag until 2026-09.
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('a missing identity row ends the session with access_denied', async () => {
    restore();
    restore = withFetch(identityStub({ users: [], jwks: keys.jwks })).restore;
    const id = sessionId();
    await putSession(id, { patch: { lastRoleCheckedAt: Date.now() - 31 * MIN } });
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.headers.get('Location')).toBe('/?error=access_denied');
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('an unrecognised stored role ends the session with role_unrecognised', async () => {
    restore();
    restore = withFetch(identityStub({ users: [{ ...USER, role: 'ghost' }], jwks: keys.jwks })).restore;
    const id = sessionId();
    await putSession(id, { patch: { lastRoleCheckedAt: Date.now() - 31 * MIN } });
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.headers.get('Location')).toBe('/?error=role_unrecognised');
    expect(await env.SESSION.get(`session:${id}`)).toBeNull();
  });

  it('an identity outage inside the grace window keeps the session and retries next request (OD-2)', async () => {
    restore();
    restore = withFetch(identityStub({ users: [USER], jwks: keys.jwks, identityStatus: 500 })).restore;
    const id = sessionId();
    const lastGood = Date.now() - 31 * MIN;
    await putSession(id, { patch: { lastRoleCheckedAt: lastGood } });
    const { nextCalls } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(nextCalls).toBe(1);
    // Not stamped, so the very next request asks the directory again.
    expect((await readSession(id))!.lastRoleCheckedAt).toBe(lastGood);
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('an identity outage past the grace window ends the session with recheck_failed and writes no block', async () => {
    restore();
    restore = withFetch(identityStub({ users: [USER], jwks: keys.jwks, identityStatus: 500 })).restore;
    const id = sessionId();
    await putSession(id, { patch: { lastRoleCheckedAt: Date.now() - 61 * MIN } });
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.headers.get('Location')).toBe('/?error=recheck_failed');
    expect(await env.SESSION.get(`session:${id}`)).toBeNull();
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('an API request that fails the re-check gets JSON and Clear-Site-Data, not a redirect', async () => {
    restore();
    restore = withFetch(identityStub({ users: [{ ...USER, is_active: false }], jwks: keys.jwks })).restore;
    const id = sessionId();
    await putSession(id, { patch: { lastRoleCheckedAt: Date.now() - 31 * MIN } });
    const { res } = await runPipeline({ path: '/api/settings/portal', cookies: { admin_session: id } });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Account inactive' });
    expect(res.headers.get('Clear-Site-Data')).toBe('"cookies"');
  });
```

Append a new `describe` at the end of the file:

```ts
describe('authorization-change mark', () => {
  const MARK = `authz-changed:${USER.id}`;
  afterEach(async () => { await env.SESSION.delete(MARK); });

  it('a new mark re-verifies inside the 30-minute window and recomputes the map, without signing out', async () => {
    const id = sessionId();
    await putSession(id, { pages: { '/dashboard': true } });
    await env.SESSION.put(MARK, 'mark-1');
    const { ctx, nextCalls } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(nextCalls).toBe(1);
    expect(ctx.locals.user!.accessMap).toEqual(ADMIN_PAGES);
    const stored = await readSession(id);
    expect(stored!.accessMap!.pages).toEqual(ADMIN_PAGES);
    expect(stored!.authzMark).toBe('mark-1');
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('a mark the session already stored causes no directory lookup', async () => {
    restore();
    const stub = withFetch(identityStub({ users: [USER], jwks: keys.jwks }));
    restore = stub.restore;
    const id = sessionId();
    await putSession(id, { pages: { '/dashboard': true }, patch: { authzMark: 'mark-2' } });
    await env.SESSION.put(MARK, 'mark-2');
    const { nextCalls } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(nextCalls).toBe(1);
    expect(stub.calls.filter((c) => c.url.includes('/rest/v1/'))).toHaveLength(0);
    expect((await readSession(id))!.accessMap!.pages).toEqual({ '/dashboard': true });
  });

  it('a forced re-check that finds the account deactivated ends the session and writes no block', async () => {
    restore();
    restore = withFetch(identityStub({ users: [{ ...USER, is_active: false }], jwks: keys.jwks })).restore;
    const id = sessionId();
    await putSession(id);
    await env.SESSION.put(MARK, 'mark-3');
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.headers.get('Location')).toBe('/?error=account_inactive');
    expect(await env.SESSION.get(`session:${id}`)).toBeNull();
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });

  it('a forced re-check gets no outage grace', async () => {
    restore();
    restore = withFetch(identityStub({ users: [USER], jwks: keys.jwks, identityStatus: 500 })).restore;
    const id = sessionId();
    await putSession(id);
    await env.SESSION.put(MARK, 'mark-4');
    const { res } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
    expect(res.headers.get('Location')).toBe('/?error=recheck_failed');
    expect(await env.SESSION.get(`revoked:${USER.id}`)).toBeNull();
  });
});
```

- [ ] **Step 7: Run them to verify they fail**

Run: `npx vitest run test/pipeline-session.test.ts`
Expected: FAIL — the new cases fail. The deactivated case still redirects to `/?error=access_revoked`, the outage case still writes `revoked:`, and the mark is ignored.

- [ ] **Step 8: Rewrite the session stage**

Replace the whole of `src/lib/auth/stages/session-stage.ts` with:

```ts
/**
 * Stage 2 — the session cookie's KV record, refused when a revocation flag is
 * set, together with the user's authorization-change mark for the re-check
 * stage. `null` means no session: the orchestrator bootstraps from Access.
 */
import type { APIContext } from 'astro';
import { destroySession, getSession, type AdminSession } from '@/lib/auth/session';
import { authzChangedKey } from '@/lib/auth/authz-signal';
import { CLEAR_COOKIES, isApiPath, json, proceed, redirect, type Continue, type Decision } from './decision';

export interface KnownSession {
  session: AdminSession;
  /** The user's `authz-changed:` mark, or null when no change is recorded. */
  authzMark: string | null;
}

export async function resolveSession(
  context: APIContext,
  env: CfEnv,
  pathname: string,
): Promise<Continue<KnownSession | null> | Decision> {
  const session = await getSession(context);
  if (!session) return proceed(null);

  const kv = env.SESSION;
  if (!kv) return proceed({ session, authzMark: null });

  // One bulk read on every warm request, billed per key. The flags are read
  // because a sign-out deletes the session record, but KV is eventually
  // consistent and getSession() keeps a 5-second isolate cache, so they close
  // the window in which an ended session could still be served.
  const sessionFlag = `revoked-session:${session.sessionId}`;
  const userFlag = `revoked:${session.userId}`;
  const markKey = authzChangedKey(session.userId);
  const values = await kv.get([sessionFlag, userFlag, markKey]);

  if (values.get(sessionFlag) || values.get(userFlag)) {
    await destroySession(context);
    return isApiPath(pathname)
      ? json(403, { error: 'Session revoked' }, CLEAR_COOKIES)
      : redirect('/?error=session_revoked');
  }

  return proceed({ session, authzMark: values.get(markKey) ?? null });
}
```

- [ ] **Step 9: Wire the orchestrator**

In `src/lib/auth/pipeline.ts`, replace:

```ts
  const identity = known.value
    ? await refreshRole(context, env, known.value)
    : await bootstrap(context, env, pathname);
```

with:

```ts
  const identity = known.value
    ? await refreshRole(context, env, known.value, pathname)
    : await bootstrap(context, env, pathname);
```

- [ ] **Step 10: Rewrite the re-check stage**

Replace the whole of `src/lib/auth/stages/refresh-role.ts` with:

```ts
/**
 * Stage 3a — re-verify a warm session against the directory.
 *
 * Runs every SESSION_REFRESH_INTERVAL_MS, and at once when an administrator has
 * changed this user since the session last verified (the `authz-changed:` mark,
 * authz-signal.ts). A changed role or a forced re-check recomputes the page
 * map; the session survives.
 *
 * No outcome here writes a sign-in block. The directory row is the authority:
 * a deactivated or deleted user is refused by it at every future sign-in. Until
 * 2026-09-16 this stage wrote a 24-hour sign-in block and treated a Supabase
 * outage as a missing row, so a directory blip locked valid users out for a
 * day (access revocation remediation design, D4).
 *
 * Outage policy (OD-2): while the last good verification is less than two
 * intervals old the session keeps working and the next request retries. After
 * that — or when an administrator's change forced the re-check — the session
 * ends with recheck_failed.
 *
 * Redirect codes are written out literally: test/error-code-contract.test.ts
 * reads them from source and cannot see a template.
 */
import type { APIContext } from 'astro';
import * as Sentry from '@/lib/sentry';
import { createAdminClient } from '@/lib/supabase';
import { normalizeRole } from '@/lib/auth/rbac';
import { computeAccessMap } from '@/lib/auth/plac';
import { destroySession, needsRoleRecheck, patchSession, roleRecheckIntervalMs, type AdminSession } from '@/lib/auth/session';
import { isAuthzStale } from '@/lib/auth/authz-signal';
import { runWithRetry } from '@/lib/auth/login-event';
import { reportOnceCooled } from '@/lib/observability';
import { CLEAR_COOKIES, isApiPath, json, proceed, redirect, type Continue, type Decision } from './decision';
import type { KnownSession } from './session-stage';

interface IdentityRow { role: string; is_active: boolean; display_name: string }

/** PostgREST's code for `.single()` matching no row — an answer, not an outage. */
const NO_ROW = 'PGRST116';
const OUTAGE_REPORT_COOLDOWN_MS = 60 * 60 * 1000;

export async function refreshRole(
  context: APIContext,
  env: CfEnv,
  known: KnownSession,
  pathname: string,
): Promise<Continue<AdminSession> | Decision> {
  const { session, authzMark } = known;
  const forced = isAuthzStale(authzMark, session.authzMark);
  if (!forced && !needsRoleRecheck(session, env)) return proceed(session);

  const api = isApiPath(pathname);
  const end = async (page: Decision, apiStatus: number, apiError: string): Promise<Decision> => {
    await destroySession(context);
    return api ? json(apiStatus, { error: apiError }, CLEAR_COOKIES) : page;
  };

  let row: IdentityRow | null = null;
  let outage: unknown = null;
  try {
    const { data, error } = (await createAdminClient(env)
      .from('admin_authorized_users')
      .select('role, is_active, display_name')
      .eq('id', session.userId)
      .single()) as { data: IdentityRow | null; error: { code?: string; message: string } | null };
    if (error && error.code !== NO_ROW) outage = error;
    else row = data;
  } catch (err) {
    outage = err;
  }

  if (outage) {
    await reportOnceCooled(
      env.DB, 'auth:recheck-directory-unavailable', OUTAGE_REPORT_COOLDOWN_MS,
      'auth.recheck_directory_unavailable', outage, { forced },
    );
    const withinGrace = Date.now() - session.lastRoleCheckedAt < 2 * roleRecheckIntervalMs(env);
    if (withinGrace && !forced) return proceed(session);
    return end(redirect('/?error=recheck_failed'), 503, 'Verification unavailable');
  }

  if (!row) return end(redirect('/?error=access_denied'), 403, 'Access denied');
  if (!row.is_active) return end(redirect('/?error=account_inactive'), 403, 'Account inactive');

  // normalizeRole is the single read boundary between the stored vocabulary
  // and the canonical one; an unrecognised value ends the session rather than
  // guessing at a privilege level.
  const role = normalizeRole(row.role);
  if (!role) return end(redirect('/?error=role_unrecognised'), 403, 'Account role not recognised');

  const verified = {
    lastRoleCheckedAt: Date.now(),
    authzMark: authzMark ?? undefined,
    displayName: row.display_name,
  };
  try {
    if (forced || role !== session.role) {
      const accessMap = await runWithRetry(() => computeAccessMap(env.DB, session.userId, role));
      await patchSession(context, { ...verified, role, accessMap });
      return proceed({ ...session, ...verified, role, accessMap });
    }
    await patchSession(context, verified);
    return proceed({ ...session, ...verified });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[MIDDLEWARE] Access map recompute failed during the re-check:', err);
    return end(redirect('/?error=recheck_failed'), 503, 'Verification unavailable');
  }
}
```

- [ ] **Step 11: Run the pipeline tests to verify they pass**

Run: `npx vitest run test/pipeline-session.test.ts test/authz-signal.test.ts test/error-code-contract.test.ts`
Expected: PASS. `access_revoked` still has an emitter (`bootstrap.ts`), so the contract test is unchanged. If the Workers pool rejects an array passed to `kv.get` (bulk reads need workerd 2025-04 or later; this repo pins `1.20260831.1`), replace the bulk read with `const [a, b, c] = await Promise.all([kv.get(sessionFlag), kv.get(userFlag), kv.get(markKey)])` — billing is per key either way.

- [ ] **Step 12: Typecheck and ratchet**

Run: `npm run typecheck && npm run ratchet`
Expected: both exit 0. If A15 (lines) rises, baseline it with `python scripts/ratchet.py --update --reason "authz-changed mark and outage-aware re-check (access revocation remediation task 1)"`.

- [ ] **Step 13: Commit**

```bash
git add src/lib/auth/authz-signal.ts src/lib/auth/session.ts src/lib/auth/stages/session-stage.ts src/lib/auth/pipeline.ts src/lib/auth/stages/refresh-role.ts test/authz-signal.test.ts test/pipeline-session.test.ts .ratchet.json
git commit -m "fix(auth): re-verify sessions on an authorization-change mark; never block on re-check

A warm session now reads an authz-changed:<userId> mark in its existing bulk
KV read and re-verifies role and page map when the mark is new. The periodic
re-check no longer writes a 24-hour sign-in block, tells a missing row from a
Supabase outage (PGRST116), and gives an outage one interval of grace.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 2: Sign-in refusals say what happened, and the landing page stops signing people out

Covers D9 and D12.

**Files:**

- Modify: `src/lib/auth/stages/bootstrap.ts:48-66`
- Modify: `src/pages/index.astro` (one card added, one script block removed)
- Test: `test/pipeline-bootstrap.test.ts`, `test/error-code-contract.test.ts`

**Interfaces:**

- Produces: redirect code `directory_unavailable`; API `503 { error: 'Directory unavailable' }`; login `failure_reason` `directory_unavailable`.

- [ ] **Step 1: Write the failing tests**

In `test/pipeline-bootstrap.test.ts`, add inside `describe('whitelist', ...)` after the inactive-account test:

```ts
  it('a directory outage at sign-in says so instead of "not authorized" (design D12)', async () => {
    useStub(identityStub({ users: [USER], jwks: keys.jwks, identityStatus: 500 }));
    const api = await runPipeline({ path: '/api/settings/portal', headers: await headersFor(accessClaims()) });
    expect(api.res.status).toBe(503);
    expect(await api.res.json()).toEqual({ error: 'Directory unavailable' });
    const page = await runPipeline({ path: '/dashboard', headers: await headersFor(accessClaims()) });
    expect(page.res.headers.get('Location')).toBe('/?error=directory_unavailable');
    expect((await loginLogRows()).map((l) => l.failure_reason)).toEqual(['directory_unavailable', 'directory_unavailable']);
  });
```

In `test/error-code-contract.test.ts`, add inside `describe('auth error-code contract', ...)`:

```ts
  it('never signs a visitor out of Cloudflare Access without a click (design D9)', () => {
    // Any `/?error=x` link used to end the visitor's Access session, because
    // the landing page fetched the logout endpoint on load for every code.
    const text = readFileSync(LANDING, 'utf8');
    expect(text).not.toMatch(/fetch\(\s*['"`]\/cdn-cgi\/access\/logout/);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/pipeline-bootstrap.test.ts test/error-code-contract.test.ts`
Expected: FAIL — the outage redirects to `/?error=access_denied`, and `index.astro` still contains `fetch('/cdn-cgi/access/logout'`.

- [ ] **Step 3: Distinguish an outage at sign-in**

In `src/lib/auth/stages/bootstrap.ts`, replace:

```ts
  const { data: row } = (await createAdminClient(env)
    .from('admin_authorized_users')
    .select('id, role, is_active, display_name')
    .eq('email', email.toLowerCase())
    .single()) as { data: WhitelistRow | null };

  if (!row || !row.is_active) {
```

with:

```ts
  const { data: row, error: lookupError } = (await createAdminClient(env)
    .from('admin_authorized_users')
    .select('id, role, is_active, display_name')
    .eq('email', email.toLowerCase())
    .single()) as { data: WhitelistRow | null; error: { code?: string } | null };

  // PGRST116 is PostgREST's "no row", a real answer. Anything else means the
  // directory could not be asked, which says nothing about this address, so it
  // must not render "not authorized" (access revocation remediation, D12).
  if (lookupError && lookupError.code !== 'PGRST116') {
    return refuse(
      'directory_unavailable',
      false,
      isApiPath(pathname)
        ? json(503, { error: 'Directory unavailable' })
        : redirect('/?error=directory_unavailable'),
    );
  }

  if (!row || !row.is_active) {
```

- [ ] **Step 4: Add the card and remove the automatic logout**

In `src/pages/index.astro`, add inside `ERROR_DESCRIPTIONS` directly after the `recheck_failed` entry:

```ts
  directory_unavailable: {
    title: 'Directory Unavailable',
    message: 'Cloudflare Zero Trust verified your identity, but the portal could not reach its account directory to confirm your access.',
    hint: 'Nothing about your account has changed. Wait a moment, then select Check Access Again.',
  },
```

In the `<script>` block, delete these lines (leave the `retry-verification-btn` handler):

```ts
    // Self-healing: if arrived with an authentication error, proactively clear local stale cookies in the background
    if (window.location.search.includes('error=')) {
      try {
        fetch('/cdn-cgi/access/logout', { mode: 'no-cors' }).catch(() => {});
      } catch { /* non-fatal */ }
    }

```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run test/pipeline-bootstrap.test.ts test/error-code-contract.test.ts test/landing.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/auth/stages/bootstrap.ts src/pages/index.astro test/pipeline-bootstrap.test.ts test/error-code-contract.test.ts
git commit -m "fix(auth): say 'directory unavailable' on a sign-in outage; stop auto-logout on error cards

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 3: Permission changes mark instead of signing the user out

Covers D1 (callers) and D5.

**Files:**

- Create: `src/lib/auth/registry-impact.ts`
- Modify: `src/pages/api/users/access.ts` (imports; step 5 block at lines 187-198; header comment line 16)
- Modify: `src/pages/api/audit/requests/[id]/resolve.ts` (imports; step 5 block at lines 103-108)
- Modify: `src/pages/api/users/manage.ts` (PATCH block at lines 362-388; audit context line 427)
- Modify: `src/pages/api/system/pages.ts` (imports; header lines 14-17; force-logout block at lines 123-135; audit context; response; `computeImpact` loop; `forceLogoutAffectedUsers`)
- Modify: `src/components/admin/debug/PageRegistryManager.tsx:168-177`, `src/components/admin/debug/PageRegistryConfirmModal.tsx:212-217`
- Test: `test/registry-impact.test.ts` (create), `test/permission-change-no-lockout.test.ts` (create)

**Interfaces:**

- Consumes: `markAuthzChanged`, `authzChangedKey` (Task 1).
- Produces: `summarizeRoleChangeImpact(storedRoles: readonly string[], oldRole: Role, newRole: Role): RoleChangeImpact`; `PATCH /api/system/pages` response field `reverifiedUsers: number` (replaces `logoutCount`).

- [ ] **Step 1: Write the failing impact test**

Create `test/registry-impact.test.ts`:

```ts
// test/registry-impact.test.ts
/**
 * Stored roles are legacy vocabulary: super_admin = Admin (2), admin = Manager
 * (3), dev = vendor support. The inline version in system/pages.ts looked the
 * stored strings up in the canonical level table, so Admins had no level and
 * Managers were counted as Admins (design D5).
 */
import { describe, it, expect } from 'vitest';
import { summarizeRoleChangeImpact } from '../src/lib/auth/registry-impact';

const stored = ['owner', 'super_admin', 'admin', 'staff'];

describe('summarizeRoleChangeImpact', () => {
  it('counts the Manager, not the Admin, as losing a page tightened from manager to admin', () => {
    const r = summarizeRoleChangeImpact(stored, 'manager', 'admin');
    expect(r.usersLosingAccess).toBe(1);
    expect(r.usersGainingAccess).toBe(0);
  });

  it('counts Admin and Manager as losing a page tightened from manager to owner', () => {
    expect(summarizeRoleChangeImpact(stored, 'manager', 'owner').usersLosingAccess).toBe(2);
  });

  it('counts gains when a page is loosened from owner to staff', () => {
    expect(summarizeRoleChangeImpact(stored, 'owner', 'staff').usersGainingAccess).toBe(3);
  });

  it('reports counts by canonical role and never gives an untranslatable value a level', () => {
    const r = summarizeRoleChangeImpact([...stored, 'ghost'], 'manager', 'admin');
    expect(r.roleCounts).toEqual({ owner: 1, admin: 1, manager: 1, staff: 1, unknown: 1 });
    expect(r.usersLosingAccess).toBe(1);
  });
});
```

- [ ] **Step 2: Write the failing route tests**

Create `test/permission-change-no-lockout.test.ts`:

```ts
// test/permission-change-no-lockout.test.ts
/**
 * Regression tests for the 2026-09-16 incident. Approving an access request,
 * granting or removing a page, changing a role, or applying a page-registry
 * change "refreshed" the target by force-logging them out, which also wrote a
 * 24-hour sign-in block (design D1). Each now leaves the target signed in and
 * records an authorization-change mark.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { POST as postAccess } from '../src/pages/api/users/access';
import { POST as postResolve } from '../src/pages/api/audit/requests/[id]/resolve';
import { PATCH as patchManage } from '../src/pages/api/users/manage';
import { PATCH as patchPages } from '../src/pages/api/system/pages';
import { env, clearTable } from './fixtures/env';
import { apiContext, makeUser } from './fixtures/context';
import { withFetch, jsonResponse, type FetchHandler } from './fixtures/outbound';
import { identityStub, type IdentityRow } from './fixtures/supabase-stub';
import { USER, seedStandardPages, putSession, sessionId } from './fixtures/pipeline';
import { AccessRequestRepository } from '../src/lib/dal/AccessRequestRepository';
import { authzChangedKey } from '../src/lib/auth/authz-signal';

const vendor = () => makeUser({
  userId: '[D1_DATABASE_UUID]', email: 'vendor@example.com', role: 'vendor_support', accessMap: {},
});

/** identityStub, plus list queries and writes to any other Supabase table. */
function directory(users: IdentityRow[]): FetchHandler {
  const single = identityStub({ users, jwks: { keys: [] } });
  return (call, request) => {
    const url = new URL(call.url);
    if (url.hostname === 'example.supabase.co') {
      if (url.pathname !== '/rest/v1/admin_authorized_users') return jsonResponse([], 201);
      const isList = call.method === 'GET' && !url.searchParams.has('email') && !url.searchParams.has('id');
      if (isList) return jsonResponse(users.filter((u) => u.is_active));
    }
    return single(call, request);
  };
}

let restore: () => void = () => {};

beforeEach(async () => {
  await seedStandardPages();
  await clearTable('admin_access_requests');
  await env.SESSION.delete(`revoked:${USER.id}`);
  await env.SESSION.delete(authzChangedKey(USER.id));
  restore = withFetch(directory([USER])).restore;
});

afterEach(() => restore());

async function expectSignedInAndMarked(sid: string): Promise<void> {
  expect(await env.SESSION.get(`session:${sid}`), 'the target stays signed in').not.toBeNull();
  expect(await env.SESSION.get(`revoked:${USER.id}`), 'no sign-in block').toBeNull();
  expect(await env.SESSION.get(authzChangedKey(USER.id)), 'the change is marked').not.toBeNull();
}

describe('POST /api/users/access', () => {
  for (const action of ['grant', 'revoke', 'reset'] as const) {
    it(`${action} leaves the target signed in and marks the change`, async () => {
      const sid = sessionId();
      await putSession(sid);
      const res = await postAccess(apiContext({
        path: '/api/users/access', method: 'POST', sameOrigin: true, user: vendor(),
        body: { targetUserId: USER.id, pagePath: '/dashboard/settings', action },
      }));
      expect(res.status).toBe(200);
      await expectSignedInAndMarked(sid);
    });
  }
});

describe('POST /api/audit/requests/[id]/resolve', () => {
  it('approving leaves the requester signed in and marks the change', async () => {
    const sid = sessionId();
    await putSession(sid);
    const requestId = crypto.randomUUID();
    await new AccessRequestRepository(env.DB).createRequest({
      id: requestId, userId: USER.id, userEmail: USER.email, userRole: 'admin', requestedPath: '/dashboard/settings',
    });
    const ctx = apiContext({
      path: `/api/audit/requests/${requestId}/resolve`, method: 'POST', sameOrigin: true, user: vendor(),
      body: { status: 'approved' },
    });
    (ctx as unknown as { params: Record<string, string> }).params = { id: requestId };
    const res = await postResolve(ctx);
    expect(res.status).toBe(200);
    await expectSignedInAndMarked(sid);
  });
});

describe('PATCH /api/users/manage', () => {
  it('a role change leaves the user signed in and marks the change', async () => {
    const sid = sessionId();
    await putSession(sid);
    const res = await patchManage(apiContext({
      path: '/api/users/manage', method: 'PATCH', sameOrigin: true, user: vendor(),
      body: { email: USER.email, role: 'manager' },
    }));
    expect(res.status).toBe(200);
    await expectSignedInAndMarked(sid);
  });
});

describe('PATCH /api/system/pages', () => {
  it('applying a page-role change marks every active user and signs nobody out', async () => {
    const sid = sessionId();
    await putSession(sid);
    const res = await patchPages(apiContext({
      path: '/api/system/pages', method: 'PATCH', sameOrigin: true, user: vendor(),
      body: { path: '/dashboard/settings', updates: { required_role: 'owner' }, forceLogoutAffected: true },
    }));
    expect(res.status).toBe(200);
    expect(((await res.json()) as { reverifiedUsers: number }).reverifiedUsers).toBe(1);
    await expectSignedInAndMarked(sid);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `npx vitest run test/registry-impact.test.ts test/permission-change-no-lockout.test.ts`
Expected: FAIL — `registry-impact` does not resolve. `revoke` and `approve` write `revoked:` and delete the session. `grant`, `reset` and the role change write no mark. `reverifiedUsers` is undefined.

- [ ] **Step 4: Create the impact function**

Create `src/lib/auth/registry-impact.ts`:

```ts
/**
 * Who gains or loses a page when its required role changes.
 *
 * Stored roles are legacy vocabulary (`super_admin` is Admin, `admin` is
 * Manager, `dev` is vendor support) and must be translated before any level
 * comparison. The inline version in system/pages.ts looked stored values up in
 * the canonical table, so Admins were never counted and Managers were counted
 * as Admins (access revocation remediation, D5).
 */
import { ROLE_LEVEL, normalizeRole, type Role } from './rbac';

export interface RoleChangeImpact {
  usersLosingAccess: number;
  usersGainingAccess: number;
  /** Active users per canonical role; an untranslatable stored value counts under `unknown`. */
  roleCounts: Record<string, number>;
}

export function summarizeRoleChangeImpact(
  storedRoles: readonly string[],
  oldRole: Role,
  newRole: Role,
): RoleChangeImpact {
  const counts = new Map<string, number>();
  let usersLosingAccess = 0;
  let usersGainingAccess = 0;

  for (const stored of storedRoles) {
    const role = normalizeRole(stored);
    const bucket = role ?? 'unknown';
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    if (!role) continue;

    const hadAccess = ROLE_LEVEL[role] <= ROLE_LEVEL[oldRole];
    const hasAccess = ROLE_LEVEL[role] <= ROLE_LEVEL[newRole];
    if (hadAccess && !hasAccess) usersLosingAccess++;
    if (!hadAccess && hasAccess) usersGainingAccess++;
  }

  return { usersLosingAccess, usersGainingAccess, roleCounts: Object.fromEntries(counts) };
}
```

- [ ] **Step 5: `access.ts` — mark on every action**

In `src/pages/api/users/access.ts`, change the import

```ts
import {
  getPageDefinition,
  forceLogoutUser,
  normalizePath,
} from '@/lib/auth/plac';
```

to

```ts
import { getPageDefinition, normalizePath } from '@/lib/auth/plac';
import { markAuthzChanged } from '@/lib/auth/authz-signal';
```

In the file's header comment, change the bullet `Force-logout: revoked users are immediately logged out` to `Re-verification: the target's live sessions pick the change up on their next request`.

Replace the block from `// ── 5. Invalidate Target's Cached Access Map ──` through the closing `}` of `if (action === 'revoke') { ... }` with:

```ts
    // ── 5. Re-verify the target's live sessions ──
    // Grant, revoke and reset all change the target's map, and each session
    // re-reads it on its next request. This used to force-logout the target on
    // revoke, which also wrote a 24-hour sign-in block (design D1).
    if (kv) await markAuthzChanged(kv, [targetUserId], env);
```

- [ ] **Step 6: `resolve.ts` — mark on approval**

In `src/pages/api/audit/requests/[id]/resolve.ts`, change

```ts
import { getPageDefinition, forceLogoutUser } from '../../../../../lib/auth/plac';
```

to

```ts
import { getPageDefinition } from '../../../../../lib/auth/plac';
import { markAuthzChanged } from '../../../../../lib/auth/authz-signal';
```

Replace:

```ts
      // ── 5. Invalidate Target's Cached Access Map ──
      if (cfCtx?.waitUntil) {
        cfCtx.waitUntil(forceLogoutUser(env.SESSION, targetUserId, env as any, cfCtx));
      } else {
        await forceLogoutUser(env.SESSION, targetUserId, env as any);
      }
```

with:

```ts
      // ── 5. Re-verify the requester's live sessions ──
      // This approval used to force-logout the requester, which also wrote a
      // 24-hour sign-in block. It is how the only Owner was locked out on
      // 2026-09-16 (design §1).
      if (env.SESSION) await markAuthzChanged(env.SESSION, [targetUserId], env);
```

- [ ] **Step 7: `manage.ts` PATCH — no sign-out for a role change; mark every change**

In `src/pages/api/users/manage.ts`, add `import { markAuthzChanged } from '@/lib/auth/authz-signal';` after the `plac` import. Replace:

```ts
    // On role change: reset page overrides + force re-login with new role
    if (roleIsChanging) {
      try {
        await resetUserOverrides(env.DB, targetUser.id);
        await forceLogoutUser(env.SESSION, targetUser.id, env);
      } catch (rbacErr) {
        console.warn('[API_USERS_PATCH] RBAC cleanup failed (non-fatal):', rbacErr);
      }
    }
```

with:

```ts
    // On role change: the new role starts from its own baseline.
    if (roleIsChanging) {
      try {
        await resetUserOverrides(env.DB, targetUser.id);
      } catch (rbacErr) {
        console.warn('[API_USERS_PATCH] Override reset failed (non-fatal):', rbacErr);
      }
    }
```

Directly after the `// On reactivation: ...` block (before `const cfCtx = getCfContext(context);`), add:

```ts
    // Every change above alters what this user's live sessions may do; each
    // session re-verifies on its next request. A role change no longer signs
    // the user out (design D1).
    if (env.SESSION) await markAuthzChanged(env.SESSION, [targetUser.id], env);
```

In the audit `context`, change `forceLogout: roleIsChanging || is_active === false,` to `forceLogout: is_active === false,`.

- [ ] **Step 8: `system/pages.ts` — mark all active users; correct vocabulary**

In `src/pages/api/system/pages.ts`:

Replace `import { forceLogoutUser } from '@/lib/auth/plac';` with:

```ts
import { markAuthzChanged } from '@/lib/auth/authz-signal';
import { summarizeRoleChangeImpact } from '@/lib/auth/registry-impact';
```

Replace header lines

```ts
 * Impact Preview + Optional Force-Logout (Option C):
 *   When required_role changes, the response includes an impact summary.
 *   If forceLogoutAffected is true, affected users are evicted via KV.
```

with

```ts
 * Impact Preview + Optional "apply now":
 *   When required_role changes, the response includes an impact summary.
 *   If forceLogoutAffected is true, every active user re-verifies their page
 *   map on their next request. The field keeps its name for the client; nobody
 *   is signed out (access revocation remediation, D1).
```

Replace the block from `// ── Optional Force-Logout ──` through its closing `}` with:

```ts
    // ── Optional: apply now ──
    // All active users, not a computed "affected" set: page overrides make
    // that set unknowable from roles alone, and a re-check costs one query per
    // live session.
    let reverifiedUsers = 0;
    if (forceLogoutAffected) {
      reverifiedUsers = await markActiveUsersChanged(env);
    }
```

In the audit `context`, replace `forceLogoutAffected: forceLogoutAffected ?? false,` and `logoutCount,` with `applyNow: forceLogoutAffected ?? false,` and `reverifiedUsers,`. In the `jsonOk({...})` response, replace `logoutCount,` with `reverifiedUsers,`.

In `computeImpact`, replace everything from `const roleCounts: Record<string, number> = Object.create(null);` through the closing `}` of the `for (const user of users) { ... }` loop with:

```ts
    const { usersLosingAccess, usersGainingAccess, roleCounts } = summarizeRoleChangeImpact(
      users.map((u) => u.role as string),
      oldRole,
      newRole,
    );
```

Replace the whole `forceLogoutAffectedUsers` function (its JSDoc included) with:

```ts
/**
 * Mark every active user's authorization changed, so each live session
 * re-reads its page map on its next request. Returns how many were marked.
 */
async function markActiveUsersChanged(env: CfEnv): Promise<number> {
  if (!env.SESSION) return 0;
  const { data, error } = await createAdminClient(env)
    .from('admin_authorized_users')
    .select('id')
    .eq('is_active', true);
  if (error || !data) {
    console.error('[Registry] Could not list active users to re-verify:', error);
    return 0;
  }
  const ids = data.map((u) => u.id as string);
  await markAuthzChanged(env.SESSION, ids, env);
  return ids.length;
}
```

`ROLE_LEVEL` stays imported: `computeImpact` still uses it to compute `direction`.

- [ ] **Step 9: Registry UI copy**

In `src/components/admin/debug/PageRegistryManager.tsx`, replace

```ts
      const data = await res.json() as { error?: string; logoutCount?: number };
```

with

```ts
      const data = await res.json() as { error?: string; reverifiedUsers?: number };
```

and

```ts
      const logoutMsg = (data.logoutCount ?? 0) > 0 ? ` (${data.logoutCount} sessions evicted)` : '';
      showToast(`✓ Updated ${editingPath}${logoutMsg}`, 'ok');
```

with

```ts
      const applied = (data.reverifiedUsers ?? 0) > 0 ? ` (${data.reverifiedUsers} users re-check their access on their next page load)` : '';
      showToast(`✓ Updated ${editingPath}${applied}`, 'ok');
```

In `src/components/admin/debug/PageRegistryConfirmModal.tsx`, replace the label text `Force-logout affected users immediately` with `Apply now` and the paragraph text

```tsx
                Instantly invalidates sessions for the {preview.usersLosingAccess} user{preview.usersLosingAccess !== 1 && 's'} losing access.
```

with

```tsx
                Every active user re-checks their page access on their next page load. Nobody is signed out.
```

- [ ] **Step 10: Run the tests to verify they pass**

Run: `npx vitest run test/registry-impact.test.ts test/permission-change-no-lockout.test.ts test/api-authz-inventory.test.ts`
Expected: PASS.

- [ ] **Step 11: Typecheck and ratchet, then commit**

Run: `npm run typecheck && npm run ratchet`
Expected: exit 0 (baseline with a `--reason` naming this task if a count rises).

```bash
git add src/lib/auth/registry-impact.ts src/pages/api/users/access.ts "src/pages/api/audit/requests/[id]/resolve.ts" src/pages/api/users/manage.ts src/pages/api/system/pages.ts src/components/admin/debug/PageRegistryManager.tsx src/components/admin/debug/PageRegistryConfirmModal.tsx test/registry-impact.test.ts test/permission-change-no-lockout.test.ts .ratchet.json
git commit -m "fix(authz): permission changes mark the user instead of locking them out

Approving an access request, granting/revoking/resetting a page, changing a
role and applying a page-registry change no longer call forceLogoutUser, which
wrote a 24-hour sign-in block and locked the only Owner out on 2026-09-16.
The registry impact preview now translates stored roles before comparing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 4: Remove the reconcile purge and the dead unblock on create

Covers D3 and part of D13.

**Files:**

- Modify: `src/lib/auth/cf-access-reconcile.ts:34, 85-101`
- Modify: `src/lib/auth/cf-access-sync.ts:137, 145, 169-172`
- Modify: `src/pages/api/users/manage.ts:153-157`
- Test: `test/cf-access-reconcile-gate.test.ts`

- [ ] **Step 1: Write the failing test**

Append inside `describe('cf-access-reconcile gate', ...)` in `test/cf-access-reconcile-gate.test.ts`:

```ts
  it('never deletes a revoked: key, even when the sync runs (design D3)', async () => {
    // The purge added in 5d3ea31 deleted the key of every ACTIVE user, which
    // silently undid a deliberate force-kick.
    const userId = '[D1_DATABASE_UUID]';
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () =>
      new Response(JSON.stringify([{ id: userId, email: 'admin@madagascarhotelags.com' }]), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      })));
    vi.spyOn(cfSync, 'syncCfAccessGroup').mockResolvedValue({ success: true, emailCount: 1, emailHash: 'h' });
    await env.SESSION.put(`revoked:${userId}`, '1');
    try {
      const settings = new Map<string, string>([
        ['cf-access-sync:last-hash', 'old-stale-hash'],
        ['cf-access-sync:last-synced-at', String(Date.now() - 3600 * 1000)],
        ['cf-access-reconcile-max-staleness-hours', '24'],
      ]);
      const result = await reconcileCfAccessGroup(env as unknown as CfEnv, settings);
      expect(result.success).toBe(true);
      expect(await env.SESSION.get(`revoked:${userId}`)).toBe('1');
    } finally {
      await env.SESSION.delete(`revoked:${userId}`);
    }
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/cf-access-reconcile-gate.test.ts`
Expected: FAIL — `expected null to be '1'`.

- [ ] **Step 3: Remove the purge**

In `src/lib/auth/cf-access-reconcile.ts`, change `const { emails, userIds, error } = await fetchAuthorizedUserEmails(env);` to `const { emails, error } = await fetchAuthorizedUserEmails(env);` and delete the block starting `// Auto-reconcile KV revocation blocks: purge any stale blocks for active accounts` through its closing `}` (lines 85-101).

In `src/lib/auth/cf-access-sync.ts`, change the return type `Promise<{ emails: string[] | null; userIds?: string[]; error?: string }>` to `Promise<{ emails: string[] | null; error?: string }>`, change `.select('id, email')` to `.select('email')`, and replace

```ts
      return {
        emails: users.map((u) => u.email).filter(Boolean),
        userIds: users.map((u) => u.id).filter(Boolean),
      };
```

with

```ts
      return { emails: users.map((u) => u.email).filter(Boolean) };
```

- [ ] **Step 4: Remove the dead unblock on create**

In `src/pages/api/users/manage.ts` POST, delete (a new UUID can never have a block):

```ts
    if (newUserId && env.SESSION) {
      try {
        await env.SESSION.delete(`revoked:${newUserId}`);
      } catch { /* non-fatal */ }
    }
```

- [ ] **Step 5: Run the tests to verify they pass, then commit**

Run: `npx vitest run test/cf-access-reconcile-gate.test.ts test/cf-access-sync.test.ts`
Expected: PASS.

```bash
git add src/lib/auth/cf-access-reconcile.ts src/lib/auth/cf-access-sync.ts src/pages/api/users/manage.ts test/cf-access-reconcile-gate.test.ts .ratchet.json
git commit -m "fix(auth): stop the reconcile cron deleting revoked: keys of active users

It undid deliberate force-kicks and, running only on a hash change or 24h
staleness, did not clear the stale block it was written for.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 5: Stage 1 close-out — docs, verify, ship, confirm live

**Files:**

- Modify: `documentation/features/SESSION-MANAGEMENT.md`, `documentation/features/USER-MANAGEMENT.md`, `documentation/architecture/PERMISSIONS-SYSTEM.md`
- Create: `documentation/program/chunks/<ship-date>-ar1-access-revocation-stage-1.md` (`<ship-date>` is the UTC date it deploys, `YYYY-MM-DD`; copy the section layout of `2026-09-16-14a-supabase-objects.md`)
- Modify: `documentation/README.md` (index row for the chunk record), `documentation/program/ROADMAP.md` (one chunk-table row `AR` for this remediation)

- [ ] **Step 1: Find every doc statement Stage 1 made false**

Run: `grep -n "forceLogoutUser\|force-logout\|Force-logout\|revoked:\|re-login recomputes\|evict" documentation/features/SESSION-MANAGEMENT.md documentation/features/USER-MANAGEMENT.md documentation/architecture/PERMISSIONS-SYSTEM.md`

For each hit that says a page grant/revoke/reset, an access-request approval, a role change or a registry change signs the user out or blocks them, replace the sentence with: "The change is recorded as an authorization-change mark (`authz-changed:<userId>`); the user's live sessions re-verify role and page map on their next request and nobody is signed out." Add this section to `SESSION-MANAGEMENT.md`:

```markdown
## Authorization changes and re-verification (2026-09-16)

A warm request reads three keys in one bulk KV read: `revoked-session:<sessionId>`,
`revoked:<userId>` (retired in stage 2 of the access revocation remediation) and
`authz-changed:<userId>`. When the mark differs from the one the session stored,
the request re-reads the user's row from Supabase and recomputes the page map
from D1 before it is authorised.

The periodic re-check (every `SESSION_REFRESH_INTERVAL_MS`) never writes a
sign-in block. A missing row ends the session with `access_denied`, an inactive
row with `account_inactive`, an untranslatable role with `role_unrecognised`.
A Supabase outage keeps the session for up to two intervals since the last good
check, then ends it with `recheck_failed`; a re-check forced by a mark gets no grace.
```

Set `last_verified` to the ship date on every doc you edit.

- [ ] **Step 2: Full gate**

Run: `npm run verify`
Expected: exit 0. If `docs_check` reports a sibling-repo path, run `git fetch && git merge --ff-only origin/main` in `../cf-astro` first; that failure is not about cf-admin.

- [ ] **Step 3: Merge and ship**

Rebase the worktree branch on a freshly fetched `origin/main`, fast-forward `main`, push. Workers Builds deploys. Read the deployed SHA from any new Sentry event's `release: cf-admin@<sha>`, not from git.

- [ ] **Step 4: Confirm live (read-only, then one owner-approved action)**

```bash
npx wrangler kv key list --namespace-id [CF_HEX_ID] --prefix "revoked:" --remote
npx wrangler d1 execute madagascar-db --remote --json --command "SELECT created_at, email, failure_reason FROM admin_login_logs WHERE event_type='LOGIN_FAILED' AND created_at >= datetime('now','-1 day') ORDER BY created_at DESC LIMIT 20"
```

Expected: no `revocation_block_active` rows after the deploy time except for keys that pre-date it. With the owner watching, grant a test page to a staff account that is signed in elsewhere; the staff session stays signed in and gets the page on its next load, and `npx wrangler kv key get --namespace-id [CF_HEX_ID] "authz-changed:<staffId>" --remote` prints a UUID.

- [ ] **Step 5: Record and commit the docs**

Write the chunk record with: the incident summary, the commits, the test counts before and after, and the live checks from Step 4 with their output. Add its row to `documentation/README.md` and the `AR` row to `ROADMAP.md`.

```bash
npx --yes markdownlint-cli2@0.23.2 "documentation/**/*.md"
git add documentation/features/SESSION-MANAGEMENT.md documentation/features/USER-MANAGEMENT.md documentation/architecture/PERMISSIONS-SYSTEM.md documentation/program/chunks/<ship-date>-ar1-access-revocation-stage-1.md documentation/README.md documentation/program/ROADMAP.md
git commit -m "docs(auth): record access revocation remediation stage 1

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Stage 2 — One way to keep someone out, and it is visible

### Task 6: One rule for acting on another user, with a last-Owner guard

Covers D7 (hierarchy part), D14, OD-3, OD-5.

**Files:**

- Create: `src/lib/auth/target-guard.ts`
- Modify: `src/pages/api/users/manage.ts` (PATCH target lookup and checks; DELETE target lookup and checks)
- Modify: `src/pages/api/users/access.ts` (steps 3 and 5 gates)
- Modify: `src/pages/api/audit/requests/[id]/resolve.ts` (target lookup and gates)
- Test: `test/target-guard.test.ts` (create), `test/permission-change-no-lockout.test.ts` (one case added)

**Interfaces:**

- Produces:
  - `type TargetAction = 'sign_out' | 'deactivate' | 'reactivate' | 'delete' | 'change_role' | 'edit_profile' | 'change_page_access'`
  - `interface TargetFacts { actor: { userId: string; role: Role }; target: { id: string; role: Role; isActive: boolean }; action: TargetAction; newRole?: Role; activeOwnerCount?: number }`
  - `removesAnOwner(f: Pick<TargetFacts, 'target' | 'action' | 'newRole'>): boolean`
  - `decideTargetAction(f: TargetFacts): { ok: true } | { ok: false; status: 400 | 403 | 409 | 503; message: string }`
  - `interface DirectoryTarget { id: string; email: string; role: Role; isActive: boolean; displayName: string }`
  - `loadTarget(env: CfEnv, by: { id: string } | { email: string })`
  - `countActiveOwners(env: CfEnv): Promise<number | undefined>`
  - `authorizeTargetAction(env: CfEnv, actor: { userId: string; role: Role }, by: { id: string } | { email: string }, action: TargetAction, newRole?: Role): Promise<{ ok: true; target: DirectoryTarget } | { ok: false; status: number; message: string }>`

- [ ] **Step 1: Write the failing test**

Create `test/target-guard.test.ts`:

```ts
// test/target-guard.test.ts
/**
 * The one rule for acting on another account (design §4.5). Before it, six
 * hand-written copies disagreed: an Admin could force-kick another Admin, only
 * the UI stopped an administrator blocking themselves, and nothing protected
 * the last active Owner — the situation that stranded the customer on
 * 2026-09-16.
 */
import { describe, it, expect } from 'vitest';
import { decideTargetAction, removesAnOwner, type TargetAction, type TargetFacts } from '../src/lib/auth/target-guard';
import type { Role } from '../src/lib/auth/rbac';

function facts(
  actorRole: Role,
  targetRole: Role,
  action: TargetAction,
  extra: { self?: boolean; newRole?: Role; activeOwnerCount?: number; targetActive?: boolean } = {},
): TargetFacts {
  return {
    actor: { userId: 'actor-id', role: actorRole },
    target: { id: extra.self ? 'actor-id' : 'target-id', role: targetRole, isActive: extra.targetActive ?? true },
    action,
    newRole: extra.newRole,
    activeOwnerCount: extra.activeOwnerCount,
  };
}

describe('decideTargetAction — yourself', () => {
  for (const action of ['sign_out', 'deactivate', 'delete', 'change_role', 'change_page_access'] as const) {
    it(`refuses ${action} on your own account, even for vendor support`, () => {
      expect(decideTargetAction(facts('vendor_support', 'vendor_support', action, { self: true }))).toMatchObject({ ok: false, status: 400 });
    });
  }

  it('lets vendor support edit its own display name', () => {
    expect(decideTargetAction(facts('vendor_support', 'vendor_support', 'edit_profile', { self: true }))).toEqual({ ok: true });
  });

  it('keeps refusing an Owner editing its own profile here, as manage.ts always has', () => {
    expect(decideTargetAction(facts('owner', 'owner', 'edit_profile', { self: true }))).toMatchObject({ ok: false, status: 403 });
  });
});

describe('decideTargetAction — clearance', () => {
  it('refuses an Admin signing out another Admin (force-kick.ts allowed this)', () => {
    expect(decideTargetAction(facts('admin', 'admin', 'sign_out'))).toMatchObject({ ok: false, status: 403 });
  });

  it('lets an Admin sign out a Manager', () => {
    expect(decideTargetAction(facts('admin', 'manager', 'sign_out'))).toEqual({ ok: true });
  });

  it('refuses an Owner acting on vendor support', () => {
    expect(decideTargetAction(facts('owner', 'vendor_support', 'sign_out'))).toMatchObject({ ok: false, status: 403 });
  });

  it('lets vendor support sign out an Owner with no Owner count', () => {
    expect(decideTargetAction(facts('vendor_support', 'owner', 'sign_out'))).toEqual({ ok: true });
  });
});

describe('decideTargetAction — last active Owner (OD-3)', () => {
  it('refuses deactivating the only active Owner, even for vendor support', () => {
    expect(decideTargetAction(facts('vendor_support', 'owner', 'deactivate', { activeOwnerCount: 1 }))).toMatchObject({ ok: false, status: 409 });
  });

  it('refuses deleting or demoting the only active Owner', () => {
    expect(decideTargetAction(facts('vendor_support', 'owner', 'delete', { activeOwnerCount: 1 }))).toMatchObject({ status: 409 });
    expect(decideTargetAction(facts('vendor_support', 'owner', 'change_role', { newRole: 'admin', activeOwnerCount: 1 }))).toMatchObject({ status: 409 });
  });

  it('allows it when another Owner is active', () => {
    expect(decideTargetAction(facts('vendor_support', 'owner', 'deactivate', { activeOwnerCount: 2 }))).toEqual({ ok: true });
  });

  it('fails closed when the Owner count could not be read', () => {
    expect(decideTargetAction(facts('vendor_support', 'owner', 'deactivate'))).toMatchObject({ ok: false, status: 503 });
  });

  it('does not count Owners for an inactive Owner or a no-op role change', () => {
    expect(removesAnOwner(facts('vendor_support', 'owner', 'delete', { targetActive: false }))).toBe(false);
    expect(removesAnOwner(facts('vendor_support', 'owner', 'change_role', { newRole: 'owner' }))).toBe(false);
    expect(removesAnOwner(facts('vendor_support', 'owner', 'reactivate'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/target-guard.test.ts`
Expected: FAIL — `target-guard` does not resolve.

- [ ] **Step 3: Create the guard**

Create `src/lib/auth/target-guard.ts`:

```ts
/**
 * The one rule for an administrator acting on another account (access
 * revocation remediation, design §4.5, OD-3 and OD-5).
 *
 * Before this module the rule lived in six hand-written copies that disagreed:
 * manage.ts refused equal clearance; force-kick.ts and active-sessions.ts
 * refused only Owner and vendor targets, so an Admin could act on another
 * Admin; only the UI stopped an administrator blocking their own account; and
 * nothing protected the last active Owner.
 *
 *   1. Never your own account, except editing your own profile.
 *   2. Vendor support may act on anyone else; everyone else only on a strictly
 *      lower clearance (lower ROLE_LEVEL number = higher privilege).
 *   3. Nobody may deactivate, delete or demote the last active Owner.
 */
import { createAdminClient } from '../supabase';
import { ROLES, ROLE_LEVEL, normalizeRole, toStoredRole, type Role } from './rbac';

export type TargetAction =
  | 'sign_out'
  | 'deactivate'
  | 'reactivate'
  | 'delete'
  | 'change_role'
  | 'edit_profile'
  | 'change_page_access';

export interface TargetFacts {
  actor: { userId: string; role: Role };
  target: { id: string; role: Role; isActive: boolean };
  action: TargetAction;
  /** The role being assigned; read only for `change_role`. */
  newRole?: Role;
  /** Active Owners, counting the target. Read only when the action removes an Owner; undefined = unknown. */
  activeOwnerCount?: number;
}

export type TargetDecision =
  | { ok: true }
  | { ok: false; status: 400 | 403 | 409 | 503; message: string };

/** True when the action would leave the target no longer an active Owner. */
export function removesAnOwner(f: Pick<TargetFacts, 'target' | 'action' | 'newRole'>): boolean {
  if (f.target.role !== ROLES.OWNER || !f.target.isActive) return false;
  if (f.action === 'deactivate' || f.action === 'delete') return true;
  return f.action === 'change_role' && f.newRole !== undefined && f.newRole !== ROLES.OWNER;
}

export function decideTargetAction(f: TargetFacts): TargetDecision {
  if (f.actor.userId === f.target.id && f.action !== 'edit_profile') {
    return { ok: false, status: 400, message: 'You cannot do this to your own account.' };
  }
  if (f.actor.role !== ROLES.VENDOR_SUPPORT && ROLE_LEVEL[f.actor.role] >= ROLE_LEVEL[f.target.role]) {
    return { ok: false, status: 403, message: 'You can only manage accounts below your own clearance.' };
  }
  if (removesAnOwner(f)) {
    if (f.activeOwnerCount === undefined) {
      return { ok: false, status: 503, message: 'Could not confirm that another active Owner exists. Try again.' };
    }
    if (f.activeOwnerCount <= 1) {
      return { ok: false, status: 409, message: 'This is the only active Owner. Make another account an Owner first.' };
    }
  }
  return { ok: true };
}

export interface DirectoryTarget {
  id: string;
  email: string;
  role: Role;
  isActive: boolean;
  displayName: string;
}

type TargetLookup =
  | { found: true; target: DirectoryTarget }
  | { found: false; status: 404 | 500 | 503; message: string };

interface TargetRow { id: string; email: string; role: string; is_active: boolean; display_name: string | null }

export async function loadTarget(env: CfEnv, by: { id: string } | { email: string }): Promise<TargetLookup> {
  const base = createAdminClient(env)
    .from('admin_authorized_users')
    .select('id, email, role, is_active, display_name');
  const filtered = 'id' in by ? base.eq('id', by.id) : base.eq('email', by.email.toLowerCase());
  const { data, error } = (await filtered.single()) as { data: TargetRow | null; error: { code?: string } | null };

  if (error && error.code !== 'PGRST116') {
    return { found: false, status: 503, message: 'The account directory is unavailable. Try again.' };
  }
  if (!data) return { found: false, status: 404, message: 'User not found' };

  const role = normalizeRole(data.role);
  if (!role) {
    return { found: false, status: 500, message: 'This account has an unrecognised role and cannot be managed here.' };
  }
  return {
    found: true,
    target: { id: data.id, email: data.email, role, isActive: data.is_active, displayName: data.display_name ?? '' },
  };
}

export async function countActiveOwners(env: CfEnv): Promise<number | undefined> {
  const { count, error } = await createAdminClient(env)
    .from('admin_authorized_users')
    .select('id', { count: 'exact', head: true })
    .eq('role', toStoredRole(ROLES.OWNER))
    .eq('is_active', true);
  return error || count === null ? undefined : count;
}

/** Load the target, count Owners only when the action needs it, and decide. */
export async function authorizeTargetAction(
  env: CfEnv,
  actor: { userId: string; role: Role },
  by: { id: string } | { email: string },
  action: TargetAction,
  newRole?: Role,
): Promise<{ ok: true; target: DirectoryTarget } | { ok: false; status: number; message: string }> {
  const lookup = await loadTarget(env, by);
  if (!lookup.found) return { ok: false, status: lookup.status, message: lookup.message };

  const f: TargetFacts = { actor, target: lookup.target, action, newRole };
  if (removesAnOwner(f)) f.activeOwnerCount = await countActiveOwners(env);

  const decision = decideTargetAction(f);
  return decision.ok ? { ok: true, target: lookup.target } : decision;
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx vitest run test/target-guard.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Wire `manage.ts` PATCH**

In `src/pages/api/users/manage.ts`, add `import { authorizeTargetAction, countActiveOwners, decideTargetAction, loadTarget, removesAnOwner, type TargetAction } from '@/lib/auth/target-guard';`. Delete the `storedRoleOrNull` function and its JSDoc.

In PATCH, replace everything from `const { data: targetUser } = await adminClient` through the closing `}` of `if (targetEmail === session.email && roleIsChanging) { ... }` with:

```ts
    let newRole: Role | undefined;
    if (role) {
      const check = validateAssignableRole(role, session.role);
      if (!check.ok) return jsonError(check.status, check.message);
      newRole = check.role;
    }

    const lookup = await loadTarget(env, { email: targetEmail });
    if (!lookup.found) return jsonError(lookup.status, lookup.message);
    const targetUser = lookup.target;
    const roleIsChanging = newRole !== undefined && newRole !== targetUser.role;

    if (roleIsChanging && !isVendorSupport(session.role) && ROLE_LEVEL[newRole!] <= ROLE_LEVEL[session.role]) {
      return jsonError(403, 'Target role exceeds your authorization clearance');
    }

    // One request can carry several changes; each is judged by the shared rule
    // (target-guard.ts), and the Owner count is read at most once.
    const actions: TargetAction[] = [];
    if (is_active === false) actions.push('deactivate');
    if (is_active === true) actions.push('reactivate');
    if (roleIsChanging) actions.push('change_role');
    if (actions.length === 0) actions.push('edit_profile');
    const activeOwnerCount = actions.some((action) => removesAnOwner({ target: targetUser, action, newRole }))
      ? await countActiveOwners(env)
      : undefined;
    for (const action of actions) {
      const decision = decideTargetAction({ actor: session, target: targetUser, action, newRole, activeOwnerCount });
      if (!decision.ok) return jsonError(decision.status, decision.message);
    }
```

In the rest of PATCH, rename: `targetCurrentRole` → `targetUser.role`; `targetUser.is_active` → `targetUser.isActive`; `targetUser.display_name` → `targetUser.displayName`. Delete the now-unused `userRoleLevel` and `targetCurrentRoleLevel` declarations.

- [ ] **Step 6: Wire `manage.ts` DELETE**

Replace everything from `if (targetEmail === session.email) return jsonError(400, 'Cannot delete self');` through the closing `}` of the `userRoleLevel >= targetCurrentRoleLevel` check with:

```ts
    const env = getEnv(context);
    const adminClient = createAdminClient(env);

    const guard = await authorizeTargetAction(env, session, { email: targetEmail }, 'delete');
    if (!guard.ok) return jsonError(guard.status, guard.message);
    const targetUser = guard.target;
```

(The `const env` and `const adminClient` lines this replaces sat inside that span; keep exactly one of each.) In the audit diff, use `ROLE_META[targetUser.role].label`, `targetUser.displayName`, `targetUser.isActive`.

- [ ] **Step 7: Wire `access.ts`**

In `src/pages/api/users/access.ts`, add `import { authorizeTargetAction } from '@/lib/auth/target-guard';`. Replace everything from `// ── 3. Resolve Target From DB (NEVER trust targetUserRole from body) ──` through the closing `}` of `// Gate B` with:

```ts
    // ── 3. The target, and whether this actor may act on them ──
    // The shared rule (target-guard.ts) covers what Gates A and B, and the
    // self-modification check, used to do here; the target's role always comes
    // from the directory, never from the request body.
    const guard = await authorizeTargetAction(env, actor, { id: targetUserId }, 'change_page_access');
    if (!guard.ok) return jsonError(guard.status, guard.message);
    const verifiedTargetRole = guard.target.role;
    const verifiedTargetEmail = guard.target.email;

    // ── 4. Validate Page Exists ──
    const pageDef = await getPageDefinition(db, pagePath);
    if (!pageDef) {
      return jsonError(400, 'Invalid page path');
    }
```

Remove imports that typecheck reports unused (`createAdminClient`, `isOwnerOrVendor`, `isVendorSupport`, `normalizeRole`).

- [ ] **Step 8: Wire `resolve.ts`**

In `src/pages/api/audit/requests/[id]/resolve.ts`, add `import { authorizeTargetAction } from '../../../../../lib/auth/target-guard';`. Replace everything from `// ── 1. Resolve Target From DB ──` through the closing `}` of `if (isOwnerOrVendor(verifiedTargetRole) && !isVendorSupport(user.role)) { ... }` with:

```ts
      // ── 1. The target, and whether this approver may act on them ──
      const guard = await authorizeTargetAction(env, user, { id: targetUserId }, 'change_page_access');
      if (!guard.ok) return jsonError(guard.status, guard.message);
      const targetRow = { email: guard.target.email };
      const verifiedTargetRole = guard.target.role;

      // ── 2. Validate Page Exists ──
      const pageDef = await getPageDefinition(env.DB, pagePath);
      if (!pageDef) {
        return jsonError(400, 'Invalid page path');
      }
```

Keep the `decideAccess` and clearance checks that follow. Remove imports that typecheck reports unused.

- [ ] **Step 9: Add a route case for the last Owner**

Append to `test/permission-change-no-lockout.test.ts` inside `describe('PATCH /api/users/manage', ...)`:

```ts
  it('refuses deactivating the only active Owner, even for vendor support (OD-3)', async () => {
    restore();
    const owner = { ...USER, role: 'owner' };
    const base = directory([owner]);
    restore = withFetch((call, request) => {
      const url = new URL(call.url);
      // countActiveOwners: HEAD with Prefer: count=exact → Content-Range carries the total.
      if (call.method === 'HEAD' && url.pathname === '/rest/v1/admin_authorized_users') {
        return new Response(null, { status: 200, headers: { 'Content-Range': '*/1' } });
      }
      return base(call, request);
    }).restore;
    const res = await patchManage(apiContext({
      path: '/api/users/manage', method: 'PATCH', sameOrigin: true, user: vendor(),
      body: { email: USER.email, is_active: false },
    }));
    expect(res.status).toBe(409);
  });
```

- [ ] **Step 10: Run the tests, typecheck, ratchet, commit**

Run: `npx vitest run test/target-guard.test.ts test/permission-change-no-lockout.test.ts && npm run typecheck && npm run ratchet`
Expected: PASS / exit 0.

```bash
git add src/lib/auth/target-guard.ts src/pages/api/users/manage.ts src/pages/api/users/access.ts "src/pages/api/audit/requests/[id]/resolve.ts" test/target-guard.test.ts test/permission-change-no-lockout.test.ts .ratchet.json
git commit -m "fix(authz): one rule for acting on another user, and never strand the last Owner

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 7: Force-kick honours its Owner-only permission

Covers D6. The registry row `/dashboard/users#force-kick` (required role `owner`) exists in production (verified 2026-09-16).

**Files:**

- Modify: `src/lib/auth/surface-guards.ts` (append a Users section)
- Modify: `src/pages/api/users/force-kick.ts:1-17`
- Test: `test/users-permissions.test.ts` (create)

**Interfaces:**

- Produces: `USERS_PAGE = '/dashboard/users'`; `type UsersAction = 'force-kick'`; `denyUsers(user: Pick<AdminUser, 'role' | 'accessMap'>, action?: UsersAction): Response | null`.

- [ ] **Step 1: Write the failing test**

Create `test/users-permissions.test.ts`:

```ts
// test/users-permissions.test.ts
/**
 * `/dashboard/users#force-kick` is Owner-only in the registry, and the access
 * UI offers it as grantable, but force-kick.ts checked only `/dashboard/users`
 * — so every Admin could force-kick (design D6, the gap D-4 class).
 */
import { describe, it, expect } from 'vitest';
import { denyUsers, USERS_PAGE } from '../src/lib/auth/surface-guards';

const user = (role: string, accessMap: Record<string, boolean>) =>
  ({ role, accessMap }) as unknown as Parameters<typeof denyUsers>[0];

describe('denyUsers', () => {
  it('refuses force-kick to an Admin whose map denies the fragment — the registry default', () => {
    expect(denyUsers(user('admin', { [USERS_PAGE]: true, [`${USERS_PAGE}#force-kick`]: false }), 'force-kick')?.status).toBe(403);
  });

  it('allows force-kick to an Admin granted the fragment', () => {
    expect(denyUsers(user('admin', { [USERS_PAGE]: true, [`${USERS_PAGE}#force-kick`]: true }), 'force-kick')).toBeNull();
  });

  it('refuses force-kick when the page is denied, even with the fragment granted', () => {
    expect(denyUsers(user('admin', { [USERS_PAGE]: false, [`${USERS_PAGE}#force-kick`]: true }), 'force-kick')?.status).toBe(403);
  });

  it('lets an Owner through whatever the map says (ADR-0002 answer 2)', () => {
    expect(denyUsers(user('owner', {}), 'force-kick')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/users-permissions.test.ts`
Expected: FAIL — `denyUsers` is not exported.

- [ ] **Step 3: Add the guard**

Append to `src/lib/auth/surface-guards.ts`:

```ts
// ── Users ───────────────────────────────────────────────────────────────────

export const USERS_PAGE = '/dashboard/users';

/** The sub-permissions `admin_pages` defines for the users page. */
export type UsersAction = 'force-kick';

export function denyUsers(user: Actor, action?: UsersAction): Response | null {
  return denyPageAndAction(user, USERS_PAGE, action);
}
```

- [ ] **Step 4: Use it in force-kick**

In `src/pages/api/users/force-kick.ts`, change `import { requireAuth, AuthError, placDenyResponse } from '@/lib/auth/guard';` to `import { requireAuth, AuthError } from '@/lib/auth/guard';`, add `import { denyUsers } from '@/lib/auth/surface-guards';`, and replace `const denied = placDenyResponse(session, '/dashboard/users');` with `const denied = denyUsers(session, 'force-kick');`.

- [ ] **Step 5: Run the tests and commit**

Run: `npx vitest run test/users-permissions.test.ts test/sessions-permissions.test.ts test/guard-plac.test.ts`
Expected: PASS.

```bash
git add src/lib/auth/surface-guards.ts src/pages/api/users/force-kick.ts test/users-permissions.test.ts
git commit -m "fix(authz): enforce the Owner-only #force-kick sub-permission

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 8: Sign out everywhere without a sign-in block; retire `revoked:<userId>`

Covers D7 (error handling), D8, D13, OD-1, OD-4.

**Files:**

- Create: `src/lib/auth/sign-out.ts`
- Modify: `src/lib/auth/plac.ts` (delete `fetchUserRevocationIdentity`, `executeLayer3Revocation`, `forceLogoutUser`, `revokeSingleSession`, the `createAdminClient` import)
- Modify: `src/lib/auth/session.ts` (delete `writeRevocationFlag`)
- Modify: `src/lib/auth/stages/session-stage.ts` (two keys)
- Modify: `src/lib/auth/stages/bootstrap.ts:67-75` (delete the `revoked:` check)
- Modify: `src/pages/index.astro` (delete the `access_revoked` card)
- Replace: `src/pages/api/users/force-kick.ts`, `src/pages/api/sessions/active-sessions.ts` (whole files below)
- Modify: `src/pages/api/users/manage.ts` (PATCH deactivation/reactivation blocks; DELETE order)
- Modify: `src/lib/schemas/operations.ts:37-42`
- Modify: `src/components/admin/users/sessions/[SUPABASE_PROJECT_REF].tsx`, `ActiveSessionsPanel.tsx`, `SessionDetailDrawer.tsx`, `SessionForensicsDrawer.tsx`; `src/components/admin/users/ExpandedRow.tsx`
- Test: delete `test/plac-revocation.test.ts`; create `test/sign-out.test.ts`, `test/no-sign-in-blocks.test.ts`; modify `test/pipeline-session.test.ts`, `test/pipeline-bootstrap.test.ts`

**Interfaces:**

- Consumes: `markAuthzChanged` (Task 1), `authorizeTargetAction` (Task 6), `denyUsers` (Task 7).
- Produces: `signOutEverywhere(kv: KVNamespace, userId: string, env: SignOutEnv, known?: { email?: string }): Promise<SignOutResult>`; `interface SignOutResult { sessionsEnded: number; accessRevoked: boolean }`; `ACCESS_NOT_CONFIRMED_WARNING: string`; `[SUPABASE_PROJECT_REF] = z.object({ userId: uuidSchema })`; `DELETE /api/sessions/active-sessions` body `{ userId }`.

- [ ] **Step 1: Write the failing tests**

Run `git rm test/plac-revocation.test.ts`. Create `test/sign-out.test.ts`:

```ts
// test/sign-out.test.ts
/**
 * Replaces plac-revocation.test.ts. Signing a user out ends their sessions and
 * revokes their Cloudflare Access tokens; it no longer writes a 24-hour
 * `revoked:<userId>` sign-in block (design OD-1). Keeping someone out is
 * deactivation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { env } from './fixtures/env';
import { withFetch, jsonResponse } from './fixtures/outbound';
import { signOutEverywhere, type SignOutEnv } from '../src/lib/auth/sign-out';
import { authzChangedKey } from '../src/lib/auth/authz-signal';

const USER_ID = 'sign-out-test-user';
const SESSIONS = ['sess-a', 'sess-b'];
const EMAIL = 'signed-out@test.local';
const CF_SUB = 'cf-sub-123';
const ACCOUNT = 'test-account-id';
const REVOKE_URL = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/access/organizations/revoke_user`;

const withAccess = { ...env, CF_API_TOKEN_ZT_WRITE: 'zt-write-token', CF_ACCOUNT_ID: ACCOUNT } as unknown as SignOutEnv;
const withoutAccess = { ...env, CF_API_TOKEN_ZT_WRITE: undefined, CF_ACCOUNT_ID: undefined } as unknown as SignOutEnv;

async function seed(): Promise<void> {
  for (const sid of SESSIONS) {
    await env.SESSION.put(`user-session:${USER_ID}:${sid}`, '1');
    await env.SESSION.put(`session:${sid}`, JSON.stringify({ userId: USER_ID, email: EMAIL, cfSubId: CF_SUB, role: 'staff' }));
  }
}

let restore: (() => void) | null = null;

beforeEach(async () => {
  for (const sid of SESSIONS) {
    await env.SESSION.delete(`user-session:${USER_ID}:${sid}`);
    await env.SESSION.delete(`session:${sid}`);
    await env.SESSION.delete(`revoked-session:${sid}`);
  }
  await env.SESSION.delete(`revoked:${USER_ID}`);
  await env.SESSION.delete(authzChangedKey(USER_ID));
});

afterEach(() => {
  restore?.();
  restore = null;
});

describe('signOutEverywhere', () => {
  it('ends every session with a per-session flag and writes no user-level sign-in block', async () => {
    await seed();
    restore = withFetch(() => jsonResponse({ success: true })).restore;
    const result = await signOutEverywhere(env.SESSION, USER_ID, withAccess);
    expect(result).toEqual({ sessionsEnded: 2, accessRevoked: true });
    for (const sid of SESSIONS) {
      expect(await env.SESSION.get(`revoked-session:${sid}`)).toBe('1');
      expect(await env.SESSION.get(`session:${sid}`)).toBeNull();
      expect(await env.SESSION.get(`user-session:${USER_ID}:${sid}`)).toBeNull();
    }
    expect(await env.SESSION.get(`revoked:${USER_ID}`)).toBeNull();
    expect(await env.SESSION.get(authzChangedKey(USER_ID))).not.toBeNull();
  });

  it('revokes Cloudflare Access tokens across devices', async () => {
    await seed();
    const stub = withFetch(() => jsonResponse({ success: true }));
    restore = stub.restore;
    await signOutEverywhere(env.SESSION, USER_ID, withAccess);
    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0].url).toBe(REVOKE_URL);
    expect(stub.calls[0].method).toBe('POST');
    expect(stub.calls[0].headers.get('Authorization')).toBe('Bearer zt-write-token');
    // `devices: true` is what stops the browser silently opening a new portal
    // session from its still-valid Access cookie.
    expect(JSON.parse(stub.calls[0].body ?? '{}')).toEqual({ devices: true, email: EMAIL, user_uid: CF_SUB });
  });

  it('still ends the sessions, and says so truthfully, when Access refuses', async () => {
    await seed();
    restore = withFetch(() => new Response('forbidden', { status: 403 })).restore;
    const result = await signOutEverywhere(env.SESSION, USER_ID, withAccess);
    expect(result).toEqual({ sessionsEnded: 2, accessRevoked: false });
    expect(await env.SESSION.get(`session:${SESSIONS[0]}`)).toBeNull();
  });

  it('makes no Cloudflare call without credentials', async () => {
    await seed();
    const stub = withFetch(() => jsonResponse({ success: true }));
    restore = stub.restore;
    const result = await signOutEverywhere(env.SESSION, USER_ID, withoutAccess);
    expect(stub.calls).toHaveLength(0);
    expect(result.accessRevoked).toBe(false);
  });

  it('uses a known email when the user has no live session', async () => {
    const stub = withFetch((call) =>
      call.url === REVOKE_URL ? jsonResponse({ success: true }) : jsonResponse({ code: 'PGRST116', message: 'no rows' }, 406));
    restore = stub.restore;
    const result = await signOutEverywhere(env.SESSION, USER_ID, withAccess, { email: EMAIL });
    expect(result).toEqual({ sessionsEnded: 0, accessRevoked: true });
    const revoke = stub.calls.find((c) => c.url === REVOKE_URL);
    expect(JSON.parse(revoke?.body ?? '{}')).toEqual({ devices: true, email: EMAIL });
  });
});
```

Create `test/no-sign-in-blocks.test.ts`:

```ts
// test/no-sign-in-blocks.test.ts
/**
 * Design OD-1: deactivation is the only way to keep someone out. A user-level
 * `revoked:<userId>` KV key stranded the only Owner on 2026-09-16, and it had
 * spread through a helper whose name did not say it blocked sign-in. This fails
 * if any source file reads or writes such a key, or calls that helper, again.
 */
import { describe, it, expect } from 'vitest';

const SOURCES = import.meta.glob('../src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Code that builds the key — not prose that names it in a comment. */
const USER_BLOCK_KEY = /[`'"]revoked:(\$\{|[`'"])|prefix:\s*[`'"]revoked:/;
const OLD_HELPER = /\bforceLogoutUser\s*\(|\[SUPABASE_PROJECT_REF]\s*\(|\[SUPABASE_PROJECT_REF]\s*\(/;

/** Deleted with its UI in the next task (Task 9), which also deletes this set. */
const PENDING_REMOVAL = new Set(['../src/pages/api/sessions/active-revocations.ts']);

describe('no user-level sign-in blocks', () => {
  it('scans the source tree', () => {
    expect(Object.keys(SOURCES).length).toBeGreaterThan(100);
  });

  it('no source file builds a revoked:<userId> key', () => {
    const offenders = Object.entries(SOURCES)
      .filter(([file, text]) => !PENDING_REMOVAL.has(file) && USER_BLOCK_KEY.test(text))
      .map(([file]) => file);
    expect(offenders).toEqual([]);
  });

  it('no source file calls the helpers that wrote one', () => {
    const offenders = Object.entries(SOURCES).filter(([, text]) => OLD_HELPER.test(text)).map(([file]) => file);
    expect(offenders).toEqual([]);
  });
});
```

In `test/pipeline-session.test.ts`, replace `it('a revoked-user flag ends the session the same way', ...)` with:

```ts
  it('a leftover revoked:<userId> key from before stage 2 no longer ends a session (OD-1)', async () => {
    const id = sessionId();
    await putSession(id);
    await env.SESSION.put(`revoked:${USER.id}`, '1');
    try {
      const { nextCalls } = await runPipeline({ path: '/dashboard', cookies: { admin_session: id } });
      expect(nextCalls).toBe(1);
    } finally {
      await env.SESSION.delete(`revoked:${USER.id}`);
    }
  });
```

In `test/pipeline-bootstrap.test.ts`, replace `it('a revocation flag blocks a fresh bootstrap for 24 h', ...)` with:

```ts
  it('a leftover revoked:<userId> key no longer refuses sign-in (OD-1)', async () => {
    await env.SESSION.put(`revoked:${USER.id}`, '1');
    try {
      const { nextCalls } = await runPipeline({ path: '/dashboard', headers: await headersFor(accessClaims()) });
      expect(nextCalls).toBe(1);
      expect((await loginLogRows())[0].failure_reason).toBeNull();
    } finally {
      await env.SESSION.delete(`revoked:${USER.id}`);
    }
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx vitest run test/sign-out.test.ts test/no-sign-in-blocks.test.ts test/pipeline-session.test.ts test/pipeline-bootstrap.test.ts`
Expected: FAIL — `sign-out` does not resolve; the guard lists `session-stage.ts`, `bootstrap.ts`, `plac.ts`, `session.ts`, `manage.ts` and others; the leftover-key cases are refused.

- [ ] **Step 3: Create the sign-out module**

Create `src/lib/auth/sign-out.ts`:

```ts
/**
 * Ending every session a user has (access revocation remediation, stage 2).
 *
 * Replaces forceLogoutUser and revokeSingleSession from plac.ts. Both also
 * wrote a 24-hour sign-in block that was invisible in the Users page, was
 * written by permission changes that meant no harm, and stranded the only
 * Owner on 2026-09-16. Keeping someone out is now exactly one thing —
 * deactivating the account (design OD-1). This module only ends sessions; the
 * user may sign in again at once unless they are deactivated.
 *
 * Order, and why:
 *   1. `revoked-session:<id>` for every live session BEFORE deleting it. KV is
 *      eventually consistent and getSession() keeps a 5-second isolate cache,
 *      so a deleted record can still be read for a while; the session stage
 *      refuses on this flag in that window.
 *   2. Delete the session records and their reverse-index keys.
 *   3. Mark the user's authorization changed, so a session this missed
 *      re-verifies against the directory on its next request.
 *   4. Revoke the user's Cloudflare Access tokens on every device. Access has
 *      no per-device revocation, and without this the browser silently opens a
 *      new portal session from its still-valid Access cookie.
 */
import { createAdminClient } from '../supabase';
import { sessionLifetimeSeconds } from './session';
import { markAuthzChanged } from './authz-signal';

export type SignOutEnv = Pick<
  CfEnv,
  'CF_API_TOKEN_ZT_WRITE' | 'CF_ACCOUNT_ID' | 'SUPABASE_SERVICE_ROLE_KEY' | 'PUBLIC_SUPABASE_URL' | 'SESSION_MAX_LIFETIME_MS'
>;

export interface SignOutResult {
  sessionsEnded: number;
  /**
   * Whether Cloudflare Access confirmed revoking the user's tokens. False when
   * credentials are missing, no identity is known, or the API refused; the
   * portal sessions are ended either way.
   */
  accessRevoked: boolean;
}

export const ACCESS_NOT_CONFIRMED_WARNING =
  "Portal sessions ended, but Cloudflare Access did not confirm revoking this user's tokens, so their browser can open a new portal session without signing in again.";

interface Identity { email?: string; cfSubId?: string }

export async function signOutEverywhere(
  kv: KVNamespace,
  userId: string,
  env: SignOutEnv,
  known: { email?: string } = {},
): Promise<SignOutResult> {
  const prefix = `user-session:${userId}:`;
  const { keys } = await kv.list({ prefix });
  const sessionIds = keys.map((k) => k.name.slice(prefix.length)).filter(Boolean);

  const identity = await [SUPABASE_PROJECT_REF](kv, sessionIds);
  identity.email ??= known.email;

  const expirationTtl = sessionLifetimeSeconds(env);
  await Promise.all(sessionIds.map((sid) => kv.put(`revoked-session:${sid}`, '1', { expirationTtl })));
  await Promise.all(sessionIds.flatMap((sid) => [kv.delete(`session:${sid}`), kv.delete(`${prefix}${sid}`)]));
  await markAuthzChanged(kv, [userId], env);

  if (!identity.email || !identity.cfSubId) {
    const fromDirectory = await identityFromDirectory(userId, env);
    identity.email ??= fromDirectory.email;
    identity.cfSubId ??= fromDirectory.cfSubId;
  }

  return { sessionsEnded: sessionIds.length, accessRevoked: await revokeAccessTokens(identity, env) };
}

async function [SUPABASE_PROJECT_REF](kv: KVNamespace, sessionIds: readonly string[]): Promise<Identity> {
  const identity: Identity = {};
  for (const sid of sessionIds) {
    const raw = await kv.get(`session:${sid}`);
    if (!raw) continue;
    try {
      const s = JSON.parse(raw) as { email?: string; cfSubId?: string };
      identity.email ??= s.email;
      if (s.cfSubId && s.cfSubId !== 'dev-bypass') identity.cfSubId ??= s.cfSubId;
    } catch {
      // silent-ok: a corrupt record is still deleted by the caller; identity
      // falls back to the directory.
    }
    if (identity.email && identity.cfSubId) break;
  }
  return identity;
}

async function identityFromDirectory(userId: string, env: SignOutEnv): Promise<Identity> {
  if (!env.PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return {};
  try {
    const { data } = (await createAdminClient(env as CfEnv)
      .from('admin_authorized_users')
      .select('email, cf_sub_id')
      .eq('id', userId)
      .single()) as { data: { email?: string; cf_sub_id?: string | null } | null };
    return {
      email: data?.email ?? undefined,
      cfSubId: data?.cf_sub_id && data.cf_sub_id !== 'dev-bypass' ? data.cf_sub_id : undefined,
    };
  } catch {
    // silent-ok: without an identity the Access revocation is skipped and the
    // result reports accessRevoked: false.
    return {};
  }
}

async function revokeAccessTokens(identity: Identity, env: SignOutEnv): Promise<boolean> {
  if ((!identity.email && !identity.cfSubId) || !env.CF_API_TOKEN_ZT_WRITE || !env.CF_ACCOUNT_ID) return false;

  const body: { devices: boolean; email?: string; user_uid?: string } = { devices: true };
  if (identity.email) body.email = identity.email;
  if (identity.cfSubId) body.user_uid = identity.cfSubId;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/access/organizations/revoke_user`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.CF_API_TOKEN_ZT_WRITE}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!res.ok) {
      console.error(`[SIGN_OUT] Cloudflare Access revocation failed (${res.status}):`, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SIGN_OUT] Cloudflare Access revocation error:', err);
    return false;
  }
}
```

- [ ] **Step 4: Delete the old helpers and readers**

- `src/lib/auth/plac.ts`: delete `fetchUserRevocationIdentity`, `executeLayer3Revocation`, `forceLogoutUser` (with its JSDoc), `revokeSingleSession` (with its JSDoc) and `import { createAdminClient } from '../supabase';`.
- `src/lib/auth/session.ts`: delete `writeRevocationFlag` and its JSDoc. In the header comment, change the bullet `cfSubId stored for Layer 3 CF API session revocation` to `cfSubId stored so sign-out can revoke Cloudflare Access tokens (sign-out.ts)`.
- `src/lib/auth/stages/session-stage.ts`: delete the `const userFlag = ...` line; change the read to `const values = await kv.get([sessionFlag, markKey]);` and the condition to `if (values.get(sessionFlag)) {`.
- `src/lib/auth/stages/bootstrap.ts`: delete the whole `if (await kv.get(\`revoked:${row.id}\`)) { ... }` block, and remove `CLEAR_COOKIES` from the `./decision` import (that block was its only use). In the file's header comment, change `whitelisted and active, not revoked, stored role` to `whitelisted and active, stored role`.
- `src/pages/index.astro`: delete the `access_revoked: { ... },` entry from `ERROR_DESCRIPTIONS`.

- [ ] **Step 5: Replace `force-kick.ts`**

Replace the whole of `src/pages/api/users/force-kick.ts` with:

```ts
import type { APIRoute } from 'astro';
import { requireAuth, AuthError } from '@/lib/auth/guard';
import { denyUsers } from '@/lib/auth/surface-guards';
import { authorizeTargetAction } from '@/lib/auth/target-guard';
import { signOutEverywhere, ACCESS_NOT_CONFIRMED_WARNING } from '@/lib/auth/sign-out';
import { getEnv, getCfContext } from '@/lib/env';
import { auditLog } from '@/lib/audit';
import { extractAuditContext, buildAuditDetails } from '@/lib/audit-helpers';
import { jsonOk, jsonError, jsonServerError, parseJsonBody } from '@/lib/api';
import { forceKickSchema } from '@/lib/schemas/users';

/**
 * DELETE /api/users/force-kick — sign a user out everywhere.
 *
 * Ends every portal session and revokes the user's Cloudflare Access tokens.
 * It does not stop them signing in again; deactivate the account for that
 * (access revocation remediation, OD-1).
 */
export const DELETE: APIRoute = async (context) => {
  try {
    const session = await requireAuth(context);

    const denied = denyUsers(session, 'force-kick');
    if (denied) return denied;

    const parsed = await parseJsonBody(context.request, forceKickSchema, 'force-kick request');
    if (!parsed.ok) return parsed.response;
    const { userId } = parsed.data;

    const env = getEnv(context);
    if (!env.SESSION) return jsonError(503, 'KV Session store unavailable');

    const guard = await authorizeTargetAction(env, session, { id: userId }, 'sign_out');
    if (!guard.ok) return jsonError(guard.status, guard.message);

    const result = await signOutEverywhere(env.SESSION, userId, env, { email: guard.target.email });

    const cfCtx = getCfContext(context);
    if (cfCtx?.waitUntil) {
      auditLog(cfCtx.waitUntil.bind(cfCtx), env.DB, {
        ...extractAuditContext(context),
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: 'force_logout',
        module: 'auth',
        targetId: userId,
        targetType: 'user',
        targetLabel: guard.target.email,
        ipHash: session.ipHash,
        details: buildAuditDetails({
          summary: 'Signed user out everywhere from the Users page',
          context: { sessionsEnded: result.sessionsEnded, accessRevoked: result.accessRevoked },
        }),
      });
    }

    return jsonOk({ ...result, ...(result.accessRevoked ? {} : { warning: ACCESS_NOT_CONFIRMED_WARNING }) });
  } catch (err: unknown) {
    if (err instanceof AuthError) return jsonError(err.status, err.message);
    return jsonServerError(err, context, 'Failed to sign the user out');
  }
};
```

- [ ] **Step 6: Replace `active-sessions.ts` and its schema**

In `src/lib/schemas/operations.ts`, replace the `sessionRevokeSchema` block with:

```ts
/** DELETE /api/sessions/active-sessions — sign one user out everywhere. */
export const [SUPABASE_PROJECT_REF] = z.object({
  userId: uuidSchema,
});
```

Replace the whole of `src/pages/api/sessions/active-sessions.ts` with:

```ts
import type { APIRoute } from 'astro';
import { requireAuth, AuthError } from '@/lib/auth/guard';
import { denySessions } from '@/lib/auth/surface-guards';
import { authorizeTargetAction } from '@/lib/auth/target-guard';
import { signOutEverywhere, ACCESS_NOT_CONFIRMED_WARNING } from '@/lib/auth/sign-out';
import { getEnv, getCfContext } from '@/lib/env';
import { auditLog } from '@/lib/audit';
import { extractAuditContext, buildAuditDetails } from '@/lib/audit-helpers';
import { [SUPABASE_PROJECT_REF] } from '@/lib/auth/session';
import { jsonOk, jsonError, jsonServerError, parseJsonBody } from '@/lib/api';
import { [SUPABASE_PROJECT_REF] } from '@/lib/schemas/operations';
import { getRateLimiter } from '@/lib/ratelimit';

/**
 * GET /api/sessions/active-sessions
 * Retrieve all currently active sessions from Workers KV.
 */
export const GET: APIRoute = async (context) => {
  try {
    const session = await requireAuth(context);
    const denied = denySessions(session);
    if (denied) return denied;

    const sessions = await [SUPABASE_PROJECT_REF](context);

    // Vendor support sessions are visible only to vendor support.
    const activeUser = (context.locals as App.Locals).user!;
    const finalSessions = sessions.map((s) => {
      if (s.role === 'vendor_support' && activeUser.role !== 'vendor_support') return null;
      return {
        sessionId: s.sessionId,
        userId: s.userId,
        email: s.email,
        displayName: s.displayName,
        role: s.role,
        loginMethod: s.loginMethod,
        createdAt: s.createdAt,
        lastActiveAt: s.lastActiveAt,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        geoLocation: s.geoLocation,
        rayId: s.rayId,
      };
    }).filter(Boolean);

    return jsonOk({ sessions: finalSessions, total: finalSessions.length });
  } catch (err: unknown) {
    if (err instanceof AuthError) return jsonError(err.status, err.message);
    return jsonServerError(err, context, 'Failed to fetch active sessions');
  }
};

/**
 * DELETE /api/sessions/active-sessions — sign one user out everywhere.
 *
 * There is no per-device revoke: Cloudflare Access can only revoke a user's
 * tokens on every device, and without that the device silently opens a new
 * session (design D8, OD-4). Deactivating an account is PATCH /api/users/manage.
 */
export const DELETE: APIRoute = async (context) => {
  try {
    const session = await requireAuth(context);
    const denied = denySessions(session, 'revoke');
    if (denied) return denied;

    const rl = getRateLimiter({ requests: 30, window: '1 m' }, 'session-revoke');
    const { success } = await rl.limit(session.userId);
    if (!success) return jsonError(429, 'Rate limit exceeded. Max 30 sign-outs per minute.');

    const parsed = await parseJsonBody(context.request, [SUPABASE_PROJECT_REF], 'sign-out request');
    if (!parsed.ok) return parsed.response;
    const { userId } = parsed.data;

    const env = getEnv(context);
    const kv = env.SESSION as KVNamespace | undefined;
    if (!kv) return jsonError(503, 'KV Session store unavailable');

    const guard = await authorizeTargetAction(env, session, { id: userId }, 'sign_out');
    if (!guard.ok) return jsonError(guard.status, guard.message);

    const result = await signOutEverywhere(kv, userId, env, { email: guard.target.email });

    const cfCtx = getCfContext(context);
    if (cfCtx?.waitUntil) {
      auditLog(cfCtx.waitUntil.bind(cfCtx), env.DB, {
        ...extractAuditContext(context),
        userId: session.userId,
        userEmail: session.email,
        userRole: session.role,
        action: 'force_logout',
        module: 'auth',
        targetId: userId,
        targetType: 'user',
        targetLabel: guard.target.email,
        ipHash: session.ipHash,
        details: buildAuditDetails({
          summary: 'Signed user out everywhere from the Sessions page',
          context: { sessionsEnded: result.sessionsEnded, accessRevoked: result.accessRevoked },
        }),
      });
    }

    return jsonOk({ ...result, ...(result.accessRevoked ? {} : { warning: ACCESS_NOT_CONFIRMED_WARNING }) });
  } catch (err: unknown) {
    if (err instanceof AuthError) return jsonError(err.status, err.message);
    return jsonServerError(err, context, 'Failed to sign the user out');
  }
};
```

- [ ] **Step 7: `manage.ts` — deactivation signs out; delete removes the row first**

Add `import { signOutEverywhere, ACCESS_NOT_CONFIRMED_WARNING, type SignOutResult } from '@/lib/auth/sign-out';` and remove `forceLogoutUser` from the `plac` import.

In PATCH, replace the `// On deactivation: ...` block, the `// On reactivation: ...` block, and the Task 3 `markAuthzChanged` line with:

```ts
    // Deactivation is the one way to keep someone out (design OD-1): the
    // directory now refuses them, and every live session ends here.
    let signOut: SignOutResult | null = null;
    if (is_active === false && env.SESSION) {
      try {
        signOut = await signOutEverywhere(env.SESSION, targetUser.id, env, { email: targetEmail });
      } catch (kickErr) {
        reportNonFatal('users.deactivate_sign_out', kickErr);
      }
    } else if (env.SESSION) {
      // Any other change alters what live sessions may do; they re-verify on
      // their next request.
      await markAuthzChanged(env.SESSION, [targetUser.id], env);
    }
```

In the PATCH audit `context`, replace `forceLogout: is_active === false,` with `sessionsEnded: signOut?.sessionsEnded ?? 0, accessRevoked: signOut?.accessRevoked ?? null,`. Replace the final `return jsonOk({ success: true });` with:

```ts
    return jsonOk(signOut && !signOut.accessRevoked ? { warning: ACCESS_NOT_CONFIRMED_WARNING } : {});
```

In DELETE, replace everything from `// Force-kick all active KV sessions (3-layer: KV delete + revocation flag + CF API)` through `if (dbError) throw dbError;` with:

```ts
    // The directory row goes first. Once it is gone the user is refused at
    // every sign-in, so a failure after this point cannot leave them able to
    // get back in; a failure before it leaves everything as it was.
    const { error: dbError } = await adminClient
      .from('admin_authorized_users')
      .delete()
      .eq('email', targetEmail);
    if (dbError) throw dbError;

    try {
      if (env.SESSION) await signOutEverywhere(env.SESSION, targetUser.id, env, { email: targetEmail });
    } catch (kickErr) {
      reportNonFatal('users.delete_sign_out', kickErr);
    }

    // Clean up all D1 page overrides for this user
    try {
      await resetUserOverrides(env.DB, targetUser.id);
    } catch (ovErr) {
      reportNonFatal('users.delete_reset_overrides', ovErr);
    }

    // Clean up D1 user settings row
    try {
      const userSettingsRepo = new UserSettingsRepository(env.DB);
      await userSettingsRepo.deleteUserSettings(targetUser.id);
    } catch (settingsErr) {
      reportNonFatal('users.delete_user_settings', settingsErr);
    }
```

- [ ] **Step 8: UI — Sessions page**

In `src/components/admin/users/sessions/[SUPABASE_PROJECT_REF].tsx`, replace the whole `handleRevoke` function with:

```tsx
  const handleSignOut = (s: ActiveSession) => {
    showConfirm(
      'Sign Out Everywhere',
      `End every session ${s.displayName || s.email} has, on all devices? Cloudflare Access will ask them to sign in again, and they can. To keep them out, deactivate the account instead.`,
      async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/sessions/active-sessions', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: s.userId }),
          });
          const data = await res.json() as any;
          if (res.ok && data.success) {
            setDrawerOpen(false);
            fetchActiveSessions();
            if (data.warning) showAlert('Signed Out, With a Warning', data.warning, 'default');
          } else showAlert('Sign-Out Failed', data.error || 'Sign-out failed', 'danger');
        } catch { showAlert('Network Error', 'Network failure signing the user out', 'danger'); }
        finally { setLoading(false); }
      },
      'danger',
    );
  };
```

Replace the whole `handleBlockAccount` function with:

```tsx
  const handleDeactivate = (s: ActiveSession) => {
    showConfirm(
      'Deactivate Account',
      `Deactivate ${s.displayName || s.email}? Every session ends, Cloudflare Access stops admitting them, and sign-in is refused until someone reactivates the account in Users.`,
      async () => {
        setLoading(true);
        try {
          const res = await fetch('/api/users/manage', {
            method: 'PATCH', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: s.email, is_active: false }),
          });
          const data = await res.json() as any;
          if (res.ok && data.success) {
            setDrawerOpen(false);
            fetchActiveSessions();
            if (data.warning) showAlert('Deactivated, With a Warning', data.warning, 'default');
          } else showAlert('Deactivation Failed', data.error || 'Deactivation failed', 'danger');
        } catch { showAlert('Network Error', 'Network failure deactivating the account', 'danger'); }
        finally { setLoading(false); }
      },
      'danger',
    );
  };
```

In `handleBlockUserManual`, replace the prompt message `Select a subordinate user to lock out immediately. All their active sessions will be destroyed and edge re-authentication will be blocked.` with `Select an account to deactivate. Every session ends and sign-in is refused until someone reactivates it in Users.`, and replace `showAlert('User Suspended', \`Sessions destroyed and edge access blocked for ${email}.\`, 'default');` with `showAlert('Account Deactivated', \`${email} is signed out everywhere and cannot sign in until reactivated.\`, 'default');`.

Replace `onRevoke={handleRevoke}` (both occurrences) with `onRevoke={handleSignOut}`, and `onBlockAccount={handleBlockAccount}` with `onBlockAccount={handleDeactivate}`.

In `ActiveSessionsPanel.tsx`, replace `aria-label={isSelf ? 'Your session' : 'Revoke session'}` with `aria-label={isSelf ? 'Your session' : 'Sign this user out everywhere'}`, `{isSelf ? 'Your session' : 'Revoke'}` with `{isSelf ? 'Your session' : 'Sign out'}`, `title="Block account & remove from Zero Trust whitelist"` with `title="Deactivate the account: sign-in refused until reactivated"`, and `⛔ Block` with `⛔ Deactivate`.

In `SessionDetailDrawer.tsx`, replace `{isSelf ? 'This is your session' : '⛔ Revoke Device Session'}` with `{isSelf ? 'This is your session' : '⛔ Sign Out Everywhere'}`.

In `SessionForensicsDrawer.tsx`, replace the whole `handleRevoke` function with:

```tsx
  const handleRevoke = async () => {
    confirmAction('Sign Out Everywhere', 'End every session this user has, on all devices? They can sign in again; deactivate the account to keep them out.', 'Sign out', 'danger', async () => {
      closeConfirm();
      try {
        const res = await fetch('/api/sessions/active-sessions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        });
        const data = await res.json() as any;
        if (res.ok && data.success) {
          fetchSessions();
        } else {
          confirmAction('Sign-Out Failed', data.error || 'Failed to sign the user out', 'OK', 'danger', () => closeConfirm(), true);
        }
      } catch {
        confirmAction('Network Error', 'Network failure signing the user out', 'OK', 'danger', () => closeConfirm(), true);
      }
    });
  };
```

Then replace its call site `onClick={() => handleRevoke(s.sessionId)}` with `onClick={() => handleRevoke()}`, and `{isSelf ? 'Current Session (Active)' : '⛔ Revoke Session'}` with `{isSelf ? 'Current Session (Active)' : '⛔ Sign Out Everywhere'}`.

In `src/components/admin/users/ExpandedRow.tsx`, in `handleForceKick` replace

```tsx
      title: 'Force Terminate Sessions',
      message: `Immediately terminate all active sessions for ${user.email} across all devices.`,
      confirmLabel: 'Terminate All',
```

with

```tsx
      title: 'Sign Out Everywhere',
      message: `End every session ${user.email} has, on all devices. Cloudflare Access will ask them to sign in again, and they can. To keep them out, deactivate the account.`,
      confirmLabel: 'Sign Out',
```

and after `const data = await res.json() as any;` in that handler add `if (data.warning) pushToast('warning', data.warning);`.

- [ ] **Step 9: Run the tests to verify they pass**

Run: `npx vitest run test/sign-out.test.ts test/no-sign-in-blocks.test.ts test/pipeline-session.test.ts test/pipeline-bootstrap.test.ts test/error-code-contract.test.ts test/permission-change-no-lockout.test.ts test/schemas.test.ts`
Expected: PASS. If `test/schemas.test.ts` names `sessionRevokeSchema`, change it to `[SUPABASE_PROJECT_REF]` with body `{ userId }`.

- [ ] **Step 10: Typecheck, ratchet, commit**

Run: `npm run typecheck && npm run ratchet`
Expected: exit 0. A8 may fall (fewer `try` blocks in routes). Record any fall with `--update`.

```bash
git rm test/plac-revocation.test.ts
git add src/lib/auth/sign-out.ts src/lib/auth/plac.ts src/lib/auth/session.ts src/lib/auth/stages/session-stage.ts src/lib/auth/stages/bootstrap.ts src/pages/index.astro src/pages/api/users/force-kick.ts src/pages/api/sessions/active-sessions.ts src/pages/api/users/manage.ts src/lib/schemas/operations.ts src/components/admin/users/sessions/[SUPABASE_PROJECT_REF].tsx src/components/admin/users/sessions/ActiveSessionsPanel.tsx src/components/admin/users/sessions/SessionDetailDrawer.tsx src/components/admin/users/sessions/SessionForensicsDrawer.tsx src/components/admin/users/ExpandedRow.tsx test/sign-out.test.ts test/no-sign-in-blocks.test.ts test/pipeline-session.test.ts test/pipeline-bootstrap.test.ts .ratchet.json
git commit -m "fix(auth): sign out without a sign-in block; deactivation is the only lockout

forceLogoutUser and revokeSingleSession are replaced by signOutEverywhere,
which ends sessions with per-session flags and revokes Access tokens but
writes no revoked:<userId> key. Nothing reads that key any more. Block
account becomes deactivate; per-device revoke becomes sign out everywhere.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

### Task 9: Retire the Edge Blocks surface and the `#unblock` permission

Covers D2 and D10. **The migration step needs the owner's sign-off before it is applied.**

**Files:**

- Delete: `src/pages/api/sessions/active-revocations.ts`, `src/components/admin/users/sessions/EdgeBlocksPanel.tsx`
- Modify: `src/components/admin/users/sessions/[SUPABASE_PROJECT_REF].tsx`, `sessionTypes.ts`; `src/pages/dashboard/sessions/index.astro`
- Modify: `src/lib/schemas/operations.ts` (delete `[SUPABASE_PROJECT_REF]`); `src/lib/auth/surface-guards.ts` (`SessionsAction`)
- Create: `migrations/0056_retire_sessions_unblock_permission.sql`
- Modify: `documentation/reference/schema-change-ledger.md`, `database/migrations.manifest.json` (via script)
- Test: `test/sessions-permissions.test.ts`

- [ ] **Step 1: Update the tests first**

In `test/no-sign-in-blocks.test.ts`, delete the `PENDING_REMOVAL` constant (and its comment) and change the filter back to `.filter(([, text]) => USER_BLOCK_KEY.test(text))`. Run `npx vitest run test/no-sign-in-blocks.test.ts` — expected FAIL naming `active-revocations.ts`; Step 2 makes it pass.

In `test/sessions-permissions.test.ts`: delete the `` [`${SESSIONS_PAGE}#unblock`]: true, `` line from `allowedEverything`, and replace the test `'denies one action without denying the others'` with:

```ts
  it('denies one action without denying the others', async () => {
    const user = admin({ ...allowedEverything, [`${SESSIONS_PAGE}#flush`]: false });
    expect(await denySessions(user, 'revoke')).toBeNull();
    expect((await denySessions(user, 'flush'))?.status).toBe(403);
  });
```

- [ ] **Step 2: Remove the surface**

```bash
git rm src/pages/api/sessions/active-revocations.ts src/components/admin/users/sessions/EdgeBlocksPanel.tsx
```

In `surface-guards.ts`, change `export type SessionsAction = 'revoke' | 'unblock' | 'flush' | 'export';` to `export type SessionsAction = 'revoke' | 'flush' | 'export';`. In `operations.ts`, delete the `[SUPABASE_PROJECT_REF]` block. In `sessionTypes.ts`, delete `export interface RevocationBlock { ... }`.

In `[SUPABASE_PROJECT_REF].tsx`:

- change `import type { ActiveSession, RevocationBlock, LoginLog } from './sessionTypes';` to `import type { ActiveSession, LoginLog } from './sessionTypes';` and delete `import { EdgeBlocksPanel } from './EdgeBlocksPanel';`
- rename the prop `canManageBlocks` to `canDeactivate` in `Props` (with the comment `/** Admin or above: may deactivate accounts from this page. */`) and at every use
- change `type TabId = 'active' | 'history' | 'blocks';` to `type TabId = 'active' | 'history';`
- delete `const [revocations, setRevocations] = useState<RevocationBlock[]>([]);`, the whole `fetchRevocations` function, the whole `handleLiftBlock` function, and `else if (activeTab === 'blocks') fetchRevocations();`
- in `handleBlockUserManual`, replace `activeTab === 'active' ? fetchActiveSessions() : fetchRevocations();` with `fetchActiveSessions();`
- replace the Refresh button's `onClick` body with `{ activeTab === 'active' ? fetchActiveSessions() : fetchLoginLogs(); fetchStats(); }`
- delete the `Edge Blocks` `MetricCard` block, the `blocks` `TabsTrigger` block, and the `{activeTab === 'blocks' && featureFlags.canDeactivate && (...)}` block

In `src/pages/dashboard/sessions/index.astro`, replace `const canManageBlocks = isSuperAdmin(session.role as Role);` with `const canDeactivate = isSuperAdmin(session.role as Role);` and `featureFlags={{ canManageBlocks, canFlushSessions }}` with `featureFlags={{ canDeactivate, canFlushSessions }}`.

- [ ] **Step 3: Write the migration (owner sign-off before applying)**

Create `migrations/0056_retire_sessions_unblock_permission.sql`:

```sql
-- Migration: 0056_retire_sessions_unblock_permission.sql
-- Description: Deactivates the two "#unblock" sub-permission rows. Numbering per
--              RULE #0.7b: cf-admin owns 0033+, 0056 is next above 0055. Data
--              only; no schema change.
--
-- Access revocation remediation, stage 2 (documentation/specs/
-- 2026-09-16-access-revocation-remediation-design.md). The user-level sign-in
-- block these rows let an administrator lift no longer exists, and neither does
-- the /api/sessions/active-revocations route that checked them. Left active,
-- the access-policy UI would keep offering a permission that controls nothing —
-- the defect class PERMISSIONS-SYSTEM.md records as gap D-4.
--
-- Deactivated, not deleted: admin_page_overrides rows may reference these paths,
-- and computeAccessMap already ignores inactive pages.

UPDATE admin_pages
SET is_active = 0
WHERE path IN ('/dashboard/sessions#unblock', '/dashboard/users/sessions#unblock');
```

Apply it locally and remotely with the procedure `documentation/operations/OPERATIONS.md` §7 gives for data migrations (the one used for `0055`), freeze it with `node scripts/migrations_manifest.mjs`, and add the ledger row to `documentation/reference/schema-change-ledger.md`. Then query it back — `wrangler` reports success even when a statement changed nothing:

```bash
npx wrangler d1 execute madagascar-db --remote --json --command "SELECT path, is_active FROM admin_pages WHERE path LIKE '%#unblock'"
```

Expected: two rows, both `is_active: 0`.

- [ ] **Step 4: Run the tests and ratchet, commit**

Run: `npx vitest run test/no-sign-in-blocks.test.ts test/sessions-permissions.test.ts test/api-authz-inventory.test.ts test/migrations-guard.test.ts test/migrations-replay.test.ts && npm run typecheck && npm run ratchet`
Expected: PASS. A18 cannot rise (a route left together with its UI); A17 falls by one component.

```bash
git add src/components/admin/users/sessions/[SUPABASE_PROJECT_REF].tsx src/components/admin/users/sessions/sessionTypes.ts src/pages/dashboard/sessions/index.astro src/lib/schemas/operations.ts src/lib/auth/surface-guards.ts migrations/0056_retire_sessions_unblock_permission.sql database/migrations.manifest.json documentation/reference/schema-change-ledger.md test/no-sign-in-blocks.test.ts test/sessions-permissions.test.ts .ratchet.json
git commit -m "refactor(sessions): retire the Edge Blocks surface and the #unblock permission

Its counts read an empty array until the tab was opened, which is why a real
block looked like 'No active blocks' on 2026-09-16. Nothing can create a
user-level block any more.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

(If `migrations_manifest.mjs` writes a different path than `database/migrations.manifest.json`, stage the file it reports.)

### Task 10: Stage 2 close-out — docs, verify, ship, sweep leftover keys

**Files:**

- Modify: `documentation/features/SESSION-MANAGEMENT.md`, `documentation/features/USER-MANAGEMENT.md`, `documentation/architecture/PERMISSIONS-SYSTEM.md`, `documentation/features/CFZT-EDGE-AUTHENTICATION.md`, `documentation/runbooks/incident-response.md`
- Create: `documentation/program/chunks/<ship-date>-ar2-access-revocation-stage-2.md`
- Modify: `documentation/README.md`, `documentation/program/ROADMAP.md` (`AR` row)

- [ ] **Step 1: Correct the docs**

Run: `grep -rn "revoked:\|3-layer\|Layer 2\|Layer 3\|force-kick\|Edge Block\|edge block\|unblock\|revokeSingleSession\|forceLogoutUser" documentation/features documentation/architecture documentation/runbooks`

Rewrite each hit to the model in design §4.3. In `SESSION-MANAGEMENT.md`, replace the "Authorization changes and re-verification" section from Task 5 with:

```markdown
## Ending sessions and keeping people out (2026-09-16)

There is one way to keep someone out: deactivate the account. Sign-in is then
refused with `account_inactive`, and the Cloudflare Access group sync removes
the email.

**Sign out everywhere** (Users → expanded row; Sessions → row action) ends every
portal session with a `revoked-session:<sessionId>` flag and revokes the user's
Cloudflare Access tokens on all devices. The user can sign in again at once.
Cloudflare Access cannot revoke a single device, so there is no per-device action.

A warm request reads `revoked-session:<sessionId>` and `authz-changed:<userId>`
in one bulk KV read. A new `authz-changed` mark makes the request re-verify role
and page map before it is authorised. Permission changes, role changes and
page-registry changes write the mark; none signs anyone out.

No user-level `revoked:<userId>` key is read or written
(`test/no-sign-in-blocks.test.ts`). The last active Owner cannot be deactivated,
deleted or demoted by anyone (`src/lib/auth/target-guard.ts`).
```

In `documentation/runbooks/incident-response.md`, the "compromised administrator" step becomes: deactivate the account in Users (this ends sessions and revokes Access tokens), then rotate what they could reach.

- [ ] **Step 2: Full gate**

Run: `npm run verify`
Expected: exit 0.

- [ ] **Step 3: Merge, ship, confirm the deployed SHA from Sentry**

Same as Task 5 Step 3.

- [ ] **Step 4: Sweep leftover keys (owner approves the delete)**

```bash
npx wrangler kv key list --namespace-id [CF_HEX_ID] --prefix "revoked:" --remote
```

The prefix `revoked:` does not match `revoked-session:`. Nothing reads these keys after this deploy and all expire within 24 h, so deleting them is housekeeping. Show the list to the owner, and for each name they approve:

```bash
npx wrangler kv key delete --namespace-id [CF_HEX_ID] "revoked:<userId>" --remote
```

- [ ] **Step 5: Confirm live in the browser, with the owner**

1. Sessions page: no Edge Blocks tile or tab; row actions read **Sign out** and **Deactivate**.
2. As vendor support, try to deactivate the only Owner in Users: a 409 with "This is the only active Owner…".
3. Sign a test staff account out everywhere: it can sign straight back in, and `revoked:<staffId>` does not exist.

- [ ] **Step 6: Record and commit the docs**

As Task 5 Step 5, for stage 2.

---

## Stage 3 — Access requests that can actually be granted

### Task 11: Refuse access requests a page permission cannot satisfy

Covers D11.

**Files:**

- Create: `src/lib/auth/access-requests.ts`
- Modify: `src/pages/api/access-requests/index.ts` (after body validation)
- Modify: `src/pages/api/audit/requests/[id]/resolve.ts` (after page validation)
- Modify: `src/components/ui/AccessDeniedView.astro` (frontmatter + button)
- Modify: `documentation/features/USER-MANAGEMENT.md`; create `documentation/program/chunks/<ship-date>-ar3-access-requests.md`; `documentation/README.md`; `documentation/program/ROADMAP.md`
- Test: `test/access-requests-grantable.test.ts` (create)

**Interfaces:**

- Consumes: `PageDefinition` (`src/lib/auth/plac.ts`), `getPageDefinition`.
- Produces: `whyAccessRequestCannotBeGranted(requesterRole: Role, page: Pick<PageDefinition, 'requiredRole'> | null): string | null`.

- [ ] **Step 1: Write the failing test**

Create `test/access-requests-grantable.test.ts`:

```ts
// test/access-requests-grantable.test.ts
/**
 * The 2026-09-16 incident began with a request no page permission could
 * satisfy: the Owner asked for /dashboard/debug, which checks for vendor
 * support in page code, while an Owner already passes every page-level check.
 * The approval changed nothing except to lock the account (design D11).
 */
import { describe, it, expect } from 'vitest';
import { whyAccessRequestCannotBeGranted } from '../src/lib/auth/access-requests';

describe('whyAccessRequestCannotBeGranted', () => {
  it('refuses a request from an Owner or vendor support', () => {
    expect(whyAccessRequestCannotBeGranted('owner', { requiredRole: 'vendor_support' })).toMatch(/already passes every page permission/);
    expect(whyAccessRequestCannotBeGranted('vendor_support', { requiredRole: 'admin' })).toMatch(/already passes every page permission/);
  });

  it('refuses a page reserved for vendor support', () => {
    expect(whyAccessRequestCannotBeGranted('admin', { requiredRole: 'vendor_support' })).toMatch(/reserved for vendor support/);
  });

  it('allows an ordinary request, including for a path the registry does not list', () => {
    expect(whyAccessRequestCannotBeGranted('manager', { requiredRole: 'admin' })).toBeNull();
    expect(whyAccessRequestCannotBeGranted('staff', null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run test/access-requests-grantable.test.ts`
Expected: FAIL — `access-requests` does not resolve.

- [ ] **Step 3: Create the rule**

Create `src/lib/auth/access-requests.ts`:

```ts
/**
 * Whether a page permission could ever satisfy an access request (access
 * revocation remediation, D11).
 *
 * An Owner and vendor support already pass every page-level check (ADR-0002
 * answer 2), so when they reach an Access Denied page it is a role check in the
 * page's own code, and no permission changes that. A page whose registry role is
 * vendor_support is gated the same way. A path the registry does not list is
 * allowed through: its ancestor may be grantable.
 */
import { ROLES, type Role } from './rbac';
import type { PageDefinition } from './plac';

export function whyAccessRequestCannotBeGranted(
  requesterRole: Role,
  page: Pick<PageDefinition, 'requiredRole'> | null,
): string | null {
  if (requesterRole === ROLES.OWNER || requesterRole === ROLES.VENDOR_SUPPORT) {
    return 'Your role already passes every page permission, so this page is limited by role in its own code and a permission cannot open it.';
  }
  if (page?.requiredRole === ROLES.VENDOR_SUPPORT) {
    return 'This page is reserved for vendor support and cannot be granted.';
  }
  return null;
}
```

- [ ] **Step 4: Enforce it when filed and when approved**

In `src/pages/api/access-requests/index.ts`, add imports:

```ts
import { getPageDefinition } from '../../../lib/auth/plac';
import { whyAccessRequestCannotBeGranted } from '../../../lib/auth/access-requests';
```

Directly after the `if (!env.DB) { ... }` block, add:

```ts
    const refusal = whyAccessRequestCannotBeGranted(user.role, await getPageDefinition(env.DB, requestedPath));
    if (refusal) return jsonError(422, refusal);
```

In `src/pages/api/audit/requests/[id]/resolve.ts`, add `import { whyAccessRequestCannotBeGranted } from '../../../../../lib/auth/access-requests';` and directly after the `if (!pageDef) { ... }` block inside the approval branch, add:

```ts
      const refusal = whyAccessRequestCannotBeGranted(verifiedTargetRole, pageDef);
      if (refusal) return jsonError(422, refusal);
```

- [ ] **Step 5: Hide the button where it cannot help**

In `src/components/ui/AccessDeniedView.astro` frontmatter, after `const { userRole, title = 'Access Restricted', message } = Astro.props;`, add:

```ts
// An Owner or vendor support reaching this view is stopped by a role check in
// the page's own code; a page permission cannot change that (design D11).
const canRequestAccess = !['owner', 'vendor_support'].includes((userRole || '').toLowerCase());
```

Wrap the `<button id="request-access-btn" ...>...</button>` element in `{canRequestAccess && ( ... )}`. The client script already returns when the button is absent.

- [ ] **Step 6: Run the tests, full gate, commit, ship**

Run: `npx vitest run test/access-requests-grantable.test.ts test/permission-change-no-lockout.test.ts && npm run verify`
Expected: PASS / exit 0. The approval test in `permission-change-no-lockout.test.ts` uses an Admin requester and `/dashboard/settings`, so it still passes.

Update `USER-MANAGEMENT.md` (access requests section) with the two refusal cases, write the stage 3 chunk record, add its index row, update the `AR` row, run markdownlint, then:

```bash
git add src/lib/auth/access-requests.ts src/pages/api/access-requests/index.ts "src/pages/api/audit/requests/[id]/resolve.ts" src/components/ui/AccessDeniedView.astro test/access-requests-grantable.test.ts documentation/features/USER-MANAGEMENT.md documentation/program/chunks/<ship-date>-ar3-access-requests.md documentation/README.md documentation/program/ROADMAP.md
git commit -m "fix(access-requests): refuse requests no page permission can satisfy

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Ship as in Task 5 Step 3.

---

## Coverage check (design → task)

| Design item | Task |
| --- | --- |
| D1 permission changes write a block | 1 (mechanism), 3 (callers) |
| D2 invisible block | 9 (surface retired; nothing to hide after 8) |
| D3 reconcile purge | 4 |
| D4 outage during re-check | 1 |
| D5 registry vocabulary | 3 |
| D6 force-kick fragment | 7 |
| D7 block_account gaps | 6 (hierarchy, self), 8 (block becomes the checked deactivate path) |
| D8 org-wide device revoke | 8 (OD-4) |
| D9 automatic Access logout | 2 |
| D10 lift leaves account inactive | 9 |
| D11 ungrantable access requests | 11 |
| D12 sign-in outage as "not authorized" | 2 |
| D13 TTL drift, dead delete | 4 (dead delete), 8 (single TTL helper) |
| D14 last Owner | 6 |
| OD-1 … OD-5 | 8, 1, 6, 8, 6 |
