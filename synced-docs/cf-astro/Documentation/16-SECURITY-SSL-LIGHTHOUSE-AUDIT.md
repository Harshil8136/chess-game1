{% raw %}
# 16 — Security, SSL/TLS, HTTPS & Lighthouse Audit

> **Date:** 2026-04-22
> **Lighthouse Version:** 13.0.1 — Emulated Moto G Power, Slow 4G, HeadlessChromium 146
> **Security Scan Source:** Cloudflare Security Insights export — 18 active alerts across 6 domains
> **Scores at audit time:** Performance 73 / Accessibility 95 / Best Practices 77 / SEO 92
> **Status:** Code fixes applied and documented. Cloudflare dashboard steps required to resolve the persistent scanner alerts.
>
> **2026-05-04 Update:** Additional hardening applied (DB least-privilege role, PII audit log stripping, timing-safe auth, rate limit hardening). See [18-SECURITY-HARDENING.md](./18-SECURITY-HARDENING.md) for the full deep audit and manual steps required.

---

## Overview

This document records the complete findings, root cause analysis, code changes, and required dashboard actions from the April 2026 security and performance audit. It explains why certain issues persisted despite prior remediation attempts and provides a definitive resolution path.

---

## Part 1 — Why the Cloudflare Security Alerts Persisted

### The Fundamental Misunderstanding

Every persistent alert in the Security Insights export has the same root cause: **the Cloudflare Security Insights scanner does not inspect HTTP response headers.** It reads Cloudflare zone configuration from the dashboard API.

The `public/_headers` file sets `Strict-Transport-Security`, `Content-Security-Policy`, and other headers at the application layer. These headers are correct and are served to browsers. The Security Insights scanner never sees them. It queries whether:

1. **HSTS** is enabled in `SSL/TLS → Edge Certificates → HTTP Strict Transport Security`
2. **Always Use HTTPS** is toggled ON in `SSL/TLS → Edge Certificates`
3. **SSL/TLS mode** is set to Full (strict) in `SSL/TLS → Overview`

Until those three dashboard toggles are set, the scanner will keep producing alerts regardless of how correct the `_headers` file is. The fix is not in the code — it is in the dashboard.

---

## Part 2 — Cloudflare Security Insights: Complete Alert Analysis

### 2.1 Main Domain — `madagascarhotelags.com`

Four categories of alerts were active for the main domain:

**Domains without HSTS**
The zone-level HSTS setting is OFF. The scanner detected no HSTS configuration in the zone, even though the `_headers` file correctly sets the header. Fix: enable HSTS via the dashboard at `SSL/TLS → Edge Certificates → HTTP Strict Transport Security`.

**Domains without "Always Use HTTPS"**
HTTP requests on port 80 receive a response without being redirected to HTTPS. The Cloudflare edge is not enforcing the HTTP → HTTPS redirect. Fix: `SSL/TLS → Edge Certificates → Always Use HTTPS → ON`.

**Domains missing TLS Encryption**
The SSL/TLS encryption mode is not Full (strict). This does not mean the public site lacks HTTPS — it means the mode governing how Cloudflare encrypts the connection is below the required standard. Fix: `SSL/TLS → Overview → Full (strict)`.

**DMARC Record Error (2 alerts — duplicate for 2 MX hosts)**
No valid `_dmarc` TXT record exists in DNS, or it is malformed. Without DMARC, anyone can send email appearing to come from `@madagascarhotelags.com`. Fix: add a `_dmarc` TXT record (see Section 3.8).

### 2.2 CDN Subdomain — `cdn.madagascarhotelags.com`

Three alerts: TLS missing, HSTS missing, Always HTTPS missing.

Root cause: The subdomain has a DNS record but is not set up via the R2 Custom Domain feature. R2 custom domains provision TLS certificates and orange-cloud proxying automatically when configured through `R2 → bucket → Settings → Custom Domains`. A manually created DNS A or CNAME record pointing to the R2 bucket does not get a certificate this way. Fix: verify the domain appears in R2 Custom Domains as Active, or re-register it (see Section 3.4).

