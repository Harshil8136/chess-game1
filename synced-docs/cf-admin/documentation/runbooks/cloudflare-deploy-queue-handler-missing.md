---
title: "Cloudflare Deploy Fails: Queue Handler Is Missing (code 11001)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-08-03
verified_against: [code, infra]
owner: harshil
related_code:

- wrangler.toml
- src/workers/cf-entry.ts
- src/workers/sync-revalidate-consumer.ts
- test/worker-entry-contract.test.ts
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
cron in `[triggers]` stops firing — CF Access audit polling, booking email retry,
CF Access group reconcile, R2 asset cleanup, scheduled blog publish. Cloudflare
does **not** error on this. If you ever "fix" 11001 by deleting the queue
consumers, the deploy goes green and the crons stay dead.

## Fix

Restore the entrypoint in `wrangler.toml`:

```toml
main = "./src/workers/cf-entry.ts"
```

`src/workers/cf-entry.ts` already implements the documented Astro 6 pattern —
`import { handle } from '@astrojs/cloudflare/handler'` plus a default-exported
`ExportedHandler` with `fetch`, `scheduled` and `queue`. It needs no changes; it
only needs to be wired in.

> Note: the adapter's old `workerEntryPoint` option was removed in
> `@astrojs/cloudflare` v13. `main` in the Wrangler config is now the only
> supported way to register a custom entrypoint.

## Verify before pushing

```bash
CLOUDFLARE_VITE_FORCE_LOCAL=true npm run build

# main must resolve to the cf-entry bundle, not the adapter default
node -e "const c=require('./dist/server/wrangler.json'); console.log(c.main)"

# all three handlers must survive bundling
grep -oE 'async (fetch|scheduled|queue)\(' dist/server/chunks/worker-entry_*.mjs | sort -u

npx wrangler deploy --dry-run --outdir=/tmp/cf-dryrun
```

`CLOUDFLARE_VITE_FORCE_LOCAL=true` is required in any environment without
Cloudflare credentials — the `[ai]` binding otherwise makes
`@cloudflare/vite-plugin` open a remote proxy session that hard-fails.

## Verify after deploying

- Cloudflare dashboard → Worker → **Cron Triggers**: the three crons show recent
  successful invocations (within ~15 min).
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
