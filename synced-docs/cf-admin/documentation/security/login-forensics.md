---

title: "Login Forensics — Security Audit Subsystem"
status: active
audience: [ai, technical]
last_verified: 2026-09-14
verified_against: [code]
owner: harshil
tags: []
---

# Login Forensics — Security Audit Subsystem

> **TL;DR (non-technical):** How the system records and investigates sign-in activity — successful and failed logins, where they came from, and the alerts that fire on suspicious attempts.

> **Status:** Production Active (v3 — CF Zero Trust)
> **Last Updated:** 2026-05-02 (v4.5: migration 0020 confirmed deployed — 23 live rows; cf_bot_score confirmed N/A on free plan)
> **Access Gate:** DEV/Owner default; grantable via PLAC pseudo-path `/dashboard/logs#security`
> **Migrations:** `0014_create_admin_login_logs_table.sql`, `0015_enhance_admin_login_logs.sql`, `0020_cf_zero_trust_schema.sql` (✅ deployed — 23 live rows confirmed 2026-05-02)
> **Related:** `supabase/migrations/supabase_0001_add_cf_sub_id.sql` (adds `cf_sub_id` to `admin_authorized_users` — executed 2026-04-27)

Dedicated security pipeline that captures, stores, and surfaces all authentication events against the `cf-admin` portal. Operates independently from the general-purpose Ghost Audit Engine (`admin_audit_log`). v3 removes all GoTrue/Supabase Auth coupling and Tier 2 client-side telemetry; replaces with CF Zero Trust edge data.

---

## 1. Architecture Overview

### 1.1 Auth Flow (CF Zero Trust)

```
1. User navigates to secure.madagascarhotelags.com (the Worker's only route)
   │
   ▼  CF Zero Trust Edge (CF_Authorization cookie validation)
   │  If no valid cookie → CF redirects to CF Access login (Google/GitHub/OTP)
   │  If valid cookie → CF injects headers into request
   │
   ▼
2. CF-Access-JWT-Assertion header present in Worker request
   ├─ verifyZeroTrustJwt(jwt, audience, teamName) — RS256 via JWKS
   ├─ Extract: email, cfSubId (sub claim), loginMethod (IdP type), cfRayId
   ├─ Check KV revocation flag: revoked:{userId}
   ├─ Lookup email in admin_authorized_users (Supabase)
   ├─ Not whitelisted or is_active=false → 403
   └─ createSession() + computeAccessMap()

3. Auth pipeline bootstrap stage (src/lib/auth/stages/bootstrap.ts → emitLoginEvent() in src/lib/auth/login-event.ts)
   ├─ Calls logLoginAttempt() → D1 INSERT to admin_login_logs (LOGIN_SUCCESS, or LOGIN_FAILED via refuse(): bot score < 30, JWT/email mismatch, not whitelisted, inactive)
   └─ Calls sendSecurityAlertEmail() via waitUntil() → Brevo alert

4. admin_login_logs (D1 — INSERT/SELECT only, immutable)

5. Failed/blocked events (CF Access denied, unauthorized email)
   ├─ Polled from CF Access Audit Log API every 5 minutes
   └─ Written by scheduled-log-sync.ts worker → admin_login_logs (LOGIN_BLOCKED only — LOGIN_FAILED is written inline by bootstrap.ts)
```

**Key architectural differences from v2:**

- No `LoginForm.tsx` — CF Access shows its own login UI; no client-side telemetry collection
- No `magic-link.ts` proxy — CF Access handles OTP dispatch
- No `callback.astro` — CF Access handles OAuth callback
- Successful logins (and Worker-side refusals) logged inline by the auth pipeline (same Worker request, `waitUntil` for side-effect)
- CF-side blocks polled via CF Audit Log API cron (not captured inline)

### 1.2 Data Trust Hierarchy

All data captured in v3 is **Tier 1 — server-trusted** (cannot be spoofed by client). Tier 2 client-reported fields (hardware, behavioral telemetry) have been removed.