### 2.3 Chatbot Subdomains — `charlar.madagascarhotelags.com` and `chat.madagascarhotelags.com`

Two alerts each: TLS missing, HSTS missing.

Root cause: DNS records were created for cf-chatbot deployment but no Worker route or Pages deployment was bound to these hostnames. Without an active Cloudflare proxy deployment, there is nothing to terminate TLS on port 443. Port 80 accepts connections (Cloudflare always responds to HTTP for proxied DNS records) but returns no TLS-protected equivalent. Fix: either delete both DNS records until cf-chatbot is deployed, or deploy cf-chatbot with Worker routes for these hostnames (see Section 3.5).

### 2.4 Admin Subdomain — `secure.madagascarhotelags.com`

Three alerts: TLS missing, HSTS missing, Always HTTPS missing.

Root cause: Orphaned DNS record with no active deployment. Fix: delete the DNS record. If an admin subdomain is needed, provision it at deployment time as `admin.madagascarhotelags.com`.

### 2.5 Redirect Subdomain — `pet.madagascarhotelags.com`

Two alerts: TLS missing, HSTS missing.

Root cause: This subdomain has a Cloudflare Redirect Rule configured to forward traffic to the apex domain. However, the DNS record is gray-clouded (DNS-only), meaning traffic bypasses Cloudflare's proxy entirely. The redirect rule and TLS termination only work when the record is orange-clouded (proxied). Fix: change the cloud color for the `pet` DNS record from gray to orange.

### 2.6 Configuration Suggestions

| Alert | Priority | Recommendation |
|-------|----------|---------------|
| Bot Fight Mode not enabled | Moderate | Enable: `Security → Bots → Bot Fight Mode` |
| Review and block AI bots | Moderate | Decision required — see Section 3.7 |
| Review unwanted AI crawlers with AI Labyrinth | Low | Enable if AI bot blocking is desired |
| Security.txt not configured | Low | Register at `Security → Security Center` even though the file is served at `/.well-known/security.txt` — the scanner checks the dashboard registration separately |

---

## Part 3 — Dashboard Fix Sequence

Perform in this exact order. Steps 1–3 will clear the majority of alerts immediately.

### 3.1 — SSL/TLS Encryption Mode

`Cloudflare → madagascarhotelags.com → SSL/TLS → Overview`

Change to: **Full (strict)**

This resolves all "Domains missing TLS Encryption" alerts. For a Cloudflare Pages or Workers deployment with no separate origin server, Full (strict) is always safe and is the correct mode.

### 3.2 — Always Use HTTPS

`SSL/TLS → Edge Certificates → Always Use HTTPS → Toggle ON`

Forces all HTTP:80 requests to redirect to HTTPS:443 at the Cloudflare edge, before any application code runs. Resolves all "Domains without Always Use HTTPS" alerts.

### 3.3 — Zone-Level HSTS

`SSL/TLS → Edge Certificates → HTTP Strict Transport Security (HSTS) → Enable HSTS → Change`

| Setting | Value |
|---------|-------|
| Status | Enabled |
| Max Age Header | 12 months (31,536,000 seconds) |
| Apply HSTS policy to subdomains | ON |
| Preload | ON |
| No-Sniff Header | ON |

This resolves all "Domains without HSTS" alerts. The `_headers` file will continue to set the header in application responses; the dashboard setting is additionally required for the security scanner.

### 3.4 — R2 Custom Domain (cdn.)

`R2 → madagascar-images → Settings → Custom Domains`

Check whether `cdn.madagascarhotelags.com` is listed as Active.

- **If Active:** a secondary DNS record is interfering. Go to `DNS → Records` and find any A/CNAME for `cdn` with a gray cloud icon. Switch to orange or delete it.
- **If not listed:** click Connect Domain → enter `cdn.madagascarhotelags.com` → confirm. Cloudflare provisions the certificate. Delete any existing manual DNS record for `cdn`.

