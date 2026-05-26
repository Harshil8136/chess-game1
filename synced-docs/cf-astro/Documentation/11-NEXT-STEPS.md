{% raw %}
# 11 — Next Steps

## Current Status Summary

As of **2026-04-30**, here is the phase completion status:

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Project scaffolding (Astro + Cloudflare adapter + wrangler) | ✅ Complete |
| Phase 2 | Design system & global styles | ✅ Complete |
| Phase 3 | i18n setup (es/en locale routing + translation files) | ✅ Complete |
| Phase 4 | Layout components (Header, Navbar, Footer, MobileMenu) | ✅ Complete — Header refactored to slim h-14 with glassmorphism scroll (2026-03-28) |
| Phase 5 | Marketing homepage (all sections) | ✅ Complete — Services rebuilt with AutoTabs, Contact rebuilt with Resend queue + Maps |
| Phase 6 | D1 database schema + migration scripts | ✅ Complete |
| Phase 7 | R2 bucket for images + image serving utilities | ✅ Complete — CDN migration to `cdn.madagascarhotelags.com` (2026-04-30) |
| Phase 8 | Booking system (wizard UI + API route + Supabase TX + D1 audit) | ✅ Complete |
| Phase 9 | Email integration (Resend via Cloudflare Queues + cf-email-consumer) | ✅ Complete — `cf-email-consumer` deployed (April 2026) |
| Phase 10 | Privacy & compliance (cookie banner, ARCO, consent, RLS) | 🔨 API done, UI + RLS in progress (2026-04-30) |
| Phase 11 | SEO/AEO/GEO/SXO/AIO (schema graph, sitemaps, robots, meta, llms.txt) | ✅ Massively Upgraded 2026-04-13 + IndexNow push indexing 2026-04-30 |
| Phase 12 | PWA (manifest + service worker + shortcuts + screenshots) | ✅ Complete |
| Phase 13 | Analytics proxy (PostHog reverse proxy + consent-gated) | ✅ Complete — PostHog live, consent-gated (LFPDPPP compliant) |
| Phase 14 | Security headers (_headers file) | ✅ Complete |
| Phase 15 | Verification & testing | ⏳ Planned |
| Phase 16 | Cron automation (IndexNow daily + analytics digest) | 🔨 In progress (2026-04-30) |
| Phase 17 | Analytics Engine expansion (full funnel tracking) | 🔨 In progress (2026-04-30) |
| Phase 18 | Workers AI (FAQ generation + blog drafts) | 🔨 In progress (2026-04-30) |
| Phase 19 | Security hardening — DB least-privilege, PII audit strip, timing-safe auth | ✅ Complete (2026-05-04) — see [18-SECURITY-HARDENING.md](./18-SECURITY-HARDENING.md) |

---

## Remaining Work — Ordered by Priority

### 🔴 High Priority (Required for Launch)

#### 0. Search Console & Domain Migration (Manual Steps)

The SEO infrastructure is code-complete. The following manual steps are needed to activate it:

1. **Google Search Console** — Add Domain property for `madagascarhotelags.com`, verify via DNS TXT, submit `sitemap-index.xml`, trigger Change of Address from `pet.madagascarhotelags.com`
2. **Bing Webmaster** — Import from GSC (auto-verified), submit sitemap, add `msvalidate.01` meta to BaseLayout
3. **IndexNow** — Generate key, place key file in `/public/[key].txt`, uncomment verification meta in BaseLayout, wire into `/api/revalidate`
4. **Google Business Profile** — Update website URL to `https://madagascarhotelags.com`
5. **Cloudflare Dashboard** — Add custom domain in Pages settings; create 3 Redirect Rules (pet.→apex, www.→apex, pages.dev→apex)

See [13-SEO-AND-SEARCH-OPTIMIZATION.md](./13-SEO-AND-SEARCH-OPTIMIZATION.md) for full details.

---

#### 1. R2 Image Setup (Phase 7)

**What needs to be done**:
- Create R2 bucket `madagascar-images` via `wrangler r2 bucket create`
- Upload all images from `nextjs-app/public/images/` to R2
- Create `src/lib/r2.ts` — Utility functions for `getImageUrl(key)`
- Update image `src` attributes in components to use R2 URLs
- Set up public access (custom domain or `*.r2.dev`)
- Add cache rules for aggressive image caching (1 year TTL)

