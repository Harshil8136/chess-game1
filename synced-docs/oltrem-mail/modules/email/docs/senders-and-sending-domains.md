---
title: "@oltrem/email: Senders and sending domains: Which address each kind of mail comes from, A sending domain, The check, Passing, Ready for Gmail, Yahoo and Outlook, Read from the provider, Another address, from Write, A sender address and more and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Senders and sending domains: Which address each kind of mail comes from, A sending domain, The check, Passing, Ready for Gmail, Yahoo and Outlook, Read from the provider, Another address, from Write, A sender address and more and more

> Part of [the @oltrem/email README](../README.md).

## Senders and sending domains

A message names the address it comes from with `senderId`; without one it comes from the
address picked for its kind of mail, else from the `from` the client hands in (the two settings
above, the main address). Bulk mail, such as a campaign, always names one.

### Which address each kind of mail comes from

Since 2026-11-03: a kind is a module that emails, read from the part of its template ids before the
dot (`invoices.message` is Invoices), so the kit's modules name no sender and need no change. Each
kind comes from the main address unless someone who holds `email.senders.manage` for the whole
company picks another everyday sender for it on Addresses (`PUT /kinds`, audited `email.kinds`; one
row per changed kind in `email_kind_senders`). Write and campaigns (`email.*`, `campaigns.*`) pick
their sender each time and are not listed. A pick whose address was removed, or is now for bulk mail
only, is not used: the mail comes from the main address, Addresses says so on the kind, and the
health check `email.kinds` warns until it is picked again. Reading the pick is one D1 read per
message.

Add a domain on Addresses starts filled in with the main address's domain while it is not added
yet, as Mail setup and Forwarding do in `@oltrem/mail`.

