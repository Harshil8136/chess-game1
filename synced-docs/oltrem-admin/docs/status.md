---
title: "Where things stand: what still waits"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [this repository; archive/records/2026-11-26-status-history.md]
---

# Where things stand: what still waits

> **In plain words.** The kit's six phases are built, and the modules and screens of
> [the roadmap](roadmap.md) are built on them. This page lists only what is not done, and on whom
> it waits. How each part was built is in [the records](../archive/records/README.md); the full
> table as it stood on 26 November is [frozen there](../archive/records/2026-11-26-status-history.md).

| Phase | What waits | On whom |
|---|---|---|
| 0 | A sandbox client: a fresh Cloudflare account and a private client repository from `templates/client` | the owner |
| 0 | The CPU measurement of three sample screens in the sandbox | the sandbox |
| 0 | The first week's open questions: the configuration layers, encryption in the Worker, the test runner on GitHub, the secrets cap | not started |
| 1 | The acceptance: a blank client repository deploys from GitHub with no hand-pasted id and one stored token, the doctor green, a red push not deployed | the sandbox |
| 3 | The migration ledger check at the Worker's start | not started |
| 3 | The manifest's words in other languages, per-module docs and contract tests generated from manifests | not started (English first; Spanish later) |
| 4 | The acceptance: two providers as rows with test accounts, detection on the sandbox domain, a canary and a delivery webhook round trip, failover by disabling the active row | the sandbox and the owner's test accounts |
| 5 | The acceptance: a nightly export of the sandbox under the bucket lock, a restore drill, the kit version, every budget on Status | the sandbox |
| 6 | Publishing to GitHub Packages and previews on a branch | not planned: Oltrem stays private, each client repository carries the kit inside it |
| All | The phone tests owed | the owner: [the lists](phone-tests.md) |
