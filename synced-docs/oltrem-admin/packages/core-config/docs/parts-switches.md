---
title: "@oltrem/core-config: The parts switches; Storage this package owns; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-config/src; split from packages/core-config/README.md]
---

# @oltrem/core-config: The parts switches; Storage this package owns; Tests

> Part of [the @oltrem/core-config README](../README.md).

## The parts switches

Given `parts: { modules }`, the settings module also keeps the portal's parts (its modules) switched
off while it runs, with no deploy and no migration: one live setting, `settings.parts_off`
(`PARTS_SETTING`, the list of module ids switched off), kept off the Settings page and its free
edit. Whoever holds `settings.parts` changes it: an admin capability with no floor, so every Owner
holds it, the Vendor holds it by kind, and an Owner may put it in a role; it asks for a sign-in
within the last few minutes (`freshSignIn`), for reading the list as for saving it. `src/parts.ts`
holds the catalogue (`KIT_PARTS`: each kit module's name, one line, `core`, `requires`; the screens
name each part with a copy of these names, `packages/screens/src/names.ts`, which a test holds to
this list), the presets (`PART_PRESETS`: Everything, Email only, which keeps the email parts and
Deployments on; the route adds Nothing optional, every part but the core off) and the rule:
`partsOff(stored, mounted)` never switches a core part off (`CORE_PARTS`: iam, users, settings,
audit, health, alerts and, backup, so no switch or preset pauses the nightly copy and a stored list
that names it leaves it on), drops an id nothing mounts and takes along a part whose needs are off,
so a list written by hand stays safe; `partsRefusal(wanted, mounted)` says, in the page's words, why
a list cannot be saved; `createPartsReader` makes the set again only when the snapshot's list
changes, so a request pays one comparison and no I/O.

