---
title: "Cloudflare Deploy Fails: Queue Handler Is Missing (code 11001)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-19
verified_against: [code, infra]
owner: harshil
related_code: [wrangler.toml, src/workers/cf-entry.ts, src/workers/sync-revalidate-consumer.ts, test/worker-entry-contract.test.ts]
---

# Cloudflare Deploy Fails: Queue Handler Is Missing (code 11001)

## Symptom

Cloudflare Workers Builds shows a **green build and a red deploy**. `npm run build`
completes, all 115+ assets upload, every binding resolves — and then:

```text
✘ [ERROR] A request to the Cloudflare API
  (/accounts/<id>/workers/scripts/cf-admin-madagascar/versions) failed.

  Queue handler is missing. Please see our docs for more information about
  creating handlers: .../queues/configuration/javascript-apis/#consumer. [code: 11001]

Failed: error occurred while running deploy command
```

Production silently stays on the last successfully deployed version while `main`
moves ahead. Nothing in the build output flags this — the deploy is the only
place it surfaces.

## Cause

`wrangler.toml` lost its `main` entrypoint.

`@astrojs/cloudflare` generates the config that is actually deployed
(`dist/server/wrangler.json` — "Using redirected Wrangler configuration" in the
log). Its customizer resolves the entrypoint as:

```js
// node_modules/@astrojs/cloudflare/dist/wrangler.js
main: config.main ?? "@astrojs/cloudflare/entrypoints/server"
```

The user's `main` wins **when it is set**. The fallback is, in full:

```js
// node_modules/@astrojs/cloudflare/dist/entrypoints/server.js
import { handle } from "../utils/handler.js";
export default { fetch: handle };
```

`fetch` only — no `queue`, no `scheduled`. Because `wrangler.toml` declares
`[[queues.consumers]]`, Cloudflare's upload API refuses the version with 11001.

**Second, silent failure:** the same fallback has no `scheduled` export, so every
cron in `[triggers]` stops firing — **every job in `src/lib/jobs/registry.ts`**,
on both the five-minute tick and the Sunday one. (Do not put a number here:
this line said "all ten jobs … the eight on the five-minute tick" and was
wrong on 2026-09-19, when it was 9 + 2. `registry.ts` is the count.) Cloudflare
does **not** error on this. If you ever "fix" 11001 by deleting the queue
consumers, the deploy goes green and the crons stay dead.

## Fix

Restore the entrypoint in `wrangler.toml`:

```toml
main = "./src/workers/cf-entry.ts"
```

`src/workers/cf-entry.ts` already implements the documented Astro pattern (Astro 7 today) —
`import { handle } from '@astrojs/cloudflare/handler'` plus a default-exported
`ExportedHandler` with `fetch`, `scheduled` and `queue`. It needs no changes; it
only needs to be wired in.

> Note: the adapter's old `workerEntryPoint` option was removed in
> `@astrojs/cloudflare` v13. `main` in the Wrangler config is now the only
> supported way to register a custom entrypoint.

## Verify before pushing

These blocks assume a POSIX shell (Git Bash). In PowerShell — this repo's
primary shell — `VAR=value cmd` is a syntax error, which is the other reason
the prefix below is gone.

```bash
npm run build

# main must resolve to the cf-entry bundle, not the adapter default
node -e "const c=require('./dist/server/wrangler.json'); console.log(c.main)"

# all three handlers must survive bundling (the adapter emits a flat entry.mjs;
# earlier builds put the handlers in chunks/worker-entry_*.mjs)
grep -oE 'async (fetch|scheduled|queue)\(' dist/server/entry.mjs | sort -u

npx wrangler deploy --dry-run --outdir=/tmp/cf-dryrun
```

`CLOUDFLARE_VITE_FORCE_LOCAL=true` is required in any environment without
Cloudflare credentials — the `[ai]` binding otherwise makes
`@cloudflare/vite-plugin` open a remote proxy session that hard-fails. **You do
not need to set it on the command line:** `npm run build` is
`dotenv -e .env.build -- astro build`, and `.env.build` already supplies it with
that exact rationale. CI sets it separately (see `.github/workflows/`). This
runbook prefixed the command by hand until 2026-09-19, which was redundant on
every shell and invalid on PowerShell.

## Verify after deploying

- Cloudflare dashboard → Worker → **Cron Triggers**: both triggers (`*/5 * * * *`
  and `0 2 * * SUN` — the 15-minute trigger was folded into the 5-minute one on
  2026-09-10) show recent successful invocations, the five-minute one within ~5 min.
- Cloudflare dashboard → **Queues** → `madagascar-sync-revalidate`: consumer is
  attached to `cf-admin-madagascar` and the backlog drains.
- Sentry receives server-side events (`withSentry` lives in `cf-entry.ts`, so it
  is only active when the custom entrypoint is wired in).

## Guard

`test/worker-entry-contract.test.ts` fails the build if `main` is missing or
commented out, if it points at a nonexistent file, or if a declared queue
consumer / cron trigger has no matching handler in the entrypoint. It runs in
`npm run test:run`, which is blocking in `.github/workflows/quality.yml`.

## History

Regressed 2026-08-02 in `9d5d04e`, which commented out `main` as part of an
unrelated dependency/`optimizeDeps` cleanup. Every deploy from then until
2026-08-03 failed this way; production was frozen for the duration. The lesson
worth keeping: **a green `npm run build` in CI does not mean the Worker is
deployable** — the entrypoint contract is only enforced at upload time, which is
why the guard test exists.

## Re-verification

| Date | Method | Result |
|---|---|---|
| 2026-09-19 | `src/lib/jobs/registry.ts` re-counted; `package.json` `build` script and `.env.build` read; front-matter re-parsed | The job arithmetic was stale again (9 + 2, not 8 + 2) and is now replaced by a pointer to `registry.ts`; the `CLOUDFLARE_VITE_FORCE_LOCAL=` prefix dropped as redundant and PowerShell-invalid; `related_code:` converted to the inline list form so the key parses. **Not re-checked:** whether `dist/server/entry.mjs` still emits all three handlers flat — building is out of scope for this pass; the 2026-09-14 row below is the last evidence for it |
| 2026-09-14 | `wrangler.toml` read; `CLOUDFLARE_VITE_FORCE_LOCAL=true npm run build`; `node -e "…dist/server/wrangler.json…main"`; `grep -oE 'async (fetch\|scheduled\|queue)\(' dist/server/entry.mjs`; `ls test/` | `main = "./src/workers/cf-entry.ts"` present; built `main` resolves to `entry.mjs`, which exports `fetch`, `queue` and `scheduled`; `test/worker-entry-contract.test.ts` present and in `npm run test:run`. Three lines corrected above: the cron count (two triggers since chunk 7), the Astro version, and the grep path for the bundled handlers |
