---
title: "@oltrem/email: Senders and sending domains: Delivery reports, registered by themselves, Add an address, **Addresses** (the first), **Domains**, **Kinds of mail**, Cancel and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Senders and sending domains: Delivery reports, registered by themselves, Add an address, **Addresses** (the first), **Domains**, **Kinds of mail**, Cancel and more

> Part of [the @oltrem/email README](../README.md).

## Senders and sending domains, continued

### Delivery reports, registered by themselves

`POST /instances/:id/reports` (`email.manage` at the company, audited as `email.reports`) registers
the instance's public address, `/hooks/email/<id>/<token>`, at the provider by its API, for the
events its definition reads (`src/reports.ts`): Resend's webhook API (its signing secret is sealed
on the instance), Brevo's transactional webhooks, and Mailjet's event callbacks, one per event,
leaving alone an event another address already gets. Registering again changes nothing that is
right. `DELETE /instances/:id/reports` (`email.reports-remove`) takes away only this instance's
addresses. Another provider answers that it is set up by hand, with the address shown on Email
services. A key that may not register is told so in words. These two, the hook address, `/release`
and `/canary` act on every place's mail, so they ask for `email.manage` at the company itself, not
only somewhere (marked `company`, the kit's check).

Every change is audited: `email.domain-add`, `email.domain-check`, `email.domain-confirm`,
`email.domain-remove`, `email.domains-discover`, `email.sender-add`, `email.sender-update`, `email.sender-remove`,
`email.sender-default`, `email.kinds`.

The page is Email settings, Addresses (`/email/senders`, from `@oltrem/email/pages`). It is one
path: connect an email service, then the portal reads its domains and addresses (on its own when no
domain is here yet, or with **Sync with provider**) to add all or one by one. Each domain is a pane
with its state and **Check again**, its addresses as rows with Edit and Remove, the defaults picked
inline where two addresses could serve, **Add an address** and the checks and DNS records folded
(open while the domain does not pass). With nothing yet, the empty state names the one next step.
Someone who may only send from addresses sees them as a plain list.

Since 2026-11-11 it reads on a phone as a list does: a domain's state is a tag under its name
(**Verified**, **Not verified yet**, **Not checked yet**) beside "Through Resend, checked 2 hours
ago", so its head keeps only **Check again** beside the name; an address is its name and address,
with what it sends and what it is the default for as tags (**Default for all mail** when both);
**Add an address** sits under the list; **Gmail, Yahoo and Outlook rules** is a labelled line with
its own tag; the checks' count is in **Checks and DNS records: 2 of 3 pass**. The head's two
actions, **Sync with provider** and **Add a domain**, are the same kind of button. Since 2026-11-22
(the owner's "a design anyone can follow") Setup and Addresses, with the Mail add-on's Mail setup
and Forwarding, are no sidebar entry of their own: they open under the Email set's **Settings** tab
(`/settings/section/email`, `nav.under`), which lists them under **Set up** after Email's own
settings, so Email has one place for its setup.

The page is a sideways row of three views, `?view=` in the address, each with its count: the
addresses, and the domains, written "1 of 2" until every domain is verified. (The two boxes of
figures first put over them were taken out the same night, the owner: boxes that waste the page go.)

| View | What it holds |
|---|---|
| **Addresses** (the first) | A pane per domain: its state tag, then how many addresses (or **See its DNS records** while it does not pass); its addresses as rows with Edit and Remove; under them **Defaults**, the addresses Write and campaigns start from, where two could serve. The head's **Add an address** opens one dialog for every domain (the domain picked as chips when there are several), with **Everyday** chosen first |
| **Domains** | A pane per domain with **Check again**, the inbox rules line, and the checks and DNS records folded (open while it does not pass); **Remove the domain** once it has no address. The head's button is **Add a domain** |
| **Kinds of mail** | Which address each kind of mail comes from; its line says how many kinds have an address of their own, and the main address, so its chip is only **Main address** |

What an address sends is a tag in its colour on every row and in the dialogs: **Everyday mail**
green, **Campaigns** purple, **Bulk and everyday** amber (one address for both is what put a test
letter in Gmail's Promotions tab, `archive/records/2026-11-12-promotions-tab-cause.md`), and the
default it is in blue. **Edit** opens on a card of the address in its avatar's colour (its name,
address and tags), then three parts each with its icon: **Who it is from** (the name people see,
and what it sends, now chosen here: Everyday, Bulk or Both; while it is a default the words say
to make another address the default first, and the API refuses the change otherwise), **Replies**
(empty sends replies to the address itself, shown greyed in the box; one on the same domain is
best) and **Signature** (the composer in a bordered box whose toolbar shows no scroll bar).
**Cancel** and **Save** stay at the dialog's foot while the parts scroll. Every change goes back to
the view its form is on, its words or its refusal shown there.