```
┌──────────────────────────────────────────────────────────────────┐
│  TIER 1 — SERVER-TRUSTED (cannot be spoofed by client)          │
│                                                                   │
│  Source: Cloudflare request.cf object + CF headers              │
│  • latitude, longitude, postalCode, timezone                    │
│  • asn, asOrganization, colo, continent                         │
│  • tlsVersion, httpProtocol, clientTcpRtt                       │
│  • CF-Connecting-IP, CF-IPCountry, CF-IPCity, CF-IPRegion       │
│                                                                   │
│  Source: CF-Access-JWT-Assertion claims                          │
│  • cfSubId (sub), loginMethod (IdP type), cfJwtTail             │
│  • cfIdentityProvider (full IdP descriptor)                      │
│                                                                   │
│  Source: CF-RAY header                                           │
│  • cfRayId — links directly to CF dashboard trace               │
│                                                                   │
│  Source: Application logic                                       │
│  • Event type, success/fail, authorized status                  │
│  • CF bot management score (request.cf.botManagementScore)      │
└──────────────────────────────────────────────────────────────────┘
```

> **Tier 2 fields removed in v3:** `cores`, `ram_gb`, `screen_res`, `color_depth`, `platform`, `browser_time`, `is_webdriver`, `was_pasted`, `keystroke_avg_iki_ms`, `keystroke_entropy`, `email_sent_at`, `email_latency_ms`, `client_origin`, `server_env`. These collected client-reported fingerprinting data via the (now-deleted) `LoginForm.tsx`. With CF Zero Trust, there is no login form.

### 1.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Inline success logging in middleware | Same CF Tier 1 data (IP, geo, Ray ID) available at bootstrap time |
| Cron polling for failed logins | CF Access denied events are not surfaced as Worker requests — must be fetched via CF Audit Log API |
| Separate D1 table (`admin_login_logs`) | Different schema from general audit log; immutable by design |
| `waitUntil()` for all side-effects | Zero latency impact on auth/navigation flow |
| IP masked in table view | Privacy-first: masked in list, full IP only in expanded panel |
| Append-mostly | Forensic-grade records; the only writes after INSERT are `dismissProbe()` (`is_authorized_email = -1`), the targeted-delete tool (`/api/audit/delete-targeted`, security tab) and the retention registry — see §8 |

---

## 2. Database Schema

### 2.1 Event Types

| Event Type | Logged By | Description |
|------------|-----------|-------------|
| `LOGIN_SUCCESS` | bootstrap.ts (inline) | CF ZT authentication + whitelist check passed → KV session created |
| `LOGIN_FAILED` | bootstrap.ts (inline, `refuse()`) | Worker-side refusal after a valid CF JWT: bot score < 30, JWT/email mismatch, not whitelisted, account inactive |
| `LOGIN_BLOCKED` | cron: scheduled-log-sync.ts | CF Access explicitly blocked — not in CF Access policy |

**Removed in v3:** `MAGIC_LINK_REQUESTED`, `MAGIC_LINK_SENT` (no OTP dispatch in Worker).

### 2.2 Column Inventory (v3 schema)

> **Migration status: ✅ APPLIED** — verified against the live `madagascar-db`
> on 2026-08-13. `PRAGMA table_info(admin_login_logs)` confirms the CF columns
> (`cf_ray_id`, `cf_access_method`, `cf_identity_provider`, `cf_jwt_tail`,
> `cf_bot_score`) are present and the Tier-2 fingerprinting columns (`cores`,
> `ram_gb`, `is_webdriver`, `keystroke_entropy`, …) are gone. This line read
> "pending" for months after the migration had actually run.

