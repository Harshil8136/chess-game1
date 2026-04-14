# 08 — Components

## Component Architecture

All components are **Astro components** (`.astro` files) — they render to static HTML at build time with zero JavaScript overhead. Interactive behavior (mobile menu, scroll effects) uses inline `<script>` tags with vanilla JS.

### Props Pattern

Every component follows a consistent props interface:

```typescript
interface Props {
  locale: string;
  messages: Record<string, any>;
}
const { locale, messages } = Astro.props;
```

Translations are consumed via the `t(messages, 'Key.path')` helper.

---

## Layout Components

### `BaseLayout.astro` (3.1KB)

**Responsibility**: HTML document shell.

**Renders**:
- `<!DOCTYPE html>` and `<html lang={locale}>`
- `<head>`: charset, viewport, SEO title/description, canonical URL, hreflang alternates
- Open Graph meta tags (type, locale, title, description, URL, site_name, image)
- Twitter Card meta tags
- PWA meta (theme-color, manifest, favicon)
- Google Fonts preconnect + stylesheet (Inter: 400-900)
- Named `<slot name="head">` for structured data injection
- `<body>`: skip link, default `<slot>`, Cloudflare Web Analytics script (prod only)

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `title` | string | required | Page title tag |
| `description` | string | required | Meta description |
| `locale` | string | required | Current locale ('es'&#124;'en') |
| `canonicalUrl` | string | auto-generated | Override canonical URL |
| `ogImage` | string | `/opengraph-image.png` | OG image path |
| `ogType` | `'website'&#124;'article'&#124;'product'` | `'website'` | OG type; `'article'` enables article:published_time meta |
| `noIndex` | boolean | false | Emit `noindex, nofollow` robots meta |
| `keywords` | string | undefined | Meta keywords (comma-separated) |
| `preloadImage` | string | undefined | Injects `<link rel="preload" as="image" fetchpriority="high">` for LCP |
| `articlePublishedTime` | string | undefined | ISO string; only used when `ogType='article'` |
| `articleModifiedTime` | string | undefined | ISO string; only used when `ogType='article'` |

---

### `MarketingLayout.astro` (~700B)

**Responsibility**: Marketing page wrapper (extends BaseLayout).

**Renders**:
- `<BaseLayout>` with SEO props (passes all props through including new SEO props)
- `<Header>` component
- `<main id="main-content">` with default slot
- `<Footer>` component

**Data Loading**: Calls `getTranslations(locale)` to load messages, then passes both `locale` and `messages` to Header and Footer.

**Props** (all forwarded to BaseLayout):
```typescript
interface Props {
  title: string;
  description: string;
  locale: string;
  noIndex?: boolean;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'product';
  preloadImage?: string;
  keywords?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
}
```

**Note**: MarketingLayout has NO inline schema. All structured data is injected via the `slot="head"` pattern using SchemaMarkup, ServicePageSchema, or BlogPostSchema.

---

## Layout/Navigation Components

### `Header.astro` (15KB, 360 lines)

**Responsibility**: Slim, fixed-position navigation bar with scroll-triggered glassmorphism transition.

**Features**:
- Fixed position (`fixed top-0 z-50`), slim `h-14` profile (matches `nextjs-app` Navbar)
- Logo: `w-9 h-9` rounded with ring + brand name (hidden on mobile)
- Desktop nav: 5 anchor links with `data-track-id` analytics attributes
- Language switcher: ES/EN toggle with dynamic border styling
- Phone CTA: Desktop-only call link with phone icon
- Mobile: Hamburger toggle with animated open/close icons, full-screen overlay menu
- `border-b border-transparent` default to prevent CSS transition flash (see Issue #9)

**Scroll Behavior** (vanilla JS `<script>`):

The header transitions between two visual states at `scrollY > 50`:

| Property | Default (Transparent) | Scrolled (White Glass) |
|---|---|---|
| Background | `bg-black/20 backdrop-blur-sm` | `bg-white/95 backdrop-blur-md` |
| Border | `border-transparent` | `border-gray-100` |
| Shadow | none | `shadow-sm` |
| Text | `text-white` | `text-gray-900` / `text-gray-600` |
| Nav links | `text-white/90` | `text-gray-600 hover:text-emerald-600` |
| Mobile toggle | `text-white` | `text-gray-700` |
| Lang switcher border | `border-white/20` | `border-gray-300` |

**Interactive Behavior**:
1. **Scroll listener**: Toggles all color classes at 50px threshold
2. **Mobile menu toggle**: Shows/hides mobile nav, toggles hamburger ↔ X icons, updates `aria-expanded`
3. **Auto-close**: Mobile menu closes when any navigation link is clicked
4. **Style sync**: When mobile menu opens, header adopts "scrolled" colors regardless of scroll position

**Navigation Items**:
```typescript
const navItems = [
  { href: '/{locale}/#about', label: t(messages, 'Nav.about'), trackId: 'nav_about' },
  { href: '/{locale}/#services', label: t(messages, 'Nav.services'), trackId: 'nav_services' },
  { href: '/{locale}/#gallery', label: t(messages, 'Nav.gallery'), trackId: 'nav_gallery' },
  { href: '/{locale}/#faq', label: t(messages, 'Nav.faq'), trackId: 'nav_faq' },
  { href: '/{locale}/#contact', label: t(messages, 'Nav.contact'), trackId: 'nav_contact' },
];
```

---

### `Footer.astro` (5.6KB)

**Responsibility**: Site footer with 4-column grid.

**Layout**: `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4`

**Columns**:
1. **Brand**: Logo + description text
2. **Quick Links**: About, Services, Gallery, Booking
3. **Legal**: Privacy Policy, Terms, ARCO rights
4. **Contact**: Phone (SVG icon), Email (SVG icon), Address (SVG icon)

**Bottom bar**: Copyright with dynamic year + WhatsApp social icon

---

## Section Components

### `Hero.astro` (7.1KB)

**Responsibility**: Full-screen hero section with CTA.

**Visual Structure**:
- Full-screen background image (`/images/boarding.jpg`) with gradient overlay
- Gradient fallback: `from-emerald-900 via-teal-800 to-green-900`
- Left-to-right dark overlay: `from-black/70 via-black/40 to-transparent`
- Floating decorative blurred circles (desktop only, `aria-hidden`)

**Content**:
- Trust badge pill (⭐ with tracking-widest text)
- H1 heading with highlighted green accent word
- Subtitle paragraph
- Two CTA buttons: "Book Stay" (primary green) + "Contact Us" (white, WhatsApp link)
- Trust badges row (desktop): Free Cancellation, Satisfaction Guaranteed, Vet On Call
- Scroll indicator (bouncing down arrow, `aria-hidden`)

**Performance Notes**:
- Hero image: `loading="eager"` + `fetchpriority="high"` (LCP optimization)
- Text shadow for readability over image backgrounds
- Decorative elements hidden on mobile (`hidden md:block`)

---

### `About.astro`

**Responsibility**: "Why Choose Us" section with features and statistics.

---

### `Services.astro` (18KB, 364 lines)

**Responsibility**: Tabbed services showcase with auto-rotating tabs.

**Architecture**: All content is **server-rendered Astro HTML**. Tab switching, auto-rotation, and a progress bar are handled by a vanilla JS `<script>` tag — no Preact island needed. This avoids Astro's limitation of passing JSX as props to islands.

**3 Tabs**:

| Tab | Content | Data Source |
|---|---|---|
| **Services** | Hotel, Daycare, Transport cards with icons, highlights, pricing, and CTA buttons | `Services.items.*` + `Services.highlights.*` |
| **Requirements** | Health, Vaccines, Behavior checklists with icon badges | `Services.requirements.*` |
| **Pricing** | Dogs, Cats, Daycare pricing cards with feature bullets and tiered rates | `Services.pricing.*` |

**Data-driven**: 3 services with highlight sub-items:
```typescript
const services = [
  {
    id: 'hotel',
    gradient: 'from-emerald-500 to-teal-600',
    highlights: ['hotel.climate', 'hotel.music', 'hotel.care'],
    highlightIcons: ['🌡️', '🎵', '🤝'],
  },
  {
    id: 'daycare',
    gradient: 'from-amber-400 to-orange-500',
    highlights: ['daycare.play', 'daycare.social', 'daycare.supervised'],
    highlightIcons: ['🎾', '🐕‍🦺', '👁️'],
  },
  {
    id: 'transport',
    gradient: 'from-blue-500 to-cyan-500',
    highlights: ['transport.door', 'transport.safe', 'transport.flexible'],
    highlightIcons: ['🚪', '🛡️', '⏰'],
  },
];
```

**Interactive Behavior** (vanilla JS):
1. Tab buttons with active state indicator
2. Auto-rotation with 8-second interval
3. Animated progress bar per tab
4. Pauses auto-rotation on hover, resumes on mouseleave
5. `data-animate="slide-up"` scroll reveal on section entrance

**Helper function**: `flatKey()` for accessing dot-notation keys within nested JSON translation objects.

---

### `SpecializedCare.astro`

**Responsibility**: Add-on services (medication, transport, special diets).

---

### `Testimonials.astro`

**Responsibility**: Customer reviews section.

---

### `Gallery.astro`

**Responsibility**: Image gallery section.

---

### `FAQ.astro`

**Responsibility**: Accordion FAQ items.

---

### `Contact.astro` (12KB, 142 lines)

**Responsibility**: Premium contact section with Formspree form, dual Google Maps embeds, and glassmorphism design.

**Visual Structure**:
- `bg-stone-50` base with two decorative radial gradient overlays (emerald + teal)
- Badge pill, H2 heading with emerald highlight, and description text
- Contact info row: WhatsApp button, phone link, and email link
- 12-column responsive grid (`lg:grid-cols-12`)

**Left Column** (5/12): Glassmorphism contact form
- `bg-white/80 backdrop-blur-xl rounded-3xl` card
- Submits to Formspree (`https://formspree.io/f/xbjnrvnq`) via standard HTML POST
- 5 fields: name (text), email (email), phone (tel), service (select), message (textarea)
- Emerald-themed submit button with hover scale effect
- All labels are i18n via `Contact.form.*` translation keys

**Right Column** (7/12): Location cards
- **Dog Hotel**: Google Maps iframe (Teniente Juan de la Barrera 503, Héroes) + address card with orange icon
- **Cat Hotel**: Google Maps iframe (Aurora Boreal 508, Jardines del Sol) + address card with indigo icon
- Both cards: `rounded-3xl`, `shadow-xl`, responsive row layout (`flex-col sm:flex-row`)
- Maps: lazy-loaded, `referrerpolicy="no-referrer-when-downgrade"`

**Animation**: All elements use `data-animate="slide-up"` with staggered `data-delay` (100ms–600ms)

**i18n Keys Used**:
- `Contact.title`, `Contact.titleHighlight`, `Contact.description`
- `Contact.whatsapp`, `Contact.phone`, `Contact.email`
- `Contact.locations.title`, `Contact.locations.addressLabel`
- `Contact.locations.dogHotel.{name,description,address}`
- `Contact.locations.catHotel.{name,description,address}`
- `Contact.form.{name,email,phone,service,message,submit}`
- `Contact.form.services.{hotel,daycare,transport,other}`

---

## Island Components

### `AutoTabs.tsx` (Preact Island, 9.5KB)

**Status**: Available but currently unused. `Services.astro` was refactored to use vanilla JS tab switching to avoid Astro's limitation of passing complex JSX as props to islands.

**Responsibility**: Generic tabbed UI component with auto-rotation and progress indicator.

**Features**:
- Accepts tab labels and content as props
- Auto-rotates between tabs with configurable interval
- Animated progress bar for active tab
- Keyboard accessible (arrow keys, Enter, Space)
- Pauses rotation on hover

**Integration**: Would be mounted via `client:visible` directive if used.

---

### `ConsentBanner.tsx` (Preact Island, ~8KB)

**Status**: Active on all pages.

**Responsibility**: Gathers required legal user consent to deploy tracking pixels and collects physics telemetry showing human interaction to stop malicious bots blocking legal audits.

**Features**:
- Uses ref-based pointer tracking (`useRef`) to avoid taxing device batteries by bypassing `useState` DOM layout shift refreshes. 
- Dispatches choices silently via background `fetch` to `/api/consent`.
- Automatically calls `window.loadAnalytics` instantly triggering Cloudflare Analytics upon pressing the Accept button.
- Generates a local `SHA-256` key hash natively identifying string modifications inside the legal warning notice text the user confirmed to.

---

## Booking Components

### `BookingWizard.tsx` (Preact Island)

**Responsibility**: Multi-step client-side form for submitting booking requests.

**Features**:
- 6-step form wizard (Service, Dates, Pets, Owner, Add-ons, Review)
- Client-side validation using Zod matched to the backend schema
- State management for dynamic arrays (e.g., adding multiple pets)
- Uses `fetch` to submit JSON data to `/api/booking`
- Success and Error states with localization

**Props**:
| Prop | Type | Default | Description |
|---|---|---|---|
| `locale` | string | required | Current locale for routing/submission |
| `messages` | Record<string, any> | required | Translations object |

**Integration**:
Mounted in `src/pages/[lang]/booking.astro` using the `client:load` directive to hydrate immediately.

---

## SEO Components

All schema components inject into the `<head>` via `slot="head"`. They emit `<script type="application/ld+json">` with `set:html={JSON.stringify(schema)}`.

**Placement rule**: Each page uses exactly ONE schema component. SchemaMarkup.astro is homepage-only. Other pages use ServicePageSchema or BlogPostSchema. Never mix multiple schema components on the same page — duplicate @id anchors cause validation errors.

### `SchemaMarkup.astro` (~8KB)

**Responsibility**: Homepage JSON-LD @graph (6 schema types linked via @id anchors).

**Used on**: `/es/` and `/en/` homepages only.

**Schema @graph** (all linked):
| @id | Type | Key Content |
|---|---|---|
| `/#website` | WebSite | SearchAction (sitelinks searchbox) |
| `/#webpage` | WebPage | speakable cssSelector `["h1", ".hero-description"]` |
| `/#hotel` | Hotel + LodgingBusiness | 2 addresses, phone, 3 reviews, amenityFeature[], hasMap |
| `/#organization` | Organization | foundingDate 1994, contactPoint[], knowsAbout[], sameAs social links |
| `/#faq` | FAQPage | 7 Q&A pairs, speakable cssSelector `#faq-section` |
| `/#breadcrumb` | BreadcrumbList | itemListElement[] |

**Props**: `locale`, `pageTitle`, `pageDescription`, `pageUrl`

---

### `ServicePageSchema.astro` (~4KB)

**Responsibility**: Services page structured data.

**Used on**: `/es/services` and `/en/services`.

**Schema output**:
- `WebPage` — name, description, inLanguage, breadcrumb ref
- `ItemList` — 8 services as `ListItem` entries
- Per service: `Service` type with `Offer` + `UnitPriceSpecification` (MXN prices), `areaServed` chain (City → State → Country)

**Props**: `locale`, `pageTitle`, `pageDescription`

---

### `BlogPostSchema.astro` (~3KB)

**Responsibility**: Blog post structured data.

**Used on**: `/es/blog/[slug]` and `/en/blog/[slug]`.

**Schema output**:
- `BlogPosting` — headline, description, author (Organization @id ref `/#organization`), publisher, image (ImageObject), speakable, keywords[], datePublished, dateModified
- `BreadcrumbList` — 3 levels: Home → Blog → Post Title

**Props**: `locale`, `title`, `description`, `publishedDate`, `modifiedDate?`, `author?`, `coverImage?`, `slug`, `tags?`

---

## PWA Components

### `public/manifest.webmanifest`

Enhanced PWA manifest:
- `id: "/?source=pwa"` — deduplication key
- `display: "standalone"` (full-screen on mobile)
- `start_url: "/es/?source=pwa"` (Spanish homepage, source-tagged)
- `theme_color: "#166534"` (brand green)
- Icons: 192px, 512px, and 512px maskable
- Categories: `["lifestyle", "business", "health"]`
- Language: `es`, direction: `ltr`
- **Shortcuts**: Reservar Ahora (`/es/booking`), Servicios y Precios (`/es/services`), WhatsApp deeplink
- **Screenshots**: boarding.jpg (wide 1280×720) + gallery1.jpg (narrow 390×844) for rich install prompt

### `public/sw.js`

Custom service worker with:
- **Install**: Pre-caches `/`, `/es/`, `/manifest.webmanifest`
- **Activate**: Deletes old caches (versioned by `CACHE_NAME`)
- **Fetch strategy**:
  - Network-only for `/api/*` and `/ingest/*` routes
  - Cache-first for everything else (with runtime cache population)
  - Offline fallback: serves cached `/es/` for navigation requests
