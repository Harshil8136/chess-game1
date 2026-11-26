---
title: "@oltrem/core-config: the parts switches, storage, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-config/src/parts.ts, module.ts, migrations]
---

# @oltrem/core-config: the parts switches, storage, tests

> Part of [the @oltrem/core-config README](../README.md).

## The parts switches

Given `parts: { modules }`, the settings module keeps the modules switched off live, with no
deploy: one setting, `settings.parts_off` (`PARTS_SETTING`, the ids off), kept off the Settings
page's free edit. `settings.parts` (admin, no floor, so every Owner and the Vendor hold it; fresh
sign-in to read or save) changes it.

| In `src/parts.ts` | What it is |
|---|---|
| `KIT_PARTS` | Each kit module's name, line, `core`, `requires` and `features` (the screens' copy in `packages/screens/src/names.ts` is held to it by a test) |
| `CORE_PARTS` | Never off: iam, users, settings, audit, health, alerts, jobs, backup |
| `PART_PRESETS` | Everything; Email only (the email parts and Deployments); the route adds Nothing optional |
| `partsOff(stored, mounted)` | Drops a core part or an unmounted id and takes along a part whose needs are off, so a hand-written list stays safe |
| `partsRefusal(wanted, mounted)` | Why a list cannot be saved, in the page's words |
| `createPartsReader` | Rebuilds the set only when the snapshot's list changes: one comparison, no I/O |
| `BUSINESS_KINDS`, `kindOff` | Five kinds (Services by appointment, Shop, Office, Field team, Something else), each with the parts it does not use and a starter Lists list (Services, Products, Projects or Sites); never a core part or Lists; Something else leaves the parts |

**Optional extras.** A part may list `features` the portal works without, each with the jobs and
checks it stops, kept in the same list by its id (no new setting; nothing they wrote is deleted;
`featuresOff` gives what they stop). Those marked `startsOff` are off on a new portal
(`EXTRAS_OFF_AT_FIRST` is the setting's default); a saved list keeps what it saved, so an extra that
should start off everywhere also needs a migration adding it to saved lists.

| Extra | Stops | Starts |
|---|---|---|
| `iam.expiring` | Emails about access ending | Off |
| `iam.reviews` | The overdue-review warning | Off |
| `iam.sign-in-alerts` | The new or unusual sign-in email | On |
| `iam.unusual` | The unusual sign-ins warning | Off |
| `settings.get-started` | Home's Get started card | On |
| `audit.seal` | The daily seal, its recheck and check | Off |
| `audit.since` | Home's What changed card | Off |
| `health.status-pages` | Service status | Off |
| `data.watch` | The hourly database checks | Off |
| `analytics.summary` | The Monday summary email | Off |
| `analytics.unusual` | The Unusual days warning | Off |
| `backup.nightly` | The nightly schedule, a first copy, the age check (a copy by hand still runs) | Off |
| `backup.drill` | The restore-drill warning | Off |

| Route | Needs | What it does |
|---|---|---|
| `GET /api/settings/parts` | `settings.parts` | Every mounted part: on or off, always on, needs and needed by, its extras with what each stops (`skips`); the presets; `business` and the `kinds` |
| `PUT /api/settings/parts` | `settings.parts` at the company | `{ off, business?, reason? }`: an unknown part or extra, a core part or one another part needs is `KIT-E-0422`, named; else saved (every Worker within the snapshot's minute), audited `settings.parts`, then `parts.changed`, where the template wakes Status |

The set goes to `createApp`, `createWorker`, the scheduler, the flows, health and IAM as their
`off`. A part's data is never touched, so switching back restores everything. The kind
(`settings.business`, `BUSINESS_SETTING`) is saved only with the parts; while parts are on, a Get
started step "Set up for your business" (`/start`) is done once a kind is picked or the modules
were ever saved.

## Storage

| Migration | Does |
|---|---|
| `0001_settings.sql` | `oltrem_meta` (the configuration version), `oltrem_settings`, `oltrem_settings_history`; the ledger is `oltrem_migrations` |
| `0067_parts_quiet_extras.sql`, `0074_parts_summary_off.sql`, `0077_parts_data_watch_off.sql`, `0103_parts_unusual_off.sql` | Add later starts-off extras to a saved list, move the version and write history once; a portal with no saved list gets no row |
| `0085_parts_sign_in_alerts_on.sql` | Takes Sign-in alerts out of a saved list, unless history shows an admin switched them off after they were on |

## Tests

Inside the Workers runtime with the migrations applied: precedence and locks, refusals, the no-I/O
hot path, stale-then-refresh, KV and D1 failures, read-your-writes (`test/config.test.ts`,
`layers.test.ts`, `client.test.ts`, `define.test.ts`); the two routes as the pipeline calls them
(`test/module.test.ts`); the clock across daylight saving, a year end and a leap day
(`test/clock.test.ts`); the extra migrations, run twice (`test/quiet-extras.test.ts`); the kinds
against the catalogue, saving a kind with its audit row and Get started step, and the free edit
refused (`test/parts.test.ts`).
