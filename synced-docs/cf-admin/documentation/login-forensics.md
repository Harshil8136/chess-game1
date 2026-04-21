{% raw %}
# 🛡️ Login Forensics — Security Audit Subsystem

> [!NOTE]
> **System Status:** Production Ready
> **Target Environment:** Cloudflare Workers + D1
> **Last Updated:** April 2026

This document covers the **Login Forensics** subsystem — a dedicated security pipeline that captures, stores, and surfaces all authentication attempts against the `cf-admin` portal. It operates independently from the general-purpose Ghost Audit Engine (`admin_audit_log`) and is designed for deep security analysis.

---

## 1. Architecture Overview

### 1.1 Data Flow

1. **Magic Link**: Client submits email → `POST /api/auth/magic-link` server proxy validates, logs `MAGIC_LINK_REQUESTED` to D1, then invokes Supabase OTP
2. **OAuth (Google/GitHub)**: User authenticates externally → `GET /auth/callback` exchanges code → logs `LOGIN_SUCCESS` or `LOGIN_FAILED` to D1
3. **Alert Dispatch**: Every login attempt triggers a branded "Midnight Slate" email alert to the admin inbox via Resend API (non-blocking `waitUntil`)

### 1.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Server-side proxy for magic links | Prevents client-side spoofing; captures CF headers (IP, Geo) before auth |
| Separate D1 table (`admin_login_logs`) | Forensic records have different schema than general audit log; immutable by design |
| `waitUntil()` for all side-effects | Zero latency impact on auth flow |
| IP masking in table view | Privacy-first: masked in list, full IP only in expanded detail panel |
| No DELETE endpoint | Forensic-grade immutable records — INSERT/SELECT only |

---

## 2. Database Table — `admin_login_logs`

> [!CAUTION]
> This table is **INSERT/SELECT only**. No DELETE or UPDATE endpoints are exposed at the framework level.

**Migration file:** `migrations/0014_create_admin_login_logs_table.sql`

### 2.1 Event Types

| Event Type | Description |
|------------|-------------|
| `MAGIC_LINK_REQUESTED` | A magic link was requested for an email |
| `MAGIC_LINK_SENT` | Supabase successfully dispatched the OTP email |
| `LOGIN_SUCCESS` | OAuth or magic link callback completed successfully |
| `LOGIN_FAILED` | Authentication attempt failed (bad code, expired token, unauthorized) |

### 2.2 Captured Data Points

| Field | Description |
|-------|-------------|
| Email | The email used in the authentication attempt |
| Event Type | One of the event types above |
| Success | Whether the attempt was successful or not |
| Authorized Email | Whether the email exists in `admin_authorized_users` |
| Failure Reason | Human-readable reason for failures |
| IP Address | Full IP from `CF-Connecting-IP` header |
| User Agent | Full User-Agent string from request headers |
| Geo Location | Combined "City, Region, Country" from Cloudflare geo headers |
| Login Method | `magic_link`, `google`, or `github` |
| Timestamp | UTC timestamp of the attempt |

---

## 3. API Endpoints

### 3.1 `GET /api/audit/login-logs`

Fetches paginated, filtered login forensics from D1.

**Access Control:** DEV/Owner by default, or explicit `/dashboard/logs#security` PLAC grant.

**Available Filters:**

| Param | Description |
|-------|-------------|
| `limit` | Max rows per page (1–200, default 50) |
| `offset` | Pagination offset (default 0) |
| `email` | Filter by email (LIKE match) |
| `eventType` | Filter by event type (e.g., `LOGIN_SUCCESS`, `LOGIN_FAILED`) |
| `success` | Filter by outcome (`true` or `false`) |
| `method` | Filter by login method (e.g., `magic_link`, `google`, `github`) |
| `dateFrom` / `dateTo` | ISO date range filter |

### 3.2 `POST /api/auth/magic-link`

Server-side proxy for magic link requests. Logs the attempt to D1 and dispatches the OTP if the email is authorized. Returns generic responses to prevent email enumeration.

### 3.3 Stats Integration

`GET /api/audit/stats` now includes login forensic metrics (only returned for users with security clearance):
- **Total Login Logs** — cumulative count of all records
- **Failed Logins Today** — count of failed attempts in the current day

---

## 4. Dashboard UI — Login Forensics Tab