| Column | Type | Category | Source | Trust |
|--------|------|----------|--------|-------|
| `id` | TEXT PK | Identity | D1 auto | — |
| `email` | TEXT NOT NULL | Identity | CF-Access-Authenticated-User-Email | Tier 1 |
| `event_type` | TEXT NOT NULL | Identity | App logic | Server |
| `success` | INTEGER NOT NULL | Outcome | App logic | Server |
| `is_authorized_email` | INTEGER NOT NULL | Outcome | Whitelist check | Server |
| `failure_reason` | TEXT | Outcome | App logic | Server |
| `login_method` | TEXT | Identity | CF JWT IdP type (`google` / `github` / `otp` / `unknown` since 2026-09-05) | Tier 1 |
| `created_at` | TEXT NOT NULL | Timing | D1 default | Server |
| `ip_address` | TEXT | Network | `CF-Connecting-IP` header | Tier 1 |
| `user_agent` | TEXT | Network | `User-Agent` header | Tier 1 |
| `geo_location` | TEXT | Network | Joined CF headers (v1 compat: "City, Region, Country") | Tier 1 |
| `latitude` | TEXT | Network | `request.cf.latitude` | Tier 1 |
| `longitude` | TEXT | Network | `request.cf.longitude` | Tier 1 |
| `postal_code` | TEXT | Network | `request.cf.postalCode` | Tier 1 |
| `timezone` | TEXT | Network | `request.cf.timezone` | Tier 1 |
| `continent` | TEXT | Network | `request.cf.continent` | Tier 1 |
| `asn` | INTEGER | Network | `request.cf.asn` | Tier 1 |
| `asn_org` | TEXT | Network | `request.cf.asOrganization` | Tier 1 |
| `colo` | TEXT | Network | `request.cf.colo` | Tier 1 |
| `tls_version` | TEXT | Network | `request.cf.tlsVersion` | Tier 1 |
| `http_protocol` | TEXT | Network | `request.cf.httpProtocol` | Tier 1 |
| `client_rtt_ms` | INTEGER | Network | `request.cf.clientTcpRtt` | Tier 1 |
| `cf_ray_id` ★ | TEXT | CF ZT | `CF-RAY` header | Tier 1 |
| `cf_access_method` ★ | TEXT | CF ZT | IdP name from JWT claims (`google` / `github` / `otp` / `unknown`) | Tier 1 |
| `cf_identity_provider` ★ | TEXT | CF ZT | Full IdP descriptor from JWT (`idp.id` + `idp.type`) | Tier 1 |
| `cf_jwt_tail` ★ | TEXT | CF ZT | Last 16 chars of JWT assertion (audit reference — not full token) | Tier 1 |
| `cf_bot_score` ★ | INTEGER | CF ZT | `request.cf.botManagementScore` — **⛔ N/A on free Workers plan** — all 23 production rows are `null`; Bot Management requires paid Cloudflare plan | Tier 1 |

★ = Added in v3 (migration `0020_cf_zero_trust_schema.sql`). All nullable.

**Columns removed in v3 (migration drops these):** `cores`, `ram_gb`, `screen_res`, `color_depth`, `platform`, `browser_time`, `is_webdriver`, `was_pasted`, `keystroke_avg_iki_ms`, `keystroke_entropy`, `email_sent_at`, `email_latency_ms`, `client_origin`, `server_env`.

---

## 3. CF Zero Trust Data Extraction

**File:** `src/lib/auth/stages/bootstrap.ts` + `src/lib/auth/login-event.ts` (on KV session bootstrap — `src/middleware.ts` only sequences the header and auth middlewares) and `src/workers/scheduled-log-sync.ts` (cron polling)

### 3.1 Inline Success Logging (bootstrap.ts)

On successful CF ZT login and KV session creation:

```typescript
// Extract CF Zero Trust data
const jwtHeader = request.headers.get('CF-Access-JWT-Assertion') ?? '';
const cfRayId = request.headers.get('CF-RAY') ?? '';
const cfJwtTail = jwtHeader.slice(-16);
const cfData = (request as any).cf as Record<string, unknown> | undefined;
const botScore = cfData?.botManagement?.score ?? null; // cf.botManagement.score — bootstrap refuses when < 30

// Claims from verified JWT
const { sub: cfSubId, email, idp } = claims; // verifyZeroTrustJwt result
const cfAccessMethod = idp?.type ?? 'unknown'; // 'google' | 'github' | 'otp'
const cfIdentityProvider = idp ? `${idp.id}:${idp.type}` : null;

// Standard Tier 1 network fields (unchanged from v2)
const latitude = String(cfData?.latitude ?? '');
const longitude = String(cfData?.longitude ?? '');
// ... (postalCode, timezone, continent, asn, colo, tlsVersion, httpProtocol, clientTcpRtt)
```