### 3.5 — Orphaned Subdomains

`DNS → Records`

| Subdomain | Action |
|-----------|--------|
| `pet.madagascarhotelags.com` | Change DNS record cloud from gray to orange (proxied) |
| `charlar.madagascarhotelags.com` | Delete record (until cf-chatbot is deployed to this route) |
| `chat.madagascarhotelags.com` | Delete record (until cf-chatbot is deployed to this route) |
| `secure.madagascarhotelags.com` | Delete record |

### 3.6 — Bot Fight Mode

`Security → Bots → Bot Fight Mode → Toggle ON`

Free feature requiring no WAF subscription. Challenges automated bot traffic at the edge.

### 3.7 — AI Bots (Decision Required)

`Security → Bots → AI Bots`

The `robots.txt` file explicitly **allows** AI crawlers (GPTBot, ClaudeBot, PerplexityBot, Amazonbot, etc.) to support GEO (Generative Engine Optimization) and AEO (Answer Engine Optimization) — ensuring the site appears in AI-generated answers and search overviews. Enabling "Block AI bots" in the Cloudflare dashboard would override this at the network layer, defeating the SEO strategy.

**Recommendation:** Skip this toggle. Dismiss the alerts in Security Insights. Keep the current `robots.txt` AI crawler policy.

### 3.8 — DMARC DNS Record

`DNS → Records → Add record`

| Field | Value |
|-------|-------|
| Type | TXT |
| Name | `_dmarc` |
| Content | `v=DMARC1; p=quarantine; rua=mailto:admin@madagascarhotelags.com; sp=quarantine; adkim=r; aspf=r` |
| TTL | Auto |

Additionally verify: SPF record exists (`v=spf1 include:[email-provider] ~all`), DKIM CNAME records exist for Resend. All three (SPF + DKIM + DMARC) must be valid and aligned for DMARC to pass. Use `mxtoolbox.com/dmarc` to validate after adding.

### 3.9 — Security Center: Security.txt Registration

`Security → Security Center → Recommendations → Security.txt → Configure`

Fill in: contact email, expiry date, policy URL, preferred languages. This registers the file with Cloudflare's scanner independently of the `/.well-known/security.txt` file that is already served by the application.

---

## Part 4 — Code Changes Applied

The following changes were made to cf-astro files as part of this audit.

### 4.1 `public/_headers`

**`X-Frame-Options: SAMEORIGIN` added**
Lighthouse's "Mitigate clickjacking" audit checks for this header independently of the CSP `frame-ancestors` directive. Both are now present.

**`X-XSS-Protection` removed**
Deprecated. Ignored by all modern browsers. Its presence was being flagged by security scanners as an indicator of legacy security practices.

**`frame-ancestors` narrowed from `'self' https://*.posthog.com` to `'self'`**
The wildcard PostHog framing permission was overly broad. No legitimate use case requires PostHog to embed this site in an iframe.

**`upgrade-insecure-requests` added to CSP**
This directive causes the browser to rewrite `http://` subresource URLs to `https://` automatically. It resolves the Lighthouse "Does not use HTTPS — 1 insecure request found" audit by handling any residual HTTP references (most likely originating from Google Maps loading a legacy tile endpoint) at the browser level before the request is sent.

**`Cross-Origin-Resource-Policy` changed from `same-site` to `cross-origin`**
`same-site` was blocking image requests routed through the Cloudflare Image Transformations pipeline (`/cdn-cgi/image/...`), which operates as a cross-origin fetch from the CDN subdomain back through the apex domain.

**`browsing-topics=()` added to Permissions-Policy**
Blocks the Privacy Sandbox Topics API, which should not be available on a site that does not use interest-based advertising.

### 4.2 `src/pages/robots.txt.ts`

