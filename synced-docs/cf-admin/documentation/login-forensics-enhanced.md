{% raw %}
# Login Forensics v2 — Deep Telemetry Enhancement

> **Status:** Implementation In Progress
> **Version:** 2.0 (Enhancement over v1 baseline)
> **Last Updated:** April 2026
> **Migration:** `0015_enhance_admin_login_logs.sql`
> **Prerequisite:** v1 system documented in [`login-forensics.md`](./login-forensics.md)

This document details the complete v2 enhancement of the Login Forensics subsystem. v2 expands from 10 data points to 35+, adding network telemetry from Cloudflare's edge, client-side hardware fingerprinting, behavioral trust signals, and email delivery timing — matching and exceeding the forensic detail shown in the reference UI format below.

---

## Reference UI Format (Target Output)

```
NETWORK ORIGIN
IP Address     203.0.113.45
City           Sample City
Country        US
Region         NY
Coordinates    40.7128, -74.0060
Timezone       America/New_York
Postal Code    10001
ISP / ASN      Example ISP Inc. (12345)
Data Center    JFK
Protocol       HTTP/2 · TLSv1.3
RTT            12 ms

BEHAVIORAL TRUST
WebDriver      CLEAN
Paste Action   CLEAN
Keystroke IKI  187 ms avg
Entropy        4.21 (human-like)

HARDWARE TELEMETRY
Platform       Win32
Browser Time   2026-04-22T02:10:48.755Z
Cores          20
RAM            32 GB
Resolution     1536×960
Color Depth    24-bit

EMAIL DELIVERY
Status         SENT
Sent At        22:10:52
Latency        234 ms
```

---

## 1. Architecture Overview

### 1.1 Data Source Trust Hierarchy