In local dev, `request.cf` is undefined — all network fields will be empty/null. Expected.

### 3.2 Failed Login Cron Polling (scheduled-log-sync.ts)

Polls CF Access Audit Log API every 5 minutes:

```
GET /accounts/{CF_ACCOUNT_ID}/access/logs/access-requests?since={lastSynced}&until={now}&direction=asc&limit=100   (up to 10 pages, 5 s timeout)
Authorization: Bearer {CF_API_TOKEN_READ_LOGS}
```

Maps CF Access log fields to `admin_login_logs` schema and INSERTs `LOGIN_BLOCKED` events, skipping any `cf_ray_id` already present (dedupe). Advances the `cf-audit-last-synced` watermark in D1 `admin_portal_settings` (global scope — not KV) after each successful poll. Fires `sendSecurityAlertEmail()` via Brevo for at most 5 events per batch, with a suppression digest beyond that. *Corrected 2026-09-14 — this paragraph described the 2026-05 version (KV watermark, Resend, unlimited alerts).*

---

## 4. SecurityLogData Interface

**File:** `src/lib/auth/security-logging.ts`

```typescript
export interface SecurityLogData {
  // Core identity
  email: string;
  eventType: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGIN_BLOCKED';
  success: boolean;
  isAuthorizedEmail: boolean;
  failureReason?: string;
  loginMethod: string;         // 'google' | 'github' | 'otp' | 'unknown'

  // Network (Tier 1 — unchanged from v2)
  ipAddress: string;
  userAgent: string;
  geoLocation: string;         // backward-compat joined string "City, Region, Country"
  latitude?: string;
  longitude?: string;
  postalCode?: string;
  timezone?: string;
  continent?: string;
  asn?: number | null;
  asnOrg?: string;
  colo?: string;
  tlsVersion?: string;
  httpProtocol?: string;
  clientRttMs?: number | null;

  // CF Zero Trust (v3 — new)
  cfRayId?: string;            // CF-RAY header — links to CF dashboard trace
  cfAccessMethod?: string;     // IdP name from JWT: 'google' | 'github' | 'otp' | 'unknown'
  cfIdentityProvider?: string; // Full IdP descriptor from JWT idp claim
  cfJwtTail?: string;          // Last 16 chars of JWT (audit reference)
  cfBotScore?: number | null;  // request.cf.botManagementScore
}
```

**Removed from v2 interface:** `cores`, `ramGb`, `screenRes`, `colorDepth`, `platform`, `browserTime`, `isWebdriver`, `wasPasted`, `keystrokeAvgIkiMs`, `keystrokeEntropy`, `emailSentAt`, `emailLatencyMs`.

---

## 5. API Endpoints

### `GET /api/audit/login-logs`

Fetches paginated, filtered login forensics from D1.

**Access Control:** DEV/Owner by default, or explicit `/dashboard/logs#security` PLAC grant.

| Param | Description |
|-------|-------------|
| `limit` | Max rows (1–200, default 50) |
| `offset` | Pagination offset (default 0) |
| `email` | Filter by email (LIKE match) |
| `eventType` | Filter by event type (`LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGIN_BLOCKED`) |
| `success` | Filter by outcome (`true` / `false`) |
| `method` | Filter by IdP (`login_method = ?`: `google`, `github`, `otp`, `unknown`) |
| `dateFrom` / `dateTo` | ISO date range |

> **2026-09-14:** this note previously said `method` had been replaced by a `cfAccessMethod` param. The handler (`src/pages/api/audit/login-logs.ts`) reads `method` and there is no `cfAccessMethod` param; only the accepted values changed (`magic_link` is gone).

### `GET /api/audit/stats`

Returns login forensic metrics to users with security clearance:

- **Total Login Logs** — cumulative count
- **Failed Logins Today** — count of rows with `success = 0` today (`LoginLogRepository`; equivalent to `LOGIN_FAILED` + `LOGIN_BLOCKED`)

