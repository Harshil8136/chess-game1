---
title: "@oltrem/users: using it, the switch, sign-ins, notifications, the routes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/users/src/module.ts, people.ts, notifications.ts, views.ts]
---

# @oltrem/users: using it, the switch, sign-ins, notifications, the routes

> Part of [the @oltrem/users README](../README.md).

## Using it

```ts
import { createApp } from '@oltrem/core-http';
import { createIam } from '@oltrem/iam';
import { createUsers } from '@oltrem/users';

const bindings = (env: Env) => ({ kv: env.CACHE, db: env.DB });
const iam = createIam<Env>({ bindings, audience: (env) => env.ACCESS_AUD });
const users = createUsers<Env>({ bindings, sessions: iam.sessions });
const app = createApp<Env>({
  modules: [iam.module, users.module],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createUsers` returns the `people` functions and the module, on IAM's sessions, authorizer and
audit wrapper. `users.self` is held by every account.

## Capabilities

Bit plane `1`, both in every Owner role: `users.read` (the directory) and `users.manage`
(switching, blocking, sessions, others' profiles; fresh sign-in).

## The directory and the profile

A profile is a display name (`DISPLAY_NAME_MAX`, 80) and a locale (`es`, `pt-BR`, or empty for the
portal's); anyone edits their own, `users.manage` another's. The directory lists every person and
service account but the Vendor, searchable by address or name (`%` and `_` as typed), filtered by
kind and state, paged; grants are IAM's (`GET /api/iam/people/:id`). A row carries
`lastSignedInAt` (the last sign-in on a new browser) and `blockedUntil`.

## The switch, blocks and sessions

Every rule, in order: never yourself (`KIT-E-2008`); never an Owner (`KIT-E-2102`); only a person
whose every allow grant, direct or through a group, is below your standing at that scope
(`KIT-E-2007`); an account already in that state is nothing to change (`KIT-E-2101`). The Vendor
stands above everyone but an Owner. A reason is kept when given. Successes and refusals are
audited.

| Action | What it does | Audited |
|---|---|---|
| Deactivate, reactivate | Off ends its sessions (`KIT-E-2005` next request) and keeps grants, groups and history | `users.deactivate`, `users.reactivate` |
| Block | With `until` (up to `BLOCK_MAX_DAYS`, 366) writes `iam_principals.blocked_until` and ends every session (the door says `KIT-E-2017` and the time); without a time, switches the account off | `users.block` |
| Unblock | Lifts either kind (`KIT-E-2101` when none); ended sign-ins stay ended | `users.unblock` |
| Sessions | See another's remembered sign-ins (`moved`: where else it was used), end one, or all ("Sign out everywhere"); never your own here; an Owner or the Vendor ends anyone's | `users.session-end`, `users.sign-out` |
| A session's end time | `endsAt` up to `SESSION_END_MAX_DAYS` (30), `null` clears | `users.session-change` |
| Profile | Another's name or locale | `users.profile` |

Ending every session writes `signed_out_at` and moves the policy version before stored sessions go,
so one that outlives the removal is refused within one recheck; a failed removal goes to `report`.

## Sign-ins and downloads

For `users.manage` at the company:

| Route | What it answers |
|---|---|
| `GET /signed-in` | Sign-ins of the last 24 hours by person, from the audit log's `iam.sign-in` rows (one batch, `SIGNED_IN_ROWS` 500 and `REFUSED_ROWS` 50): browser, country, `new` or `unusual`, `signedOutAt`, then refused addresses with no account. No session record is read, so a browser still open from yesterday is not listed; `probe=1` answers `{ may: true }` for the screens' tab |
| `POST /sign-out-everyone` | An Owner or the Vendor (else `KIT-E-2104`): `signed_out_at` on every other active person and one policy version move, so all are refused within five minutes; the Vendor and service accounts untouched; audited `users.sign-out-everyone` |
| `GET /sign-ins` | Every sign-in the audit log holds (90 days), `SIGN_INS_PAGE` (50) a page by `before`, narrowed by `outcome` and `q` |
| `GET /export`, `GET /sign-ins/export?days=` | CSV of the users, and of 1 to `EXPORT_DAYS` (90, default 30) days of sign-ins, `EXPORT_ROWS` (5,000) each, cells through `csvCell`; audited `users.export`, `users.export-sign-ins` |

The downloads take personal data out; nothing new is kept, the audit row names who took one, and
the holder is responsible for the file.

## Notifications

What a module tells a person lands in their Notifications, by email, or both (`NOTIFY_CHANNELS`:
`both`, `portal`, `email`, `off`; both until chosen). The template routes staff messages through
`notifications.deliver(db, notice)`: one read finds the active people and their choices, one batch
keeps the portal rows, and the answer is the addresses still to email (a customer's is emailed as
before). A row keeps the subject, up to `NOTIFICATION_TEXT_MAX` (2,000) characters and the last
portal path in the text (never another site), else the module's first page; one event key per
person. `createUsers({ notifies })` names the modules listed for choosing. Pages of
`NOTIFICATIONS_PAGE` (30) by a cursor; the bell counts to `UNREAD_CAP` plus one (100) in one indexed
read; `users.notifications-prune` removes rows past `NOTIFICATION_DAYS` (90). Personal: not audited.

## Personal data and search

A privacy request gets the account (address, name, language, on or off, made), every role with
place, effect and days, and each notification's module, subject, day and read state. The portal's
search (a module part, `users.read`) finds people by address or name.

## The routes

Under `/api/users`.

| Routes | Needs | What they do |
|---|---|---|
| `GET /people`, `GET /people/:id` | `users.read` | The directory (`q`, `kind`, `active`), one person |
| `POST /people/:id/deactivate`, `/reactivate`, `/block`, `/unblock`, `/sign-out` | `users.manage` | As above; `sign-out` answers `{ ended }` |
| `GET /people/:id/sessions`, `DELETE` and `PATCH /people/:id/sessions/:device` | `users.manage` | Sessions, end one, set its end time |
| `PATCH /people/:id/profile` | `users.manage` | Another's profile |
| `GET /signed-in`, `POST /sign-out-everyone`, `GET /sign-ins`, `GET /export`, `GET /sign-ins/export` | `users.manage` at the company | As above |
| `GET`, `PATCH /me/profile` | `users.self` | My own |
| `GET`, `POST /me/seen` | `users.self` | When I last marked Home's What changed as seen (`{ at }`); mark now (204) |
| `GET /me/views?path=`, `POST /me/views`, `DELETE /me/views/:id` | `users.self` | My saved views of a page; the same name replaces |
| `GET /me/notifications?before=&unread=`, `GET /me/notifications/unread` | `users.self` | My notifications with the unread count and cursor; the bell |
| `POST /me/notifications/:id/read`, `POST /me/notifications/read` | `users.self` | Mark one (another's is 404) or all read |
| `GET`, `PUT /me/notifications/choices` | `users.self` | How each module tells me; another module or channel is 422 |

Module parts: Home's Users card (active and deactivated) and Get started's "Invite a second person"
(done once a second person is active or an in-date invitation waits; the handover's invitation does
not count).
