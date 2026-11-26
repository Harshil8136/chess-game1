---
title: "@oltrem/iam: Errors; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: Errors; Tests

> Part of [the @oltrem/iam README](../README.md).

## Errors

The module owns the `2000` to `2099` block: `KIT-E-2001` a bad capability list, `KIT-E-2002` an
unknown or inactive account, `KIT-E-2003` a bad scope tree (deeper than four levels, a loop, or
more than one root), `KIT-E-2004` a dangerous action without a fresh sign-in, `KIT-E-2005` an
email the door let in that has no active account here, `KIT-E-2006` a sign-in that was ended
(from the sessions list, by its end time, or by a block or a switch off), `KIT-E-2007` a change beyond the actor's standing, `KIT-E-2008` a change
to one's own access, `KIT-E-2009` the last Owner, `KIT-E-2010` a grant that does not fit the
rules, `KIT-E-2011` a second person's approval missing, `KIT-E-2012` an approval that does not
fit, `KIT-E-2013` a review closed with grants undecided, `KIT-E-2014` a second company,
`KIT-E-2015` an invitation that cannot be used (unknown, used, withdrawn, a week old),
`KIT-E-2016` an invitation taken with another address, `KIT-E-2017` a sign-in while the account
is blocked, with the time it ends (`iam_principals.blocked_until`, migration `0065`, written by
the Users module). A sign-in at another Access application
answers with the core's `KIT-E-0401`; a grant, request, approval, review or invitation that does
not exist with the core's `KIT-E-0404`.

## Tests

`test/sign-out.test.ts`: signing out ends the sign-in and hands over to Cloudflare's own sign-out,
and the module keeps no door (no hook, no job, no health check, only `iam.setup_people`).

Inside the Workers runtime, against the real migration: the registry's rules and bit stability;
the tree's limits; a small tenant decided case by case (owner, vendor, floors, deny over allow,
inheritance, siblings, groups, time, eligibility, overrides, the hash and the compile record,
"See it as" with where each permission comes from, and the Vendor holding a module registered
after its map was compiled, at every scope, its floors included);
and a synthetic tenant of three locations, four departments, twelve roles and forty people on
which 320 generated decisions of the compiled check are compared with a plain evaluator that
reads the rows one question at a time (`test/reference.ts`). The sessions are tested with the KV
writes counted (one on the first request, none on the next), a grant ending and the day passing,
the dangerous route's re-read, a revoke seen on the next request, an ended sign-in, the audience
read from the env with an empty one refusing everyone, an identity the runtime did not vouch for
refused under every audience, and the whole pipeline from the runtime's `ctx.access` to the
problem codes. The governance is tested on a tenant of
four scopes, four roles and twelve people, every rule refused and then obeyed: the standing at a
scope, the self-edit, the dates, the Owner made and unmade with approvals that fit one change
once, an eligible grant activated and lapsed, roles edited only with what is held where they are
granted, members placed by the standing over the group's grants, the tree's depth, a deny
override beating the role, a request decided in the decider's name, a review closed only when
decided, the audit rows with the policy hash and the deferred write, and the last Owner. The
handover is tested from an empty portal: the Vendor creates the company and nobody else can, the
first Owner accepts with the invited address and the tenant is stamped, a second Owner invited
before the handover and a third only with a second person after it, an ordinary invitation under
the grant rules, the Vendor refused every role, the Owner role's minimum and a new module's
capability joining it at deploy, and the three ways the Vendor may enter, with a window that runs
out by itself. The plan's `can()` timing budget is measured on the sandbox, not here: the test
runtime does not advance its clock during a check. The routes are tested end to end through the
pipeline, from an empty portal: the Vendor creates the company over its route, the first Owner
with no account accepts through the open route and is refused with a wrong token or another
address, the lists answer with their shapes and refuse a bad page, the Owner shapes the company
and invites a clerk who reads but cannot shape, invites several at once (duplicates folded, their
own address refused, the others made and emailed, a failing sender leaving the link to pass on,
fifty at most), grants are made, activated, ended and overridden,
a request is decided and another withdrawn, an approval asked and refused to the wrong person, a
review decided and closed, the three Vendor modes with the incident and the window, and a sign-in
ended from the devices list and refused from then on. The startup hook is tested through three
apps on one IAM instance: the door's refusal runs nothing, the first request past it registers
both mounted modules, the Owner holds a new module's capability at once, a declaration grown
under the same version is not seen, and a bumped version is, with the index replaced and the
Owner's session recompiled without a new sign-in. The care is tested on the rows: only a
person's own grant ending within the week is noticed (not one ended, later, eligible, a deny, an
inactive person's, a group's or an activation), a renewed end is noticed again, a refused message
fails the run after the others, and the review check moves from none due, to none yet, to on time,
to past due, to none for a quarter. `test/sign-in-alerts.test.ts`: the first sign-in and the same
browser after an update are nothing new, another browser is, a known browser from another country
within the hour is unusual and after 61 minutes only new, a row without a country compares by
browser alone; an address with no account is recorded once an hour; the alert names the browser,
the country and the way out, and is sent only while the extra is on; Sign out everywhere ends
both browsers; the week's check warns and counts.