---

## 6. Dashboard UI

**Tab:** "Security" tab (5th of six) in Activity Center at `/dashboard/logs`

### 6.1 Access Control

Login Forensics contains PII (full IPs, UA fingerprints, geo location, CF Ray IDs). Double-layer defense:

- Tab is **conditionally hidden** from UI for unauthorized users
- API **independently enforces** the same role/PLAC check

### 6.2 Table View

| Column | Description |
|--------|-------------|
| Timestamp | UTC attempt time |
| Email | Email used, with ⚠ UNAUTH chip if not in whitelist |
| Event | Color-coded badge (cyan=SUCCESS, rose=FAILED, amber=BLOCKED) |
| Outcome | ✓ OK (emerald) / ✗ FAIL (rose) |
| Method | CF IdP icon (🔵 Google, ⚫ GitHub, 🔗 OTP) |
| IP Address | **Masked** in table view (e.g., `192.168.***.***`) |
| Location | Geo from CF headers |
| Ray ID | CF-RAY (links to CF dashboard trace) |

**Visual indicators:**

- 🔴 Rose left-border — failed login
- 🟡 Amber left-border — blocked / unauthorized email attempt
- ⚠ UNAUTH chip — email not in authorized users list

### 6.3 Expanded Forensic Detail Panel (3 Sections)

**Section 1 — IDENTITY & AUTH (CF Zero Trust)**

```
Email          [email used]
Event Type     LOGIN_SUCCESS / LOGIN_FAILED / LOGIN_BLOCKED
CF Method      Google / GitHub / OTP (with icon)
Outcome        ✓ SUCCESS / ✗ FAILED / ⊘ BLOCKED
CF Ray ID      [cfRayId]  ← clickable, links to CF trace if configured
JWT Reference  [cfJwtTail] (last 16 chars — not the full token)
Identity Prov. [cfIdentityProvider]
Bot Score      [cfBotScore] / N/A
```

**Section 2 — NETWORK ORIGIN** (Tier 1 — unchanged from v2)

```
IP Address     [full unmasked IP]
City           [cf-ipcity]
Region         [cf-ipregion]
Country        [cf-ipcountry]
Coordinates    [latitude], [longitude]
Timezone       [request.cf.timezone]
Postal Code    [request.cf.postalCode]
ISP / ASN      [asOrganization] ([asn])
Data Center    [colo]  e.g. "JFK"
Protocol       [httpProtocol] · [tlsVersion]
RTT            [clientTcpRtt] ms
```

**Section 3 — CF ZERO TRUST CONTEXT** (replaces Behavioral + Hardware + Email Delivery from v2)

```
Auth Source    Cloudflare Zero Trust Access
Login Method   [cfAccessMethod]
IdP Details    [cfIdentityProvider]
CF Ray ID      [cfRayId]
Bot Protection [cfBotScore] or "Not available"
```

**Design rules:**

- Null fields render `—` (em dash), never `undefined` or empty string
- *2026-09-14:* the "zero inline styles" and `.lf-forensic-*` / `.lf-cf-context-*` claims that stood here were not true of the shipped component: `LoginForensicsTab.tsx` uses inline `style` objects throughout (nonce-CSP allows it), and `src/styles/pages/audit.css` has no `lf-` classes — the panel uses `security-row-blocked/-failed/-unauth`, `security-unauth-chip`, `security-ip-mono`, `security-method-chip` and the shared `audit-*` classes

### 6.4 Filters

Email search, event type dropdown (`LOGIN_SUCCESS` / `LOGIN_FAILED` / `LOGIN_BLOCKED`), outcome toggle, CF access method dropdown (`google` / `github` / `otp`), date range picker.

---

## 7. Security Alert Emails

Every login attempt (success and failure) triggers a branded email (light template) to the admin inbox via the Brevo transactional API (`api.brevo.com/v3/smtp/email`, `BREVO_API_KEY`):

