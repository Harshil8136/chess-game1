{% raw %}
# ⚠ Cloudflare Binding ID Registry — OPERATIONAL CRITICAL

> **DO NOT MODIFY** these IDs without verifying against the Cloudflare Dashboard first.
> Last verified: **2026-04-20** via Cloudflare API (`d1_database_get`, `kv_namespace_get`).
>
> **Incident context:** On 2026-04-20, ALL binding IDs in both `wrangler.toml` files were
> discovered to point at **non-existent resources** (all returned HTTP 404). This caused the
> entire CMS image pipeline to silently fail — uploads appeared to succeed but never
> propagated to the live site. The fix was a config-only correction of the IDs below.

---

## D1 Database

| Binding | DB Name | Verified UUID | Used By |
|---------|---------|---------------|---------|
| `DB` | `madagascar-db` | `bbca7ba8-87b0-4998-a17d-248bb8d9a0a2` | cf-admin, cf-astro |

**Verification command:**
```bash
curl -sH "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/320d1ebab5143958d2acd481ea465f52/d1/database/bbca7ba8-87b0-4998-a17d-248bb8d9a0a2" | jq .result.name
# Must return: "madagascar-db"
```

---

## KV Namespaces

| Binding | Title | Verified UUID | Used By |
|---------|-------|---------------|---------|
| `SESSION` | `cf-admin-session` | `c81d1970f3d548b8a53a0e6c870b7685` | cf-admin |
| `SESSION` | `cf-astro-session` | `9da1ac5253a54ea1bf236c6fe514dd02` | cf-astro |
| `ISR_CACHE` | `cf-astro-isr-cache` | `e31f413bb1224f559a8de105248da6cc` | cf-astro |
| _(unused)_ | `madagascar-kv` | `b3b538f5046441d193fecde728a45170` | — |

---

## R2 Buckets

R2 buckets are referenced by **name**, not UUID, so they're stable.

| Binding | Bucket Name | Used By |
|---------|-------------|---------|
| `IMAGES` | `madagascar-images` | cf-admin, cf-astro |
| `ARCO_DOCS` | `arco-documents` | cf-astro |

---

## Queues

| Binding | Queue Name | Used By |
|---------|------------|---------|
| `EMAIL_QUEUE` | `madagascar-emails` | cf-admin, cf-astro |

---

## Analytics Engine

| Binding | Dataset | Used By |
|---------|---------|---------|
| `ANALYTICS` | `madagascar_analytics` | cf-admin, cf-astro |

---

## Pre-Flight Checklist (Before Any `wrangler deploy`)

1. **Verify IDs match this registry** — diff `wrangler.toml` binding IDs against the table above.
2. **Never `wrangler d1 create`** a new database with the same name — it creates a new UUID, leaving `wrangler.toml` pointing at the old one.
3. **Never `wrangler kv namespace create`** without updating BOTH projects' `wrangler.toml`.
4. **If IDs look wrong**, verify via Cloudflare Dashboard → Workers → KV/D1 → copy the UUID from there.

{% endraw %}
