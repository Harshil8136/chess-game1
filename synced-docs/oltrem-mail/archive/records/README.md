---
title: "Records: Oltrem Mail's dated history"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [the records in this folder]
---

# Records

> **In plain words.** Mail's history: one dated record per bigger change, frozen once written.
> It lives outside `docs/` so no agent loads it for a task; open it only to answer what was done
> and when. Living documents say what is true now and link here at most once.

**Writing a new record** (the docs gate holds one dated after 2026-11-26 to 4 KB):

```markdown
---
title: "<what changed, in plain words>"
status: record
owner: vendor
last_verified: <date>
sources: [<commits>]
---

# <title>

**Changed.** One to three sentences. **Why.** One sentence.
**Before → after.** Two short lines, or one small table.
**Checked.** `pnpm verify` summary; phone tests P<n>-P<m>; what was not checked.
```

Detail (routes, tables, numbers) goes in the document that owns it, not here. Add one row below.

| Record | What it tells |
|---|---|
| [Phase 1: the move](2026-11-02-phase-1-move.md) | email and campaigns moved out of the kit, the vendoring both ways, how it was checked |
| [Phase 2: the Cloudflare route](2026-11-02-phase-2-cloudflare-route.md) | the `@oltrem/mail` add-on, the one error list, journal pinning, how it was checked |
| [Phase 3: the simple provider card](2026-11-02-phase-3-provider-card.md) | one press to connect email, records on Cloudflare, delivery reports by API, the SPF limit, the placement test, how it was checked |
| [Phase 4: the inbox](2026-11-02-phase-4-inbox.md) | mailboxes and their rules in Cloudflare, arrival, search, the safe reader, replies in the conversation, rules, room, how it was checked |
| [Phase 5: consent and the warm-up](2026-11-02-phase-5-consent.md) | three scopes for leaving, Mail me again, the list skip, the warm-up of a new domain, the local mailbox, how it was checked |
| [Bundle C: sets itself up and checks itself](2026-11-02-sets-itself-up.md) | domain checks on a backoff, DMARC from the parent, the Gmail, Yahoo and Outlook line, forwarding links sent by themselves, the safety copy, everyday mail moving to the backup, how it was checked |
| [Bundle A: an inbox that works the way people expect](2026-11-02-familiar-inbox.md) | Updates, one-press unsubscribe and subscriptions, snooze, mute, sweep, Undo, Gmail's search words, swipe, how it was checked |
| [Bundle B: the inbox answers by itself](2026-11-02-answers-by-itself.md) | automatic replies, saved replies in the reply box, No answer yet, the Undo send setting, how it was checked |
| [Bundle L: cleaner lists](2026-11-02-cleaner-lists.md) | misspellings put right on import, shared and no-reply inboxes, mail servers looked up, campaigns leaving out what no mail reaches, how it was checked |
| [Bundle F: forwarding, as ImprovMX does it](2026-11-02-forwarding.md) | aliases to one or several people, the catch-all, links confirmed by themselves, the ImprovMX import, the guided move and Move back, how it was checked |
| [Campaigns: rows read, the footer, steps, Run now](2026-11-10-campaigns-reads-and-run-now.md) | a campaign's page reading its counters and a kept tally instead of its whole list, the footer written in step 3, the steps one at a time, Run now and the Run log, how it was checked |
| [Email made to work like Gmail](2026-11-11-gmail-style-email.md) | stars, labels with colours and their folders, Gmail's keyboard shortcuts, the top bar and its menus, Quick settings, the left pane in groups with the Sending and Mail storage gauges, the Usage and limits page, what was left and why, how it was checked |
| [Write made smarter and slimmer](2026-11-11-write-smarter.md) | pasted lists read as people, the same person once, names for known addresses, suggestions by how often, Send asking about a misspelt address or a forgotten file, the question before leaving, the phone's slimmer head and Send bar |
| [The Email pages tidied for a phone](2026-11-11-email-pages-tidy.md) | the domain head, address rows in words, the same head buttons, Setup as the first tab, Write's narrower labels and hidden scrollbars, Usage without empty bars, Campaigns list first, how it was checked |
| [A coded email goes as designed, wherever it is pasted](2026-11-12-coded-email-anywhere.md) | why the owner's coded email showed as text, code found in chat answers, from a phone keyboard and when HTML is chosen late, old drafts mended, code for everyone who sends, designed signatures, one dropdown, how it was checked |
| [The mail jobs sleep while they have nothing to do](2026-11-12-jobs-that-sleep.md) | why a portal sending nothing wrote to the database every five minutes, each job's slow pace and what wakes it, the Write page's reads started together, the figures before and after, how it was checked |
| [Why the test email landed in Promotions](2026-11-12-promotions-tab-cause.md) | what was checked (headers, DNS, tracking, the email, the address's history), the cause, Write asking once about a promotion and dead links, the campaign page's advice on a shared address, references, how it was checked |
| [Addresses in three views, and the Edit dialog in parts](2026-11-12-addresses-in-three-views.md) | why the page was hard to find a way around, the two figures and three views, what each address sends in colour, one Add an address, Edit in parts with what it sends chosen there, the colour fix for tags and avatars, how it was checked |
| [Forwarding through ImprovMX, and plainer Forwarding and Mail setup pages](2026-11-12-forwarding-through-improvmx.md) | the owner's pick of ImprovMX, the key kept sealed, aliases changed at ImprovMX, records and recent mail, Forwarding in two views, Cloudflare forwarding resting, Mail setup's next step, the figure boxes gone, how it was checked |
| [Mail reads through indexes, and a row changes before the portal answers](2026-11-13-reads-and-rows-at-once.md) | the four asks (repeated queries, indexes, copies, changes at once), the Home cards and the hourly check reading through new indexes, the file sizes read once, rows that change before the answer and come back without one, what was left, how it was checked |
| [Lists: adding contacts made plain, and no campaign sends a blank field](2026-11-14-lists-add-contacts-and-personalization.md) | what the owner saw on a phone and what changed, three ways to add contacts with the file previewed, the people you emailed offered to tick, Send email from a list, Personalization with a default per variable, the start refused while anyone would get a blank, the research behind it, how it was checked |
| [Campaigns: add people from every step](2026-11-15-campaign-add-people.md) | why the Send step had no way to add people, four ways to add (saved list, typed addresses, file, people you emailed), added not replaced, Add people on every step, step 4 naming what it waits for, how it was checked |
| [Campaigns go as plain letters](2026-11-15-campaigns-as-letters.md) | the owner's campaign found in Gmail's Promotions, what was checked, the plain letter in place of the card, the page naming the signs of a promotion, what no portal can control |
| [Mail's journeys walked and fixed](2026-11-15-mail-flows-fixed.md) | the audit of Connect, lists, Write and campaigns, one Owner sending a large campaign alone, typed values kept on a refusal, the key asked first, plain reasons, how it was checked |
| [What did not land goes again, never twice and never for ever](2026-11-17-nothing-lost-nothing-twice.md) | the replay the release job now runs, the route written before each call, the last try, a provider that went away, campaign 5xx answers, delivery reports on several recipients, the inbox's pictures, links and text, how it was checked |
| [Company checks, proven senders and safer reading](2026-11-20-company-checks-and-proven-senders.md) | company mail changed only at the company (the kit's `company` routes), the automatic reply and unsubscribe links only from a proven From, the reader's own-site pictures, wildcards taken as typed, uploads read to their cap, how it was checked |
| [A lighter database](2026-11-22-lighter-database.md) | the outbox's finished sends kept 7 days, email history kept for good and why, one write fewer per email and per campaign recipient, the unused table and index dropped, how it was checked |
| [Mail's dialogs on the kit's remade dialog](2026-11-25-dialogs-remade.md) | the coloured head with a close button, the form as the body, Cancel and the main button in a foot that stays, red for removing, the kit refreshed, how it was checked |
| [Records moved out of docs/, and kept short](2026-11-26-records-out-of-docs.md) | records live in archive/records/, hidden from search; a new record is 4 KB at most, from a template |
