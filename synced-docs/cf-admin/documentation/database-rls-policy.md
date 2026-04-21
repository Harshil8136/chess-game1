{% raw %}
# 🛡️ Supabase RLS Policy Reference — Production Hardening

> **Status:** Production Active
> **Last Audited:** 2026-04-21 (via Supabase Advisor API)
> **Database:** `zlvmrepvypucvbyfbpjj` (shared with cf-astro)

This document is the canonical reference for all Row-Level Security (RLS) policies applied to the Supabase PostgreSQL instance. Every table's access pattern is documented here — who can read, write, and under what conditions.

---

## 1. Design Principles

### 1.1 The Service-Role Pattern

All administrative and backend-originated operations use the `service_role` key, which **bypasses RLS entirely**. This is the only key stored as a Worker secret (`SUPABASE_SERVICE_ROLE_KEY`). The anon key is exposed to the frontend for auth flows only.

**Standard policy pattern (optimized):**
```sql
CREATE POLICY "service_role_full_access" ON table_name
  FOR ALL TO authenticated
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
```

### 1.2 The `(select auth.role())` Optimization

> [!IMPORTANT]
> Always wrap `auth.role()` in a subquery: `(select auth.role())`.
> Without the subquery, PostgreSQL evaluates `auth.role()` **per row** (InitPlan), which is O(n). The subquery forces a single evaluation per query — critical for performance on tables with many rows.

### 1.3 Public-Facing INSERT Pattern

Tables that accept anonymous form submissions from the public website (cf-astro) use a deliberately permissive INSERT policy:
```sql
CREATE POLICY "anon_insert" ON table_name
  FOR INSERT TO anon WITH CHECK (true);
```
This is **intentional by design** — these tables are write-only from the public perspective. All reads are gated behind `service_role`.

---

## 2. Table Policy Matrix

### 2.1 Admin Tables (service_role only)

These tables are exclusively accessed by the cf-admin Worker and should never be readable by anonymous or authenticated users.

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `admin_authorized_users` | service_role | service_role | service_role | service_role | Whitelist registry — the foundation of auth |
| `admin_sessions` | service_role | service_role | service_role | service_role | KV-backed session metadata |
| `email_audit_logs` | service_role | service_role | service_role | service_role | Email dispatch audit trail; CASCADE on booking delete |

### 2.2 Chatbot Tables (service_role only)

These tables store chatbot conversation data and analytics. They were **hardened on 2026-04-21** — previously used `USING(true)` which exposed all data to anyone with the anon key.

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `chat_analytics` | service_role | service_role | — | — | Message telemetry and session metrics |
| `contacts` | service_role | service_role | service_role | service_role | Customer contact records from chatbot |
| `conversations` | service_role | service_role | service_role | service_role | Chat session history |
| `messages` | service_role | service_role | service_role | service_role | Individual message records |

> [!WARNING]
> **Pre-hardening vulnerability (fixed 2026-04-21):** These 4 tables had `USING(true)` policies, meaning the publicly-exposed anon key could read ALL chatbot data including customer contacts and conversation history. This was a critical data exposure risk.

### 2.3 Public-Facing Tables (anon INSERT + service_role read)

These tables accept anonymous submissions from the cf-astro public website. The `INSERT` policies are intentionally permissive.

| Table | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------|--------|--------|--------|-------|
| `bookings` | service_role | anon (public form) | service_role | service_role | Pet boarding reservations |
| `booking_pets` | service_role | anon (public form) | — | — | Pets linked to bookings |
| `booking_quality_metadata` | service_role | anon (public form) | — | — | Booking quality signals |
| `consent_records` | service_role | anon (cookie banner) | — | — | GDPR/LFPDPPP consent receipts |
| `legal_requests` | service_role | anon (legal form) | — | — | ARCO rights requests |
| `privacy_requests` | service_role | anon (privacy form) | — | — | Privacy deletion requests |

> [!NOTE]
> The anon INSERT on these tables is a conscious security trade-off: the public website must submit data without authentication. All SELECT/UPDATE/DELETE operations are restricted to `service_role` to prevent data exfiltration.

