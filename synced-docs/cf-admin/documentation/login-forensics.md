{% raw %}
# Login Forensics — Security Audit Subsystem

> **Status:** Production Active (v2 — Deep Telemetry)
> **Last Updated:** April 2026
> **Access Gate:** DEV/Owner default; grantable via PLAC pseudo-path `/dashboard/logs#security`
> **Migrations:** `0014_create_admin_login_logs_table.sql`, `0015_enhance_admin_login_logs.sql`

Dedicated security pipeline that captures, stores, and surfaces all authentication attempts against the `cf-admin` portal. Operates independently from the general-purpose Ghost Audit Engine (`admin_audit_log`). v2 expands from 10 data points to 35, adding Cloudflare edge network telemetry, client-side hardware fingerprinting, and behavioral trust signals.

---

## 1. Architecture Overview

### 1.1 Data Trust Hierarchy

The system distinguishes two classes of forensic data based on trustworthiness:

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
│  Source: Application logic                                       │
│  • Event type, success/fail, authorized status                  │
│  • Supabase OTP dispatch timing, email latency                  │
├──────────────────────────────────────────────────────────────────┤
│  TIER 2 — CLIENT-REPORTED (informational, labeled as such)      │
│                                                                   │
│  Source: navigator / screen APIs (sent with form POST)          │
│  • navigator.webdriver, hardwareConcurrency, deviceMemory       │
│  • navigator.platform or userAgentData.platform                 │
│  • screen.width/height/colorDepth                               │
│  • new Date().toISOString() (browser clock)                     │
│                                                                   │
│  Source: Form event listeners (behavioral)                      │
│  • Paste event on email field (was_pasted)                      │
│  • Keystroke timing in email field (IKI, entropy)               │
└──────────────────────────────────────────────────────────────────┘
```

> **Critical:** Tier 2 fields are NEVER used for access control. All authentication and authorization uses Tier 1 only. Tier 2 is forensic context for human review.

### 1.2 Magic Link Data Flow

```
1. LoginForm.tsx (client:only="preact")
   ├─ Attaches paste + keydown listeners on mount
   ├─ Collects: was_pasted, keyTimestamps[]
   ├─ On submit: computes IKI stats, reads navigator/screen APIs
   └─ POST /api/auth/magic-link { email, redirectTo, clientTelemetry }

2. magic-link.ts (Cloudflare Worker SSR)
   ├─ Extracts: CF headers (IP, city, region, country)
   ├─ Extracts: request.cf object (lat, lng, timezone, ASN, colo, TLS…)
   ├─ Accepts: clientTelemetry from body (optional — OAuth path sends none)
   ├─ Checks: admin_authorized_users whitelist
   ├─ Calls: supabase.auth.signInWithOtp() — measures latency
   └─ Calls: security-logging.ts with all enriched data

3. security-logging.ts
   ├─ logLoginAttempt() → 35-column D1 INSERT
   └─ sendSecurityAlertEmail() → Resend alert to admin inbox (waitUntil)

