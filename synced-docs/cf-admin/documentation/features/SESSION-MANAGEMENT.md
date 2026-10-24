---

title: "Session Management (Security section)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-16
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/sessions/[...section].astro, src/lib/sessions-section.ts, src/lib/login-log-filters.ts, src/styles/pages/sessions.css, src/components/admin/users/sessions/SessionsConsole.tsx, src/components/admin/users/sessions/SessionsBar.tsx, src/lib/auth/session-ref.ts, src/components/admin/users/sessions/SignInAlertsCard.tsx, src/components/admin/users/sessions/AlertPolicyPanel.tsx, src/pages/api/sessions/sign-in-alerts.ts, src/pages/api/sessions/alert-policy.ts, src/pages/api/sessions/active-sessions.ts, src/pages/api/sessions/active-revocations.ts, src/pages/api/sessions/flush-sessions.ts, src/lib/auth/surface-guards.ts, src/lib/auth/routes.ts, src/lib/approvals/ask.ts, src/pages/api/users/force-kick.ts]
related_docs: [USER-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/login-forensics.md, ../architecture/plac-and-audit.md, ../specs/2026-10-03-sign-in-alerts-v2-design.md]
tags: [sessions, security, plac, rbac, kv, forensics]
---

# Session Management

> **Scope note (2026-08-23).** This document covers the sessions console. Session
> lifecycle, revocation layers and their timing are described in full in
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).


> **TL;DR:** The **Security → Sessions** page (`/dashboard/sessions`) shows who is
> signed in, every sign-in, who is barred from signing in, your own sign-in alert
> emails and the alert policy, one tab each, each at its own address
> (`/dashboard/sessions/history`, `/blocks`, `/alerts`, `/alert-policy`). Gated to canonical **Admin** and above
> (stored `super_admin`+) via a dedicated PLAC page row; what each person may do on it
> comes from the page's permission keys, and a control they lack shows switched off
> with the reason. Rebuilt from scratch on 2026-10-10 on the console kit
> (change record (private)),
> and redesigned on 2026-10-24: a slim bar of figures instead of the tall header and five tiles,
> real addresses instead of `#` fragments, dense rows, and server-side history filters
> (change record (private)).
> Built KV-budget-aware: the list is read once, Live is opt-in and self-limiting.

## Location & access

- **Route:** `src/pages/dashboard/sessions/[...section].astro` → `/dashboard/sessions` and
  `/dashboard/sessions/<part>` (top-level, depth-2 so it renders as a sidebar nav item; it was
  `index.astro` → `[...section].astro` on 2026-10-24). Any other path under it answers 404, and
  `/alerts` or `/alert-policy` without its key answers 403 with a line saying so. PLAC resolves
  every nested path to the `/dashboard/sessions` row (`pageFor`, `src/lib/auth/page-registry.ts`). The old
  `/dashboard/users/sessions` path was **deactivated**, not deleted: migration
  `migrations/0002_promote_sessions_page.sql` re-pointed its PLAC overrides here
  and set `is_active = 0` on the old `admin_pages` rows (verified against live D1
  2026-08-23).
- **Sidebar:** the **People and access** group: the row's `category` (`people`, migration `0067`); path rules no longer place pages (2026-10-10).
- **PLAC:** `admin_pages` row `/dashboard/sessions` (`required_role=super_admin` — the *stored* value; canonical **Admin**, level 2),
  seeded by `migrations/0002_promote_sessions_page.sql`, with action fragments
  `#revoke` / `#unblock` / `#flush` (owner) / `#export` / `#alerts` (owner, migration
  `0063`) / `#alert-policy` (owner, migration `0065`). SSR access is enforced
  by the middleware `decideAccess` gate; per-user overrides are editable in the
  Access Policy Manager (grouped under "Security"). The model itself is owned by
  [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).

### Which fragments the server actually checks

*Added 2026-09-19.* Since `20c6213` the mutating routes check the page key **and**
the action key through `src/lib/auth/surface-guards.ts` (`denySessions`) — a hash
key is not a path descendant, so a page check alone never covered them. This was
gap **D-5**, closed 2026-09-16.

| Fragment | Server-checked | Where |
|---|---|---|
| `#revoke` | yes | `DELETE /api/sessions/active-sessions` |
| `#unblock` | yes | `DELETE /api/sessions/active-revocations` |
| `#flush` | yes, but see below | `POST /api/sessions/flush-sessions` |
| `#export` | page only | No server route exists: export is built client-side from already-fetched data, so the page offers the download buttons only to holders (2026-10-10) |
| `#alerts` | yes, fail closed | `GET`/`POST /api/sessions/sign-in-alerts` and the page's card (`denySignInAlerts`, an explicit grant required); also re-checked at every sign-in |
| `#alert-policy` | yes, fail closed | `GET`/`POST /api/sessions/alert-policy` and the page's policy panel (`denyAlertPolicy`, an explicit grant required) |

