---
title: "@oltrem/iam: Care on the tick; The door, and who gets in; API keys"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/iam/src; split from modules/iam/README.md]
---

# @oltrem/iam: Care on the tick; The door, and who gets in; API keys

> Part of [the @oltrem/iam README](../README.md).

## Care on the tick

The module keeps four rules without anyone having to remember them (`src/care.ts`). Each is an extra
of the Access part, switched on and off on the Features page, and (the owner's pick) all start off
on a new portal; a portal that already saved its list keeps it, and the two added that day are added
to a saved list as off (migration `0067`, `@oltrem/core-config`):

| Kind | Id | What it does |
|---|---|---|
| Job, daily | `iam.expiring` | Emails each active person whose own grant ends within 7 days (`EXPIRY_NOTICE_DAYS`): the company, the role, the place and the date, keyed `iam.expiring:<grant>:<end>`, so it goes once for each end date and again if the grant is renewed to a new one. Activations and grants through a group are not noticed. 200 a run at most; a message the sender refuses fails the run after the others are tried, with the count and the first cause in its words, and the next run sends what is missing. Without `mail`, it does nothing. Its check (the jobs page's **Check for work**, 2026-11-21) counts the grants it would notice, by the same rule, and sends nothing. |
| Health check, lane `access` | `iam.reviews` | Warns when an open access review is past its due date, or when none was opened for 90 days (`REVIEW_EVERY_DAYS`), counted from the company's creation until the first one. |
| Email, at sign-in | `iam.sign-in-alerts` | Sign-in alerts: a sign-in compared as new or unusual (above) emails the person, after the answer: the browser by name (`deviceName`, also its own entry `@oltrem/iam/device`, with no Workers type, which the customers' sign-ins read; the Users pages keep their own copy of the same names, the screens depending on core-ui alone), the country in English, the time in UTC (since 2026-11-25 in the sign-in's own time zone first, "2026-10-20 at 17:30 Kolkata time (12:00 UTC)", `localTime`, and the browser and country in the subject, "New sign-in to Acme: Firefox on Android, from Mexico"), and, "If it was not you, open" My access, its sign-ins (`MY_SIGN_INS`) "and press Report a sign-in": it signs the person out everywhere and tells whoever looks after access, who can block the account (`POST /me/sign-ins/report`). An unusual one says "two countries within an hour" in the subject. It opens with "Hello," and ends with the main-inbox line (`mainInbox(origin)`, below the table). Keyed `iam.sign-in:<person>:<device>`, so once. Without `mail`, or while the extra is off, nothing is sent; the row is written either way. The extra is on from the start, and core-config's migration `0085` switched it on where it was off only because it started off. |
| Health check, lane `access`, hourly | `iam.unusual` | Unusual sign-ins: over the last 7 days, warns when a sign-in came from two countries within the hour, or when 10 or more sign-ins were refused for addresses with no account (`REFUSED_WARN`); fewer refused ones are only counted in its words (someone who left, a mistyped address). One query on the audit log's action index. |

**The main-inbox line**. Gmail files a notice it sees as automatic (a sign-in alert, an invitation,
an alert) under Updates whoever sends it; what keeps a sender in Primary for good is the reader's
own filter or contact. So the portal's own notices end with one line, `mainInbox`: "If this email
landed under Updates, Promotions or Other, the one-minute step at `<portal>/notifications#primary`
keeps the portal's emails in your main inbox" (`MAIN_INBOX`; the Notifications page's name when the
address is not known). The sign-in alert and the invitation carry it, the invitation after "Once you
are in:"; the alerts module ends its emails with it too. The step itself is the Notifications page's
(`@oltrem/screens`).

The four only read the rows. The notices go through the same `mail` as an invitation, and the health
page shows the checks' last results with the others. With `iam.expiring` and `iam.reviews` off,
whoever looks after access is told on Home's Needs you instead. Cloudflare's bot score, which the
plan named for unusual sign-ins, is not used: it needs Bot Management, which the free plan does not
have.

Home's "Needs you" (`todo`, `src/todo.ts`) asks the module for what waits for the person signed
in, under `iam.self`: the access requests and second-person approvals they may decide, each
access review with grants they may keep or remove, their own grants ending within 7 days, and,
since 2026-11-22, for whoever may renew them (`standingAt`) how many other people's own grants end
within 7 days (one links to that person's page, more to People), and for whoever holds
`iam.bindings.manage` at the company "An access review is due" when none is open, none was opened
for 90 days and someone else holds a grant (a company of one has nobody to review). Since
2026-11-25, for whoever holds `iam.keys.manage`, the working API keys that end within 7 days and
those nothing has called with for 90 days (`KEY_IDLE_DAYS`; never called counts from when it was
made), one linking to its key page, more to the keys.
`waitingFor` counts with the rules the decisions check (`standingAt`, `can`, never one's own
request, approval or grant), so a person is never sent to a decision the API would refuse.

## The door, and who gets in

Cloudflare Access stands on the Worker itself (ACCESS_AUD `worker`). The module keeps nothing of it
in step: `npm run deploy` sets it once with Cloudflare's own command line and its sign-in
(`@oltrem/cli`, `src/door.ts`), and the Worker holds no key that could change it. The door asks
anyone for a code sent to their email (the One-time PIN login, one policy that includes everyone),
and leaves the customers' pages, the webhooks, the health check and the styles open.

Who gets in is this module's own list. A sign-in whose email has no active account here is refused
with `KIT-E-2005` ("No account here"), except on the routes that make one: accepting an invitation
(`POST /invitations/accept`, `POST /invitations/mine`), and a person named at setup on their first
sign-in (below). So people come and go on the Users page
alone, and the door never needs changing. A Zero Trust organization made since June 2026 has only
the "Cloudflare" login, which admits members of the Cloudflare account and no one else; the door the
deploy sets uses only the One-time PIN login instead. The cost: anyone may ask for a code and so
take one of the 50 free Zero Trust seats for a month, while they still see nothing of the portal.

```ts
createIam({ ...,
  settings: (env) => settingsFor(env), // iam.setup_people: in at the first sign-in, or one press
});
```

**The people named at setup.** Step 2 of `npm run deploy` ("Who signs in") writes each person it
names, with what they are, to `iam.setup_people` (`SETUP_PEOPLE_SETTING`: lines `address
owner|staff|team|vendor`, lower case, set by the Vendor). Each one **gets in at their first
sign-in**, with nothing pressed: the session hook asks `handover.admitNamed` when a signed-in
address has no account at all, and it makes the account at the whole company with the role setup
gave: the Owner as Owner, Staff as Member, Your team as Admin (each made from its ready set when
missing: View and Edit, or View, Edit and Manage, the Owner's and the Vendor's own left out; until
2026-11-22 Standard user and Full admin, still found by those names). Another Vendor gets a Vendor
account, with no role and no company needed; the Users page offers nothing to invite for it. The
binding is the Vendor's (`granted_by`), its reason "named at setup", and the audit row
`iam.setup-admit`. Its limits, each refused with "No account here" and why in words
(`modules/iam/test/setup-admit.test.ts`):

- No company yet: the detail names the Vendor, who signs in first and makes it.
- An Owner comes in this way only before the handover, as the first Owner (the handover is
  stamped); after it, only an Owner adds another Owner.
- After the handover, anyone else only while the Vendor may enter at any time (`always`).
- An invitation already waiting for the address is accepted as any other, and a switched-off
  account stays off.

The Users page can still invite them all in one press, each to that role (`GET /setup-people`
lists the ones without an account or a pending invitation; Home's Get started says "The 3 people
named at setup sign in"); each then presses Accept on the page they land on (`POST
/invitations/mine`, then `/invitations/accept` without a token). An Owner named after the
handover is invited by the same press: the Vendor is never asked for a second person
(`templates/client/test/setup-people.test.ts`). Without `settings` nobody is named.

## API keys

Another system calls the portal's API with a key (`src/keys.ts`, `iam.keys`). An Owner makes one
under Users and access, Settings, API keys (`POST /keys`: a name, a role, a location and an optional
end): the module makes a service account (`iam_principals` kind `service`, address
`key-<id>@keys.invalid`, never a mailbox) and gives it the role through the grant rules, so a key
never holds more than its maker may give, and **never the Owner role** (refused 422, so a lost key
cannot hand the company over). The key, `okey_<16 hex>_<48 hex>`, is shown once; only the SHA-256 of
its secret is kept, compared in constant time. A call carries it to `/hooks/api/...`
(`@oltrem/core-http`'s `keys`); the session hook takes a key's identity with no device, sign-in row,
alert or fresh sign-in, and checks its capabilities like anyone's. A key that ends stops at that
time; Revoke (`DELETE /keys/:id`) switches its account off and ends its session at once. Its last
use is written at most once an hour (`KEY_USE_EVERY_MS`); a company holds 20 keys at most
(`KEYS_MAX`). Making and revoking need `iam.keys.manage`, held to the Owner role (`floor: 'owner'`).
Tests: `test/keys.test.ts`.

**Limits and management** (migration `0090_iam_api_key_limits.sql`). A key also carries, set when it
is made and changed later (`PATCH /keys/:id`, the end reaching its grant too): calls a minute
(`KEY_PACES`, 60, 30, 15 or 6; a slower key's call counts `weight` times against the limiter's 60),
the internet addresses it may call from (up to `KEY_ADDRESSES_MAX`, none for any), a start time,
read only (GET and HEAD alone), and the API areas (module ids) it may call, none for every one its
role reaches. `verify` returns null (401) for a key that is unknown, revoked or ended, and refuses
one that works but may not make this call with `KIT-E-0403` naming why: not started, another
address, a change on a read-only key, another area. Rotate (`POST /keys/:id/roll`) makes a new
secret, shown once, and keeps the previous one working for `overlapHours` (`KEY_OVERLAPS`: 0, 1, 24
or 168). Change access (`POST /keys/:id/access`) gives the new role first, through the grant rules,
then ends the old grant, so a refusal leaves the key as it was. Rotate, Change limits and Change
access first ask the grant rules whether the person could give the key's current role at its place
(`governance.mayGive`): an Owner at one location never rotates or loosens a company-wide key. Delete
(`POST /keys/:id/remove`) takes a revoked or ended key off the list; its account stays switched off
so the grants and the audit log keep naming it. `GET /keys/:id` returns the key with its role and
location in words and its last `KEY_ACTIVITY_ROWS` audit rows, what it did and what was done to it.
Every change is audited (`iam.key-made`, `-changed`, `-rolled`, `-revoked`, `-deleted`), the
addresses counted, never written. A key's calls, refused ones too, are counted by
`@oltrem/core-health` (`GET /api/health/requests/key/key:<id>`). The pages are `@oltrem/screens`'
API keys and a key's own page; a key's account is left out of Users.