4. admin_login_logs (D1 — INSERT/SELECT only, immutable)
```

**OAuth flows** (Google/GitHub/Facebook via `callback.astro`) capture all Tier 1 network fields. Tier 2 hardware/behavioral fields are NULL for OAuth — architecturally correct, as OAuth is a redirect, not a form submission.

### 1.3 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Server-side proxy for magic links | Prevents client-side spoofing; captures CF headers before auth |
| Separate D1 table (`admin_login_logs`) | Different schema from general audit log; immutable by design |
| `waitUntil()` for all side-effects | Zero latency impact on auth flow |
| IP masked in table view | Privacy-first: masked in list, full IP only in expanded panel |
| No DELETE/UPDATE endpoint | Forensic-grade immutable records |
| All Tier 2 columns nullable | OAuth records and non-browser clients get NULL — expected and safe |

---

## 2. Database Schema

### 2.1 Event Types

| Event Type | Description |
|------------|-------------|
| `MAGIC_LINK_REQUESTED` | A magic link was requested for an email |
| `MAGIC_LINK_SENT` | Supabase successfully dispatched the OTP email |
| `LOGIN_SUCCESS` | OAuth or magic link callback completed successfully |
| `LOGIN_FAILED` | Authentication attempt failed (bad code, expired token, unauthorized) |

### 2.2 Complete Column Inventory (35 columns)

| Column | Type | Category | Source | Trust |
|--------|------|----------|--------|-------|
| `id` | TEXT PK | Identity | D1 auto | — |
| `email` | TEXT NOT NULL | Identity | Form body | Server |
| `event_type` | TEXT NOT NULL | Identity | App logic | Server |
| `success` | INTEGER NOT NULL | Outcome | App logic | Server |
| `is_authorized_email` | INTEGER NOT NULL | Outcome | RBAC check | Server |
| `failure_reason` | TEXT | Outcome | App logic | Server |
| `login_method` | TEXT | Identity | App logic | Server |
| `created_at` | TEXT NOT NULL | Timing | D1 default | Server |
| `ip_address` | TEXT | Network | `CF-Connecting-IP` header | Tier 1 |
| `user_agent` | TEXT | Network | `User-Agent` header | Tier 1 |
| `geo_location` | TEXT | Network | Joined CF headers (v1 compat) | Tier 1 |
| `latitude` ★ | TEXT | Network | `request.cf.latitude` | Tier 1 |
| `longitude` ★ | TEXT | Network | `request.cf.longitude` | Tier 1 |
| `postal_code` ★ | TEXT | Network | `request.cf.postalCode` | Tier 1 |
| `timezone` ★ | TEXT | Network | `request.cf.timezone` | Tier 1 |
| `continent` ★ | TEXT | Network | `request.cf.continent` | Tier 1 |
| `asn` ★ | INTEGER | Network | `request.cf.asn` | Tier 1 |
| `asn_org` ★ | TEXT | Network | `request.cf.asOrganization` | Tier 1 |
| `colo` ★ | TEXT | Network | `request.cf.colo` | Tier 1 |
| `tls_version` ★ | TEXT | Network | `request.cf.tlsVersion` | Tier 1 |
| `http_protocol` ★ | TEXT | Network | `request.cf.httpProtocol` | Tier 1 |
| `client_rtt_ms` ★ | INTEGER | Network | `request.cf.clientTcpRtt` | Tier 1 |
| `cores` ★ | INTEGER | Hardware | `navigator.hardwareConcurrency` | Tier 2 |
| `ram_gb` ★ | REAL | Hardware | `navigator.deviceMemory` | Tier 2 |
| `screen_res` ★ | TEXT | Hardware | `screen.width x screen.height` | Tier 2 |
| `color_depth` ★ | INTEGER | Hardware | `screen.colorDepth` | Tier 2 |
| `platform` ★ | TEXT | Hardware | `navigator.platform` / `userAgentData` | Tier 2 |
| `browser_time` ★ | TEXT | Hardware | `new Date().toISOString()` | Tier 2 |
| `is_webdriver` ★ | INTEGER | Behavioral | `navigator.webdriver` | Tier 2 |
| `was_pasted` ★ | INTEGER | Behavioral | paste event listener | Tier 2 |
| `keystroke_avg_iki_ms` ★ | REAL | Behavioral | IKI timing in email field | Tier 2 |
| `keystroke_entropy` ★ | REAL | Behavioral | Std deviation of IKI values | Tier 2 |
| `email_sent_at` ★ | TEXT | Delivery | Timestamp after Supabase OTP call | Tier 1 |
| `email_latency_ms` ★ | INTEGER | Delivery | Elapsed ms for Supabase OTP call | Tier 1 |

★ = Added in v2. All nullable — existing records and OAuth logins get NULL for Tier 2 fields.

---

## 3. Client-Side Telemetry

**File:** `src/components/auth/LoginForm.tsx` (`client:only="preact"` — JS always runs)

### 3.1 Behavioral Signals

`paste` and `keydown` listeners attached to the email input on mount. On submit, IKI (Inter-Keystroke Interval) stats are calculated:

```
entropy = sqrt( mean( (IKI_i - mean_IKI)² ) )
```

| Entropy Value | Interpretation |
|---------------|---------------|
| < 30 ms | Suspicious — machine-like regularity |
| 30–100 ms | Borderline |
| 100–300 ms | Normal human typing |
| > 300 ms | Hunt-and-peck or hesitant |
| NULL | Email not typed (pasted, OAuth, programmatic) |

**WebDriver signal:** `navigator.webdriver = true` indicates Puppeteer/Playwright/Selenium. Can be masked by stealth plugins — treat as signal, not a definitive block.

**Paste signal:** Pasted email is not inherently suspicious (password managers), but combined with webdriver detection and zero keystroke entropy, forms a strong bot signal.

### 3.2 Hardware Telemetry

Aggregates `navigator` and `screen` APIs into the POST body as `clientTelemetry`:

| Field | Chrome/Edge | Firefox | Safari |
|-------|-------------|---------|--------|
| `hardwareConcurrency` | ✅ | ✅ | ✅ |
| `deviceMemory` | ✅ | ❌ NULL | ❌ NULL |
| `webdriver` | ✅ | ✅ | ✅ |
| `userAgentData.platform` | ✅ | ❌ fallback | ❌ fallback |
| `platform` (fallback) | ✅ | ✅ | ✅ |
| `screen.*` | ✅ | ✅ | ✅ |

`clientTelemetry` is optional on the server. If absent (OAuth, programmatic calls), all Tier 2 fields are NULL.

---

## 4. Server-Side Enrichment

**File:** `src/pages/api/auth/magic-link.ts`

### 4.1 Cloudflare `request.cf` Extraction

```typescript
const cfData = (context.request as any).cf as Record<string, unknown> | undefined;

