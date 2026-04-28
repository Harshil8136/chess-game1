{% raw %}
# 04 — Configuration

Detailed breakdown of every configuration file in the project.

---

## `astro.config.ts` — Astro Framework Configuration

```typescript
import { defineConfig, passthroughImageService } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://madagascarhotelags.com',
  output: 'static',
  image: { service: passthroughImageService() },
  adapter: cloudflare({ platformProxy: { enabled: true } }),
  integrations: [ tailwind(), sitemap({ i18n: { ... } }) ],
  i18n: { defaultLocale: 'es', locales: ['es', 'en'], routing: { prefixDefaultLocale: true } },
  vite: { ssr: { external: ['node:buffer', 'node:crypto'] } },
});
```

### Key Settings Explained

| Setting | Value | Reason |
|---|---|---|
| `site` | `https://madagascarhotelags.com` | Used for canonical URLs, sitemap, and OG meta |
| `output` | `'static'` | Astro 5 default. SSR routes opt out with `export const prerender = false` |
| `image.service` | `passthroughImageService()` | Cloudflare Workers can't use `sharp`. Images pass through unmodified |
| `adapter` | `cloudflare({ platformProxy: { enabled: true } })` | Enables local D1/R2/KV bindings during `astro dev` |
| `integrations[0]` | `tailwind()` | Official `@astrojs/tailwind` integration (v3) |
| `integrations[1]` | `sitemap({ i18n: ... })` | Auto-generates `sitemap-index.xml` with `es-MX` and `en-US` locales |
| `i18n.routing.prefixDefaultLocale` | `true` | Both `/es/` and `/en/` prefixes visible (matches original nextjs-app URL structure) |
| `i18n.routing.redirectToDefaultLocale` | `false` | Prevents unwanted redirects |
| `vite.ssr.external` | `['node:buffer', 'node:crypto']` | Externalizes Node.js built-ins for Cloudflare Workers compatibility |

### Historical Changes

1. `output: 'hybrid'` → `output: 'static'` (Astro v5 deprecated hybrid)
2. `@tailwindcss/vite` plugin removed → `@astrojs/tailwind` integration added (v4 crash fix)
3. `imageService` moved from adapter config to top-level `image.service` (API change)

---

## `package.json` — Dependencies

### Production Dependencies

| Package | Version | Purpose |
|---|---|---|
| `astro` | `^5.7.0` | Core framework |
| `@astrojs/cloudflare` | `^12.3.0` | Cloudflare Pages SSR adapter |
| `@astrojs/preact` | `^4.0.10` | Preact integration for booking wizard (planned) |
| `@astrojs/sitemap` | `^3.3.1` | Auto-generate XML sitemaps |
| `@astrojs/tailwind` | `^6.0.2` | Official Tailwind v3 integration |
| `tailwindcss` | `^3.4.19` | Tailwind CSS v3 (downgraded from v4) |
| `preact` | `^10.25.4` | Lightweight React alternative (3KB) for islands |
| `date-fns` | `^4.1.0` | Date formatting utilities |
| `date-fns-tz` | `^3.2.0` | Timezone handling for Mexico City time |
| `zod` | `^3.25.0` | Schema validation (pinned to v3 for Astro compat) |

### Dev Dependencies

| Package | Version | Purpose |
|---|---|---|
| `@cloudflare/workers-types` | `^4.20250313.0` | TypeScript types for D1, R2, KV, etc. |
| `typescript` | `^5.9.3` | TypeScript compiler |
| `wrangler` | `^4.10.0` | Cloudflare CLI (deploy, local dev, D1 management) |

### NPM Scripts

| Script | Command | Purpose |
|---|---|---|
| `dev` | `astro dev` | Start local dev server with HMR |
| `build` | `astro build` | Build for production |
| `preview` | `astro preview` | Preview production build locally |
| `check` | `astro check` | TypeScript type checking |
| `cf:dev` | `wrangler pages dev ./dist` | Preview with real Cloudflare bindings |
| `cf:deploy` | `astro build && wrangler pages deploy ./dist` | Build + deploy to Cloudflare Pages |
| `db:migrate` | `wrangler d1 execute madagascar-db --local --file=...` | Run D1 migration locally |
| `db:migrate:remote` | `wrangler d1 execute madagascar-db --remote --file=...` | Run D1 migration on production |

---

## `tailwind.config.mjs` — Tailwind v3 Theme

```javascript
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',          // #166534 (emerald-800)
        'primary-hover': 'var(--color-primary-hover)', // #15803d (emerald-700)
        'primary-light': 'var(--color-primary-light)', // #bbf7d0 (emerald-200)
        secondary: 'var(--color-secondary)',       // #0d9488 (teal-600)
        accent: 'var(--color-accent)',             // #4ade80 (green-400)
        background: 'var(--color-background)',     // #ffffff
        foreground: 'var(--color-foreground)',     // #111827 (gray-900)
        'muted-foreground': 'var(--color-muted-foreground)', // #6b7280 (gray-500)
        border: 'var(--color-border)',             // #e5e7eb (gray-200)
        card: 'var(--color-card)',                 // #ffffff
        'card-hover': 'var(--color-card-hover)',   // #f9fafb (gray-50)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
```

