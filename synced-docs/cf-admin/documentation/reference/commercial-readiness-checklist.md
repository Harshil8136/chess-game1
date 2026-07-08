---

title: "Commercial-Readiness / Pet-Hotel Decoupling Checklist"
status: draft
audience: [owner, technical]
last_verified: 2026-07-08
verified_against: [code]
owner: harshil
related_docs: [../2026-06-16-business-viability-and-compliance-assessment.md, ../2026-07-05-comprehensive-codebase-and-system-review.md]
tags: [reference, commercialization, decoupling, framework]
---

# Commercial-Readiness / Pet-Hotel Decoupling Checklist

> **TL;DR:** `cf-admin` is 90% a generic Cloudflare-Workers admin framework and
> 10% pet-hotel-specific glue. This checklist enumerates the pet-hotel-shaped
> coupling in the current tree and gives an ordered plan for extracting it
> into an optional plugin, so the framework can be re-sold as a $0-infra admin
> starter kit for any Workers-based application.

Track this alongside `2026-06-16-business-viability-and-compliance-assessment.md`
(the strategic doc) — this file is the concrete engineering plan.

## Coupling inventory (2026-07-08 baseline)

### Domain-schema coupling — `bookings`

Pet-hotel-specific tables and join expressions:

| Table | File(s) using it | Row count | Extract plan |
|-------|------------------|-----------|--------------|
| `public.booking_pets` (Supabase) | `src/pages/api/bookings/index.ts:57,131`, `src/components/admin/bookings/{BookingSlideDrawer,BookingDashboard}.tsx`, `src/components/admin/bookings/types.ts:29` | small | Extract to a `plugins/pet-hotel/` folder; provide a `bookings` API that returns a generic `booking` shape and a plugin hook `enrichBookings(rows)` to attach pets. |
| `public.booking_quality_metadata` (Supabase) | `src/pages/api/bookings/[id].ts:34` | small | Same plugin. Reads-only join; safe to gate behind a feature flag. |
| Hardcoded copy "Madagascar Pet Hotel" | `BookingSlideDrawer.tsx:72` (WhatsApp template) | 1 line | Move to a plugin-provided message template. Base `BookingSlideDrawer` should render a plugin-owned action block, not know the domain. |

### Nav / seed coupling — `admin_pages`

The D1 `admin_pages` seed currently ships pet-hotel-oriented labels (Bookings,
Inquiries etc.) at the framework level. For a generic starter kit:

- Split `migrations/0000_baseline.sql` seed into (a) framework core rows
  (`/dashboard`, `/dashboard/users`, `/dashboard/sessions`, `/dashboard/settings`,
  `/dashboard/logs`, `/dashboard/debug/*`, `/dashboard/access-denied`) and
  (b) optional-plugin rows (`/dashboard/bookings`, `/dashboard/inquiries`,
  `/dashboard/emails`, `/dashboard/chatbot`, `/dashboard/content`).
- Ship a `scripts/setup-plugins.ts` command that inserts only the plugin rows
  the operator picked.

### Domain-language coupling — chatbot + inquiries

- `src/pages/api/chatbot/[...path].ts` proxies to a hardcoded `CHATBOT_SERVICE`
  binding. Generic version: bind a configurable "assistant" service; keep the
  proxy schema, rename the binding.
- `src/pages/api/inquiries/*` assumes contact-form intake. Generalize as
  "contact submissions"; keep the current UI for pet-hotel via the plugin.

### Infra coupling — `wrangler.toml` bindings

Current `wrangler.toml` names bindings after Madagascar Hotel resources
(`madagascar-db`, `madagascar-sessions`, etc.). For redistribution:

- Provide a `wrangler.template.toml` with placeholder names (`{{APP_NAME}}-db`,
  `{{APP_NAME}}-sessions`).
- Ship `scripts/init-cloudflare.sh` that (a) creates the D1/KV/R2 bindings via
  `wrangler`, (b) writes the resolved IDs into `wrangler.toml`, (c) applies
  the framework migrations, (d) optionally seeds plugin rows.

## Extraction plan (ordered)

1. **Phase A — Isolate pet-hotel Supabase tables** (small, no runtime change).
   - Move `booking_pets` + `booking_quality_metadata` to a new
     `supabase/migrations/plugins/pet-hotel/` sub-tree.
   - No production drop yet; just re-organize source of truth.

2. **Phase B — Plugin-ify the bookings UI**.
   - New `src/plugins/pet-hotel/BookingPetSection.tsx` (moved from
     `src/components/admin/bookings/`).
   - `BookingSlideDrawer` gains a `<PluginActionBlock>` slot; pet-hotel plugin
     supplies its WhatsApp template.
   - Feature flag: `PLUGIN_PET_HOTEL=1` env; default off.

3. **Phase C — Fork the admin_pages seed**.
   - Split baseline seed as described above.
   - Update `documentation/README.md` and the setup docs to reflect the
     two-tier install (core + plugins).

4. **Phase D — Ship a starter-kit repo**.
   - New repo `cf-admin-starter` (empty). Copies the framework core, no
     plugins, README-driven setup.
   - Document the "add pet-hotel plugin" recipe.

5. **Phase E — Public listing / CSA STAR / marketing**.
   - Once the framework has (a) generic name, (b) plugin architecture,
     (c) $0-infra setup script, submit to CSA STAR Level 1 registry (CAIQ
     already prepared — see `documentation/security/compliance/CSA-CAIQ-v4.md`).

## Free-tier bootstrap recipe (for a fresh clone)

Once phase D lands:

```bash
# 1. Fork the starter-kit repo
gh repo clone myorg/cf-admin-starter my-admin
cd my-admin

# 2. Provision Cloudflare bindings (D1, KV, R2, Queues)
./scripts/init-cloudflare.sh --app my-admin

# 3. Apply framework migrations
npx wrangler d1 migrations apply my-admin-db --remote

# 4. Wire up Supabase (advisors + baseline schema)
supabase link --project-ref <ref>
supabase db push

# 5. (Optional) Add a plugin
./scripts/add-plugin.sh pet-hotel

# 6. Deploy
npx wrangler deploy
```

Target: from `gh repo clone` → deployed admin dashboard in under 15 minutes
with zero paid services.

## Non-goals (this checklist does NOT cover)

- Rebranding the design system (Midnight Slate stays as the default; a plugin
  can override).
- Multi-tenant (one Worker deploy = one tenant; SaaS-style multi-tenancy is a
  separate epic).
- Native mobile app.
- Public marketplace for plugins.

## Related docs

- Business framing → `2026-06-16-business-viability-and-compliance-assessment.md`
- Post-fix compliance summary → `2026-07-05-comprehensive-codebase-and-system-review.md`
- Security posture → `security/SECURITY.md`
- Compliance attestations → `security/compliance/`