The page asks the same keys the routes ask (since 2026-10-10;
`src/pages/dashboard/sessions/[...section].astro` passes them to the console as `access`), so a
fragment deny switches the control off, with its reason, instead of leaving a button the
server refuses. Locking a person out by name uses the Users page's route, so it follows
`/dashboard/users`; the sign-in history follows the Security part of Logs
(`canReadSignInHistory` in `src/lib/auth/surface-guards.ts`, the one check the page and
`GET /api/audit/login-logs` share). Until 2026-10-10 the page chose by role alone
(`isSuperAdmin` / `isOwnerOrDev`), so a fragment deny left the button visible.

One honest caveat:

- **`#flush` cannot bind anyone.** The route keeps a hard `isOwnerOrDev` check
  alongside the PLAC one, and owner and vendor_support bypass every PLAC deny
  (`src/lib/auth/guard.ts`, ADR-0002 answer 2). So the only roles a `#flush` deny
  could apply to are already refused by the role check, and the two it would need
  to apply to cannot be denied. The in-code comment calling the fragment
  "deny-only — it can remove the capability from an owner" is wrong; it is inert.
  Raised for triage in `../MAINTENANCE.md` (private) (D-5) and
  `PERMISSIONS-SYSTEM.md`, both of which record the same claim.

## Components (code-split)

`src/components/admin/users/sessions/`, rebuilt 2026-10-10 on the console kit
(`src/styles/components/console.css`, [`DESIGN-SYSTEM.md`](../reference/DESIGN-SYSTEM.md)
§9.9) and the shared Dialog (§9.8), with pieces of its own since 2026-10-24 in
`src/styles/pages/sessions.css` (the bar, the figures, dense rows, setting blocks, the save bar):

- `SessionsConsole.tsx`: the shell. The bar; the tabs on one sideways row, each a link to its
  address; the drawers and the lock-out dialog; every action and its confirm; the downloads; the
  address bar, the browser tab's title and the top bar's crumbs as tabs and filters change.
- `SessionsBar.tsx` (2026-10-24): the page's name, the time of the last read, Refresh and Live,
  and one sideways row of five figures (signed in, unusual, sign-ins and failed or refused in
  the last 24 hours, blocks), each opening its list. It replaced a heading, a subtitle and five
  tiles that took about a quarter of a phone's screen.
- `SignedInPanel.tsx`: the **Signed in** tab, one dense row per session, **By person** (the
  default: one heading per person with their sessions under it) or **Each session**, a search,
  four filters (Everyone, Unusual, Yours, Inactive 1 h+), three orders (Recently active, Newest
  sign-in, Name) and the actions a session has; `EveryoneAtOnce.tsx`, folded under it (lock out a
  person, clear stale sessions, sign everyone else out).
- `sessionTabs.tsx`: which tabs a person's access shows, and their icons. The names and
  addresses are `src/lib/sessions-section.ts`.
- `HistoryPanel.tsx`: the **Sign-in history** tab, a table with a heading for each day on a wide
  screen and a stack of cards on a phone, with four rows of filter chips, the count of matching
  sign-ins and pages of 25, 50 or 100.
- `BlocksPanel.tsx`: the **Sign-in blocks** tab, with **Check again** and **Lock out a person**.
- `SignInAlertsCard.tsx`: the **Your alerts** tab, for holders of `#alerts` only;
  `SignInWays.tsx` (the one-tap fix, the rule for each way in, what the next sign-in gets) and
  `EmailedSummary.tsx` are its parts.
- `AlertPolicyPanel.tsx`: the **Alert policy** tab, for holders of `#alert-policy` only.
- `SettingBlocks.tsx` (2026-10-24): the block that holds each kind of setting on those two
  tabs, and the row of chips that jumps to each block.
- `SessionDrawer.tsx`, `SignInDrawer.tsx`: one session, one sign-in, in full (the Dialog's
  drawer: from the right on a wide screen, from the bottom on a phone). The full address
  shows only here.
- `LockOutDialog.tsx`: lock out a person by name, from a list of only the people the route
  would accept.
- `SessionForensicsDrawer.tsx`: one person's sessions, opened from their row on the Users
  page, on the same Dialog and kit pieces (`ck-scope`).
- `parts.tsx`: the small shared pieces (method and device icons, badges, copy button, the
  empty, error and loading states; the stat tile, which only the Page Registry still uses).
- `sessionRisk.ts` (risk signals), `exportSessions.ts` (CSV and JSON), `sessionTypes.ts`
  (`maskIp`), `sessionFormat.ts` (device, times, sign-in method), `sessionBadges.ts` (tones):
  pure helpers, unit-tested.

