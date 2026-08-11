{% raw %}
# Database Hardening — Applied via Supabase MCP

> **Status:** Historical reference only. This document is **not** part of the
> Drizzle migration chain (`drizzle/`) and is not touched by
> `npm run db:generate` / `db:check` / `db:migrate*`. It was moved out of
> `drizzle/` because a hand-written `.sql` file there with no matching
> `drizzle/meta/*_snapshot.json` + `_journal.json` entry violates RULE #0.7 in
> `RULES.md` ("a migration file in this repo is NOT evidence that the
> migration was applied") and left the chain in a state `drizzle-kit check`
> could not fully account for.
>
> The hardening below was applied directly to Supabase via the Supabase MCP as
> migrations `cf_astro_hardening_remaining_v2` and
> `fix_orphaned_consent_add_booking_ref_fk` (most of it was already covered by
> earlier migrations dated 2026-04-29/30). It is kept here purely so the
> original intent stays documented.
>
> **Known drift since this was written:** `idx_consent_records_email` (§4
> below) was later dropped — `consent_records.email` only ever holds an
> anonymous placeholder, so the index could never serve a real lookup (see
> `Documentation/CONSENT-ENGINEERING-RECORD-2026-08.md`). `idx_booking_pets_booking_id`
> was deliberately kept despite a similar dead-index lint flag — it covers an
> `ON DELETE CASCADE` foreign key. Treat the SQL below as a point-in-time
> record of intent, not the current live index set.

```sql
-- =============================================================================
-- Migration 0001: Database hardening — integrity, indexes, constraints
-- Applied to: Supabase PostgreSQL via Drizzle
-- =============================================================================
-- NOTE: This file documents the full hardening intent.
-- Many of these were already applied by earlier migrations (2026-04-29/30).
-- The remainder was applied via Supabase MCP as migration
-- "cf_astro_hardening_remaining_v2" and "fix_orphaned_consent_add_booking_ref_fk".
-- Safe to re-run — all statements use IF NOT EXISTS / DROP IF EXISTS guards.
-- =============================================================================

-- ─── 1. booking_ref: NOT NULL constraint ─────────────────────────────────────
ALTER TABLE bookings ALTER COLUMN booking_ref SET NOT NULL;

-- ─── 2. CASCADE deletes on child tables ──────────────────────────────────────
ALTER TABLE booking_pets
  DROP CONSTRAINT IF EXISTS booking_pets_booking_id_bookings_id_fk,
  ADD CONSTRAINT booking_pets_booking_id_bookings_id_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE booking_quality_metadata
  DROP CONSTRAINT IF EXISTS booking_quality_metadata_booking_id_bookings_id_fk,
  ADD CONSTRAINT booking_quality_metadata_booking_id_bookings_id_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE email_audit_logs
  DROP CONSTRAINT IF EXISTS email_audit_logs_booking_id_bookings_id_fk,
  ADD CONSTRAINT email_audit_logs_booking_id_bookings_id_fk
    FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE ON UPDATE NO ACTION;

-- ─── 3. consent_records → bookings FK (SET NULL, not CASCADE) ────────────────
-- Consent records are legal evidence — they must never be cascade-deleted.
-- When a booking is deleted, booking_ref is NULLed but the consent row is kept.
-- Prerequisite: any orphaned booking_refs must be NULLed first:
--   UPDATE consent_records SET booking_ref = NULL
--   WHERE booking_ref IS NOT NULL
--     AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.booking_ref = consent_records.booking_ref);
ALTER TABLE consent_records
  DROP CONSTRAINT IF EXISTS consent_records_booking_ref_bookings_booking_ref_fk,
  ADD CONSTRAINT consent_records_booking_ref_bookings_booking_ref_fk
    FOREIGN KEY (booking_ref) REFERENCES bookings(booking_ref)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── 4. Indexes on FK columns ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_booking_pets_booking_id
  ON booking_pets(booking_id);

CREATE INDEX IF NOT EXISTS idx_booking_quality_metadata_booking_id
  ON booking_quality_metadata(booking_id);

CREATE INDEX IF NOT EXISTS idx_email_audit_logs_booking_id
  ON email_audit_logs(booking_id);

CREATE INDEX IF NOT EXISTS idx_email_audit_logs_consent_id
  ON email_audit_logs(consent_id);

-- ─── 5. Indexes for admin query patterns ─────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bookings_created_at
  ON bookings(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_owner_email
  ON bookings(owner_email);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_status
  ON privacy_requests(status);

CREATE INDEX IF NOT EXISTS idx_privacy_requests_email
  ON privacy_requests(requester_email);

CREATE INDEX IF NOT EXISTS idx_legal_requests_status
  ON legal_requests(status);

CREATE INDEX IF NOT EXISTS idx_consent_records_email
  ON consent_records(email);

CREATE INDEX IF NOT EXISTS idx_consent_records_booking_ref
  ON consent_records(booking_ref);

-- ─── 6. RLS — enable on all PII-bearing tables ───────────────────────────────
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE privacy_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_quality_metadata ENABLE ROW LEVEL SECURITY;

-- Service role gets full access; anon is implicitly denied (no matching policy).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'bookings','booking_pets','consent_records',
    'email_audit_logs','privacy_requests','legal_requests',
    'booking_quality_metadata'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Service role full access" ON %I', t);
    EXECUTE format(
      'CREATE POLICY "Service role full access" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END
$$;

-- ─── 7. Revocation integrity constraint ──────────────────────────────────────
ALTER TABLE consent_records
  DROP CONSTRAINT IF EXISTS chk_consent_revoke_complete,
  ADD CONSTRAINT chk_consent_revoke_complete CHECK (
    (revoked_at IS NULL AND revocation_reason IS NULL)
    OR
    (revoked_at IS NOT NULL AND revocation_reason IS NOT NULL)
  );
```

{% endraw %}
