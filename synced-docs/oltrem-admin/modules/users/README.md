# @oltrem/users

The people of a client Worker (plan section 4.4): the directory with each person's profile, and
switching an account off and on under the permission model's standing rules. An account is the
IAM module's principal row; this module adds what a person is called and how they read the
portal, and the rules of the switch. Invitations and group membership are the governance's, in
`@oltrem/iam`, because they are grants; service accounts come later (below).

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

`createUsers` returns the `people` functions and the module manifest. It stands on the IAM
module: the same sessions and authorizer, the same audit wrapper, and the capability every
account holds, here `users.self` (any `<module>.self` is read that way by the authorizer).

## Capabilities

Two, declared on the manifest on bit plane `1`: `users.read`, the directory; `users.manage`,
switching accounts off and on, blocking sign-in, managing sessions and editing profiles, with a
fresh sign-in. The IAM module's
startup hook registers them when the Worker starts, and both join every Owner role.

## The directory and the profile

A **profile** is the part of an account that is the person's to describe: a display name (eighty
characters at most) and a locale (a language tag such as `es` or `pt-BR`, or empty for the
portal's own). Anyone edits their own; `users.manage` edits another's. The directory lists every
account of the company but the Vendor, with its profile, searchable by address or name, filtered
by kind and by state, paged as the IAM lists are. The grants a person holds are the IAM module's
to show (`GET /api/iam/people/:id`).

## The switch

Switching an account **off** ends its sessions (the next request is refused with `KIT-E-2005`)
and leaves its grants, its groups and its history in place for when it is switched **on** again.
The rules, in order: never yourself (`KIT-E-2008`); never an Owner (`KIT-E-2102`: end the Owner
grant first, with a second person, as the governance requires); only a person whose every allow
grant, direct or through a group, is below your standing at that scope (`KIT-E-2007`), so that
nobody switches off a person they could not have granted; and an account already in the state
asked for is nothing to change (`KIT-E-2101`). A reason is kept when one is given, and is no
longer required (2026-11-11, the owner's ask to make the Users pages easier). The Vendor stands
above everyone but an Owner. Every switch and every profile change is audited (`users.deactivate`,
`users.reactivate`, `users.profile`), the refusals as much as the successes.

**Sign-ins** (2026-11-11, the owner's ask to see and end a person's sessions). Someone with
`users.manage` sees another person's remembered sign-ins (each browser's sign-in time, its own
description and whether it was ended), ends one, or ends them all at once ("Sign out
everywhere"), through the access module's session store (`Sessions.devices`, `revokeDevice`,
`revokeAll`). Never their own, here (`KIT-E-2008`: their own sign-ins are their account menu's);
an Owner or the Vendor may end anyone's, anyone else only a person below their standing
(`KIT-E-2007`). Each is audited, `users.session-end` (with the device) and `users.sign-out` (with
how many ended). A directory row carries `lastSignedInAt`, the last sign-in on a new browser
(the access module records it).

**Blocking and session ends** (2026-11-14, the owner's ask to block a user for a while or for
good, and to change an active session). A **block** with a time (`until`, a year at most) writes
`iam_principals.blocked_until` (migration `0065`, the IAM module's) and ends every session: the
door refuses them with `KIT-E-2017` and the time until it passes. Ending every session writes
`signed_out_at` and moves the tenant's policy version before the stored sessions are removed, so
one that outlives the removal is refused within one recheck; a removal that fails goes to
`report`, which the client wires to the audit alert. A block without a time switches
the account off, as deactivating does. The rules are the switch's: never yourself, never an
Owner (`KIT-E-2102`), only below your standing, and nothing to change for an account switched off
already (`KIT-E-2101`). **Unblock** lifts either kind (`KIT-E-2101` when there is no block):
the sign-ins the block ended stay ended, and one made during the block works now; reactivating
does the same after a switch off. A directory row carries `blockedUntil`: blocked while it is ahead.
A session's **end time** (`PATCH /people/:id/sessions/:device`, thirty days at most, `null`
clears it) signs that browser out when it passes. Audited as `users.block` (with the time and
the reason), `users.unblock` and `users.session-change` (with the device and the time).

**Signed in today** (2026-11-21, the feature plan's "Signed in now"). `GET /signed-in` answers who
signed in within the last 24 hours, by person, newest first, read from the audit log's
`iam.sign-in` rows (one batch of two reads on its action index, at most 500 sign-ins and 50
refusals, `SIGNED_IN_ROWS` and `REFUSED_ROWS`), so no session record is read: each sign-in with
its browser, the country Cloudflare saw and what the access module's comparison found (`new`,
`unusual`), and the person's `signedOutAt`; then the sign-ins refused for an address with no
account here (the access module writes one an hour for each address). A sign-in's row is written
when the browser first signs in, so a person signed in yesterday on a browser still open is not
listed, and "Inactive for an hour" is not shown: it would need a write on every request.
**Sign everyone else out** (`POST /sign-out-everyone`, an Owner or the Vendor alone, else
`KIT-E-2104`) writes `signed_out_at` on every other active person of the company and moves the
policy version once, so every other sign-in is refused within one recheck (five minutes) with no
session record read or written for each person; the Vendor and service accounts are not touched.
Audited as `users.sign-out-everyone` with how many accounts it reached.

## Search

The portal's search (`GET /api/users/search?q=`, `users.read`) finds people by address or display
name, each with whether their account is on, linking to their page.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers the account
under the address (its address, display name, language, whether it is on, when it was made) and
every role given to it, with the place, the effect and the days it starts and ends, and what
modules told them (each notification's module, subject, day and whether it was read). The
person's page is linked.

## Notifications

What a module tells a person (a task given to them, their time off answered, their shifts
published) lands in their own Notifications in the portal, by email, or both, as they chose for
that module; both until they choose, so nothing is lost. The template routes the staff modules'
messages through `notifications.deliver(db, notice)`: one read finds which addresses are active
people of the company with their choice, one batch keeps a row for each who reads in the portal,
and the answer is the addresses still to email (an address that is nobody's account, a
customer's, is emailed as before). A row keeps the subject, up to 2,000 characters of the text
and the portal page it is about: the last portal address in the text, its path only, else the
module's first page; another site's address never. The same event key is kept once per person.
`createUsers({ notifies })` names the modules the Notifications page lists with each person's
choice: portal and email, portal only, email only, or off. The daily job
`users.notifications-prune` removes rows older than 90 days. The bell's figure is one indexed
read, counted to 100. Personal, like saved views: only the owner lists, reads or chooses; not
audited.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /people`, `GET /people/:id` | `users.read` | the directory, searchable (`q`: part of a name or address, `%` and `_` taken as typed), filtered (`kind`, `active`), paged; one person |
| `POST /people/:id/deactivate`, `POST /people/:id/reactivate` | `users.manage` | the switch, with a reason if one is given |
| `GET /people/:id/sessions` | `users.manage` | the person's remembered sign-ins, newest first |
| `DELETE /people/:id/sessions/:device` | `users.manage` | end one of them: that browser must sign in again |
| `PATCH /people/:id/sessions/:device` | `users.manage` | give one an end time (`endsAt`, thirty days at most), or clear it with `null` |
| `POST /people/:id/block`, `POST /people/:id/unblock` | `users.manage` | block sign-in until a time, or for good without one, with a reason if one is given; lift either |
| `POST /people/:id/sign-out` | `users.manage` | end every open one at once; answers `{ ended }` |
| `GET /signed-in?probe=` | `users.manage` at the company | who signed in within the last day, by person, with the refused addresses (above); `probe=1` answers `{ may: true }` and reads nothing, for the screens' tab, which asks on every page of its row |
| `POST /sign-out-everyone` | `users.manage`, an Owner or the Vendor | end every sign-in in the company but your own; answers `{ people }` |
| `PATCH /people/:id/profile` | `users.manage` | another person's display name or locale |
| `GET /me/profile`, `PATCH /me/profile` | `users.self` | my own |
| `GET /me/seen`, `POST /me/seen` | `users.self` | when I last marked Home's What changed card as seen (`{ at }`, null before the first time); mark it now (no body, answers 204). Personal, like the theme: not audited |
| `GET /me/views?path=`, `POST /me/views`, `DELETE /me/views/:id` | `users.self` | my saved views of one page: list, save under a name (the same name replaces), remove; another person's id removes nothing |
| `GET /me/notifications?before=&unread=` | `users.self` | my notifications, newest first, thirty a page, with the unread count and a cursor for the next page |
| `GET /me/notifications/unread` | `users.self` | how many are unread, up to 100: the bell |
| `POST /me/notifications/:id/read`, `POST /me/notifications/read` | `users.self` | mark one read (answers its page; another person's id is 404) or all |
| `GET /me/notifications/choices`, `PUT /me/notifications/choices` | `users.self` | how each module that tells people things tells me; a module that tells nobody, or another channel, is 422 |
| `GET /onboarding` | `users.manage` | Home's Get started: invite a second person, done once a second person is active or an invitation still in date waits; the handover's invitation (an Owner invited before the company is handed over) does not count, so the step no longer ticks and unticks around the handover (2026-11-15) |
| `GET /home` | `users.read` | the Home card, Users: the active users, and how many are deactivated |

## Later

Service accounts (kind `service`) need the door's service-token identity, which carries no email,
so the pipeline's identity reader and the session key must learn a second shape; that waits for
the sandbox, where a real service token can be tried. Since 2026-11-05 the Worker keeps nothing
in step with Access, so the door's groups are not synced; `iam_groups.source` has no reader.

## Tables

Migration `0007_users.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`users_profiles` (`principal_id`, `display_name`, `locale`, `updated_at`). The account itself is
`iam_principals` (`@oltrem/iam`, migration `0004`).

Migration `0070_users_seen.sql` (2026-11-21): `users_profiles.seen_at`, when the person last
pressed Mark as seen on Home's What changed card; the card counts the others' changes since then
(`GET /api/audit/since`, `@oltrem/core-audit`). Written only on that press, never when a page is
shown, so a page the frame fetched ahead of a tap marks nothing. A person with no profile row gets
one on the first press.

Migration `0055_users_views.sql` (2026-11-03): `users_views` (`id`, `principal_id`, `path`,
`name`, `query`, `created_at`, one name per person and page). A saved view keeps a page's address
and its filters, never rows, so opening it runs the page's own permission check. At most
`VIEWS_PER_PAGE` (12) per person and page, checked in the same statement as the write. Personal
preferences, like the theme: not audited.

Migration `0056_users_notifications.sql` (2026-11-03): `users_notifications` (`id`,
`principal_id`, `module`, `subject`, `body`, `link`, `key`, `created_at`, `read_at`; one key per
person) with indexes for the newest first, the unread and the age; `users_notify_choices`
(`principal_id`, `module`, `channel`: `both`, `portal`, `email` or `off`; no row is both).

## Errors

The module owns the `2100` to `2199` block: `KIT-E-2101` nothing to change (the account is in
that state already), `KIT-E-2102` an Owner cannot be deactivated or blocked, `KIT-E-2103` too many saved
views on one page, `KIT-E-2104` only an Owner or the Vendor may sign everyone else out. What the permission model names
keeps its codes: `KIT-E-2007` beyond your standing, `KIT-E-2008` your own account, `KIT-E-2010`
a bad profile or a missing reason, and the core's `KIT-E-0404` for a person who does not exist.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company of two
scopes, three roles, six people and a group: the manifest; the directory with its filters, the
Vendor left out, a person without `users.read` refused; profiles edited by oneself and by
`users.manage`, searched by name, a bad locale and an empty change refused, the audit row; the
switch refused to a clerk, done by a manager over a clerk at her scope and refused over a group
grant at the root, refused for oneself and for an Owner, needing a reason, done once and nothing
to change the second time, the sessions following each switch, and the Vendor standing above a
manager; blocking for an hour and for good, refused to a clerk, for oneself, for an Owner and for
a time past, the door's refusal with the time, unblocking with the ended sign-in staying ended,
and a session's end time set, refused below standing or past, and cleared; the audit rows with their actors, reasons and refusals; Signed in today by person with the flags, the refused addresses and nothing older than a day, refused to a clerk; Sign everyone else out refused to a manager, done by an Owner, their own sign-in kept and a new sign-in let in, and the What changed mark, empty before the first press, kept for each person apart, a profile row made on the first press (`test/signed-in.test.ts`); saved views; notifications kept
and emailed as each person chose (an inactive account and an address of nobody emailed only, a
key kept once, off keeps and sends nothing), the link taken from the text and never another
site's, opened by its owner only, all read, the privacy rows, pages of thirty by a cursor that
never skips a row of the same moment, and the 90-day job.