**`Host:` directive removed**
The `Host:` directive is a Yandex robots.txt extension, not part of Google's specification. Lighthouse 13 uses Google's strict robots.txt parser. Any unrecognized directive is flagged as a parse error. This was the direct and sole cause of the SEO audit failure "robots.txt is not valid — 1 error found." Removing this directive is expected to raise the SEO score from 92 to 100.

**`Crawl-delay:` directive removed**
Also not supported by Google. The same parser flags it. Removing it from the SEO tool and polite-crawler blocks eliminates the second potential parse error source.

### 4.3 `public/.well-known/security.txt`

**`Policy:` field added**
RFC 9116 defines `Policy:` as a pointer to the security/disclosure policy. Cloudflare's security.txt validator and several compliance checkers treat it as required. Added pointing to the existing privacy policy page.

---

## Part 5 — Lighthouse Score Analysis

### 5.1 Performance: 73

**Scores at audit time:**

| Core Web Vital | Value | Lighthouse Rating |
|----------------|-------|------------------|
| First Contentful Paint | 2.9s | Needs Improvement |
| Largest Contentful Paint | 5.3s | Poor |
| Total Blocking Time | 0ms | Pass |
| Cumulative Layout Shift | 0 | Pass |
| Speed Index | 4.8s | Needs Improvement |

**TBT of 0ms and CLS of 0 are exceptional.** The score is dragged down entirely by FCP and LCP.

**Root cause of LCP 5.3s — the hero image preload gap**

The hero image is the LCP element on every page. `Hero.astro` resolves the image URL at SSR time from D1/KV. `BaseLayout.astro` accepts a `preloadImage` prop and injects a `<link rel="preload" as="image">` in `<head>`. If the resolved hero image URL is not passed as `preloadImage`, the browser encounters the `<img>` tag in the `<body>`, only then begins the image fetch, and LCP is delayed by the entire time taken to parse the intervening HTML and CSS.

The fix involves passing the resolved `heroImageSrc` from `Hero.astro` up to the page component and then into `BaseLayout` as `preloadImage`. This must match the exact URL that the `<img>` will use, including any Cloudflare Image Transformation query.

**Root cause of LCP 5.3s — static fallback images are unoptimized**

When the CMS has no hero image configured, the fallback is `/images/boarding.jpg`. With `passthroughImageService()` in `astro.config.ts`, Astro performs no image optimization. The file is served as a raw JPEG with no WebP/AVIF conversion, no responsive sizes, and potentially no explicit `width`/`height` attributes. Lighthouse flagged "Improve image delivery — Est savings of 176 KiB."

Two options:
1. Create WebP versions of all static `/public/images/` files and serve them via `<picture>` elements with `<source type="image/webp">` and JPEG fallback.
2. Move static fallback images to R2, serve them through `cdn.madagascarhotelags.com`, and let Cloudflare Image Transformations handle WebP/AVIF conversion via the existing `transformImageUrl` pipeline.

**Google Fonts loading**

The current implementation uses the `media="print"` trick:
```
<link rel="stylesheet" href="https://fonts.googleapis.com/..." media="print" onload="this.media='all'">
```
This prevents render-blocking but still requires two external round-trips: one to `fonts.googleapis.com` for the CSS, and one to `fonts.gstatic.com` for the actual font files. Both domains are preconnected in `<head>`, which helps, but the font files themselves are not preloaded.

For maximum FCP improvement, self-hosting fonts via `fontsource` npm packages eliminates the external dependency entirely and allows the font files to be edge-cached alongside other Cloudflare assets.

**"Reduce unused JavaScript — Est savings of 21 KiB"**

The Sentry and PostHog bundles are included in the main JS payload. Although both are deferred via `requestIdleCallback`, they are still part of the initial parse graph. Using dynamic `import()` with `client:idle` or `client:visible` conditions in Preact islands, or moving them to separate script tags with `type="module"` and `async`, would remove them from the initial parse cost.

**"Forced reflow"**

