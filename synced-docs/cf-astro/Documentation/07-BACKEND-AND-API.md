# 07 — Backend & API

## Overview

All server-side logic runs as **Cloudflare Workers** via Pages Functions. Routes opt into SSR with `export const prerender = false`.

The backend accesses Cloudflare bindings through `locals.runtime.env`:

```typescript
const env = locals.runtime.env;
// env.DB      → D1Database
// env.IMAGES  → R2Bucket
// env.KV      → KVNamespace
// env.BREVO_API_KEY → string (secret)
```

---

## API Routes

### `POST /api/booking` — Booking Submission

**File**: `src/pages/api/booking.ts` (5.5KB, 139 lines)

**Flow**:

1. Parse JSON body from request
2. Validate with `bookingSchema` (Zod) — returns `400` with field errors on failure
3. Generate booking reference: `MAD-YYYYMMDD-XXXX` (e.g., `MAD-20260317-A1B2`)
4. Insert consent record into `consent_records` table (D1)
5. Insert booking into `bookings` table (D1)
6. Insert each pet into `booking_pets` table (D1)
7. Insert quality metadata into `booking_quality_metadata` table (D1)
8. Send staff notification email via Brevo HTTP API (non-blocking via `Promise.allSettled`)
9. Send customer receipt email via Brevo HTTP API (non-blocking)
10. Update `bookings.admin_email_sent` and `bookings.user_email_sent` flags in D1
11. Return JSON response with `bookingRef` and `whatsappUrl` fallback

**Response (success)**:
```json
{
  "success": true,
  "bookingRef": "MAD-20260317-A1B2",
  "emailsSent": { "admin": true, "customer": true },
  "whatsappUrl": "https://wa.me/5214494485486?text=..."
}
```

**Response (validation error)**:
```json
{
  "success": false,
  "errors": { "ownerEmail": ["Valid email is required"], ... }
}
```

**Response (server error)**:
```json
{
  "success": false,
  "error": "Internal server error...",
  "whatsappUrl": "https://wa.me/5214494485486"
}
```

---

### `ALL /api/ingest/[...path]` — PostHog Analytics Proxy

**File**: `src/pages/api/ingest/[...path].ts` (1.3KB, 44 lines)

**Purpose**: Reverse proxy for PostHog analytics to bypass ad-blockers.

**How It Works**:
- Catches all HTTP methods (`GET`, `POST`, etc.)
- Strips `host` and `cookie` headers from the forwarded request
- Forwards to `https://us.i.posthog.com/{path}{query}`
- Strips `set-cookie` and `x-frame-options` from the response
- Returns PostHog's response transparently

**Example**: `POST /api/ingest/decide?v=3` → `POST https://us.i.posthog.com/decide?v=3`

---

### `POST /api/privacy/arco` — ARCO Privacy Request

**File**: `src/pages/api/privacy/arco.ts` (1.7KB, 52 lines)

**Purpose**: Handles ARCO (Access, Rectification, Cancellation, Opposition) privacy requests as required by Mexico's LFPDPPP data protection law.

**Validation Schema** (Zod):
```typescript
{
  requestType: 'access' | 'rectification' | 'cancellation' | 'opposition',
  requesterName: string (2-200 chars),
  requesterEmail: string (valid email),
  description: string (10-2000 chars),
}
```

**Flow**:
1. Parse + validate JSON body
2. Generate UUID request ID
3. Insert into `privacy_requests` table (D1)
4. Return confirmation with 20 business day response timeline

---

### `POST /api/consent` — Legal Consent Forensics

**File**: `src/pages/api/consent.ts`

**Purpose**: Captures explicit user consent securely for GDPR/LFPDPPP legal compliance and stores it in Supabase `consent_records`.

**Validation Schema** (Zod):
```typescript
{
  consentType: 'cookies_analytics',
  consentVersion: string,
  consentTextHash: string (SHA-256),
  consentMechanism: 'button_click',
  granted: boolean,
  locale: string,
  interactionProof: record,
  fingerprintData: record,
}
```

**Flow**:
1. Checks Upstash rate limits (5 requests / min).
2. Parses safely with `zod`.
3. Harvests geographic information non-invasively directly from Cloudflare Proxy Headers (`cf-ipcountry`, `cf-ipcity`).
4. Generates an anonymous UUID placeholder.
5. Pushes telemetry and boolean choice to `consentRecords` via Drizzle.

---

## D1 Database Schema

