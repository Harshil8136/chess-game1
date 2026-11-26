---
title: "@oltrem/mail: Using it; The Cloudflare route; Records on Cloudflare; Routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src; split from modules/mail/README.md]
---

# @oltrem/mail: Using it; The Cloudflare route; Records on Cloudflare; Routes

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
|---|---|
| Needs | the `mail` part on, the `send_email` binding, the portal's Cloudflare key and the account; the setup page lists what is missing |
| Email Routing | `POST /api/mail/cloudflare/setup` finds the domain's zone (walking up from a subdomain), refuses while the domain receives mail at another provider's MX unless `replaceMx`, and turns Routing on; a 403 answers with the one tap in the dashboard |
| Staff | `POST /api/mail/cloudflare/staff` asks Cloudflare to verify the named addresses, or every person of the portal not verified yet (200 for the account at most); each person presses Cloudflare's link once; the state is read back by Check again and by the job |
| Sending | onboarding a domain for Email Sending has no API, so it is a dashboard tap; the test (`POST /api/mail/cloudflare/test`) tells the states apart and the route sends nothing until a test passed |
| Mode | Paid only when the plan setting says Workers Paid, Free otherwise; a change of plan asks for the test again |
| What it takes | never bulk mail; every recipient a verified staff address, or in Paid mode anyone while `mail.cloudflare_first` is on; from the route's own address unless the message's From is on its domain (the original From becomes the reply address); a message from an address someone picked on another domain is left to its provider |
| Its answers | sorted into email's one list by `cloudflareFailure` (`src/routes.ts`): a refusal for that message, a setup problem, a throttle or a day used up let the providers try; a receiving server's refusal fails the message; Cloudflare's server error or a code it does not know pins the message to Cloudflare (mail law M-1), and since the binding takes no message key it is not asked again: the message reads "May have been sent" |
| Stopping | `DELETE /api/mail/cloudflare` forgets the route here; Email Routing and the verified addresses stay in Cloudflare |

## Records on Cloudflare

