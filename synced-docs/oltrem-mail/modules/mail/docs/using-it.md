---
title: "@oltrem/mail: using it, the Cloudflare route, records, routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src/module.ts, cloudflare.ts, records.ts, routes.ts, forwarding.ts, improvmx.ts]
---

# @oltrem/mail: using it, the Cloudflare route, records, routes

> Part of [the @oltrem/mail README](../README.md).

## Using it

```ts
import type { MailAddon } from '@oltrem/email';
import { createMail } from '@oltrem/mail';
import { pages as mailPages } from '@oltrem/mail/pages';

let mail: MailAddon<Env> | undefined;
const email = createEmail<Env>({ /* ... */ route: () => mail?.route });
mail = createMail<Env>({
  email, bindings, on, settings, binding, token, account, plan, index, report,
  bucket: (env) => env.FILES, // the portal's one bucket: the inbox's stored copies
  worker: () => WORKER_NAME, // the name in the client's wrangler file: each mailbox's rule sends here
  local: (env) => !env.ACCESS_AUD, // optional: on the builder's computer, mailboxes without Email Routing
});
// mount withPages(mail.module, mailPages) beside email.module

export default {
  fetch: app.fetch,
  // Mail to an alias or a mailbox; without the add-on, every address is refused.
  email: (message, env, ctx) =>
    mail ? mail.receive(message, env, ctx) : message.setReject('Unknown recipient'),
};
```

docs/kit-contract.md says what each dependency is and how the kit wires them.

## The Cloudflare route

| Step | What happens |
| --- | --- |
| Needs | The `mail` part on, the `send_email` binding, the portal's Cloudflare key and account; the page lists what is missing |
| Email Routing | `POST /api/mail/cloudflare/setup` finds the zone (walking up from a subdomain), refuses while another provider's MX receives unless `replaceMx`, and turns Routing on; a 403 names the dashboard tap |
| Staff | `POST /api/mail/cloudflare/staff` asks Cloudflare to verify the named addresses, or everyone not yet (200 an account); each presses Cloudflare's link once |
| Sending | Onboarding a domain for Email Sending is a dashboard tap (no API); the test (`POST /api/mail/cloudflare/test`) tells the states apart, and nothing goes until it passes |
| Mode | Paid only when the plan setting says Workers Paid; a plan change asks for the test again |
| What it takes | Never bulk mail (M-2); every recipient a verified staff address, or in Paid mode anyone while `mail.cloudflare_first` is on; from its own address unless the From is on its domain (the original From becomes the reply address); a From picked on another domain is left to its provider |
| Its answers | Sorted by `cloudflareFailure` (`src/routes.ts`, `CLOUDFLARE_CODES`): a refusal, setup problem (Sending not ready, a verified-only plan), throttle or used-up day lets the providers try; a receiving server's refusal fails the message; a server error or unknown code pins it (M-1), and since the binding takes no key it reads "May have been sent" |
| Stopping | `DELETE /api/mail/cloudflare` forgets it here; Routing and verified addresses stay in Cloudflare |

The route's id, `cloudflare`, goes on each message's row in place of an instance id. Cloudflare's
delivery events are not wired yet.

## Records on Cloudflare

A provider's records for a sending domain are written in its zone with the portal's key: in the
provider card's press (email's route taker calls `records`), or **Write them** on Mail setup (`POST
/api/mail/records`). Only ever added (`src/records.ts`):

| At the name | What the portal does |
| --- | --- |
| The record is there | Leaves it |
| Nothing in the way | Adds it, not proxied, commented "Added by the portal for email" |
| An SPF record | Never a second: names the `include:` to add |
| Another MX, or a CNAME | Never touched, in words |
| A DMARC record here or above | Kept, never weakened (`wantedOf` in `@oltrem/email`); with none, the provider's, else `v=DMARC1; p=none` |
| A new SPF past 10 lookups | Not written; use a subdomain |

A name outside the zone or a refused key ("make the key again with Zone, DNS, Edit") is said per
record. 12 records a press, one audit row (`mail.records`), the domain checked again after.

