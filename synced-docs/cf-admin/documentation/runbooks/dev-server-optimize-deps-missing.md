---

title: "Dev server: file missing from the optimize deps directory"
status: active
audience: [ai, technical, operator]
last_verified: 2026-09-07
verified_against: [code]
owner: harshil
related_docs: [ssr-silent-blank-screen.md, ../operations/DEV-TOOLS.md]
tags: [runbook, dev-server, vite, troubleshooting]
---

# Dev server: file missing from the optimize deps directory

> **TL;DR (non-technical):** The local dev server used to fail at random with a
> message about a missing file. It was not a broken dependency — the test runner
> and the dev server were sharing one cache folder, and starting the dev server
> deleted it while the tests were still using it. Fixed 2026-09-07.

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

## Root cause

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

Two `astro dev` servers running at once reproduce the same failure, because the
second one's `predev` still clears `dist` and `.astro` under the first.

## Verifying a fix

`astro dev` daemonizes in Astro 7, so check it is actually serving rather than
merely started:

```bash
npx astro dev status
curl -s -o /tmp/page.html -w "HTTP %{http_code} %{size_download}\n" http://localhost:4321/
grep -c "optimize deps directory" /tmp/page.html   # must be 0
npx astro dev stop
```

A healthy result is `HTTP 200`, a few hundred KB, and `0` overlay matches — with
a `vitest` run active at the same time, since that is the collision case.
