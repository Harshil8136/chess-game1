{% raw %}
# 02 — Architecture

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE EDGE NETWORK                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Pages (CDN)  │  │ Workers (SSR)│  │ Web Analytics (free) │  │
│  │ Static HTML  │  │ API Routes   │  │ Automatic tracking   │  │
│  │ CSS, JS, Img │  │ D1/R2/KV     │  └──────────────────────┘  │
│  └──────┬───────┘  └──────┬───────┘                             │
│         │                 │                                      │
│  ┌──────┴─────────────────┴──────────────────────────────────┐  │
│  │              Cloudflare Bindings (Runtime)                 │  │
│  │  ┌────────┐   ┌────────┐   ┌────────┐   ┌──────────────┐ │  │
│  │  │  D1    │   │  R2    │   │  KV    │   │  Turnstile   │ │  │
│  │  │ SQLite │   │ Images │   │ Cache  │   │  Bot Protect │ │  │
│  │  │ 5GB    │   │ 10GB   │   │ 1GB   │   │  Free        │ │  │
│  │  └────────┘   └────────┘   └────────┘   └──────────────┘ │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴──────────┐
                    │  External Services     │
                    │  - Resend (email)       │
                    │  - PostHog (analytics)  │
                    │  - Sentry (errors)      │
                    │  - BetterStack (logs)   │
                    │  - Google Fonts         │
                    │  - Google Maps (embeds) │
                    └─────────────────────────┘
