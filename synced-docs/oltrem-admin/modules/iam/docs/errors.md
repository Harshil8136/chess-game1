---
title: "@oltrem/iam: errors and tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src/errors.ts, modules/iam/test]
---

# @oltrem/iam: errors and tests

> Part of [the @oltrem/iam README](../README.md).

## Errors

The module owns `KIT-E-2000` to `2099` (`src/errors.ts`). Another Access application's sign-in is
the core's `KIT-E-0401`; a missing grant, request, approval, review or invitation the core's
`KIT-E-0404`.

| Code | When |
|---|---|
| `KIT-E-2001` | A bad capability list |
| `KIT-E-2002` | An unknown or inactive account |
| `KIT-E-2003` | A bad scope tree (over four levels, a loop, two roots) |
| `KIT-E-2004` | A dangerous action without a fresh sign-in |
| `KIT-E-2005` | An address the door let in with no active account here |
| `KIT-E-2006` | A sign-in that was ended (by hand, by its end time, by a block or switch off) |
| `KIT-E-2007` | A change beyond the actor's standing |
| `KIT-E-2008` | A change to one's own access |
| `KIT-E-2009` | Ending the last Owner |
| `KIT-E-2010` | A grant or change that does not fit the rules |
| `KIT-E-2011` | A second person's approval missing |
| `KIT-E-2012` | An approval that does not fit |
| `KIT-E-2013` | A review closed with grants undecided |
| `KIT-E-2014` | A second company |
| `KIT-E-2015` | An invitation that cannot be used (unknown, used, withdrawn, a week old) |
| `KIT-E-2016` | An invitation taken with another address |
| `KIT-E-2017` | A sign-in while the account is blocked, with the time it ends |
| `KIT-E-2018` | A grant, override or group for an API key's account |

## Tests

Inside the Workers runtime against the real migrations, under `test/`:

| File | What it proves |
|---|---|
| `iam.test.ts` | The registry's rules and stable bits; the tree's limits; a small tenant decided case by case (Owner, Vendor, floors, deny over allow, inheritance, groups, time, eligibility, overrides, the hash, "See it as" with sources, the Vendor holding a module registered later); 320 generated decisions on a 40-person tenant compared with a plain evaluator (`reference.ts`) |
| `sessions.test.ts` | KV writes counted (one, then none), a grant ending, the day passing, the dangerous route's re-read, a revoke seen next request, an ended sign-in, the audience from env (empty refuses all), an identity the runtime did not vouch for refused, the pipeline from `ctx.access` to the problem codes |
| `governance.test.ts` | Every rule refused then obeyed on a 12-person tenant: standing, self-edit, dates, Owners with approvals spent once, eligible grants, roles and members by standing, the tree, deny overrides, requests, reviews, audit rows with the policy hash, the last Owner |
| `handover.test.ts` | From an empty portal: only the Vendor creates the company, the first Owner accepts and stamps the tenant, Owners before and after the handover, the Owner minimum and a new module joining it, the three Vendor modes with a window that runs out |
| `routes.test.ts` | Every route end to end through the pipeline: company, open acceptance (wrong token or address refused), list shapes, invitations one and many (50 at most), grants, requests, approvals, reviews, Vendor modes, an ended device |
| `startup.test.ts` | The door's refusal runs nothing; the first request registers mounted modules; a same-version change and a bumped version are both seen, the Owner's session recompiled |
| `care.test.ts` | Only a person's own grant ending within the week is noticed; renewals noticed again; a refused message fails the run after the rest; the review check's states |
| `sign-in-alerts.test.ts` | New and unusual by browser and country (60 minutes), refused addresses once an hour, the alert's words and the extra's switch, Sign out everywhere, the weekly check |
| `sign-out.test.ts` | Signing out hands over to Access's sign-out; the module keeps no door |
| `setup-admit.test.ts` | People named at setup and their limits; several Vendors |
| `keys.test.ts`, `idempotency.test.ts` | API keys and Idempotency-Key |
| `aliases.test.ts`, `parts.test.ts`, `recorded.test.ts`, `ready-role-names.test.ts` | Permission names, switched-off parts, audit rows, the role renames |

The plan's `can()` timing budget is measured on the sandbox: the test runtime does not advance its
clock during a check.