**Migration file**: `db/migrations/0001_initial_schema.sql` (3.3KB, 92 lines)

### Tables

#### `bookings` — Main booking records

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | TEXT | PK, auto-generated hex UUID | Unique booking ID |
| `booking_ref` | TEXT | UNIQUE, NOT NULL | User-facing ref (MAD-YYYYMMDD-XXXX) |
| `owner_name` | TEXT | NOT NULL | Pet owner's full name |
| `owner_email` | TEXT | NOT NULL | Pet owner's email |
| `owner_phone` | TEXT | NOT NULL | Pet owner's phone |
| `emergency_contact` | TEXT | nullable | Emergency contact info |
| `service` | TEXT | NOT NULL | 'hotel', 'daycare', or 'transport' |
| `check_in_date` | TEXT | NOT NULL | ISO date string |
| `check_out_date` | TEXT | nullable | ISO date string (null for daycare) |
| `special_instructions` | TEXT | nullable | Free-text notes |
| `medication_admin` | INTEGER | DEFAULT 0 | Boolean: needs medication |
| `transport_type` | TEXT | DEFAULT 'none' | 'none', 'pickup', 'dropoff', 'both' |
| `transport_address` | TEXT | nullable | Address for transport service |
| `admin_email_sent` | INTEGER | DEFAULT 0 | Boolean: staff email sent |
| `user_email_sent` | INTEGER | DEFAULT 0 | Boolean: customer email sent |
| `email_error` | TEXT | nullable | Email delivery error details |
| `consent_id` | TEXT | FK → consent_records | Privacy consent reference |
| `posthog_session_id` | TEXT | nullable | Analytics tracking ID |
| `created_at` | TEXT | DEFAULT datetime('now') | Timestamp |

#### `booking_pets` — Pet details (one-to-many with bookings)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | INTEGER | PK AUTOINCREMENT | Auto-incrementing ID |
| `booking_id` | TEXT | FK → bookings, ON DELETE CASCADE | Parent booking |
| `pet_name` | TEXT | NOT NULL | Pet's name |
| `pet_type` | TEXT | NOT NULL, CHECK IN ('dog','cat','other') | Pet type |
| `pet_breed` | TEXT | NOT NULL | Breed name |
| `pet_age` | TEXT | NOT NULL | Age description |
| `pet_weight` | TEXT | nullable | Weight description |

#### `booking_quality_metadata` — Booking telemetry

| Column | Type | Description |
|---|---|---|
| `booking_id` | TEXT | FK → bookings (UNIQUE, 1-to-1) |
| `quality_score` | INTEGER | Default 100 |
| `confidence_score` | INTEGER | Default 100 |
| `manual_review_required` | INTEGER | Boolean flag |
| `manual_review_status` | TEXT | 'approved' (default) |

#### `consent_records` — GDPR/LFPDPPP consent log

| Column | Type | Description |
|---|---|---|
| `id` | TEXT | PK UUID |
| `email` | TEXT | User's email |
| `booking_ref` | TEXT | Associated booking ref |
| `ip_address` | TEXT | Client IP (optional) |
| `user_agent` | TEXT | Browser UA (optional) |
| `locale` | TEXT | 'es' or 'en' |
| `consent_type` | TEXT | 'booking' (default) |
| `granted` | INTEGER | Boolean: consent given |

#### `privacy_requests` — ARCO requests

| Column | Type | Description |
|---|---|---|
| `id` | TEXT | PK UUID |
| `request_type` | TEXT | CHECK IN ('access','rectification','cancellation','opposition') |
| `requester_name` | TEXT | Name of requester |
| `requester_email` | TEXT | Email of requester |
| `description` | TEXT | Free-text request description |
| `status` | TEXT | CHECK IN ('pending','in_progress','completed','rejected') |
| `resolved_at` | TEXT | Resolution timestamp |

#### `site_settings` — Key-value configuration store

| Column | Type | Description |
|---|---|---|
| `key` | TEXT | PK — setting name |
| `value` | TEXT | JSON blob |
| `updated_at` | TEXT | Last update timestamp |

### Indexes

| Index | Table | Column | Purpose |
|---|---|---|---|
| `idx_bookings_email` | bookings | owner_email | Lookup by email |
| `idx_bookings_created` | bookings | created_at | Date-range queries |
| `idx_bookings_ref` | bookings | booking_ref | Lookup by reference |
| `idx_booking_pets_booking` | booking_pets | booking_id | Join performance |
| `idx_consent_email` | consent_records | email | Privacy lookups |
| `idx_privacy_status` | privacy_requests | status | Filter by status |