JavaScript is reading layout properties (like `scrollY`, `offsetHeight`) that force the browser to recalculate styles before the read. The scroll-reveal system in `src/scripts/scroll-reveal.ts` is the most likely source. Using `IntersectionObserver` instead of scroll event listeners with layout reads avoids forced reflows entirely.

### 5.2 Best Practices: 77

After the code changes applied in this audit (X-Frame-Options, upgrade-insecure-requests, narrowed frame-ancestors), the remaining Best Practices issues are:

**"Ensure CSP is effective against XSS attacks"** — requires eliminating `'unsafe-inline'` and `'unsafe-eval'` from `script-src`. Both are currently required:
- `'unsafe-inline'` — for `<script is:inline>` tags in `BaseLayout.astro` (scroll preservation, vite:preloadError handler, WebMCP registration). These cannot be extracted without architectural changes.
- `'unsafe-eval'` — required by Preact's runtime in some code paths and potentially by polyfills.

The correct fix is a nonce-based CSP where a unique cryptographic nonce is generated per HTTP request, injected into each `<script>` tag's `nonce` attribute, and included in the `script-src` directive. This requires converting affected pages from static to SSR (`output: 'server'` or hybrid rendering with `export const prerender = false`) so a nonce can be generated per request. This is a significant architectural change that should be planned as a dedicated effort.

**"Ensure proper origin isolation with COOP"** — Current value `same-origin-allow-popups` is correct and intentional. `same-origin` would break the WhatsApp `target="_blank"` links and any OAuth popup flows. No change needed.

**"Does not use HTTPS — 1 insecure request"** — Resolved by `upgrade-insecure-requests` CSP directive added in this audit. Expected to clear on the next Lighthouse run.

**"Use a strong HSTS policy"** — Resolved by Step 3.3 above (zone-level HSTS dashboard setting).

**"Mitigate clickjacking with XFO or CSP"** — Resolved by adding `X-Frame-Options: SAMEORIGIN` to `_headers` in this audit.

### 5.3 SEO: 92 → 100 (after robots.txt fix)

The only automated failure was "robots.txt is not valid — 1 error found" caused by the `Host:` directive. With that directive removed, the SEO score should reach 100 on the next audit run.

The remaining SEO finding is "Additional items to manually check (1)" — this is not an automated failure. It refers to structured data validation, which should be verified periodically via Google's Rich Results Test.

### 5.4 Accessibility: 95

Three issues were flagged:

**Contrast ratio**
Automated detection found at least one element where foreground and background colors do not meet WCAG AA contrast requirements (4.5:1 for normal text, 3:1 for large text). The exact element(s) were not identified in the automated report. Run `axe` DevTools or Lighthouse with the "Highlighted elements" view to identify selectors. Common offenders in this codebase: `text-gray-400` on white background (ratio ≈ 3.3:1), and placeholder text in form inputs.

**Heading sequence**
An `<h3>` appears in the DOM before or without a preceding `<h2>` in the same section context. The Contact section uses `<h3>` tags for location card names. Verify the section has an `<h2>` with `id="contact-heading"` that precedes them — it does based on the current markup, but the Lighthouse run may have been against a different page or a section without a parent heading. Run Lighthouse on each page individually to identify the exact location.

**Identical links**
Multiple anchor tags share the same visible text ("WhatsApp", "Book Now", "Reservar") but link to different URLs or serve different contexts. Screen readers present these as ambiguous. Fix by adding descriptive `aria-label` attributes. Examples:
- "Book Now" button in Hero → `aria-label="Ver servicios y reservar"`
- "WhatsApp" in Contact → `aria-label="Contactar por WhatsApp — Hotel de Perros"`
- "WhatsApp" in Hero → `aria-label="Contactar por WhatsApp — consulta general"`

---

## Part 6 — Verification Checklist

Use after completing all dashboard steps.

