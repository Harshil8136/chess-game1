{% raw %}
# Incident: Booking Outbox Drain Replay 401 Auth Failure (2026-09-02)

- **Severity**: Low to Medium — automated outbox drain poke failed with HTTP 401; primary customer booking submissions and direct D1 writes were unaffected.
- **Window**: 2026-08-30 23:31 UTC → 2026-09-02 21:52 UTC
- **Impact**: The scheduled 5-minute cron in `cf-admin` (`pokeBookingOutboxDrain`) received HTTP 401 on every tick when poking `POST https://madagascarhotelags.com/api/booking/replay/`. Any deferred bookings requiring replay from D1 into Supabase were delayed until manual trigger or heartbeat reconciliation.
- **Detected**: 2026-09-02, from Cloudflare Worker logs (`[WARN] Auth failed for /api/booking/replay ` and `[CRON] booking-outbox: drain poke returned HTTP 401`).
- **Volume**: 1 warning logged every 5 minutes from `cf-admin`'s scheduled cron tick. Zero customer bookings were lost (D1 audit showed 0 `queue_error` or `db_error` rows).

---

## 1. What Happened

`cf-admin` runs a 5-minute scheduled cron (`src/workers/scheduled-booking-retry.ts:pokeBookingOutboxDrain`) that calls `POST /api/booking/replay/` on `cf-astro` with:
```typescript
const secret = env.REVALIDATION_SECRET || env.HEALTH_CHECK_SECRET;
// Authorization: Bearer <secret>
```

The endpoint in `cf-astro` rejected the incoming requests with `HTTP 401 Unauthorized: {"error":"Unauthorized."}`.

---

## 2. Root Cause Analysis

### Cause 1: Secret Comparison Logical Short-Circuit (Code Defect)
In the deployment running in production (version `[D1_DATABASE_ID]`, deployed on 2026-08-30), `src/pages/api/booking/replay.ts` evaluated authentication as:
```typescript
const secret =
  runtimeEnv.HEALTH_CHECK_SECRET ||
  runtimeEnv.REVALIDATION_SECRET ||
  import.meta.env.HEALTH_CHECK_SECRET ||
  import.meta.env.REVALIDATION_SECRET;

const provided = request.headers.get('Authorization')?.replace('Bearer ', '') ?? '';
if (!timingSafeEq(provided, secret)) {
  log.warn('Auth failed for /api/booking/replay');
  return json({ error: 'Unauthorized.' }, 401);
}
```
Because `HEALTH_CHECK_SECRET` was configured in Cloudflare Workers secrets, the JavaScript `||` operator short-circuited and selected `HEALTH_CHECK_SECRET`, completely ignoring `REVALIDATION_SECRET`.

Because `cf-admin` sent `REVALIDATION_SECRET` (which has a different value from `HEALTH_CHECK_SECRET`), the timing-safe string comparison failed on every invocation.

### Cause 2: Deployment Blocked by Lockfile Desynchronization
On 2026-09-02, commit `ad004d2` introduced `verifyBearerAuth` to check an array of candidate secrets in constant time (`[HEALTH_CHECK_SECRET, REVALIDATION_SECRET]`).

However, commit `ad004d2` updated dependencies in `package.json` without updating `package-lock.json` for Linux platforms (`workerd@1.20260831.1`, `@cloudflare/workerd-linux-64`, etc.). When pushed to GitHub, GitHub Actions CI failed at `npm ci`:
```text
npm error Missing: workerd@1.20260831.1 from lock file
npm error Missing: @cloudflare/workerd-linux-64@1.20260831.1 from lock file
```
Because the CI quality gate failed, the fix was never deployed to Cloudflare Workers, leaving the legacy August 30 code serving in production.

### Cause 3: Unnecessary Public Internet Round-Trip
`cf-admin`'s `pokeBookingOutboxDrain` targeted `https://madagascarhotelags.com/api/booking/replay/` via `fetch()`, incurring public DNS resolution, egress latency, and public edge rate limiting, despite already having the internal `ASTRO_SERVICE` Service Binding defined in `wrangler.toml`.

---

## 3. Remediation & Verification

1. **Lockfile & Code Style Synchronization**:
   - Synchronized `package.json` with `package-lock.json` in `cf-astro` so `npm ci` executes with zero discrepancies across all environments.
   - Formatted `src/lib/security.ts` and `test/endpoints.test.ts` with Prettier to pass `format:check`.
   - Pushed commits `3310f64` and `8035806` to `origin main`.
   - CI passed 100% clean; Cloudflare Workers Builds deployed script version **`[D1_DATABASE_ID]`**.

2. **Internal Service Binding Adoption**:
   - Updated `pokeBookingOutboxDrain` in `cf-admin/src/workers/scheduled-booking-retry.ts` to use `env.ASTRO_SERVICE.fetch('https://internal/api/booking/replay/')` when available, eliminating public internet round-trips.

3. **Live Production Validation**:
   - Probed `POST https://madagascarhotelags.com/api/booking/replay/` with `REVALIDATION_SECRET`: returned `HTTP 200 OK` (`{"success":true,"claimed":0,"replayed":0,"failed":0,...}`).
   - Probed with invalid bearer token: returned `HTTP 401 Unauthorized` (`{"success":false,"error":"Unauthorized."}`).
   - Queried `madagascar-db` D1: confirmed 0 failed/pending booking rows.
   - Sentry organization check: 0 unresolved issues.

{% endraw %}