---

## Email Integration

### Brevo HTTP API (`src/lib/email/send-email.ts`)

Replaces Nodemailer SMTP because Cloudflare Workers cannot open raw TCP sockets.

```typescript
const response = await fetch('https://api.brevo.com/v3/smtp/email', {
  method: 'POST',
  headers: {
    'api-key': apiKey,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    sender: { email: 'team@madagascarhotelags.com', name: 'Hotel Madagascar' },
    to: [{ email: recipientEmail }],
    subject: 'Subject Line',
    htmlContent: '<html>...</html>',
  }),
});
```

### Email Templates (`src/lib/email/templates.ts`)

Two HTML email templates:

1. **Staff Notification** (`buildStaffEmailHtml`) — Sent to admin email when new booking arrives
   - Green gradient header with booking ref
   - Owner details table
   - Service details table
   - Pet breakdown table
   - Special instructions block

2. **Customer Receipt** (`buildCustomerReceiptHtml`) — Sent to customer after booking
   - Green gradient header
   - Personalized greeting
   - Booking summary card (ref, service, date, pets)
   - WhatsApp contact link
   - Footer with business name

Both templates use inline CSS for email client compatibility (no Tailwind in emails).

---

## Formspree Contact Form

### Overview

The Contact section uses **Formspree** for general inquiry submissions. This is separate from the Brevo booking email system.

| System | Purpose | Mechanism | Endpoint |
|---|---|---|---|
| **Brevo** | Booking confirmations (staff + customer) | Programmatic `fetch()` from Worker | `https://api.brevo.com/v3/smtp/email` |
| **Formspree** | General contact inquiries | Standard HTML `<form>` POST | `https://formspree.io/f/xbjnrvnq` |

### Why Formspree?

The contact form doesn't need server-side processing — it's a simple name/email/phone/message inquiry. Using Formspree:
- **Zero JS required** — Standard HTML `<form method="POST" action="...">` works with Astro's static output
- **Zero Worker compute** — No Cloudflare Worker invoked
- **Built-in features** — Spam filtering, email notifications, submission dashboard
- **Free tier** — 50 submissions/month (sufficient for local pet hotel)

### Form Fields

| Field | Input Type | Required | `name` Attribute |
|---|---|---|---|
| Name | `text` | ✅ | `name` |
| Email | `email` | ✅ | `email` |
| Phone | `tel` | ❌ | `phone` |
| Service | `select` | ✅ | `service` (hotel/daycare/transport/other) |
| Message | `textarea` | ✅ | `message` |

### Form Markup

```html
<form action="https://formspree.io/f/xbjnrvnq" method="POST">
  <input type="text" name="name" required />
  <input type="email" name="email" required />
  <input type="tel" name="phone" />
  <select name="service" required>
    <option value="hotel">Hotel</option>
    <option value="daycare">Daycare</option>
    <option value="transport">Transport</option>
    <option value="other">Other</option>
  </select>
  <textarea name="message" required></textarea>
  <button type="submit">Send</button>
</form>
```

---

## Validation Schemas (`src/lib/schemas/booking.ts`)

### `petSchema` (Zod)

```typescript
{
  petName: string (1-100 chars),
  petType: 'dog' | 'cat' | 'other',
  petBreed: string (1-100 chars),
  petAge: string (1-50 chars),
  petWeight: string (0-50 chars, optional),
}
```

### `bookingSchema` (Zod)

```typescript
{
  pets: array of petSchema (1-5 pets),
  service: 'hotel' | 'daycare' | 'transport',
  checkInDate: string (required),
  checkOutDate: string (optional),
  transportType: 'none' | 'pickup' | 'dropoff' | 'both',
  transportAddress: string (optional),
  ownerName: string (2-200 chars),
  ownerEmail: valid email,
  ownerPhone: string (8-20 chars),
  emergencyContact: string (optional),
  specialInstructions: string (0-1000 chars, optional),
  medicationAdmin: boolean,
  agreeToTerms: literal true,
  posthogSessionId: string (optional),
}
```

### `generateBookingRef()`

Generates references like `MAD-20260317-A1B2`:
- Prefix: `MAD-`
- Date stamp: `YYYYMMDD`
- Random suffix: 4 alphanumeric characters (base-36)
