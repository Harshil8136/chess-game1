---
title: "@oltrem/iam: care on the tick, Needs you, the door, API keys"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src/care.ts, todo.ts, handover.ts, keys.ts, idempotency.ts, module.ts; packages/core-config/src/parts.ts]
---

# @oltrem/iam: care on the tick, Needs you, the door, API keys

> Part of [the @oltrem/iam README](../README.md).

## Care on the tick

Four rules kept without anyone remembering them (`src/care.ts`), each an extra of the Access part
on the Features page. Sign-in alerts start on; the other three start off.

| Kind | Id | What it does |
|---|---|---|
| Job, daily | `iam.expiring` | Emails each person whose own grant ends within 7 days (`EXPIRY_NOTICE_DAYS`), keyed `iam.expiring:<grant>:<end>` (once per end date). Group grants are not noticed. 200 a run; a refused message fails the run after the rest, and the next run sends what is missing. Its check counts and sends nothing. |
| Health check, `access` | `iam.reviews` | Warns when an open access review is overdue, or none was opened for 90 days (`REVIEW_EVERY_DAYS`). |
| Email, at sign-in | `iam.sign-in-alerts` | A new or unusual sign-in emails the person after the answer: the browser (`deviceName`, also `@oltrem/iam/device`), the country, the time in the sign-in's zone and UTC (`localTime`), browser and country in the subject, and a link to My access's sign-ins (`MY_SIGN_INS`) to **Report a sign-in** (`POST /me/sign-ins/report`: signs them out everywhere and tells whoever looks after access). Keyed `iam.sign-in:<person>:<device>`. The row is written even when nothing is sent. |
| Health check, `access`, hourly | `iam.unusual` | Over 7 days, warns on two countries within an hour, or 10 or more refusals for addresses with no account (`REFUSED_WARN`). One query on the audit log's action index. |

Without `mail`, nothing is sent. With `iam.expiring` and `iam.reviews` off, Home's Needs you tells
whoever looks after access instead. Cloudflare's bot score is not used: it needs Bot Management.

**The main-inbox line.** Gmail files automatic notices under Updates whatever the sender does;
only the reader's filter or contact keeps them in Primary. So the sign-in alert, the invitation
and the alerts module's emails end with `mainInbox(origin)` (`MAIN_INBOX`), pointing to
`<portal>/notifications#primary` (`@oltrem/screens`).

**Needs you** (`todo`, `src/todo.ts`, under `iam.self`): the requests and approvals the person may
decide, reviews with grants they may keep or remove, their own grants ending within 7 days; for
whoever may renew them (`standingAt`), others' grants ending within 7 days; for
`iam.bindings.manage`, "An access review is due" when none is open for 90 days and someone else
holds a grant; for `iam.keys.manage`, keys ending within 7 days or unused for 90
(`KEY_IDLE_DAYS`). `waitingFor` counts with the same rules the decisions check (never one's own
request), so nobody is sent to a decision the API would refuse.

## The door, and who gets in

Cloudflare Access stands on the Worker (`ACCESS_AUD` `worker`). `npm run deploy` sets it once with
Cloudflare's `cf` (`@oltrem/cli` `src/door.ts`); the Worker holds no key that could change it. The
door sends anyone a code by email (One-time PIN, one policy for everyone) and leaves the customers'
pages, webhooks, health check and styles open. Anyone may so take one of the 50 free Zero Trust
seats for a month, while seeing nothing of the portal.

Who gets in is this module's list. A sign-in with no active account is refused with `KIT-E-2005`
("No account here"), except accepting an invitation (`POST /invitations/accept`,
`/invitations/mine`) and a person named at setup. People come and go on the Users page alone.

**The people named at setup.** Deploy step 2 writes `iam.setup_people` (`SETUP_PEOPLE_SETTING`,
lines `address owner|staff|team|vendor`; passed through `createIam({ settings })`). Each **gets in
at their first sign-in**: `handover.admitNamed` makes the account at the whole company, the Owner
as Owner, Staff as Member, Your team as Admin (each role made from its ready set when missing);
another Vendor gets a Vendor account. The grant is the Vendor's, reason "named at setup", audited
`iam.setup-admit`. Refused, with why (`test/setup-admit.test.ts`):

- no company yet (the Vendor signs in first and makes it);
- an Owner after the handover (only an Owner adds one then);
- anyone after the handover unless the Vendor may enter at any time (`always`);
- an address with a waiting invitation is accepted as an invitation; a switched-off account stays
  off.

The Users page can also invite them all in one press (`GET /setup-people` lists those without an
account or invitation); the Vendor is never asked for a second person
(`templates/client/test/setup-people.test.ts`).

## API keys

Another system calls `/hooks/api/...` with a key (`src/keys.ts`, `iam.keys`; `@oltrem/core-http`'s
`keys`). An Owner makes one under Users and access, Settings, API keys (`POST /keys`: name, role,
location, optional end).

- **What a key is.** A service account (`iam_principals` kind `service`, `key-<id>@keys.invalid`)
  given its role through the grant rules, so never more than its maker may give and **never the
  Owner role** (422). The key `okey_<16 hex>_<48 hex>` shows once; only the SHA-256 of its secret
  is kept, compared in constant time. Its account takes a role only through its key (`forKey`);
  any other grant to it is `KIT-E-2018`.
- **Using it.** The session hook gives a key's identity with no device, sign-in row, alert or
  fresh sign-in, and checks capabilities as anyone's. Last use is written at most hourly
  (`KEY_USE_EVERY_MS`); 20 keys a company (`KEYS_MAX`).
- **Limits** (migration `0090`, `PATCH /keys/:id`): calls a minute (`KEY_PACES` 60, 30, 15, 6; a
  slower key counts `weight` times), allowed addresses (up to `KEY_ADDRESSES_MAX`), a start time,
  read only, and the module ids it may call. Unknown, revoked or ended is 401; a working key
  outside its limits is `KIT-E-0403` naming why.
- **Managing.** Rotate (`POST /keys/:id/roll`) shows a new secret once and keeps the old one for
  `overlapHours` (`KEY_OVERLAPS` 0, 1, 24, 168). Change access (`POST /keys/:id/access`) grants
  the new role before ending the old. These and Change limits first ask `governance.mayGive`.
  Revoke (`DELETE /keys/:id`) ends it at once; Delete (`POST /keys/:id/remove`) takes a revoked
  or ended key off the list, its account kept off for the audit trail. `GET /keys/:id` adds its
  last `KEY_ACTIVITY_ROWS` audit rows.
- **Rules.** Making and revoking need `iam.keys.manage` (`floor: 'owner'`, `freshSignIn`). Every
  change is audited (`iam.key-made`, `-changed`, `-rolled`, `-revoked`, `-deleted`); addresses
  are counted, never written. `@oltrem/core-health` counts its calls
  (`GET /api/health/requests/key/key:<id>`). Tests: `test/keys.test.ts`.

**Idempotency-Key** (`src/idempotency.ts`, `iam.idempotency`): first answers kept in
`iam_idempotency`, removed after a day by the daily `iam.tidy`. Tests:
`test/idempotency.test.ts`.
