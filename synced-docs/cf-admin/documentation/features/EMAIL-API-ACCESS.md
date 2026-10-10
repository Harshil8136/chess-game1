---
title: "Email API page (overview, tokens, activity, templates and settings)"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-02
verified_against: [code]
owner: harshil
related_code: [src/lib/auth/routes.ts, src/pages/dashboard/email-api/[...section].astro, src/components/admin/email-api/EmailApiPage.tsx, src/lib/email-api-section.ts, migrations/0062_email_api_page.sql, src/lib/auth/guard.ts, src/lib/email/sender-identities.ts, migrations/0061_email_sender_identities_seed.sql, src/lib/email-console.ts, src/lib/email-console-types.ts, src/lib/email-api-route.ts, src/lib/auth/surface-guards.ts, src/pages/api/emails/api-tokens.ts, src/pages/api/emails/api-activity.ts, src/pages/api/emails/api-messages.ts, src/pages/api/emails/api-settings.ts, src/pages/api/emails/api-overview.ts, src/pages/api/emails/api-templates.ts, src/components/admin/emails/api-access/ApiAccessView.tsx, src/components/admin/emails/api-access/ApiOverviewPanel.tsx, src/components/admin/emails/api-access/ApiActivityPanel.tsx, src/components/admin/emails/api-access/ApiTemplatesPanel.tsx, src/components/admin/emails/api-access/ApiTemplateEditor.tsx, src/components/admin/emails/api-access/ApiSettingsPanel.tsx, src/pages/dashboard/emails/[...section].astro, migrations/0060_email_api_access_pages.sql, wrangler.toml]
related_docs: [EMAIL-PORTAL.md, VPS-CONSOLE.md, ../architecture/PERMISSIONS-SYSTEM.md, ../operations/OPERATIONS.md]
tags: [emails, api, tokens, plac, service-binding, audit]
---

# Email API page

> **TL;DR (non-technical):** **Email API** is its own page in the sidebar, under
> Tools next to the Email Portal (until 2026-10-02 it was the portal's API Access
> tab). It manages the API tokens that let an app send email through the hotel's
> email service: create a token, choose what it may do, cap how much it can send,
> give it an expiry date, block it in one click, delete it, and watch everything it
> sent. Since 2026-10-10 it also holds **templates**: an email written once, in
> Spanish and English, with blanks an app fills in when it sends it by id. Admins can see the page and stop a token or pause the API; reading guests'
> addresses and messages, creating or widening tokens, and changing the limits stay
> with the owner unless the owner grants them. The tokens and their log live in the
> email service, not in this portal; the portal is the control panel, and every
> change is recorded in the activity log.

## 1. Scope

What this covers: the **Email API** page (`/dashboard/email-api`), the six
routes behind it, the five permissions that gate it, and the one service binding
it needs. What it does not cover: the public API itself (how an app sends email
with a token), which belongs to the email service. Its contract is the
`docs/specs/2026-09-30-api-access-contract.md` document in the cf-email-consumer
repository, and its client reference is that repository's `docs/reference/API.md`.

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
  same `caps` again and refuses a call the route should not have made. The finer
  rules live only in the Console, because only it holds the stored values: whether
  an edit widens a token, whether a settings change is a pause, and what a person
  without Read mail may see of a message (cf-email-consumer, API contract section 5).
- **The secret is shown once.** The create response is the only place a token's
  secret ever appears; it is not stored, logged, audited or returned again. Only a
  SHA-256 of it is kept, so a leaked database does not leak tokens.
- **Blocking is instant.** The public API reads the token row on every request
  (no cache), so a block, an expiry or a delete applies to the very next call.
- **No accepted message is left behind** (2026-10-10). When the email queue refuses a
  message the API has just accepted, the API keeps it `queued`. cf-admin's scheduled
  job `email-api-sweep` asks the Console to hand such messages over again, as a system
  actor with no person and no permission (`sweepEmailApi` in `src/lib/email-console.ts`;
  [`CRON-CONTROL.md`](CRON-CONTROL.md) §3b). Each sweep that finds something shows in
  the activity trail as **Stuck messages re-queued**.