- Dispatched via `ctx.waitUntil()` — zero latency impact
- Contains: event type, email, masked IP, geo location, CF Ray ID, CF access method, timestamp, success/failure
- Inline HTML template (no external dependencies)
- Blocked events from cron polling also fire alerts (via `waitUntil` inside `scheduled-log-sync.ts`), capped at 5 per batch

---

## 8. Security Considerations

**All Tier 1:** No client-reported fields remain. Every field is sourced from CF edge infrastructure or application logic — cannot be spoofed at the network level.

**XSS:** All fields rendered via Preact JSX (auto-escaped). No `innerHTML` or `dangerouslySetInnerHTML`.

**SQL injection:** All fields use D1 parameterized binds. No string concatenation.

**Immutability (qualified 2026-09-14):** the login-logs API is INSERT/SELECT only. Three write paths do exist elsewhere and are all audited: `LoginLogRepository.dismissProbe()` flags a row (`is_authorized_email = -1`), `POST /api/audit/delete-targeted` with `tab = 'security'` deletes rows (type-to-confirm, PLAC-gated), and `admin_login_logs` is a retention-registry target (365-day target, no automatic purge — `src/lib/retention-tables.ts`).

**JWT tail is not sensitive:** The last 16 chars of a JWT are from the signature segment — no claims data. Storing it provides an audit correlation reference without exposing the full token.

---

## 9. D1 Migration Reference

### `database/legacy_migrations/0020_cf_zero_trust_schema.sql` (applied)

> *2026-09-14:* every statement in that legacy file is commented out on disk; the columns it describes are carried by `migrations/0000_baseline.sql` (`admin_login_logs`, Tier-2 columns absent). The SQL below is the intent, reproduced for reference.

```sql
-- Drop Tier 2 client-reported columns (removed with GoTrue/LoginForm)
ALTER TABLE admin_login_logs DROP COLUMN cores;
ALTER TABLE admin_login_logs DROP COLUMN ram_gb;
ALTER TABLE admin_login_logs DROP COLUMN screen_res;
ALTER TABLE admin_login_logs DROP COLUMN color_depth;
ALTER TABLE admin_login_logs DROP COLUMN platform;
ALTER TABLE admin_login_logs DROP COLUMN browser_time;
ALTER TABLE admin_login_logs DROP COLUMN is_webdriver;
ALTER TABLE admin_login_logs DROP COLUMN was_pasted;
ALTER TABLE admin_login_logs DROP COLUMN keystroke_avg_iki_ms;
ALTER TABLE admin_login_logs DROP COLUMN keystroke_entropy;
ALTER TABLE admin_login_logs DROP COLUMN email_sent_at;
ALTER TABLE admin_login_logs DROP COLUMN email_latency_ms;
ALTER TABLE admin_login_logs DROP COLUMN client_origin;
ALTER TABLE admin_login_logs DROP COLUMN server_env;

-- Add CF Zero Trust specific columns
ALTER TABLE admin_login_logs ADD COLUMN cf_ray_id TEXT;
ALTER TABLE admin_login_logs ADD COLUMN cf_access_method TEXT;      -- google / github / otp
ALTER TABLE admin_login_logs ADD COLUMN cf_identity_provider TEXT;  -- full IdP descriptor
ALTER TABLE admin_login_logs ADD COLUMN cf_jwt_tail TEXT;           -- last 16 chars of JWT
ALTER TABLE admin_login_logs ADD COLUMN cf_bot_score INTEGER;       -- CF bot management score

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_login_logs_cf_method ON admin_login_logs(cf_access_method);
CREATE INDEX IF NOT EXISTS idx_login_logs_cf_ray ON admin_login_logs(cf_ray_id);
```

**Already applied** — kept here as the schema record. Re-running it is not
required and the file now lives in `database/legacy_migrations/` with the rest
of the applied history.

---

## 10. File Map