**Cloudflare dashboard:**
- [ ] SSL/TLS mode: Full (strict)
- [ ] Always Use HTTPS: ON
- [ ] HSTS: enabled, max-age 12mo+, includeSubDomains, preload
- [ ] `cdn.madagascarhotelags.com` in R2 Custom Domains as Active
- [ ] `charlar.` and `chat.` DNS records deleted or Worker deployed
- [ ] `secure.` DNS record deleted
- [ ] `pet.` DNS record orange-clouded (proxied)
- [ ] `_dmarc` TXT record added and valid (verify at mxtoolbox.com/dmarc)
- [ ] Security.txt registered in Security Center
- [ ] Bot Fight Mode: ON
- [ ] **Image Transformations (Resize Images): ON** — Speed → Optimization → Image Optimization → Resize Images

**Post-deploy Lighthouse targets:**
- [ ] SEO score: 100 (robots.txt fix)
- [ ] Best Practices: 85+ (HSTS + XFO + HTTPS fixes)
- [ ] Performance: "Improve image delivery" audit clears after Image Transformations enabled; LCP < 4.5s
- [ ] Accessibility: 97+ after aria-label and contrast fixes

**Security scan:**
- [ ] Trigger manual re-scan from Security → Security Center, or wait 24 hours for automatic re-scan
- [ ] Confirm 0 active alerts (or 2–3 for intentionally dismissed AI bot suggestions)

---

## Part 7 — Open Items Not Addressed in This Audit

The following were identified but not fixed in this session, each requiring dedicated work:

| Item | Effort | Impact |
|------|--------|--------|
| Nonce-based CSP to remove `unsafe-inline` / `unsafe-eval` | High — requires hybrid SSR | Best Practices +8 |
| Self-host fonts (fontsource) | Low | FCP −0.5s |
| Hero image preload: pass resolved `heroImageSrc` as `preloadImage` into `BaseLayout` | Medium | LCP −1.0s+ |
| Replace scroll-reveal layout reads with IntersectionObserver | Medium | Eliminates forced reflow |
| Aria-label on duplicate CTA links | Low | Accessibility +2 |

> Note: "WebP versions of static /public/images/ fallbacks" was previously listed here but is now resolved via the `transformImageUrl` extension to handle root-relative paths (see Part 9).

---

## Part 8 — Changelog

| Date | Change | File |
|------|--------|------|
| 2026-04-22 | Removed `Host:` directive | `src/pages/robots.txt.ts` |
| 2026-04-22 | Removed `Crawl-delay:` directive | `src/pages/robots.txt.ts` |
| 2026-04-22 | Added `X-Frame-Options: SAMEORIGIN` | `public/_headers` |
| 2026-04-22 | Removed `X-XSS-Protection` | `public/_headers` |
| 2026-04-22 | Narrowed `frame-ancestors` (removed PostHog wildcard) | `public/_headers` |
| 2026-04-22 | Added `upgrade-insecure-requests` to CSP | `public/_headers` |
| 2026-04-22 | Changed CORP from `same-site` to `cross-origin` | `public/_headers` |
| 2026-04-22 | Added `browsing-topics=()` to Permissions-Policy | `public/_headers` |
| 2026-04-22 | Added `Policy:` field | `public/.well-known/security.txt` |
| 2026-04-22 | Extended `transformImageUrl` to handle root-relative `/images/` paths | `src/lib/images.ts` |

---

## Part 9 — Cloudflare Image Transformations: Full Reference

### 9.1 Product Clarification — Two Different Products

Cloudflare has two image-related products that are frequently confused. This project uses only the first:

| | **Image Transformations** (what we use) | **Cloudflare Images** (what we do NOT use) |
|---|---|---|
| **Purpose** | Transform images in-place via URL parameters | Paid image storage + delivery CDN |
| **URL scheme** | `/cdn-cgi/image/{options}/{source-url}` | `imagedelivery.net/{account}/{id}/{variant}` |
| **Storage required** | No — transforms from R2, Worker assets, or any HTTPS origin | Yes — images must be uploaded to Cloudflare |
| **Free tier** | 5,000 unique transformations/month | Limited free tier, then $5/month per 100K images |
| **Delivery cost** | $0 on free tier | $1 per 100,000 images delivered |
| **Overage behaviour** | Hard cap — returns error 9422, no charge | Billable |