The Login Forensics tab is the 4th tab in the Activity Center at `/dashboard/logs`.

### 4.1 Access Control

> [!IMPORTANT]
> Login Forensics contains PII (full IP addresses, User-Agent fingerprints, geo location). Access is strictly controlled.

- **Default Access:** DEV and Owner roles see the tab automatically
- **Grantable:** Other users can be granted access via PLAC pseudo-path `/dashboard/logs#security`
- **Double-Layer Defense:** The tab is conditionally hidden from the UI AND the API independently enforces the same role/PLAC check
- **Zero Information Leakage:** Users without clearance don't see the tab, the stats, or any forensic data at all

### 4.2 Table Columns

| Column | Description |
|--------|-------------|
| Timestamp | When the attempt occurred (formatted from UTC) |
| Email | The email used, with ⚠ UNAUTH chip if not an authorized user |
| Event | Color-coded event type badge (cyan, blue, emerald, rose) |
| Outcome | ✓ OK (emerald) or ✗ FAIL (rose) |
| Method | Login method with icon (🔗 magic link, 🔵 Google, ⚫ GitHub) |
| IP Address | **Masked** in table view (e.g., `192.168.***.***`) |
| Location | Geo location from Cloudflare headers (📍 City, Region, Country) |

### 4.3 Expanded Detail Panel

Clicking a row reveals full forensic data:
- **Record ID** — unique identifier (monospace)
- **Full IP Address** — unmasked (only visible in expanded view)
- **Location** — full geo string
- **Login Method** — human-readable
- **Authorized Email** — ✅ Yes / ❌ No
- **Failure Reason** — rose-colored, only shown if applicable
- **User Agent** — full UA string rendered in monospace code block

### 4.4 Filters

- **Email search** — text input with LIKE match
- **Event type** — dropdown (All, Magic Link Requested, Magic Link Sent, Login Success, Login Failed)
- **Outcome** — toggle (All, Success, Failed)
- **Method** — dropdown (All, Magic Link, Google OAuth, GitHub OAuth)
- **Date range** — shared date picker (From → To)

### 4.5 Visual Indicators

| Indicator | Trigger | Style |
|-----------|---------|-------|
| 🔴 Rose left-border | Failed login attempt | `security-row-failed` |
| 🟡 Amber left-border | Unauthorized email attempt | `security-row-unauth` |
| ⚠ UNAUTH chip | Email not in authorized users list | Amber badge next to email |
| 🛡️ Login Logs stat | Total forensic records | Stats bar (authorized users only) |
| 🚨 Failed Today stat | Failed attempts today | Stats bar (authorized users only) |

---

## 5. Security Alert Emails

Every login attempt triggers a branded email to the admin inbox via Resend API.

- Uses the "Midnight Slate" design system for visual consistency
- Contains: event type, email, masked IP, geo location, timestamp, success/failure status
- Dispatched via `ctx.waitUntil()` for zero-latency execution
- Email template is inline HTML (no external dependencies)

---

## 6. File Map

| File | Purpose |
|------|---------|
| `migrations/0014_create_admin_login_logs_table.sql` | D1 table schema |
| `src/lib/auth/security-logging.ts` | Ghost Audit logging utility + Resend email dispatch |
| `src/pages/api/auth/magic-link.ts` | Server-side magic link proxy with logging |
| `src/pages/auth/callback.astro` | OAuth/magic link callback with logging |
| `src/pages/api/audit/login-logs.ts` | Login forensics query API (PLAC-gated) |
| `src/pages/api/audit/stats.ts` | Stats API (includes login metrics for authorized users) |
| `src/pages/dashboard/logs/index.astro` | Page with `canViewSecurity` feature flag |
| `src/components/admin/logs/ActivityCenter.tsx` | UI: SecurityForensicsTable + helpers |
| `src/styles/pages/audit.css` | Security-specific CSS classes |

---

## 7. Cross-References

- **PLAC & Ghost Audit Engine** → See [plac-and-audit.md](./plac-and-audit.md) §2.4 for pseudo-path documentation
- **RBAC Tiers** → See [user-management-rbac.md](./user-management-rbac.md) for role hierarchy
- **Security Hardening** → See [security-hardening.md](./security-hardening.md) for broader security posture

{% endraw %}
