---
title: "Oltrem, the platform kit: plan and research (folder guide)"
status: draft
audience: [owner, non-technical, ai, technical]
last_verified: 2026-10-18
verified_against: [research]
owner: harshil
related_docs: [01-plan.md, 02-decisions-log.md]
tags: [platform-kit, program, index]
---

<!-- docs-check: proposed-paths -->
<!-- Paths named in this folder describe new repositories that do not exist yet. -->

# Oltrem, the platform kit: plan and research

> **In plain words.** Harshil asked (2026-10-18) for a plan to rebuild the platform from scratch as a reusable kit: each new client gets a blank repository with the core already inside (dashboard, users, sessions, permissions, email, health, backup, GitHub, an optional server console), on Cloudflare's free plan, with permissions that are fully dynamic and provider integrations that are data rather than hand-written code. The kit is named **Oltrem** (oltrem.com), the owner's choice of 2026-10-18. This folder holds the plan, the research behind it and the decisions taken so far. It is a **plan only**: nothing is built yet, and nothing here changes the Madagascar repositories or their systems.

## Where things stand

| Item | State |
|---|---|
| Plan | [`01-plan.md`](01-plan.md): **version 2**, written 2026-10-18 (v1 at 03:23, v2 after the research passes finished). It folds in the owner's 04:34 instructions: new repositories only, design not code, configuration in layers with a fast read path, one of each resource per client and the fewest credentials, test before production, repositories built for AI agents, the visual stack. Section 0 is the one-page summary; section 1 holds every answer. All sixteen round-3 cards were answered on 2026-10-18 (two against the recommendation: GitHub Actions as the gate, GitHub Packages as the registry) and folded in the same day |
| Name | **Oltrem**, with oltrem.com bought by the owner (2026-10-18 16:33). The GitHub organisation, the npm scope `@oltrem/*`, the `oltrem` command, `oltrem.config.ts` and the `oltrem_` table prefix follow it; the research files predate the name and still say `kit` |
| Decisions | [`02-decisions-log.md`](02-decisions-log.md): every choice card, its options, the recommendation and the owner's answer; the owner's instructions quoted |
| Research | Eight dated snapshots (`10-` to `17-`), each with its sources and open gaps, kept as records and not updated in place; and since 2026-10-24 a ninth, `18-`, a researched proposal for automated delivery and strict checks that waits on two owner choices |
| Code | None. Kit work will start in new GitHub repositories once the plan is accepted; those repositories are not in this project yet |

## The owner's standing instructions for this work

