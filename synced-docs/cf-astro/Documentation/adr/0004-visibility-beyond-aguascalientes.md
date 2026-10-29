{% raw %}
# ADR-0004: Visibility beyond Aguascalientes without doorway pages

**Status:** Accepted (2026-10-29): the owner chose phase 1 first, then asked for all phases ·
**Program:** [`SEO-OPERATIONS.md`](../SEO-OPERATIONS.md) §10, phases tracked in
[`TODO-BACKLOG.md`](../TODO-BACKLOG.md) §0e

## Context

The owner asked why the site's SEO, GEO and AI-search work stops at Aguascalientes when some
single-location businesses present themselves to all of Mexico, and asked for a multi-phase
program to reach further.

What was checked on 2026-10-29, and how:

- **Where visitors come from** (PostHog web analytics, last 180 days, consented visitors only):
  about 57% from the state of Aguascalientes (247 visitors), then Mexico City 29, Quintana Roo 21,
  Querétaro 14, Jalisco 12, Guanajuato 11, Sinaloa 10, a long tail of other states and abroad.
- **Which pages bring them:** the home page (274), booking (39) and the four service pages
  (5 to 37 each). The blog brought 3 visitors in 180 days, and the seven neighbourhood pages
  (`/es/zona/<slug>/`) brought none.
- **Who ranks for "hotel para perros" elsewhere** (web search, CDMX, Guadalajara, Monterrey,
  Querétaro): local businesses of each city, often with two to fourteen branches of their own.
  The sites that cover the whole country are directories and marketplaces.
- **Google's own rules** (Search Central spam policies; Business Profile guidelines):
  - "Doorway abuse" names, as an example, "having multiple domain names or pages targeted at
    specific regions or cities that funnel users to one page", and "creating substantially
    similar pages that are closer to search results than a clearly defined, browseable
    hierarchy".
  - "Keyword stuffing" names "blocks of text that list cities and regions that a web page is
    trying to rank for".
  - Sites that break these "may rank lower in results or not appear in results at all": the
    pages that bring bookings today would be at risk with the rest.
  - A Business Profile represents a real location; a service area "shouldn't extend farther
    than about 2 hours of driving time".
- **How local results work:** for a search without a place in it ("hotel para perros",
  "pensión canina cerca de mí"), Google and the AI assistants answer with businesses near the
  searcher. A search that names the place ("hotel para perros en Aguascalientes") reaches the
  site from anywhere in Mexico.

## Decision

Reach people beyond Aguascalientes through audiences that can really use the business, and
never through pages that pretend to be somewhere else:

1. **People coming to Aguascalientes** from anywhere (the Feria de San Marcos, family visits,
   business trips, road trips through the city, moving here): guides whose searches name the
   city, so they rank nationwide.
2. **The real surrounding region**, within about two hours, and only the towns the business
   truly serves, each page with facts that differ (distance, pickup, travel time, price).
3. **Nationwide know-how**: Spanish guides that answer questions people ask across Mexico,
   and original data (real, cited numbers), which is what journalists and AI assistants quote.
4. **The franchise**, the one product sold to the whole country.
5. **Presence off the site** across Mexico: directories, press, video, a Wikidata entry.
6. **Measurement** in cf-admin: the share of visitors and searches from outside the state.

Rules every phase keeps:

- No page per city or state the business does not serve, no list of cities in text or
  `areaServed`, no extra Business Profile, no address that is not real.
- A location page exists only when its facts differ from every other page's.
- Every number published is real, with its source and date (RULE #0.5).

## Consequences

- Visitors from far away mostly read and do not book: phases 3 and 5 are measured by reach and
  mentions, phases 1, 2 and 4 by bookings and franchise requests.
- The seven neighbourhood pages already lean toward the doorway pattern (one template, the name
  swapped, no visitors in 180 days). Phase 2 either gives each real local facts or merges them
  into one "areas we serve" page.
- Content needs facts only the client has (which towns are served, franchise figures, photos).
  Those are owner steps in [`SEO-OPERATIONS.md`](../SEO-OPERATIONS.md) §10.

## Sources

- [Google Search Central: spam policies](https://developers.google.com/search/docs/essentials/spam-policies)
  (doorway abuse, keyword stuffing, scaled content abuse)
- [Google Business Profile: guidelines for representing your business](https://support.google.com/business/answer/3038177)
  (one profile per location, service area of about 2 hours)
- [BrightLocal: how the Google local algorithm works](https://www.brightlocal.com/learn/how-does-the-google-local-algorithm-work/)
  (relevance, distance, prominence)
- Feria Nacional de San Marcos 2026, 18 April to 10 May, about 8 million visitors by the state's
  report ([UnoTV](https://www.unotv.com/estados/aguascalientes/feria-segura-y-hoteles-a-su-maxima-capacidad-posicionan-a-aguascalientes-entre-los-destinos-mas-visitados-de-mexico/),
  [El CEO](https://elceo.com/politica/feria-nacional-san-marcos-genera-derrama-superior-a-los-10000-mdp/))

{% endraw %}