### 2.4 Bookings UPDATE — Hardened

> [!CAUTION]
> **Pre-hardening vulnerability (fixed 2026-04-21):** The `bookings` table had an UPDATE policy with `USING(true) / WITH CHECK(true)` for anon users. This meant anyone with the publicly-exposed anon key could modify ANY field on ANY booking — including status, dates, and customer data. This was replaced with a `service_role`-only UPDATE policy.

---

## 3. Function Security

### 3.1 `public.get_usage_metrics()`

This RPC function returns aggregated usage statistics for the admin dashboard.

**Hardened on 2026-04-21:**
```sql
ALTER FUNCTION public.get_usage_metrics()
  SET search_path = public;
```

**Why:** Without an explicit `search_path`, a malicious actor could inject a schema containing a poisoned function with the same name, causing the RPC to execute attacker-controlled code. Pinning `search_path = public` eliminates this vector.

---

## 4. Index Coverage

### 4.1 Foreign Key Indexes

All foreign keys must have covering indexes to prevent sequential scans during JOIN and CASCADE operations.

| Table | Column | Index Name | Added |
|-------|--------|-----------|-------|
| `chat_analytics` | `conversation_id` | `idx_chat_analytics_conversation_id` | 2026-04-21 |
| `email_audit_logs` | `booking_id` | `idx_email_audit_logs_booking_id` | 2026-04-21 |
| `email_audit_logs` | `template_id` | `idx_email_audit_logs_template_id` | 2026-04-21 |

### 4.2 Duplicate Index Cleanup

| Table | Removed Index | Kept Index | Reason |
|-------|--------------|-----------|--------|
| `consent_records` | `idx_consent_records_consent_id` | `consent_records_consent_id_key` (UNIQUE) | The UNIQUE constraint already creates an implicit index; the additional index was redundant |

---

## 5. Audit Trail

### 5.1 Migrations Applied (2026-04-21)

| Migration | Description |
|-----------|-------------|
| `harden_chatbot_tables_rls` | Replaced `USING(true)` with service_role on 4 chatbot tables |
| `harden_bookings_and_email_audit_rls` | Locked bookings UPDATE + added email_audit_logs policy |
| `fix_rls_initplan_performance` | Wrapped `auth.role()` in subquery for 3 admin tables |
| `fix_function_search_path` | Pinned search_path on `get_usage_metrics()` |
| `add_fk_indexes_drop_duplicate` | 3 FK indexes added, 1 duplicate dropped |

### 5.2 Remaining Advisories (Accepted Risk)

| Advisory | Table | Status | Rationale |
|----------|-------|--------|-----------|
| `rls_policy_always_true` | `bookings` (INSERT) | Accepted | Public booking form requires anon INSERT |
| `rls_policy_always_true` | `booking_pets` (INSERT) | Accepted | Linked to bookings form |
| `rls_policy_always_true` | `booking_quality_metadata` (INSERT) | Accepted | Quality signals from form |
| `rls_policy_always_true` | `consent_records` (INSERT) | Accepted | Cookie consent banner |
| `rls_policy_always_true` | `legal_requests` (INSERT) | Accepted | ARCO rights form |
| `rls_policy_always_true` | `privacy_requests` (INSERT) | Accepted | Privacy deletion form |
| `auth_leaked_password_protection` | — | **Pending** | Requires manual toggle in Supabase Dashboard |

### 5.3 Manual Action Required

> [!CAUTION]
> **Enable Leaked Password Protection:**
> Supabase Dashboard → Authentication → Password Security → Enable "Check passwords against HaveIBeenPwned"
> https://supabase.com/dashboard/project/zlvmrepvypucvbyfbpjj/auth/settings

---

## 6. Cross-References

- **Security Hardening** → See [security-hardening.md](./security-hardening.md) for application-layer security
- **Security Protocols** → See [security-protocols.md](./security-protocols.md) for auth and CSRF
- **Chatbot Integration** → See [chatbot-integration.md](./chatbot-integration.md) for chatbot proxy architecture
- **Data Privacy** → See [data-privacy.md](./data-privacy.md) for consent records dashboard

{% endraw %}