The project must never migrate to Cloudflare Images (the storage product) as it violates the $0 infrastructure rule. Image Transformations stays free indefinitely within the 5,000 unique monthly cap.

### 9.2 Free Tier — Exact Limits and Overage Behaviour

- **5,000 unique transformations per month** — free, no credit card required
- **"Unique" definition:** one combination of (source URL + options string). The same image at the same options = 1 transformation regardless of how many times it is requested. A transformation is cached at the edge once computed; all subsequent requests are served from cache and do not count again.
- **Overage behaviour:** When the 5,000 cap is reached, new transformation requests return HTTP error 9422. Existing cached transformations continue serving normally. There is no automatic billing, no payment prompt, and no service interruption for already-cached images. You must explicitly purchase a paid plan to unlock additional transformations.
- **Cap reset:** The 5,000 counter resets on the first day of each calendar month.

### 9.3 Usage Estimate for This Project

| Preset | Width | Quality | Format | Applies to |
|--------|-------|---------|--------|-----------|
| `hero` | 1600px | 85 | auto (WebP/AVIF) | Hero section background |
| `gallery` | 800px | 80 | auto (WebP/AVIF) | Gallery carousel cards |
| `lightbox` | 1400px | 85 | auto (WebP/AVIF) | Gallery lightbox full-view |
| `thumbnail` | 400px | 75 | auto (WebP/AVIF) | Admin preview (cf-admin) |
| `og` | 1200×630px | 80 | auto (WebP/AVIF) | Open Graph social images |

**Current image inventory:**
- 9 static fallback images in `/public/images/` (JPEGs + 1 PNG)
- 6 installation images in `/public/images/installations/` (already WebP — not transformed)
- CMS images in R2: variable, typically 5–15 images

**Worst-case monthly unique transformations:**
```
5 presets × 24 images (static + CMS combined) = 120 unique transformations
```

**Usage vs. cap:** 120 / 5,000 = **2.4% of the free cap.** Even at 10× the current image count, this project stays under 5,000. The cap is not a practical constraint for this site.

### 9.4 How the Transformation Pipeline Works

When a browser requests a `/cdn-cgi/image/` URL:

1. Request arrives at Cloudflare edge
2. Edge checks its transformation cache for this exact (options + source URL) pair
3. **Cache hit:** Transformed image returned immediately — no origin fetch, no transformation compute, no cap usage
4. **Cache miss (first time only):**
   - Edge fetches the original image from the source URL (R2 CDN or Worker asset)
   - Applies transformations: resize, compress, convert format
   - Stores result in edge cache
   - Returns transformed image to browser
   - Increments the monthly unique transformation counter by 1

The `format=auto` parameter inspects the `Accept` header and returns AVIF for browsers that support it, WebP for browsers that support WebP but not AVIF, and the original format as a fallback. Modern Chrome and Safari users get AVIF; Firefox gets WebP; no browser gets an unoptimized JPEG from a transformed URL.

### 9.5 The Gap That Existed Before This Audit

Prior to the code change in this audit, `transformImageUrl` only processed URLs beginning with `https://cdn.madagascarhotelags.com`:

```
CMS image (R2/CDN URL)    → ✅ Transformed → WebP/AVIF served
Static /images/boarding.jpg  → ❌ Passed through → Raw JPEG served
Static /images/gallery*.jpg  → ❌ Passed through → Raw JPEG served
```

Every page load where D1/KV had no CMS images configured served raw unoptimized JPEGs. The Lighthouse "Improve image delivery — Est. savings of 176 KiB" audit flagged exactly this. The static fallback files are:

