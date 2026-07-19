{% raw %}
# ARCO / Data-Subject-Request Runbook

**Legal deadline: respond within 20 business days of receipt (LFPDPPP: 20
business days to decide + up to 15 additional business days to implement).**
Requests arrive via the ARCO form (`/es/legal/arco/`), which notifies
`booking@madagascarhotelags.com` through the email queue.

> **2026-07 update:** `/api/privacy/arco` (an orphaned, no-Turnstile, no
> identity-verification endpoint with zero frontend callers and zero rows
> ever written) was removed. The `privacy_requests` table it wrote to is
> deprecated — the ARCO form (`/api/arco/submit`) is the only intake channel.
> If `privacy_requests` still has historical rows, check it once during
> cleanup, then it can be dropped in a future migration.

## Where requests land

| Channel                                      | Storage                                                                                              | Notification          |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------- |
| ARCO form with identity document             | Postgres `legal_requests` (ticket `ARCO-NNNNNN`, status `PENDING`) + document in R2 `arco-documents` | Admin email via queue |

## Step-by-step

1. **Acknowledge** receipt to the requester by email (same address they gave) —
   note the ticket number and the 20-business-day clock start date.
2. **Verify identity**: retrieve the submitted ID via
   `GET /api/arco/get-document/?ticket=ARCO-NNNNNN` with header
   `X-Admin-Secret: $ARCO_ADMIN_SECRET`. Compare the name against the request.
3. **Locate the data** (by requester email):
   - Postgres: `bookings`, `booking_pets`, `consent_records`,
     `email_audit_logs`, `contact_messages`, `legal_requests`, `privacy_requests`
   - D1: `booking_attempts` / `consent_attempts` (90-day retention target, deleted
     only via manual/admin action — see cf-admin `/dashboard/retention` or
     `db/retention-purge.sql` — never automatically, per 2026-07 policy)
   - PostHog: person profile (identified by email) — delete via PostHog UI
   - Brevo: contact/log entries — handle in Brevo dashboard
4. **Execute by request type**:
   - **Acceso**: export the rows above and send as a document.
   - **Rectificación**: UPDATE the incorrect fields (Postgres via cf-admin or SQL).
   - **Cancelación**: DELETE bookings/pets/messages for the requester.
     ⚠️ Do NOT delete `consent_records` — legal evidence; the FK is SET NULL so
     booking deletion never cascades into consent history. Note the retention
     basis in the response instead.
   - **Oposición**: mark and stop the relevant processing (e.g. delete the
     PostHog profile, remove from any mailing use).
5. **Close out**: set `legal_requests.status` to `RESOLVED`, reply to the
   requester with what was done, and keep the reply (it becomes part of the
   evidence trail).
6. **Document retention**: delete the identity document from R2 once identity
   verification is complete — it has no further purpose
   (`wrangler r2 object delete arco-documents/<key>`).

## Escalation

Anything ambiguous (partial deletion requests, disputes about consent records,
requests on behalf of another person) → hold the clock position, consult
counsel, and answer within the window even if the answer is "we need X to
proceed."

{% endraw %}
