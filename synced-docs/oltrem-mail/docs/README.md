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
| [The records](../archive/records/README.md) | the dated history of each bigger change, outside docs/ so no agent loads it for a task | index |