| File | Size | Notes |
|------|------|-------|
| `boarding.jpg` | 37 KB | Hero fallback — the LCP element |
| `gallery1.jpg` | 37 KB | Identical bytes to boarding.jpg — placeholder |
| `gallery2.jpg` | 66 KB | |
| `gallery3.jpg` | 68 KB | |
| `gallery4.jpg` | 63 KB | |
| `gallery5.jpg` | 36 KB | |
| `gallery6.jpg` | 37 KB | Identical bytes to boarding.jpg — placeholder |
| `daycare.jpg` | 66 KB | |
| `logo.png` | 7 KB | |

Three of these files are byte-for-byte identical duplicates. They are placeholders. This should be addressed by uploading real images via cf-admin once the CMS pipeline is fully operational — at which point the static fallbacks become irrelevant.

### 9.6 The Code Fix Applied

`src/lib/images.ts` — `transformImageUrl` function extended to handle three source types:

**Before (handled only CDN URLs):**
```
cdn.madagascarhotelags.com/... → transformed
/images/boarding.jpg           → passed through unchanged
```

**After (handles CDN URLs and root-relative paths):**
```
cdn.madagascarhotelags.com/...  → transformed via CDN URL
/images/boarding.jpg            → transformed via https://madagascarhotelags.com/images/boarding.jpg
data:... or blob:...            → passed through unchanged (safety guard)
external unknown domains        → passed through unchanged
```

The root-relative path case builds the transformation URL as:
```
https://madagascarhotelags.com/cdn-cgi/image/{options}/https://madagascarhotelags.com{src}
```

Cloudflare fetches `https://madagascarhotelags.com/images/boarding.jpg` (served by the Worker from `/public/images/`), transforms it, caches it, and returns WebP or AVIF. No file changes to the actual images are needed. No build tooling changes. No new dependencies.

### 9.7 Required Dashboard Action

The feature is implemented in code but does nothing unless enabled in the Cloudflare dashboard. Without this toggle, all `/cdn-cgi/image/` URLs silently return the original unmodified file with no error.

**Path:** `Cloudflare Dashboard → madagascarhotelags.com → Speed → Optimization → Image Optimization → Resize Images → Toggle ON`

This is a one-time action. The toggle stays enabled across all deployments. No wrangler.toml change is needed.

### 9.8 Expected Performance Impact

Once the Resize Images toggle is ON and a new deploy is pushed:

| Image | Before | After |
|-------|--------|-------|
| `boarding.jpg` (37 KB JPEG, hero LCP element) | Served as JPEG | AVIF ~10–14 KB / WebP ~18–22 KB |
| `gallery1–6.jpg` (~340 KB total JPEG) | Served as JPEG | ~40–55% smaller as WebP; ~60–70% as AVIF |
| CMS hero from R2 | Already transformed (was working before) | No change |
| CMS gallery from R2 | Already transformed (was working before) | No change |

**Lighthouse impact:**
- "Improve image delivery — Est. savings of 176 KiB" audit: expected to clear or reduce to near-zero
- LCP improvement: image download time for hero on Slow 4G drops from ~300ms (37 KB JPEG) to ~100–140ms (WebP) — contributing roughly 0.2–0.5s LCP improvement
- Combined with the hero preload fix (separate open item), LCP can realistically reach 3.5–4.5s from 5.3s

**Important:** The 176 KiB Lighthouse saving figure was measured for the static fallback path. Once CMS images are properly loaded via cf-admin (the intended production state), the static fallbacks are never served and this saving is irrelevant. The code fix provides a floor guarantee: even when falling back to static images, they are still optimized.

### 9.9 Relationship to cf-admin

cf-admin uploads images to R2 and stores CDN URLs in D1. Those CDN URLs start with `https://cdn.madagascarhotelags.com/` and have always been processed by `transformImageUrl`. The Image Transformations toggle being ON also benefits cf-admin's thumbnail preview (`thumbnail` preset, 400px) for any images managed through the CMS pipeline.

The fix to static image paths in `transformImageUrl` does not affect cf-admin directly — cf-admin has its own image handling and does not use the `public/_headers` fallback images.

{% endraw %}
