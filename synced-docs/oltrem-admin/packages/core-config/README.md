# @oltrem/core-config

The configuration layers of the kit, as the plan's section 5 describes them, and the one
registry every setting is defined in. Everything about a setting is data: the Settings page,
the seed, the snapshot validator, the JSON Schema and the reference page render from the same
definition.

## The four layers

| Layer | Set by | Lives in | Changes |
|---|---|---|---|
| L0 kit defaults | the kit, in `defineSetting` | the code | with a kit release |
| L1 client file | the vendor, at onboarding | the client repository, bundled into the Worker | with a deploy |
| L2 system settings | the client's admins | D1 (`oltrem_settings`, the truth), one KV snapshot, the Worker's memory | live |
| L3 secrets | the vendor or the owner | Worker secrets, never in a config object | without a deploy |

L2 overrides L1 overrides L0. A `client`-layer key is **locked**: a value for it in D1 is
ignored and reported, so no live edit can take a portal down. Secrets are never merged into
configuration: a setting says *which* provider, never its key.

## The read path

```mermaid
flowchart LR
  R["request: config.ensure(ctx.waitUntil)"] --> M{"memory"}
  M -- "fresh" --> V["config.get(key): no I/O"]
  M -- "stale" --> V
  M -- "stale" -.->|after the response| KV["KV: one snapshot key"]
  M -- "cold" --> KV
  KV -- "missing" --> D1["D1: oltrem_settings (truth)"]
  D1 --> KV
  S["config.save(...)"] --> D1
  S --> KV
  S --> M
```

Reads never leave memory while the snapshot is fresh (one minute by default). A stale snapshot
is served as it is and refreshed after the response. A cold Worker reads KV once; a KV miss
rebuilds the snapshot from D1 and fills KV. So does a snapshot another deploy built: each snapshot
carries a short hash of the settings its Worker defines, their defaults and the client file, so
after a deploy that adds a module's setting, changes a default or the client file, the first read
rebuilds from D1 and the new values show at once, not after the next save. A failed read keeps the last good copy, or the kit
and client defaults when there is none, and reports one event; nothing throws on the hot path.
A save writes D1 (the row, its history row, the version bump, in one transaction), rebuilds
the snapshot, writes KV once and updates the saving instance, so the admin who saved sees the
value at once; `ensureVersion` lets a request that carries a newer version catch up from D1.

## Using it

```ts
import * as z from 'zod/mini';
import { createConfig, defineSetting, settings } from '@oltrem/core-config';

defineSetting({
  key: 'email.daily_limit',
  title: 'Daily email limit',
  description: 'Hard cap on emails sent per UTC day. 0 disables sending.',
  schema: z.number().check(z.int(), z.minimum(0), z.maximum(10_000)),
  default: 500,
  layer: 'system',
  editableBy: 'owner',
  takesEffect: 'immediately',
  module: 'email',
});

const config = createConfig({ registry: settings, client: clientFile, db: env.DB, cache: env.CACHE });
// per request:
await config.ensure(ctx.waitUntil.bind(ctx));
const limit = config.get<number>('email.daily_limit');
```

A definition is refused at once when its key is not `module.name` (the module segment as a
module id, dashes allowed; the name in lower snake case), when its module does not match the key,
when the key already exists, when it names a section the page does not have, or when its unit is
not a short word. A default that fails its own schema is refused by `settings.checkDefaults()`,
which throws one error naming every such default: the client template's tests run it over every
mounted module's settings, so a bad default fails the build. It is not run when the Worker loads,
where parsing every default took a third of the start-up time.

Two optional fields place a setting on the Settings page. `section` is one of `SETTING_SECTIONS`,
shown in this fixed order with these names: `company` (Company), `email` (Email), `money`
(Money), `people` (Users & access), `security` (Security) and `system` (System: the ids the
Vendor writes at setup, a section only the Vendor sees). Left out, a setting takes its module's
section (`sectionOf`: email and campaigns in Email, invoices, quotes and expenses in Money, iam,
users and time off in Users & access, alerts, audit and privacy in Security, backup, health
and settings in System, anything else in Company); every kit setting names its own. `unit` says
what a number counts (`days`, `MB`, `people`) and is shown beside its box. Settings that mean the
same in several modules keep one key each (`invoices.currency`, `quotes.currency`,
`expenses.currency`); the page shows them together under titles that say which is which.