The v2 system distinguishes between two classes of forensic data based on their trustworthiness:

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
│  • Supabase OTP dispatch timing, latency                        │
├──────────────────────────────────────────────────────────────────┤
│  TIER 2 — CLIENT-REPORTED (informational, labeled as such)      │
│                                                                   │
│  Source: navigator / screen APIs (sent with form POST)          │
│  • navigator.webdriver (bot signal)                              │
│  • navigator.hardwareConcurrency (CPU cores)                    │
│  • navigator.deviceMemory (RAM — Chromium only)                 │
│  • navigator.platform or userAgentData.platform                 │
│  • screen.width/height/colorDepth                               │
│  • new Date().toISOString() (browser clock)                     │
│                                                                   │
│  Source: Form event listeners (behavioral)                      │
│  • Paste event on email field (was_pasted)                      │
│  • Keystroke timing in email field (IKI, entropy)               │
└──────────────────────────────────────────────────────────────────┘
```

> **Security note:** Client-reported fields are NEVER used for access control decisions. All authentication and authorization logic uses only Tier 1 data. Tier 2 fields are forensic context only — labeled in the UI accordingly.

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MAGIC LINK FLOW (enhanced)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  1. LoginForm.tsx (client)                                                   │
│     ├─ Attaches paste + keydown listeners to email input on mount            │
│     ├─ Collects: was_pasted, keyTimestamps[]                                 │
│     ├─ On submit: computes IKI stats, reads navigator/screen APIs            │
│     └─ POST /api/auth/magic-link  { email, redirectTo, clientTelemetry }    │
│                                                                               │
│  2. magic-link.ts (Cloudflare Worker SSR)                                   │
│     ├─ Extracts: CF headers (IP, city, region, country)                     │
│     ├─ Extracts: request.cf object (lat, lng, timezone, ASN, colo, TLS…)   │
│     ├─ Accepts: clientTelemetry from request body (optional, non-fatal)     │
│     ├─ Checks: admin_authorized_users whitelist                             │
│     ├─ Calls: supabase.auth.signInWithOtp() — measures latency              │
│     └─ Calls: security-logging.ts with ALL enriched data                    │
│                                                                               │
│  3. security-logging.ts                                                      │
│     ├─ logLoginAttempt() — 25-field D1 INSERT                               │
│     └─ sendSecurityAlertEmail() — Resend alert to admin inbox               │
│                                                                               │
│  4. admin_login_logs (D1 — INSERT/SELECT only)                              │
│     └─ 35 columns across 5 categories                                       │
│                                                                               │
│  5. login-logs.ts API → ActivityCenter.tsx (display)                        │
│     └─ 4-section forensic panel: Network · Behavioral · Hardware · Delivery │
│                                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                         OAUTH CALLBACK FLOW (enhanced)                       │
│                                                                               │
│  callback.astro → extracts request.cf (Tier 1 only, no client telemetry)   │
│  → security-logging.ts with network-only enrichment                         │
│  → Tier 2 fields will be NULL for OAuth logins — expected and correct       │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Database Schema — v2 Migration

**Migration file:** `migrations/0015_enhance_admin_login_logs.sql`

**Applied via:** `wrangler d1 execute madagascar-db --file=migrations/0015_enhance_admin_login_logs.sql --remote`

### 2.1 Complete Column Inventory (v1 + v2)

| Column | Type | Category | Source | Trust |
|--------|------|----------|--------|-------|
| `id` | TEXT PK | Identity | D1 auto-generated | — |
| `email` | TEXT NOT NULL | Identity | Form body | Server |
| `event_type` | TEXT NOT NULL | Identity | App logic | Server |
| `success` | INTEGER NOT NULL | Outcome | App logic | Server |
| `is_authorized_email` | INTEGER NOT NULL | Outcome | RBAC check | Server |
| `failure_reason` | TEXT | Outcome | App logic | Server |
| `login_method` | TEXT | Identity | App logic | Server |
| `created_at` | TEXT NOT NULL | Timing | D1 default | Server |
| `ip_address` | TEXT | Network | `CF-Connecting-IP` header | **Tier 1** |
| `user_agent` | TEXT | Network | `User-Agent` header | **Tier 1** |
| `geo_location` | TEXT | Network | Joined CF headers (v1 compat) | **Tier 1** |
| `latitude` ★ | TEXT | Network | `request.cf.latitude` | **Tier 1** |
| `longitude` ★ | TEXT | Network | `request.cf.longitude` | **Tier 1** |
| `postal_code` ★ | TEXT | Network | `request.cf.postalCode` | **Tier 1** |
| `timezone` ★ | TEXT | Network | `request.cf.timezone` | **Tier 1** |
| `continent` ★ | TEXT | Network | `request.cf.continent` | **Tier 1** |
| `asn` ★ | INTEGER | Network | `request.cf.asn` | **Tier 1** |
| `asn_org` ★ | TEXT | Network | `request.cf.asOrganization` | **Tier 1** |
| `colo` ★ | TEXT | Network | `request.cf.colo` | **Tier 1** |
| `tls_version` ★ | TEXT | Network | `request.cf.tlsVersion` | **Tier 1** |
| `http_protocol` ★ | TEXT | Network | `request.cf.httpProtocol` | **Tier 1** |
| `client_rtt_ms` ★ | INTEGER | Network | `request.cf.clientTcpRtt` | **Tier 1** |
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
| `email_sent_at` ★ | TEXT | Delivery | Timestamp after Supabase OTP call | **Tier 1** |
| `email_latency_ms` ★ | INTEGER | Delivery | Elapsed ms for Supabase OTP call | **Tier 1** |

★ = New in v2. All v2 columns are nullable — existing records and OAuth logins (no client telemetry) get NULL for Tier 2 fields.

### 2.2 Migration SQL

**Migration Implementation:**
The schema is extended to support Tier 1 (Server-measured) fields for network geolocation and email delivery telemetry, alongside Tier 2 (Client-reported) fields for hardware profiling and behavioral trust signals. All new columns are nullable to maintain compatibility with existing records and non-browser clients (e.g., OAuth flows).

---

## 3. Client-Side Telemetry Collection

### 3.1 Implementation Location

**File:** `src/components/auth/LoginForm.tsx`

The `LoginForm` is a `client:only="preact"` island — JavaScript always runs here. Telemetry collection is attached on mount and collected silently on form submit.

### 3.2 Behavioral Signal Collection

**Data Collection Logic:**
Behavioral signals are captured by attaching event listeners (`paste`, `keydown`) to the email input field on component mount. These listeners silently accumulate keystroke timestamps and paste indicators before the user interacts with the form.

**Keystroke entropy calculation (on submit):**
**Keystroke Entropy Calculation:**
Upon form submission, the system calculates the Inter-Keystroke Interval (IKI) statistics. The standard deviation of these intervals generates an entropy score, which serves as a heuristic to differentiate between machine-like regularity (bot) and variable human typing.

**Entropy interpretation:**
| Entropy Value | Interpretation |
|---------------|---------------|
| < 30 ms | Suspicious — machine-like regularity |
| 30–100 ms | Borderline |
| 100–300 ms | Normal human typing |
| > 300 ms | Hunt-and-peck or hesitant input |
| NULL | Email was not typed (pasted, remembered account, etc.) |

### 3.3 Hardware Telemetry Collection

**Hardware Telemetry Assembly:**
The `collectTelemetry` function aggregates the calculated IKI statistics alongside data extracted from `navigator` and `screen` APIs (such as hardware concurrency, device memory, screen resolution, and webdriver status). This payload is packaged into a standard schema for transmission.

**Browser compatibility:**

| Field | Chrome/Edge | Firefox | Safari |
|-------|-------------|---------|--------|
| `hardwareConcurrency` | ✅ | ✅ | ✅ |
| `deviceMemory` | ✅ | ❌ NULL | ❌ NULL |
| `webdriver` | ✅ | ✅ | ✅ |
| `userAgentData.platform` | ✅ | ❌ fallback | ❌ fallback |
| `platform` (fallback) | ✅ | ✅ | ✅ |
| `screen.*` | ✅ | ✅ | ✅ |

### 3.4 Transmission

Client telemetry is serialized and appended to the existing magic-link POST body as a `clientTelemetry` object, ensuring seamless integration with the existing authentication payload.

`clientTelemetry` is optional on the server — if absent (e.g., OAuth path, programmatic call), all Tier 2 fields are NULL. This is safe and expected.

---

## 4. Server-Side Enrichment

### 4.1 Cloudflare `request.cf` Object

**File:** `src/pages/api/auth/magic-link.ts`

The Cloudflare Workers runtime attaches geo/network data to the incoming `Request` as `request.cf`. This is populated by Cloudflare's edge before the request reaches the Worker — it cannot be spoofed by the client.

```typescript
const cfData = (context.request as any).cf as Record<string, unknown> | undefined;

