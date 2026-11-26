---
title: "Everyday email out of Gmail's Promotions tab (2026-11-11)"
status: record
owner: vendor
last_verified: 2026-11-11
sources: [modules/providers/src/definitions/email.ts; oltrem-mail modules/email/src/email.ts (compose, routesFor); oltrem-mail modules/email/src/ready.ts; help.brevo.com "FAQs - About list-unsubscribe and list-help headers"; resend.com/docs/dashboard/domains/tracking]
---

# Everyday email out of Gmail's Promotions tab

> **In plain words.** On 2026-11-11 the owner found every email the live portal sent in Gmail's
> Promotions tab and asked for the root cause. Gmail sorts each email by who sends it, what it
> looks like and how the person treated that sender before; an open-tracking pixel, links sent
> through the provider's own address and a `List-Unsubscribe` header are the strongest signs of
> marketing mail. The portal adds none of them, but Brevo adds all three to every email, with no
> way to stop it except on its Enterprise plans, and other providers track when their account
> setting says so. Now every everyday email (Write, replies, automated notices) asks the provider
> not to track it, a provider that always tracks goes behind one that does not, and Ready to send
> says so when every connected provider tracks. No sender can force Primary; campaigns, which must
> carry an unsubscribe link, mostly stay in Promotions, which is where Gmail files marketing.

## What changed

| Part | Before | After |
|---|---|---|
| A provider definition | no word on tracking it cannot stop | `alwaysTracks: true` on Brevo, Sender and Sender SMTP |
| An everyday email | tracking left to the provider's account setting, except sign-in emails | `tracking: false` on every message that is not bulk; Postmark, SendGrid, Mailgun and Mailjet honour it for the one message, Resend tracks only when its domain setting is switched on |
| The route an everyday email takes | the active provider first, a nearly full one moved back | among the providers with room, one that always tracks moves behind one that can send untracked, and stays the backup; bulk mail keeps the Owner's order |
| Ready to send | five checks | a sixth, "Everyday email lands in the inbox", amber when every provider tracks each email, naming the fix (add Resend, for one); it never keeps the page refreshing |

## How it was checked

- `pnpm verify` in oltrem-mail, 11 gates (f1a66d4): routes.test.ts sends everyday mail through
  Resend while Brevo is active, falls back to Brevo when Resend refuses, and sends bulk through
  Brevo; the add-on route receives the message with `tracking: false`; ready.test.ts covers the
  new check and that it never asks again.
- The kit's definitions test lists the providers that always track.
- Not verified: a real email to Gmail. The owner's "Show original" of one email in Promotions says
  which provider sent it and what headers it carried. Phone test P131.