**Optional extras** (since 2026-11-03, the owner's ask): a part, a core one included, may list
`features`, each an extra the portal works without, with the ids of the jobs and health checks it
stops. The kit's: `audit.seal` (the daily seal, its recheck and its check), `iam.expiring` (the
emails about access ending), `iam.reviews` (the overdue-review warning), `backup.nightly` (the
nightly copy's schedule, a new portal's first copy and the check of the newest copy's age; a copy by
hand still runs), `backup.drill` (the restore-drill warning), and `settings.get-started` (Home's Get
started card; it stops no job), and `iam.sign-in-alerts` (the email about a new or unusual sign-in),
`iam.unusual` (the warning about unusual sign-ins), `audit.since` (Home's What changed card) and
`health.status-pages` (Service status: the check that reads Cloudflare's and the email services'
status pages), and `analytics.summary` (the Monday summary email to the Owners), `analytics.unusual`
(Unusual days: the morning warning on Alerts when yesterday was far from usual) and `data.watch`
(Database checks: the hourly check of each connected database). An extra switched off is kept in the
same list by its id, so no new setting; `featuresOff(stored, mounted)` gives the jobs and checks it
stops, and the reader's set holds them beside the parts (ids with a dot never name a part). Nothing
they wrote is deleted. An extra marked `startsOff` (the daily seal, the nightly backup and the drill
reminder, since 2026-11-12: work on the timer that costs database rows every day; Access's
ending-access emails and access-review reminder, the owner's pick: mail and warnings a new portal
did not ask for; the four extras added on 2026-11-21; the Monday summary and Database checks,
2026-11-22; Unusual days, 2026-11-26) is off on a new portal until someone switches it on (Sign-in alerts left that list on
2026-11-24, the owner's pick: on for everyone): `EXTRAS_OFF_AT_FIRST` is the setting's default, so a
portal whose list was already saved keeps what it saved. The others are on until switched off. An
extra added later that should start off on every portal also needs a migration that adds it to a
saved list, as `0067_parts_quiet_extras.sql` does for the four of 2026-11-21 and
`0074_parts_summary_off.sql` for the Monday summary, `0077_parts_data_watch_off.sql` for Database
checks and `0103_parts_unusual_off.sql` for Unusual days: each one missing from a saved list is added, the configuration version moves and the change
is written to the settings history, so a client sees nothing new until someone switches it on.

| Route | Capability | What it does |
|---|---|---|
| `GET /api/settings/parts` | `settings.parts` (no floor, fresh sign-in) | every mounted part: on or off, always on, what it needs and what needs it, its extras each on or off with what each stops (`skips`, so the screens can offer the switch beside a warning of one of them, 2026-11-14); the list off, extras included; the presets with the parts each switches off; the kind of business picked (`business`) and the kinds (`kinds`), each with the parts it switches off and the list it starts |
| `PUT /api/settings/parts` | `settings.parts` at the company | `{ off, business?, reason? }` (parts and extras, and the kind of business below): refused (`KIT-E-0422`) for an unknown part or extra, a core part, or one another part left on needs, naming them; otherwise saved through `Config.save` (the saver sees it at once, every Worker within the snapshot's minute) and audited as `settings.parts` with what was switched off and on; then `parts.changed`, where the template wakes Status so a check switched off closes its alert within minutes |

The client template hands the set to `createApp`, `createWorker`, the scheduler, the flows, System
health and the IAM module as their `off` option; each says what it does with it. A switched-off
part's data is never touched, so switching it back on restores everything.

**The kind of business** (since 2026-11-22, the owner's pick "Starting setup"): `src/parts.ts`
holds `BUSINESS_KINDS`, five kinds in today's words (Services by appointment, Shop, Office, Field
team, Something else), each with the optional parts it does not use and one starter list for the
Records part (its name and columns: Services, Products, Projects or Sites; none for Something
else). `kindOff(kind, mounted)` gives the parts list a kind saves, through `partsOff`, so it never
switches a core part or Records off; Something else answers null and leaves the parts as they
are. The kind picked is one live setting, `settings.business` (`BUSINESS_SETTING`, empty until
picked), saved only with the parts on `PUT /api/settings/parts` and refused on the Settings
page's free edit (editable by whoever may switch the modules). While parts are on, the module adds
a Get started step, "Set up for your business" (`/start`), done once a kind is picked or once the
modules were ever saved: a portal already in use chose its modules, and a kind could switch off
ones it uses. The page that picks it, makes the roles and
places and starts the list is the screens' `/start`.

## Storage this package owns

Migration `0001_settings.sql`: `oltrem_meta` (the configuration version and, later, the client id),
`oltrem_settings` and `oltrem_settings_history`. Additive and idempotent; the ledger is
`oltrem_migrations`. Migration `0067_parts_quiet_extras.sql` adds the four extras of that day to a
saved parts list as off (above); a portal that never saved the list keeps the default and gets no
row. Migration `0074_parts_summary_off.sql` does the same for the Monday summary,
`0077_parts_data_watch_off.sql` for Database checks and `0103_parts_unusual_off.sql` for Unusual
days. Migration `0085_parts_sign_in_alerts_on.sql`
goes the other way: it takes Sign-in alerts out of a saved list, unless the settings history shows
the list without them since they existed, which means an admin switched them off after they had been
on.

## Tests

`pnpm test:packages` runs the suite inside the Workers runtime with the bindings of
`wrangler.jsonc` (local, in-memory) and the migration applied first. The tests prove the
precedence and the locks, the refusals, the no-I/O hot path, the stale-then-refresh behaviour,
the fallbacks when KV or D1 fail, and read-your-writes. `test/module.test.ts` calls the two
routes as the pipeline does: the list with each value's source and who may change it, a save seen
at once with its history and audit rows, and the four refusals. `test/clock.test.ts` holds the clock to the days it moves
(New York), a time skipped and a time repeated, the day after across a year and a leap day.
`test/quiet-extras.test.ts` runs migration `0067` on a saved list: the four extras added as off,
nothing else changed, the version moved and the history written once, a second run changing
nothing, and a portal with no saved list given no row; the same for `0074` and `0077`; and `0085`
taking Sign-in alerts out of a list that held them since they began, but not where an admin
switched them off after they had been on. `test/parts.test.ts` holds the
kinds to the catalogue (each kind's parts switchable, Records never off), and saves a kind with the
parts: the setting, the audit row, the Get started step done (and done once modules were saved
with no kind), a kind that is not one refused by the route's schema, and the Settings page's edit
refused.
