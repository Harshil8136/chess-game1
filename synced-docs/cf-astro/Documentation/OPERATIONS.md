{% raw %}
# cf-astro Operations Reference

**Date:** 2026-06-18 — §4 and §5 corrected 2026-09-15 against `wrangler.toml`, the account KV list (Cloudflare API) and `SYSTEM-ARCHITECTURE.md` §4; §6 and §7 added 2026-10-07 (the 2026-10-04 resource-usage plan) from `wrangler.toml` (not re-checked against the live Worker, which has not been deployed with them yet)

This document outlines the core infrastructure bindings and the CLI commands used to manage and verify the Cloudflare resources attached to `cf-astro`.

## 1. Authentication

All Cloudflare commands are authenticated via an OAuth Token for `[CF_ACCOUNT_EMAIL]` (Account ID: `REDACTED_VIA_OAUTH`).

**Verify access:**

```bash
npx wrangler whoami
```

## 2. D1 Database (`madagascar-db`)

Serves as the authoritative source for non-PII configurations and queues.

- **Binding ID:** `[D1_MADAGASCAR_DB_ID]`
- **Region:** ENAM
- **Verify status:**

```bash
npx wrangler d1 info madagascar-db
```

## 3. R2 Buckets

Used for secure identity document storage and public CMS images.

- `arco-documents` (ARCO legal documents)
- `madagascar-images` (Public CMS gallery)
- **Verify status:**

```bash
npx wrangler r2 bucket list
```

## 4. KV Namespaces

Used for SSR rendering caches and session state. The key families inside
`ISR_CACHE` (pages, CMS blocks, feeds, rate-limit fallback counters) and their
expiries are listed in `SYSTEM-ARCHITECTURE.md` §3.2.

- `SESSION`
- `ISR_CACHE`
- `CHATBOT_CACHE`
- `CHATBOT_KV`
- `ADMIN_SESSION`
- `EMAIL_IDEMPOTENCY` (the email consumer's dedupe namespace; 6 namespaces on the account as of 2026-09-15)
- **Verify status:**
  _(Note: `npx wrangler kv:namespace list` is deprecated; use the exact syntax below)_

```bash
npx wrangler kv namespace list
```

## 5. Queues

Decouples email delivery and syncing from user API requests.

- `madagascar-emails` (email sending by the shared `cf-astro-email-consumer` Worker — Brevo primary, Resend as same-request failover; see `SYSTEM-ARCHITECTURE.md` §4)
- `madagascar-emails-dlq` (Dead-letter queue)
- `madagascar-sync-revalidate` (Sync events)
- `madagascar-sync-revalidate-dlq` (Dead-letter queue)
- **Verify status:**

```bash
npx wrangler queues list
```

## 6. Rate Limiting bindings (since 2026-10-04)

The Workers Rate Limiting binding replaced Upstash Redis for the site's rate
limits ([change record](./records/2026-10-04-resource-usage.md),
[ADR-0001 amendment](./adr/0001-fail-open-rate-limiting.md)).

- Ten `[[ratelimits]]` bindings in `wrangler.toml`, `RL_PER_MIN_3` …
  `RL_PER_MIN_1000`: one per step of the ladder 3, 5, 10, 20, 30, 60, 100, 200,
  500, 1000 requests a minute. A binding's limit is fixed in the deploy, so a
  value set in cf-admin's Service Config uses the next step up.
- Each binding's `namespace_id` is `10000 + limit`. The number is shared by any
  Worker on the account that uses it, and cf-admin's own ladder uses `2000 + limit`,
  so the two never share counters. Never reuse a number for a different limit.
- No secret and no outbound call. When a binding is missing or throws, the KV
  counters in `ISR_CACHE` decide, and when KV fails too the request is allowed
  (fail-open, AGENTS.md invariant #3).
- `test/rate-limit-binding.test.ts` fails the build if `wrangler.toml` and
  `RATE_LIMIT_BINDING_LIMITS` in `src/lib/rate-limit.ts` disagree.

**Owner follow-ups from the Upstash retirement** (tracked in
[`TODO-BACKLOG.md`](./TODO-BACKLOG.md)):

1. After the first deploy, read the Workers Builds log: wrangler must accept the
   `[[ratelimits]]` bindings, and a form post on the live site must still work.
2. Delete the retired secret from this Worker:
   `npx wrangler secret delete UPSTASH_REDIS_REST_TOKEN`.
3. Do **not** delete the Upstash database from here: cf-admin and cf-chatbot
   still use it. It goes once they stop.

## 7. Observability sampling (since 2026-10-04)

`wrangler.toml` `[observability]` persists Workers Logs for 20% of invocations
and traces for 5% (both were 100%). A request that is sampled out keeps no
console line in Cloudflare, so look for a single request's error in Sentry or
BetterStack first: errors a route captures reach Sentry unsampled, and
`log.warn`/`log.error` also go to BetterStack. To see every request again for an
investigation, set `head_sampling_rate = 1` in `[observability.logs]` and deploy;
put it back afterwards (the free plan allows 200,000 log events a day).

---

_For further architectural guidelines on how these interact with Astro, see `SYSTEM-ARCHITECTURE.md`._

{% endraw %}
