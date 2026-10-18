---
title: "Oltrem, the platform kit: decisions log"
status: draft
audience: [owner, non-technical, ai, technical]
last_verified: 2026-10-18
verified_against: [thread]
owner: harshil
related_docs: [README.md, 01-plan.md]
tags: [platform-kit, decisions]
---

# Oltrem, the platform kit: decisions log

> **In plain words.** Every choice the owner has been asked to make about the kit, as a card in the project thread: the question, the options, what was recommended, and what he chose. Unanswered cards are marked open; the plan assumes the recommended option until he answers. His written instructions that changed the plan are quoted at the end. Times are UTC, 2026-10-18.

## Round 1 (posted 03:10 to 03:15)

| # | Question | Options (recommended in bold) | Answer |
|---|---|---|---|
| 1 | One system shared by every client, or an own copy per client | **Own copy per client**; one shared system; mixed | **Own copy per client** (03:19) |
| 2 | Core database | **Cloudflare D1 only**; Supabase Postgres; both | **Cloudflare D1 only** (03:24) |
| 3 | Screens | **Keep Astro + Preact**; a lighter framework; measure first | **Keep Astro + Preact** (03:24) |
| 4 | Sign-in | **Zero Trust door + the kit's own accounts**; own accounts only; Zero Trust only | **Zero Trust door + own accounts** (03:25) |
| 5 | Permission shape | **Groups + permission sets at any level**; fixed tiers that can be renamed; share-on-object | **Groups + permission sets at any level** (03:28) |
| 6 | How fixes travel to clients | **Versioned core packages**; copy the template; one repository for all | **Versioned core packages** (03:28) |
| 7 | Madagascar | **Client 1, moved module by module**; stays as it is; one move at the end | Superseded by his words at 04:34: Madagascar is Client 1 but none of its repositories is touched; the kit is built in new repositories, and Madagascar joins later in a new repository of its own. The card was withdrawn and the plan's Madagascar section rewritten; at 13:33 he still tapped its first option, "Madagascar is client number one", which agrees with his 04:34 words and with card 31 (sandbox first, then Madagascar in a new repository). Nothing in the plan changes |
| 8 | Vendor view across clients | **A light vendor console**; no central view; a full console | **No central view** (03:34), against the recommendation. The vendor console and the client heartbeat were removed from the plan |
| 9 | Cloudflare plan | **Free by default, paid when needed**; always paid | **Free by default** (03:10) |

## Round 2 (posted 03:24 to 03:30)

| # | Question | Options (recommended in bold) | Answer |
|---|---|---|---|
| 10 | Who owns a client's Cloudflare account | **The client owns it and invites the vendor**; the vendor owns all; per client, chosen at setup | **Per client, chosen at setup**, recorded from his words at 04:34: preferably a blank email address the client gives him; on his own email when the contract or scope needs it; he pays all usage and bills the client |
| 11 | Groups inside groups in version 1 | **Flat groups first**; nested groups | **Flat groups first** (13:33) |
| 12 | Scopes | **One tree** (locations with departments under them); two separate dimensions | **One tree** (13:34) |
| 13 | Where the kit's packages live | **A private registry in the vendor's GitHub organisation**; the public npm registry; copied code | Open. The research of 04:57 ([`17-research-ai-native-repo.md`](17-research-ai-native-repo.md)) found that GitHub Packages needs a classic personal token in every client repository and its builds, which works against "as few tokens as possible"; plan v2 re-posed this card as card 18 and withdrew this one; at 13:34 he still tapped its first option, "GitHub Packages in your organisation", the same answer he gave card 18 |
| 14 | A preview deployment per client | production only; **optional per client**; always | Withdrawn and re-posed as card 17; at 13:34 he still tapped **optional per client**, which matches card 17 (a preview link only for database and sign-in changes) |
| 15 | SMS and WhatsApp | **An optional module later**; a core module in version 1; not planned | **An optional module, later** (13:34) |
| — | A working name for the kit | asked in words; two lists of suggestions (14:09 and 15:40) | **Oltrem**, with oltrem.com bought (16:33; see "The name" below) |

## The owner's instructions, quoted

**03:04, the ask (shortened to its requirements).** Rebuild everything from scratch as a reusable modular kit: a blank repository per client with the core features (main dashboard, email, system debugging, users, sessions, permissions, backup, VPS if selected, GitHub); a fully dynamic permission system with one default Vendor and everything else dynamic (groups, not fixed tiers); boilerplate files for repeating features; hosted on Cloudflare within the free plan (10 ms CPU, D1, R2, KV, Zero Trust, Queues); automatic capture of sign-in methods, security checks and email provider detection and change, since every provider cannot be hand-coded; "think deep, research extensively, ask me as many questions as needed in the Claude app way where I select my choices from your options; take as long as needed and make a robust plan".

