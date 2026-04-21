{% raw %}
# Dynamic CMS & ISG/ISR Architecture (cf-admin <> cf-astro)

cf-admin securely mutates data for the public-facing cf-astro site via a precise "$0 ISR Edge-Cache" mechanism.

## 1. The Shared Data Layer
- **Structured Content**: All CMS content (text, prices, reviews) is stored in the D1 `cms_content` table (shared with cf-astro).
- **Media/Images**: Uploaded and managed securely through the shared Cloudflare R2 `IMAGES` Bucket (`madagascar-images`).
- **RBAC**: Any mutation query is strictly gated by the active session role (`Admin` or higher — Owner, SuperAdmin, DEV).

> ⚠️ **Binding IDs are operational-critical.** All D1/KV/R2 binding UUIDs must match the actual Cloudflare resources. See [`cloudflare-bindings-registry.md`](./cloudflare-bindings-registry.md) for the canonical verified IDs.

## 2. KV-Backed ISR Gateway (How it works)
We intentionally bypass native Cloudflare Cache API purging (which requires privileged Account-level Tokens) in favor of a KV-backed manual revalidation Gateway.
1. Admin saves changes in cf-admin UI (Hero, Gallery, Services, or Reviews).
2. cf-admin writes updates to the D1 `cms_content` table or R2.
3. cf-admin calls the **unified `revalidateAstro(env, ['/'])`** helper in `src/lib/cms.ts`.
4. The helper **auto-expands** base paths to include all locale variants (`/` → `['/', '/en', '/es']`).
5. The helper fires `POST {PUBLIC_ASTRO_URL}/api/revalidate` with `Authorization: Bearer {REVALIDATION_SECRET}`.
6. cf-astro receives the webhook, verifies the secret, and deletes the requested paths from its `ISR_CACHE` KV namespace.
7. The next request to cf-astro triggers an SSR rebuild using the fresh D1 data, delivering high performance (sub-10ms cache hits) and true CMS dynamism.

> 🚨 **CRITICAL SYNC RULE**: For this gateway to function, the target pages on `cf-astro` (e.g., `index.astro`) MUST have `export const prerender = false;` explicitly defined. If `cf-astro` is locked to static generation, the webhook will succeed but the site will blindly serve static files without hitting the ISR middleware, making UI updates impossible.

> 🔴 **LOCAL DEV RULE — `PUBLIC_ASTRO_URL` must NEVER be set in `cf-admin/.dev.vars`:**
> cf-admin runs via `dotenv -e .dev.vars -- astro dev` (pure Vite, no Miniflare). The `cloudflare:workers`
> module is unavailable in this mode, so `env.ts` reads exclusively from `process.env` (dotenv-cli).
> If `PUBLIC_ASTRO_URL` is present in `.dev.vars`, it silently overrides the correct production value
> in `wrangler.toml [vars]` and causes revalidation calls to loop back to cf-admin itself, hitting CSRF
> protection and returning 403 Forbidden. The variable is set correctly in `wrangler.toml [vars]` as
> `"https://madagascarhotelags.com"` and `cms.ts` has a hardcoded fallback to the same value.
> **Do not add `PUBLIC_ASTRO_URL` to `.dev.vars`.**

## 3. Unified Revalidation Helper (Single Source of Truth)

All 5 Content Studio API routes call a **single function** in `src/lib/cms.ts`:

```typescript
// Signature:
export async function revalidateAstro(
  env: { PUBLIC_ASTRO_URL?: string; REVALIDATION_SECRET?: string },
  basePaths: string[]
): Promise<boolean>

// Usage (identical in every endpoint):
await revalidateAstro(env, ['/']);
```

**Path Expansion Engine:** `SITE_LOCALES = ['en', 'es']` — the helper automatically generates:
- `'/'` → `['/', '/en', '/es']`
- `'/services'` → `['/services', '/en/services', '/es/services']`

> ⚠️ To add a new locale (e.g., French), update ONLY the `SITE_LOCALES` array in `src/lib/cms.ts`. Zero changes to any API route.

| API Route | CMS Function | Revalidation Call |
|-----------|-------------|-------------------|
| `POST /api/content/blocks` | Update text blocks | `revalidateAstro(env, [basePath])` |
| `POST /api/content/reviews` | Update happy clients JSON | `revalidateAstro(env, ['/'])` |
| `POST /api/content/services` | Update pricing data | `revalidateAstro(env, ['/'])` |
| `POST /api/media/gallery` | Update gallery JSON array | `revalidateAstro(env, ['/'])` |
| `POST /api/media/upload` | Upload image to R2 + D1 | `revalidateAstro(env, ['/'])` |
{% endraw %}
