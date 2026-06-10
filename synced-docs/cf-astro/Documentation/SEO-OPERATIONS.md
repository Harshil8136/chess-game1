{% raw %}
# SEO / GEO / AIO Operations Runbook

Owner checklist for everything that **cannot be done from code** — Cloudflare
dashboard, Google/Bing consoles, Google Business Profile, citations and earned
media. Code-side SEO (schema, sitemaps, hreflang, robots.txt, llms.txt,
IndexNow, service landing pages) is already implemented in this repo.

Verified against official guidance, June 2026. Re-check quarterly.

---

## 1. Cloudflare dashboard — CRITICAL, do first

Since **July 2025 Cloudflare blocks AI crawlers by default**. If any of these
are on, the site is invisible to ChatGPT, Claude, Perplexity, etc., no matter
what our robots.txt says.

1. **AI Crawl Control** (dash.cloudflare.com → zone → AI Crawl Control):
   set per-crawler **Allow** for at least: `GPTBot`, `OAI-SearchBot`,
   `ChatGPT-User`, `ClaudeBot`, `Claude-SearchBot`, `Claude-User`,
   `PerplexityBot`, `Google-Extended`, `Applebot`, `Amazonbot`,
   `meta-externalagent`, `CCBot`, `Bingbot`. Do **not** use the blanket
   "Block AI bots" toggle — it blocks search/retrieval bots (citations) along
   with training bots.
2. **Managed robots.txt** (Security → Bots → "Manage AI bots robots.txt"):
   must be **OFF**. When on, Cloudflare prepends `Disallow` groups for AI
   crawlers ahead of our own robots.txt. Verify by fetching
   `https://madagascarhotelags.com/robots.txt` — it must start with our
   "Madagascar Pet Hotel" header comment, with the AI-crawler `Allow` groups.
