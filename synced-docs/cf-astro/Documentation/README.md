{% raw %}
# cf-astro — Madagascar Pet Hotel (Cloudflare Edition)

## Documentation Index

This folder contains comprehensive project documentation for the **cf-astro** migration — a full rebuild of the `nextjs-app` pet hotel website using **Astro 5** on **Cloudflare Pages**, leveraging exclusively Cloudflare's free tier services.

### Documents

| Document | Description |
|---|---|
| [01-PROJECT-OVERVIEW.md](./01-PROJECT-OVERVIEW.md) | Business context, goals, migration rationale, and stack mapping |
| [02-ARCHITECTURE.md](./02-ARCHITECTURE.md) | System architecture, rendering strategy, data flow, and component hierarchy |
| [03-FILE-INVENTORY.md](./03-FILE-INVENTORY.md) | Complete file tree with every file's purpose, status, and key details |
| [04-CONFIGURATION.md](./04-CONFIGURATION.md) | All config files explained: Astro, Tailwind, TypeScript, Wrangler, env vars |
| [05-DESIGN-SYSTEM.md](./05-DESIGN-SYSTEM.md) | Design tokens, colors, typography, CSS architecture, and Tailwind setup |
| [06-I18N.md](./06-I18N.md) | Internationalization system: routing, translation files, helper functions |
| [07-BACKEND-AND-API.md](./07-BACKEND-AND-API.md) | API routes, D1 database schema, email integration, analytics proxy, privacy |
| [08-COMPONENTS.md](./08-COMPONENTS.md) | All Astro components: layouts, sections, SEO, and layout components |
| [09-DEPLOYMENT.md](./09-DEPLOYMENT.md) | Build process, Cloudflare Pages deployment, Wrangler CLI, and free tier budget |
| [10-TROUBLESHOOTING-LOG.md](./10-TROUBLESHOOTING-LOG.md) | Chronological log of all bugs encountered and how they were resolved |
| [11-NEXT-STEPS.md](./11-NEXT-STEPS.md) | Remaining work, pending phases, and future enhancements |
| [12-CHANGELOG.md](./12-CHANGELOG.md) | Chronological record of feature additions, design refactors, and improvements |
| [13-SEO-AND-SEARCH-OPTIMIZATION.md](./13-SEO-AND-SEARCH-OPTIMIZATION.md) | Complete SEO/AEO/GEO/SXO/AIO guide: schema graph, sitemaps, robots.txt, llms.txt, domain migration |

### Quick Start

```bash
# Install dependencies
npm install

# Run dev server (Astro + Vite)
npm run dev

# Build for production
npm run build

# Preview with Cloudflare bindings (D1, R2, KV)
npm run cf:dev

# Deploy to Cloudflare Pages
npm run cf:deploy
```

### Key Facts

- **Business**: Hotel para Mascotas Madagascar — pet hotel in Aguascalientes, Mexico
- **Framework**: Astro 6.0+ with `@astrojs/cloudflare` adapter
- **Styling**: Tailwind CSS v4 via `@tailwindcss/vite` Vite plugin
- **Languages**: Spanish (default) + English
- **Database**: Cloudflare D1 (SQLite) + Supabase PostgreSQL
- **Images**: Cloudflare R2 bucket (served via `cdn.madagascarhotelags.com`)
- **Email**: Resend HTTP API via Cloudflare Queues + `cf-email-consumer` sidecar worker
- **Analytics**: PostHog (via reverse proxy) + Cloudflare Web Analytics
- **Animation**: IntersectionObserver scroll-reveal system (`data-animate`)
- **Live Site**: [madagascarhotelags.com](https://madagascarhotelags.com)
- **Status**: ✅ Live in production — SEO/AEO/GEO overhaul 2026-04-13

{% endraw %}
