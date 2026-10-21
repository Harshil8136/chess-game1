# @oltrem/users

The people of a client Worker (plan section 4.4): the directory with each person's profile, and
switching an account off and on under the permission model's standing rules. An account is the
IAM module's principal row; this module adds what a person is called and how they read the
portal, and the rules of the switch. Invitations and group membership are the governance's, in
`@oltrem/iam`, because they are grants; service accounts and the sync of the door's groups come
later (below).

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
switching accounts off and on and editing profiles, with a fresh sign-in. The IAM module's
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
nobody switches off a person they could not have granted; a reason is needed to switch off; and
an account already in the state asked for is nothing to change (`KIT-E-2101`). The Vendor stands
above everyone but an Owner. Every switch and every profile change is audited (`users.deactivate`,
`users.reactivate`, `users.profile`), the refusals as much as the successes.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /people`, `GET /people/:id` | `users.read` | the directory, searchable (`q`), filtered (`kind`, `active`), paged; one person |
| `POST /people/:id/deactivate`, `POST /people/:id/reactivate` | `users.manage` | the switch, with a reason |
| `PATCH /people/:id/profile` | `users.manage` | another person's display name or locale |
| `GET /me/profile`, `PATCH /me/profile` | `users.self` | my own |

## Later

Service accounts (kind `service`) need the door's service-token identity, which carries no email,
so the pipeline's identity reader and the session key must learn a second shape; that waits for
the sandbox, where a real service token can be tried. The sync of the door's groups into kit
groups (`source = 'access'`, read-only in the screens) needs the Cloudflare API through the
providers module of phase 4.

## Tables

Migration `0007_users.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`users_profiles` (`principal_id`, `display_name`, `locale`, `updated_at`). The account itself is
`iam_principals` (`@oltrem/iam`, migration `0004`).

## Errors

The module owns the `2100` to `2199` block: `KIT-E-2101` nothing to change (the account is in
that state already), `KIT-E-2102` an Owner is not switched off. What the permission model names
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
manager; the audit rows with their actors, reasons and refusals.