| Part | What it does |
|---|---|
| A sending domain | Added by someone who holds `email.senders.manage` for the whole company, with the email instance it sends through. Where the provider's definition has a `domains` block (Resend and Brevo, `@oltrem/providers`), the portal adds the domain there and shows the DNS records the provider asks for, each with a Copy button |
| The check | Live from the page, then by itself (the job `email.domains`, four domains a run; every five minutes while a domain not yet passing is in its first hour or a check was due, hourly otherwise, woken by a domain added or by a send that says something new of one, 2026-11-12): a domain that has never passed is checked every five minutes in its first hour and hourly in its first day, the provider asked each time to look at its records again; after that, and once it passes, daily (`RECHECK_SOON`, `RECHECK_MS`). One line per finding, in plain words: the provider says the domain is verified; each of its records is found in public DNS (DKIM by its key, SPF by its `include`); a DMARC policy covers the domain, which Gmail, Yahoo and Microsoft require of bulk senders: its own record, or else the nearest one above it (`mail.example.com` is covered by `example.com`'s, with its `sp=` policy when it has one), as receivers look it up; it has one SPF record, not two. A provider or DNS that does not answer leaves the state as it was and says so |
| Passing | The provider verified the domain and a DMARC policy covers it, with no broken SPF. Where the key may only send (Resend refuses a sending key's domain read with 401), the portal learns it from the emails the provider takes: a real email from the domain that the provider took proves it, and one it refused as from an unverified domain fails it (`proven`, kept as the domain's `send_proof`, written at most hourly while it holds; a change sends the domain to the job's next run). With nothing known yet, the check sends one email from the domain to the provider's test address (the definition's `testInbox`, Resend's `delivered@resend.dev`, which delivers to no one and counts against the allowance), again only after 15 minutes in the first hour since the first refusal, an hour in its first day, then daily (`PROBE_GAPS`), and never once proven. Where nothing can tell (no `domains` block, no test address), a person confirms the dashboard shows it verified, and the confirmation is audited; a refusal after that confirmation wins over it |
| Ready for Gmail, Yahoo and Outlook | A line on each domain (`inboxes` on the domain, `inboxesOf`): ready when the provider verified it (it signs with DKIM and may send by SPF) and a DMARC policy covers it, the sender rules Gmail and Yahoo set in 2024 and Microsoft in 2025; otherwise what is missing. Campaigns add the one-click unsubscribe those rules ask for, and their complaint rate is watched on System health |
| Read from the provider | **Sync with provider** on the page (`GET /domains/found`) lists what each email instance with a key may send from, each marked as here or not, with **Add all** and a per-item **Add** (`POST /domains/discover`, all, or `names` for the ones named). Discovering asks every email instance with a key for the domains and single addresses its account may send from (the definition's `identities` lists, `@oltrem/providers`). A domain new here is added with that instance and checked at once; an address new here is added at the company, for both kinds of mail, with the name the provider keeps or its local part, and becomes the domain's default where it has none. An address whose domain is not here is not added. What could not be read (a key that may only send, a provider that did not answer, a list that needs a second key) is said in words. For a definition with lists but no `domains` block, the check's provider line reads the domain's state from its lists |
| Another address, from Write | `POST /senders/own` (`email`, `name`), for someone who holds `email.senders.add` or `email.senders.manage` at the company: the address is added at the company for everyday mail. Its domain must be here, or listed by an email provider, as a domain or as that very address (the discover logic), and is then added with its check; otherwise it is refused (`KIT-E-1508`) with what to do: add and verify the domain at the provider. Audited as `email.sender-add` with `from: write` |
| A sender address | An address on an added domain, the name people see, an optional reply-to, the place of the company whose `email.senders.use` holders may send from it, and what it is for: bulk, everyday or both. The first address of a domain for each kind becomes its default; a default is changed, never left empty while the domain has addresses |
| A send | `compose` reads the sender: one that was removed, or is for the other kind of mail, refuses the message (`KIT-E-1508`); bulk mail asked for from a domain that does not pass is refused the same way, before it is queued |

### The SPF limit

`spfLine` and `countSpf` (`src/spf.ts`) count a domain's SPF record the way RFC 7208 does: each
`include`, `a`, `mx`, `ptr`, `exists` and a followed `redirect` is one DNS lookup, every include's
own record counts too, at most 10 lookups and 2 that find nothing. A loop counts as past the limit,
a macro is counted and not followed. The domain's check carries the line: two SPF records, a count
past either limit, or an include the provider asks for that would take the domain past 10 fail;
9 or 10 pass with the warning that the next provider belongs on a subdomain.

### The simple provider card

Email settings, Setup (`/email/connect`, `src/connect-page.tsx`; its three steps a tight numbered
list, the form starting higher on a phone) is docs/setup.md section 1 in one press: the address mail
comes from, an optional sending subdomain and name, and the provider's key. `POST /connect`
(`email.manage`, and `providers.manage` at the company; audited as `email.connect`) then does every
step itself and answers each in words (`src/card.ts`):

| Step | What happens |
|---|---|
| The provider | Read from the key's start (`re_` Resend, `xkeysib-` Brevo, `SG.` SendGrid, `api-` SMTP2GO, `AKIA` Amazon SES; `providerOfKey`), else from the domain's DNS (the providers' detection, the domain and then its parent). Only when neither says does the answer ask for one tap (`step: 'provider'`, a sideways row of every email provider) |
| Its fields | The key fills the provider's key field (`cardFields`: the first required field its label calls a key, else its first required secret, as SMTP's password). A provider that needs more (Mailjet's secret key, Amazon SES's secret and region) asks for exactly those (`step: 'fields'`); a `domain` field is filled from the address |
| Set up | On the instance of that provider not turned off, else a new one; made the one that sends, the one before becoming its backup, or with **Add it as the backup** made first in the failover order behind the one that sends |
| The domain | Added at the provider with the instance and checked, or checked again when it is here; one set up with another provider is left there, in words. With Oltrem Mail beside it, the records the provider asks for are written on Cloudflare (the `records` of the add-on's route taker), then the domain is checked again |
| The sender | The address becomes a sender at the company for both kinds of mail; the page also sets `email.from_address` and `email.from_name` to it |
| Reports and a test | Delivery reports registered by API (below), then a test message to the person who pressed |

**The key is asked first.** Before anything is set up or changed, the key and fields typed are tried
against the provider (its definition's probe, over the stored credential when the provider is
already here). Only a clear refusal of the key (401 or 403) stops it: `KIT-E-1513`, with the
provider named and "nothing was set up or changed"; the instance, its stored key, the domain and the
sender stay as they were. A provider that cannot be reached is not taken for a refusal. A refused
Connect draws the address, name, subdomain (its section open when one was typed) and **Add it as the
backup** that were typed, never the stored ones; the key is never drawn back. A result line for
delivery reports or the test message that did not pass has its own **Try again** (`?intent=again`,
`what=reports` or `test`), which registers the reports or sends the test again through that instance
alone. The page also has a **Delivery reports** pane (`#reports`, where Campaigns links) with
**Register delivery reports**, one press per instance that can. The domain line names the DNS
records missing only when the provider listed some; otherwise it says the domain does not pass yet
with the provider's own words, and that the portal asks again by itself.

Every reason from a provider shown on these pages is in plain words (`plainReason`, `src/connect.ts`): no error code at the start, a `reference = ...` folded to the end, a network failure as "could not be reached; try again in a minute", 401 or 403 as a refused key or an account that may not send yet, 429 as asked to slow down, a 5xx as a fault of the service's own.

**Made easy to start.** The form opens with three numbered steps (your address, your provider's key,
Connect). It starts from what the portal knows, from `GET /connect` (`email.manage`): the From
address and name already set, and a full example address on the company's own domain
(`exampleDomain`: the signed-in person's domain unless it is a personal mail service such as Gmail,
else the portal's address without its first part, else example.com), shown as the field's
placeholder and as a chip in its hint that a tap puts in the field (the kit's `data-fill`). Each
field has a round info button (core-ui `FormField` `info`) whose tinted note says what it is and
where to find it. When a provider can send but no domain is added yet (one added on Email services),
opening the page takes in the domains and addresses the provider lists (`POST /domains/discover`),
else adds the From address's domain (`POST /domains`), and checks it at once; the page says what it
added, and nothing happens for a person who may not add domains. Each line of the result arrives a
little after the one above.

Below it, **Where does it land?** sends one test to a Gmail and one to an Outlook address through
the provider picked (`POST /canary` with `to`), so staff see whether it lands in the Inbox or in
Spam before a campaign.
