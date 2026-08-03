{% raw %}
# CF-ASTRO PROJECT — OPERATIONAL RULES & ARCHITECTURE BIBLE

> **Last Updated:** 2026-07-06

## 🏢 PROJECT MISSION — COMMERCIAL-GRADE, $0 INFRASTRUCTURE

**cf-astro is a production-ready, commercial-grade pet hotel website built entirely on FREE tier services.** This is a real business application designed to:

- Handle real customer bookings with email confirmations
- Run 24/7 at **$0/month** total infrastructure cost
- Deliver Lighthouse 95+ performance on mobile
- Meet professional SEO, accessibility, and security standards

Every architectural decision optimizes for one goal: maximum professional quality at exactly ZERO ongoing cost. We combine Cloudflare's free tier (Workers, D1, R2, KV, Pages) with Brevo (+ Resend failover), Supabase, Upstash, PostHog, and Sentry free tiers.

---

## 🚨 RULE #0 — THE ABSOLUTE LAW (NEVER VIOLATE)

**cf-astro is the Cloudflare-native version of nextjs-app. WE NEVER, like NEVER, copy any single file or code from there.**

- ✅ **ALLOWED:** Reference nextjs-app to understand features, flows, UX patterns, business logic concepts
- ✅ **ALLOWED:** Build equivalent functionality from scratch using Cloudflare-optimized patterns
- ❌ **FORBIDDEN:** Copy-pasting any file, component, function, hook, schema, or code block from nextjs-app
- ❌ **FORBIDDEN:** Duplicating CSS, translations, or configuration verbatim from nextjs-app
- ❌ **FORBIDDEN:** Using nextjs-app files as templates with "find and replace" modifications

**Every line of code in cf-astro must be written fresh, optimized for the Cloudflare + Astro + Preact stack.**

---

## 1. PROJECT IDENTITY

| Property           | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| **Framework**      | Astro 6.0+ with `@astrojs/cloudflare` adapter                                |
| **UI Islands**     | Preact (3KB, React-compatible) for interactive components                    |
| **Hosting**        | Cloudflare Pages (unlimited bandwidth, free)                                 |
| **Database**       | Cloudflare D1 (SQLite) + Supabase PostgreSQL (Direct connection 5432)        |
| **Cache**          | Cloudflare KV + Upstash Redis                                                |
| **Storage**        | Cloudflare R2 (images/assets) + Supabase Storage (private/auth-gated)        |
| **Email**          | Async via Cloudflare Queue → shared `cf-astro-email-consumer` worker. Brevo is primary for every send (cf-astro and cf-admin alike); Resend is an automatic same-request failover if Brevo throws — not a per-project split. |
| **Bot Protection** | Cloudflare Turnstile (free, unlimited challenges)                            |
| **Analytics**      | PostHog (reverse-proxied) + Cloudflare Web Analytics + Analytics Engine      |
| **Error Tracking** | Sentry (`@sentry/browser` + `@sentry/cloudflare` distributed tracing)        |
| **Logging**        | BetterStack (`@logtail/edge`, server-side structured logging)                |
| **i18n**           | Astro built-in (es/en with prefix routing)                                   |
| **CSS**            | Tailwind CSS **v4** via `@tailwindcss/vite` Vite plugin                      |

---

## 2. ARCHITECTURAL PATTERNS

- **Edge-First**: The application is designed to execute as close to the user as possible using Cloudflare Workers.
- **Failover / Resiliency**: We use D1 as a dead-letter/audit queue for bookings. If Supabase fails, data is retained in D1 for delayed execution.
- **Islands Architecture**: We limit client-side JS by utilizing Astro islands with Preact only where interactivity is required.
- **Hybrid-SMTP Async Email**: All email dispatch (from both cf-astro and cf-admin) is non-blocking via one shared Cloudflare Queue (`madagascar-emails`) consumed by one shared worker, `cf-astro-email-consumer`. **Brevo is the primary provider for every send regardless of `projectSource`**; **Resend is wired in only as an automatic same-request failover** if the Brevo call throws — there is no per-project routing split.

> For historical constraints and deprecated patterns, see `Documentation/ARCHIVE-RULES-HISTORY.md`.

{% endraw %}
