---

title: "Dev server: file missing from the optimize deps directory"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-10
verified_against: [code]
owner: harshil
related_docs: [ssr-silent-blank-screen.md, ../operations/DEV-TOOLS.md]
tags: [runbook, dev-server, vite, troubleshooting]
---

# Dev server: file missing from the optimize deps directory

> **TL;DR (non-technical):** The local dev server used to fail with a message
> about a missing file. Four different problems produce almost the same message,
> and each needs a different fix — this page tells them apart. None of them is a
> broken dependency, which is what the error text misleadingly suggests. All four
> are fixed and three are now guarded automatically (2026-09-07, 2026-09-08,
> 2026-09-10).

## Symptom

`npm run dev` starts, then the page fails with an Astro error overlay:

```text
The file does not exist at "…/cf-admin/node_modules/.vite/deps_ssr/astro_app_entrypoint_dev.js?v=a0d09c83"
which is in the optimize deps directory. The dependency might be incompatible
with the dep optimizer. Try adding it to `optimizeDeps.exclude`.

  at runInRunnerObject (workers/runner-worker/index.js:107:3)
  at [SUPABASE_PROJECT_REF] (workers/runner-worker/index.js:241:17)
```

The named file varies. `runner-worker` is `@cloudflare/vite-plugin`, nested
inside `@astrojs/cloudflare` — it executes SSR modules inside workerd and fetches
them from the Vite dev server by URL.

Intermittent by nature: it depends on what else held the cache open at that moment.

## Which of the four failures is this?

Four distinct causes wear almost the same message. Identify which before
changing anything — the fixes are unrelated, and the fix for one makes another
worse.

| Message | Cause | Section |
|---|---|---|
| `The file does not exist at …/deps_ssr/<file>` **and another process was using the cache** (a second `astro dev`, or a `vitest` run before the 2026-09-07 fix) | The cache was deleted or rewritten underneath a running server | Failure 1 and 2 below |
| `The file does not exist at …/deps_ssr/manifest-<hash>.js` appearing **only after a request**, following a log line `dependency optimized: <pkg>` | A dependency was discovered at request time and re-optimizing rewrote every chunk hash | Failure 3 below |
| **`module is not defined`** at `runInRunnerObject` | A CommonJS package is in `optimizeDeps.exclude`, so it never got rewritten to ESM | Failure 4 below |

## Failure 1 — the cache deleted mid-run (2026-09-07)

Original root cause.

Neither `astro.config.ts` nor `vitest.config.ts` set `cacheDir`, so **three
processes shared `node_modules/.vite`**:

| Consumer | Writes |
|---|---|
| Astro dev server (Vite optimizer) | `.vite/deps`, `.vite/deps_ssr`, `.vite/deps_astro` |
| `vitest run` (via `npm run verify`) | `.vite/vitest` |
| The Vitest Explorer editor extension (runs continuously) | `.vite/vitest` |

The `predev` script recursively deleted that entire directory on every
`npm run dev`. On Windows file locks are mandatory, so removing a tree while
another process holds handles inside it fails partway — and `rmSync`'s
`force: true` swallows the error. The result is a half-deleted cache: the dev
server registers optimized-dep URLs against a `deps_ssr` that is no longer there,
and the runner worker 404s fetching them.

## Fix (applied 2026-09-07)

- `predev` clears only `dist` and `.astro`. `astro dev --force` already discards
  and rebuilds the optimizer cache in-process, safely, without touching another
  consumer's subdirectory — the deletion was redundant *and* was the cause.
- `vitest.config.ts` sets `cacheDir: 'node_modules/.vite-vitest'`, so the two can
  never collide again even if a cache wipe is reintroduced.

## The trap to avoid

Vite's error text suggests *"The dependency might be incompatible with the dep
optimizer. Try adding it to `optimizeDeps.exclude`."* **That advice does not
apply to this failure.** Nothing is incompatible; the directory vanished
mid-flight. Five packages were added to `optimizeDeps.exclude` in
`astro.config.ts` chasing this error before the real cause was found, and each
time a different dependency surfaced next.

If you hit this again, check for a *concurrent* cache consumer before touching
`optimizeDeps`:

```bash
# Anything else using the Vite cache right now?
ls node_modules/.vite node_modules/.vite-vitest

# Windows: what node processes are live (vitest? a second dev server?)
powershell "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Select-Object ProcessId, CommandLine"
```

## Failure 2 — a second dev server (2026-09-08)

`npm run dev` runs `astro dev --force`. The `--force` re-runs the optimizer and
rewrites `node_modules/.vite/deps_ssr` with fresh `?v=<hash>` names, while an
already-running server is still handing out the old ones. Both then break. They
share one cache directory, so no ordering avoids it.

**`astro dev status` is not sufficient to detect this.** On 2026-09-08 it
reported "No dev server is running" while a live server held port 4321, so each
`npm run dev` silently stacked another server onto the next free port. Enumerate
processes instead:

```bash
powershell "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*astro.mjs*dev*' } | ForEach-Object { \$_.ProcessId }"
```

**Guarded since `c1b94bd`:** `predev` is `scripts/predev-guard.mjs`, which
enumerates processes and refuses to start a second server, naming the pid and
the stop command. It fails open if the process list cannot be read.

## Failure 3 — a dependency discovered at request time (2026-09-08)

`vite.ssr.noExternal` lists the runtime dependencies to bundle into SSR, but
`ssr.optimizeDeps.include` was `[]`, so none were pre-bundled. Vite discovered
them one at a time, on whichever request first imported each. Every discovery
rewrites all of `deps_ssr` with new chunk hashes while the runner still holds
URLs from the previous generation, so the next module load 404s.