const latitude      = String(cfData?.latitude ?? '');
const longitude     = String(cfData?.longitude ?? '');
const postalCode    = String(cfData?.postalCode ?? '');
const timezone      = String(cfData?.timezone ?? '');
const continent     = String(cfData?.continent ?? '');
const asn           = Number(cfData?.asn ?? 0) || null;
const asnOrg        = String(cfData?.asOrganization ?? '');
const colo          = String(cfData?.colo ?? '');
const tlsVersion    = String(cfData?.tlsVersion ?? '');
const httpProtocol  = String(cfData?.httpProtocol ?? '');
const clientTcpRtt  = Number(cfData?.clientTcpRtt ?? 0) || null;
```

In local dev `request.cf` is undefined — all network fields will be empty/null. Expected.

### 4.2 OTP Dispatch Timing

```typescript
const otpStart = Date.now();
const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
const emailLatencyMs = Date.now() - otpStart;
const emailSentAt = error ? null : new Date().toISOString();
```

`email_latency_ms` measures time for Supabase to accept and queue the OTP — not inbox delivery time.

---

## 5. SecurityLogData Interface

**File:** `src/lib/auth/security-logging.ts`

```typescript
export interface SecurityLogData {
  // v1 fields (unchanged)
  email: string;
  eventType: 'MAGIC_LINK_REQUESTED' | 'MAGIC_LINK_SENT' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED';
  success: boolean;
  isAuthorizedEmail: boolean;
  failureReason?: string;
  ipAddress: string;
  userAgent: string;
  geoLocation: string;       // backward-compat joined string "City, Region, Country"
  loginMethod: string;

  // v2: Network / Geo (Tier 1)
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

  // v2: Hardware telemetry (Tier 2 — client-reported)
  cores?: number | null;
  ramGb?: number | null;
  screenRes?: string;
  colorDepth?: number | null;
  platform?: string;
  browserTime?: string;

  // v2: Behavioral trust signals (Tier 2 — client-reported)
  isWebdriver?: boolean;
  wasPasted?: boolean;
  keystrokeAvgIkiMs?: number | null;
  keystrokeEntropy?: number | null;

  // v2: Email delivery timing (Tier 1)
  emailSentAt?: string | null;
  emailLatencyMs?: number | null;
}
```

All v2 fields use `?? null` fallbacks — OAuth callers pass no client telemetry and work without modification.

---

## 6. API Endpoints

### `GET /api/audit/login-logs`

Fetches paginated, filtered login forensics from D1.

**Access Control:** DEV/Owner by default, or explicit `/dashboard/logs#security` PLAC grant.

| Param | Description |
|-------|-------------|
| `limit` | Max rows (1–200, default 50) |
| `offset` | Pagination offset (default 0) |
| `email` | Filter by email (LIKE match) |
| `eventType` | Filter by event type |
| `success` | Filter by outcome (`true` / `false`) |
| `method` | Filter by login method (`magic_link`, `google`, `github`) |
| `dateFrom` / `dateTo` | ISO date range |

SELECT includes all 35 columns. No new filter params were added in v2 — future candidates: `colo`, `is_webdriver=1`.

### `GET /api/audit/stats`

Returns login forensic metrics to users with security clearance:
- **Total Login Logs** — cumulative count
- **Failed Logins Today** — count of failed attempts today

### `POST /api/auth/magic-link`

Server-side proxy for magic link requests. Logs to D1 and dispatches OTP if authorized. Returns generic responses — prevents email enumeration.

---

## 7. Dashboard UI

**Tab:** 4th tab in Activity Center at `/dashboard/logs`

### 7.1 Access Control

Login Forensics contains PII (full IPs, UA fingerprints, geo location). Double-layer defense:
- Tab is **conditionally hidden** from UI for unauthorized users
- API **independently enforces** the same role/PLAC check
- Users without clearance see nothing — no tab, no stats, no data

### 7.2 Table View

| Column | Description |
|--------|-------------|
| Timestamp | UTC attempt time |
| Email | Email used, with ⚠ UNAUTH chip if not authorized |
| Event | Color-coded badge (cyan, blue, emerald, rose) |
| Outcome | ✓ OK (emerald) / ✗ FAIL (rose) |
| Method | Login method icon (🔗 magic link, 🔵 Google, ⚫ GitHub) |
| IP Address | **Masked** in table view (e.g., `192.168.***.***`) |
| Location | Geo from CF headers |