The records an email provider asks for on a sending domain are written in its Cloudflare zone
with the portal's key, so nobody types them at a DNS host. The provider card does it in the same
press (email's route taker calls `records`); Mail setup lists each domain with records still
missing, with **Write them** (`POST /api/mail/records`). The rule is only to add (`src/records.ts`):

| At the name | What the portal does |
|---|---|
| The record is there (quoted or not, any case) | leaves it |
| Nothing in its way | adds it, not proxied, with the comment "Added by the portal for email" |
| An SPF record already | never a second one: says which `include:` to add to the one there |
| Another mail server (MX) | never replaced, in words |
| A CNAME, or a CNAME wanted beside anything | left to a person, in words |
| A DMARC record already, here or above | kept; none is written under a parent's policy, even when the provider offers one, so a stricter policy above is never weakened (`wantedOf` in `@oltrem/email`); with none anywhere, the provider's own DMARC record, else `v=DMARC1; p=none` |
| A new SPF record past 10 DNS lookups | not written, with the advice to use a subdomain |

A name outside the zone, a key that may not read or add records (403, "make the key again with
Zone, DNS, Edit") and any other refusal are said per record. At most 12 records a press. Each
press is one audit row, `mail.records`, naming every record added; the domain is checked again
after one was added.

The route keeps its id, `cloudflare`, on each message's row where a provider instance's id would
go, so Sent and the counts show it. It reads Cloudflare's answer only through the binding's
error codes (`CLOUDFLARE_CODES` in `src/routes.ts`, read against Cloudflare's list again on
2026-11-20: a domain whose Email Sending is not configured or not ready, and an account plan that
sends to verified addresses only, are setup answers, so the next route sends); Cloudflare's
delivery events are not wired yet.

## Routes

Every `mail.manage` route asks for the permission at the company itself, as the pages' buttons do
(`may.manage`): the kit's route check alone found it held anywhere, and a person who held it at one
location only could change the whole company's mail. The routes are marked `company` and the kit
makes the check ("needed for the whole company").

| Route | Capability | What it does |
|---|---|---|
| `GET /api/mail/cloudflare` | `mail.read` | the route as it stands: needs, line, mode, plan, staff, sent today, `main` (the portal's main address, name and domain, from the settings `email.from_address` and `email.from_name`, which the setup form starts from) and `may.manage` |
| `POST /api/mail/cloudflare/setup` | `mail.manage` | turn Email Routing on (`domain`, `subdomain`, `replaceMx`, `local`, `name`) |
| `POST /api/mail/cloudflare/staff` | `mail.manage` | ask Cloudflare to verify staff addresses (`emails`, or everyone waiting) |
| `POST /api/mail/cloudflare/check` | `mail.manage` | read Routing, the plan and each address back |
| `POST /api/mail/cloudflare/test` | `mail.manage` | send the test (`to`, the signed-in person when empty) |
| `DELETE /api/mail/cloudflare` | `mail.manage` | stop sending through Cloudflare |
| `POST /api/mail/records` | `mail.manage` | write a sending domain's missing records on Cloudflare (`domain`), then check it again |
| `GET /api/mail/forwarding` | `mail.read` | forwarding as it stands: each domain (`state`, `was`, `line`, `movable`, `before`, `back`) and each alias (its people with `verified`, `waiting` or `queued`, `state`, `line`, `how`), `mainDomain` (Add a domain starts from it while it is not added yet), and `may.manage` |
| `POST /api/mail/forwarding/domains` | `mail.manage` | add a domain (`domain`): looked up, and Email Routing turned on when it has no MX record |
| `POST /api/mail/forwarding/domains/:domain/check` | `mail.manage` | read it back now, its people's links too, and make the rules left over |
| `DELETE /api/mail/forwarding/domains/:domain` | `mail.manage` | forget a domain with no alias left |
| `POST /api/mail/forwarding/domains/:domain/move` | `mail.manage` | move it from ImprovMX to Cloudflare (setup.md section 5); `KIT-E-4009` until it may |
| `POST /api/mail/forwarding/domains/:domain/back` | `mail.manage` | move it back to ImprovMX |
| `POST /api/mail/forwarding/aliases` | `mail.manage` | forward an address (`address`, `*@` and the domain for the catch-all) to `forwardTo` (1 to 10) |
| `PATCH /api/mail/forwarding/aliases/:id` | `mail.manage` | change its people (`forwardTo`) or switch it off and on (`live`) |
| `DELETE /api/mail/forwarding/aliases/:id` | `mail.manage` | delete it and its rule |
| `POST /api/mail/forwarding/import` | `mail.manage` | take pasted aliases (`text`, ImprovMX's export or one a line; `domain` for lines without one), 500 at a time: `added`, `changed`, `same`, `skipped` with why |
| `GET /api/mail/try` | `mail.read` | `{ local }`: whether Send a test is offered, true only on the builder's own computer |
| `POST /api/mail/try` | `mail.manage` | on the builder's own computer only (404 elsewhere): a test message to `to` (from `from`, or someone@example.org) handed to the Worker as Email Routing would; `went` is `forwarded` (with `forwardedTo`), `kept` or `refused`, with words. Nothing leaves the computer |
| `POST /api/mail/forwarding/import/improvmx` | `mail.manage` | read every alias of the ImprovMX account (`key`, used for this press only and never kept; `domain` for one only), 12 ImprovMX calls a press, and take them as the paste does |
| `GET /api/mail/forwarding/improvmx` | `mail.read` | since 2026-11-12 (`src/improvmx.ts`): `{ connected: false, offered }` before a key, else the account (`email`, `plan`, `premium`), its domains (`forwarding`, `rules`, `aliases` with `forwardTo` and `webhooks`, `more`, `problem`), the domains past the 8 read (`more`) and `problem`, read from ImprovMX in 10 calls at most; and `may.manage` |
| `POST /api/mail/forwarding/improvmx` | `mail.manage` | keep the account's key (`key`): tried on the account first, kept sealed by the providers registry (`improvmx`, kind `forwarding`) only when ImprovMX takes it; a new key replaces the one kept |
| `DELETE /api/mail/forwarding/improvmx` | `mail.manage` | forget the key; the aliases stay at ImprovMX |
| `POST /api/mail/forwarding/improvmx/domains` | `mail.manage` | add a domain (`domain`) to the ImprovMX account |
| `POST /api/mail/forwarding/improvmx/domains/:domain/records` | `mail.manage` | ImprovMX checks the domain's records now: `{ domain, valid, lines: [{ record, expected, found, valid }], words }` |
| `GET /api/mail/forwarding/improvmx/domains/:domain/logs` | `mail.read` | the newest 20 messages ImprovMX forwarded or tried: `at`, `from`, `to`, `forward`, `subject`, `status`, `words` |
| `POST`, `PATCH`, `DELETE /api/mail/forwarding/improvmx/domains/:domain/aliases[/:id]` | `mail.manage` | add an alias (`alias`, `*` for every other address; `forwardTo`, 1 to 10), change its people, delete it, at ImprovMX; each audited by its address, never the key, and none wakes the five-minute job |

Each step answers `{ ok, words, dashboard? }`: what happened in plain words, and the dashboard step
when the portal's key may not do it. When Cloudflare does not accept the key at all (a 401, or its
codes 6003, 6111, 9106, 9109, 10000 or 10001, which come on a 400 as often), the words say so and
name the fix, a new `KIT_OPS_TOKEN` or forwarding through ImprovMX, instead of only Cloudflare's
"Invalid request headers". Every call to Cloudflare's API or ImprovMX's is waited for 15 seconds at
most (`CALL_MS`, 2026-11-20): one that hangs answers that the service did not answer, instead of
holding the page.