**Current state**: Components reference `/images/*.jpg` from `public/images/` (placeholder local copies).

#### 3. Privacy & Cookie Banner UI (Phase 10 continuation)

**What needs to be done**:
- Create `src/pages/[lang]/privacy-policy.astro` — Full privacy policy page
- Build `CookieBanner.astro` — Cookie consent banner (Astro island with `client:idle`)
- Build ARCO request form UI (the API at `/api/privacy/arco` is ready)
- Create consent revocation endpoint (`/api/privacy/revoke`)
- Create consent logging endpoint (`/api/privacy/consent`)

---

### 🟡 Medium Priority (Important but Not Blocking)

#### 4. Cloudflare Resource Provisioning (✅ Completed 2026-03-17)

All required Cloudflare resources (D1, R2, KV) have been created in the `Mascotasmadagascar@gmail.com` account. `wrangler.toml` is up to date with real IDs. Initial D1 migration was successful and production secrets are set.

#### 5. ✅ PostHog Client-Side Initialization — COMPLETE

PostHog `posthog-js` initialized via `src/scripts/analytics-loader.ts`. Reverse-proxied via `/api/ingest`. Consent-gated (LFPDPPP compliant) — only fires if user accepts cookies. Booking funnel tracking active.

#### 6. ✅ Sentry Client-Side Error Tracking — COMPLETE

`@sentry/browser` initialized in `BaseLayout.astro` via `requestIdleCallback` (zero LCP impact). 10% trace sampling. `@sentry/cloudflare` in `functions/_middleware.ts` for edge-level distributed tracing.

#### 7. ✅ Cloudflare Turnstile (Bot Protection) — COMPLETE

Turnstile on booking form (Invisible mode) and ARCO form (Managed mode). Server-side token verification in `/api/booking` and `/api/arco/submit`.

---

### 🟢 Low Priority (Polish & Enhancement)

#### 8. Administrative Features

- Admin dashboard for viewing bookings (protected route)
- Booking status management (confirm, cancel, complete)
- Gallery management (upload/delete images via R2)
- Site settings management (hero image, featured testimonials via D1 `site_settings`)

#### 9. Performance Optimization

- Implement `View Transitions` API for smooth page navigation
- Add `prefetch` hints for likely navigation targets
- Optimize images with `srcset` + responsive sizes
- Consider `imageService: "compile"` for pre-rendered images

#### 10. Testing

- E2E testing with Playwright (booking flow, language switch, form validation)
- Lighthouse CI for automated performance audits
- Visual regression testing for design consistency

#### 11. CI/CD Pipeline

- GitHub Actions workflow for automated builds
- Run `astro check` and `astro build` on every PR
- Auto-deploy to Cloudflare Pages on `main` branch push

---

## Known Limitations

1. **No server-side sessions** — Booking form is stateless. Multi-step wizard state is client-side only.
2. **No user accounts** — The pet hotel doesn't need user login; bookings are tracked by email.
3. **No payment processing** — Payments are handled separately (cash/transfer). The form is a booking request, not a purchase.
4. **No admin panel yet** — Bookings are viewable through the Supabase dashboard or direct SQL queries.
5. **Image optimization deferred** — Using `passthroughImageService()` means no server-side optimization. Images should be pre-optimized before upload to R2.

---

## Architecture Decisions Still Open

| Decision | Options | Current Recommendation |
|---|---|---|
| Booking wizard framework | Preact vs Vanilla JS vs Solid.js | **Preact** (3KB, installed; AutoTabs.tsx available as reference island) |
| Tab switching pattern | Preact island vs Vanilla JS | **Vanilla JS** (proven in Services.astro — avoids Astro JSX-as-props limitation) |
| Contact form handler | Resend API vs Formspree vs Custom Worker | **Resend via Queue** (consistent with booking email architecture) |
| Image serving | R2 custom domain vs *.r2.dev | Custom domain (better branding, same cost) |
| Caching strategy | KV vs Worker Cache API | KV for persistent data, Cache API for HTTP cache |
| Chatbot | Vanilla JS facade vs Preact island | Vanilla JS (lazy-loaded, not critical) |

{% endraw %}
