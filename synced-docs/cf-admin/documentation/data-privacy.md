{% raw %}
# Data Privacy Dashboard

## Overview
The Data Privacy Dashboard is an enterprise-grade forensic auditing interface deployed within `cf-admin`. Engineered to monitor, verify, and enforce LFPDPPP, GDPR, and CCPA compliance rules, it provides authorized operators with deep visibility into the consent records ledger.

## Access Control
Following the PLAC (Page Level Access Control) architecture and the 5-tier RBAC hierarchy, this module is highly restricted.
- **Minimum Role**: Super Admin (Level 2)
- **Hidden Accounts**: DEV and Owner roles can additionally view audit entries from hidden accounts
- **Sidebar Integration**: Displayed automatically when permitted via PLAC access maps derived from the admin pages table.
- **API Defense**: PLAC middleware gate rejects unauthorized users before the route handler executes. The API route additionally validates role via the KV-cached session.

## Architectural Components

1. **Route Controller**
    - The SSR entry point handles the first layer of auth-gating and structures the "Midnight Slate" layout.
    - Synchronized with the global "Security Cyan" tint for security-centric interfaces.
    - Uses static boundaries around Preact islands to maintain <10ms load times.

2. **Metrics Hydration**
    - Client-side Preact island.
    - Fetches live aggregations (Total Interactions, Active Consents, Revocations) securely via the Supabase admin client in the API layer.
    - Features glowing state cards animated to draw executive attention.

3. **Forensic Ledger**
    - An infinite-scroll-ready, paginated deep forensic view employing a strict "No Blank Loading Screens" policy via `SkeletonBlock` shimmer placeholders.
    - High-density header layout standardized to a 4-column metadata grid (`Captured`, `Origin`, `Device`, `Analysis`) to prevent UI zig-zagging.
    - Detailed expansion organized into a 3-pillar forensic architecture: **Client Environment** (Blue), **Interaction Telemetry** (Indigo), and **Security & Ledger** (Rose/Emerald).
    - Exposes interaction proofs (IP region mappings, browser hashes, micro-timestamps, specific mechanisms).
    - Ensures non-repudiable audit tracks.

## Database Integration
The admin dashboard reads privacy analytics from Supabase using the official Supabase client library.
1. **D1 Binding**: The admin pages registry includes the privacy module alongside security metrics.
2. **Supabase Binding**: The API route securely queries the consent records, with robust pagination mapped for massive scaling up to 10k+ records/month.
3. **RLS Policy**: The `consent_records` table allows anonymous INSERT (for the cookie consent banner on cf-astro) but restricts all SELECT/UPDATE/DELETE to `service_role` only. See [`database-rls-policy.md`](./database-rls-policy.md) for the full policy matrix.

## Verification Protocol
All features are tested against:
1. Strict PLAC denials for insufficient role levels.
2. Proper edge-compute scaling with optimized database queries minimizing CPU cycles.
3. Mobile-layout responsiveness utilizing sidebars and grids optimized in CSS.

{% endraw %}
