---
title: "Mail settings set once, used by every module (2026-11-03)"
status: proposal
owner: vendor
last_verified: 2026-11-03
sources: [the owner's ask of 2026-11-03 06:38 (point 1); modules/email (settings email.from_address and email.from_name, email_domains, email_senders, companyFrom, prepare), modules/mail (mail_cloudflare, mail_mailboxes, mail_forward_domains), modules/campaigns; the kit's templates/client/src/index.ts, where every kit module calls email.send; all read 2026-11-03]
---

# Mail settings set once, used by every module

> **In plain words.** Today a portal asks for its email domain up to four times (the provider
> card, Addresses, Mail setup, Forwarding), keeps the address mail comes from in three places that
> can drift apart, and asks for the sender's name three times. This proposal keeps one answer for
> each: **the domain**, **the address mail comes from with its name**, and **who may send from
> which address**. They are asked once, on the first setup, and every page and module starts from
> them. Nothing is lost: each page can still use another domain or address when someone picks one
> on purpose.

## 1. What is asked today

| Fact | Asked on | Kept in |
|---|---|---|
| The domain | the provider card (from its From address), Addresses ("Add a domain"), Mail setup ("Your domain" and "Subdomain"), Forwarding | `email_domains`; `mail_cloudflare.domain`; `mail_forward_domains` |
| The address mail comes from, and its name | the provider card, Settings (Email), Addresses (each sender), Mail setup ("Send as") | the settings `email.from_address` and `email.from_name`; each domain's everyday default sender; `mail_cloudflare.from_email` and `from_name` |
| Who may send from an address | Addresses (each sender's location), Mailboxes (each mailbox's location) | `email_senders.scope_id`; `mail_mailboxes.scope_id`, copied to a new sender, at the company's root, on its first reply |

Every kit module that emails (invoices, quotes, sign-in codes, approvals, alerts and the others)
sends without naming a sender, so its mail comes from `email.from_address`, or the everyday
default sender when that is empty, and Mail setup's "Send as" may replace either.

## 2. What changes

1. **One mail identity, asked once.** The first setup (the provider card, or Mail setup when
   Cloudflare is chosen) asks for the address mail comes from and the name people see. The domain
   is read from the address. The answer is stored once: the domain as the company's **main
   domain** in `email_domains`, the address as its everyday default sender, and the settings
   `email.from_address` and `email.from_name` from it.
2. **Every page starts from it.** Addresses, Mail setup, Forwarding and Mailboxes show the main
   domain filled in, with a "use another domain" choice beside it. Mail setup's "Send as" starts
   as the main address and stops being a separate copy. Changing the main address in one place
   changes it everywhere it is the default, and the page says so before saving.
3. **Which address each kind of mail comes from.** A short list on Addresses, one row per module
   that emails (Invoices, Quotes, Sign-in codes, Approvals, Alerts and so on), each set to the main
   address unless the Owner picks another sender, for example billing@ for invoices. The email
   module reads the row from the template's module, so the kit's modules need no change to their
   calls.
4. **Who may send from what, in one place.** A sender's location decides who may use it. A
   mailbox's reply address takes the mailbox's location, not the company's root, so a mailbox and
   its replies are opened to the same people.
5. **It checks itself.** The main domain is checked as today (records, DMARC, the Gmail, Yahoo and
   Outlook line). A module row pointing at a sender that was removed falls back to the main address
   and raises one alert naming it.

**Built first (2026-11-03), the part every choice shares:** Mail setup's form starts from the main
address (domain, "Send as" and name), and Forwarding's Add a domain from its domain. The rest waits
for the owner's choice.

## 3. Cost and limits

- One migration in oltrem-mail (a `main` flag on `email_domains` and one table or setting for the
  module rows); no new Worker, binding or variable; no KV writes (mail law M-3).
- The kit's own code is unchanged; the contract in [kit-contract.md](../kit-contract.md) gains
  the module rows.
- Existing portals keep working. Their main domain is the domain of `email.from_address`, set the
  first time the new code runs.

## 4. Not in this proposal

The visual remake of the pages and the bottom-right notifications (points 2 and 3 of the same ask)
belong to the kit's remake; Mail's pages take them when they exist.
