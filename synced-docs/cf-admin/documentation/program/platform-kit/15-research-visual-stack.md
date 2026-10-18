---
title: "Platform kit research: the visual stack on Astro and Preact"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Visual stack research for the platform kit

Research date: 2026-10-18. Every figure below carries its source URL; "read 2026-10-18" applies to all of them unless stated. Items I could not verify are marked **GAP**. Bundle sizes marked "measured" were produced locally with esbuild 0.25.9 (`--bundle --minify --format=esm --target=es2022`, gzip -9) against the exact package versions named, because the hosted size services (bundlephobia, bundlejs) were blocked by the proxy. Repository health comes from the GitHub repository pages and the npm registry on the same day.

Owner's brief this answers: "better libraries, best in class … better stacks and libs for visuals such as tailwind and others" and "extremely smart, lightweight, core usable", under the fixed decisions (Astro 7 SSR + Preact islands, Hono for `/api/*`, one Worker per client, under 10 ms CPU, free plan, phone-first, strict CSP, dark mode, es/en, WCAG 2.2 AA, AI-agent friendly).

---

## Summary

1. Astro 7 (2026-06-22) is a good fit: a Rust compiler, Vite 8/Rolldown, stable route caching, and `src/fetch.ts` that is **Hono-compatible** (`astro/hono`), so Hono for `/api/*` and Astro pages can share one pipeline. Latest is 7.4.0 (npm, 2026-10-15); the Cloudflare adapter 14.4.0 requires `astro ^7.4.0` and `wrangler ^4.125.0`.
2. Astro's built-in CSP (stable since 6.0) is **hash-based only**, emitted as a `<meta http-equiv>` tag, with 7.1 adding `script-src-elem/attr` and `style-src-elem/attr`. It does not run in `astro dev`, and it is incompatible with `<ClientRouter>` view transitions. Header-only directives (`frame-ancestors`, `report-to`) must come from Hono's `secureHeaders`.
3. Styling: **Tailwind CSS v4** (4.3.3) is the recommendation. Measured output for a 1,495-class admin sample is 17.1 KB gzipped; utilities reference `var(--color-primary)` so a per-client theme is a tiny CSS override, no rebuild. UnoCSS, Panda and vanilla-extract are healthy but add either a config layer or a TS build step that buys nothing here.
4. Components: **write the kit's own ~18 primitives on native elements** (`<dialog>`, `popover`, `<details>`, anchor positioning, all Baseline now), and pull in **Zag.js machines via the official `@zag-js/preact` adapter** only for the three widgets that are genuinely hard (combobox, menu, date picker). Dialog + adapter measured at 17.2 KB gz; all three at 46.3 KB gz, so load them per island.
5. Do not adopt shadcn/ui via `preact/compat` (unofficial port has 28 stars), Franken UI (project pivoted to "0build"), or Web Awesome (34 KB gz for one button, no SSR path since `@astrojs/lit` was removed in Astro 5).
6. Icons: **Lucide v1** (`lucide-preact` 1.59.0, ISC): one icon 1.8 KB gz, twenty icons 3.3 KB gz; in `.astro` files use Astro's native `.svg` component imports (zero JS). Fonts: Astro's Fonts API self-hosts Fontsource/local fonts with metric-matched fallbacks and preload. Images: adapter default `cloudflare-binding`; `compile` for prerendered, `passthrough` otherwise.
7. Data: server-side paging and server-rendered `<table>` by default; **TanStack `table-core` v9** (11.9 KB gz for sort+filter+paginate) only inside a Preact island when client sorting is needed; **uPlot** (23 KB gz + 0.8 KB CSS) for time series; hand-written SVG for sparklines and bars (0 KB JS). Chart.js 4 is CSP-clean but 55–70 KB gz. Frappe Charts is unmaintained since 2021.
8. Forms: **Astro Actions with `accept: 'form'`** for progressive enhancement (works with zero JS, `Astro.getActionResult()` on the server); Zod 4 ships with Astro (`astro/zod`) for server validation; use **`zod/mini`** (5.6 KB gz for a small schema) or Valibot (1.5 KB gz) in islands; `@preact/signals` (3.5 KB gz) for island state.
9. Email: compile templates **at build time** to static HTML with `{{tokens}}`; Maizzle 6 (Tailwind-for-email, Vue SFCs) or MJML 5 both do this; nothing email-related runs on the Worker except string substitution.
10. Quality gates worth their minutes: `@axe-core/playwright` + Playwright `toHaveScreenshot` on `devices['iPhone 13']` light and dark, `size-limit` budgets per island, Lighthouse CI on two pages. GitHub Free gives 2,000 Actions minutes/month for private repos.

---

## 1. Astro 7 facts

Sources: Astro 7.0 post <https://astro.build/blog/astro-7/> (2026-06-22); Astro 7.1 post <https://astro.build/blog/astro-710/> (2026-07-16); Astro 6.0 post <https://astro.build/blog/astro-6/> (2026-03-10); upgrade guide <https://docs.astro.build/en/guides/upgrade-to/v7/>; configuration reference <https://docs.astro.build/en/reference/configuration-reference/>; API reference <https://docs.astro.build/en/reference/api-reference/>; integrations reference <https://docs.astro.build/en/reference/integrations-reference/>; Cloudflare adapter <https://docs.astro.build/en/guides/integrations-guide/cloudflare/>; npm registry for versions.

