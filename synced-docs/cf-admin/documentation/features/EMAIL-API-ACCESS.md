---
title: "Email API Access (tokens, activity and settings)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-01
verified_against: [code]
owner: harshil
related_code: [src/lib/email/sender-identities.ts, migrations/0061_email_sender_identities_seed.sql, src/lib/email-console.ts, src/lib/email-console-types.ts, src/lib/email-api-route.ts, src/lib/auth/surface-guards.ts, src/pages/api/emails/api-tokens.ts, src/pages/api/emails/api-activity.ts, src/pages/api/emails/api-messages.ts, src/pages/api/emails/api-settings.ts, src/pages/api/emails/api-overview.ts, src/components/admin/emails/api-access/ApiAccessView.tsx, src/pages/dashboard/emails/index.astro, migrations/0060_email_api_access_pages.sql, wrangler.toml]
related_docs: [EMAIL-PORTAL.md, VPS-CONSOLE.md, ../architecture/PERMISSIONS-SYSTEM.md, ../operations/OPERATIONS.md]
tags: [emails, api, tokens, plac, service-binding, audit]
---

# Email API Access

> **TL;DR (non-technical):** The Email Portal has an **API Access** tab. Owners
> (and anyone the owner grants it to) can create API tokens that let an app send
> email through the hotel's email service, choose what each token may do, cap how
> much it can send, give it an expiry date, block it in one click, delete it, and
> watch everything it sent. The tokens and their log live in the email service,
> not in this portal; the portal is the control panel, and every change is
> recorded in the activity log.

## 1. Scope

What this covers: the **API Access** view inside `/dashboard/emails`, the five
routes behind it, the three permissions that gate it, and the one service binding
it needs. What it does not cover: the public API itself (how an app sends email
with a token), which belongs to the email service. Its contract is the
`docs/specs/2026-09-30-api-access-contract.md` document in the cf-email-consumer
repository, and its client reference is that repository's `docs/API.md`.

## 2. How it works

```
browser ─► /api/emails/api-*  (cf-admin: who may ask, forward, audit)
             └─► EMAIL_CONSOLE service binding ─► cf-email-api `Console` entrypoint ─► madagascar-email-db
```

- cf-admin **never binds the email database**. The tokens (only their hashes are
  stored), limits, the API's message log and its settings live in the email
  service's own D1 (`madagascar-email-db`, owner-approved exception to RULE
  #0.6/#0.9, 2026-09-30). Every read and write is a call through
  `src/lib/email-console.ts`, the one module that talks to the `Console`
  entrypoint of the `cf-email-api` Worker.
- `Console` has no HTTP route, so the `EMAIL_CONSOLE` binding is the only way in.
  That is why it may trust the `x-email-actor` header this module attaches: the
  signed-in person, and the grants cf-admin found for them (`caps`).
- **Authorisation happens twice.** The route checks the person's grants
  (`denyEmailApi` in `src/lib/auth/surface-guards.ts`); the Console checks the
  same `caps` again and refuses a call the route should not have made.
- **The secret is shown once.** The create response is the only place a token's
  secret ever appears; it is not stored, logged, audited or returned again. Only a
  SHA-256 of it is kept, so a leaked database does not leak tokens.
- **Blocking is instant.** The public API reads the token row on every request
  (no cache), so a block, an expiry or a delete applies to the very next call.

## 3. Permissions

Three hash-fragment sub-permissions of `/dashboard/emails`, registered by
`migrations/0060_email_api_access_pages.sql` (data only) and shown on each
person's Access page like the existing nine:

| Key | Lets a person | Default |
|---|---|---|
| `/dashboard/emails#api-view` | see tokens (never secrets), the activity feed, message detail and the settings | owner |
| `/dashboard/emails#api-manage` | create, edit, block, unblock and delete tokens, and re-queue a failed API message | owner |
| `/dashboard/emails#api-config` | switch the API on or off, set defaults, the recipient cap and the shared daily budget; turn on a Registered Sender's API switch | owner |

- **Fail closed.** The routes use `placRequireGrant`: a key the registry does not
  define (the migration not applied yet, or a row deactivated) is refused. Until
  the migration is applied, only the owner and vendor support (PLAC-exempt) can
  use the view.
- **Role floor.** Every route also requires the administrator tier or above, so a
  per-person override cannot hand token management to staff.
- The page (`index.astro`) hides the tab and buttons the person cannot use; the
  routes are what actually enforce it.