3. **Bot Fight Mode / Super Bot Fight Mode**: verified AI/search bots must not
   be challenged (they don't execute JS — a challenge = a block). Check
   Security → Events, filter by the user agents above; expect `Allow`, not
   `Managed Challenge`/`Block`.
4. **Do not enroll in Pay-Per-Crawl** — wrong tool for a business that wants
   AI citations.
5. **Crawler Hints** (Caching → Configuration → Crawler Hints): turn **ON**
   (free). Cloudflare auto-pings IndexNow when cached content changes —
   complements our deploy-time ping (`npm run indexnow`).
6. **Redirect rules** (Rules → Redirect Rules) — confirm all three exist and
   are 301: `www.madagascarhotelags.com/*` → apex,
   `pet.madagascarhotelags.com/*` → apex, `cf-astro.pages.dev/*` → apex.

## 2. Google Search Console — search.google.com/search-console

1. Verify the **Domain property** `madagascarhotelags.com` (DNS TXT record —
   add via Cloudflare DNS).
2. Submit sitemap: `https://madagascarhotelags.com/sitemap-index.xml`.
3. After each major content release, use **URL Inspection → Request
   indexing** on the new Spanish money pages
   (`/es/hotel-para-perros-aguascalientes/` etc.).
4. Monitor monthly:
   - **Performance → Search results** (filter queries containing
     "aguascalientes", "pensión", "guardería", "estética").
   - **Search Generative AI performance reports** (new June 2026) —
     impressions/citations inside AI Overviews & AI Mode.
   - **Page indexing** report — every sitemap URL should be "Indexed".
   - **Core Web Vitals** — targets: LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1.

## 3. Bing Webmaster Tools — bing.com/webmasters

Bing matters disproportionately: **ChatGPT search citations overlap ~87% with
Bing's top results**, and Copilot is Bing-native.

1. Sign in and use **"Import from Google Search Console"** (one click).
2. Confirm sitemap was imported; if not, submit `sitemap-index.xml`.
3. IndexNow is already wired: key file `/a7f3b2e1d8c4f5a0b9e2d1c8f3a6b4e7.txt`,
   deploy ping via `npm run cf:deploy`, plus per-publish pings from
   `/api/revalidate`. Check Webmaster Tools → IndexNow for received URLs.
4. Monitor the **AI Performance report** (Feb 2026 feature) — shows how often
   pages are cited in Copilot/Bing AI answers.

## 4. Google Business Profile — the single highest-leverage asset

GBP signals are ~32% of local-pack ranking; the **primary category is the
single most important field**.

1. **Categories**: primary = **"Pet boarding service"** (Servicio de
   alojamiento para mascotas). Secondaries: "Dog day care center",
   "Pet groomer", "Kennel", "Cat boarding service" (if available). 3–5 good
   categories beat 10 marginal ones.
2. **Both locations** (Héroes + Jardines del Sol) as separate listings if both
   receive customers; identical name, +52 449 448 5486, website link to
   `https://madagascarhotelags.com/es/`.
3. **Reviews — recency beats count**: ask in Spanish at pickup with the direct
   review short-link (GBP → "Ask for reviews"); respond to **every** review
   within 72 h, in the reviewer's language. 40 recent reviews outrank 200
   stale ones.
4. **Photos weekly**: real dogs/cats, suites, the cat solarium, play areas,
   staff. Visual freshness is a measurable trust input, and GBP photos feed
   AI Overviews local answers.
5. **Q&A: seed 10–15 real questions yourself** (¿aceptan gatos? ¿piden
   cartilla de vacunación? ¿cuánto cuesta por noche? ¿hacen estética?
   ¿tienen transporte? ¿horarios de entrega?) and answer them — GBP Q&A is
   quoted by AI assistants.
6. **Posts** for seasonal pushes: Semana Santa, verano, diciembre — link to
   `/es/booking/`.
7. **Attributes/services**: list every service with prices where possible
   (hospedaje $286/noche, guardería $200/día) — price transparency improves
   both conversions and AI answer inclusion.

## 5. Other listings (do once, keep NAP identical)

Name **"Hotel para mascotas Madagascar"**, address(es) exactly as on the site,
phone **+52 449 448 5486**, WhatsApp link, site URL with `/es/`:

- **Bing Places** — bing.com/forbusiness, use "Import from Google Business
  Profile" (Oct 2025 portal also feeds Copilot).
- **Apple Business Connect** — businessconnect.apple.com (Siri/Apple Maps).
- **Facebook page** + **Instagram** — keep address/phone/hours synced; Bing
  uses social signals directly.
- **Sección Amarilla** (seccionamarilla.com.mx), **Tuugo.com.mx**, **Yelp MX**.
- **cuidamimascota.com.mx** — pet-boarding marketplace; competitor-adjacent
  visibility and a quality backlink.
- **CANACO Aguascalientes** member directory if membership exists.

## 6. Earned media & local links (strongest LLM-citation signal)

AI engines systematically prefer third-party corroboration over brand-owned
pages. Target 2–3 of these per quarter:

- Partnerships with local **veterinarias** (cross-referral + website mention).
- Sponsor/host **adoption events** with local rescues (asociaciones
  protectoras de Ags) — generates press + backlinks.
- Pitch local media (LJA.mx, El Heraldo de Aguascalientes) for
  "mejores hoteles para perros en Aguascalientes" listicles and seasonal
  stories (qué hacer con tu mascota en vacaciones).
- Pet-friendly tourism roundups (visitors to the Feria de San Marcos).

## 7. Review schema sync (recurring, monthly)

`src/data/business.ts` hardcodes `aggregateRating` (currently 4.9 / 231) and
`SchemaMarkup.astro` embeds 8 named reviews. These **must mirror the live
Google Business Profile**:

1. Open the GBP listing, note current rating + review count.
2. Update `aggregateRating` in `src/data/business.ts` if drifted.
3. If any embedded review was deleted on Google, remove it from
   `SchemaMarkup.astro`.
4. Never add a review here that doesn't exist on GBP — fabricated review
   markup is a structured-data spam violation that can trigger a manual
   action.

## 8. Content cadence (GEO freshness)

- Pages updated within ~3 months are ~3× more likely to be cited by AI
  engines. Touch each money page at least quarterly (prices, FAQs, photos) —
  the visible "Última actualización" date and sitemap `lastmod` update
  automatically at build.
- 1–2 new blog posts/month from the keyword map (see post topics in
  `src/content/blog/`), Spanish first, English translation second.
- Keep prices in `llms-full.txt` and the CMS in sync — AI assistants quote
  these numbers verbatim.
- **Real photos (pending)**: the repo intentionally ships ZERO stock
  photography — service pages are text-first, blog posts have no cover
  images, and the image sitemap was removed. When real facility photos are
  taken: upload via cf-admin (hero + gallery slots), add `heroImage` back to
  entries in `src/data/servicePages.ts`, add `coverImage` to blog
  frontmatter, and restore `src/pages/sitemap-images.xml.ts` (see git
  history) pointing at the real R2 URLs. Real photos are a significant
  local-SEO and GBP trust signal — prioritize this.

## 9. What NOT to do (changed recently — older advice is wrong)

- **No FAQPage / HowTo markup** — Google retired FAQ rich results entirely
  (May 2026); HowTo died 2023. FAQ *content* in HTML stays (AI engines quote
  it); the markup is pointless.
- **No Sitelinks SearchBox markup** — feature removed Nov 2024.
- **No `<priority>`/`<changefreq>` in sitemaps** — Google ignores both.
- **Don't block Google-Extended** "to protect content" — it only controls
  Gemini training, not AI Overviews; blocking it doesn't remove you from AI
  features and allowing it costs nothing.
- **Don't chase "Core Web Vitals 2.0 / LCP 2.0s"** claims circulating on
  low-quality blogs — official thresholds remain LCP 2.5 s / INP 200 ms /
  CLS 0.1.
- **Don't bother expanding llms.txt** beyond cheap maintenance — Google
  explicitly doesn't use it and OpenAI/Anthropic haven't committed; ours
  exists because it's zero-cost, not because it ranks.

{% endraw %}