- **Recipients can report a message** (2026-10-10). Every API email ends with a link to
  an "About this email" page on the API's site, where a recipient can report it as
  unexpected, unwanted or fraud. Each report shows in the activity trail as **A
  recipient reported a message**, with the message id, the reason and the token it came
  from (cf-email-consumer `docs/features/EMAIL-API.md`).

## 3. Permissions

The page and four hash-fragment keys under it, registered by
`migrations/0062_email_api_page.sql` (data only) and shown on each person's Access
page. They replaced the Email Portal's three keys of `0060` (`#api-view`,
`#api-manage`, `#api-config`), which that migration deactivates.

| Key | Lets a person | Default |
|---|---|---|
| `/dashboard/email-api` | open the page: tokens (never secrets), limits, delivery status, the request trail and the settings, with recipient addresses masked and subjects and bodies withheld | admins and above |
| `/dashboard/email-api#respond` | reduce exposure: block a token, narrow it (lower limits, remove senders or permissions, an earlier expiry), rename it, pause the API, send a failed message again | admins and above |
| `/dashboard/email-api#read-mail` | see full recipient addresses, subjects and bodies | owner |
| `/dashboard/email-api#manage` | create, rotate, renew, unblock and delete tokens, widen one (a higher limit, another sender or permission, a later or no expiry), switch the API back on | owner |
| `/dashboard/email-api#settings` | default limits for new tokens, recipients per message, the shared daily budget; turn on a Registered Sender's API switch | owner |

The rule behind the split: **reducing exposure is cheap, widening it is
guarded.** Blocking and pausing are the emergency stop and should not wait for the
owner; unblocking, widening and minting a credential should. The owner chose these
defaults on 2026-10-02 and can grant or deny each key to a person. Five keys rather
than the 25 capabilities first proposed: the owner wanted fewer switches to manage.

- **Exact keys, fail closed.** The page and its routes check every key on its
  exact row (`denyEmailApi`, then `placRequireGrant` in `src/lib/auth/guard.ts`):
  a key that is missing or inactive refuses, and nothing resolves through the
  staff-level `/dashboard` row. Until `0062` is applied, and until a person's
  access map is recomputed, only the owner and vendor support (PLAC-exempt) can
  use the page.
- **The Console decides the edge cases.** A token edit needs `#respond` or
  `#manage` at the route; the Console then asks for `#manage` if the edit widens
  the token. A settings change needs any of the three write keys at the route; the
  Console allows `#respond` a pause only, and `#manage` a pause or switching back
  on. Its refusals name the permission as this page labels it.
- **Role floor.** Every route, and the page itself, also requires the
  administrator tier or above, so a per-person override cannot hand token
  management to a manager or staff.