**04:16, edited 04:34 (verbatim, the authoritative text).**

> Madagascar is Client 1. Lets not touch any repos of it. We will make new github repo, test, run, check and do everything in new repos! So do not touch anything in madagascar and any of its connected repo.
>
> For question, who ownes cloudflare account so ans is account will be created on Clients emailor mine based on decision but pricing, usage and all will be paid by me and I will bill client. currently Cloudflare account is made under madagascar's account. I prefer to have client give me a blank email ID where I setup everything, however if it completely depends on client and how contract or project scope is so If needed, I will setup everything on my end!
>
> I also have one big request. We need to use global_config, client_config, system_config etc and such features which is basically configuration systems set by Vendor for this system. Remember in dynamic systems starting from name, sub-domain, page name etc can be unique per client! and this needs to be extremely well made so maybe we can use dev.vars JSON feature in Cloudflare prod, or D1, KV or something as this might be read thousands of times per day and we have to ensure this things are very fast!
>
> Also currently we simply create new everything new for new things or a concept like D1 SQLite databases, R2 Object Storage buckets, KV namespaces and such. but I am very sure if we plan from beginning, be more efficient, keep space for new stuff, plan in advance ahead, be smart from beginning we can avoid this by a landslide amount as I dont want 10+ API tokens for such basic operations, I dont like having 6 R2 buckets for close to nothing usage or requirements! so lets leave current system as it is and look for future!
>
> I DO NOT WANT you to copy-paste, clone-use, refer-use any type of code from existing repos but what I want you to do is understand them, its usage, its purpose, what it does. then THINK DEEP, RESEARCH, BRAINSTORM, or completely remake it from scratch/use_better_from_outside or like use difference and better concept to work! cuz if we use existing ones, we would be doing same thing in repeat and it wont be good for new repo concept.
>
> we also need to make sure this is compatible with big changes, improvements, upgraded package, test before pushing to prod (github actions or local or by AI)
>
> AI is also used extensively in development so we have to ensure to make all repos, systems, features, parts, docs are fully compatible for AI to use and for any upcoming AI model
>
> We have to use better libraries, best in class so start with improving stack, not just that but we need better stacks and libs for visuals such as tailwind and others supported to this.
>
> keep in mind that this type of repos wont just be used for website but it can be used to tons of types of work so its kind of open scope!
>
> we also need to have automated setup and requirements check, fallback, error features, API key instructions in portal and docs as well so AI can guide!
>
> dont think like any AI but RESEARCH EXTESNIVELY, TAKE AS LONG AS NEEDED, USE AND GATHER ALL SKILLS, REPOS that can help you make a master and 10+ years of senior SWE teams experience type worker. not use SWE but all with 10+ years of exp in database admin, management, system design,ui/ux designer and all aspects!
>
> remember to make this extremely smart, lightweight, core usable! and many more things!

**04:57.** "keep what you are doing, just add a seprate folder in docs of cf-admin as you go and push it so I can keep on reviewing. as you might hit usage limit multiple times. be sure, to update it more compatible for github view" — this folder is that request. It is the one exception he made to "do not touch anything in madagascar": documentation only, under a folder the public mirror does not publish, so he can review on GitHub.

## Round 3 (posted with plan version 2)

Sixteen cards, one per open design choice in [`01-plan.md`](01-plan.md) section 20, all answered 2026-10-18 between 12:58 and 13:13. Two answers went against the recommendation (16 and 18); the plan sections named were rewritten for them the same day.