## 4. Routes

All under `/api/emails/` (mapped to the Email Portal page by `API_PAGE_MAPPING`,
so no new mapping was needed). Every mutation writes an `admin_audit_log` row
(module `emails`).

| Route | Verb | Key | Audit |
|---|---|---|---|
| `api-tokens` | GET | api-view | none |
| `api-tokens` | POST (create; returns the secret) | api-manage | `create`, target `email_api_token` |
| `api-tokens` | PATCH (edit, block, unblock) | api-manage | `update`, reason recorded when blocking |
| `api-tokens` | DELETE `?id=` | api-manage | `delete` |
| `api-activity` | GET (filters: token, status, paging) | api-view | none |
| `api-messages` | GET `?id=` / POST (re-queue) | api-view / api-manage | `update`, target `email_api_message` |
| `api-settings` | GET / PUT | api-view / api-config | `config_change` (keys only, never the addresses) |
| `api-overview` | GET | api-view | none |

Audit `context` keys never contain the word "token" as a whole segment
(`isSensitiveKey` would redact them); the token's name is in the row's target
label instead.

## 4b. Senders and the shared budget (2026-10-01)

- **Senders come from Email Settings > Registered Senders.** A sender whose **API** switch is on (and that is Active) may be given to a token, if the person creating the token meets the sender's required role. Turning the switch on needs `#api-config`; turning it off, deactivating or deleting a sender needs no extra right. The API Settings view lists these senders read-only, with a link.
- **The email service keeps a copy** (its `api_sender_identities` policy row). `src/lib/email/sender-identities.ts` pushes it over `EMAIL_CONSOLE` (`PUT /admin/senders`) whenever the API-enabled set changes; `GET /api/emails/api-settings` re-syncs it when it differs. A failed push is reported and shown (`apiSync` in the senders response); the email consumer re-reads the live row before every API send, so a stale copy can never let mail out from a sender that was switched off.
- **Shared daily budget** (`api_daily_budget`, default 150 recipients a day for all tokens together, 0 to 250): keeps the provider's 300 a day for hotel mail. Over it, the API answers 429 `api_budget_reached`.

## 5. Failure modes

| What happens | What the person sees |
|---|---|
| no `EMAIL_CONSOLE` binding (local dev) | 503 "not connected" banner in the view; nothing else affected |
| the service is down or slow | 502 or 504, reported to Sentry (`emails.api_console`), banner in the view |
| the Console refuses (invalid field, conflict, not found) | its message, and the field it named, in the dialog |
| the migration is not applied | only the owner sees the tab (see section 3) |

The portal's own email sending is not affected by any of these: it does not go
through the API or this binding.

## 6. Deploy order

1. cf-email-consumer: apply the email database migration, deploy the consumer,
   then deploy `cf-email-api` (a binding to a missing Worker fails the cf-admin
   deploy).
2. cf-admin: apply `0060` with the release, then deploy.

## 7. Key code paths

- gate and grants: `src/lib/auth/surface-guards.ts` (`denyEmailApi`, `emailApiCaps`)
- the client and its typed errors: `src/lib/email-console.ts`; shapes: `src/lib/email-console-types.ts`
- shared route helpers (gate, audit, body reader): `src/lib/email-api-route.ts`
- the view: `src/components/admin/emails/api-access/ApiAccessView.tsx` (tokens, activity, settings) and its pure model `api-access-model.ts`
- tests: `test/email-console.test.ts`, `test/email-api-routes.test.ts`, `test/email-api-access-model.test.ts`, the page rows in `test/migrations-replay.test.ts`, the binding pin in `test/worker-entry-contract.test.ts`

## Verification log

- 2026-09-30: written with the feature; the route, client and model tests above pass, and the three page rows are asserted by the migration replay test.
- 2026-09-30, live: the first look at the page (a screenshot) showed the Settings view squeezed into a 64px column. `max-w-3xl` had resolved to `var(--spacing-3xl)` because the design system's `--spacing-*` steps were declared in `@theme`, where Tailwind v4 reads them as sizes. Fixed at the source (the steps moved to a plain `:root` block, which also repairs 20 other elements across the admin) and pinned by `test/theme-tokens.test.ts`; the form itself also uses `max-w-[48rem]`. The same day the backend door passed 24 of 24 checks over a remote service binding and the public API 23 of 23 against production (`npm run smoke:api` in cf-email-consumer).
