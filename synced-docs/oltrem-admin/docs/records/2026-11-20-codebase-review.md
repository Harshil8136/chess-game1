---
title: "The full codebase review: what was removed, simplified and fixed, and what waits for a yes (2026-11-20)"
status: record
owner: vendor
last_verified: 2026-11-20
sources: [the kit and Oltrem Mail at the commits below; the batch records linked from each section; ten review reports and a stale-assumptions study kept outside the repository; Cloudflare's Workers, D1, KV, Queues, Workflows and Email Sending pages read 2026-11-17 to 2026-11-20; pnpm cpu and the size gate run on this computer]
---

# The full codebase review

> **In plain words.** The owner asked for a review of the whole kit and Oltrem Mail: what could be
> removed or simplified, which assumptions no longer hold, what is unsafe or wasteful on the free
> plan, and the smallest change for each that keeps what people see. Ten reviews read the code
> (silent failures, data, the free plan, access, security in each repository, the four mail laws,
> dead code, duplicated code twice) and a separate study checked 35 statements that had gone out
> of date. Five batches fixed what was safe: mail that was never sent again, a few holes in who
> may do what, health checks that read whole tables every fifteen minutes, about 1,100 lines of
> code nothing used or that was written more than once, and the out-of-date statements. What
> would change what a person sees, delete stored data or edit a rule is written up at the end as
> a proposal with a recommendation, for the owner's yes.

Kit commits: 34bbc26 and f4b4b4d (batch 1), e1e336c (batch 3), 657fe6d and 4233916 (batch 2),
af73338 and deb2912 (batch 4), and the commit that carries this record (batch 5). Oltrem Mail:
8f4e7da, 276245f, 24b7ede, 29bd1ba and its batch 5 commit, taken into `vendor/mail/` each time.

## The master audit: what could be removed or simplified

Each row is one finding, the evidence for it, the smallest change that keeps what people see,
and where it stands. "Done" names the commit; "Proposal" is in the last sections.

| # | What | Evidence | Smallest change that keeps behaviour | Where it stands |
|---|---|---|---|---|
| 1 | The outbox could send again, and nothing called it | `core-outbox` `replay` had no caller; a message the queue refused, or one held until an email service was connected, stayed unsent for ever | Mail's `email.release` job calls it, ten rows a run, with a ladder of waits and a last try | Done, 34bbc26 and Mail 8f4e7da ([record](2026-11-17-outbox-replay.md)) |
| 2 | Sending again needs guards it did not have | a delivery cut short after the provider's yes went through the next route; a database that failed after the yes read as the provider failing | the route is written on the message before each call; the yes is written down outside the route's `try`; six tries on the route that may have sent it, thirty for the rest | Done, Mail 8f4e7da |
| 3 | Company-wide pages took a permission held at one location | the authorizer asked "holds it anywhere", for routes that change the whole company (settings, email services, backups, the activity log, sign-in services, Mail's setup and email's hooks) | a route says `company: true`; the authorizer asks at the company itself | Done, e1e336c and Mail 276245f ([record](2026-11-20-security-and-access.md)) |
| 4 | An ended sign-in could come back | the session's KV record could lapse before the door's own day ended | the record is kept until the door's day is over | Done, e1e336c |
| 5 | Public bodies were read whole before their size was known | a body with no declared length went into memory first | `readCapped` stops at the first byte past the limit | Done, e1e336c and Mail 276245f |
| 6 | Outside calls with no time limit | the customers' sign-in services, the providers' probe, every Cloudflare API and ImprovMX call in Mail | `AbortSignal.timeout`: 10 s, 20 s, 15 s (`CALL_MS`) | Done, e1e336c and Mail 29bd1ba |
| 7 | Three health checks read whole tables every fifteen minutes | `files.storage` counts every file row; `campaigns.reputation` reads a week of campaign mail; `email.quota` asked every provider whose count was over 15 minutes old | their own pace: six hours, six hours, one hour (a first failure is still checked again at the next health run) | Done, 657fe6d, Mail 24b7ede and 29bd1ba |
| 8 | The inbox's hourly removal scanned every conversation | `DELETE ... WHERE count = 0` over every mailbox | delete only the conversations that run touched, by their key (the plan test shows no `SCAN`) | Done, Mail 24b7ede |
| 9 | The font was decoded with a callback per character | `Uint8Array.from(atob(...), fn)` over 47 KiB on a copy's first request | a plain loop | Done, 657fe6d |
| 10 | Eight page parts nothing drew | `PeopleTable`, `TenantSummary`, `RolesTable`, `GroupsTable`, `ScopesTable`, `AccessTable`, `PersonSummary`, `WhatTheyCanDo`: no caller in any page, module or test | removed with the three word lists only they read: 319 lines | Done, af73338 |
| 11 | The same HTML renderer twelve times | twelve modules kept a byte-identical `test/html.ts` | one `packages/core-ui/test/shown.ts` | Done, af73338 (tests only) |
| 12 | The same money helpers three times | expenses, invoices and quotes each kept `money.ts` | one copy in `@oltrem/core-module` (and `/pages`); the three still export the same names | Done, af73338 |
| 13 | Stylesheet parts no piece wears | daisyUI compiled buttons, badge, kbd, skeleton, loading, join and tooltip; two rules keyed on attributes nothing sets | dropped from the `include` list and the two rules removed: 820 bytes | Done, af73338 |
| 14 | Mail kept small helpers twice | `lower`, `EMAIL`, `LOCAL` in two files, a second escape function, two copies of the campaign budget, the inbox's actions listed in the route and again in the page | one copy each (`THREAD_ACTIONS` read by both) | Done, Mail 29bd1ba |
| 15 | A component that draws nothing | `AccessTabs` returned `null`, kept "so a page that still names it compiles"; one use left | removed with its use | Done, batch 5 |
| 16 | Mail's list of Cloudflare's sending answers was a fortnight old | Cloudflare listed `E_SENDER_DOMAIN_NOT_CONFIGURED`, `E_EMAIL_SENDING_NOT_READY` and `E_RECIPIENT_PLAN_RESTRICTED` on 2026-11-17; an unknown code is "unclear", so such a message was held on Cloudflare's route as maybe sent, six tries, instead of going through the next route | the three are setup answers (a sure "not sent"); the setup page's test names the same steps as for a domain not onboarded or an address not verified | Done, Mail batch 5 |
| 17 | Statements that no longer hold (26 of the 35 the study found) | the kit's status page, architecture, kit review, READMEs of core-ui, core-module, developer, users, providers, github, timeclock; Mail's kit contract, inbox design, token registry, ai.md; comments on own-account mode, the health header, the setup header, the Access recipe | each corrected to what the code does today | Done, batch 5 (the list is in "Out-of-date statements" below) |
| 18 | The manifest gate checked 6 of 25 modules | `scripts/lib/gates.mjs` named its folders by hand; 19 modules were never checked against R-09 | the list is read from the disk (all 25 pass today); a test fails if a module with a manifest is left out | Done, batch 5 |
| 19 | `rules.md` says nothing deploys from the kit, and names a pre-push hook | R-01 and R-02 and the workflow header; since 2026-11-11 every push to `main` updates every portal through the fleet, which runs no verify; no hook exists | say what happens, and give the fleet a gate of its own | Proposal A1 |
| 20 | The newest-kit lookup asks a public registry | `packages/cli/src/github-report.ts` runs `pnpm view @oltrem/core-http version`; the kit is not published there (the owner decided "no registry" on 2026-11-01), so it is always unknown, and a stranger who registered the name could make it say anything | take the lookup out, retire the planned registry token row and `packages: read` | Proposal A2 |
| 21 | Test set-up written once per module | the same company seeded 21 times, three identical test Worker files per module, the pipeline harness at the top of each test file | one shared seed, one config factory, one harness: about 2,400 lines | Proposal F1 |
| 22 | Quotes and invoices are one module written twice | the same lines, totals, numbering, sending and customer answer in both | one shared core, two thin modules: about 230 lines now, 900 more in a second step | Proposal F2 |
| 23 | Two ways to deploy a client | the client repository's own deploy path (about 3,000 lines in the CLI) beside the fleet that now deploys every portal | keep one, once every client is on the fleet | Proposal F3 |
| 24 | Parts nothing uses that a person might | three Zag widgets that never run, seven primitives only tests render, five routes with no page, an error code never raised, `ownerOnly` | remove, or give each a page | Proposal F4 |

## What was found, by area

| Area | Report | Found | Fixed in this run | Left as a proposal or for the next batch |
|---|---|---|---|---|
| Nothing lost, nothing sent twice (the mail laws) | silent failures, mail laws | 23 silent failures, 20 mail-law findings | the outbox replay and its guards, the queue's waits, bulk 5xx answers, delivery reports that named anyone, the reader's inline pictures, `htmlText`'s quadratic scan, the Cloudflare codes | the unclear-answer rule (the decision card), the unsubscribe headers on Mailgun and SES, "Forget" and the list mark, 17 smaller silent failures |
| Who may do what | access, security in each repository | 6 high, 9 medium, 3 low (access); 2 high, 4 medium, 5 low (kit); 3 high, 7 medium (Mail) | company-wide routes, ended sign-ins, body caps, time limits, invitation races, `%` and `_` in searches, the automatic reply only to proven senders, the unsubscribe address only from proven senders | grant only what you hold, the sidebar for a location-only role, campaign re-approval, inbox write permission, automations, the script policy |
| The free plan and the database | free plan, data | 20 (free plan), 25 (data) | four checks on their own pace, the inbox removal by key, the font decode | Home's 30 queries, the health run alone in a tick, prefetching, indexes, keeping tables from growing for ever |
| Dead and duplicated code | dead code, duplicated code twice | 23 (dead), 18 (modules), 25 (screens, CLI, Mail) | the items in rows 10 to 15 of the table | the test set-up, quotes and invoices, the second deploy path, unused parts with no page |
| Out-of-date statements | the stale-assumptions study | 35 (32 confirmed, 3 narrowed) | 26 corrected in batch 5, and the manifest gate now checks all 25 modules instead of 6 | `rules.md` (three statements), the registry lookup, the static-files rewrite, the bookings time zone's label, Mail's approved plan, TypeScript 6 |

Severity of what was fixed, highest first: one critical (the outbox never sending again), five
high (the double send after a yes, company-wide routes, ended sign-ins, the inline picture with
the portal's address, the automatic reply to unproven senders), the rest medium or low. Each
batch record has the full table: [batch 1](2026-11-17-outbox-replay.md),
[batch 3](2026-11-20-security-and-access.md), and Oltrem Mail's own records of the same days.

## Out-of-date statements corrected in batch 5

In the kit: the status page (verify does not run on a push; the cron runs every minute and most
modules declare jobs; the module template has its capabilities and a page; pages are on the
manifest; live portals and the fleet exist), the architecture's module row, the kit review (K2's
static files reversed on 2026-11-04, K3 overtaken by live portals, K8's cap now 172 KiB), core-ui
(rendered by the screens package with Preact, not Astro; what the phone check covers), the
dependency reason for hono, core-module (pages, Home cards and hooks are on the manifest),
developer and the roadmap (no machine can call the API today), users (the door's groups are not
synced), providers (the Integrations page exists), github (the newest-kit lookup), timeclock
(shifts exist), the documentation index (forms, two workflows), what verify runs (the size and
coverage gates) and the CLI's account of the manifest gate, the Access recipe (deploy puts Access on the Worker), and the comments on
own-account mode, the health runner and setup.

In Oltrem Mail: the kit contract (the kit lets a hook's own `immutable` stand; migrations 1014 to
1017; errors to 4009), the inbox design (quick actions show at once since 2026-11-13), the token
registry (the ImprovMX key is sealed once connected), the email README (the daily cap exists),
`ai.md` and the package description (the inbox and forwarding are built; three modules), and the
approved plan's count of packages.

Left for a yes: `rules.md` (K-D0, K-D1, K-D2), the newest-kit lookup on the public registry
(K-D6), the deploy's rewrite of the old static-files line (K-R4), the "Time zone for bookings"
label that is really the company clock (K-M0), the approved plan's three lines on reply addresses
(M4), TypeScript 6 (M9).

## Measurements, before and after

| What | Before | After | How it was measured |
|---|---|---|---|
| Page CPU, median of the 35 pages' medians | 4.1 ms and 5.0 ms (two runs) | 4.1 ms (one run; a second stopped with an error in the report script) | `pnpm cpu`, 7 rounds a page on this computer, JavaScript CPU only; the same within the run-to-run noise, so no page saving is claimed |
| The font's first decode in a fresh copy | 6.3 to 19.7 ms | 1.6 to 5.0 ms | Node, five cold runs each; `pnpm cpu` on workerd was too noisy to show it |
| The first request to Home | 30.5 ms and 20.4 ms | 20.7 ms | `pnpm cpu`, the "first" column: one request each, includes the code's own compile, not a saving to claim |
| Worker, compressed | 704.7 KiB | 705.2 KiB | the size gate's dry-run build at 17f090e (before batch 1) and after batch 4; the fixes added about as much as the removals took, and unused exports were already left out of the build |
| Stylesheet (`APP_CSS`) | 175,237 bytes | 174,417 bytes | the generated asset's length |
| `files.storage` runs a day | 96 | 4 | its `every`; each run reads every file row, so a portal with 2,000 files reads 184,000 fewer rows a day |
| `campaigns.reputation` runs a day | 96 | 4 | its `every`; each run reads a week of campaign messages |
| `email.quota` outside calls a day | up to 96 a provider | up to 24 a provider | its `every`; sending still asks for itself before it sends |
| The inbox's hourly removal | a scan of every conversation of every mailbox | the touched conversations by key | the query plan, pinned by a test |

Counted by reading, not measured on a live portal: the rows and calls a day. No live portal's
logs were read for this record.

## Lines added and removed

Hand-written lines only (generated files, the packed Mail copy, the lock file and changesets left
out), over every commit of this run.

| Repository | Code | Tests | Documents |
|---|---|---|---|
| Kit | +651 −832 (net −181) | +643 −567 | +506 −209, and this record |
| Oltrem Mail | +455 −216 (net +239) | +505 −16 | +264 −46 |

Most of the code added is the guards that make sending again safe (batch 1) and the company and
time-limit checks (batch 3); most of what was removed is batch 4. The next batch of folds
(proposals F1 and F2) would remove about 2,600 more lines, nearly all in tests.

## Corrections to what this run said earlier

- Commits 657fe6d and Mail 24b7ede said a warning or failing check "runs on every health run".
  That was wrong: a check with a first failure is run again at the next health run to confirm
  it, a warning does not count, and once a problem is open the check goes back to its own pace.
  af73338 and Mail 29bd1ba corrected the comments, READMEs and changesets.
- The security fixes were first written with 2026-11-17, the day the review found them; their
  lines now say 2026-11-20, the day they shipped.

## Proposals: each needs the owner's yes

Each says what it would change in plain words and what is recommended. The two marked "card" are
asked in this review's thread.

### A. Deploys and rules

1. **Say in `rules.md` what a push does, and gate the fleet.** Every push to `main` updates every
   portal; the local `pnpm verify` is the only gate, and `rules.md` still says nothing deploys
   from the kit and names a pre-push hook that does not exist. Recommended: reword R-01 and R-02
   to say so, and have the fleet check the test portal's health before it updates the rest.
2. **Take out the newest-kit lookup on the public registry**, and retire the planned registry
   token and the deploy workflow's `packages: read`. Recommended: yes.
3. **Lower the Worker's size budget** from 1,024 KiB to 768 KiB (it is 705 KiB). A bigger build
   would then need a yes. Recommended: yes.

### B. Sending

1. **(card) After an unclear answer from a service that cannot spot a repeat** (every one but
   Resend), stop after the first try and show "may have been sent", instead of up to six tries.
   Recommended: stop after the first.
2. **Campaigns through Mailgun or Amazon SES leave without the one-click unsubscribe headers**
   that Gmail and Yahoo ask of bulk senders. Add them to both definitions, and refuse a route
   that cannot carry them. Recommended: yes, first of this list.
3. **"Forget" removes the mark of which list a person left**, so the next import of that list
   mails them again. Keep the mark. Recommended: yes.
4. **"Only this list" is offered to people added from another list.** Offer it only on the list
   they came from. Recommended: yes.
5. **A campaign's held batch is repeated on whichever account is active now**; keep the account
   on the batch. **A campaign's test is always bulk mail.** **A scheduled email checks its
   author's right when it leaves.** **A mailbox takes at most a set number of messages a day.**
   Recommended: yes to each.

### C. Who may do what

1. **Give only roles whose every permission you hold** at that place. Recommended: yes.
2. **Hide the company pages from someone who holds them at one location only**, and each
   module's sidebar row from those who cannot open it. Recommended: yes, with the next look pass.
3. **Ask again for a large campaign's approval** when people are added or the letter changes
   after the yes. Recommended: yes.
4. **Inbox presses need a write permission** and stay in the mailbox the person holds.
   Recommended: yes.
5. **Automations act with their maker's permissions at the time they run**, and stop when their
   part is switched off. Recommended: yes.
6. **Downloads of form answers and records need their own permission** and are written in the
   activity log; taking a shift needs the take permission; a profile and an account with no
   role are held to the same standing as the rest; a fresh sign-in for the powers that hand out
   personal data; a customer's sign-in ends when their email changes. Recommended: yes to each.
7. **An Owner who is the only decider answers their own request.** Kept as it is: the portal
   never needs a second person.

### D. Security headers

1. A script policy on staff pages (after Mail's inline scripts move to files), no caching of
   staff pages, a notification marked read by a press rather than by opening a link, and
   `/healthz` without the list of modules. Recommended: yes, as one batch.

### E. Data and the free plan

1. **Downloads stop at 5,000 rows without saying so**, and the hours and expenses downloads cut
   before the permission filter, so a manager can get fewer of their own rows. Recommended:
   refuse the hours download with "choose fewer days"; page the others.
2. **Tables that only grow**: the outbox keeps every message body, the activity log and email
   messages are kept for ever. Recommended: keep the outbox's sent rows 30 days, email messages
   and the activity log a year, each switchable.
3. **Additive indexes** for the forms list, folder moves, the activity log's filters and the
   inbox's lists (kit 0067 up, Mail 1020 up). Recommended: yes, each with its query plan test.
4. **Drop `campaigns_suppressed`**, a table nothing reads that still holds addresses (a contract
   migration). Recommended: yes.
5. **"Today" is counted in UTC** in invoices, quotes, expenses, time off and analytics, while the
   rest of the portal uses the company clock: an invoice made in the evening in Mexico City is
   dated the next day. Recommended: yes. And rename "Time zone for bookings" to "Company time
   zone", keeping its key. Recommended: yes.
6. **Home's 30 queries** into fewer batches, the health run alone in its tick, budget rows
   written only when they change, and Email preloading 5 pages instead of 15. Recommended: yes.
7. D1's queries per invocation: the kit counts 50 on Free; Cloudflare now allows 1,000 calls to
   its own services per invocation on Free. Recommended: keep the 45-query budget until D1's own
   limits row says otherwise.

### F. Smaller code, no change to what people see

1. **One test set-up**: a shared seed, one test Worker config factory, one harness (about 2,400
   lines). Recommended: yes, one module first.
2. **Quotes and invoices on one shared core** (about 1,100 lines in two steps). Recommended:
   after F1.
3. **One deploy path.** The client repository's own deploy (about 3,000 lines) beside the fleet.
   Recommended: decide once every client is on the fleet.
4. **Parts with no page**: remove the three Zag widgets and seven test-only primitives; give "My
   devices" and "My approvals" a page; keep time travel, key rewrap and the incident switch as
   documented API-only tools; remove `KIT-E-0429` and `ownerOnly`. Recommended: as written.
5. **The `select` part of daisyUI** (6.9 KB) styles the Select primitive; dropping it changes the
   look. **The search list is styled under a class nothing sets** (`.ui-go` against
   `ui-finder`); fixing it changes the look. Recommended: fix the search list; keep `select`.
6. **Seventeen smaller silent failures** (the scheduler's outcomes written in one batch, a failed
   settings save to KV, a problem marked open before its alert, invoice reminders on an exact
   day, and others): fix each with a test in the next batch. Recommended: yes.

## Directions to expand, within the free plan

From the stale-assumptions study (task 4), each checked against Cloudflare's pages on
2026-11-20. "Planned" means the roadmap or product plan has it already.

| # | Direction | Status | Needs |
|---|---|---|---|
| 1 | API keys made on the Developer page, so other systems can call in | planned | nothing new: hashed keys in D1, one public path with the kit's own check |
| 2 | Customers sign themselves up; a public privacy-request form | planned | Turnstile (a secret, for a yes) and possibly the rate-limit binding |
| 3 | Online payment of invoices through a payment provider defined as data | planned | nothing new: a sealed key and a signed webhook |
| 4 | Spanish, with English primary | planned | nothing new |
| 5 | SMS and WhatsApp as provider kinds | planned | nothing new: the queue and providers carry them |
| 6 | Automations that change records and run in steps | planned | nothing new: one Workflow step each |
| 7 | Taxes on quotes and invoices, a rate per line | planned | columns on existing tables |
| 8 | Each module's own series in Analytics | planned | daily roll-up rows in D1 |
| 9 | PDF files of quotes and invoices | new | a browser binding (for a yes); about 100 to 200 a day on Free |
| 10 | The Website edition in the same Worker | planned | a budget decision: page views share the 100,000 requests a day |
| 11 | The Vendor console across every portal | planned | nothing in a portal |
| 12 | Mail: signed click tracking, importing old mail | planned | nothing new |

Suggested order: 1, 2 and 3 first (each closes a loop a client meets on day one), then 4 and 7,
then 5, 6 and 8; 9 and 10 wait for the owner's decision on a new binding or a shared budget.

## How it was checked

- Each fix has a test that runs inside the Workers runtime on a real local database, seen failing
  against the code before the change, listed in its batch record or commit.
- The full `pnpm verify` before every push in both repositories; each commit quotes its summary
  line.
- Every removed part was searched for in every page, module, test and the browser script before
  it went; each removed style class the same way.

Not checked: any of it on a live portal or a phone (the phone tests below), a real provider's
outage, a real slow outside service (the time limits are checked to be set, not waited out), and
D1's own query limit row.

## Phone tests

They are owed in [the flows list](../phone-tests-flows.md) as P302 to P307.

| # | Open | You should see |
|---|---|---|
| P302 | Mail setup: press Send test | An answer within about 15 seconds: ready, or the next step to take |
| P303 | Expenses, Invoices and Quotes: open one with an amount in a currency other than yours | Amounts and currencies as before |
| P304 | Users, the Roles and Access tabs, then one role | Every list and button as before |
| P305 | Settings and System status: switches, check boxes, a select and a progress bar | They look as before |
| P306 | System status | Files storage, Campaign reputation and the email allowance checks are listed and green |
| P307 | Email's inbox: archive or delete every message of one conversation, then come back after an hour | The conversation is gone from every box |