Removed on 2026-10-10: `SessionCommandCenter.tsx`, `ActiveSessionsPanel.tsx`,
`AuthHistoryPanel.tsx`, `EdgeBlocksPanel.tsx`, `SessionDetailDrawer.tsx`,
`AuthLogDetailDrawer.tsx`, `ForensicComponents.tsx`, `useIsMobile.ts` and
`src/styles/pages/session-registry.css`.

## Tabs & data sources

| Tab or figure | Source | KV cost |
|-----|--------|---------|
| Signed in, and the **signed in** and **unusual** figures | `GET /api/sessions/active-sessions` (`kv.list` + gets), once when the page opens and on Refresh | 1 list/call |
| Sign-in history | `GET /api/audit/login-logs?limit=100` (D1) with the filters as parameters, when the tab opens and on each filter change; **Read the 100 sign-ins before these** pages back with `offset` | none |
| The **sign-ins in 24 h** and **failed or refused in 24 h** figures | two counts from the same route (`limit=1&success=true\|false&dateFrom=`, reading `total`), only for holders of the history | none |
| Sign-in blocks, and its figure | `GET /api/sessions/active-revocations` (KV `revoked:*`), only when the tab or the figure is opened, or on **Check again** | 1 list/call |
| Your alerts | `GET /api/sessions/sign-in-alerts` (D1) | none |
| Alert policy | `GET /api/sessions/alert-policy` (D1, one Supabase read) | none |

The blocks figure reads **—** with "blocks: tap to check" until the blocks are read, then the
real count. Until 2026-10-10 it showed a green **0** and "No active blocks" before anything was
read, a false all-clear on the one screen an operator uses to find a person stranded behind a
24-hour block; the old "Logins today" tile, which counted something else, is gone with
`GET /api/audit/stats` on this page.

**Addresses** (2026-10-24, `src/lib/sessions-section.ts`): `/dashboard/sessions` (Signed in),
`/dashboard/sessions/history`, `/blocks`, `/alerts` and `/alert-policy`. The history's filters
ride in its query (`?period=7d&outcome=fail&method=github&emailed=quiet&person=…`), so a
filtered list can be bookmarked or sent. Choosing a tab or a filter replaces the address in
place, as the Backups and Server pages do, so Back leaves the page; the browser tab's title and
the top bar's crumb follow (`showSection` in `src/lib/shell-state.ts`). An old link with a
fragment (`#alerts`, `#history`, `#alert-policy`, and the older `#active`, `#sessions`,
`#blocked`) opens its tab and is moved to its address. The alert emails' **Manage sign-in
alerts** link is `/dashboard/sessions/alerts`. The permission keys keep their `#` names: they
name permissions, not addresses.

## KV budget discipline (important)

Cloudflare KV free tier allows only ~**1,000 list/write ops per day** (reads are
100k). The active-session list is a `kv.list`, so **auto-refresh is engineered to
not burn the budget**:
- **opt-in** (default off; **Refresh** is the primary control, and the list is read once
  when the page opens, not again on every tab change),
- **30s** minimum interval,
- **paused while the tab is hidden** (`document.hidden`),
- **hard auto-stop after 5 minutes** (worst case ~10 list ops per activation), with a
  notice saying it stopped by itself.

No UI action writes to KV except the explicit revoke/flush/lockout operations.
Export and suspicious-flagging run entirely client-side on already-fetched data.

## Features

- **Per-session drawer**: tap a session's name (or its device, grouped by person) for the full
  address, place, device, sign-in method, Ray ID and times, with **End this session**, **Lock
  out** and, for holders of the history, **Their sign-ins** (the history filtered to them). The session you are using
  now cannot be ended from here (sign out instead), and you cannot lock yourself out. A
  session's method is the one its Cloudflare Access token named when it was created, and the
  token names none in production, so session cards read **Unknown**; since 2026-10-16 the
  sign-in history row carries the provider Access reports
  ([`login-forensics.md`](../security/login-forensics.md) §2.2).
