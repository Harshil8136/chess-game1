# 09 — Deployment

## Build & Deploy Pipeline

### Local Development

```bash
# Start Astro dev server with HMR (port 4321)
npm run dev

# Build for production
npm run build

# Preview with Cloudflare bindings (D1, R2, KV)
npm run cf:dev
```

The `astro dev` command provides:
- Hot Module Replacement (HMR) via Vite
- Local Cloudflare bindings via `platformProxy: { enabled: true }` in `astro.config.ts`
- TypeScript type checking
- Tailwind CSS JIT compilation

### Production Build

```bash
npm run build
# → Outputs to dist/
#   - dist/client/     (static assets: HTML, CSS, JS, images)
#   - dist/_worker.js  (Cloudflare Worker for SSR routes)
```

The build process:
1. **Content sync** — Astro scans content collections and generates types
2. **Server build** — Compiles SSR routes into a Worker bundle (`_worker.js`)
3. **Client build** — Vite bundles client-side assets (CSS, minimal JS)
4. **Pre-rendering** — Static pages (`/es/index.html`, `/en/index.html`) are generated
5. **Sitemaps** — Custom TypeScript endpoints generate `sitemap-index.xml`, `sitemap-es.xml`, `sitemap-en.xml`, `sitemap-images.xml` (replaces `@astrojs/sitemap`)
6. **robots.txt** — Dynamic TypeScript endpoint generates robots.txt with AI bot rules
7. **Asset rearrangement** — Cloudflare adapter reorganizes files for Pages deployment

### Deploy to Cloudflare Pages

```bash
# Build + deploy in one command
npm run cf:deploy
# Equivalent to: astro build && wrangler pages deploy ./dist
```

Or manually:
```bash
npx astro build
npx wrangler pages deploy ./dist --project-name=cf-astro-madagascar
```

---

## Cloudflare Pages Configuration

### Project Name

`cf-astro-madagascar` (set in `wrangler.toml` as `name`)

### Build Output Directory

`./dist` (set in `wrangler.toml` as `pages_build_output_dir`)

### Compatibility Settings

```toml
compatibility_date = "2025-03-14"
compatibility_flags = ["nodejs_compat"]
```

The `nodejs_compat` flag enables Node.js API compatibility in Workers (required for some Astro internals).

---

## Database Setup (D1)

### Create the Database

```bash
# Create D1 database (one-time setup - completed 2026-03-17)
# npx wrangler d1 create madagascar-db

# After creation, update wrangler.toml with the database_id:
# [[d1_databases]]
# binding = "DB"
# database_name = "madagascar-db"
# database_id = "bbca7ba8-87b0-4998-a17d-248bb8d9a0a2"
```

### Run Migrations

```bash
# Local (development)
npm run db:migrate
# → wrangler d1 execute madagascar-db --local --file=./db/migrations/0001_initial_schema.sql

# Remote (production)
npm run db:migrate:remote
# → wrangler d1 execute madagascar-db --remote --file=./db/migrations/0001_initial_schema.sql
```

### Inspect Local Database

```bash
npx wrangler d1 execute madagascar-db --local --command="SELECT * FROM bookings"
```

---

## R2 Bucket Setup

### Create the Bucket

```bash
# Create R2 bucket (one-time setup)
npx wrangler r2 bucket create madagascar-images
```

### Upload Images

```bash
# Upload individual images
npx wrangler r2 object put madagascar-images/boarding.jpg --file=./public/images/boarding.jpg

# Or use the dashboard at dash.cloudflare.com → R2
```

### Public Access

Option A: Enable public access via R2 custom domain (recommended)
Option B: Use `*.r2.dev` public URL (enabled in R2 settings)

---

## KV Namespaces Setup

cf-astro uses **two** KV namespaces:

```bash
# SESSION — Astro session store
# [[kv_namespaces]]
# binding = "SESSION"
# id = "9da1ac5253a54ea1bf236c6fe514dd02"

# ISR_CACHE — CMS dynamic HTML cache (purged by cf-admin via /api/revalidate)
# [[kv_namespaces]]
# binding = "ISR_CACHE"
# id = "e31f413bb1224f559a8de105248da6cc"
```

---

## Environment Secrets