## The company's clock

A portal keeps every moment in UTC and shows it on the company's clock, the time zone a setting
names. `wallClock(at, zone)` gives the day and time on that clock, `instant(day, time, zone)` the
moment a day and time name (a time the clocks skip lands an hour later, one they repeat takes the
first), `nextDay` the day after, and `isTimeZone` whether Intl knows a zone. Intl holds every
zone's offsets, daylight saving included, so no table is kept. The bookings and time clock modules
read them. Each zone's formatter is made once per isolate and kept, and so is whether a text
names a zone: making one costs far more CPU than using it, and the first one made in an isolate
also loads the runtime's time zone data (10 to 30 ms measured locally). `warmClock()` makes one
and checks a zone; the client template calls it in the Worker's global scope, which runs while
the Worker loads, outside the CPU time of its first request or tick
(`docs/records/2026-11-01-cpu-budget.md`).

## The settings routes

`createSettingsModule` is the `settings` module, on bit plane 7, with two capabilities and two
routes; the Settings page of `@oltrem/screens` reads and writes through them.

| Route | Capability | What it does |
|---|---|---|
| `GET /api/settings/values` | `settings.read` | `{ items, standing, sections }`: every defined setting with its title and description, its section, its live value and its default (both left out for a sensitive one), where it comes from (`default`, `client`, `system`), who changed it last and when, the control it takes (`text`, `number` with `min`, `max` and `unit`, `switch`, `choice` with its `options`, `list` of words, or `other`), read once from its schema, and whether the caller may change it; how the caller stands (`vendor`, `owner`, `admin`); the sections in their order with their names. Read from D1, the truth, not the snapshot |
| `PUT /api/settings/values/:key` | `settings.manage` | `{ value, reason? }`: refused when the key is unknown (`KIT-E-0404`), set in the client file (`KIT-E-0422`), above the caller (`KIT-E-0403`) or rejected by its schema (`KIT-E-0422`); otherwise saved through `Config.save` and audited as `settings.update` |

Who may change a setting is its `editableBy` read against the caller's standing, which the client
hands in as `standing` from its session: the Vendor may change every live setting, an Owner the
`owner` and `admin` ones, anyone else who holds `settings.manage` the `admin` ones. The audit row
needs `oltrem_audit_log` from `@oltrem/core-audit`.

## The portal's look for everyone

`settings.look` (`LOOK_SETTING`, since 2026-11-03) is the look an Owner set for everyone on the
Look page, `<palette>.<background>` as the screens name them (`emerald.dots`); empty, its
default, leaves the client file's `brand.look`. Owner-editable, immediate, in the System
section of the Settings page too. The settings module always registers it. The template reads it
from memory with the parts on every request, so a change costs no read of its own.

## The portal's name and icon