- **Unusual sessions**: `sessionRisk.ts` flags a person signed in from more than one country
  at once (the **Unusual** tile and filter). In the history: an email not on the user list
  and a refused attempt (high), outdated TLS (medium), and a Cloudflare bot score below 30
  ("Likely automated", high). Cloudflare scores 1 for certainly automated and 99 for
  certainly a person; until 2026-10-10 this read scores above 50 as the risk, which flagged
  people and passed bots. A sign-in with no score (every row before 2026-10-10, and the
  Cloudflare log sync's rows) is treated as no signal.
- **History filters** (applied by the server since 2026-10-24, so they cover the whole log and
  the count is exact): **When** (24 hours, 7 days, 30 days, all time), **Outcome**
  (Everything, Signed in, Not signed in, Failed, Refused), **Way in** (Google, GitHub, Email
  code, Unknown), **Alert** (emailed or not) and one person (from a sign-in's **Only this
  person** or a session's **Their sign-ins**), with **Clear** for all of them. The search looks
  only inside what has been read (email, place, address, Ray ID). The route reads them in
  `src/lib/login-log-filters.ts`: `method` takes several values and `alert=emailed|quiet` is new.
  Until 2026-10-24 every filter ran in the browser over the 100 rows read, so "Failed" showed
  only the failures among the newest 100. **CSV and JSON** download what is shown, for holders
  of `#export`. The method chip and the method label agree: until 2026-10-10 the filter said
  "OTP" and matched the text, while the label said "Email code".
- **Alert email per row** (2026-10-03): an envelope icon when the sign-in was emailed (with
  why it was urgent: it moved, or it was made without Google), a muted bell with the reason
  when it was not (the same sign-in as before, paused, trusted area, alert policy, usual place
  and device, a repeat of a recent failure); the sign-in drawer shows it too. Read from
  `admin_login_logs.alert` (migration `0064`); rows from before read "Not recorded". Labels:
  `src/lib/login-alerts/outcomes.ts`.
- **By person** (2026-10-24): the Signed in tab groups each person's sessions under them, and
  **End all sessions** (or **End 2 sessions**, when some are out of reach) ends every one you may
  end, one route call each, after one confirm. **Inactive 1 h+** keeps the sessions with no
  activity for an hour (a session's last activity moves every 5 minutes,
  `src/lib/auth/pipeline.ts`).
- **Everyone at once** (folded under the Signed in list since 2026-10-24): **Lock out a person**, **Clear stale
  sessions** (sessions whose account is off or gone, and entries that cannot be read) and
  **Sign everyone else out** (type SIGN OUT to confirm; keeps your own session). The last
  two are the owner's and vendor support's (`flush-sessions.ts`). Each shows switched off,
  with the reason, for anyone else.
- **Lock out**: from a session, `DELETE /api/sessions/active-sessions` with
  `action: block_account` (`#revoke`); by name, a `PATCH /api/users/manage` with
  `is_active: false`, gated by `/dashboard/users`. Both sign the person out everywhere,
  switch their account off **and write a 24-hour `revoked:` sign-in block**. Reactivating
  the account via the same PATCH clears the block; a force sign-out from Users
  (`DELETE /api/users/force-kick`) does not, and can only be lifted here under **Sign-in
  blocks** (`#unblock`). That sign-out needs its own key, `/dashboard/users#force-kick`
  (Owner by default, enforced since 2026-10-15), on top of the Users page. See
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §5.4.
- **Who you can reach.** Below the owner and vendor support, ending someone's sessions and
  locking them out from a session reach only people whose role sits strictly below yours
  (`canManageUser`): never a peer, never anyone above, never the owner or vendor support
  (*changed 2026-10-14*; until then only the owner and vendor support were protected, so an
  Admin could lock out another Admin). The owner and vendor support reach everyone but
  themselves. **Lock out a person** by name follows the Users page's rule instead: people below
  your level, or anyone for vendor support. Your own other sessions can always be ended, and
  nobody can block their own account (the route answers 400). The page says so on the button
  first (`beyondReach`, `SessionDrawer.tsx`). A block whose account update fails answers 502
  with what to do: the sessions are already ended, but the account would let them sign in
  again. The owner's and vendor support's sign-in blocks can be lifted only by the owner or
  vendor support. Tests: `test/session-rank.test.ts`.
- **Locking out the last Owner waits for a second person** (*2026-10-16*, permissions item
  #36). A lock-out is a suspension, so both ways in follow the
  [two-person rule](../architecture/PERMISSIONS-SYSTEM.md) (§10.7, `personChangeGate` in
  `src/lib/approvals/ask.ts`): locking out the only active Owner answers `202` with
  `pending: true`, nobody is signed out and no block is written, and the change waits on Users
  for up to 3 days until another Owner or Vendor support approves it there (the Owner it is
  about counts: approving is their consent), where it is made as a suspension. When nobody
  else could approve, it goes ahead at once. The page shows the route's message as a notice,
  not an error, from a session's **Lock out** and from **Lock out a person** alike. Every
  lock-out of an active account that goes ahead is an access change, "Person suspended"
  (permissions item #18), emailed to the alert recipients as the alert policy's **Access
  changes emailed** says, from Sessions as from Users. A person the user directory does not
  have answers 404, and a directory that cannot be read answers 502 with nobody signed out.
  Tests: `test/two-person-rule.test.ts`.
- **A recent sign-in first** (*2026-10-16*, permissions item #14). Ending someone else's
  session, **Lock out**, a force sign-out from Users and **Sign everyone else out** need a
  sign-in from the last 10 minutes. Otherwise the route answers 403, nothing is ended, and the
  page opens **Confirm it's you**: it signs you out and back in and brings you back to this
  page, where you press the button again. Ending your own other sessions and **Clear stale
  sessions** do not ask. The rule: [PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md)
  §10.5.
- **Session handles, never session IDs** (2026-10-10). A session's ID is the value of its
  cookie. Until 2026-10-10 `GET /api/sessions/active-sessions` and
  `GET /api/users/[id]/session-status` sent every session's ID to anyone who could open the
  page, so an Admin could read the owner's cookie from the network tab and sign in as the
  owner; and the revoke route checked the role of the person the body named but ended any
  session ID it was given. Both routes now send `sessionRef`, a one-way SHA-256 handle
  (`src/lib/auth/session-ref.ts`), and the revoke route looks the handle up only among the
  named person's own sessions, so the role check covers the session it ends. Tests:
  `test/session-ref.test.ts`.
- **Privacy: address masking is client-side only.** `sessionTypes.ts`'s `maskIp` shortens
  the address in lists and the drawers show it in full, per `login-forensics.md §6.2`; but
  both session routes return the **full `ipAddress` of every session** to anyone holding
  `/dashboard/sessions`, i.e. canonical Admin and above, so anyone who can open the page can
  read it from the network tab. `GET /api/users/[id]/login-history` is different: it masks
  server-side and reveals the full address only to Vendor Support. `active-sessions` also
  hides `vendor_support` sessions from non-vendor viewers, which is at odds with the
  2026-07-26 no-hiding policy recorded in [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §4;
  both are logged in `../MAINTENANCE.md` (private).

## Your sign-in alerts (2026-10-03)

The **Your alerts** tab, at `/dashboard/sessions/alerts` (every alert email links to it), for
the signed-in person's **own** sign-in alert emails. Every choice is a row of chips, so all
of them show at once (2026-10-10; it was a card above the page with dropdowns). Since
2026-10-24 each kind of setting is a block (Right now, Recent emails, Ways in, Next sign-in,
What is emailed, Trusted areas, A copy to you), and a row of chips at the top jumps to each. Rendered only for holders
of `/dashboard/sessions#alerts` (owner and vendor support by default; grantable on
the Access page); `GET`/`POST /api/sessions/sign-in-alerts` checks the same key.

- **Emailed in the last 30 days** (2026-10-23): your own sign-in alerts that went out,
  grouped by why (made the emergency way in, moved, the alert mode, failed sign-ins), each
  with its count, the newest, and the setting that would have kept it quiet. Read from the
  outcome each sign-in stored (`admin_login_logs.alert`), so it shows what happened, not what
  today's settings would do (`src/lib/login-alerts/emailed.ts`).
- **A one-tap fix** (2026-10-23): when one of your alerts of the last 30 days was a GitHub or
  one-time-PIN sign-in that is still set to always urgent, a notice above the settings offers
  **Keep GitHub quiet in my trusted areas** (when you have one) and **Treat GitHub like
  Google**.
- **Ways you sign in** (2026-10-23): for GitHub and for the one-time PIN, your own choice of
  **As the policy says**, **Always urgent** (the emergency way in, emailed as urgent every time,
  the default), **Quiet in trusted areas** (quiet inside your trusted areas, urgent anywhere
  else) or **Like Google** (your trusted areas, pause and mode decide). Your choice wins over
  the policy's. Any other provider is always urgent. A quieter choice emails the alert
  recipients, like a pause.
- **What gets emailed for your next sign-in** (2026-10-23): for Google, GitHub and the PIN,
  what a new sign-in gets inside your trusted areas and anywhere else, by the same rules the
  sign-in uses (`expectations` in `src/lib/login-alerts/decide.ts`, checked against
  `decideSuccess` in `test/login-alert-ways-in.test.ts`).
- **Your successful sign-ins emailed:** as the alert policy says for your role,
  every sign-in, or only unusual ones (a new place or a new device in 90 days).
  Never is not offered here; only an alert-policy holder can set it for someone
  else, and the card then shows who did.
- **Pause** for 1 hour, 8 hours, 1 day, 3 days or 7 days. It ends by itself, and it
  keeps quiet only sign-ins from the country it was set in, unless **Pause for every
  country** is ticked. **Resume alerts now** ends it early.
- **Trusted areas**, up to 3: **Trust this area** saves where Cloudflare places
  this connection; **Trust** next to a place you signed in from in the last 90 days
  saves that one (the browser sends the sign-in's reference, never coordinates).
  Each area has a 25, 50 or 100 km radius (shown in miles too: 16, 31, 62), can be renamed or resized, and
  **Remove** forgets it. Sign-ins inside an area are logged but not emailed.
- **Also email me about my own sign-ins** sends you a copy of each alert.
- Turning alerts down (a pause, a new or wider area, a lower mode) sends one email
  to the alert recipients and writes an audit row. Settings you change are your
  own again, even if an alert-policy holder set them before.

Whatever the card says, a sign-in is emailed once, not once per tab or portal
session it opens, and two kinds are always emailed as urgent: a sign-in that turns
up in another country or on another device
([sign-in alerts v2](../specs/2026-10-03-sign-in-alerts-v2-design.md)), and, since
2026-10-16 (permissions item #37), a sign-in made the emergency way in, titled
**SIGN-IN WITHOUT GOOGLE**: any way in but Google, unless **Ways you sign in** (or the
alert policy's **Ways in**) says otherwise for GitHub or the one-time PIN (2026-10-23). A
pause or a quieter mode does not hold either back, and a trusted area holds back only a way
in set to "Quiet in trusted areas" or "Like Google"; the card's notice says so beside the
trusted areas. The rules:
[`../security/login-forensics.md`](../security/login-forensics.md) §7.

## Sign-in alert policy (2026-10-03)

The **Alert policy** tab, at `/dashboard/sessions/alert-policy`, every choice a row of chips,
each kind in a block with a row of chips at the top that jumps to it and marks a block that is
not saved yet (2026-10-24), for holders of
`/dashboard/sessions#alert-policy` (owner and vendor support by default);
`GET`/`POST /api/sessions/alert-policy` checks the same key.

- **Emailed in the last 30 days** (2026-10-23): every account's sign-in alerts that went
  out, grouped by why, each with its count, the accounts, the newest, and the setting that
  would have kept it quiet (the same list as Your alerts, for everyone).
- **Ways in** (2026-10-23): for every account, GitHub and the one-time PIN each **Always
  urgent** (the default), **Quiet in trusted areas** (each account's own areas) or **Like
  Google**. A person's own choice on Your alerts wins. A quieter rule counts as turning alerts
  down. Added after the owner's GitHub sign-ins inside the Toronto trusted area were each
  emailed as urgent: `../records/reports/2026-10-23-sign-in-alerts-ways-in.md` (private)
  and `../records/reports/2026-10-23-sign-in-type-exceptions.md` (private).
- **People** also shows each person's own rule for a way in, and **Clear** removes it.
- **Alerts go to:** up to 5 addresses; none means the built-in inbox. **Send a test
  email** sends one to the current list.
- **Successful sign-ins emailed, by role:** every sign-in, only unusual ones, or
  none. Every role starts at every sign-in.
- **Failed sign-ins emailed:** a switch for each of the five kinds, all on to
  start, and the repeat window for the same failure (5, 15 or 60 minutes).
- **Access changes emailed** (2026-10-15): each change (the default), one summary a
  day at 08:00 in Aguascalientes, or off. They go to the same recipients. What counts
  as an access change and how the summary is gathered:
  [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md) §10.4.
- **Accounts nobody uses** (2026-10-16): flag an account not signed in to or changed for
  45 days and suspend it at 90 (the default), flag at 45 days only, or off. The flags go to
  the same recipients, one email per account and stretch; the Owner and Vendor support are
  never suspended. The rule and what a suspension does:
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §5.5. Choosing a lighter setting counts as
  turning alerts down.
- **Audit log seal** (2026-10-16): the morning email of the activity log's daily seal, sent
  every morning with the day's fingerprint (the default) or only when a sealed day changed.
  A sealed day that changed is always emailed, and the seal runs either way. What a seal is
  and what the check compares: [`../architecture/plac-and-audit.md`](../architecture/plac-and-audit.md)
  §3.6. Choosing *only when something changed* counts as turning alerts down.
- **Save policy** saves the lot. While there are changes, a bar with **Undo changes** and
  **Save policy** stays at the bottom of the screen (2026-10-24), and each changed block says
  **Not saved**. A save that turns alerts down, or changes the recipients, emails the recipients
  before and after the change.
- **People:** everyone active, with what their successful sign-ins send, and a search when
  there are more than six (2026-10-24). A holder
  can set another person to follow the policy, every, unusual or never, or clear
  their settings; lowering someone emails the recipients. A holder's own row points
  to "Your alerts".

Both tabs make one `GET` when they open and one `POST` per change: D1, plus
one Supabase read for the people list. No KV. Decisions, storage and residual
risk: [`../specs/2026-10-03-sign-in-alerts-v2-design.md`](../specs/2026-10-03-sign-in-alerts-v2-design.md)
and [`../specs/2026-10-03-sign-in-alert-settings-design.md`](../specs/2026-10-03-sign-in-alert-settings-design.md);
what the email says and when it is sent:
[`../security/login-forensics.md`](../security/login-forensics.md) §7.

## Authorization changes and re-verification (2026-09-16)

A warm request reads three keys in one bulk KV read: `revoked-session:<sessionId>`,
`revoked:<userId>` (retired in stage 2 of the access revocation remediation) and
`authz-changed:<userId>`. When the mark differs from the one the session stored,
the request re-reads the user's row from Supabase and recomputes the page map
from D1 before it is authorised. Granting, revoking or resetting a page,
approving an access request, changing a role and applying a page-registry change
write the mark; none of them signs anyone out.

The periodic re-check (every `SESSION_REFRESH_INTERVAL_MS`) never writes a
sign-in block. A missing row ends the session with `access_denied`, an inactive
row with `account_inactive`, an untranslatable role with `role_unrecognised`.
A Supabase outage keeps the session for up to two intervals since the last good
check, then ends it with `recheck_failed`; a re-check forced by a mark gets no grace.
Design and rationale: `../specs/2026-09-16-access-revocation-remediation-design.md` (private).

## Verification

`npm run typecheck`; `npx vitest run test/sessions-console.test.ts test/session-ref.test.ts
test/sessions-permissions.test.ts test/pipeline-session.test.ts test/sessionRisk.test.ts
test/exportSessions.test.ts test/login-method.test.ts test/session-rank.test.ts
test/two-person-rule.test.ts` (the page's decisions, the session handle, fragment denies, the
session pipeline, the risk signals, the downloads, the method labels, who may end sessions and
lock people out, and the lock-out of the last Owner), and `test/sessions-section.test.ts` (the
addresses, the history filters and their SQL). On a phone: open `/dashboard/sessions` as
canonical Admin, check the row of figures, open each tab and see the address change, open a
session and a sign-in, and confirm a `manager`/`staff` user is access-denied; turn Live on and
confirm it stops by itself after 5 minutes.

| Date | Checked by | Result |
|---|---|---|
| 2026-10-24 | claude | **Scope-limited to the redesign: the bar, the addresses, the tabs, the Signed in, history and blocks tabs, and the layout of Your alerts and Alert policy.** Read every file in `src/components/admin/users/sessions/`, `src/pages/dashboard/sessions/[...section].astro`, `src/lib/sessions-section.ts`, `src/lib/login-log-filters.ts`, `src/pages/api/audit/login-logs.ts`, `src/lib/shell-state.ts` and `src/lib/auth/page-registry.ts` (`pageFor`); `test/sessions-section.test.ts` and `test/sessions-console.test.ts` pass. Live D1 (read only): the stored `login_method` values (google, github, unknown and the April `magic_link`; no `otp` row yet) and the three event types the filters map to. Not re-read: the alert rules and the authorization sections. Not rendered in a browser; `last_verified` left as it was. |
| 2026-10-23 | claude | **Scope-limited to Ways you sign in, the one-tap fix, What gets emailed and the policy's per-way rules (evening).** Read `src/lib/login-alerts/decide.ts` (`expectations`, the way rule), `policy.ts` (`WAY_RULES`, `wayRule`, `withWay`), `emailed.ts`, `handlers.ts` (`set-way`, `table`), `policy-handlers.ts`, `SignInWays.tsx`, `SignInAlertsCard.tsx`, `AlertPolicyPanel.tsx`; `test/login-alert-ways-in.test.ts` and the other sign-in alert tests pass. Live D1 (read only): the 18:52 UTC GitHub sign-in from Toronto was `queued-method` with no rule saved. Not rendered in a browser. |
| 2026-10-23 | claude | **Scope-limited to Ways in, Emailed in the last 30 days and the trusted-area wording.** Read `src/lib/login-alerts/decide.ts`, `policy.ts`, `emailed.ts`, `handlers.ts`, `policy-handlers.ts`, `AlertPolicyPanel.tsx`, `SignInAlertsCard.tsx`, `EmailedSummary.tsx`; `test/login-alert-ways-in.test.ts` and the other sign-in alert tests pass. Live D1 (read only): the owner's Toronto area (50 km) quieted 11 Google sign-ins; 10 of the 12 alerts emailed since 2026-10-09 were GitHub sign-ins. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-16 | claude | **Scope-limited to Lock out, the force sign-out key, the alert lines and the method and bot-score notes.** Read `src/pages/api/sessions/active-sessions.ts` (GET and DELETE), `src/lib/approvals/ask.ts` (`personChangeGate`, `askForSecondPerson`) and `rules.ts` (`kindForPersonChange`, `approversFor`, the 3-day wait), `src/lib/api.ts` (`jsonPending`), `src/pages/api/users/manage.ts` and `src/lib/users/manage-apply.ts` (the by-name rule), `src/pages/api/users/force-kick.ts` and `denyForceKick` in `src/lib/auth/surface-guards.ts`, `SessionsConsole.tsx`, `LockOutDialog.tsx`, `SessionDrawer.tsx`, `parts.tsx`, `sessionFormat.ts`, `sessionRisk.ts`, `src/lib/login-alerts/decide.ts` and `outcomes.ts`; the Sessions cases in `test/two-person-rule.test.ts` read. Live D1 (read only): every sign-in since 2026-10-10 carries a bot score. Corrected: the session card's method reads Unknown in production; the bot-score note; the by-name lock-out's own rule; the 202 body, the 3-day wait and who may approve; the access-change email follows the alert policy; a sign-in without Google is always urgent. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-16 | claude | **Scope-limited to Lock out and the two-person rule.** Read `src/pages/api/sessions/active-sessions.ts` (DELETE, `block_account`), `src/lib/approvals/ask.ts` (`personChangeGate`), `SessionsConsole.tsx` and `LockOutDialog.tsx`; `test/two-person-rule.test.ts` and `test/session-rank.test.ts` pass. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-16 | claude | **Scope-limited to the alert policy's new "Audit log seal" row.** Read `AlertPolicyPanel.tsx` (`AUDIT_SEAL_TEXT`), `src/lib/login-alerts/policy.ts` (`AUDIT_SEAL_MODES`, `describePolicyChange`), `policy-handlers.ts` and `src/workers/scheduled-audit-seal.ts` (`checkAndEmail`); `test/audit-seal.test.ts` covers the quiet setting and the turn-down line. The rest of the page was not re-read |
| 2026-10-16 | claude | **Scope-limited to the alert policy's new "Accounts nobody uses" row.** Read `AlertPolicyPanel.tsx`, `src/lib/login-alerts/policy.ts` (`UNUSED_MODES`, `describePolicyChange`) and `policy-handlers.ts`; `test/unused-accounts.test.ts` pins the default and the change line. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-16 | claude | **Scope-limited to the recent sign-in bullet.** Read `src/pages/api/sessions/active-sessions.ts` (DELETE), `flush-sessions.ts`, `src/pages/api/users/force-kick.ts` and `src/lib/auth/fresh-sign-in.ts`; `test/session-rank.test.ts` and `test/fresh-sign-in.test.ts` pass. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-15 | claude | **Scope-limited to the alert policy's new "Access changes emailed" row.** Read `AlertPolicyPanel.tsx`, `src/lib/login-alerts/policy.ts` and `policy-handlers.ts`; `test/access-changes.test.ts` pins the setting's default and its change line. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-14 | claude | **Scope-limited to who may end sessions and lock people out.** Read `src/pages/api/sessions/active-sessions.ts` (DELETE), `active-revocations.ts` (unblock rule unchanged) and `SessionDrawer.tsx`; `test/session-rank.test.ts` pins the route and `test/sessions-console.test.ts` the buttons. Not re-read: the rest of the page. Not rendered in a browser. |
| 2026-10-10 | claude | The whole page after the rebuild, against `src/pages/dashboard/sessions/index.astro` (→ `[...section].astro` since 2026-10-24), every file in `src/components/admin/users/sessions/`, `src/pages/api/sessions/active-sessions.ts`, `active-revocations.ts`, `flush-sessions.ts`, `src/pages/api/users/[id]/session-status.ts`, `src/pages/api/audit/login-logs.ts`, `src/lib/auth/surface-guards.ts` and `src/lib/auth/session-ref.ts`; `test/sessions-console.test.ts` and `test/session-ref.test.ts` added. Not rendered in a browser (the owner checks on his phone); the live KV and D1 were not read. |
| 2026-10-03 | claude | The `#alert-policy` fragment, both card sections and the components list, against `src/pages/dashboard/sessions/index.astro` (→ `[...section].astro` since 2026-10-24), `SignInAlertsCard.tsx`, `AlertPolicyPanel.tsx`, `src/lib/login-alerts/handlers.ts`, `policy-handlers.ts`, `test/login-alert-settings.test.ts` and `test/login-alert-policy.test.ts`, with migration `0065` read back from production. Not rendered in a browser. |
| 2026-10-03 | claude | The alert-email line in the history rows and the drawer, and the two lines added to "Your sign-in alerts", against `AuthHistoryPanel.tsx`, `AuthLogDetailDrawer.tsx`, `src/lib/login-alerts/outcomes.ts`, `src/pages/api/audit/login-logs.ts` and `test/login-alerts.test.ts`, with migration `0064` read back from production. Not rendered in a browser; the rest of the page was not re-read. |
| 2026-10-03 | claude | The `#alerts` fragment, its row in the fragment table, the card and its section, against `src/pages/dashboard/sessions/index.astro` (→ `[...section].astro` since 2026-10-24), `src/components/admin/users/sessions/SignInAlertsCard.tsx`, `src/lib/login-alerts/handlers.ts` and `test/login-alert-settings.test.ts`. The rest of the page was not re-read. |
| 2026-09-19 | claude | Re-verified against code. Corrections: `API_PAGE_MAPPING` lives in `src/lib/auth/routes.ts`, not `src/middleware.ts`; IP masking is client-side only; the Edge Blocks tile shows a green zero until its tab is opened; `#export` has no route and `#flush` is inert; seven components and the Lock Out action were missing. |