**Design Pattern**: Colors are defined as CSS custom properties in `global.css` (`:root`), then referenced in `tailwind.config.mjs` via `var()`. This allows runtime theming while keeping Tailwind's utility classes working.

---

## `tsconfig.json` — TypeScript Configuration

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@layouts/*": ["src/layouts/*"],
      "@lib/*": ["src/lib/*"],
      "@i18n/*": ["src/i18n/*"]
    },
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "types": ["@cloudflare/workers-types/2023-07-01"]
  }
}
```

### Path Aliases

| Alias | Maps To | Example Usage |
|---|---|---|
| `@/*` | `src/*` | `import '@/styles/global.css'` |
| `@components/*` | `src/components/*` | `import Header from '@components/layout/Header.astro'` |
| `@layouts/*` | `src/layouts/*` | `import BaseLayout from '@layouts/BaseLayout.astro'` |
| `@lib/*` | `src/lib/*` | `import { sendEmail } from '@lib/email/send-email'` |
| `@i18n/*` | `src/i18n/*` | `import { t, getTranslations } from '@i18n/config'` |

---

## `wrangler.toml` — Cloudflare Configuration

```toml
name = "cf-astro-madagascar"
compatibility_date = "2025-03-14"
compatibility_flags = ["nodejs_compat"]
pages_build_output_dir = "./dist"
```

### Bindings

| Binding | Type | Name/ID | Usage |
|---|---|---|---|
| `DB` | D1 Database | `madagascar-db`<br>`7fca2a07-d7b4-449d-b446-408f9187d3ca` | Bookings, pets, consent, privacy requests, CMS content |
| `IMAGES` | R2 Bucket | `madagascar-images` | Pet photos, gallery images, hero backgrounds |
| `ARCO_DOCS` | R2 Bucket | `arco-documents` | ARCO legal document storage (private, no public access) |
| `SESSION` | KV Namespace | `SESSION`<br>`bee123e795504473accf58ac5b6de13d` | Astro session store |
| `ISR_CACHE` | KV Namespace | `ISR_CACHE`<br>`d9cea8c7e20f4b328b8cb3b04104138c` | CMS ISR HTML cache (purged via cf-admin webhook) |
| `HYPERDRIVE` | Hyperdrive | `ba5b0db89b2e4591b5f4614e7f0839df` | Supabase PostgreSQL connection pooling |

### Public Variables (`[vars]`)

| Variable | Value | Purpose |
|---|---|---|
| `SITE_URL` | `https://madagascarhotelags.com` | Base URL for absolute link generation |
| `POSTHOG_HOST` | `https://us.i.posthog.com` | PostHog API endpoint |
| `DEFAULT_LOCALE` | `es` | Fallback locale |

### Secret Variables (set via `wrangler secret put`)

| Secret | Purpose |
|---|---|
| `RESEND_API_KEY` | Resend transactional email API key |
| `ADMIN_EMAIL` | Email address for booking notification delivery |
| `SENDER_EMAIL` | "From" address for outbound transactional emails |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side DB access) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile server secret |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST endpoint |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST auth token |
| `REVALIDATION_SECRET` | Shared secret for cf-admin → cf-astro ISR cache purge |
| `BETTERSTACK_SOURCE_TOKEN` | BetterStack Logtail source token (structured logging) |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (build-time only, for source map upload) |

---

## `env.d.ts` — TypeScript Environment Types

Provides type safety for Cloudflare runtime bindings:

```typescript
interface Env {
  DB: D1Database;           // Cloudflare D1 binding
  IMAGES: R2Bucket;         // Cloudflare R2 binding (CMS images)
  ARCO_DOCS: R2Bucket;      // Cloudflare R2 binding (ARCO legal docs)
  SESSION: KVNamespace;     // Astro session KV
  ISR_CACHE: KVNamespace;   // ISR HTML cache KV
  HYPERDRIVE: Hyperdrive;   // Supabase PostgreSQL pooler
  RESEND_API_KEY: string;   // Secret
  ADMIN_EMAIL: string;      // Secret
  SENDER_EMAIL: string;     // Secret
  REVALIDATION_SECRET: string; // Shared ISR purge secret
  SUPABASE_SERVICE_ROLE_KEY: string; // Secret
  BETTERSTACK_SOURCE_TOKEN: string; // BetterStack logging
  SENTRY_DSN: string;       // Sentry client DSN
  SITE_URL: string;         // Public var
  DEFAULT_LOCALE: string;   // Public var
}
```

This enables typed access to bindings in API routes via `import { env } from "cloudflare:workers"` (Astro 6 pattern).

{% endraw %}
