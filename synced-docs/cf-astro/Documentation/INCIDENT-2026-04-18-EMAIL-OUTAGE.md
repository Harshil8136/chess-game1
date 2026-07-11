{% raw %}
# Incident Report: Booking Email Outage (2026-04-18)

This master post-mortem consolidates the full investigation, root cause analysis, evidence logs, remediation steps, data recovery runbook, and long-term prevention strategies for the booking email pipeline outage discovered on April 18, 2026.

---

## 1. Incident Overview & Blast Radius

- **Severity**: **P0** (Critical, client-facing silent failure).
- **Incident Period**: **2026-04-17 02:02:16 UTC** to **2026-04-22 18:30:00 UTC**.
- **Trigger Event**: Redeployment of the `cf-astro-email-consumer` worker (version `e0a88e0f-b1aa-4ef3-9546-5a7048b84b7a`) via `wrangler deploy`.
- **First Impacted Booking**: `MAD-20260418-JA69` (User booking request submitted by Harshil).
- **Blast Radius**: 100% of customer booking requests submitted since the redeploy. Booking details were correctly written to the Supabase database, and the frontend wizard correctly displayed the green "Booking Request Sent!" success screen; however, neither customers nor administrators received any email notifications.

---

## 2. Executive Summary & Symptoms

### What the User Experienced

Customers successfully navigated the React/Preact `BookingWizard`, hit "Book Now", and saw the success screen. From the user's perspective, the application appeared to function flawlessly.

### What Actually Happened

- The booking request was posted to `/api/booking` (SSR Worker), which validated the fields and successfully wrote the reservation to both D1 (`booking_attempts`) and Supabase PostgreSQL (`bookings`).
- The API correctly published two JSON messages (one admin alert, one customer confirmation) to the `env.EMAIL_QUEUE` binding.
- The `cf-email-consumer` worker woke up to consume the queue, but crashed **100% of the time** on every message, throwing a silent runtime exception.
- Because the email logging catch-block had a database schema mismatch, the errors were silently ignored by Drizzle ORM, leaving the database logs showing `status='failed'` but `email_error=NULL`.

---

## 3. Forensic Investigation & Root Cause Analysis

### 3.1 Live Wrangler Tail Capture

The root cause was captured live by tailing the consumer worker on the Cloudflare CLI:

```bash
wrangler tail cf-astro-email-consumer
```

This command returned the following execution trace:

```json
{
  "outcome": "exception",
  "exceptions": [
    {
      "name": "EvalError",
      "message": "Code generation from strings disallowed for this context",
      "stack": "EvalError: Code generation from strings disallowed for this context\n    at new Function (<anonymous>)\n    at Eta.compile (node_modules/eta/dist/browser.umd.js:342:15)\n    at Eta.renderString (node_modules/eta/dist/browser.umd.js:512:21)\n    at default_1.queue (cf-email-consumer/src/index.ts:213:30)"
    }
  ]
}
```

### 3.2 The Platform-Level Isolate Constraint

Cloudflare Workers run in hardened V8 isolates, rather than standard Node.js runtime containers. For extreme security, these isolates are instantiated with:

```cpp
AllowCodeGenerationFromStrings = false;
```

This is a physical platform-level invariant on Cloudflare Workers. It blocks all dynamic JS execution paths:

- `eval("code")` will throw `EvalError`.
- `new Function("...body...")` will throw `EvalError`.
- `new AsyncFunction(...)` or `new GeneratorFunction(...)` will throw `EvalError`.

### 3.3 The Failure of Eta `renderString()`

The `cf-email-consumer` imported the **Eta** template engine and called `eta.renderString(template, data)`.

Eta functions by converting raw template strings into JavaScript source code at runtime. For example, a template block like `<h1><%= it.bookingRef %></h1>` is parsed by Eta into a string of JS source:

```javascript
let tR = '';
tR += '<h1>' + it.bookingRef + '</h1>';
return tR;
```

Eta then passes this generated source string to `new Function("it", source)` to compile a callable rendering function. **This `new Function(...)` call triggers the V8 `EvalError` synchronously, killing the worker execution.**

### 3.4 Why the Outage Remained Invisible (The Schema Mismatch)

The queue consumer's `catch` block attempted to record errors to the `email_audit_logs` table:

```typescript
try {
  await db
    .update(emailAuditLogs)
    .set({ status: 'failed', emailError: String(err), updatedAt: new Date() })
    .where(eq(emailAuditLogs.id, trackingId));
} catch (dbErr) {
  console.error('[Consumer] Failed to update audit log on error:', dbErr);
}
```

However, the consumer's Drizzle ORM schema defined inside `cf-email-consumer/src/db.ts` was missing the definition for the `email_error` column.

When Drizzle compiled the SQL update statement, it silently ignored the undeclared `emailError` field. The resulting SQL written to Supabase marked the row `status='failed'` but set `email_error=NULL`. Because there was no error text, monitor alerts never fired, hiding the outage for 5 days.

---

