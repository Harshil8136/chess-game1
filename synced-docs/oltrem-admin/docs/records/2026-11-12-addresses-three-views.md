---
title: "Addresses in three views, and the Edit dialog in parts: Oltrem Mail 5ee9ec9 taken in (2026-11-12)"
status: record
owner: vendor
last_verified: 2026-11-12
sources: [vendor/mail/oltrem-mail.json; vendor/mail/published/docs/records/2026-11-12-addresses-in-three-views.md; vendor/mail/published/modules/email/README.md; packages/core-ui/src/theme.css; templates/client/test/screens.test.ts]
---

# Addresses in three views, and the Edit dialog in parts

> **In plain words.** The owner found Email settings, Addresses hard to find a way around, and the
> dialog that edits an address hard to read. Oltrem Mail now draws the page as two figures over a
> sideways row of three views (Addresses, Domains, Kinds of mail), each address's tags in their
> colours, one Add an address at the top, and an Edit dialog in three parts with what the address
> sends chosen there. The full account is
> [Oltrem Mail's record](../../vendor/mail/published/docs/records/2026-11-12-addresses-in-three-views.md).

## What the kit changed with it

| Area | Before | Now |
|---|---|---|
| Label tags (`ui-label-chip`) and avatars (`ui-avatar`) | Their tint mixed in oklch, where white counts as hue 0: green tags came out pink, every avatar's tint leaned red | Mixed in oklab: each keeps its own colour, in both themes |
| A card of one colour | None | `.ui-hue-card`: a 1 px border and one flat tint of its `data-hue` (no gradient, the `ui-design-system` skill); the Edit dialog's card of the address |
| The composer's toolbar | No scroll bar only inside Write on a phone | No scroll bar wherever it stands (`[data-rich] [role='toolbar']`), so a signature's shows none |
| The client template's screen test | Check again looked for on the Addresses page | Looked for on its Domains view (`?view=domains`) |

The stylesheet stays at 144 KiB, under its 148 KiB cap.

## How it was checked

Oltrem Mail's verify (11 gates) for its commits, the pages looked at in a local portal at 390 and
1280 pixels, light and dark, and the kit's `pnpm verify` once for the batch. Phone tests P158 and
P159 in [the email phone tests](../phone-tests-email.md).