// All fields fall back to '' or null if not available (e.g., local dev)
const latitude      = String(cfData?.latitude ?? '');
const longitude     = String(cfData?.longitude ?? '');
const postalCode    = String(cfData?.postalCode ?? '');
const timezone      = String(cfData?.timezone ?? '');
const continent     = String(cfData?.continent ?? '');
const asn           = Number(cfData?.asn ?? 0) || null;
const asnOrg        = String(cfData?.asOrganization ?? '');
const colo          = String(cfData?.colo ?? '');          // e.g. "YYZ"
const tlsVersion    = String(cfData?.tlsVersion ?? '');   // e.g. "TLSv1.3"
const httpProtocol  = String(cfData?.httpProtocol ?? ''); // e.g. "HTTP/2"
const clientTcpRtt  = Number(cfData?.clientTcpRtt ?? 0) || null; // ms integer
```

**In local dev:** `request.cf` is undefined — all new network fields will be empty strings or null. This is expected. The existing IP/geo header extraction already handles this gracefully.

### 4.2 OTP Dispatch Timing

Latency is measured around the `supabase.auth.signInWithOtp()` call:

```typescript
const otpStart = Date.now();
const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
const emailLatencyMs = Date.now() - otpStart;
const emailSentAt = error ? null : new Date().toISOString();
```

**Note:** `email_latency_ms` measures the time for Supabase to accept and queue the OTP email — not the time for the email to be delivered to the recipient's inbox.

### 4.3 Security Alert Email

The existing `sendSecurityAlertEmail()` via Resend remains unchanged. It's a separate fire-and-forget notification to the admin inbox, not the magic link email itself. No changes required here for v2.

---

## 5. SecurityLogData Interface (v2)

**File:** `src/lib/auth/security-logging.ts`

### 5.1 Extended Interface

```typescript
export interface SecurityLogData {
  // ── v1 fields (unchanged) ──
  email: string;
  eventType: 'MAGIC_LINK_REQUESTED' | 'MAGIC_LINK_SENT' | 'LOGIN_SUCCESS' | 'LOGIN_FAILED';
  success: boolean;
  isAuthorizedEmail: boolean;
  failureReason?: string;
  ipAddress: string;
  userAgent: string;
  geoLocation: string;       // kept: backward-compat joined string "City, Region, Country"
  loginMethod: string;

  // ── v2: Network / Geo (Tier 1) ──
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

  // ── v2: Hardware telemetry (Tier 2 — client-reported) ──
  cores?: number | null;
  ramGb?: number | null;
  screenRes?: string;
  colorDepth?: number | null;
  platform?: string;
  browserTime?: string;

  // ── v2: Behavioral trust signals (Tier 2 — client-reported) ──
  isWebdriver?: boolean;
  wasPasted?: boolean;
  keystrokeAvgIkiMs?: number | null;
  keystrokeEntropy?: number | null;