**Visual indicators:**
- 🔴 Rose left-border — failed login
- 🟡 Amber left-border — unauthorized email attempt
- ⚠ UNAUTH chip — email not in authorized users list

### 7.3 Expanded Forensic Detail Panel (4 Sections)

**Section 1 — NETWORK ORIGIN** (Tier 1)
```
IP Address     [full unmasked IP]
City           [cf-ipcity]
Region         [cf-ipregion]
Country        [cf-ipcountry]
Coordinates    [latitude], [longitude]
Timezone       [request.cf.timezone]
Postal Code    [request.cf.postalCode]
ISP / ASN      [asOrganization] ([asn])
Data Center    [colo]           e.g. "JFK"
Protocol       [httpProtocol] · [tlsVersion]
RTT            [clientTcpRtt] ms
```

**Section 2 — BEHAVIORAL TRUST** (Tier 2 — labeled "Client-Reported")
```
WebDriver      CLEAN ● / DETECTED ⚠
Paste Action   CLEAN ● / PASTED ⚑
Avg Keystroke  [keystroke_avg_iki_ms] ms
Entropy        [keystroke_entropy] ([Very Low / Low / Normal / High])
```

**Section 3 — HARDWARE TELEMETRY** (Tier 2 — labeled "Client-Reported")
```
Platform       [platform]
Browser Time   [browser_time]
Cores          [cores]
RAM            [ram_gb] GB
Resolution     [screen_res]
Color Depth    [color_depth]-bit
```

**Section 4 — EMAIL DELIVERY** (Tier 1)
```
Status         SENT ✓ / FAILED ✗ / N/A
Sent At        [email_sent_at formatted]
Latency        [email_latency_ms] ms
```

**Design rules:**
- All sections use `data-attribute` CSS — zero inline styles (strict CSP)
- Tier 2 sections show a "CLIENT-REPORTED" chip in section header
- Null fields render `—` (em dash), never `undefined` or empty string
- WebDriver DETECTED → amber, not red (signal, not block)
- CSS scoped to `.lf-forensic-*` prefix, uses only `var(--color-*)` tokens

### 7.4 Filters

Email search, event type dropdown, outcome toggle, method dropdown, date range picker.

---

## 8. Security Alert Emails

Every login attempt triggers a Midnight Slate branded email to the admin inbox via Resend API:
- Dispatched via `ctx.waitUntil()` — zero latency impact
- Contains: event type, email, masked IP, geo location, timestamp, success/failure
- Inline HTML template (no external dependencies)

---

## 9. Security Considerations

**Tier 2 data integrity:** Client-reported fields are accepted as-is, never used for access decisions, clearly labeled in UI. Sophisticated attackers can spoof `navigator.webdriver` — value is forensic pattern analysis by a human operator, not automated blocking.

**XSS:** All fields rendered via Preact JSX (auto-escaped). No `innerHTML` or `dangerouslySetInnerHTML`.

**SQL injection:** All fields use D1 parameterized binds (`?1`, `?2`, ...). No string concatenation.

**Immutability:** INSERT/SELECT only. No DELETE or UPDATE endpoints at any layer.

---

## 10. File Map

| File | Purpose |
|------|---------|
| `migrations/0014_create_admin_login_logs_table.sql` | Initial D1 table schema |
| `migrations/0015_enhance_admin_login_logs.sql` | 24 new v2 columns via ALTER TABLE |
| `src/lib/auth/security-logging.ts` | `SecurityLogData` interface + `logLoginAttempt()` + Resend email |
| `src/pages/api/auth/magic-link.ts` | Server proxy: `request.cf` extraction + `clientTelemetry` accept + OTP timing |
| `src/components/auth/LoginForm.tsx` | Behavioral listeners + `collectTelemetry()` + send in POST body |
| `src/pages/auth/callback.astro` | OAuth callback: Tier 1 `request.cf` extraction |
| `src/pages/api/audit/login-logs.ts` | Query API (PLAC-gated, 35 columns) |
| `src/pages/api/audit/stats.ts` | Stats API (login metrics for authorized users) |
| `src/pages/dashboard/logs/index.astro` | `canViewSecurity` PLAC gate |
| `src/components/admin/logs/ActivityCenter.tsx` | SecurityForensicsTable + 4-section forensic panel |
| `src/styles/pages/login-forensics.css` | CSS module — `.lf-forensic-*` prefix, token-only values |

---

## 11. Cross-References

- **PLAC pseudo-path** `/dashboard/logs#security` → See [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md) §2.4
- **Ghost Audit Engine** (separate system) → See [PLAC-AND-AUDIT.md](./PLAC-AND-AUDIT.md)
- **RBAC tiers** → See [USER-MANAGEMENT.md](./USER-MANAGEMENT.md)
- **Security posture** (CSRF, headers, RLS) → See [SECURITY.md](./SECURITY.md)

{% endraw %}