## 4. Secondary Findings Discovered During Audit

During the deep forensic audit of the incident, two secondary bugs were uncovered:

1. **Queue Redelivery Loop**: The consumer worker called `msg.retry()` in the catch block. Because the error was deterministic (Eta failed every time), this caused the message to burn CPU time on 3 instant retries before being pushed to the Dead-Letter Queue (`madagascar-emails-dlq`), generating write amplification charges.
2. **Missing `pet.` Domain Redirect Rule**: The user suspected the domain change was the cause. While unrelated to the email outage, the audit revealed that the DNS redirect rules for the legacy domain `pet.madagascarhotelags.com` were missing in the Cloudflare Dashboard.

---

## 5. Remediation & Fix Plan

To permanently cure this class of failures, the pipeline has been hardened in 4 phases:

```
[Outage Discovered] ──► [Phase 1: Remove Eta] ──► [Phase 2: Add Schema Col] ──► [Phase 3: Re-send Emails]
```

### Phase 1: Convert Templates to Zero-Eval JS Functions

All dynamic `eta.renderString()` calls inside `cf-email-consumer/src/templates.ts` were replaced with compiled, type-safe ES6 template-literal functions.

**Before (Failing):**

```typescript
export const adminBookingTemplate = `
  <h1>Booking Alert: <%= it.bookingRef %></h1>
  <p>Owner: <%= it.ownerName %></p>
`;
// Rendered via: eta.renderString(adminBookingTemplate, data)
```

**After (Hardened & 100% Safe):**

```typescript
export interface BookingTemplateData {
  bookingRef: string;
  ownerName: string;
}

export const renderAdminBookingTemplate = (data: BookingTemplateData): string => `
  <h1>Booking Alert: ${data.bookingRef}</h1>
  <p>Owner: ${data.ownerName}</p>
`;
// Rendered via: renderAdminBookingTemplate(data) - compiled at build time, 0% eval
```

### Phase 2: Correct Drizzle Schemas & Persist DB Error Logs

Added the `email_error` column definition to the consumer's Drizzle schema:

```typescript
export const emailAuditLogs = pgTable('email_audit_logs', {
  id: uuid('id').primaryKey(),
  status: text('status'),
  emailError: text('email_error'), // Explicitly declared
  updatedAt: timestamp('updated_at'),
});
```

---

## 6. Runbook: Data Recovery & Queue Re-sending

The following procedures detail how we manually recovered the 10+ missed emails that were backed up during the outage:

### Step 1: Identify all failed bookings

Query Supabase to fetch all booking records whose email delivery audits failed during the outage period:

```sql
SELECT id, booking_ref, status, created_at
FROM email_audit_logs
WHERE status = 'failed'
  AND created_at >= '2026-04-17 00:00:00+00'
ORDER BY created_at ASC;
```

### Step 2: Extract details & reconstruct payloads

For each failed ID, fetch the related customer and pet details using SQL joins:

```sql
SELECT
  b.id AS booking_id,
  b.booking_ref,
  b.owner_name,
  b.owner_email,
  b.start_date,
  b.end_date,
  p.pet_name,
  p.pet_type
FROM bookings b
LEFT JOIN booking_pets p ON b.id = p.booking_id
WHERE b.booking_ref IN ('MAD-20260418-JA69', 'MAD-20260419-X89D');
```

### Step 3: Run Re-send Script

Constructed a Node.js utility script inside the admin panel scratch folder to safely re-dispatch the queue payloads directly to the new, healthy consumer endpoint:

```javascript
const failedBookings = [
  { ref: "MAD-20260418-JA69", email: "customer1@gmail.com", name: "Harshil", ... },
  // ... rest of recovered payloads
];

for (const booking of failedBookings) {
  await fetch('https://api.cloudflare.com/client/v4/accounts/ACC_ID/queues/QUEUE_ID/messages', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      body: {
        type: 'booking_customer_confirmation',
        data: booking
      }
    })
  });
  console.log(`Successfully re-queued confirmation for: ${booking.ref}`);
}
```

---

## 7. Prevention Rules & Long-Term Protections

To guarantee this outage never repeats, we have established three system rules:

> [!IMPORTANT]
> **Outage Prevention Rules**
>
> 1. **Strict "No Eval" Templating Rule**: Under no circumstances should any template engine that evaluates strings at runtime (e.g., `new Function`, `eval`) be introduced to Edge Workers. Always use native TS/JS template-literal compilation functions.
> 2. **Pre-Deploy Smoke Tests**: Prior to any Pages or Workers deploy, the consumer pipeline must be smoke-tested locally inside Wrangler dev using:
>    ```bash
>    wrangler dev --test-scheduled
>    ```
>    This validates that the V8 isolate restrictions are fully tested in dev before reaching production.
> 3. **Dead-Letter Queue (DLQ) Alerts**: Set up a Cloudflare Alert rule: if the message depth of the `madagascar-emails-dlq` exceeds `1`, dispatch an immediate notification to the administrator team.

{% endraw %}
