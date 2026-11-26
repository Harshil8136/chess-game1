---
title: 'Oltrem Mail: the setup page'
status: approved
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/connect.ts, spf.ts, reports.ts, modules/mail/src/cloudflare.ts, forwarding.ts, improvmx.ts, modules/campaigns/src/campaigns.ts, Cloudflare docs read 2026-11-02 (Email Service, Email Routing API), provider and ImprovMX (v4) API pages read 2026-11-02 and 2026-11-03]
---

# Oltrem Mail: the setup page

Why email is set up the way it is: a provider in two fields, Cloudflare's own email in one button,
delivery reports that register themselves, a backup provider within the SPF limit, forwarding as
ImprovMX does it, and what decides Gmail's tabs. Part of [the plan](plan.md); built in phases 2
and 3, forwarding in bundle F. Routes and settings: the email module's README and
[`modules/mail/docs/using-it.md`](../modules/mail/docs/using-it.md).

## 1. "Use an email provider"

One card (Email, Set up) does every step in one press and lists each in words.

- **The From address.** Its domain is read after the @; "Use a different sending subdomain" (or a
  an address typed at `mail.example.com`) sets up that subdomain at the provider. The zone is found by
  walking up the name, and records are written relative to it.
- **The key.** Its start names the provider: `re_` Resend, `xkeysib-` Brevo, `SG.` SendGrid,
  `api-` SMTP2GO, `AKIA` Amazon SES. Otherwise (Mailjet and Postmark keys look generic) the
  domain's DNS preselects one, and only then a sideways row of logos asks for a tap. A key of the
  wrong kind (Brevo's SMTP key) is refused in words.
- **Extra fields only when needed:** Mailjet its secret key; Amazon SES a secret and region; SMTP a
  host, user and password.
- **Then by itself:** the domain added at the provider and its records written on Cloudflare (only
  added, never a second SPF, a parent's DMARC never weakened); a domain not passing is checked
  every five minutes in its first hour, hourly in its first day, then daily, and warns on System
  health after a day; each domain says whether it is ready for Gmail, Yahoo and Outlook; delivery
  reports registered (section 3); the placement test
  ([the record](../archive/records/2026-11-02-sets-itself-up.md)).

## 2. "Use Cloudflare email"

Cloudflare Email Sending to any recipient is not on Workers Free, but the `send_email` binding
still sends, with no count limit, to the account's verified addresses from a domain with Email
Routing on. The card starts from the portal's main address (`email.from_address`,
`email.from_name`) and sets up both plans:

1. **Where mail is received.** A domain that receives mail elsewhere (Google Workspace, Microsoft
   365) would lose its MX records to Routing at the root, so a subdomain is offered; existing MX
   records are never replaced without an explicit choice.
2. **Email Routing on** (`POST /zones/{zone_id}/email/routing/dns`, which adds and locks MX and
   SPF), with Email Routing Rules Edit and DNS Edit ([decision 3](plan.md#11-the-owners-decisions)).
   A 403 shows the one dashboard tap.
3. **Staff verified:** each is added to Verified Destination Addresses and presses Cloudflare's link
   once; the state is read back on demand, every five minutes for a day, then daily, and kept in
   the database, never KV.
4. **The domain onboarded for sending, and the test.** Cloudflare has no onboarding API (checked
   2026-11-02 and 2026-11-03), so this is a dashboard tap and the key never needs Email Sending
   Edit. A test refused only for that is sent again every five minutes for a day (`mail.soon`), so
   the route turns ready without a second press. An unverified recipient says "verify it first";
   any other failure says "could not check, try again" and never guesses a mode (R-10). The mode is
   Paid only when the plan setting says Workers Paid, and a plan change asks for the test again. In
   Paid mode Cloudflare writes its records on `cf-bounce.example.com` and a DMARC record.
5. **The line** reads **"Ready (Free Plan: Verified Staff Addresses Only)"** or **"Ready (Paid
   Plan: Staff & Customer Transactional)"**.
6. **The route sends nothing until a test passed**, to the presser (verified first) or a typed
   verified address.
7. **What it carries:** never bulk mail (M-2); in Free mode only mail whose every recipient is a
   verified staff address; in Paid mode customers' transactional mail too, once the Owner turns on
   `mail.cloudflare_first`. A message the route got no clear answer for stays on it (M-1).

Sending uses the structured `env.EMAIL.send({ to, from, subject, html, text, headers, attachments
})`, never the raw `EmailMessage`; the binding is `"send_email": [{ "name": "EMAIL" }]`
([decision 4](plan.md#11-the-owners-decisions)). The page leads with the first step not passed, or
"Everything is ready".

## 3. Delivery reports, registered by themselves

The Sent timeline, the do-not-mail list and the bulk self-pause (0.3% complaints, 5% bounces) need
the provider's reports, so once a domain checks out the portal registers its address for
delivered, bounced, complained and opened:

| Provider | Registered by | A report checked by |
|---|---|---|
| Resend | its webhook API, which returns a signing secret | the signature (Standard Webhooks) |
| Brevo | its webhook API, transactional events | the long random token in the address |
| Mailjet | its event callback API, one call per event | the token in the address |
| The others | the kit's guided manual step | the kit's six signature schemes |

- **The address** is `/hooks/email/<provider instance>/<token>`: `/api/` sits behind sign-in and
  the cross-site check, `/hooks/` is mounted before sign-in for exactly this. One per instance.
- **The secret** is sealed with the provider's key under the kit's KEK; it is not a Worker secret,
  so it has no registry row (R-05).
- **Limits:** Resend's webhook API needs a full-access key (with a sending-only key, the manual
  step); Mailjet has no "delivered", its "sent" means accepted; "opened" overcounts because Apple
  Mail opens for privacy, so it carries a note and decides nothing.
- **Removing a provider** removes its webhook there; both audited.

## 4. A backup provider, and the SPF limit

One main and one backup ([the plan](plan.md#1-your-questions-answered)): Brevo with Resend, or Brevo
with Mailjet; Mailgun stays for clients who use it. Everyday mail goes through the backup first once
the main provider is down to its last tenth.

SPF allows 10 DNS lookups and 2 that find nothing; past that receivers treat it as broken. The
portal counts as RFC 7208 does (`include`, `a`, `mx`, `ptr`, `exists`, `redirect`, through every
include), warns at 9 (`SPF_FULL_AT`) and refuses a provider that would pass 10. Where each route
puts its SPF (the counter measures live records, not this list):

| Route | Its SPF | Added at the root |
|---|---|---|
| Resend | on `send.example.com` | nothing |
| Cloudflare Email Sending (Paid) | on `cf-bounce.example.com` | nothing |
| Cloudflare Email Routing | `include:_spf.mx.cloudflare.net` where Routing runs | its own, at the root |
| Mailjet | `include:spf.mailjet.com` at the root | its own |
| Brevo | what Brevo's records ask | counted live |

## 5. Forwarding, as ImprovMX does it

The Forwarding page (`/email/forwarding`, Email's Settings tab) has two views, **ImprovMX** and
**Cloudflare**; it opens on ImprovMX unless Cloudflare already forwards a domain and ImprovMX is
not connected ([bundle F](../archive/records/2026-11-02-forwarding.md),
[ImprovMX view](../archive/records/2026-11-12-forwarding-through-improvmx.md)).

### 5.1 Through ImprovMX, with its key

**Connect ImprovMX** takes the account's API key once; it is tried first, kept sealed as an
`improvmx` instance (kind `forwarding`) and never logged, audited or shown
([`IMPROVMX_API_KEY`](reference/tokens.md)). The view then reads ImprovMX live, at most 10 calls:
the account and plan, the first 8 domains (the rest named) with whether each forwards, their
aliases (200 a domain) with people and webhook counts, a records check (MX, SPF, DKIM, DMARC) and
the newest 20 messages. Add a domain, add an alias (`*` for every other address), change and delete
go to ImprovMX at once, audited by address, people checked first (ten at most); ImprovMX's refusals
show in its words. **Disconnect** forgets the key; the aliases keep forwarding. While connected,
the Cloudflare view rests: its jobs and checks skip those domains and delete nothing.

### 5.2 Through Cloudflare

An **alias** forwards one address, or every address without its own (the catch-all,
`*@example.com`), to one to ten people and keeps nothing; a **mailbox** of [the inbox](inbox.md)
keeps mail. To one person it is Cloudflare's own forward rule; to several, a rule to the Worker,
which forwards to each confirmed person (a rule forwards to one address). Each person must be
verified in Email Routing: Cloudflare emails each a link, eight a press and the rest by the
five-minute job, and the alias starts once one is pressed.

A domain is looked up in the account's zone (never cached DNS): with no MX, Routing is turned on;
with Cloudflare's, its state is read; with ImprovMX's, aliases are set ahead and mail keeps going to
ImprovMX until **Move from ImprovMX**; with another service's, nothing changes (use a subdomain).

**Read from ImprovMX** takes the key for that press only (never stored) and imports every domain's
aliases, 200 a page, in at most 12 ImprovMX calls beside 35 Cloudflare ones; an unreached domain is
named for the next press, and a domain's non-alias rules are named. Without a key, a pasted list
works: ImprovMX's export, or one alias a line with its people (spaces, commas, tabs, `->` or `=>`).
Webhooks are left out, saying so; the same list again changes nothing.

**The move**, one domain at a time, once every alias has a confirmed person:

1. ImprovMX's MX and the SPF record are kept, so Move back works from any point.
2. `include:_spf.mx.cloudflare.net` joins the SPF record (ImprovMX's stays); passing 10 lookups
   stops the move.
3. The aliases' rules are made while mail still goes to ImprovMX.
4. ImprovMX's MX are deleted and Routing turned on; if Cloudflare refuses either, ImprovMX's records
   go back at once.

**Move back** adds ImprovMX's MX beside Cloudflare's (both forward, nothing lost), turns Routing off
and takes Cloudflare's include out; ImprovMX is never changed by either. It is refused, with
dashboard steps, while the zone also carries the sending route, another forwarding domain or
mailboxes.

**On the builder's computer** Cloudflare is never asked: domains say "On this computer", people
count as confirmed, moves say nothing moves, and **Send a test** (here and on Mailboxes) reports
forwarded, kept or refused. Every Cloudflare and DNS call is counted: 35 a press, 8 a five-minute
run, inside Workers Free's 50; the rest waits for the next run. Moves, move backs and imports are
audited, refusals too.

## 6. Landing in Gmail's Primary tab, not Promotions

No header puts mail in Primary: Gmail decides per reader from the sender, how the message looks and
how that reader treated the sender before. The portal keeps marketing signs off everyday mail:

| Sign | What the portal does |
|---|---|
| Tracking pixels and rewritten links | Everyday mail asks the provider not to track where it can for one message (Postmark, SendGrid, Mailgun, Mailjet); Resend tracks only when switched on for the domain |
| A provider that tracks every message and adds `List-Unsubscribe` (Brevo, Sender) | Everyday mail goes through another provider first; with none, Ready to send names the fix |
| `List-Unsubscribe` and an unsubscribe footer | Only on campaigns, which need both and mostly land in Promotions (not spam) |
| A campaign that reads as an advert | Sent as a plain letter; its preview names each sign (an offer in the subject, capitals, rows of !, many links, a design, a newsletter From name) and points a few recipients to Compose |
| An everyday email that reads as an offer | Write asks once, naming each sign and any link that goes nowhere (`#`, yourwebsite.com) |
| One address for campaigns and everyday mail | The campaign page warns: Gmail learns the address as Promotions |

The client's own part: everyday mail through a provider that does not track (Resend, Postmark,
Mailgun); campaigns from their own subdomain (`news.example.com`); everyday mail written as a
letter from a person's name with a read reply address; DMARC to `p=quarantine` once reports pass;
a few customers replying or moving one email to Primary. The owner's tests of 2026-11-12 and
2026-11-15 landed in Promotions for their content, not their sending
([cause](../archive/records/2026-11-12-promotions-tab-cause.md),
[campaigns as letters](../archive/records/2026-11-15-campaigns-as-letters.md)).

### 6.1 The portal's own notices: Updates, and the one sure way to Primary

Sign-in notices and alerts are what Gmail calls Updates ("automated confirmations, notifications,
statements, and reminders"), and the reader's actions count most. So the one sure way is the
reader's own filter, which the portal makes for each person: `GET /api/email/primary` names the
main and sender addresses; the Notifications page turns them into a Gmail filter file and a contact
card, with steps for Gmail and Outlook and **Send me a test** (`POST /api/email/primary/test`); the
kit's invitation, sign-in and alert emails end with a line pointing there. Each person does it once;
no sender can set a reader's filter.
