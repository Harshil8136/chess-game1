---
title: "Why the test email landed in Promotions: Oltrem Mail cc48720 taken in (2026-11-12)"
status: record
owner: vendor
last_verified: 2026-11-12
sources: [vendor/mail/oltrem-mail.json; vendor/mail/published/docs/records/2026-11-12-promotions-tab-cause.md; vendor/mail/published/docs/setup.md]
---

# Why the test email landed in Promotions

> **In plain words.** After the 2026-11-11 work ([the record](2026-11-11-gmail-primary.md)), the
> owner's next test email still landed in Gmail's Promotions tab. Its sending was right in every
> way the portal and the provider control: signed by the client's domain, the return path on the
> same domain, an encrypted connection, no tracking. The email itself was the cause: a designed
> offer ("Deal" in the subject, a big picture, a button, a hidden preview line, Unsubscribe and
> View in browser links that went nowhere), from the address that had also sent a campaign. Gmail
> files offers under Promotions on purpose. Oltrem Mail cc48720 now has Write ask once before an
> email like that goes, naming each sign and the way to Primary, names links that go nowhere, and
> has a campaign's page say when its address also sends everyday email.

## What was taken in

| Package | What a person sees |
|---|---|
| `@oltrem/email` | Send and Schedule on Write ask once when two signs or more say promotion, or a link goes nowhere; **Send anyway** sends it as it is. Template checks warn about links that go nowhere |
| `@oltrem/campaigns` | The From section says when the chosen address also sends everyday email, and asks for an address only for campaigns |

What was checked, the cause, the references and the client's own steps are in Oltrem Mail's
record, published with the release:
[2026-11-12-promotions-tab-cause.md](../../vendor/mail/published/docs/records/2026-11-12-promotions-tab-cause.md),
and its setup page's section 6.

## How it was checked

Oltrem Mail's `pnpm verify` passed 11 gates before its push; the kit's `pnpm verify` ran once with
the release in. Phone tests P155 and P156 are owed ([the Email list](../phone-tests-email.md)).