```bash
# Set secrets for production (interactive prompts for values)
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_EMAIL
npx wrangler secret put SENDER_EMAIL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put UPSTASH_REDIS_REST_URL
npx wrangler secret put UPSTASH_REDIS_REST_TOKEN
npx wrangler secret put REVALIDATION_SECRET
```

For local development, these are in `.dev.vars` (not committed to git).

---

## Cloudflare Free Tier Budget

| Resource | Estimated Usage | Free Limit | Headroom |
|---|---|---|---|
| Pages Builds | ~30/month | 500/month | 94% free |
| Worker Requests | ~500/day | 100,000/day | 99.5% free |
| D1 Rows Read | ~1,000/day | 5,000,000/day | 99.98% free |
| D1 Rows Written | ~50/day | 100,000/day | 99.95% free |
| D1 Storage | ~50MB | 5GB | 99% free |
| R2 Storage | ~200MB | 10GB | 98% free |
| R2 Class A Ops | ~100/month | 1,000,000/month | 99.99% free |
| R2 Class B Ops | ~50,000/month | 10,000,000/month | 99.5% free |
| KV Reads | ~500/day | 100,000/day | 99.5% free |
| KV Writes | ~10/day | 1,000/day | 99% free |

> The site's traffic (small business pet hotel in Aguascalientes, MX) is well within free tier limits. Even 10x traffic growth would stay within bounds.

---

## Domain Setup

### Option A: Use `.pages.dev` (staging/testing)

No DNS changes needed. The site is currently live at:
`https://cf-astro-madagascar.pages.dev`

### Option B: Custom Domain (production) — `madagascarhotelags.com`

1. Transfer DNS to Cloudflare (or add zone)
2. Add custom domain `madagascarhotelags.com` in Pages project settings → Custom domains
3. Cloudflare auto-provisions SSL certificate
4. Update `site` in `astro.config.ts` to `https://madagascarhotelags.com`
5. Create 3 Redirect Rules in Cloudflare Dashboard (Rules → Redirect Rules):
   - `pet.madagascarhotelags.com/*` → `https://madagascarhotelags.com/${path}` (301)
   - `www.madagascarhotelags.com/*` → `https://madagascarhotelags.com/${path}` (301)
   - `cf-astro.pages.dev/*` → `https://madagascarhotelags.com/${path}` (301)

**Note**: Use Redirect Rules (not deprecated Page Rules). `public/_redirects` handles the same redirects as belt-and-suspenders, but the primary authority is the Dashboard rules since cross-domain redirects require the request to route through the correct zone.

---

## Post-Deploy Verification Checklist

- [ ] Homepage loads at `/es/` with all sections
- [ ] Language toggle switches between `/es/` and `/en/`
- [ ] CSS styles are applied (Tailwind processed correctly)
- [ ] Images load from R2 bucket (`cdn.madagascarhotelags.com`)
- [ ] Booking form submits to `/api/booking` (check D1 dashboard)
- [ ] Emails sent via Resend (via Queue → cf-email-consumer worker)
- [ ] Privacy/ARCO form works at `/api/privacy/arco`
- [ ] Analytics events flow through `/api/ingest/`
- [ ] Security headers present (inspect via DevTools → Network)
- [ ] PWA installable (check DevTools → Application → Manifest)
- [ ] Lighthouse audit: 95+ on all categories
- [ ] `sitemap-index.xml` accessible and valid XML
- [ ] `sitemap-es.xml` contains `xhtml:link` hreflang entries
- [ ] `sitemap-images.xml` contains `image:image` entries
- [ ] `robots.txt` accessible — shows AI bot `Allow:` directives
- [ ] `llms.txt` accessible at root
- [ ] `llms-full.txt` accessible at root
- [ ] `.well-known/security.txt` accessible
- [ ] JSON-LD `@graph` in homepage source (6 schema types)
- [ ] Services page has ServicePageSchema in source
- [ ] Blog post has BlogPostSchema in source
- [ ] Hreflang `<link>` tags in every page `<head>`
- [ ] OG image tags present (test with [opengraph.xyz](https://opengraph.xyz))
- [ ] Geo meta tags present (`geo.region=MX-AGS`)
- [ ] Domain redirects: `pet.` and `www.` → apex (check 301 status)
- [ ] Google Search Console: Domain property verified, sitemap submitted
- [ ] Bing Webmaster: Imported from GSC, sitemap submitted
