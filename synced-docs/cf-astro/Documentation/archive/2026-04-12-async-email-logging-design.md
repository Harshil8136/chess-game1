{% raw %}
# Async Email & Audit Logging Architecture Design

**Date:** 2026-04-12
**Status:** Approved for Implementation
**Context:** This architecture creates a resilient, $0-cost, PII-compliant async email delivery and audit system for both the `cf-astro` (public facing) and `cf-admin` (internal portal) projects.

## 1. System Overview

To prevent API timeouts, handle transient third-party (Resend) failures, and maintain strict compliance with data regulations (PII), we are decoupling email delivery from the request lifecycle using Cloudflare Queues.

Both `cf-astro` and `cf-admin` will act as **Producers**, pushing messages into a unified Cloudflare Queue (`madagascar-emails`). A standalone **Consumer Worker** (`cf-astro-email-consumer`) will process the queue and dispatch emails via Resend. Any delivery events (bounces, deliveries) will be fed back into our system via **Resend Webhooks** and logged securely in **Supabase**.

## 2. Infrastructure Components

### 2.1 The Data Layer: Supabase `email_audit_logs`

All email activities are logged in Supabase to leverage PostgreSQL's JSONB capabilities and Row Level Security (RLS) for handling PII securely.

**Table Schema (`email_audit_logs`):**

- `tracking_id` (UUID, Primary Key)
- `project_source` (String: `'cf-astro'` or `'cf-admin'`)
- `booking_id` / `consent_id` (UUID, Optional Foreign Keys)
- `purpose` (String: e.g., `'booking_confirmation'`, `'arco_request'`, `'admin_alert'`)
- `status` (Enum: `'queued'`, `'sent_to_resend'`, `'delivered'`, `'bounced'`, `'failed_internally'`)
- `sender_ip` (String, IP Address)
- `recipient_email` (String, PII)
- `resend_id` (String, ID returned by Resend after handoff)
- `payload` (JSONB, the full payload sent to the queue)
- `delivery_events` (JSONB array, chronological log of all webhook updates)
- `created_at` (Timestamp)
- `updated_at` (Timestamp)

### 2.2 The Cloudflare Queue: `madagascar-emails`

A single robust queue handling traffic from both applications.

- **Max Batch Size:** 10
- **Max Retries:** 3
- **Dead Letter Queue (DLQ):** `madagascar-emails-dlq`

### 2.3 The Consumer Worker: `cf-astro-email-consumer`

A standalone Cloudflare Worker deployed from the `queue-worker/` directory.

- **Responsibility:** Pulls message batches from the queue, constructs HTML templates based on the `purpose`, and dispatches them via the Resend REST API (using standard `fetch` since it's edge-native).
- **Tagging:** Critically, it injects the `tracking_id` into the Resend API request tags:
  ```json
  "tags": [
    { "name": "tracking_id", "value": "uuid-1234-..." }
  ]
  ```
- **Database Update:** After a successful 200 OK from Resend, it updates the `email_audit_logs` record in Supabase to `'sent_to_resend'` and populates the `resend_id`.

### 2.4 The Webhook Endpoint: `/api/webhooks/resend.ts`

Implemented in `cf-astro` (and optionally `cf-admin` if independent webhooks are desired, though maintaining a single source of truth in `cf-astro` is recommended).

- **Responsibility:** Receives `email.delivered`, `email.bounced`, `email.complained` events from Resend.
- **Security:** Verifies cryptographic signatures using the Svix/Resend Webhook verifier.
- **Action:** Extracts the `tracking_id` from the payload tags, appends the entire event to the `delivery_events` JSONB array, and updates the master `status` column in Supabase.

## 3. Workflows

### 3.1 Producer Workflow (cf-astro / cf-admin)

1. User (or Admin) triggers an action resulting in an email.
2. The API route generates a `tracking_id` (Crypto.randomUUID).
3. The API route executes a Drizzle ORM query via Hyperdrive to `INSERT` a `'queued'` record into `email_audit_logs` in Supabase.
4. The API route calls `env.EMAIL_QUEUE.send({ tracking_id, project_source, purpose, data })`.
5. The API route immediately returns a success response to the client.

### 3.2 Consumer Workflow

1. The Queue triggers `queue-worker/src/index.ts`.
2. The Worker maps the `purpose` to a specific email template builder.
3. The Worker calls `POST https://api.resend.com/emails`.
4. On success: Updates Supabase status to `'sent_to_resend'`.
5. On failure: `msg.retry()` is invoked. If `max_retries` is hit, it passes to DLQ and the status in Supabase is optionally updated to `'failed_internally'`.

### 3.3 Event Loop (Webhook) Workflow

1. Resend attempts delivery to the ISP.
2. ISP returns "250 OK" (Delivered) or "550" (Bounce).
3. Resend fires a webhook to `https://madagascarhotelags.com/api/webhooks/resend`.
4. Endpoint verifies signature.
5. Endpoint queries `email_audit_logs` by `tracking_id` (extracted from event tags).
6. Endpoint updates the row (`status` = event type, appends to `delivery_events`).

## 4. Shared Integration & Flexibility

- **Cross-Project Access:** Both `cf-astro` and `cf-admin` will share the same binding to `madagascar-emails` in their respective `wrangler.toml` files.
- **Payload Agnostic:** The `payload` column in Supabase is `JSONB`, meaning an admin invitation payload and a customer booking payload are stored flexibly without requiring rigid schema changes.
- **Template Scalability:** The `cf-astro-email-consumer` worker will use a switch statement on the `purpose` field, making it trivial to add new email types (e.g., `'weekly_report'`) in the future.

{% endraw %}
