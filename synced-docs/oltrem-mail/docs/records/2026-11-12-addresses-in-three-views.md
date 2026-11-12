---
title: "Addresses in three views, and the Edit dialog in parts (2026-11-12)"
status: record
owner: vendor
last_verified: 2026-11-12
sources: [modules/email/src/pages.tsx; modules/email/src/rich-box.tsx; modules/email/test/senders-page.test.ts; modules/email/test/kinds-page.test.ts; modules/email/README.md]
---

# Addresses in three views, and the Edit dialog in parts

> **In plain words.** The owner found the Addresses page hard to find a way around and the dialog
> that edits an address hard to read. On a phone the page was one scroll of about 3,300 pixels:
> each domain mixed its addresses, a defaults box, the inbox rules and its DNS checks, and thirteen
> rows of "which address sends this kind of mail" followed. Now two figures say how many addresses
> there are and how many domains pass, and a sideways row opens one of three views: Addresses,
> Domains, Kinds of mail. What each address sends is a tag in its colour. Edit opens on a card of
> the address, then three parts (who it is from, replies, signature), and what the address sends
> can be changed there at last.

## What changed

| Area | Before | Now |
|---|---|---|
| The page | One scroll: every domain's addresses, defaults, inbox rules and checks, then the kinds of mail | Two figures (**Addresses**, **Domains verified**) and three views in a sideways row: **Addresses**, **Domains**, **Kinds of mail** (`?view=`) |
| An address's tags | Grey **Bulk and everyday**, blue **Default for bulk mail** | In colour: **Everyday mail** green, **Bulk mail** purple, **Bulk and everyday** amber, its default blue |
| Adding an address | **Add an address** under each domain, **Both** chosen first | One **Add an address** at the top, the domain as chips when there are several, **Everyday** chosen first |
| A domain's checks | In every domain's pane on the one page | On the Domains view; the Addresses view says **See its DNS records** while a domain does not pass |
| Which address each kind of mail comes from | Thirteen rows on the same page, each chip **Main address (address)** | Its own view; the line under its title names the main address, so the chip is **Main address** and the next one shows |
| Edit | A form: name, replies, signature, Save at the bottom | A card of the address in its avatar's colour, then **Who it is from** (name, what it sends), **Replies**, **Signature**, each a part with its icon; Cancel and Save always at the foot |
| What an address sends | Chosen once, when it was added | Chosen in Edit too (the API took it already); a default says what to do first |
| The signature's toolbar | A scroll bar under it on a phone | In a bordered box, no scroll bar |

The kit's stylesheet gained a card on one flat tint of its colour (`.ui-hue-card`; no gradient,
the kit's design rules of the same day) and the toolbar rule, and its label tags and avatars now
mix their colour in oklab: in oklch, white counts as hue 0, so green tags came out pink and every
avatar's tint leaned red.

## How it was checked

`modules/email/test/senders-page.test.ts` renders the page: the two figures and their values, the
views and which is chosen, a domain's line on each view, the tags and their colours, the head's one
button on each view, the Edit dialog's three parts in order, what the address sends chosen, the
words for a default, Save tied to the form, the purpose posted with an edit, a change sent back to
its view and a refusal shown there. `modules/email/test/kinds-page.test.ts` checks the kinds' Save
goes back to its view. The pages were looked at on a phone (390 pixels wide) before and after, in
a local portal with two domains and four addresses.
