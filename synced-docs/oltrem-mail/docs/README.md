---
title: "Documentation index"
status: living
owner: vendor
last_verified: 2026-11-11
sources: [this repository]
---

# Oltrem Mail documentation

Every document in this repository is listed here. Each one owns its facts; the others link to it.

**Where they are published.** Every `pnpm mail:pack` carries all of them (this folder, the
Markdown files at the root, LICENSE and each module's README) in its `published/` folder. The kit
keeps the pack in its `vendor/mail/`, and the kit's docs mirror rebuilds the public folder
`synced-docs/oltrem-mail/` from it on each push, beside the kit's own `synced-docs/oltrem-admin/`.
So everything here is written as public (R-04), and is public once the kit takes the pack.

| Document | What it holds | Status |
|---|---|---|
| [The plan](plan.md) | the owner's questions answered, the two routes, where the code lives, records, features, limits, costs, deliverability, risks, build order, the owner's decisions | approved |
| [The setup page](setup.md) | the provider card (two fields), the Cloudflare card (Free and Paid modes), delivery reports, the backup provider, the SPF count, and landing in Primary rather than Promotions | approved |
| [The inbox](inbox.md) | arrival with the 128 KB rule, what D1 and R2 keep, reading on the phone, the reading frame, threads, mailboxes, and where the build differs | approved |
| [The agreement with the kit](kit-contract.md) | what mail takes from the kit, what it gives back, the numbers each side holds, how a change crosses | living |
| [The tokens](reference/tokens.md) | every credential this repository names, from `tokens.registry.json` | generated |
| [What pnpm verify runs](reference/verify.md) | the gates, in order, from `scripts/lib/gates.mjs` | generated |
| [The dependencies](reference/dependencies.md) | every dependency and why it is here, from `dependencies.registry.json` and the catalog | generated |
| [Phase 1: the move](records/2026-11-02-phase-1-move.md) | email and campaigns moved out of the kit, the vendoring both ways, how it was checked | record |
| [Phase 2: the Cloudflare route](records/2026-11-02-phase-2-cloudflare-route.md) | the `@oltrem/mail` add-on, the one error list, journal pinning, how it was checked | record |
| [Phase 3: the simple provider card](records/2026-11-02-phase-3-provider-card.md) | one press to connect email, records on Cloudflare, delivery reports by API, the SPF limit, the placement test, how it was checked | record |
| [Phase 4: the inbox](records/2026-11-02-phase-4-inbox.md) | mailboxes and their rules in Cloudflare, arrival, search, the safe reader, replies in the conversation, rules, room, how it was checked | record |
| [Phase 5: consent and the warm-up](records/2026-11-02-phase-5-consent.md) | three scopes for leaving, Mail me again, the list skip, the warm-up of a new domain, the local mailbox, how it was checked | record |
| [Bundle C: sets itself up and checks itself](records/2026-11-02-sets-itself-up.md) | domain checks on a backoff, DMARC from the parent, the Gmail, Yahoo and Outlook line, forwarding links sent by themselves, the safety copy, everyday mail moving to the backup, how it was checked | record |
| [Bundle A: an inbox that works the way people expect](records/2026-11-02-familiar-inbox.md) | Updates, one-press unsubscribe and subscriptions, snooze, mute, sweep, Undo, Gmail's search words, swipe, how it was checked | record |
| [Bundle B: the inbox answers by itself](records/2026-11-02-answers-by-itself.md) | automatic replies, saved replies in the reply box, No answer yet, the Undo send setting, how it was checked | record |
| [Bundle L: cleaner lists](records/2026-11-02-cleaner-lists.md) | misspellings put right on import, shared and no-reply inboxes, mail servers looked up, campaigns leaving out what no mail reaches, how it was checked | record |
| [Bundle F: forwarding, as ImprovMX does it](records/2026-11-02-forwarding.md) | aliases to one or several people, the catch-all, links confirmed by themselves, the ImprovMX import, the guided move and Move back, how it was checked | record |
| [Campaigns: rows read, the footer, steps, Run now](records/2026-11-10-campaigns-reads-and-run-now.md) | a campaign's page reading its counters and a kept tally instead of its whole list, the footer written in step 3, the steps one at a time, Run now and the Run log, how it was checked | record |
| [Email made to work like Gmail](records/2026-11-11-gmail-style-email.md) | stars, labels with colours and their folders, Gmail's keyboard shortcuts, the top bar and its menus, Quick settings, the left pane in groups with the Sending and Mail storage gauges, the Usage and limits page, what was left and why, how it was checked | record |
| [Making mail easier](research/2026-11-02-easier-mail.md) | what to copy from Gmail, Outlook and Yahoo, what to confirm, retry and check by itself, using Gmail or Outlook alongside, what not to do, and an order to build it in | proposal |
| [Every step by hand, and by itself](research/2026-11-03-hand-steps.md) | each Mail step from a computer to a live portal: what runs by itself, what still needs a person and why, what would let more run by itself | living |
| [Mail settings set once](research/2026-11-03-mail-settings-once.md) | one domain, one address mail comes from, which address each module's mail uses, and who may send from what, asked once and used by every page | built 2026-11-03 |
| [Making Email feel like Gmail](research/2026-11-11-gmail-style.md) | Gmail's layout and keyboard map, the features a Gmail user expects, which open-source projects and libraries may be reused under their licences, how big products show storage and quotas, the free plans' limits as published on 2026-11-11 | built 2026-11-11 |
