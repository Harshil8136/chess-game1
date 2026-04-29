{% raw %}
# 01 — Project Overview

## Business Context

**Hotel para Mascotas Madagascar** is a pet hotel business in Aguascalientes, Mexico, with over 30 years of experience. The website serves as:

1. **Marketing landing page** — Showcases services (boarding, daycare, transport), trust badges, testimonials, gallery, FAQ, and contact info
2. **Booking platform** — Multi-step wizard for owners to book pet stays
3. **Bilingual site** — Full Spanish (primary) and English support for the Aguascalientes market

The original website was built with **Next.js 16 + React 19** and deployed on **Vercel**, using Supabase (PostgreSQL), Vercel Blob, Vercel KV, and Nodemailer (Brevo SMTP).

---

## Migration Rationale

The migration to Cloudflare was driven by:

| Factor | Vercel (Before) | Cloudflare (After) |
|---|---|---|
| **Hosting Cost** | Free tier with limits; paid for overages | Completely free for this traffic level |
| **Database** | Supabase free tier (PostgreSQL) | D1 free tier (5GB, 5M reads/day) |
| **Image Storage** | Vercel Blob (limited free tier) | R2 (10GB free, zero egress) |
| **Bandwidth** | 100GB/month free | Unlimited bandwidth |
| **Build Minutes** | 6,000/month | 500 builds/month (sufficient) |
| **Edge Compute** | Serverless functions | Workers (100K requests/day free) |
| **CDN** | Vercel Edge Network | Cloudflare global CDN (300+ cities) |
| **DDoS Protection** | Basic | Enterprise-grade (free) |

### Why Astro Instead of Next.js?

1. **Zero JavaScript by default** — Marketing pages ship 0 KB JS unless islands are used
2. **Smaller bundles** — No React runtime (45KB+) for static content
3. **Native Cloudflare support** — `@astrojs/cloudflare` adapter with first-class D1/R2/KV bindings
4. **Built-in i18n routing** — No need for `next-intl` library
5. **Faster builds** — Astro builds are significantly faster than Next.js for content sites
6. **Island Architecture** — Only interactive components (booking wizard) load JS

---

## Stack Mapping

| Layer | nextjs-app (Before) | cf-astro (After) |
|---|---|---|
| Framework | Next.js 16 (React 19) | Astro 6.0+ |
| Hosting | Vercel | Cloudflare Pages |
| Database | Supabase (PostgreSQL) | Cloudflare D1 (SQLite) + Supabase PostgreSQL |
| Image Storage | Vercel Blob | Cloudflare R2 (`cdn.madagascarhotelags.com`) |
| KV Store | Vercel KV (Upstash Redis) | Cloudflare KV + Upstash Redis |
| Email | Nodemailer (SMTP via Brevo) | Resend HTTP API via Cloudflare Queues |
| i18n | next-intl | Astro built-in i18n + custom `t()` |
| CSS | Tailwind CSS 4 | Tailwind CSS v4 via `@tailwindcss/vite` |
| Interactive UI | React components | Astro Islands (Preact) |
| Analytics | PostHog + Vercel Analytics | PostHog + Cloudflare Web Analytics |
| Error Tracking | Sentry (full SDK) | Sentry (browser-only) |
| PWA | next-pwa (library) | Manual service worker + manifest (enhanced) |
| Bot Protection | (not used) | Cloudflare Turnstile |
| SEO | next-seo patterns | Custom JSON-LD graph + custom sitemap endpoints |

---

## Project Goals (Ordered by Priority)

1. **Feature parity** — Every page, section, API endpoint, and user flow from `nextjs-app` must work identically
2. **Zero hosting cost** — Stay entirely within Cloudflare's free tier
3. **Performance improvement** — Faster load times via 0 JS marketing pages and edge-rendered SSR
4. **Code quality** — TypeScript strict mode, Zod validation, clean component architecture
5. **SEO preservation** — Same URL structure (`/es/`, `/en/`), same meta tags, same structured data
6. **Developer experience** — Hot reload, local D1/R2/KV bindings via `wrangler`, type-safe env vars

---

## Key Decisions Made

### Decision 1: Tailwind CSS Version

**Problem**: Tailwind CSS v4's `@tailwindcss/vite` plugin causes silent build crashes with Astro 5's SSR + Cloudflare adapter.

**Resolution**: Downgraded to Tailwind CSS v3 with the official `@astrojs/tailwind` integration. This is stable and well-tested with Astro 5. See [10-TROUBLESHOOTING-LOG.md](./10-TROUBLESHOOTING-LOG.md) for full details.

### Decision 2: Astro Output Mode

**Problem**: Astro 5 deprecated the `output: 'hybrid'` mode.

**Resolution**: Changed to `output: 'static'`. Individual routes that need SSR use `export const prerender = false` to opt out of prerendering.

### Decision 3: Image Service

**Problem**: Cloudflare Workers cannot use `sharp` (Node.js native module) for image processing.

**Resolution**: Configured `image: { service: passthroughImageService() }` in `astro.config.ts` to bypass server-side image optimization. Images are served directly from R2.

### Decision 4: Email Transport

**Problem**: Cloudflare Workers cannot open raw TCP/SMTP sockets (required by Nodemailer), and embedding massive provider SDKs bloats the edge bundle.

**Resolution**: Switched to Resend's HTTP API via a dedicated, decoupled Cloudflare Queue worker (`cf-email-consumer`). The main project produces queue messages, ensuring 0ms latency impact on API responses.

### Decision 5: Booking Wizard UI Framework

**Status**: Pending — The plan recommends **Preact** (3KB, React-compatible) for the booking wizard's complex multi-step form. The `@astrojs/preact` integration is installed but the wizard UI itself is not yet built.

### Decision 6: Zod Version

**Problem**: Installing Zod v4 alongside Astro (which internally uses Zod v3) caused build conflicts.

**Resolution**: Pinned Zod to `^3.25.0` in `package.json`.

{% endraw %}
