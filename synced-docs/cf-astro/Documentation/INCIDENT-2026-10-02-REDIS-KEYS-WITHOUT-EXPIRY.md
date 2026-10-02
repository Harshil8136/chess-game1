{% raw %}
# Incident: rate-limit analytics kept visitor IPs in Redis with no expiry (2026-10-02)

- **Severity**: Medium — a retention deviation, not an outage. Raw visitor IP addresses were kept longer than the platform's privacy records said; no request failed and no data left the platform's own database.
- **Window**: 2026-04-07 (analytics switched on) → 2026-10-02 03:40 UTC (last key expired). The keys that survived to the fix date back to 2026-08-07 21:00 UTC.
- **Impact**: 508 Redis keys written by this site had no expiry, holding the raw IPv4 addresses of **179 distinct visitors** who hit `/api/consent`, `/api/booking`, `/api/contact` or the `admin`-limited routes (mostly monitoring probes on `/api/health`). The public privacy policy's 90-day target for raw-IP security logs was **not** crossed: the oldest key was 56 days old.
- **Detected**: 2026-10-01, by the owner, in the Upstash console ("hundreds of stale keys").
- **Shared with**: cf-admin (140 more keys of the same kind) and cf-chatbot (same Upstash instance, not part of the leak). The platform-wide record — timeline, verification, the weekly check that now guards the instance — is cf-admin's `documentation/operations/incidents/2026-10-02-redis-keys-without-expiry.md`.

---

## 1. What Happened

`src/lib/rate-limit.ts` built its Upstash limiter with `analytics: true`. With
that option, every `limit()` call in `@upstash/ratelimit` 2.0.8 also records the
caller through `@upstash/core-analytics`:

```text
ZINCRBY madagascar:{endpoint}:events:{hourBucketMs} 1 {"identifier":"<client IP>","success":true}
```

One sorted set per endpoint per hour that saw traffic. Nothing ever set an
expiry on them, and nothing in the site, cf-admin or cf-chatbot ever read them.

| Endpoint key | Keys | Notes                                                                          |
| ------------ | ---- | ------------------------------------------------------------------------------ |
| `admin`      | 354  | Mostly monitoring probes on `/api/health` (3,844 of the 4,265 recorded checks) |
| `consent`    | 140  | Cookie-banner submissions                                                      |
| `booking`    | 8    | Booking submissions                                                            |
| `contact`    | 6    | Contact-form submissions                                                       |

The sliding-window rate-limit counters themselves were never affected: they
expire after 2 × the window + 1 s (121 s here, every window being 60 s).

---

## 2. Root Cause Analysis

### Cause 1: the library ignores its own retention option (dependency behaviour)

`@upstash/ratelimit` constructs its analytics client with `retention: "90d"`.
`@upstash/core-analytics` 0.0.10 — the version it depends on — reads only
`redis`, `prefix` and `window` in its constructor, and its `ingest()` is a bare
`ZINCRBY`. The option is accepted and silently dropped.

### Cause 2: a feature nobody used, switched on by default (code)

`analytics: true` came in with the limiter on 2026-04-07 (`75ce3c6`). No code
calls the analytics read API, so the data had no reader — only cost.

### Cause 3: a symptom treated, not the cause (process)

The oldest surviving key dates from 2026-08-07, the day a one-off sweep script
outside this repository was last modified. It gives every expiry-less key a
default expiry. Most likely it was run then: the older keys expired, the writer
kept writing, and the build-up started again. Nothing else records that sweep.

### Related gap found and fixed: an Upstash timeout skipped the KV fallback

On a timeout the library does not throw; after 5 s it answers
`{ success: true, reason: 'timeout' }`. `checkRateLimit` read that as "allowed",
so a slow Upstash let every request through without consulting the KV fallback
that `AGENTS.md` invariant #3 and ADR-0001 describe for an unreachable Upstash.

---

## 3. Remediation & Verification

| Change                                                                                                                       | Commit    | Verified by                                                                             |
| ---------------------------------------------------------------------------------------------------------------------------- | --------- | --------------------------------------------------------------------------------------- |
| `analytics: false`                                                                                                           | `5c83638` | `test/rate-limit-analytics.test.ts`; live probe after deploy (below)                    |
| Explicit 3 s Upstash timeout; a timeout goes to the KV fallback                                                              | `5c83638` | `test/rate-limit-timeout.test.ts` (over-limit refused by KV, under-limit counted in KV) |
| Alert-gate list written as one checked `POST /multi-exec` (`LPUSH`, `LTRIM`, `EXPIRE`), non-2xx reported as a failed channel | `e5bd786` | `test/alert-gate.test.ts`                                                               |
| Ratchet re-baselined with reason (B4 +27 lines)                                                                              | `e5bd786` | `npm run verify`: 241/241 tests, every gate green                                       |

- **Deployed** 2026-10-02 02:19 UTC (version `87d1e42f…`); docs follow-up deployed 03:08 UTC (`1a76ac0e…`).
- **Live probe** 02:37 UTC: one unauthenticated `GET /api/health/` (→ 401) wrote one sliding-window key expiring in 118 s and **no** `:events:` key.
- **Cleanup** 02:39 UTC, run from cf-admin's hygiene code: every leftover key given a one-hour expiry (`EXPIRE … NX`) instead of being deleted — an hour to undo it, and no copy of the IPs kept. Census at 02:39:50: 0 keys without an expiry. After 03:40 none of the 508 remained.
- **Guard**: cf-admin's weekly `redis-ttl-hygiene` job (Sunday 02:00 UTC) reports — and repairs — any key on the shared instance without an expiry, this site's included.

---

## 4. Rules that came out of it

- `AGENTS.md` invariant #3 now says a timeout is "Upstash unavailable" and goes to
  the KV fallback, and a new invariant says every Redis key expires and limiter
  analytics stay off.
- [`adr/0001-fail-open-rate-limiting.md`](adr/0001-fail-open-rate-limiting.md)
  carries an amendment for the timeout path; the fail-open decision is unchanged.
- `SECURITY.md` §4 and [`COMPLIANCE-SECURITY-AND-HISTORY.md`](COMPLIANCE-SECURITY-AND-HISTORY.md)
  state the key expiry and the timeout behaviour.

{% endraw %}