`@upstash/ratelimit` and `@upstash/redis/cloudflare` were discovered 100 seconds
after the server was ready, `zod` 20 seconds later, and `zod` took the page down.
Astro's own internals are discovered during startup, before any request exists to
break, which is why they appear in every log and are never the culprit.

**`noDiscovery: true` does not stop the optimizer.** It only removes the startup
pre-pass that would have found these early.

**Fixed in `0af64ec`:** `include` mirrors `noExternal`, spelled exactly as the
source imports it, subpaths included.

### It recurred on 2026-09-10 — `lucide-preact`, and the rule was too narrow

Mirroring `noExternal` was not enough. `lucide-preact` was in `noExternal` and
never in `include`; ~95 components import it, so nearly every dashboard page
armed it. It surfaced on the theme picker
(`src/components/admin/settings/UserSettingsPanel.tsx` imports `Moon`).

Three things were learned fixing it:

1. **`ssr.optimizeDeps` REPLACES the SSR environment's optimizeDeps.** Entries
   Astro and its integrations contribute at the *top level* never reach the first
   bundling pass. `@astrojs/preact` adds `@astrojs/preact/server.js` to
   `vite.optimizeDeps.include` from its `astro:config:setup` hook — with this
   block present that entry is shadowed, and it is reliably the first thing
   discovered on a cold cache. Mirroring `noExternal` could never have caught it,
   because it was never in `noExternal`.

2. **`noDiscovery: false` is worse, not better.** It looks like the fix — Astro
   reads that exact flag and only when it is false sets `optimizeDeps.entries` to
   `src/**/*.{jsx,tsx,vue,svelte,html,astro}`
   (`astro/dist/vite-plugin-environment/index.js`), turning on a real startup
   scan. But the scan's results land as a re-optimize *after* the runner has
   loaded modules, and the dev server then **fails to start at all**
   ("Dev server process exited before becoming ready"), reproducibly, on a clean
   cache. Keep it `true` and keep `include` complete instead.

3. **The runner does not always recover from a reload.** Earlier notes said
   startup-time discoveries are harmless because they happen before any request.
   That is only usually true. Two Astro internals — `astro/logger/console` and
   `astro/assets/services/noop` — are discovered a second or two after
   "connected", and each costs a `optimized dependencies changed. reloading`
   cycle. Sometimes the runner reloads cleanly; sometimes it stays pinned to the
   dead generation and then **every route 500s** on a missing `deps_ssr` file
   until the server is restarted. Both are now in `include`.

**The rule, restated:** `ssr.optimizeDeps.include` must name every bare specifier
the SSR graph imports — not just the ones in `noExternal`. The measurable
contract is *zero* `dependency optimized:` lines on a cold start, not merely none
after the ready line. `test/vite-optimize-deps-contract.test.ts` pins the list and
the `noDiscovery: true` setting.

To spot a latent one:

```bash
rm -rf node_modules/.vite && npm run dev
grep -oE 'dependency optimized: [^"]*' .astro/dev.log   # must print nothing
```

Note `npx astro dev logs` reports "No dev server is running" even when one is
live; `.astro/dev.log` is the file to read.

## Failure 4 — a CommonJS package excluded from optimization (2026-09-08)

Different message — `module is not defined` at `runInRunnerObject` — same family,
so it is recorded here.

Excluding a dependency from `optimizeDeps` skips esbuild pre-bundling, and
pre-bundling is the step that rewrites CommonJS to ESM. `@upstash/ratelimit`
declares no `type`, no `module` field and no `exports` map, and ships
`module.exports = __toCommonJS(src_exports)`. Served raw into workerd, which has
no `module` global, it throws on load — taking out all 28 API routes that import
`src/lib/ratelimit.ts`. It looked survivable only because an unauthenticated
request is redirected before the route module loads, so `curl` saw `302` and only
a signed-in session saw the failure.

**Fixed in `8a6495f`** and guarded by `test/vite-optimize-deps-contract.test.ts`:
every package in any `optimizeDeps.exclude` must resolve as ESM.
`@astrojs/cloudflare` is `type: module`, so excluding it stays legitimate.

## Verifying a fix

`astro dev` daemonizes in Astro 7, so check it is actually serving rather than
merely started:

```bash
rm -rf node_modules/.vite && npm run dev        # cold cache, or you prove nothing

grep -oE 'dependency optimized: [^"]*' .astro/dev.log   # must print nothing
grep -c "does not exist at" .astro/dev.log              # must be 0

for p in / /dashboard /api/health; do
  curl -s -o /tmp/page.html -w "$p HTTP %{http_code} %{size_download} " "http://localhost:4321$p"
  grep -c "optimize deps directory" /tmp/page.html      # must be 0
done
npx astro dev stop
```

A healthy result is: no discoveries at all, no errors in `.astro/dev.log`, `/`
answering `HTTP 200` at a few hundred KB, protected routes answering `302` rather
than `500` (a `500` here means the route module failed to load, before auth ever
ran), and `0` overlay matches — with a `vitest` run active at the same time, since
that is the collision case.

Two traps when verifying:

- **`npx astro dev status` and `npx astro dev logs` report "No dev server is
  running" while one is live.** Read `.astro/dev.log` directly and enumerate node
  processes for the pid.
- **Do not delete `node_modules/.vite` while a server is running.** That is
  failure 1, and it leaves a `deps_temp_*` directory behind that poisons the next
  start. Stop the server first, then remove the whole `.vite` directory — not just
  the `deps*` subdirectories.
