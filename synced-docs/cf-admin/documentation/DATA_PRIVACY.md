# Data Privacy Dashboard

## Overview
The Data Privacy Dashboard is an enterprise-grade forensic auditing interface deployed within `cf-admin`. Engineered to monitor, verify, and enforce LFPDPPP, GDPR, and CCPA compliance rules, it provides authorized operators with deep visibility into the `consent_records` ledger.

## Access Control
Following the PLAC (Page Level Access Control) architecture and the 5-tier RBAC hierarchy (DEV > Owner > SuperAdmin > Admin > Staff), this module is highly restricted.
- **Minimum Role**: `SUPER_ADMIN` (Level 2)
- **Hidden Accounts**: DEV and Owner roles can additionally view audit entries from hidden accounts
- **Location**: `/dashboard/privacy`
- **Sidebar Integration**: Displayed automatically when permitted via PLAC access maps derived from `admin_pages` D1 table.
- **API Defense**: PLAC middleware gate rejects unauthorized users before the route handler executes. The API route additionally validates role via `session.role` from the KV-cached session.

## Architectural Components

1. **Route Controller (`index.astro`)**
    - The SSR entry point handles the first layer of auth-gating and structures the "Midnight Slate" layout.
    - Synchronized with the global "Security Cyan" (`#06b6d4`) tint for security-centric interfaces.
    - Uses static boundaries around Preact islands to maintain `<10ms` load times.

2. **Metrics Hydration (`PrivacyMetrics.tsx`)**
    - Client-side Preact island.
    - Fetches live aggregations (`Total Interactions`, `Active Consents`, `Revocations`) securely via the `supabase-js` service role (`createAdminClient`) in `api/privacy/logs`.
    - Features glowing state cards (`StatCard.tsx`) animated to draw executive attention.

3. **Forensic Ledger (`ConsentAuditTable.tsx`)**
    - An infinite-scroll-ready, paginated deep forensic view.
    - Exposes interaction proofs (IP region mappings, browser hashes, micro-timestamps, specific mechanisms).
    - Ensures non-repudiable audit tracks.

## Database Integration
Unlike `cf-astro` (which utilizes Drizzle), the admin dashboard reads the analytics from Supabase using `@supabase/supabase-js`. 
1. **D1 Local Binding**: `admin_pages` includes `/dashboard/privacy` sorted alongside security metrics.
2. **Supabase Binding**: The API route securely executes `select()` queries directly against the `consent_records` table, with robust pagination mapped for massive scaling up to 10k+ records/month.

## Verification Protocol
All features are tested against:
1. Strict PLAC denials for `STAFF` and `ADMIN` roles.
2. Proper edge-compute scaling with D1 queries minimizing CPU cycles.
3. Mobile-layout responsiveness utilizing sidebars and grids optimized in CSS.