```

---

## Rendering Strategy

Astro uses **static output by default** (`output: 'static'` in `astro.config.ts`). Individual routes opt into SSR with `export const prerender = false`.

### Pre-rendered (Static) Pages

These are built to HTML at build time. They are served instantly from the Cloudflare CDN edge with zero compute cost.

| Page | Path | File |
|---|---|---|
| Spanish Homepage | `/es/` | `src/pages/es/index.astro` |
| English Homepage | `/en/` | `src/pages/en/index.astro` |

### Server-Side Rendered (SSR) Routes

These run as **Cloudflare Workers** on every request. They need dynamic data or bindings (D1, R2, KV).

| Route | Method | File | Purpose |
|---|---|---|---|
| `/api/booking` | POST | `src/pages/api/booking.ts` | Accept booking submissions |
| `/api/ingest/[...path]` | ALL | `src/pages/api/ingest/[...path].ts` | PostHog analytics proxy |
| `/api/privacy/arco` | POST | `src/pages/api/privacy/arco.ts` | ARCO privacy data requests |

---

## Component Hierarchy

```
BaseLayout.astro
├── <head> (SEO meta, fonts, PWA manifest, analytics)
├── <slot name="head"> (for structured data injection)
├── <body>
│   ├── Skip link (accessibility)
│   ├── <slot /> (page content)
│   └── Cloudflare Web Analytics script (production only)
│
└── MarketingLayout.astro (extends BaseLayout)
    ├── Header.astro (slim h-14, glassmorphism scroll transition)
    │   ├── Logo (w-9 h-9 rounded) + brand name
    │   ├── Desktop nav (About, Services, Gallery, FAQ, Contact)
    │   ├── Language switcher (ES/EN with border toggle)
    │   ├── Phone CTA button (hidden on mobile)
    │   ├── Mobile hamburger menu (vanilla JS toggle)
    │   └── Scroll listener: transparent → white glassmorphism at 50px
    │
    ├── <main id="main-content">
    │   ├── Hero.astro (full-screen hero with CTA, trust badges)
    │   ├── About.astro (why choose us, stats grid)
    │   ├── Services.astro (3-tab AutoTabs: Services, Requirements, Pricing)
    │   │   └── Vanilla JS tab switching + auto-rotation + progress bar
    │   ├── SpecializedCare.astro (medication, transport, diet add-ons)
    │   ├── Testimonials.astro (customer reviews)
    │   ├── Gallery.astro (image gallery)
    │   ├── FAQ.astro (accordion FAQ)
    │   └── Contact.astro (Formspree form, dual Google Maps, glassmorphism)
    │       ├── Contact form → Formspree (https://formspree.io/f/xbjnrvnq)
    │       ├── Dog Hotel location card + Google Maps iframe
    │       └── Cat Hotel location card + Google Maps iframe
    │
    ├── Footer.astro
    │   ├── Brand description
    │   ├── Quick links
    │   ├── Legal links (privacy, terms, ARCO)
    │   ├── Contact info (phone, email, address)
    │   └── WhatsApp social link
    │
    └── Scripts
        └── scroll-reveal.ts (IntersectionObserver for data-animate elements)
```

---

## Data Flow: Booking Submission

```
User fills booking form (client-side wizard)
         │
         ▼
POST /api/booking  (Cloudflare Worker)
         │
    ┌────┴─────────────────────────────┐
    │ 1. Parse JSON body               │
    │ 2. Validate with Zod schema      │
    │ 3. Generate booking ref          │
    │    (MAD-YYYYMMDD-XXXX)           │
    │ 4. Insert consent_records → D1   │
    │ 5. Insert bookings → D1          │
    │ 6. Insert booking_pets → D1      │
    │ 7. Insert quality_metadata → D1  │
    │ 8. Push message to EMAIL_QUEUE   │
    │ 9. Update email status → D1      │
    │ 10. Return JSON response         │
    │     { bookingRef, whatsappUrl }   │
    └──────────────────────────────────┘
         │
         ▼
Client shows confirmation + WhatsApp fallback link
```

---

## Data Flow: Analytics Proxy

```
Client-side PostHog SDK → POST /api/ingest/* 
         │
         ▼
Astro API route (Worker)
  - Strips host/cookie headers
  - Forwards to us.i.posthog.com
  - Returns PostHog response (stripped cookies)
         │
         ▼
PostHog Cloud (us.i.posthog.com)
```

This reverse proxy pattern bypasses ad-blockers that would block direct PostHog calls.

---

## Data Flow: ARCO Privacy Requests

```
User submits ARCO form (access/rectification/cancellation/opposition)
         │
         ▼
POST /api/privacy/arco  (Worker)
  - Validate with Zod schema
  - Generate request ID
  - Insert into privacy_requests → D1
  - Return confirmation with 20 business day timeline
```

This complies with Mexico's LFPDPPP (Ley Federal de Protección de Datos Personales en Posesión de Particulares).

---

## Security Architecture

### HTTP Security Headers (`public/_headers`)

Applied globally via Cloudflare Pages `_headers` file:

- **X-Frame-Options:** Removed to allow PostHog Heatmaps (relies on CSP `frame-ancestors` instead for clickjacking protection)
- `X-Content-Type-Options: nosniff` — Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` — Legacy XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin` — Controls referrer leakage
- `Permissions-Policy` — Disables camera, microphone, geolocation, FLoC
- `Content-Security-Policy` — Strict CSP allowing only necessary origins
- `Strict-Transport-Security` — HSTS with 2-year max-age and preload

### Content Security Policy Details

| Directive | Allowed Sources |
|---|---|
| `default-src` | `'self'` |
| `script-src` | `'self'`, `'unsafe-inline'`, `*.posthog.com` |
| `style-src` | `'self'`, `'unsafe-inline'`, `fonts.googleapis.com` |
| `img-src` | `'self'`, `blob:`, `data:`, `*.r2.dev`, `madagascarhotelags.com` |
| `font-src` | `'self'`, `data:`, `fonts.gstatic.com` |
| `connect-src` | `'self'`, `*.posthog.com`, `*.ingest.us.sentry.io`, `in.logs.betterstack.com` |
| `object-src` | `'none'` |
| `frame-ancestors` | `'self'`, `https://app.posthog.com`, `https://eu.posthog.com` |

### Environment Secrets

Secrets are stored in `.dev.vars` (local dev) and `wrangler secret put` (production):

- `RESEND_API_KEY` — Resend transactional email API key (for the `cf-email-consumer` worker)
- `ADMIN_EMAIL` — Admin notification email
- `SENDER_EMAIL` — From address for outbound emails
- `POSTHOG_KEY` — PostHog project API key
- `SENTRY_DSN` — Sentry client DSN
- `BETTERSTACK_SOURCE_TOKEN` — BetterStack Logtail source token

**These are never committed to git** (`.dev.vars` is in `.gitignore`).

{% endraw %}