1. **Madagascar is Client 1, and none of its six repositories or connected accounts is touched.** The kit is built, tested and run only in new repositories. This folder is documentation only; it is here so the owner can review on GitHub as the plan grows. Since 2026-10-18 it is also copied to the public docs mirror (the owner's decision; ADR-0001), so nothing here may say what could not be public: a known weakness of the live platform stays in the private documents that own it, with at most a pointer.
2. **Design, not code.** Nothing is copied, cloned or "referred" from the existing repositories. They are studied for what each part does and why; the kit is designed fresh, taking better outside concepts where they exist.
3. **Configuration set by the Vendor in layers** (global, client, system): a client's name, subdomain and page names are unique per client, read thousands of times a day, so the read path must be very fast.
4. **One of each resource, planned up front.** No new database, bucket or namespace per idea; as few API tokens as possible.
5. **Test before production**, compatible with big changes and package upgrades.
6. **Everything readable by AI agents**, now and for future models; automated setup and requirement checks, fallbacks, and API key instructions in the portal and the docs so an AI can guide.
7. **Best-in-class libraries and visual stack**; open scope beyond websites; lightweight and core-usable.

## How to read this folder on a phone

Start with the plan's one-page summary (section 0 of [`01-plan.md`](01-plan.md)), then the answers table (section 1). Each later section stands on its own. The research files are long; each opens with a ten-line summary, and every figure in them carries the page it came from and the date it was read. Anything a research pass could not confirm is marked **GAP**.

## Files

| File | What it holds | Status |
|---|---|---|
| [`01-plan.md`](01-plan.md) | The plan: why rebuild, non-negotiables, the shape of the kit, identity and sign-in, permissions, providers as data, data and migrations, performance, security, documentation, build order, risks, open questions | draft |
| [`02-decisions-log.md`](02-decisions-log.md) | The choice cards and the owner's answers, with the owner's instructions quoted | draft |
| [`10-research-estate-inventory.md`](10-research-estate-inventory.md) | What the six repositories do today, measured: sizes, duplicated systems, provider coupling, the migration collision, open security items, and the 17 designs worth carrying forward as ideas | historical |
| [`11-research-cloudflare-platform.md`](11-research-cloudflare-platform.md) | Cloudflare limits and tooling for the kit: free-plan budgets, Access for Workers, Workers Builds, auto-provisioning, Secrets Store, Queues, Workflows, Durable Objects, with URLs for every figure | historical |
| [`12-research-permissions-model.md`](12-research-permissions-model.md) | Permission models compared (fixed tiers, RBAC with groups, cloud-IAM bindings, Zanzibar, policy languages, Kubernetes, Discord bitfields, embeddable engines) and the recommended shape | historical |
| [`13-research-providers-as-data.md`](13-research-providers-as-data.md) | Providers as data: auth schemes, webhook verifiers, transport engines, DNS fingerprinting for detection, envelope encryption for credentials, security posture scanners | historical |
| [`14-research-config-layers.md`](14-research-config-layers.md) | The configuration layers and the fastest safe read path on Workers: every store compared with numbers, the recommended D1 → KV snapshot → memory path, validation libraries, per-client identity and page names as data | historical |
| [`15-research-visual-stack.md`](15-research-visual-stack.md) | Astro 7 facts, Tailwind v4 against the alternatives, the component approach (own primitives plus Zag.js), icons, fonts, images, tables, charts, forms, email HTML, quality gates, phone-first UX rules | historical |
| [`16-research-resources-and-release.md`](16-research-resources-and-release.md) | One of each resource per client with the manifest and the gate, one Worker versus several, the minimum token set, the test-before-production pipeline costed in minutes, upgrades, backups without a token zoo | historical |
| [`17-research-ai-native-repo.md`](17-research-ai-native-repo.md) | Agent instruction files, Skills, hooks and MCP, docs that cannot drift, the `kit doctor` and `kit setup` design (now `oltrem doctor` and `oltrem setup`), fallbacks and error design, guardrails for AI-written code, monorepo and distribution, open scope | historical |
| [`18-research-automated-delivery.md`](18-research-automated-delivery.md) | Research and proposal (2026-10-24): why no all-access key, what large platforms do to keep customized copies upgradeable, and a design for Oltrem: three kinds of change, one door for code, the checks, an automatic release with a step back, an operations menu instead of a command line, one key per job, automatic setup, upgrades in waves; two choices for the owner | draft |

## What happens next

1. Every card is answered (rounds 1 to 3, 2026-10-18) and the kit is named Oltrem (16:33); nothing is open.
2. Any further answer or instruction is folded into the plan and the decisions log here, in further pushes.
3. Once the owner says the plan is accepted, work starts in new repositories (a kit monorepo, a client template and a sandbox client), never here.

## Verification log

| Date | What was checked | What was not |
|---|---|---|
| 2026-10-18 | The folder's files exist and are indexed; the research files were read in full before the plan was written; the owner's instructions are quoted from his messages of 2026-10-18 03:04, 04:16 (edited 04:34) and 04:57 | No figure in the research was re-checked against a live system; each research file states its own gaps |
| 2026-10-18 | Plan version 2 installed; every figure in it was traced to one of the eight research files, which carry the source URL and the date read; `docs_check` and the markdown lint pass on the folder | Nothing in the plan has been tried in a sandbox |
| 2026-10-18 | The last round-2 cards answered 13:33 to 13:34 (flat groups, one scope tree, SMS later), recorded in the plan and the log | Nothing else |
| 2026-10-18 | All sixteen round-3 answers recorded (12:58 to 13:13) and folded into the plan; the GitHub Packages section was rewritten from the GitHub documentation read the same day (`GITHUB_TOKEN` access through "Manage Actions access", classic tokens only outside Actions) | The GitHub Actions minutes figure and the Cloudflare OIDC question are research estimates to confirm in Phase 0 |
| 2026-10-18 | The name Oltrem recorded in the plan, the log and this guide; at 16:40 oltrem.com showed as registered at Verisign's RDAP and `oltrem` was free as a GitHub organisation, as an npm name and in `.io`, `.dev` and `.app`; two stale sentences in the plan that still had Workers Builds deploying were aligned with the card-16 answer | Who registered oltrem.com is not visible from here; the owner says he bought it |
| 2026-10-18 | The folder published to the public docs mirror at the owner's request (17:33): the eleven files were scanned for credential shapes, infrastructure identifiers and personal email addresses (none found), and the one list of unfixed weaknesses, in the plan §2 and the inventory, was replaced by a pointer to the private documents | Whether the mirror renders the mermaid diagrams on a phone |
| 2026-10-18 | The owner's 20:08 instructions (an ai.md every AI reads first, a rules.md, a token registry with reuse before create) folded into the plan (§0, §1, §9.4, §15.1, §15.3, §15.5, §18) and recorded in the log | Nothing else; the plan is still under the owner's review |
| 2026-10-24 | `18-research-automated-delivery.md` added and indexed: its 65 sources were read that day, most through a search service's copy of the page; the kit facts it states (the client workflow, `oltrem new module`, migration checksums, `/healthz`) were read in the kit repository | The proposal is not built or tried; its gaps are listed in its section 8 |
| 2026-10-24 | The owner's answers to cards 30 and 31 (18:54) recorded in the decisions log, folded into research 18 (§3.2, §3.5, §3.6, §4, §6, §9) and summarised in the plan as §14.4; the plan's OIDC sentence and Dependabot bullet updated | Nothing built yet |
