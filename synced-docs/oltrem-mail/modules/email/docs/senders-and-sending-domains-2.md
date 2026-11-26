---
title: "@oltrem/email: delivery reports set up by API, the Addresses page"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/reports.ts, email.ts, pages.tsx]
---

# @oltrem/email: delivery reports set up by API, the Addresses page

> Part of [the @oltrem/email README](../README.md). Begins in
> [Senders and sending domains](senders-and-sending-domains.md).

## Delivery reports, registered by API

`POST /instances/:id/reports` registers `/hooks/email/<id>/<token>` at the provider for the events
its definition reads (`src/reports.ts`): Resend's webhooks (the signing secret sealed on the
instance), Brevo's transactional webhooks, Mailjet's event callbacks, one per event, leaving an
event another address gets alone; again changes nothing that is right. `DELETE` takes away only
this instance's addresses. Other providers answer that it is set up by hand, the address shown on
Email services. These, the hook address, `/release` and `/canary` need `email.manage` at the company
itself (`company`), since they act on every place's mail.

Audited: `email.domain-add`, `-check`, `-confirm`, `-remove`, `email.domains-discover`,
`email.sender-add`, `-update`, `-remove`, `-default`, `email.kinds`.

## The Addresses page

Email settings, Addresses (`/email/senders`, from `@oltrem/email/pages`), opened under the Email
set's **Settings** tab (`/settings/section/email`, `nav.under`) with Setup and the Mail add-on's
pages. One path: connect a service, then the portal reads its domains and addresses (by itself
with no domain yet, or **Sync with provider**). The empty state names the next step; someone who
may only send sees a plain list. The head has **Sync with provider** and **Add a domain**.

A sideways row of views (`?view=`), each with its count (domains "1 of 2" until all verified):

| View | What it holds |
| --- | --- |
| **Addresses** | A pane per domain: its state tag (**Verified**, **Not verified yet**, **Not checked yet**) and "Through Resend, checked 2 hours ago"; its addresses with Edit and Remove; **Defaults** where two could serve. **Add an address** opens one dialog (domain as chips, **Everyday** first) |
| **Domains** | A pane per domain with **Check again**, the **Gmail, Yahoo and Outlook rules** line, and **Checks and DNS records: 2 of 3 pass** folded (open while failing); **Remove the domain** once it has no address |
| **Kinds of mail** | Each kind's address; shown only when there are kinds |

What an address sends is a coloured tag everywhere: **Everyday mail** green, **Campaigns** purple,
**Bulk and everyday** amber (one address for both put a test in Gmail's Promotions), its default
blue. **Edit** opens on a card of the address, then **Who it is from** (name, and Everyday, Bulk or
Both; a default must hand over first, else the API refuses), **Replies** (empty means the address
itself) and **Signature** (the composer). **Cancel** and **Save** stay at the foot. Each change
returns to its view with its words or refusal.