  // ── v2: Email delivery timing (Tier 1) ──
  emailSentAt?: string | null;
  emailLatencyMs?: number | null;
}
```

### 5.2 Updated INSERT Query

The `logLoginAttempt()` function is updated to bind all new columns. All v2 fields use `?? null` fallbacks so existing callers (callback.astro OAuth path) continue to work without modification — OAuth records will have NULL for client telemetry fields, which is correct.

---

## 6. OAuth Callback Enhancement

**File:** `src/pages/auth/callback.astro`

OAuth logins (Google/GitHub/Facebook) complete via `src/pages/auth/callback.astro`, which also calls `logLoginAttempt()`. The callback is enhanced to extract `request.cf` network data (Tier 1 only).

**What is captured for OAuth logins:**
- ✅ All Tier 1 network fields (IP, geo, coordinates, ASN, TLS, RTT, etc.)
- ❌ Tier 2 hardware/behavioral fields → NULL (no form interaction, no client POST)
- ✅ Login method (`google`, `github`, `facebook`)
- ✅ Success/fail, failure reason

This is the correct behavior — OAuth flows are redirects, not form submissions, so client-side telemetry is architecturally impossible to collect.

---

## 7. API Query Update

**File:** `src/pages/api/audit/login-logs.ts`

The SELECT query is updated to include all 35 columns. No other changes needed — pagination, filtering, and access control remain identical.

**No new filter params are added in v2.** Future iterations could add filters for `colo`, `country` (separate), `is_webdriver=1`, etc. — but keeping the API surface minimal for now.

---

## 8. UI — Enhanced Forensic Detail Panel

**File:** `src/components/admin/logs/ActivityCenter.tsx`
**CSS:** `src/styles/pages/login-forensics.css` (new module)

### 8.1 Updated LoginLog Interface

The `LoginLog` type definition is updated to explicitly include all 35 columns, combining the existing v1 baseline fields (identity, outcome, and network basics) with the new v2 telemetry fields (extended network geo, hardware signatures, behavioral trust signals, and delivery metrics). All v2 fields are strongly typed as nullable.

### 8.2 Expanded Detail Panel — 4 Sections

The existing flat detail panel (Record ID, Full IP, Location, etc.) is replaced with a structured 4-section forensic view:

**Section 1 — NETWORK ORIGIN** (Tier 1 data, all server-trusted)
```
IP Address    [full unmasked IP]
City          [cf-ipcity]
Region        [cf-ipregion]
Country       [cf-ipcountry]
Coordinates   [latitude], [longitude]
Timezone      [request.cf.timezone]
Postal Code   [request.cf.postalCode]
ISP / ASN     [asOrganization] ([asn])
Data Center   [colo]
Protocol      [httpProtocol] · [tlsVersion]
RTT           [clientTcpRtt] ms
```

**Section 2 — BEHAVIORAL TRUST** (Tier 2 — labeled "Client-Reported")
```
WebDriver     CLEAN ● / DETECTED ⚠
Paste Action  CLEAN ● / PASTED ⚑
Avg Keystroke [keystroke_avg_iki_ms] ms
Entropy       [keystroke_entropy] ([qualitative label])
```

Entropy qualitative labels:
- `< 30` → "Very Low (suspicious)"
- `30–100` → "Low"
- `100–300` → "Normal"
- `> 300` → "High"
- NULL → "—" (not available)

**Section 3 — HARDWARE TELEMETRY** (Tier 2 — labeled "Client-Reported")
```
Platform      [platform]
Browser Time  [browser_time]
Cores         [cores]
RAM           [ram_gb] GB  (or "—" if null/Firefox)
Resolution    [screen_res]
Color Depth   [color_depth]-bit
```

**Section 4 — EMAIL DELIVERY** (Tier 1)
```
Status        SENT ✓ / FAILED ✗ / N/A (for non-magic-link events)
Sent At       [formatted time from email_sent_at]
Latency       [email_latency_ms] ms
```

### 8.3 Visual Design Rules

- All 4 sections use `data-attribute` driven CSS — zero inline styles (strict CSP)
- Tier 2 sections have a subtle "CLIENT-REPORTED" chip in the section header — makes data trust level transparent to the operator
- WebDriver "DETECTED" badge renders in amber, not red — it's a signal, not a definitive block
- Null fields render `—` (em dash), never `undefined`, `null`, or empty string
- The existing table view (masked IP, geo_location joined string) is UNCHANGED — only the expanded detail panel gets the new design

### 8.4 CSS Module

**File:** `src/styles/pages/login-forensics.css`

Scoped to `.lf-forensic-*` class prefix. Uses only CSS design tokens (`var(--color-*)`, `var(--duration-*)`) — no hardcoded hex values. Four section containers + field rows + trust-level chip + badge states (clean/detected/pasted).

---

## 9. File Change Map

| File | Type | Change |
|------|------|--------|
| `migrations/0015_enhance_admin_login_logs.sql` | **CREATE** | 24 new columns via ALTER TABLE |
| `src/lib/auth/security-logging.ts` | **MODIFY** | Extended `SecurityLogData` interface + 24 new binds in INSERT |
| `src/pages/api/auth/magic-link.ts` | **MODIFY** | `request.cf` extraction + accept `clientTelemetry` from body + OTP timing |
| `src/components/auth/LoginForm.tsx` | **MODIFY** | Behavioral listeners (paste/keydown) + `collectTelemetry()` + send in POST body |
| `src/pages/auth/callback.astro` | **MODIFY** | `request.cf` extraction for Tier 1 fields on OAuth logins |
| `src/pages/api/audit/login-logs.ts` | **MODIFY** | UPDATE SELECT to include all 35 columns |
| `src/components/admin/logs/ActivityCenter.tsx` | **MODIFY** | Updated `LoginLog` interface + 4-section expanded detail panel |
| `src/styles/pages/login-forensics.css` | **CREATE** | CSS module for the enhanced forensic detail panel |

---

## 10. Behavioral Signal Reference

### 10.1 WebDriver (`navigator.webdriver`)

`true` when the browser is being controlled by automation (Puppeteer, Playwright, Selenium in standard mode). Can be masked by stealth plugins — treat as a signal, not a block.

| Value | Meaning | Display |
|-------|---------|---------|
| `false` / `NULL` | Normal browser | CLEAN (green) |
| `true` | Automation detected | DETECTED (amber) |

### 10.2 Paste Action (`was_pasted`)

Whether the email address was pasted into the field vs typed character by character.

| Value | Meaning | Display |
|-------|---------|---------|
| `false` | Email was typed | CLEAN (green) |
| `true` | Email was pasted | PASTED (amber) |
| `NULL` | OAuth login — no field interaction | — |

Pasting is not inherently suspicious (password managers paste), but combined with webdriver detection and zero keystroke entropy, it forms a strong bot signal.

### 10.3 Keystroke IKI (Inter-Keystroke Interval)

The time between consecutive keystrokes in the email field, in milliseconds.

- **Bots:** Very consistent intervals, often < 20ms between keystrokes
- **Humans:** Variable intervals reflecting natural typing rhythm
- **avgIki + entropy together** provide the most useful signal — low avg AND low entropy = highly suspicious

### 10.4 Entropy Score

Standard deviation of IKI values. High variance = human typing. Low variance = automated input.

```
entropy = sqrt( mean( (IKI_i - mean_IKI)^2 ) )
```

---

## 11. Security Considerations

### 11.1 Client-Reported Data Integrity

All Tier 2 (client-reported) values are:
- Accepted as-is — no server-side validation of their accuracy
- Stored in D1 without any decision-making logic based on them
- Clearly labeled in the UI as "CLIENT-REPORTED"
- Never used as input to the RBAC or session system

A sophisticated attacker can trivially spoof `navigator.webdriver = false` or send fake hardware telemetry. This is known and accepted. The value of these fields is forensic pattern analysis by a human operator reviewing the log — not automated blocking.

### 11.2 XSS Protection

All client-reported fields are rendered via Preact JSX (auto-escaped). No `innerHTML`, no `dangerouslySetInnerHTML`. The CSS module uses class-based rendering. No client input can inject HTML or scripts into the forensic panel.

### 11.3 SQL Injection

All fields use D1 parameterized binds (`?1`, `?2`, ...) — no string concatenation in SQL. This is unchanged from v1 and fully protects against SQL injection regardless of field content.

### 11.4 Data Retention

The `admin_login_logs` table remains INSERT/SELECT only. No DELETE or UPDATE endpoints are exposed. This is a forensic record — immutable by design.

---

## 12. Cross-References

- **v1 forensics documentation** → [`login-forensics.md`](./login-forensics.md) (baseline)
- **PLAC pseudo-path for security tab** → [`plac-and-audit.md`](./plac-and-audit.md) §2.4
- **Ghost Audit Engine** → separate system in [`plac-and-audit.md`](./plac-and-audit.md)
- **Security hardening (CSRF, headers, CSP)** → [`security-hardening.md`](./security-hardening.md)
- **CF Bindings registry (D1 ID)** → [`cloudflare-bindings-registry.md`](./cloudflare-bindings-registry.md)

{% endraw %}
