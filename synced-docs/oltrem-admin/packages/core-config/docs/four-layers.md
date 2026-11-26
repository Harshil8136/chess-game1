---
title: "@oltrem/core-config: the four layers, the read path, the routes, the clock"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-config/src/config.ts, define.ts, module.ts, clock.ts]
---

# @oltrem/core-config: the four layers, the read path, the routes, the clock

> Part of [the @oltrem/core-config README](../README.md).

## The four layers

| Layer | Set by | Lives in | Changes |
|---|---|---|---|
| L0 kit defaults | The kit, in `defineSetting` | The code | With a kit release |
| L1 client file | The vendor at onboarding | The client repository, bundled | With a deploy |
| L2 system settings | The client's admins | D1 `oltrem_settings` (the truth), one KV snapshot, memory | Live |
| L3 secrets | The vendor or owner | Worker secrets, never in config | Without a deploy |

L2 overrides L1 overrides L0. A `client`-layer key is locked: a D1 value for it is ignored and
reported. A setting names which provider, never its key.

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

Reads stay in memory while the snapshot is fresh (`ttlMs`, a minute). A stale one is served and
refreshed after the response; a cold Worker reads KV once; a miss rebuilds from D1 and fills KV.
Each snapshot carries a short hash of the settings its Worker defines, their defaults and the
client file, so after a deploy that changes them the first read rebuilds from D1. A failed read
keeps the last good copy (or the defaults) and reports one event; nothing throws on the hot path.
A save writes the row, its history row and the version bump in one transaction, rebuilds the
snapshot, writes KV once and updates the saving instance; `ensureVersion` lets a request carrying a
newer version catch up from D1.

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

A definition is refused at once when its key is not `module.name` (module id, name in lower snake
case), its module does not match, the key exists, its section is unknown or its unit is not a
short word. `settings.checkDefaults()` throws one error naming every default that fails its own
schema; the template's tests run it, not the Worker at load.

| Field | Does |
|---|---|
| `section` | One of `SETTING_SECTIONS` in this order: `company`, `email`, `money`, `people` (Users and access), `security`, `system` (Vendor only); left out, the module's (`sectionOf`) |
| `unit` | What a number counts (`days`, `MB`, `people`), shown beside its box |
| `setOn` | The page where a value the Settings page cannot draw is set (`/files?show=limits`) |

Settings meaning the same in several modules keep a key each (`invoices.currency`,
`quotes.currency`), shown together.

## The settings routes

`createSettingsModule` is the `settings` module (bit plane 7); the Settings page reads and writes
through it.

| Route | Needs | What it does |
|---|---|---|
| `GET /api/settings/values` | `settings.read` | `{ items, standing, sections }`: each setting's title, description, section, live value and default (left out when sensitive), source (`default`, `client`, `system`), last change, control (`text`, `number` with `min`, `max`, `unit`, `switch`, `choice`, `list`, `other` with `setOn`) and whether the caller may change it; read from D1 |
| `PUT /api/settings/values/:key` | `settings.manage` at the company | `{ value, reason? }`: unknown `KIT-E-0404`, set in the client file or failing its schema `KIT-E-0422`, above the caller `KIT-E-0403`; else saved and audited `settings.update` with `changes` (a sensitive one only as changed) and the reason as `note` |

`editableBy` is read against the caller's `standing` from the session: the Vendor changes every
live setting, an Owner `owner` and `admin` ones, others with `settings.manage` the `admin` ones.

| Always registered | What it holds |
|---|---|
| `settings.look` (`LOOK_SETTING`) | The look an Owner set for everyone, `<palette>.<background>` (`emerald.dots`); empty leaves the client file's `brand.look` |
| `settings.portal_name` (`NAME_SETTING`) | The portal's name, 40 characters; empty, the client file's `name` |
| `settings.portal_mark` (`MARK_SETTING`) | The tile: empty for initials, `icon:<name>`, or `picture:<file>` under `ui/mark/` in the bucket |
| `settings.portal_tagline` (`TAGLINE_SETTING`) | The line under the name, 40 characters; empty, "Admin portal" |

All four are Owner-editable, immediate, and read from memory with the parts on every request.

## The company's clock

Moments are kept in UTC and shown on the company's zone. `wallClock(at, zone)` gives the day and
time there, `instant(day, time, zone)` the moment (a skipped time lands an hour later, a repeated
one takes the first), `nextDay`, `isTimeZone`; Intl holds the offsets. Each zone's formatter is made
once per isolate, since the first also loads the zone data (10 to 30 ms); `warmClock()` runs in the
Worker's global scope, outside the first request's CPU.