| File | Purpose |
|------|---------|
| `database/legacy_migrations/0014_create_admin_login_logs_table.sql` | Initial D1 table schema (v1) |
| `database/legacy_migrations/0015_enhance_admin_login_logs.sql` | 24 new v2 columns via ALTER TABLE |
| `database/legacy_migrations/0020_cf_zero_trust_schema.sql` | v3: drop Tier 2, add CF ZT columns (applied; carried by `migrations/0000_baseline.sql`) |
| `supabase/migrations/supabase_0001_add_cf_sub_id.sql` | Adds `cf_sub_id` to `admin_authorized_users` (executed 2026-04-27) |
| `src/lib/auth/security-logging.ts` | `SecurityLogData` interface + `logLoginAttempt()` + Brevo email |
| `src/lib/auth/cloudflare-access.ts` | JWT verifier (`verifyZeroTrustJwt`) + header extractor (`extractCFHeaders`) |
| `src/lib/auth/stages/bootstrap.ts` + `src/lib/auth/login-event.ts` | Inline `LOGIN_SUCCESS` / `LOGIN_FAILED` logging on CF ZT session bootstrap |
| `src/workers/scheduled-log-sync.ts` | 5-min cron: polls CF Audit Log API, writes LOGIN_BLOCKED, D1 watermark, ray-id dedupe, alert cap (wired in `cf-entry.ts`) |
| `src/pages/api/audit/login-logs.ts` | Query API (PLAC-gated, v3 schema) |
| `src/pages/api/audit/stats.ts` | Stats API (login metrics) |
| `src/pages/dashboard/logs/index.astro` | `canViewSecurity` PLAC gate |
| `src/components/admin/logs/LoginForensicsTab.tsx` | SecurityForensicsTable + 3-section forensic panel (mounted by `ActivityCenter.tsx`) |
| `src/pages/api/users/[id]/session-status.ts` | Session telemetry API (canonical **Admin**+ / stored `super_admin`+ auth; returns IP, UA, geo, Ray ID, lastActiveAt; Ghost Protection at DB boundary) |
| `src/components/admin/users/sessions/SessionForensicsDrawer.tsx` | Premium HUD drawer for live session forensics (device, connection telemetry, countdown, per-session revoke) |
| `src/styles/pages/audit.css` | Shared `audit-*` / `security-*` classes (no `lf-` prefix) |

**Deleted files (v3):**

- `src/pages/api/auth/magic-link.ts` — CF Access handles OTP
- `src/pages/auth/callback.astro` — CF Access handles OAuth callback
- `src/components/auth/LoginForm.tsx` — No login form (CF Access UI)
- `src/components/auth/OneTapLogin.tsx` — Google One Tap used Supabase signInWithIdToken

---

## 11. Cross-References

- **PLAC pseudo-path** `/dashboard/logs#security` → See [PLAC-AND-AUDIT.md](../architecture/plac-and-audit.md) §2.4
- **Ghost Audit Engine** (separate system) → See [PLAC-AND-AUDIT.md](../architecture/plac-and-audit.md)
- **RBAC tiers** → See [USER-MANAGEMENT.md](../features/USER-MANAGEMENT.md)
- **CF Zero Trust session lifecycle** → See [SECURITY.md](./SECURITY.md) §1
- **3-Layer Force-Kick** → See [SECURITY.md](./SECURITY.md) §5
- **Session Forensics Drawer** (live session telemetry) → See [USER-MANAGEMENT.md](../features/USER-MANAGEMENT.md) §11.3, §11.4
- **Migration plan** → the original phase plan file is no longer in the repository (2026-09-14)

## 12. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-14 | Cron cadence and dispatch (`wrangler.toml`, `cf-entry.ts`); the CF Access audit API call, pagination, D1 watermark, ray-id dedupe and alert cap in `scheduled-log-sync.ts`; where `LOGIN_SUCCESS` / `LOGIN_FAILED` are emitted (`bootstrap.ts`, `login-event.ts`); `admin_login_logs` columns in `migrations/0000_baseline.sql` against §2.2; `SecurityLogData` against §4; the login-logs API params; the Activity Center tab order; the shipped CSS classes; Brevo in `security-logging.ts`; PLAC `/dashboard/logs#security`; every file-map path. Twenty-one corrections above. | Live row counts; Supabase migration execution dates; CF Access IdP configuration; whether retention deletes have ever run |