| # | Question | Options (recommended in bold) | Plan section | Answer |
|---|---|---|---|---|
| 16 | Where the automatic tests run before anything goes live | **Inside Cloudflare's builder, in the client's account**; on GitHub; GitHub for everything | §14.1 | **GitHub Actions, then deploy** (12:58), against the recommendation. §14.1 rewritten for one workflow per client that runs verify, then migrates and deploys; one deploy token per client in GitHub (§9.2); Workers Builds not connected |
| 17 | How the owner pushes (replaces card 14) | **Straight to `main`, the builder blocking a bad push, plus a preview link for database and sign-in changes**; every change on a short branch first | §14.2 | **Straight to `main`** (12:58). §14.2 updated: the workflow is the gate; a branch push uploads a preview version without deploying |
| 18 | Where the kit's packages live (replaces card 13) | **Public npm under the owner's scope**; GitHub Packages; a copy in every client repository | §15.7 | **GitHub Packages** (13:04), against the recommendation. §15.7 rewritten from the GitHub documentation: client workflows install with their own `GITHUB_TOKEN` once granted read access; one read-only classic token per machine that installs; Dependabot instead of Renovate in client repositories |
| 19 | The licence on the public kit | **Apache-2.0**; PolyForm Shield; Business Source 1.1 | §15.7 | **Apache-2.0** (13:05) |
| 20 | Where the backup copy lives | **The client's own account only**; also the owner's archive account; a GitHub nightly job | §9.3 | **The client's own account only** (13:05) |
| 21 | How fast a saved setting must reach everyone | **The admin at once, everyone within a minute**; everyone within a second; at the next deploy | §5.2 | **The admin at once, everyone within a minute** (13:05) |
| 22 | Page names | fixed addresses with client menu names; **client-chosen addresses set at onboarding**; admins renaming pages themselves | §5.4 | **Client-chosen addresses set at onboarding** (13:06) |
| 23 | How a vendor-wide change reaches every client | **With the next kit release**; the owner editing each client's settings; a central config server every client calls | §5.1 | **With the next kit release** (13:07) |
| 24 | Styling | **Tailwind v4**; plain CSS; UnoCSS | §12.2 | **Tailwind v4** (13:07) |
| 25 | Components | **Own primitives plus Zag.js for the hard three**; a CSS component library; web components | §12.3 | **Own primitives plus Zag.js** (13:08) |
| 26 | How a client's brand reaches the screen | **One small per-client stylesheet**; inlined colours; baked in at build | §12.4 | **One per-client stylesheet** (13:08) |
| 27 | Charts | **Server SVG plus uPlot**; Chart.js; numbers only | §12.4 | **Server SVG plus uPlot** (13:11) |
| 28 | Email templates | **Maizzle**; MJML; hand-written tables | §12.4 | **Maizzle** (13:12) |
| 29 | How much to lean on one AI tool's features | **Portable files plus Claude and Cursor hooks**; portable only; deep integration from day one | §15.1 | **Portable files plus Claude and Cursor hooks** (13:12) |
| 30 | How strict the quality gate is | **The standard gate**; standard plus mutation testing; lighter | §15.6 | **The standard gate** (13:12) |
| 31 | Madagascar's timing | **Sandbox first, Madagascar afterwards in a new repository**; in parallel from the start; decide later | §17 | **Sandbox first, then Madagascar** (13:13) |

The round-2 cards were answered 13:33 to 13:34 (11 flat groups first, 12 one tree, 15 an optional module later). The name came at 16:33: **Oltrem** (oltrem.com), recorded in "The name" below. Nothing is open.

## The name (2026-10-18)

| Time | What the owner said | What followed |
|---|---|---|
| 14:09 | "Any suggestions?" | Four names and a choice card were offered |
| 14:35 | "None of the above, give me a good list of names and not related to madagascar cuz I need to get a domain as well. Also kill provided selection list as its not available or i dont like its optiobs" | The card was withdrawn; no card is used for the name again. A first list of coined names was sent |
| 14:49 | "This are bit weird suggestions for name. Give me different ones, you know that if public sees, its rememberable" | About 500 real words in English and ten other languages were checked at the registries: every one is registered in `.com`. A second list of eleven brand-style coined names free in `.com`, `.io`, `.dev`, `.app` and on GitHub was sent at 15:40 |
| 16:33 | "Okay we now have domain. oltrem.com use it" | **Oltrem** is the kit's name. Checked at 16:40: oltrem.com is registered (Verisign RDAP); `oltrem` is free as a GitHub organisation, as an npm name and in `.io`, `.dev` and `.app`. The plan now names the GitHub organisation, the npm scope `@oltrem/*`, the `oltrem` command, `oltrem.config.ts` and the `oltrem_` table prefix after it |

## Where the plan is published (2026-10-18)

| Time | What the owner said | What followed |
|---|---|---|
| 17:02 | "I also want docs to be in cfadmin repo. Now see I dont see anything in chess-game1 repo like anything you made or mentioned!" | The folder stays in cf-admin. It was not on the public docs mirror, because `documentation/program/` is private by the rule of 2026-09-19; the owner was asked whether to publish it |
| 17:11 | "Select best options, just dont waste github action minutes" | Private was chosen as the safer default |
| 17:33 | "this all should be in chess-game1 as well so I can review" | The folder became the second `program/` carve-out of the mirror (ADR-0001). Before the first sync the eleven files were checked for credential shapes, infrastructure identifiers and personal email addresses (none), and the one list of unfixed weaknesses, in the plan §2 and the estate inventory, was replaced by a pointer to the private documents that own it |