| Topic | What is true now | Why it matters to the kit |
|---|---|---|
| Versions | `astro` 7.4.0 (2026-10-15), `@astrojs/cloudflare` 14.4.0 (peer `astro ^7.4.0`, `wrangler ^4.125.0`), `@astrojs/preact` 6.1.0 (peer `preact ^10.6.5 \|\| ^11.0.0`, Node ≥ 22.22). Node 22 is the minimum since Astro 6. | Pin these three together; Preact 11 is supported by the official renderer. |
| Compiler and build (7.0) | Rust compiler is the only compiler (oxc parser, Lightning CSS for scoping). Stricter: unclosed tags are errors, invalid nesting is no longer auto-corrected. Markdown default is Sätteri (Rust). Vite 8 + Rolldown. Builds 15–61% faster in Astro's benchmarks. | Agents must write valid HTML; good for us. Fewer JS build deps. |
| Whitespace (7.0) | `compressHTML` default is now `'jsx'`: whitespace between inline elements is collapsed like JSX; use `{" "}`. | Watch for lost spaces between inline chips/badges in server templates. |
| Rendering (7.0) | Queued rendering is the default engine, "~2.4× faster" than the recursive renderer per Astro. | Directly lowers per-request CPU on the Worker. **GAP:** no published ms-per-page number for workerd; measure with Workers Observability CPU time. |
| Advanced routing (7.0) | `src/fetch.ts` (reserved name; `fetchFile` config to rename/disable) exports a standard `fetch` handler. `astro/hono` exports `astro()`, and also `actions()`, `middleware()`, `pages()`, `i18n()` as Hono middleware so auth can run before Actions. Cloudflare adapter 13.6+ ships companion handlers for session KV, `ASSETS`, `cfContext`, `cf-connecting-ip`, `waitUntil`, prerendered error pages. | This is the clean seam: one Hono app, `/api/*` routes first, Cloudflare Access check as Hono middleware, then `astro()`. |
| Route caching (7.0) | Stable: `cache: { provider }` and `routeRules`, `Astro.cache.set({ maxAge, swr, tags })`; experimental CDN providers for Netlify, Vercel, Cloudflare. | Useful for public pages of a client site; admin pages are per-user and stay uncached. |
| AI tooling (7.0, 7.1) | Agent detection, background dev server (`astro dev stop/status/logs`), lockfile against duplicate dev servers (`--ignore-lock` in 7.1), JSON logs (`logHandlers.json()`), `logger.entrypoint` (7.1). | Directly serves "friendly to AI agents". |
| CSP (6.0 stable, 7.1 directives) | `security.csp: true \| {...}`, default `false`. Astro hashes every script and style it emits (island hydration scripts included) and writes a `<meta http-equiv="content-security-policy">` into `<head>` with `script-src` and `style-src`. Options: `algorithm` (SHA-256 default), `directives: string[]`, `scriptDirective/styleDirective: { resources, hashes, strictDynamic }`. Since 7.1 a hash can be `{ hash, kind: 'element' \| 'attribute' \| 'default' }`, which moves it (and Astro's own hashes) to `*-src-elem` / `*-src-attr`. Runtime: `Astro.csp?.insertDirective()`, `insertScriptHash()`, `insertStyleHash()` (also `insertScriptResource`, `insertStyleResource`, `setAlgorithm` in the v5 reference; the first three re-verified in the current API reference). Limitations stated by Astro: external scripts/styles need hashes you supply; `<ClientRouter>` unsupported; Shiki unsupported (inline styles); `'unsafe-inline'` in a directive suppresses hashes for it; **not available in `astro dev`**, test with `build` + `preview`. | **Nonces: not offered anywhere in the config or runtime API; Astro is hash-based** (inferred from the docs' silence, consistent with Report URI's Astro guide). A `<meta>` policy cannot carry `frame-ancestors`, `report-uri`/`report-to` or `sandbox`; set those as response headers from Hono (`hono/secure-headers` has a full CSP option set: <https://hono.dev/docs/middleware/builtin/secure-headers>). Keep the two policies disjoint: Astro owns `script-src`/`style-src`, Hono owns the rest. |
| CSP and Preact islands | Island hydration `<script>`s are hashed automatically. SSR'd `style={{...}}` props become `style="..."` attributes, which `style-src` blocks unless `style-src-attr 'unsafe-inline'` is present. The 7.1 post shows exactly this configuration (`styleDirective.resources: [{ resource: "'unsafe-inline'", kind: "attribute" }]`). After hydration, Preact sets `el.style.prop = …`, which CSP does not block (MDN: direct `style` property writes are allowed; `setAttribute('style')` and `cssText` are blocked; <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/style-src>). | Kit rule: no `style` prop in server-rendered output; dynamic sizes via classes or data attributes, or accept `style-src-attr 'unsafe-inline'` as the one documented relaxation while `style-src-elem` stays hash-only. |
| Server islands | `server:defer` + `slot="fallback"`; each island is a separate GET to `/_server-islands/*` with encrypted props (POST above 2,048-byte URLs, uncached); `Astro.url` inside is the island URL (read `Referer`). <https://docs.astro.build/en/guides/server-islands/> | Every island is one more Worker invocation and one more CPU budget; use for slow widgets (health checks), not layout. |
| Actions | `defineAction({ accept: 'form', input: z.object(...), handler })`; HTML forms post with `method="POST" action={actions.x}` and zero JS; `Astro.getActionResult()` and `isInputError()` on the server; results encoded with Devalue; body limit `security.actionBodySizeLimit` 1 MB (5.18). <https://docs.astro.build/en/guides/actions/> | Progressive enhancement for free. Note: the docs' "preserve inputs with `transition:persist`" needs `<ClientRouter>`, which CSP forbids; re-render inputs from the submitted values server-side instead. |
| Sessions | Since 5.7; Cloudflare adapter auto-provisions a KV namespace `SESSION` (`sessionKVBindingName`); KV writes are eventually consistent (up to 60 s across regions); `session: false` (7.2) removes the session runtime from the bundle. <https://docs.astro.build/en/guides/sessions/> | Behind Cloudflare Access we may not need sessions at all; set `session: false` to shrink the Worker. |
| `astro:env` | Typed `envField` schema; `import { X } from 'astro:env/server'`; the adapter says it is compatible with `cloudflare:workers` `env`. <https://docs.astro.build/en/guides/environment-variables/> | Fine for the few true secrets; everything else stays in D1 per RULE #0.8. |
| Fonts API (6.0) | `fonts: [{ provider, name, cssVariable, weights, styles, subsets, formats, fallbacks, optimizedFallbacks, display, unicodeRange }]`; providers: Adobe, Bunny, Fontshare, Fontsource, Google, Google Icons, NPM, local; `<Font cssVariable preload />`; `display` default `swap`; `optimizedFallbacks` default `true` generates metric-matched fallbacks from the last generic family; `weights` default `[400]`, variable range as `"100 900"`; `subsets` default `["latin"]`; `formats` default `["woff2"]`. <https://docs.astro.build/en/guides/fonts/> and the v5 reference <https://v5.docs.astro.build/en/reference/experimental-flags/fonts/> | Self-hosted, privacy-clean, near-zero layout shift without a third-party package. |
| Content Layer | Live Content Collections stable (6.0): `defineLiveCollection` in `src/live.config.ts`, request-time `getLiveEntry`; `glob({ deferRender })` (7.1) lowers sync memory; `experimental.collectionStorage: "chunked"` (7.1). | Mostly irrelevant to an admin tool; useful for a client's public site content. |
| Integration API | `astro:config:setup` gives `injectRoute({ pattern, entrypoint, prerender })`, `addMiddleware({ entrypoint, order: 'pre' \| 'post' })`, `addDevToolbarApp`, `addClientDirective`, `injectScript`, `updateConfig`, `addWatchFile`; `astro:config:done` gives `injectTypes`; `astro:build:generated` exposes `routeToHeaders`. | A kit "module" = one Astro integration that injects its routes and middleware; this is the AI-agent-friendly plug-in seam. |
| Cloudflare adapter | Runs workerd in dev, prerender and prod (`prerenderEnvironment: 'workerd' \| 'node'`); `cloudflare:workers` imports; `Astro.locals.cfContext.waitUntil()`; `.wasm/.bin/.txt` imports; `nodejs_compat`; `_headers`/`_redirects` apply to static assets only; wrangler auto-provisions KV and Images bindings on deploy; `imageService` default `cloudflare-binding`, with `{ build: 'compile' \| 'cloudflare-binding', runtime?: 'passthrough' \| 'cloudflare-binding' }` since 14.2.0. | Watch auto-provisioning against RULE #0.6 (no new bindings without proof); set `session: false` and an explicit `imageService` so nothing is created silently. |

**GAPs:** (a) No official number for Astro SSR CPU time on workerd; (b) whether Actions accept Standard Schema validators besides Zod is not stated in the docs; (c) Cloudflare Images binding pricing on the free plan was not checked this session.

---

## 2. Styling engine

Sources: Tailwind v4.0 post <https://tailwindcss.com/blog/tailwindcss-v4> (2025-01-22); theme docs <https://tailwindcss.com/docs/theme>; compatibility <https://tailwindcss.com/docs/compatibility>; `@theme inline` PR <https://github.com/tailwindlabs/tailwindcss/pull/14095> and discussion <https://github.com/tailwindlabs/tailwindcss/discussions/17826>; UnoCSS <https://unocss.dev/guide/>; Panda <https://panda-css.com/docs/overview/why-panda>; vanilla-extract <https://vanilla-extract.style/documentation/getting-started/>; GitHub repo pages; npm registry. Measurements: local Tailwind 4.3.3 CLI build of a generated 1,495-class admin sample (spacing, layout, 8 colour families × 8 shades × bg/text/border, 22 variants including `dark:`, `@sm:`, `data-[state=open]:`, `starting:`).

| Criterion | Tailwind CSS v4 | UnoCSS | Panda CSS | vanilla-extract | Plain CSS + layers + custom properties |
|---|---|---|---|---|---|
| Version / date / health | 4.3.3 (2026-07-16); 97,895 stars, 85 open issues; Tailwind Labs, MIT | 66.11.0 (2026-10-12); 18,980 stars, 127 open issues; antfu-led, MIT on npm | 2.2.0 (2026-10-09); 6,213 stars, 7 open issues; Chakra team, MIT | 1.21.3 (2026-10-08); 10,437 stars, 73 open issues; SEEK, MIT | n/a |
| Generated CSS for an admin app | **Measured 124.7 KB min / 17.1 KB gz** for the 1,495-class sample (realistic apps use fewer classes) | Comparable by design (on-demand atomic); not measured | Atomic + recipes; not measured | Scoped classes, as large as you write | As large as you write |
| Build speed | Oxide engine, Lightning CSS; Tailwind's own numbers: full build 378 → 100 ms, incremental no-new-CSS 35 ms → 192 µs on Catalyst | Fast, Vite plugin | Static extraction + PostCSS + codegen step | TS compile step per `.css.ts` | None |
| CSP friendliness | Pure build-time stylesheet; no runtime injection | Same (avoid the "CDN runtime" mode) | "Doesn't generate styles in the browser nor inject styles" (docs) | Zero-runtime | Trivially |
| Dark mode | `dark:` variant; redefine as `@custom-variant dark (&:where([data-theme=dark], [data-theme=dark] *))` for a user toggle plus `prefers-color-scheme` | Variants via preset | Conditions | Manual | `@media` + `[data-theme]` |
| Per-client theming without rebuild | **Yes.** Utilities emit `var(--color-primary)`; measured `.bg-primary{background-color:var(--color-primary)}`. Opacity modifiers emit a literal fallback plus an `@supports (color: color-mix(…))` override `color-mix(in oklab, var(--color-primary) 10%, transparent)`, so in every browser Tailwind supports the variable wins at runtime. `@theme inline` must **not** be used for themable tokens (it inlines the value). | Yes with CSS variables in presets | Yes, tokens are CSS variables | Yes via `createThemeContract` | Yes |
| Browser floor | Chrome 111, Safari 16.4, Firefox 128 (docs) | Depends on preset | Modern | Modern | Your choice |
| AI-agent familiarity | Highest of all; utility vocabulary is stable since v3 and v4's CSS-first config is well documented | Good, but preset/config surface is a second language | Moderate; `css({})` object syntax plus codegen output to understand | Moderate; TS files per component | High |
| Component-library ecosystem | daisyUI, Basecoat, Preline, Flowbite (see §3) | Thin | Park UI (React/Solid/Vue) | None | None |

**Recommendation: Tailwind CSS v4 through `@tailwindcss/vite` (peer `vite ^5.2 \|\| ^6 \|\| ^7 \|\| ^8`, so Astro 7's Vite 8 is covered).** Rules for the kit:

1. One `src/styles/app.css`: `@import "tailwindcss"; @theme { … }` with a **short token list** (§9). Themable tokens are declared as references, e.g. `--color-primary: var(--brand-primary);`, never with `@theme inline`.
2. Per-client theme = a `/theme.css` route (or a KV-cached static response) that sets `:root { --brand-primary: …; --radius-md: …; --font-sans: … }` from `client_config`. It is a normal stylesheet, so it is covered by `style-src 'self'`; nothing inline, nothing to hash, and the Worker does no CSS work per page. Alternative (if a round trip is unacceptable): render the override as `<style>` in `<head>` and call `Astro.csp.insertStyleHash()` with a SHA-256 computed with WebCrypto per request (microseconds). Both options are in the decision cards.
3. Dark mode: `[data-theme]` on `<html>` set server-side from the user's saved preference (no flash), default from `prefers-color-scheme`; `color-scheme` utility for native controls.
4. Container queries (`@sm:`, `@md:` on `@container`) for module cards that live in different layouts; `@starting-style` (`starting:`) for enter transitions of dialogs and toasts without JS.
5. Tailwind output is a bundled file (`'self'`); `.astro` `<style>` blocks are bundled too. Astro's docs warn that per-component `<style>` blocks are processed separately and lose the `@theme` context (needs `@reference`), so the kit uses utilities in markup and `var(--token)` in the rare component stylesheet, never `@apply` inside `.astro` `<style>`.

---

## 3. Components

Sources: Zag <https://zagjs.com/overview/introduction>, adapters guide <https://zagjs.com/guides/framework-adapters>, Preact discussion <https://github.com/chakra-ui/zag/discussions/2156>, npm `@zag-js/preact` <https://www.npmjs.com/package/@zag-js/preact>; Basecoat <https://basecoatui.com/introduction/>; daisyUI 5 notes <https://daisyui.com/docs/v5/> and config <https://daisyui.com/docs/config/>; Franken UI <https://franken-ui.dev/docs/2.1/installation> and repo README; Preline <https://preline.co/docs/index.html>; Flowbite <https://flowbite.com/docs/getting-started/introduction/>; Web Awesome <https://webawesome.com/docs/>; Lit removal <https://docs.astro.build/en/guides/upgrade-to/v5/> and PR <https://github.com/withastro/astro/pull/11680>; shadcn-preact <https://github.com/LiasCode/shadcn-preact>; platform features: web.dev Popover Baseline <https://web.dev/blog/popover-baseline>, Chrome I/O 2025 recap <https://developer.chrome.com/blog/new-in-web-ui-io-2025-recap>, web.dev January 2026 <https://web.dev/blog/web-platform-01-2026>, web-features `dialog closedby` <https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/>, WebKit 26.2 <https://webkit.org/blog/17640/webkit-features-for-safari-26-2/>.

| Path | Bundle cost (measured unless noted) | A11y quality | CSP | Theming | Licence / health | Verdict |
|---|---|---|---|---|---|---|
| (a) Own primitives on native elements | 0 KB for server-rendered parts; a Preact island only where state lives (Preact 11 core 5.0 KB gz, +hooks 6.4 KB gz) | As good as we write it; the platform now does the hard parts: `<dialog>` (focus trap, inert page, Escape), `popover` (top layer, light dismiss, focus) is Baseline since 2025-01-27, CSS anchor positioning is Baseline since Firefox 147 (Jan 2026), `command`/`commandfor` in Chrome 135, Firefox 144, Safari 26.2 | Clean if we avoid inline `style` | Our tokens | Ours | **Recommended base** |
| (d) Zag.js machines + `@zag-js/preact` | dialog + adapter 17.2 KB gz; menu 29.6; combobox 30.1; all three 46.3 KB gz (Preact external) | Statechart-driven, WAI-ARIA patterns, keyboard and focus handled; the Chakra team's engine | Headless; emits `data-*` attributes and some positioning `style` via the normalizer, applied after hydration (CSSOM, allowed) | Unstyled; Tailwind on `data-part`/`data-state` | MIT; 1.46.0 (2026-10-11), 5,233 stars, 16 open issues; **Preact adapter is official on npm since Jan 2025** (peer `preact >= 10`), but the site still lists only React/Solid/Vue/Svelte and the adapter has ~2k weekly downloads: **less travelled** | **Recommended for the 3 hard widgets only** |
| (b) daisyUI 5 | Only used components are emitted; measured sample +11.6 KB gz over plain Tailwind when ~40 component classes are used (28.7 KB gz total; 25.9 with `include:` subset). Zero JS | CSS-only: dialogs/dropdowns rely on `<dialog>`/`<details>`/`:focus-within`; keyboard handling is whatever the native element gives | Clean | Its own `--color-base-100/primary/…` variables; 35 themes | MIT; 5.7.50 (2026-10-13), 42,606 stars, 63 open issues, zero deps, one primary maintainer | Good "day-one look" but a second token vocabulary next to ours; optional, not core |
| (b) Basecoat UI | `@import "basecoat-css"` added **+19.4 KB gz** to the sample (all components, not tree-shaken); standalone CDN build 21.9 KB gz; optional JS `all.min.js` 10.8 KB gz | shadcn-like markup; interactive parts need its vanilla JS | CSS clean; JS is an external file | shadcn theme variables | MIT; 1.0.2 (2026-07-06), 4,369 stars, created 2025-01, effectively one maintainer (250 of ~262 contributions) | Attractive but young and bus-factor 1 |
| (b) Franken UI | Pre-built utilities "~91.45 kB gzipped" per its docs; UIkit 3 + LitElement | UIkit behaviour | Lit runtime | shadcn variables | MIT; 2.1.2 (2026-01-18); README now says "Franken is now 0build" | **Avoid** (pivoted) |
| (b) Preline 5 / Flowbite 4 | Both need a JS plugin bundle and `@tailwindcss/forms`; not measured | Plugin-driven | External JS file | Tailwind | Preline: "MIT and Preline UI Fair Use License", 9 deps; Flowbite: MIT, 5 deps | Not needed; licence wrinkle on Preline |
| (c) shadcn/ui via `preact/compat` | Radix pulls many deps; compat adds weight; **GAP** not measured | Radix a11y is good | Radix sets inline styles on popper elements | shadcn variables | Radix 1.3.1 (2026-10-12), 229 open issues, React-only; the Preact port has 28 stars, copy-paste only | **Avoid** |
| (d) Headless UI / Radix / Ark / Kobalte / Melt | — | — | — | — | Headless UI: React + Vue (2.2.10, 2026-04-07). Radix: React. Ark: React/Vue/Solid/Svelte (5.39.3). Kobalte: Solid. Melt: Svelte (last release 2025-03-28) | **None supports Preact**; only Zag does |
| (e) Web Awesome / Lit | One `wa-button` import = **34.3 KB gz** (includes Lit); `wa-dialog` 37.4 KB gz; theme CSS 2.6 KB gz | Good, Shoelace lineage | Lit uses adopted stylesheets (allowed); components render client-side only | CSS custom properties | MIT (Lit BSD-3); 3.14.0 (2026-09-24), 1,364 stars. `@astrojs/lit` removed in Astro 5.0 for low usage; community `@semantic-ui/astro-lit` reportedly works on Astro 6 | **Avoid**: no first-party SSR, flash of empty custom elements, heavy |

**Recommendation: path (a) + a thin slice of (d).** The kit ships its own primitives as `.astro` components (server-rendered, zero JS) with Preact islands only where interaction needs state, styled with Tailwind utilities bound to our tokens. Zag machines are imported per widget inside the island that needs them.

Primitive list (18), each with the native element it stands on:

| # | Primitive | Base | JS? |
|---|---|---|---|
| 1 | Button (variants: primary, secondary, ghost, destructive; sizes sm/md/lg; `loading`) | `<button>` / `<a>` | no |
| 2 | Icon button (44 px hit target, required label) | `<button aria-label>` | no |
| 3 | Field (label, hint, error, required mark) wrapping Input/Textarea/Select/Checkbox/Switch/Radio | native controls, `aria-describedby`, `aria-invalid` | no |
| 4 | Select (native) | `<select>` | no |
| 5 | Combobox / searchable select | Zag `combobox` in an island | yes (island) |
| 6 | Date / time input | native `type="date"` first; Zag `date-picker` only where ranges are needed | mostly no |
| 7 | Dialog (modal + sheet/drawer variant from the bottom on phones) | `<dialog>` + `command="show-modal"` (JS fallback for Safari < 26.2), `@starting-style` | tiny |
| 8 | Popover / menu | `popover` + anchor positioning; Zag `menu` only for typeahead and submenus | tiny / island |
| 9 | Tabs and segmented control | links + `aria-current` server-side; roving tabindex island optional | no / tiny |
| 10 | Command row (the owner's sideways-scrolling action row) | `<nav>` with `overflow-x-auto snap-x`, buttons ≥ 44 px, scroll shadows via `scroll-timeline` or a 2-line script | no |
| 11 | Table (server-rendered, sticky header, numeric column alignment) + card fallback | `<table>` | no |
| 12 | Data table island (client sort/filter/virtual) | TanStack `table-core` + `virtual-core` | yes (island) |
| 13 | Badge / status pill (role-free, text + colour + icon, never colour alone) | `<span>` | no |
| 14 | Toast / notice region | `<output>` or `role="status"` live region, `popover="manual"` | tiny |
| 15 | Skeleton | CSS only (`animate-pulse`, `motion-reduce:animate-none`) | no |
| 16 | Empty state (Blankslate-style: graphic, primary text, secondary text, one action) | markup | no |
| 17 | Confirm (typed confirmation for destructive actions) | Dialog + form Action | tiny |
| 18 | Page shell (header, command row, content, bottom safe area) | layout | no |

---

## 4. Icons, fonts, images

Sources: Lucide <https://lucide.dev/guide/packages/lucide-preact>; astro-icon <https://www.astroicon.dev/getting-started/>; Fontsource <https://fontsource.org/docs/getting-started/introduction>; Astro fonts guide (above); Astro images <https://docs.astro.build/en/guides/images/>; Cloudflare adapter (above); repo pages; npm registry; local measurement.

- **Icons: Lucide v1** (`lucide-preact` 1.59.0, 2026-10-17, ISC, tree-shakable). Measured with Preact external: 1 icon 1.8 KB gz, 20 icons 3.3 KB gz. 25,104 stars, 425 open issues (a large icon backlog, not a health problem). Tabler (3.49.0, MIT, 6,200+ icons, 22,346 stars) is the fallback for coverage; Phosphor's core package last shipped 2024-03-29. In `.astro` files use **Astro's native SVG components** (import a `.svg` as a component, inlined, zero JS) so server pages need no icon library at all; `astro-icon` 1.2.0 (2026-08-18, 1,445 stars, Node ≥ 22.12) adds Iconify sets and sprites if the catalogue grows. Rule: `aria-hidden="true"` on decorative icons, `<title>`/`aria-label` only when the icon stands alone.
- **Fonts:** self-host with Astro's Fonts API, `fontProviders.fontsource()` or `local()`; one variable family (e.g. `@fontsource-variable/inter` 5.3.0, OFL-1.1) with `weights: ["400 700"]`, `subsets: ["latin"]`, `display: "swap"` (default), `optimizedFallbacks: true` (default) for metric-matched fallbacks (near-zero CLS), `<Font cssVariable="--font-sans" preload />` once in the shell. Register in Tailwind with `@theme inline { --font-sans: var(--font-inter); }` (the one legitimate `inline` use, per Astro's own docs). Per-client font = a different `cssVariable` value in `/theme.css` pointing at a font already configured in the kit's list; a brand-new family is a rebuild (fonts are downloaded at build).
- **Images on Workers:** no `sharp` at runtime. Adapter default is `cloudflare-binding` (Images binding auto-provisioned on deploy; **GAP:** free-tier transformation quota not checked). For the kit: `imageService: { build: 'compile', runtime: 'passthrough' }` so prerendered marketing pages get optimised at build and admin pages pass user uploads through unchanged from R2; turn on the binding per client only when a client's public site needs runtime resizing (RULE #0.6).

---

## 5. Data display

Sources: TanStack Table <https://tanstack.com/table/latest/docs/introduction> and repo; TanStack Virtual repo; uPlot <https://github.com/leeoniya/uPlot>; Chart.js integration <https://www.chartjs.org/docs/latest/getting-started/integration.html> and 3.x migration <https://www.chartjs.org/docs/latest/migration/v3-migration.html> ("No more CSS injection"); Observable Plot <https://observablehq.com/plot/getting-started>; Frappe <https://github.com/frappe/charts>; local measurements.

| Library | Version (date) | Measured gz | CSP notes | Health | Verdict |
|---|---|---|---|---|---|
| Server-rendered `<table>` + server paging | — | 0 KB JS | None | — | **Default** for every list |
| TanStack `@tanstack/table-core` v9 | 9.3.1 (2026-10-12) | **11.9 KB** for `constructTable` + sorting, filtering, pagination features; whole package 29.1 KB | Headless; no styles | 28,492 stars, 75 open issues; v9 API is feature-based (`tableFeatures`, `rowSortingFeature`, `createSortedRowModel(sortFns)`), differs from v8 tutorials that agents know: **document the pattern once** | Use inside the data-table island only |
| `@tanstack/react-table` via `preact/compat` | 9.3.1, peer `react >= 18` | **GAP** not measured | — | — | Not needed; drive `table-core` with a 30-line Preact hook |
| TanStack `@tanstack/virtual-core` | 3.19.6 (2026-10-16) | **9.6 KB** | Sets `transform`/`height` through CSSOM after mount | 6,783 stars, 106 open issues; **no `@tanstack/preact-virtual` on npm** (verified) | Only for lists over ~500 rows on a phone; otherwise paginate |
| uPlot | 1.6.32 (2025-03-14) | **23.0 KB** + 0.8 KB CSS | Ships its own CSS file; sizes applied via JS style properties (allowed). **GAP:** not audited for `setAttribute('style')`; run CSP report-only once | 10,553 stars, 137 open issues, one maintainer, 19 months since release but stable | **Recommended** for time series (health, usage) |
| Chart.js 4 | 4.5.1 (2025-10-13) | `chart.js/auto` **70.1 KB**; bar-only registration **55.5 KB** | v3+ injects no CSS; you must size the container | 67,733 stars, 596 open issues | Only if pie/doughnut/radar are truly needed |
| Observable Plot | 0.6.17 (2025-02-14) | **132.9 KB** (D3 included) | SVG output; could render server-side with a virtual Document (docs show the pattern) but that costs Worker CPU | 5,405 stars, 350 open issues | No |
| Frappe Charts | 1.6.2 (2021-06-16) | 18.7 KB | — | Last release 5 years ago | **No** |
| Hand-written SVG in `.astro` (sparklines, bars, gauges) | — | 0 KB JS | Inline `<svg>` is markup, not style | — | **Recommended** for dashboards cards |

**Recommendation:** server-rendered tables with server paging and a card layout under 640 px; TanStack `table-core` + optional `virtual-core` in one lazy island for client-side sorting of already-loaded pages; uPlot in a `client:visible` island for time series; everything else as server SVG.

---

## 6. Forms and validation

Sources: Zod 4 notes <https://zod.dev/v4>; Valibot <https://valibot.dev/guides/introduction/>; ArkType <https://arktype.io/docs/intro/setup>; Standard Schema <https://standardschema.dev/>; Preact 11 <https://preactjs.com/blog/preact-11/> and upgrade guide <https://preactjs.com/guide/v11/upgrade-guide/>; Astro Actions (above); local measurements.

| Library | Version (date) | Measured gz for a 3-field schema with parse | Notes |
|---|---|---|---|
| `zod` (classic API) | 4.6.7 (2026-10-12) | **26.2 KB** (namespace import of the full package: 92.4 KB) | Ships inside Astro as `astro/zod`; Actions validate with it on the server, where size is irrelevant and parse speed is 6.5–14× Zod 3 per the release notes |
| `zod/mini` | same package | **5.6 KB** | Functional API (`z.string().check(z.minLength(1))`); shares schemas with the server via Standard Schema |
| `valibot` | 1.5.0 (2026-09-09) | **1.5 KB** (whole library 15.3 KB) | "starting at less than 700 bytes"; 8,827 stars, 156 open issues |
| `arktype` | 2.2.8 (2026-10-07) | **47.3 KB** | Not tree-shakable; fastest runtime, best editor DX; wrong trade for islands |
| `@standard-schema/spec` | 1.1.0 (2025-12-15) | types only | Common `~standard.validate` interface so the kit's form helper can accept any of the three (Zod 4, Valibot, ArkType are the spec's founding implementers; **GAP:** implementer list not re-read this session) |
| `@preact/signals` | 2.11.3 (2026-09-30) | **3.5 KB** | First-party, Preact 11 ready |

**Recommendation:**

1. **Mutations go through Astro Actions** (`accept: 'form'`), called by plain HTML forms. Works with JS disabled, with Cloudflare Access cookies, and with CSP (no inline handlers). The page reads `Astro.getActionResult()` to re-render field errors (`isInputError`) and the submitted values. Hono's `/api/*` remains for machine clients (webhooks, the mobile-side fetches of islands, other Workers), not for browser forms; this keeps one validation path (`astro/zod`) and one CSRF story (Astro's `checkOrigin`, default on).
2. Islands that need instant feedback import the **same schema** from a shared module written with `zod/mini` (or Valibot if a module's budget is tight) and validate on `blur`; the server stays authoritative.
3. State in islands: `@preact/signals`; no global store, no router.
4. Preact 11 (11.0.1, 2026-10-08): ESM-only, TypeScript ≥ 5.1, refs forwarded by default, `Object.is` hook equality, Hydration 2.0; supported browsers Chrome 71+, Safari 12.1+, Firefox 69+. All first-party packages are 11-ready per the release post.
5. Do not use `<ClientRouter>` anywhere (CSP), so no `transition:persist` tricks; progressive enhancement is a full page POST and re-render, which on a phone is the most predictable behaviour anyway.

---

## 7. Email HTML

Sources: Maizzle <https://maizzle.com/docs/introduction>; React Email <https://react.email/docs/introduction>; jsx-email <https://jsx.email/docs/introduction>; MJML <https://documentation.mjml.io/>; npm registry; repo pages.

| Option | Version (date) | Build-time rendering | Runtime on Worker | Rendering consistency | Complexity | Health |
|---|---|---|---|---|---|---|
| **Maizzle 6** | 6.2.2 (2026-10-17) | Yes: CLI builds Vue SFC templates to HTML, inlines CSS, purges, adds Outlook fallbacks | None needed | 30+ "render-tested" components; Tailwind utilities with email-safe config | Moderate: Vue 3 peer, 46 deps, a second template language | 1,617 stars, 0 open issues, single maintainer (2,818 of ~3,600 contributions) |
| MJML 5 | 5.4.1 (2026-09-10) | Yes: `mjml` CLI or Node API at build | None | Industry standard for Outlook; `mj-*` tags | Low: one tool, declarative; no Tailwind | 18,252 stars, 49 open issues, Mailjet/Sinch |
| React Email | components 1.0.12 (2026-04-09), render 2.1.1 peer `react ^18 \|\| ^19` | Yes via `render()` in Node | Would need React on the Worker, or **GAP** an untested `preact/compat` alias | Good, Resend-tested | React in a Preact project | 19,847 stars |
| jsx-email 3 | 3.2.1 (2026-05-28), 61 deps | Yes | Same React problem | Good | Heavy | 1,247 stars |
| Hand-written tables | — | Yes | None | Only as good as the author; Outlook needs conditional comments | Lowest tooling, highest skill | — |

**Recommendation:** templates are compiled **at build time** (in `npm run build`) into `dist/email/*.html` with `{{token}}` placeholders and both languages; the Worker loads the string (bundled or from KV), substitutes tokens with HTML-escaping, and hands the result to the email service. No template engine executes on the Worker. Engine choice is a decision card: Maizzle keeps one Tailwind vocabulary (the owner's preference) at the cost of a Vue peer dependency and bus-factor 1; MJML is the safer renderer with its own tag set. Either way, test with Litmus/Email on Acid once per template change (**GAP:** no free cross-client renderer verified).

---

## 8. Quality gates

Sources: Lighthouse CI <https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/getting-started.md>; Playwright a11y <https://playwright.dev/docs/accessibility-testing>, snapshots <https://playwright.dev/docs/test-snapshots>, emulation <https://playwright.dev/docs/emulation>; size-limit <https://github.com/ai/size-limit>; GitHub Actions billing <https://docs.github.com/en/billing/concepts/product-billing/github-actions>; npm registry.

| Gate | Package (version, date, licence) | Worth it for a small team? | How to keep minutes low |
|---|---|---|---|
| Accessibility scan | `@axe-core/playwright` 4.14.0 (2026-10-15, MPL-2.0) on `@playwright/test` 1.64.1 | **Yes.** Fails on contrast, missing labels, duplicate IDs; Playwright's docs are explicit that automated checks find only part of WCAG, so pair with a manual checklist | One Chromium project, one `iPhone 13` project, ~8 routes, light + dark: a few minutes |
| Visual regression | Playwright `toHaveScreenshot({ maxDiffPixels, threshold })` | **Yes, narrowly**: the primitives gallery page at 390 px wide in light and dark. Baselines must be generated on the same OS as CI (Playwright warns rendering differs per host) | Run on Linux only; store PNG/WebP in repo |
| Mobile viewport check | `devices['iPhone 13']` + `colorScheme`, `locale: 'es'` and `'en'` | **Yes.** Assert no horizontal page scroll (`document.documentElement.scrollWidth <= innerWidth`) and every `button, a` box ≥ 24×24 (WCAG 2.2 2.5.8) | Same run as above |
| Bundle budget | `size-limit` 14.2.0 (2026-10-07, MIT) with `@size-limit/file` on `dist/_astro/*.js` per island | **Yes.** Budgets from §3–§6 (e.g. island ≤ 25 KB gz, whole page JS ≤ 60 KB gz) | Seconds |
| Lighthouse CI | `@lhci/cli` 0.15.1 (2025-06-25, Apache-2.0) `lhci autorun` with assertions; 236 open issues; "temporary public storage" uploads are public, use assertions only | **Partly.** Two pages (sign-in landing, one module list) on a mobile profile; it will mostly repeat what axe and size-limit say | ~2–3 min per run; run on `main` only |
| Pa11y | `pa11y-ci` 5.0.0 (2026-10-05, **LGPL-3.0**) | No: duplicates axe, another engine, copyleft licence | — |
| CSP smoke | Playwright: collect `securitypolicyviolation` events on each route after `astro build && astro preview` (CSP is off in `astro dev`) | **Yes**, cheap and the only way to catch an inline `style` prop | Same run |

Budget: GitHub Free includes 2,000 Actions minutes/month for private repositories (public repositories are free), 500 MB artifact storage, 10 GB cache per repo. A Playwright run of the size above is 3–5 minutes; nightly plus per-push on `main` stays under ~300 minutes/month.

---

## 9. UX rules for the kit and the token list

Sources: Primer DataTable guidelines <https://primer.style/product/components/data-table/guidelines/>; Primer Responsive <https://primer.style/product/getting-started/foundations/responsive/>; Primer Empty states <https://primer.style/product/ui-patterns/empty-states/>; Polaris Density <https://polaris.shopify.com/design/layout/density>; Polaris IndexTable `condensed` behaviour <https://github.com/Shopify/polaris/issues/11378>; Polaris content fundamentals <https://polaris.shopify.com/content/actionable-language>; Geist <https://vercel.com/geist/introduction>; WCAG 2.2 <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/>.

Concepts borrowed (ideas only, no code):

1. **Navigation on a phone: the owner's sideways rows, formalised.** Level 1 is a horizontally scrolling module row under the header (`overflow-x: auto; scroll-snap-type: x mandatory`), every module visible, current one `aria-current="page"` and scrolled into view server-side with an anchor; level 2 is a second row of that module's views; level 3 is the command row of actions for the current record. Three rows maximum; nothing in a hamburger or launcher. Each chip ≥ 44 px tall (Primer recommends 44 px on mobile beyond the 24 px AA minimum) with 8 px gaps so a thumb never hits two. Fade edges hint at more content; rows are `<nav>` with lists so screen readers get counts.
2. **Density.** Polaris: lists and tables are high density by default; editing screens are low density with cards to switch context. The kit has two density tokens (`--row-h: 44px` list, `56px` form) and never mixes them inside one card.
3. **Tables on a phone.** Polaris's `condensed` IndexTable deliberately refuses horizontal scroll because critical data would hide off-screen; Primer lists the alternatives: fewer columns, column widths, then scroll. Kit rule: under 640 px a table becomes a card list showing the row header plus at most three data points and the status pill; the full table (sticky header, right-aligned `tabular-nums` numbers, blank empty cells, 20 rows per page) appears from 640 px. Never a horizontally scrolling table as the only way to see a field.
4. **Empty states** (Primer Blankslate): graphic or icon, one primary line, one secondary line, one action; error-flavoured empties are not playful. Three kinds: not-yet-used, nothing-right-now, failed-to-load.
5. **Destructive actions.** Red is reserved for destruction. Any irreversible action opens the Confirm dialog with the object's name, consequences in one sentence, a typed confirmation for data loss, and the destructive button last and never default-focused. Prefer soft delete with an undo toast for 10 s.
6. **Status colours for health.** Four states only: ok (green), attention (amber), failing (red), unknown/paused (grey), always paired with an icon and a word (never colour alone, WCAG 1.4.1). Contrast ≥ 4.5:1 for text, ≥ 3:1 for the pill border; test in both themes.
7. **Forms on a phone.** One column; labels above fields; native inputs with the right `type`/`inputmode`/`autocomplete`; errors next to the field and summarised at top with links; sticky primary action at the bottom inside the safe area; `3.3.7 Redundant Entry` means we prefill what we already know; `3.3.8 Accessible Authentication` is satisfied by Cloudflare Access (no cognitive puzzles).
8. **Dialogs.** One dialog system: `<dialog>` modal for decisions; bottom sheet variant on phones (full width, 90 dvh max, drag handle optional); never a dialog inside a dialog; focus returns to the trigger; `2.4.11 Focus Not Obscured` means sticky bars must not cover focused fields (`scroll-padding-bottom`).
9. **Internationalisation.** Spanish runs 20–30% longer than English: no fixed-width buttons, wrap allowed on chips (two lines max), truncate only with a tooltip or `title`, dates and numbers via `Intl` with the client's locale, `lang` attribute on `<html>` and on any switched fragment, number columns right-aligned in both languages.
10. **Skeletons vs spinners.** Skeleton for content with a known shape (table rows, cards) sized like the real content (Primer); spinner only for actions under 1 s; a progress sentence for anything longer; `motion-reduce` disables the shimmer.
11. **Respect user preferences** (Primer): `prefers-color-scheme`, `prefers-reduced-motion`, `prefers-contrast`, browser font size (`rem` everywhere), minimum viewport 320 × 256 px.
12. **Words** (Polaris): verbs first ("Add dog", "Export month"), plain language, no punctuation on labels, one idea per sentence, same term for the same thing in both languages.

Design tokens (Tailwind `@theme`, themable ones as `var()` references), kept deliberately short so agents can hold it in their heads:

| Group | Tokens |
|---|---|
| Colour (semantic, light/dark pairs) | `bg`, `surface`, `surface-raised`, `border`, `fg`, `fg-muted`, `primary`, `primary-fg`, `ok`, `attention`, `danger`, `info` (each with `-fg` where text sits on it), `focus` |
| Brand (per client, from `client_config`) | `brand-primary`, `brand-primary-fg`, `brand-accent`, `brand-radius`, `brand-font` |
| Spacing | Tailwind's 4 px scale; layout constants `gutter: 16px`, `row-h: 44px`, `row-h-form: 56px`, `touch: 44px` |
| Radius | `sm: 4px`, `md: var(--brand-radius, 8px)`, `lg: 12px`, `full` |
| Type scale | `xs 12/16`, `sm 14/20`, `base 16/24`, `lg 18/28`, `xl 20/28`, `2xl 24/32`; weights 400/500/600; `tabular-nums` for data |
| Elevation | `shadow-sm` (cards), `shadow-lg` (sheets/popovers); dark mode uses lighter surfaces instead of shadows |
| Motion | `duration-fast 120ms`, `duration-base 200ms`, `ease-out`; all enter/exit via `@starting-style` and `transition`; `motion-reduce` kills them |
| Z layers | none: `<dialog>` and `popover` use the top layer; only `sticky` header (`z-10`) remains |

---

## 10. Decision cards for the owner

### Card 1: What do we style with?

Options:
- **A. Tailwind CSS v4 (recommended).** One CSS file with a short list of named colours and sizes; every screen is built from the same words; the tool is the one most people and AI assistants already know. Consequence: the generated stylesheet for a whole admin is about 17 KB compressed in our test, and a client's colours can be swapped without rebuilding.
- **B. Plain CSS with variables.** No tool at all. Consequence: every component needs hand-written CSS and naming discipline, and consistency depends on the author; slower to build many modules.
- **C. UnoCSS.** Same idea as Tailwind, more configurable. Consequence: a second configuration language to learn and fewer ready examples for assistants.

### Card 2: Where do the buttons, dialogs and menus come from?

Options:
- **A. Our own small set on the browser's built-in parts, plus Zag.js for the three difficult ones (recommended).** Consequence: the admin loads almost no JavaScript, every component looks the same across clients, and we own the accessibility; the three difficult widgets (search-select, menus with submenus, date ranges) use a well-tested engine that officially supports Preact.
- **B. A ready-made CSS component library (daisyUI or Basecoat) on top of Tailwind.** Consequence: a finished look on day one and a bit more CSS (10–20 KB), but a second set of colour names next to ours, and Basecoat depends on one person.
- **C. Web components (Web Awesome).** Consequence: about 35 KB of JavaScript for one button, nothing shows until scripts run, and Astro dropped first-party support for this family.

### Card 3: How does a client's brand reach the screen?

Options:
- **A. One tiny stylesheet per client, `/theme.css`, generated from `client_config` and cached (recommended).** Consequence: no rebuild, no inline code to hash for the security policy, one extra small request that the browser caches.
- **B. Inline the colours into each page.** Consequence: zero extra requests, but every page computes a hash for the security policy and the Worker does a little more work per request.
- **C. Build one deployment per client with the colours baked in.** Consequence: the simplest code, but changing a colour means a deploy.

### Card 4: Charts

Options:
- **A. Drawn on the server as SVG for small charts, uPlot for time series (recommended).** Consequence: dashboards cost no JavaScript except where a live time-series chart is shown (23 KB), and nothing fights the security policy.
- **B. Chart.js everywhere.** Consequence: familiar and flexible, 55–70 KB on every page with a chart.
- **C. No charts in the core; numbers only.** Consequence: lightest possible, but health and usage pages are harder to read at a glance.

### Card 5: Email templates

Options:
- **A. Maizzle, Tailwind for email, compiled at build time (recommended if one visual vocabulary matters most).** Consequence: the same colour and spacing words as the admin; depends on one maintainer and on Vue for templates.
- **B. MJML, compiled at build time.** Consequence: the most battle-tested Outlook output and a bigger team behind it; its own tag language.
- **C. Hand-written table HTML.** Consequence: no tooling, but every template is expert work and easy to break in Outlook.

---

## Appendix A: measured sizes (esbuild 0.25.9, minified, gzip -9, 2026-10-18)

| Entry | min bytes | gz bytes | Notes |
|---|---|---|---|
| `preact` 11.0.1 | 11,926 | 5,013 | |
| `preact` + `preact/hooks` | 15,625 | 6,417 | |
| `@preact/signals` 2.11.3 | 9,333 | 3,491 | preact external |
| `lucide-preact` 1 icon / 20 icons | 3,967 / 8,811 | 1,804 / 3,312 | preact external |
| `@tanstack/table-core` 9.3.1 sort+filter+paginate | 40,129 | 11,858 | whole package 29,084 gz |
| `@tanstack/virtual-core` 3.19.6 | 32,254 | 9,575 | |
| `@zag-js/dialog` + `@zag-js/preact` 1.46.0 | 51,491 | 17,218 | preact external |
| `@zag-js/menu` + adapter | 88,846 | 29,622 | |
| `@zag-js/combobox` + adapter | 92,982 | 30,136 | |
| dialog + menu + combobox + adapter | 150,553 | 46,308 | |
| `uplot` 1.6.32 | 52,010 | 23,009 | + `uPlot.min.css` 772 gz |
| `chart.js/auto` 4.5.1 | 204,493 | 70,067 | |
| `chart.js` bar-only registration | 160,247 | 55,469 | |
| `@observablehq/plot` 0.6.17 | 393,561 | 132,866 | |
| `frappe-charts` 1.6.2 | 69,262 | 18,654 | |
| `zod` 4.6.7 small schema / `zod/mini` small schema | 89,965 / 16,034 | 26,187 / 5,632 | |
| `valibot` 1.5.0 small schema / whole | 3,884 / 84,688 | 1,494 / 15,259 | |
| `arktype` 2.2.8 small schema | 155,403 | 47,302 | |
| `hono` 4.13.13 / `hono/tiny` | 18,322 / 11,669 | 7,667 / 4,975 | server-side anyway |
| Web Awesome 3.14.0 `wa-button` / `wa-dialog` | 136,584 / 148,914 | 34,320 / 37,361 | theme CSS 2,610 gz |
| Tailwind 4.3.3 admin sample (1,495 classes) | 124,685 | 17,077 | plain |
| … + daisyUI 5.7.50 with ~40 component classes used | 210,657 | 28,712 | `include:` subset 25,875 gz |
| … + `@import "basecoat-css"` 1.0.2 | 333,992 | 36,457 | CDN build alone 21,867 gz; `all.min.js` 10,792 gz |
| daisyUI full `daisyui.css` | 1,142,434 | 98,001 | docs claim "34 kB compressed" for the CDN file; likely brotli, not re-verified |

## Appendix B: platform feature support used in §3

- Popover API: Baseline Newly available 2025-01-27 (Chrome 114, Firefox 125, Safari 17 with light-dismiss fixed in 18.3). <https://web.dev/blog/popover-baseline>
- CSS anchor positioning: Chrome 125, Safari 26, Firefox 147; Baseline Newly available January 2026. <https://web.dev/blog/web-platform-01-2026>
- `<dialog closedby>`: Chrome 134, Firefox 141; Safari not yet (Interop 2026). Keep a 3-line JS fallback. <https://web-platform-dx.github.io/web-features-explorer/features/dialog-closedby/>
- `command`/`commandfor` invokers: Chrome 135, Firefox 144, Safari 26.2. <https://webkit.org/blog/17640/webkit-features-for-safari-26-2/>
- WCAG 2.2 (W3C Recommendation 2023-10-05): 9 new criteria including 2.4.11 Focus Not Obscured (AA), 2.5.8 Target Size Minimum 24×24 (AA), 3.3.7 Redundant Entry (A), 3.3.8 Accessible Authentication (AA); 4.1.1 Parsing removed. <https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/> (first three read in full; the rest from the same page's list)

## Appendix C: open GAPs in one place

1. Astro SSR CPU time per page on workerd: no published figure; measure with Workers Observability.
2. Astro CSP nonce support: none found in config or runtime docs; treated as hash-only.
3. Astro Actions accepting Standard Schema validators other than Zod: not stated.
4. Cloudflare Images binding free-tier quota: not checked.
5. uPlot's use of `setAttribute('style')` vs CSSOM: not audited; verify with CSP report-only.
6. `@tanstack/react-table` under `preact/compat` and shadcn/Radix under compat: not measured (not recommended anyway).
7. React Email / jsx-email rendering with Preact: untested.
8. daisyUI "34 kB compressed" CDN claim vs 98 KB gzip measured locally: compression method not confirmed.
9. Standard Schema implementer list: not re-read this session.
10. Free cross-client email rendering test service: none verified.