## Routes

Every `mail.manage` route needs it at the company itself (`company`).

| Route | Capability | What it does |
| --- | --- | --- |
| `GET /api/mail/cloudflare` | `mail.read` | Needs, line, mode, plan, staff, sent today, `main` (from `email.from_address` and `email.from_name`), `may.manage` |
| `POST /api/mail/cloudflare/setup` | `mail.manage` | Routing on (`domain`, `subdomain`, `replaceMx`, `local`, `name`) |
| `POST /api/mail/cloudflare/staff` | `mail.manage` | Verify staff (`emails`, or everyone waiting) |
| `POST /api/mail/cloudflare/check` | `mail.manage` | Read Routing, the plan and each address back |
| `POST /api/mail/cloudflare/test` | `mail.manage` | The test (`to`, else oneself) |
| `DELETE /api/mail/cloudflare` | `mail.manage` | Stop sending through Cloudflare |
| `POST /api/mail/records` | `mail.manage` | Write a domain's missing records (`domain`) |
| `GET /api/mail/forwarding` | `mail.read` | Each domain (`state`, `was`, `line`, `movable`, `before`, `back`), each alias (people `verified`, `waiting` or `queued`), `mainDomain`, `may.manage` |
| `POST /api/mail/forwarding/domains` | `mail.manage` | Add (`domain`); Routing on when it has no MX |
| `POST /api/mail/forwarding/domains/:domain/check` | `mail.manage` | Read back now, links too; make missing rules |
| `DELETE /api/mail/forwarding/domains/:domain` | `mail.manage` | Forget one with no alias |
| `POST /api/mail/forwarding/domains/:domain/move`, `/back` | `mail.manage` | From ImprovMX to Cloudflare (`KIT-E-4009` until it may), and back |
| `POST /api/mail/forwarding/aliases` | `mail.manage` | Forward `address` (`*@` for the catch-all) to `forwardTo` (1 to 10) |
| `PATCH`, `DELETE /api/mail/forwarding/aliases/:id` | `mail.manage` | Change people or `live`; delete with its rule |
| `POST /api/mail/forwarding/import` | `mail.manage` | Pasted aliases (`text`, `domain`), 500 at a time: `added`, `changed`, `same`, `skipped` |
| `POST /api/mail/forwarding/import/improvmx` | `mail.manage` | Every alias of the account (`key`, never kept; `domain`), 12 calls a press |
| `GET /api/mail/forwarding/improvmx` | `mail.read` | `{ connected: false, offered }`, else the account, its first 8 domains with aliases and `more`, 10 calls at most |
| `POST`, `DELETE /api/mail/forwarding/improvmx` | `mail.manage` | Keep the key (tried first, sealed as `improvmx`, kind `forwarding`); forget it |
| `POST /api/mail/forwarding/improvmx/domains` | `mail.manage` | Add a domain at ImprovMX |
| `POST /api/mail/forwarding/improvmx/domains/:domain/records` | `mail.manage` | ImprovMX checks its records: `{ valid, lines, words }` |
| `GET /api/mail/forwarding/improvmx/domains/:domain/logs` | `mail.read` | The newest 20 messages forwarded or tried |
| `POST`, `PATCH`, `DELETE /api/mail/forwarding/improvmx/domains/:domain/aliases[/:id]` | `mail.manage` | Aliases at ImprovMX (`alias`, `*`; `forwardTo` 1 to 10), audited by address |
| `GET`, `POST /api/mail/try` | `mail.read`; `mail.manage` | On the builder's computer only (404 elsewhere): a test handed to the Worker as Email Routing would; `went` is `forwarded`, `kept` or `refused` |

The inbox's routes are in [the inbox](inbox.md). Each step answers `{ ok, words, dashboard? }`. A
key Cloudflare does not accept (401, or codes 6003, 6111, 9106, 9109, 10000, 10001) is named with
the fix: a new `KIT_OPS_TOKEN`, or forwarding through ImprovMX. Each call to Cloudflare or ImprovMX
waits `CALL_MS` (15 s) at most.