`settings.portal_name` (`NAME_SETTING`) and `settings.portal_mark` (`MARK_SETTING`), since
2026-11-11, are what the sidebar, the phone's bar and the browser tab show for the portal: a name
of at most 40 characters (empty leaves the client file's `name`), and the tile beside it, empty
for the portal's initials, `icon:<name>` for one of the screens' icons, or
`picture:<file>` for a small picture the screens keep in the bucket under `ui/mark/`. Both are
Owner-editable and immediate, set on the Settings page's Name and icon card, and always
registered by the settings module; the template reads them from memory with the parts.

## The parts switches

Given `parts: { modules }`, the settings module also keeps the portal's parts (its modules)
switched off while it runs, with no deploy and no migration: one live setting,
`settings.parts_off` (`PARTS_SETTING`, the list of module ids switched off), kept off the
Settings page and its free edit. Whoever holds `settings.parts` changes it: an admin capability
with no floor (since 2026-10-31; it was the Vendor's alone), so every Owner holds it, the Vendor
holds it by kind, and an Owner may put it in a role; it asks for a sign-in within the last few
minutes (`freshSignIn`), for reading the list as for saving it. `src/parts.ts` holds the catalogue (`KIT_PARTS`: each
kit module's name, one line, `core`, `requires`; the screens name each part with a copy of
these names, `packages/screens/src/names.ts`, which a test holds to this list), the presets (`PART_PRESETS`: Everything, Email
only, which keeps the email parts and Deployments on; the route adds Nothing optional, every part but the core off) and the rule: `partsOff(stored, mounted)` never switches a core part off (`CORE_PARTS`:
iam, users, settings, audit, health, alerts and, since 2026-11-01, backup, so no switch or preset
pauses the nightly copy and a stored list that names it leaves it on), drops an id nothing mounts and takes along a part
whose needs are off, so a list written by hand stays safe; `partsRefusal(wanted, mounted)` says,
in the page's words, why a list cannot be saved; `createPartsReader` makes the set again only when
the snapshot's list changes, so a request pays one comparison and no I/O.

**Optional extras** (since 2026-11-03, the owner's ask): a part, a core one included, may list
`features`, each an extra the portal works without, with the ids of the jobs and health checks
it stops. The kit's: `audit.seal` (the daily seal, its recheck and its check), `iam.expiring`
(the emails about access ending), `iam.reviews` (the overdue-review warning), `backup.nightly`
(the nightly copy's schedule, a new portal's first copy and the check of the newest copy's age; a
copy by hand still runs), `backup.drill` (the restore-drill warning), and `settings.get-started`
(Home's Get started card; it stops no job). An extra switched off is kept in
the same list by its id, so no new setting; `featuresOff(stored, mounted)` gives the jobs and
checks it stops, and the reader's set holds them beside the parts (ids with a dot never name a
part). Nothing they wrote is deleted. An extra marked `startsOff` (the daily seal, the nightly
backup and the drill reminder, since 2026-11-12: work on the timer that costs database rows every
day) is off on a new portal until someone switches it on: `EXTRAS_OFF_AT_FIRST` is the setting's
default, so a portal whose list was already saved keeps what it saved. The others are on until
switched off.

| Route | Capability | What it does |
|---|---|---|
| `GET /api/settings/parts` | `settings.parts` (no floor, fresh sign-in) | every mounted part: on or off, always on, what it needs and what needs it, its extras each on or off with what each stops (`skips`, so the screens can offer the switch beside a warning of one of them, 2026-11-14); the list off, extras included; the presets with the parts each switches off |
| `PUT /api/settings/parts` | `settings.parts` | `{ off, reason? }` (parts and extras): refused (`KIT-E-0422`) for an unknown part or extra, a core part, or one another part left on needs, naming them; otherwise saved through `Config.save` (the saver sees it at once, every Worker within the snapshot's minute) and audited as `settings.parts` with what was switched off and on; then `parts.changed`, where the template wakes System status so a check switched off closes its alert within minutes |

The client template hands the set to `createApp`, `createWorker`, the scheduler, the flows, System
health and the IAM module as their `off` option; each says what it does with it. A switched-off
part's data is never touched, so switching it back on restores everything.

## Storage this package owns

Migration `0001_settings.sql`: `oltrem_meta` (the configuration version and, later, the client
id), `oltrem_settings` and `oltrem_settings_history`. Additive and idempotent; the ledger is
`oltrem_migrations`.

## Tests

`pnpm test:packages` runs the suite inside the Workers runtime with the bindings of
`wrangler.jsonc` (local, in-memory) and the migration applied first. The tests prove the
precedence and the locks, the refusals, the no-I/O hot path, the stale-then-refresh behaviour,
the fallbacks when KV or D1 fail, and read-your-writes. `test/module.test.ts` calls the two
routes as the pipeline does: the list with each value's source and who may change it, a save seen
at once with its history and audit rows, and the four refusals. `test/clock.test.ts` holds the clock to the days it moves
(New York), a time skipped and a time repeated, the day after across a year and a leap day.
