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
(Money), `people` (Users and access), `security` (Security) and `system` (System: the ids the
Vendor writes at setup, a section only the Vendor sees). Left out, a setting takes its module's
section (`sectionOf`: email and campaigns in Email, invoices, quotes and expenses in Money, iam,
users and time off in Users and access, alerts, audit and privacy in Security, backup, health
and settings in System, anything else in Company); every kit setting names its own. `unit` says
what a number counts (`days`, `MB`, `people`) and is shown beside its box. `setOn` names the
page where a value the Settings page cannot draw is set (`/files?show=limits`); the page links
there instead of showing the stored value (2026-11-24). Settings that mean the
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
(`archive/records/2026-11-01-cpu-budget.md`).

## The settings routes

`createSettingsModule` is the `settings` module, on bit plane 7, with two capabilities and two
routes; the Settings page of `@oltrem/screens` reads and writes through them.

| Route | Capability | What it does |
|---|---|---|
| `GET /api/settings/values` | `settings.read` | `{ items, standing, sections }`: every defined setting with its title and description, its section, its live value and its default (both left out for a sensitive one), where it comes from (`default`, `client`, `system`), who changed it last and when, the control it takes (`text`, `number` with `min`, `max` and `unit`, `switch`, `choice` with its `options`, `list` of words, or `other`, with `setOn` when it names one), read once from its schema while the Worker loads (a setting defined later, on the first list that shows it), and whether the caller may change it; how the caller stands (`vendor`, `owner`, `admin`); the sections in their order with their names. Read from D1, the truth, not the snapshot |
| `PUT /api/settings/values/:key` | `settings.manage` at the company | `{ value, reason? }`: refused when the key is unknown (`KIT-E-0404`), set in the client file (`KIT-E-0422`), above the caller (`KIT-E-0403`) or rejected by its schema (`KIT-E-0422`); otherwise saved through `Config.save` and audited as `settings.update`, with the value before and after (`changes`; a sensitive setting's only as changed) and the person's reason as `note` (2026-11-25) |

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
`settings.portal_tagline` (`TAGLINE_SETTING`, 2026-11-23) is the short line under the name in
the sidebar, at most 40 characters, empty for "Admin portal"; Owner-editable and immediate, on
the same card, read the same way.

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
(Home's Get started card; it stops no job), and since 2026-11-21 `iam.sign-in-alerts` (the email
about a new or unusual sign-in), `iam.unusual` (the warning about unusual sign-ins), `audit.since`
(Home's What changed card) and `health.status-pages` (Service status: the check that reads
Cloudflare's and the email services' status pages), and since 2026-11-22 `analytics.summary` (the
Monday summary email to the Owners) and `data.watch` (Database checks: the hourly check of each
connected database). An extra switched off is kept in
the same list by its id, so no new setting; `featuresOff(stored, mounted)` gives the jobs and
checks it stops, and the reader's set holds them beside the parts (ids with a dot never name a
part). Nothing they wrote is deleted. An extra marked `startsOff` (the daily seal, the nightly
backup and the drill reminder, since 2026-11-12: work on the timer that costs database rows every
day; Access's ending-access emails and access-review reminder, since 2026-11-21, the owner's pick:
mail and warnings a new portal did not ask for; the four extras added on 2026-11-21; the Monday
summary and Database checks, 2026-11-22) is off on a
new portal until someone switches it on (Sign-in alerts left that list on 2026-11-24, the owner's
pick: on for everyone): `EXTRAS_OFF_AT_FIRST` is the setting's default, so a
portal whose list was already saved keeps what it saved. The others are on until switched off.
An extra added later that should start off on every portal also needs a migration that adds it to
a saved list, as `0067_parts_quiet_extras.sql` does for the four of 2026-11-21 and
`0074_parts_summary_off.sql` for the Monday summary and `0077_parts_data_watch_off.sql` for
Database checks: each one missing
from a saved list is added, the configuration version moves and the change is written to the
settings history, so a client sees nothing new until someone switches it on.

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

Migration `0001_settings.sql`: `oltrem_meta` (the configuration version and, later, the client
id), `oltrem_settings` and `oltrem_settings_history`. Additive and idempotent; the ledger is
`oltrem_migrations`. Migration `0067_parts_quiet_extras.sql` (2026-11-21) adds the four extras of
that day to a saved parts list as off (above); a portal that never saved the list keeps the
default and gets no row. Migration `0074_parts_summary_off.sql` (2026-11-22) does the same for
the Monday summary, and `0077_parts_data_watch_off.sql` (2026-11-22) for Database checks.
Migration `0085_parts_sign_in_alerts_on.sql` (2026-11-24) goes the other way: it takes Sign-in
alerts out of a saved list, unless the settings history shows the list without them since they
existed, which means an admin switched them off after they had been on.

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
