{% raw %}
# Bookings RBAC & Operational Management Design
Date: 2026-04-19

## 1. Executive Summary
The CF-Admin Bookings Dashboard currently acts as a sophisticated read-only terminal. This design introduces operational management tools (Check-in states, Deletions, Email dispatch triggers, and Internal Notes). To preserve the integrity of the crucial `cf-astro` Supabase bookings database, all operational admin metadata will be completely decoupled and stored exclusively inside a Cloudflare D1 shadow state architecture.

## 2. Core Architecture: D1 Shadow State
Instead of running risky migrations on the Supabase `bookings` table, CF-Admin will utilize Cloudflare D1 to maintain a supplementary "operational layer". 

When an API request queries bookings from Supabase, the backend will simultaneously check the D1 `admin_booking_state` table. The data is merged mid-flight. 
- Supabase dictates: "What did the customer book?"
- D1 dictates: "What is the staff doing with this booking now?"

### Benefits
- 100% decoupling from customer-facing logic.
- Zero risk of locking out or corrupting Supabase RLS policies.
- Adheres tightly to the $0 CPU "Lean Edge" constraints (D1 queries take ~2ms).

## 3. RBAC Access Control Matrix

The operational actions are mapped to the standard 5-Tier RBAC system enforced through the Admin layout and API endpoints.

| Action | Minimum Role | Mechanistic Implementation |
| :--- | :--- | :--- |
| **Delete (Soft)** | Owner (1) | Flags `is_deleted = 1` inside D1. Supabase untouched. Filtered out of standard views. |
| **Delete (Hard)** | DEV (0) | Triggers a permanent destruction query on Supabase. Irreversible. |
| **Resend Email** | Admin (3) | Writes a new payload to the Cloudflare Queue triggering Eta/Resend queue consumer. |
| **Mark In/Out** | Staff (4) | Updates the `operational_status` text field inside D1. |
| **Add Note** | Staff (4) | Appends text updates to the `internal_notes` field inside D1. |

## 4. Deletion Workflows

### DEV Flow (Hard vs Soft)
When a DEV opens the Delete dialog, they receive explicit educational warnings. They have two independent pathways:
1. **Hard Delete:** Permanently wipes the row from Supabase.
2. **Soft Delete:** Flips the D1 `is_deleted` flag.
DEV users will also have a global toggle to "Show Soft-Deleted Records," enabling them to restore visibility to bookings seamlessly.

### Owner Flow (Soft Only)
When an Owner attempts to delete, the cognitive overhead is removed. The "Delete" button executes a Soft Delete in the D1 shadow table. The row vanishes from the UX, eliminating schedule clutter safely.

## 5. System Observability (Ghost Audit)
Every operation inside this specification—whether a Hard Delete, a Soft Delete, or merely a check-in status toggle—will trigger a `ctx.waitUntil()` invocation connecting precisely to the `admin_audit_log` Ghost Audit Engine. Full forensic timeline coverage is guaranteed.

## 6. Implementation Notes
- **D1 Table Provisioning:** Requires executing a fast SQL instantiation `CREATE TABLE IF NOT EXISTS admin_booking_state` containing `booking_id (PK)`, `is_deleted`, `operational_status`, and `internal_notes`.
- **UI Integrations:** Action buttons will be strategically injected directly into the `BookingSlideDrawer` settings clusters using the glassmorphic UX mapping developed previously.

*This specification serves as the foundation for the implementation phase.*

{% endraw %}
