{% raw %}
# Secondary Findings

Bugs uncovered during this investigation that are **not** the root cause of the email outage, but are worth addressing.

---

## S1 — Drizzle silently drops `emailError` on failed rows  ⚠️ HIGH

**Where:** [`cf-email-consumer/src/db.ts`](../../../cf-email-consumer/src/db.ts) defines `emailAuditLogs` without an `emailError` column. [`cf-email-consumer/src/index.ts:315`](../../../cf-email-consumer/src/index.ts#L315) writes `emailError: String(err)` but casts to `as any`.

**Effect:** Drizzle builds the `UPDATE` SQL from the columns it knows about, so `email_error` stays `NULL`. The error string only ever lands in `console.error`, which is ephemeral — it's visible in `wrangler tail` for ~minutes and in the Workers Analytics Logs tail for ~3 days on the Free plan, then gone.

**Why it's dangerous:** the email pipeline has been in a silently-failing state since at least **2026-04-17 02:02 UTC**. The user only noticed on **2026-04-18 02:30** — a 24h+ window, during which 5 real customer bookings were processed and nobody saw anything amiss in the DB. Had this column been wired correctly, the DBA query in step 6b of [02-FULL-INVESTIGATION.md](./02-FULL-INVESTIGATION.md) would have returned `email_error='EvalError: Code generation…'` on the very first run — cutting time-to-diagnosis from "multi-hour excavation" to "one SELECT".

**Fix:** part of P1 in [05-FIX-PLAN.md](./05-FIX-PLAN.md). Add `emailError: text('email_error')` to both consumer and producer schemas and drop the `as any`.

---

## S2 — Redirect rule for `pet.` subdomain never created  ⚠️ MEDIUM

**Where:** [`cf-astro/wrangler.toml`](../../wrangler.toml) contains comments describing a Cloudflare Dashboard Redirect Rule:

> `pet.madagascarhotelags.com/* → https://madagascarhotelags.com/$1` (301)

**Reality:** `curl https://pet.madagascarhotelags.com/en/booking/` returns **200 OK** — the apex and the `pet.` subdomain are both live and serving the same content because both custom hostnames are still routed to the `cf-astro` Worker.

**Effect:**

- SEO split: Google may index both hostnames and apply duplicate-content penalties.
- Confused users following old links land on `pet.` and don't see the new domain.
- Any cookies scoped to the new apex won't carry across.

**Not the outage's cause:** the consumer talks Worker↔Supabase↔Resend server-to-server and never touches any public hostname. The bundle, API, and booking happy path all live on the apex and work fine.

**Fix:** create the Redirect Rule in Cloudflare Dashboard → Rules → Redirect Rules for zone `madagascarhotelags.com`:

```
If: (http.host eq "pet.madagascarhotelags.com")
Then: Dynamic → concat("https://madagascarhotelags.com", http.request.uri.path)
      Status: 301
      Preserve query string: on
```

Tracked as **P4** in [05-FIX-PLAN.md](./05-FIX-PLAN.md).

---

## S3 — `RULES.md` §6.5 contradicts platform reality  ⚠️ HIGH

**Where:** [`cf-astro/RULES.md`](../../RULES.md) §6.5 currently lists Eta as an approved templating option for Workers.

**Effect:** the rule caused (or at least didn't prevent) the 04-17 redeploy. Anyone reading the rules before writing the next email template will happily reach for Eta and reproduce the outage.

**Fix:** replace §6.5 per the wording in P3 of [05-FIX-PLAN.md](./05-FIX-PLAN.md) and P-1 of [08-PREVENTION.md](./08-PREVENTION.md).

---

## S4 — `as any` casts hide schema drift  ⚠️ MEDIUM

**Where:** [`cf-email-consumer/src/index.ts:315`](../../../cf-email-consumer/src/index.ts#L315):

```ts
.set({ status: 'failed', emailError: String(err), updatedAt: new Date() } as any)
```

**Why it exists:** the `emailError` property isn't in the Drizzle type, so TS complains; the `as any` silences it.

**Why it's bad:** Drizzle's type system is a correctness tool. Casting away its objections is exactly how fields get dropped silently. This one `as any` is the direct mechanism by which S1 happened.

**Fix:** grep the consumer and producer for `as any` and remove them one at a time, fixing the underlying schema/type mismatch that each one is hiding. Add a lint rule (`@typescript-eslint/no-explicit-any`) scoped to `cf-email-consumer/**` and `cf-astro/src/lib/db/**` to prevent reintroduction.

---

## S5 — `cf-astro.pages.dev` returns 404 (benign but worth noting)

**Where:** the historical Cloudflare Pages URL.

**Effect:** 404 — expected, because the project migrated off Pages to a Workers deploy. No action needed, but documenting here so the next investigator doesn't waste a minute wondering whether this is part of the outage. It is not.

---

## S6 — Queue DLQ has no consumer and no alert  ⚠️ MEDIUM

**Where:** [`wrangler queues list`](./04-EVIDENCE-AND-LOGS.md#9-wrangler--queue-health) shows `madagascar-emails-dlq: producers=0, consumers=0`.

**Effect:** when a message exhausts retries it lands in the DLQ and sits there forever. Nothing reads the DLQ; nothing alerts on its depth. All 10+ failed-then-DLQ'd emails from this incident are still sitting in the DLQ right now.

**Fix:**

1. **Short-term:** add a Cloudflare Analytics alert on queue `madagascar-emails-dlq` backlog > 0. Tracked as P5 in [05-FIX-PLAN.md](./05-FIX-PLAN.md).
2. **Medium-term:** bind a lightweight worker as a DLQ consumer that writes every message to `email_audit_logs` with `status='dlq'` and `payload` preserved — so the DB is always the source of truth for "messages that never reached their destination".
3. **Recovery:** the current DLQ contents are recoverable by re-publishing to `madagascar-emails` — see [07-RUNBOOK-RECOVERY.md](./07-RUNBOOK-RECOVERY.md).

---

## S7 — No consumer smoke test in CI

**Where:** `cf-email-consumer/` has no test suite that imports and invokes the handler.

**Effect:** the deploy on 2026-04-17 shipped a handler that fails on 100% of input and nothing automated caught it. A single `describe('queue', …)` test calling the handler with a mocked `MessageBatch` and mocked `fetch` would have thrown `EvalError` at `npm test` time.

**Fix:** P5 in [05-FIX-PLAN.md](./05-FIX-PLAN.md) and [08-PREVENTION.md](./08-PREVENTION.md).

---

## Overall pattern

The outage is not one bug — it's three bugs compounding:

1. A bad library choice (Eta on Workers) produced the failure.
2. A schema drop masked the failure in the DB.
3. No DLQ monitoring, no consumer smoke test, and no "zero emails in 24h" alert meant nothing detected the failure for a full day.

Any one of those three being fixed would have made this a 15-minute incident instead of a 24-hour one. Fix all three in this remediation.

{% endraw %}
