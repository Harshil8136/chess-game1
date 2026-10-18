---
title: "Platform kit research: providers as data, detection and credentials"
status: historical
audience: [owner, ai, technical]
last_verified: 2026-10-18
verified_against: [web-sources]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, research, snapshot]
---

> **Research snapshot, read on 2026-10-18.** Written by a research pass for the platform kit plan ([`01-plan.md`](01-plan.md)). Figures carry their source URL and the date read; anything unverified is marked **GAP**. Paths named here describe other repositories or a proposed design, not files in this repository. Kept as a dated record and not updated in place.

# Provider-agnostic integration for a Cloudflare Workers platform kit — research notes

Date: 2026-10-18. Research worker output. Nothing here was verified against the owner's live
accounts; every claim carries its source. Where a fact came from memory rather than a fetched
page it is marked **[unverified]**.

Context: the kit runs on Workers (10 ms CPU/request on Free, 30 s default / 5 min max on Paid;
D1/KV/R2/Queues) and must talk to outside providers without a hand-written integration per
provider. The owner wants "auto capturing sign-in methods, security checks, email provider
detections and change in provider".

Platform limits that shape every decision below
(<https://developers.cloudflare.com/workers/platform/limits/>, read via the Cloudflare docs MCP):

| Limit | Free | Paid |
|---|---|---|
| CPU per request | 10 ms | 5 min (default 30 s) |
| Subrequests per invocation | 50 | 10,000 (configurable to 10 M) |
| Simultaneous outgoing connections | 6 | 6 |
| Env vars + secrets per Worker | 64 | 128 (5 KB each) |
| Cron triggers per account | 5 | 250 |

---

## 1. Email sending

### 1.1 Universal baselines available from a Worker

**SMTP over `cloudflare:sockets`.** Possible, with limits.
- `connect()` returns a TCP socket; `secureTransport: "starttls"` + `startTls()` upgrades to TLS,
  and the docs explicitly name email servers as the use case. **Port 25 is blocked** ("Connections
  to port 25 are prohibited"); 465 and 587 work. Sockets must be created inside a handler, each
  one counts against the 6-connection limit, and Cloudflare IP ranges are unreachable.
  <https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/>
- **worker-mailer** (npm, v1.3.0 published 2026-10-17, MIT, zero deps) is a pure-Workers SMTP
  client: `WorkerMailer.connect({host, port, secure, startTls, credentials, authType:
  'plain'|'login'|'cram-md5'})`, text/HTML/attachments, DSN. Needs `nodejs_compat`. Its README
  restates the port-25 and connection-count limits.
  <https://registry.npmjs.org/worker-mailer>
- **Nodemailer** does not run on Workers as-is (`net.Server` unsupported; a 2026 dev.to post
  reports "Class extends value ... is not a constructor"). The `pg-cloudflare` shim shows the
  adaptation pattern (wrap `connect()`, bundler `workerd` condition) but no Nodemailer equivalent
  exists. <https://developers.cloudflare.com/workers/runtime-apis/nodejs/net/>
- Verdict: SMTP submission (587/465 + AUTH) is the one protocol **every** email provider speaks,
  so it is the correct universal fallback adapter. Cost: a TCP handshake plus TLS per send (keep
  it off the request path: send from a Queue consumer).

**Cloudflare Email Service (`send_email` binding, REST API, SMTP).**
- Status: Email Sending is **Beta**, Workers **Paid only** for arbitrary recipients; Free can only
  send to *verified destination addresses* (max 200 per account), which is always free and
  exempt from quotas. Pricing: 3,000 emails/month included, then $0.35/1,000.
- Content limits: 50 recipients, 5 MiB (25 MiB to verified addresses), 16 KB headers. New
  accounts start on a "conservative daily quota" that grows. Binding restrictions:
  `destination_address`, `allowed_destination_addresses`, `allowed_sender_addresses`.
- Authenticated SMTP submission (beta 2026-06-08): `smtp.mx.cloudflare.net:465`, user
  `api_token`, password = API token with Email Sending: Edit. So Cloudflare itself is reachable
  through the generic SMTP adapter.
- Sources: <https://developers.cloudflare.com/email-service/platform/limits/> ,
  <https://developers.cloudflare.com/email-service/platform/pricing/> ,
  <https://developers.cloudflare.com/email-service/configuration/send-bindings/> ,
  <https://developers.cloudflare.com/changelog/post/2026-06-08-smtp-submission/>

**MailChannels.** The free Workers-only API was terminated (announced for 2024-06-30, EOL notice
2024-08-31). What remains is the paid MailChannels Email API with a 100/day free tier. Not a
baseline any more. <https://support.mailchannels.com/hc/en-us/articles/26814255454093-End-of-Life-Notice-Cloudflare-Workers> ,
<https://blog.mailchannels.com/important-update-mailchannels-email-sending-api-for-cloudflare-workers-to-be-terminated/>

### 1.2 How libraries abstract providers

- **Nodemailer**: a transport is a duck-typed object `{name, version, send(mail, cb)}`; plugins
  hook `compile` and `stream`. Bundled: SMTP, SMTP pool, SES, sendmail, stream, JSON.
  <https://nodemailer.com/transports> , <https://community.nodemailer.com/2-0-0-beta/implementing-plugins>
- **Symfony Mailer**: provider = a DSN string, `scheme+transport://KEY@default` (e.g.
  `brevo+api://KEY@default`, `postmark+api://ID@default`, `sendgrid+smtp://KEY@default`), with
  composable `failover(a b)` and `roundrobin(a b)` DSNs. The *selection* is data; each bridge
  is still code. <https://symfony.com/doc/7.0/mailer.html>
- **Laravel Mail** drivers and **unsend** were not fetched (DNS blocked); same shape
  **[unverified]**.
- Unified-API vendors (Merge, Apideck, Unified.to) ship a normalized schema per category plus
  "raw mode"/passthrough for what the schema loses.
  <https://unified.to/blog/apideck_vs_unified_which_pass_through_unified_api_is_right_for_your_product_in_2026> ,
  <https://www.merge.dev/vs/apideck>

### 1.3 Common denominator vs. what differs

Common to every provider (and to RFC 5322 itself): `from`, `to[]`, `cc[]`, `bcc[]`, `replyTo`,
`subject`, `text`, `html`, `headers{}`, `attachments[{filename, contentType, content}]`,
`messageId` returned.

Differs per provider:

| Capability | Status |
|---|---|
| Idempotency key | Resend: `Idempotency-Key` header, 24 h, payload-checked, batch too (<https://www.resend.com/blog/engineering-idempotency-keys> , <https://resend.com/changelog/batch-idempotency-keys>). Brevo: header, 15–30 min TTL, duplicate → `duplicate_parameter` error (<https://developers.brevo.com/changelog/email-api-now-supports-idempotency>). Mailgun: open feature request, none (<https://feedback.mailgun.com/forums/156243-feature-requests/suggestions/18429739-add-support-for-idempotent-requests-to-the-api>). Postmark/SendGrid: not found. SMTP: never. **The kit must own idempotency** (D1 lease per message key, as cf-email-consumer already does). |
| Templates | Provider-side template IDs with variables (Brevo, Postmark, SendGrid dynamic templates, SES templates) vs. none (Resend sends HTML; SMTP). Rendering locally and sending HTML is the only portable path. |
| Tags / metadata | Resend `tags[]`, Postmark `Tag`+`Metadata`, SendGrid `categories`+`custom_args`, Mailgun `o:tag`+`v:` vars, Brevo `tags`+`params`; SMTP: custom `X-` headers only. |
| Batch | Resend ≤100/call, Brevo batch, SendGrid personalizations; SMTP one message per DATA. |
| Scheduling | Resend `scheduled_at`, Brevo `scheduledAt`, SendGrid `send_at`; most others none. Kit should schedule itself (Queues delay / cron). |
| Attachments | All support; size caps differ (Cloudflare 5 MiB total). |
| Suppression lists | Provider-owned; Cloudflare Email Service has its own suppression API. |

### 1.4 Webhook normalisation

Event vocabulary is near-universal: `sent/accepted`, `delivered`, `deferred`, `bounced`
(hard/soft), `complained` (spam), `opened`, `clicked`, `unsubscribed`, `dropped/rejected`.
Shapes and signatures are not:

| Provider | Payload | Signature |
|---|---|---|
| Resend | one event per POST, via Svix | Svix/Standard-Webhooks HMAC-SHA256 (`svix-id`, `svix-timestamp`, `svix-signature`) |
| SendGrid | JSON **array** per POST (hundreds of events) | ECDSA P-256 over timestamp+body, public key fetched once |
| Mailgun | one event per POST | HMAC-SHA256 over `timestamp`+`token` |
| Amazon SES | via SNS (or EventBridge) | SNS RSA signature (SigVersion 2 = SHA256) against cert at `sns.*.amazonaws.com`; verify TopicArn. <https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html> |
| Postmark | one event per POST | **No HMAC**; Basic-auth in URL, up to 10 custom headers, IP allowlist (Hookdeck guide; Postmark's own page not reachable here) <https://hookdeck.com/webhooks/platforms/guide-to-postmark-webhooks-features-and-best-practices> |
| Brevo, Loops, Mailjet, Plunk | not confirmed in this pass (Plunk < 0.9.0 accepted unsigned SNS payloads, CVE-2026-42193) |

Sources: <https://cli.nylas.com/guides/email-apis-with-webhooks-compared> ,
<https://flaviocopes.com/email-for-developers/>

**Standard Webhooks** (standardwebhooks.com, v1.0.2 of 2026-02-18, Apache-2.0; steering
committee Svix, Zapier, Twilio, Lob, Mux, ngrok, Supabase, Kong; adopters listed include
OpenAI, Anthropic, Google Gemini) fixes the signature scheme: HMAC-SHA256 over
`${webhook-id}.${webhook-timestamp}.${rawBody}`, key = base64-decoded secret after `whsec_`,
header `webhook-signature: v1,<base64>` (space-separated list allows rotation), 5-minute replay
window, verify the *raw* body. Some vendors (AhaSend) use the UTF-8 secret bytes instead of the
decoded form, so the verifier needs a "raw-key" switch.
<https://github.com/standard-webhooks/standard-webhooks> , <https://webhookrelay.com/verify-standard-webhooks-signature/> ,
<https://ahasend.com/docs/api-reference/webhooks/security>

Design consequence: the signature verifier is a small enum of **five** code paths (Standard
Webhooks/Svix HMAC, Mailgun-style HMAC(timestamp+token), ECDSA-with-public-key, SNS RSA,
shared-secret-in-header/basic-auth). The *field mapping* (which JSON path is the event type,
message id, recipient, timestamp, reason) is data (JSONPath per provider).

### 1.5 Detecting the email provider automatically

**DNS from a Worker.** Workers have no `dns` module; use DNS-over-HTTPS JSON:
`GET https://cloudflare-dns.com/dns-query?name=<d>&type=MX` with `Accept: application/dns-json`
(also `one.one.one.one`). Follows Google's JSON schema; `type` numeric or text; TXT data comes
back quoted. Two to five subrequests per domain, well inside Free limits.
<https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/dns-json/> ,
<https://www.npmjs.org/package/cf-doh> (typed wrapper)

**Signals and fingerprints** (compiled from <https://www.captaindns.com/en/tools/email-authentication/dkim-selector-discovery> ,
<https://www.suped.com/learn/dkim/a-list-of-the-most-common-dkim-selectors-and-how-to-use-them> ,
<https://www.suped.com/knowledge/email-deliverability/technical/how-can-i-identify-the-smtp-provider-from-an-mx-record>):

| Signal | Tells you | Patterns |
|---|---|---|
| MX | inbound mailbox host (Google Workspace `aspmx.l.google.com`, M365 `*.mail.protection.outlook.com`, Zoho, Fastmail, Proton, security gateways) | strong for *mailbox* provider, weak for *sending* provider |
| SPF `include:` | who may send | `_spf.google.com`, `spf.protection.outlook.com`, `sendgrid.net`, `spf.brevo.com`/`spf.sendinblue.com`, `amazonses.com`, `mailgun.org`, `spf.mtasv.net` (Postmark), `_spf.resend.com` **[selectors/includes partly from memory; CaptainDNS confirms SES/Brevo/Mailgun/Postmark/SendGrid patterns]** |
| DKIM selector / CNAME target | the ESP | SendGrid `s1`,`s2` → `*.sendgrid.net`; Postmark `<date>pm` → `pm.mtasv.net`; Brevo `mail` (legacy), `brevo1`,`brevo2`; Mailgun `smtp` (old), `pdk1`,`pdk2`; SES random token → `*.dkim.amazonses.com`; M365 `selector1`,`selector2`; Google `google`; Mailchimp `k1-k3`; Resend `resend` **[unverified]**. Selectors are not enumerable, so probe a list and treat "none found" as unknown. The reliable source is the `s=` tag of a real DKIM-Signature header. |
| DMARC `rua=` | who monitors | often the ESP or a DMARC vendor |
| Verification TXT | which providers the domain was onboarded to | `brevo-code=`, `resend._domainkey`, `MS=ms…`, `google-site-verification=` |

Existing libraries: `email-provider` (npm, 2018, MX → freemail list, mailbox providers only),
`email-setup` (SPF presence + DKIM at a known selector), `mailauth` (full DKIM/SPF/DMARC/ARC
verifier, pluggable resolver). None does ESP fingerprinting end-to-end; the kit needs a ~40-row
fingerprint table. <https://npmjs.com/package/email-provider> , <https://npmjs.com/package/email-setup> ,
<https://npmjs.com/package/mailauth>

**Detecting a provider change** (three independent sensors, cheap enough for a cron):
1. Scheduled re-probe (daily cron): hash of {MX, SPF includes, DKIM CNAME targets, DMARC}.
   A changed hash → new suggestion, never an automatic switch.
2. Webhook source drift: a webhook arriving with an unknown signature scheme/headers, or sends
   failing with auth errors, flags "provider changed or key rotated".
3. Inbound mail headers: when the kit receives mail (Email Routing), the `DKIM-Signature s=`/`d=`
   and `Received:` chain of the owner's own outbound test message name the real sender.
Switching is: suggest → owner confirms in the admin UI → adapter row in D1 flips → a canary
send to a verified address proves it → old adapter retained for failover.

---

## 2. Sign-in method auto-capture

### 2.1 Standards that make "no code per IdP" possible
- **OIDC Discovery**: `{issuer}/.well-known/openid-configuration` gives `authorization_endpoint`,
  `token_endpoint`, `jwks_uri`, scopes, PKCE support. Google: `https://accounts.google.com/...`;
  Microsoft: `https://login.microsoftonline.com/{tenant}/v2.0/...`; Okta: `https://{org}.okta.com/...`.
  One generic OIDC client + a row of {issuer, client_id, client_secret} covers every compliant
  IdP. <https://www.authgear.com/post/well-known-openid-configuration/> ,
  <https://backstage.forgerock.com/docs/ig/7/gateway-guide/oidc-discovery.html>
- **WebFinger** (RFC 7033) maps `acct:user@domain` → issuer; defined by OIDC Discovery but
  essentially unused by the big IdPs in practice **[unverified]**.
- **RFC 7591 dynamic client registration**: supported by Keycloak/Authentik-class servers; Google,
  Microsoft and Okta did not surface a public registration endpoint in this research. So client
  credentials must still be typed in by the org admin (data, not code).
- **Google `hd` claim**: present only for Workspace/Cloud-org accounts; Google says use it, not
  the email domain, to restrict by organisation; `hd=` request parameter is only a UI hint.
  <https://developers.google.com/identity/openid-connect/reference>
- **Microsoft realm discovery**: `https://login.microsoftonline.com/getuserrealm.srf?login=user@domain`
  returns `NameSpaceType: Managed|Federated|Unknown` plus `AuthURL` for federated tenants
  (unofficial, documented by OSINT tools). <https://readme.hex.pm/realm_osint_ex/0.2.0>
- **Cloudflare Access** already models IdPs as data: `POST /accounts/{id}/access/identity_providers`
  with `type` ∈ {onetimepin, azureAD, saml, centrify, facebook, github, google-apps, google,
  linkedin, oidc, okta, onelogin, pingone, yandex, cloudflare}; generic `oidc` config =
  {client_id, client_secret, auth_url, token_url, certs_url, pkce_enabled, email_claim_name,
  claims[], scopes[]}; generic `saml` = {sso_target_url, issuer_url, idp_public_certs[],
  sign_request, email_attribute_name, attributes[]}. SCIM sync is optional per IdP. The kit can
  therefore *drive Access* from its own registry instead of implementing OAuth itself.
  <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-oidc/> ,
  <https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/generic-saml/> ,
  <https://developers.cloudflare.com/api/typescript/resources/zero_trust/subresources/identity_providers/methods/list/>

### 2.2 Detecting an organisation's IdP from its email domain

| Signal | Suggests |
|---|---|
| MX `aspmx.l.google.com`, SPF `_spf.google.com`, DKIM `google._domainkey` | Google Workspace → OIDC via accounts.google.com, enforce `hd` |
| MX `*.mail.protection.outlook.com`, CNAME `enterpriseregistration.<d>` → `enterpriseregistration.windows.net`, `autodiscover.<d>` → `autodiscover.outlook.com`, TXT `MS=ms…`, `getuserrealm.srf` → Managed/Federated | Microsoft Entra ID; Federated gives the ADFS/Okta `AuthURL` |
| `getuserrealm` AuthURL or SAML metadata on `*.okta.com` / `*.onelogin.com` / `*.pingone.com` | that IdP; discovery doc at `https://{org}.okta.com/.well-known/openid-configuration` |
| nothing enterprise-looking | consumer accounts → passkeys + email OTP/magic link |

The MX/SPF heuristics are documented by MX-lookup tools (<https://apify.com/junipr/mx-lookup>);
the `enterpriseregistration`/`autodiscover` CNAMEs are standard Entra device-registration
records **[well known but not confirmed by a fetched page in this pass]**. Treat all of this as
a *suggestion* shown to the org admin, who then pastes client credentials.

### 2.3 How products model "org brings its own IdP"
- **WorkOS**: SSO (SAML/OIDC wrapped as one OAuth2 flow), Directory Sync = SCIM 2.0 endpoint +
  webhooks, hosted **Admin Portal** where the customer's IT configures SSO/SCIM and proves domain
  ownership by DNS TXT; portal links valid 5 minutes; `domain_verification` intent; WorkOS does
  not issue end-user sessions. <https://workos.com/docs/domain-verification> ,
  <https://skycloak.io/?p=3455>
- **Clerk**: Enterprise connection is scoped to an Organization; a domain belongs to exactly one
  org; users with that email domain are redirected to the IdP; JIT provisioning on by default;
  supports Okta, Entra, Google, generic SAML (`saml_custom`) and OIDC.
  <https://clerk.com/docs/guides/organizations/sso>
- **Auth0**: Home Realm Discovery maps domains → connections (dashboard or Management API);
  *Organization Discovery by Domain* (GA 2026-04-28) uses verified domains to pick the org and
  only its connections; HRD incompatible with non-unique emails. <https://auth0.com/docs/hrd>
- **Stytch B2B**: `GET /v1/b2b/sso/{organization_id}` lists connections; External SSO
  Connections let one org reuse another's connection while keeping its own JIT/roles.
  <https://stytch.com/docs/api-reference/b2b/api/sso/overview>
- **Better Auth** SSO plugin: `registerSSOProvider({providerId, issuer, domain, oidcConfig |
  samlConfig})`; discovery document fetched and validated automatically; SAML "in active
  development"; CVE-2026-53515 (any org *member* could register a provider, fixed 1.6.11).
  <https://better-auth.com/docs/plugins/sso> , <https://nvd.nist.gov/vuln/detail/CVE-2026-53515>
- **Supabase Auth**: `supabase sso add --type saml --domains company.com --attribute-mapping-file`
  (domains → provider; mapping JSON of `keys/names/required`) **[CLI flags from third-party posts]**.
  <https://supabase.com/docs/guides/self-hosting/self-hosted-saml-sso.md>
- **SCIM 2.0** (RFC 7643 schema, RFC 7644 protocol): `/Users`, `/Groups`, bearer token; Okta and
  Entra deactivate with `PATCH active=false`. One SCIM server serves every IdP.
  <https://ssojet.com/blog/scim-2-0-user-provisioning-b2b-saas-guide>

**Purely data-configurable**: issuer + client credentials (OIDC), metadata XML (SAML), domain
list, attribute/claim mapping, JIT on/off, default role, SCIM token. **Code**: one OIDC client,
one SAML SP (or delegate SAML to Cloudflare Access), one SCIM server, one WebAuthn RP.

### 2.4 Provider-free defaults
- **Passkeys/WebAuthn** as primary: Conditional UI (`navigator.credentials.get({mediation:
  'conditional'})`, feature-detect with `PublicKeyCredential.isConditionalMediationAvailable()`
  behind a `typeof` guard, `<input autocomplete="username webauthn">`); needs discoverable
  credentials; always offer a modal passkey button too. Support: Chrome/Edge 108+, Safari 16+,
  Firefox 119+ (sources disagree on Firefox). <https://web.dev/passkey-form-autofill> ,
  <https://developers.yubico.com/WebAuthn/Concepts/Passkey_Autofill/Implementation_Guidance/Autofill_-_Conditional_UI_Browser_Feature_Detection.html>
- **Fallback**: email OTP ≥ magic link > SMS (NIST SP 800-63-4 treats SMS OTP as inadequate for
  AAL2, per vendor summaries); failure mode is deliverability, which loops back to §1.
  <https://guptadeepak.com/ciam-compass/guides/magic-links-vs-otp/>

---

## 3. "Universal adapter" platforms and the provider-as-data pattern

| Platform | Provider definition | What is data | What is code |
|---|---|---|---|
| **Nango** | `providers.yaml`: `auth_mode` ∈ {OAUTH2, OAUTH1, OAUTH2_CC, API_KEY, BASIC, APP, APP_STORE, JWT, TBA, TWO_STEP, SIGNATURE, CUSTOM, NONE}, `authorization_url`, `token_url`, `proxy.base_url`, `webhook_routing_script` | auth, URLs, proxy base, SSRF denylist | per-provider webhook routing script, sync scripts |
| **Composio** | `integrations.yaml`: `auth_schemes[{auth_mode, authorization_url, token_url, default_scopes, proxy{base_url, headers, query_params, path_params}}]`, `fields[]` with `{{placeholders}}` | everything for auth + request shaping | custom tools (`execute_request`) |
| **n8n declarative nodes** | `requestDefaults{baseURL, headers}`, per-operation `routing.request{method, url}`, `routing.output`, `credentials[{name, required}]`, `IAuthenticateGeneric` | the whole REST node, no `execute()` | credential type class |
| **Pipedream** | component `props: {app: {type:'app', app:'slack'}}`; tokens under `$auth.oauth_access_token` / `api_key` | OAuth app owned by platform | component code |
| **Merge / Apideck / Unified.to** | normalized schema per category + raw/passthrough | schema | provider mappers (vendor-side) |
| **openapi-fetch** | OpenAPI spec → typed client; custom `fetch`, serializers | spec | none per endpoint (types generated) |

Sources: <https://docs.nango.dev/reference/api-configuration> , <https://nango.dev/docs/integrations/api-configuration> ,
<https://docs.composio.dev/introduction/foundations/components/integrations/integration-yaml> ,
<https://docs.n8n.io/connect/create-nodes/build-your-node/reference/base-files/declarative-style-parameters.md> ,
<https://pipedream.com/docs/code/nodejs/auth/> , <https://openapi-ts.dev/openapi-fetch/>

Lessons for the kit:
1. Separate **auth scheme** (an enum of ~8 code paths) from **provider instance** (data).
2. Separate **transport** (HTTP template with `{{placeholders}}`, or SMTP, or S3-SigV4) from
   **semantic mapping** (JSONPath in/out). Both are data.
3. **Capability negotiation**: the provider row declares `capabilities: ["send","batch",
   "idempotency","templates","schedule","webhooks:standard-webhooks",...]`; the kit degrades
   (local render, own idempotency, own scheduling) when absent. No researched platform does this
   formally; it is the kit's own addition.
4. **Health probe** per provider row: a declared `probe` request (e.g. `GET /domains`,
   SMTP `EHLO`+`AUTH`, S3 `HeadBucket`) run by cron and before activation.

---

## 4. Other provider categories and their generic baseline

| Category | De-facto protocol | Coverage | Notes / source |
|---|---|---|---|
| Object storage | **S3 API + SigV4** | R2, S3, MinIO, Backblaze B2, Wasabi | `aws4fetch` signs on Workers with fetch+SubtleCrypto, retries with backoff; endpoint from URL. B2 differences: canned ACLs only, versioning default on, no SSE-KMS/tagging/IAM. <https://github.com/mhart/aws4fetch> , <https://www.backblaze.com/docs/cloud-storage-s3-compatible-api> |
| SMS / WhatsApp | no cross-vendor standard; Twilio-shaped REST (form POST `To/From/Body`) is the template; Plivo/Vonage/Telnyx/Sinch/Bird all differ | WhatsApp = **Meta Cloud API** `POST graph.facebook.com/v{N}/{PHONE_NUMBER_ID}/messages` bearer token, `messaging_product:"whatsapp"`, template messages need Meta approval | <https://developers.secure.facebook.com/docs/whatsapp/cloud-api/reference/messages> , <https://www.authgear.com/post/twilio-alternatives/> |
| Error tracking | **Sentry envelope protocol / DSN** | Sentry, GlitchTip, Bugsink, self-hosted | switching = change DSN; GlitchTip v6 (2026-02) added performance. <https://railway.com/deploy/glitchtip-sentry-alternative> , <https://ssojet.com/blog/best-sentry-alternatives-error-tracking.md> |
| Analytics | **Segment-compatible `track/identify/batch`** | Jitsu, RudderStack; PostHog capture is "similar" not identical | Plausible/Umami have their own tiny event APIs. <https://classic.jitsu.com/docs/sending-data/segment-api> , <https://rudderstack.com/docs/stream-sources/posthog> |
| Status pages | **Statuspage.io `api/v2/status.json` / `summary.json`** schema (`indicator: none|minor|major|critical`, component statuses) | Atlassian, LoadFocus and most clones; Instatus/Better Stack not confirmed | <https://status.claude.com/api> , <https://loadfocus.com/docs/guides/api-monitoring/status-page-api> |
| Payments | no standard; Stripe's API is the reference shape **[unverified]** | hand-written per PSP | out of scope for data-driven |
| DNS / CDN | provider APIs differ; Cloudflare API is first-party here | Cloudflare only | — |
| Git hosting | GitHub/GitLab/Gitea REST differ; webhooks all HMAC-SHA256 with different header names **[unverified]** | hand-written thin clients | — |
| Secrets | see §5 | — | — |
| Databases | Postgres wire via Hyperdrive; D1 binding | — | first-party |
| AI models | **OpenAI Chat Completions** is the de-facto standard; Workers AI exposes `/ai/v1/chat/completions` and `/v1/embeddings`; AI Gateway unifies 14 providers behind `/compat/chat/completions` (single-model use now deprecated in favour of `api.cloudflare.com/.../ai/v1/chat/completions`), also exposes Anthropic Messages at `/ai/v1/messages`, supports custom OpenAI-compatible providers | OpenAI, Anthropic, Google, Groq, Mistral, Cohere, DeepSeek, xAI, Workers AI… | caveat: reasoning/thinking fields fall outside the frozen schema. <https://developers.cloudflare.com/ai-gateway/usage/chat-completion/> , <https://developers.cloudflare.com/ai-gateway/usage/rest-api/> , <https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/> , <https://www.edenai.co/post/why-openai-compatible-apis-are-the-new-standard> |

Categories with a real wire standard (email-SMTP, S3, Sentry, Segment, Statuspage, OpenAI,
OIDC/SAML/SCIM, Standard Webhooks) can be data-driven. Categories without one (SMS, payments,
git, DNS) need a thin hand-written client per provider, but the *credential storage, health
probe, capability flags and admin UI* stay generic.

---

## 5. Secrets and per-provider credentials within Worker limits

Constraints: 64/128 env+secrets per Worker, 5 KB each (§0). cf-admin's RULE #0.8 already caps
env vars. Many tenants × many providers cannot be Worker secrets.

| Option | Limits / status (2026-10) | Fit |
|---|---|---|
| Worker secrets (`wrangler secret put`) | count against 64/128; per-Worker; never readable back | Only for the KEK and first-party tokens |
| **Cloudflare Secrets Store** | **open beta**; 1 store per account; **100 secrets per account** (production); 64 KiB each; bound via `secrets_store_secrets[{binding, store_id, secret_name}]`, read with `await env.X.get()`; scopes `workers`/`ai-gateway`; binding needs *Secrets Store Edit* token. <https://developers.cloudflare.com/secrets-store/manage-secrets/> , <https://developers.cloudflare.com/secrets-store/integrations/workers/> , <https://developers.cloudflare.com/secrets-store/access-control/> | Good for account-wide shared keys; 100-cap and one-store rule make it unsuitable as the per-tenant credential vault |
| **Envelope encryption in D1** | KEK = one Worker secret (or one Secrets Store secret); per-tenant DEK generated with WebCrypto, wrapped by KEK (AES-KW or AES-GCM), stored in D1; credentials encrypted AES-GCM with the DEK, **tenant id + provider id as AAD** so ciphertext cannot be moved between rows; 96-bit random IV per record; envelope `version‖iv‖ct‖tag`. Libraries exist on JSR (`@brc-dd/gcmwrap`, `@civility/crypto`) but the primitive is ~60 lines of SubtleCrypto. <https://jsr.io/@brc-dd/gcmwrap> , <https://jsr.io/@civility/crypto> | **Recommended** primary store: unlimited rows, rotation = rewrap DEKs, per-tenant revocation, fits RULE #0.6/#0.9 (reuse `admin_portal_settings`-style table or one `provider_credentials` table) |
| Hashicorp Vault / Supabase Vault | network hop per read; cf-backup already uses Supabase Vault via Hyperdrive | for the KEK's cold copy, not hot path |

Rules regardless of store: decrypt only inside the request that uses it; never log the plaintext
or the full envelope; cache decrypted provider clients per isolate only in memory; rotate KEK by
dual-key window (new KEK wraps all DEKs, old KEK accepted until done); write an audit row on
every credential create/rotate/use-failure.

---

## 6. "Security checks auto-capture": self-assessing posture from live signals

| Check | How, from a Worker or cron | Source |
|---|---|---|
| HTTP security headers | **Mozilla HTTP Observatory v2**: `POST https://observatory-api.mdn.mozilla.net/api/v2/scan?host=…`, no key, ~1 scan/host/minute (cached otherwise) | <https://developer.mozilla.org/en-US/observatory/docs/faq> , <https://jentic.com/apis/observatory.mdn.mozilla.net/observatory-mdn-mozilla.md> |
| securityheaders.com | paid API key, subscription by scan volume (from $2.99/mo in 2023 announcement) | <https://SECURITYHEADERS.IO/api> , <https://scotthelme.co.uk/announcing-the-new-security-headers-api-new-features-and-upgrades/> |
| TLS config | **SSL Labs API v4**: one-time registration (name, org, email), 429 on overuse, poll every 5–10 s, honour `X-Max-Assessments`; one host at a time | <https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v4.md> |
| CSP violations | `Content-Security-Policy-Report-Only` + `report-to` endpoint on the Worker, aggregate in D1 **[standard practice, no page fetched]** | — |
| DNS posture | DoH queries for `_dmarc` (`p=reject`), `CAA`, `DNSKEY`/`ad` flag for DNSSEC, `_mta-sts`, `_smtp._tls` (TLS-RPT), SPF `-all`; score like internet.nl / intodns.ai (weighted, start at 100) | <https://intodns.ai/answers/why-is-my-domain-score-low> , <https://github.com/zuzazuza/domaincheck> |
| Cloudflare controls | Cloudflare API read-only token: Zone Settings (one call per setting; the bulk endpoint was retired), WAF rulesets (`Get Ruleset` to see rules), Access apps/policies/IdPs, Audit logs (latest-100 window) | <https://flareinspect.readthedocs.io/en/latest/permissions-guide.html> , <https://unpkg.com/@vigilbase/cli@0.2.3/CLOUDFLARE.md> |
| Dependency audit | `npm audit` / `audit_gate` in CI (already in cf-admin verify) | repo |
| Exposed secrets | `check:secrets` pattern scan (cf-graph already has one); GitHub secret scanning via API | repo |
| Breached passwords | **HIBP Pwned Passwords range API**: SHA-1, send 5-char prefix to `GET https://api.pwnedpasswords.com/range/<prefix>`, compare suffix locally; no key; `Add-Padding: true` header hides match counts; CORS open | <https://blog.cloudflare.com/validating-leaked-passwords-with-k-anonymity/> , <https://orthogonal.info/check-breached-password-without-sending-hibp-k-anonymity/> |
| WebAuthn adoption | own metric: % of active users with ≥1 passkey, % sign-ins via passkey | internal |
| Compliance checklists | OWASP ASVS as self-assessment; cf-graph's rule: every standard carries a caveat + lastVerified, never a bare badge | cf-graph main.md §5 |

All external scanners are rate-limited per host, so run them from a daily cron (Paid: 250
crons; Free: 5) and store results with `observed_at` + `source` the way cf-graph's
`platform-facts` does. "Describe posture, not gaps" when publishing.

---

## 7. Recommendation for the kit (one page)

### 7.1 Adapter contract per category (TypeScript sketch)

```ts
// Shared
type Capability = string;                     // e.g. "email.send" "email.batch" "email.idempotency"
interface ProviderHealth { ok: boolean; latencyMs: number; checkedAt: string; detail?: string }
interface Adapter<Config> {
  readonly kind: 'email' | 'storage' | 'sms' | 'errors' | 'analytics' | 'status' | 'ai' | 'idp';
  readonly capabilities: ReadonlySet<Capability>;   // declared, not discovered at call time
  probe(cfg: Config): Promise<ProviderHealth>;      // used before activation and by cron
}

// Email
interface EmailMessage { from: Addr; to: Addr[]; cc?: Addr[]; bcc?: Addr[]; replyTo?: Addr;
  subject: string; text?: string; html?: string; headers?: Record<string,string>;
  attachments?: { filename: string; contentType: string; content: Uint8Array }[];
  messageKey: string;                 // kit-owned idempotency key (D1 lease), always
  tags?: Record<string,string> }
interface EmailAdapter extends Adapter<EmailConfig> {
  send(cfg: EmailConfig, m: EmailMessage): Promise<{ providerMessageId: string }>;
  verifyWebhook(cfg: EmailConfig, req: Request): Promise<{ ok: boolean; rawBody: string }>;
  normaliseEvents(cfg: EmailConfig, rawBody: string): EmailEvent[];   // JSONPath-driven
}
type EmailEvent = { type: 'accepted'|'delivered'|'deferred'|'bounced'|'complained'|'opened'|
  'clicked'|'unsubscribed'|'rejected'; providerMessageId: string; recipient: string;
  at: string; reason?: string; raw: unknown };

// Two concrete email adapters are hand-written; everything else is a row:
//   HttpTemplateEmailAdapter  (JSON over fetch, fields mapped by template + JSONPath)
//   SmtpEmailAdapter          (worker-mailer over cloudflare:sockets, 587/465)

// Storage: one S3Adapter (aws4fetch) — endpoint/region/bucket/credentials are data.
// Errors:  one SentryEnvelopeAdapter — DSN is data.
// Analytics: one SegmentBatchAdapter — writeKey + endpoint are data.
// Status:  one StatuspageV2Reader — base URL is data.
// AI:      one OpenAICompatAdapter — baseURL + key + model are data (AI Gateway in front).
// IdP:     one OidcClient + Cloudflare Access driver — issuer/client/claims are data.
```

### 7.2 Provider registry as data (JSON Schema sketch, stored in D1)

```jsonc
{
  "$id": "provider-definition", "type": "object",
  "required": ["id","kind","transport","auth","capabilities"],
  "properties": {
    "id":   { "type": "string" },                       // "resend", "brevo", "smtp-generic"
    "kind": { "enum": ["email","storage","sms","errors","analytics","status","ai","idp"] },
    "transport": { "oneOf": [
      { "properties": { "type": {"const":"http"}, "baseUrl": {"type":"string"},
          "send": { "method": "POST", "path": "/emails", "bodyTemplate": {"from":"{{from}}", "to":"{{to}}", "...":"..."} },
          "headers": { "Authorization": "Bearer {{secret.apiKey}}" } } },
      { "properties": { "type": {"const":"smtp"}, "host": {}, "port": {}, "secure": {}, "startTls": {} } },
      { "properties": { "type": {"const":"s3"}, "endpoint": {}, "region": {} } } ] },
    "auth": { "enum": ["bearer","basic","api-key-header","oauth2-cc","sigv4","smtp-plain","smtp-login","none"] },
    "capabilities": { "type": "array", "items": { "type": "string" } },
    "webhook": { "properties": {
      "signature": { "enum": ["standard-webhooks","hmac-timestamp-token","ecdsa-public-key","sns","shared-secret","none"] },
      "secretRef": {}, "eventTypePath": {"type":"string"}, "messageIdPath": {}, "recipientPath": {},
      "timestampPath": {}, "reasonPath": {}, "eventMap": { "type":"object" } } },  // provider type → EmailEvent.type
    "fingerprint": { "properties": {                        // for auto-detection
      "spfIncludes": {"type":"array"}, "dkimSelectors": {"type":"array"},
      "dkimCnameSuffix": {}, "mxSuffix": {}, "verificationTxtPrefix": {} } },
    "probe": { "properties": { "method": {}, "path": {}, "expectStatus": {} } },
    "docs": { "type": "string" }
  }
}
```

Per-tenant **instance** rows reference a definition and hold the encrypted credential envelope
(§5), `status` (`suggested|confirmed|active|failover|disabled`), `lastProbe`, and
`detectedBy` (which fingerprint matched, when).

### 7.3 Detection → suggestion → confirm flow
1. **Trigger**: domain onboarded, daily cron, or a sensor (webhook with unknown signature, auth
   failures, inbound mail headers).
2. **Probe** (DoH, ≤6 subrequests): MX, TXT@, `_dmarc`, DKIM selectors from every definition's
   `fingerprint`, Entra/Okta CNAMEs, `getuserrealm` for sign-in.
3. **Match** against `fingerprint` rows → ranked suggestions with evidence ("SPF includes
   `_spf.brevo.com`, DKIM `brevo1` found").
4. **Suggest** in the admin UI; never activate alone (Golden Rule 7). Owner pastes the credential
   → encrypted envelope.
5. **Probe** the instance (`probe` request / SMTP AUTH) and send a **canary** to a verified
   destination address (free on Cloudflare).
6. **Confirm** → status `active`; previous instance becomes `failover` (Symfony-style
   `failover(a b)`); audit row.
7. **Watch**: cron re-fingerprints; drift → back to step 3 with a "provider seems to have
   changed" notice; sends keep working on the current instance meanwhile.

### 7.4 What stays hand-written vs. data-driven

Hand-written (small, audited, tested once):
- The ~8 auth schemes and ~5 webhook signature verifiers.
- Transport engines: HTTP template renderer, SMTP client (worker-mailer), S3 SigV4 (aws4fetch),
  Sentry envelope writer, Segment batch writer, OIDC client, SCIM server, WebAuthn RP.
- Envelope encryption + rotation; idempotency lease; scheduling/queue; audit.
- DoH fingerprinting engine and the detection UI.
- Thin clients for categories without a wire standard (SMS/WhatsApp per vendor, payments, git).

Data-driven (rows, editable from the admin UI, no deploy):
- Provider definitions (URLs, body/header templates, JSONPath maps, capability flags,
  fingerprints, probe), per-tenant instances and credentials, IdP rows (issuer, client,
  claims, domains, JIT/role defaults), failover order, thresholds (per RULE #0.8 in
  `admin_portal_settings`), scanner schedules and published-posture caveats.