- **No re-sign-in.** Unlike Backups and Server, nothing here asks for a sign-in
  from the last 10 minutes (the owner's choice, 2026-10-02).
- **Nothing new at sign-in.** The five rows join every person's access map, which
  sign-in already computes in one database query, and nothing in this feature
  writes to KV.
- The page hides the buttons the person cannot use; the routes and the Console are
  what actually enforce it.

## 4. Routes

All under `/api/emails/`: the routes kept their paths when the view moved, and
`API_PAGE_MAPPING` (`src/lib/auth/routes.ts`) now gates each of them on the Email
API page rather than the Email Portal, so the API does not depend on portal
access. Each route then checks the page key exactly and its action keys. Every
mutation writes an `admin_audit_log` row (module `emails`).

| Route | Verb | Key | Audit |
|---|---|---|---|
| `api-tokens` | GET | the page | none |
| `api-tokens` | POST (create; returns the secret) | `#manage` | `create`, target `email_api_token` |
| `api-tokens` | PATCH (edit, block, unblock) | `#respond` or `#manage`; the Console asks `#manage` for a widening | `update`, reason recorded when blocking |
| `api-tokens` | PATCH `{ id, rotate: true }` | `#manage` | `update`, never the secret |
| `api-tokens` | DELETE `?id=` | `#manage` | `delete` |
| `api-activity` | GET (filters: token, status, paging) | the page; full addresses and subjects need `#read-mail` | none |
| `api-messages` | GET `?id=` / POST (re-queue) | the page (bodies need `#read-mail`) / `#respond` or `#manage` | `update`, target `email_api_message` |
| `api-settings` | GET / PUT | the page / `#respond`, `#manage` or `#settings`, then the Console's rule | `config_change` (keys only, never the addresses) |
| `api-overview` | GET | the page | none |
| `api-templates` | GET (the list, `?archived=1` with archived ones; `?id=` one template with its versions) | the page | none |
| `api-templates` | POST `?preview=1` (fill a template with values; sends and stores nothing) | the page | none |
| `api-templates` | POST (create) / PUT (save a draft) | `#manage` | `create` / `update`, target `email_api_template` |
| `api-templates` | PATCH `{ id, action: publish \| archive \| restore, version? }` | `#manage` | `update`, with the version published |

Audit `context` keys never contain the word "token" as a whole segment
(`isSensitiveKey` would redact them); the token's name is in the row's target
label instead.

## 4b. Senders and the shared budget (2026-10-01)

- **Senders come from Email Settings > Registered Senders.** A sender whose **API** switch is on (and that is Active) may be given to a token, if the person creating the token meets the sender's required role. Turning the switch on needs `/dashboard/email-api#settings`; turning it off, deactivating or deleting a sender needs no extra right. The Email API's Settings section lists **every** Registered Sender as it is now (read live from `admin_portal_settings` by `GET /api/emails/api-settings`, answered as `registered`), each marked **Tokens may use**, **API switch off** or **Sender off**, with a link to Registered Senders (since 2026-10-10; before, it showed only the email service's copy of the switched-on ones). The same answer's `copy_in_sync` says whether the email service's copy matches, and the section says so when it does not.
- **The email service keeps a copy** (its `api_sender_identities` policy row). `src/lib/email/sender-identities.ts` pushes it over `EMAIL_CONSOLE` (`PUT /admin/senders`) whenever the API-enabled set changes; `GET /api/emails/api-settings` re-syncs it when it differs, unless the push would add a sender and the person lacks `#settings` (the Console would refuse it). A failed push is reported and shown (`apiSync` in the senders response); the email consumer re-reads the live row before every API send, so a stale copy can never let mail out from a sender that was switched off.
- **Shared daily budget** (`api_daily_budget`, default 150 recipients a day for all tokens together, 0 to 250): keeps the provider's 300 a day for hotel mail. Over it, the API answers 429 `api_budget_reached`.

## 4c. Layout, addresses and token actions (2026-10-01)

- **Addresses** (since 2026-10-02, five sections since 2026-10-10; `src/lib/email-api-section.ts`, page `src/pages/dashboard/email-api/[...section].astro`): `/dashboard/email-api` (Overview), `/dashboard/email-api/tokens` and `/dashboard/email-api/tokens/<id>` (one token's panel), `/dashboard/email-api/activity`, `/dashboard/email-api/templates`, `/dashboard/email-api/templates/new` and `/dashboard/email-api/templates/<tpl id>` (the editor), and `/dashboard/email-api/settings`. Back and Forward work; an unknown path is a 404. The Email Portal's old addresses (`/dashboard/emails/api`, `/dashboard/emails/api/<tab>`, `/dashboard/emails/api/tokens/<id>`) answer with a permanent redirect to the same section here.
- **The page around the view** (`src/components/admin/email-api/EmailApiPage.tsx`): a title, the address of each section, notices, and the provider's daily figure for the Settings capacity card (`/api/emails/quota`, fetched when Settings is first opened; without Email Portal access the card shows the API's own figures only).
- **Masked messages.** Without `#read-mail` the activity list and the message panel show `j•••@example.com`, "(subject hidden)" and no body, with a line saying which permission would show them.
- **Layout** (remade 2026-10-10, the console style of Server and Backups). One row of five sections that scrolls sideways on a phone (Overview, Tokens, Activity, Templates, Settings), a status strip and a refresh button; Create token shows on Tokens. Everything is in the main area: there is no side column any more.
  - **Overview:** six tiles (the API on or paused, active tokens, the last 24 hours, failed, stuck, templates live), the latest activity and the quick start (address, a copyable request, the reference).
  - **Activity:** one timeline, newest first, of every message the API accepted and every change to tokens, settings and templates (`buildTimeline` in `api-access-model.ts`). Filters: Everything, Messages, Changes or Problems, then a token and a message status. Until the first message is sent it says so, with a link to the quick start, and still shows the changes. Before 2026-10-10 the changes sat in the side column and the main list showed messages only, so with no message sent yet the page looked empty.
- **Token panel** (`ApiTokenDrawer.tsx`): permissions, limits and use, lifetime, latest messages and history, and every action: edit, renew for 90 days (expired or expiring within a week), rotate the secret, block or unblock, delete.
- **Rotate** (`PATCH /api/emails/api-tokens` with `{ id, rotate: true }`, Console `POST /admin/tokens/<id>/rotate`): the same token gets a new secret, shown once; the old one is refused from the next request. Audited as an update; the secret is never audited or logged.

## 4d. Templates (2026-10-10)

- **What they are.** An email written once, in Spanish, English or both, with blanks such as `{{guest_name}}`. An app sends it with `template_id` and the values (`variables`) instead of a subject and body; the email service fills it, escaping every value, and sends it like any other message. The syntax, the eight value types and the public side are cf-email-consumer's (`docs/features/EMAIL-API.md`, the Templates guide on the API's site).
- **Where they live.** In the email service's own database (`templates` and `template_versions`, cf-email-consumer migration `0004`), reached through the Console like everything else here; cf-admin stores nothing.
- **Drafts, versions, publish.** Every save is a new numbered version. Only the **published** version is ever sent, and a published version never changes, so an edit cannot alter mail already going out. Publishing an older version goes back to it. A template is archived, never deleted; an archived one is refused until it is restored.
- **The editor** (`ApiTemplateEditor.tsx`): name, id (`tpl_` and 2 to 60 of a-z, 0-9 or _, fixed once created), description; the variables with type, required and an example; one tab per language with subject, HTML and text; a preview with editable example values, filled and cleaned by the content check exactly as a send would be, in a sandboxed frame; the versions with **Go back to this**; Save draft, Publish, Archive and Restore; and a copyable request that sends it. Names the content uses but the form does not declare are offered with one **Add them** button.
- **Who may do what.** Reading and previewing need the page; creating, saving, publishing, archiving and restoring need `#manage`. No new permission: Manage tokens already decides what the API may send.
- **Before the email service is updated.** An email service from before templates answers "No such route." for them; the route turns that into 503 "Templates need the latest email service, which is not deployed yet", shown in the Templates section while the rest of the page works.

## 5. Failure modes

| What happens | What the person sees |
|---|---|
| no `EMAIL_CONSOLE` binding (local dev) | 503 "not connected" banner on the page; nothing else affected |
| the service is down or slow | 502 or 504, reported to Sentry (`emails.api_console`), banner on the page |
| the Console refuses (invalid field, conflict, not found, a missing permission) | its message, and the field it named, in the dialog |
| `0062` is not applied yet | no sidebar link; the page and its routes refuse everyone but the owner and vendor support |
| `cf-email-api` still runs a build from before templates (2026-10-10) | the Templates section says the email service needs its update; everything else works |
| `cf-email-api` still runs the build from before 2026-10-02 | it reads the old key names cf-admin derives from the new ones (`userActor` in `src/lib/email-console.ts`): the owner keeps full use, and a person without Read mail or Manage tokens is refused until it is redeployed |

The portal's own email sending is not affected by any of these: it does not go
through the API or this binding.

## 6. Deploy order

Either repository can deploy first: the Console reads the old key names when no
new one is sent, and cf-admin sends both.

1. **cf-email-consumer:** the push to `main` deploys `cf-email-api` once its
   Workers Builds connection exists (until then, `npm run deploy:api`).
2. **cf-admin:** the push deploys the code, but not the migration (RULESAd §12):
   run `npm run release` to apply `0062`. Until then the page refuses everyone but
   the owner and vendor support, and the sidebar has no link (the owner can open
   `/dashboard/email-api` directly).

## 7. Key code paths

- the page and its addresses: `src/pages/dashboard/email-api/[...section].astro`, `src/components/admin/email-api/EmailApiPage.tsx`, `src/lib/email-api-section.ts`
- gate and grants: `src/lib/auth/surface-guards.ts` (`denyEmailApi`, `emailApiCaps`), on `placRequireGrant` in `src/lib/auth/guard.ts` (exact keys)
- the client and its typed errors: `src/lib/email-console.ts`; shapes: `src/lib/email-console-types.ts`
- shared route helpers (gate, audit, body reader): `src/lib/email-api-route.ts`
- the view: `src/components/admin/emails/api-access/ApiAccessView.tsx` (the five sections; `ApiOverviewPanel.tsx`, `ApiActivityPanel.tsx`, `ApiTemplatesPanel.tsx`, `ApiTemplateEditor.tsx`, `ApiSettingsPanel.tsx`), its data hook `useApiAccess.ts` and its pure model `api-access-model.ts` (the timeline, the template form)
- tests: `test/email-console.test.ts`, `test/email-api-routes.test.ts`, `test/email-api-access-model.test.ts`, `test/email-section.test.ts` (both pages' addresses and the redirect), `test/guard-plac.test.ts` (exact keys), the page rows in `test/migrations-replay.test.ts`, the binding pin in `test/worker-entry-contract.test.ts`

## Verification log

- 2026-09-30: written with the feature; the route, client and model tests above pass, and the three page rows are asserted by the migration replay test.
- 2026-09-30, live: the first look at the page (a screenshot) showed the Settings view squeezed into a 64px column. `max-w-3xl` had resolved to `var(--spacing-3xl)` because the design system's `--spacing-*` steps were declared in `@theme`, where Tailwind v4 reads them as sizes. Fixed at the source (the steps moved to a plain `:root` block, which also repairs 20 other elements across the admin) and pinned by `test/theme-tokens.test.ts`; the form itself also uses `max-w-[48rem]`. The same day the backend door passed 24 of 24 checks over a remote service binding and the public API 23 of 23 against production (`npm run smoke:api` in cf-email-consumer).
- 2026-10-02: the view moved to its own page with five permissions (owner's decisions of 2026-10-02 in the research spec's section 9). Checked against the code and its tests (`npm run verify`), and against live D1: no overrides held the three old keys, and `0061` was the last migration applied. Not yet seen in a browser.
- 2026-10-10: the sweep's system actor and the **Stuck messages re-queued** event title checked against `src/lib/email-console.ts`, `api-access-model.ts` and `test/email-api-sweep.test.ts`. Not re-checked: the rest of the page.
- 2026-10-10: the page remade into five sections, the unified Activity timeline, Templates and the live Registered Senders on Settings, checked against the code and its tests (`test/email-api-routes.test.ts`, `test/email-api-access-model.test.ts`, `test/email-section.test.ts`, `test/api-authz-mapping.test.ts`) and `npm run verify`; live D1 (`madagascar-email-db`) read through the Cloudflare connector showed 0 API messages, 7 events and 1 token, which is why Activity looked empty before. Not checked: the page in a browser, and the template routes against the live email service, which still runs its build of 2026-10-02.
- 2026-10-10: the **A recipient reported a message** title checked against `api-access-model.ts` and its test. Not re-checked: the rest of the page.
