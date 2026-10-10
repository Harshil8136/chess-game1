---

title: "Session Management (Security section)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-10
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/sessions/index.astro, src/components/admin/users/sessions/SessionsConsole.tsx, src/lib/auth/session-ref.ts, src/components/admin/users/sessions/SignInAlertsCard.tsx, src/components/admin/users/sessions/AlertPolicyPanel.tsx, src/pages/api/sessions/sign-in-alerts.ts, src/pages/api/sessions/alert-policy.ts, src/pages/api/sessions/active-sessions.ts, src/pages/api/sessions/active-revocations.ts, src/pages/api/sessions/flush-sessions.ts, src/lib/auth/surface-guards.ts, src/lib/auth/routes.ts]
related_docs: [USER-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../security/login-forensics.md, ../architecture/plac-and-audit.md, ../specs/2026-10-03-sign-in-alerts-v2-design.md]
tags: [sessions, security, plac, rbac, kv, forensics]
---

# Session Management

> **Scope note (2026-08-23).** This document covers the sessions console. Session
> lifecycle, revocation layers and their timing are described in full in
> [`../architecture/PERMISSIONS-SYSTEM.md`](../architecture/PERMISSIONS-SYSTEM.md).


> **TL;DR:** The **Security → Sessions** page (`/dashboard/sessions`) shows who is
> signed in, every sign-in, who is barred from signing in, your own sign-in alert
> emails and the alert policy, one tab each. Gated to canonical **Admin** and above
> (stored `super_admin`+) via a dedicated PLAC page row; what each person may do on it
> comes from the page's permission keys, and a control they lack shows switched off
> with the reason. Rebuilt from scratch on 2026-10-10 on the console kit
> ([change record](../records/reports/2026-10-10-sessions-settings-github-and-pop-ups.md)).
> Built KV-budget-aware: the list is read once, Live is opt-in and self-limiting.

## Location & access

- **Route:** `src/pages/dashboard/sessions/index.astro` → `/dashboard/sessions`
  (top-level, depth-2 so it renders as a sidebar nav item). The old
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
`src/pages/dashboard/sessions/index.astro` passes them to the console as `access`), so a
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
  Raised for triage in [`../MAINTENANCE.md`](../MAINTENANCE.md) (D-5) and
  `PERMISSIONS-SYSTEM.md`, both of which record the same claim.

## Components (code-split)

`src/components/admin/users/sessions/`, rebuilt 2026-10-10 on the console kit
(`src/styles/components/console.css`, [`DESIGN-SYSTEM.md`](../reference/DESIGN-SYSTEM.md)
§9.9) and the shared Dialog (§9.8):

- `SessionsConsole.tsx`: the shell. Header with Refresh, the time of the last read and
  Live; five tiles; the tabs on one sideways row; the drawers and the lock-out dialog;
  every action and its confirm; the downloads.
- `SignedInPanel.tsx`: the **Signed in** tab, one card per session, a search, three filters
  (Everyone, Unusual, Yours) and the two actions a session has; `EveryoneAtOnce.tsx`, the
  panel under it (lock out a person, clear stale sessions, sign everyone else out).
- `sessionTabs.tsx`: which tabs a person's access shows, their names, and the tab a link's
  hash opens.
- `HistoryPanel.tsx`: the **Sign-in history** tab, a table on a wide screen and a stack of
  cards on a phone, with outcome and method chips and pages of 25, 50 or 100.
- `BlocksPanel.tsx`: the **Sign-in blocks** tab.
- `SignInAlertsCard.tsx`: the **Your alerts** tab, for holders of `#alerts` only.
- `AlertPolicyPanel.tsx`: the **Alert policy** tab, for holders of `#alert-policy` only.
- `SessionDrawer.tsx`, `SignInDrawer.tsx`: one session, one sign-in, in full (the Dialog's
  drawer: from the right on a wide screen, from the bottom on a phone). The full address
  shows only here.
- `LockOutDialog.tsx`: lock out a person by name, from a list of only the people the route
  would accept.
- `SessionForensicsDrawer.tsx`: one person's sessions, opened from their row on the Users
  page, on the same Dialog and kit pieces (`ck-scope`).
- `parts.tsx`: the small shared pieces (the header tile, method and device icons, badges, copy
  button, the empty, error and loading states).
- `sessionRisk.ts` (risk signals), `exportSessions.ts` (CSV and JSON), `sessionTypes.ts`
  (`maskIp`), `sessionFormat.ts` (device, times, sign-in method), `sessionBadges.ts` (tones):
  pure helpers, unit-tested.

Removed on 2026-10-10: `SessionCommandCenter.tsx`, `ActiveSessionsPanel.tsx`,
`AuthHistoryPanel.tsx`, `EdgeBlocksPanel.tsx`, `SessionDetailDrawer.tsx`,
`AuthLogDetailDrawer.tsx`, `ForensicComponents.tsx`, `useIsMobile.ts` and
`src/styles/pages/session-registry.css`.

## Tabs & data sources

| Tab or tile | Source | KV cost |
|-----|--------|---------|
| Signed in, and the **Signed in now** and **Unusual** tiles | `GET /api/sessions/active-sessions` (`kv.list` + gets), once when the page opens and on Refresh | 1 list/call |
| Sign-in history | `GET /api/audit/login-logs?limit=100` (D1), the first time the tab opens; **Read the 100 sign-ins before these** pages back with `offset` | none |
| **Signed in, last 24 hours** and **Failed or refused, last 24 hours** tiles | two counts from the same route (`limit=1&success=true\|false&dateFrom=`, reading `total`), only for holders of the history | none |
| Sign-in blocks, and its tile | `GET /api/sessions/active-revocations` (KV `revoked:*`), only when the tab or the tile is opened | 1 list/call |
| Your alerts | `GET /api/sessions/sign-in-alerts` (D1) | none |
| Alert policy | `GET /api/sessions/alert-policy` (D1, one Supabase read) | none |

The blocks tile reads **—** with "Not checked yet: tap to check" until the blocks are
read, then the real count. Until 2026-10-10 it showed a green **0** and "No active
blocks" before anything was read, a false all-clear on the one screen an operator uses to
find a person stranded behind a 24-hour block; the old "Logins today" tile, which counted
something else, is gone with `GET /api/audit/stats` on this page.

A link to `/dashboard/sessions#signed-in`, `#history`, `#blocks`, `#alerts` or
`#alert-policy` opens that tab (the alert emails' "Manage sign-in alerts" link is
`#alerts`), and choosing a tab writes its hash, so a tab can be shared.

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

- **Per-session drawer**: tap a card for the full address, place, device, sign-in method,
  Ray ID and times, with **End this session** and **Lock out**. The session you are using
  now cannot be ended from here (sign out instead), and you cannot lock yourself out.
- **Unusual sessions**: `sessionRisk.ts` flags a person signed in from more than one country
  at once (the **Unusual** tile and filter). In the history: an email not on the user list
  and a refused attempt (high), outdated TLS (medium), and a Cloudflare bot score below 30
  ("Likely automated", high). Cloudflare scores 1 for certainly automated and 99 for
  certainly a person; until 2026-10-10 this read scores above 50 as the risk, which flagged
  people and passed bots. The score is null on the free plan and is treated as no signal.
- **History filters**: outcome (Everything, Signed in, Failed, Refused), method (Google,
  GitHub, Email code, Unknown) and a search over email, place, address and Ray ID, over what
  has been read; **CSV and JSON** downloads of what the filters leave, for holders of
  `#export`. The method chip and the method label now agree: until 2026-10-10 the filter
  said "OTP" and matched the text, while the label said "Email code".
- **Alert email per row** (2026-10-03): an envelope icon when the sign-in was emailed, a
  muted bell with the reason when it was not (the same sign-in as before, paused, trusted
  area, alert policy, usual place and device, a repeat of a recent failure); the sign-in
  drawer shows it too. Read from `admin_login_logs.alert` (migration `0064`); rows from
  before read "Not recorded". Labels: `src/lib/login-alerts/outcomes.ts`.
- **Everyone at once** (under the Signed in list): **Lock out a person**, **Clear stale
  sessions** (sessions whose account is off or gone, and entries that cannot be read) and
  **Sign everyone else out** (type SIGN OUT to confirm; keeps your own session). The last
  two are the owner's and vendor support's (`flush-sessions.ts`). Each shows switched off,
  with the reason, for anyone else.
- **Lock out**: from a session, `DELETE /api/sessions/active-sessions` with
  `action: block_account` (`#revoke`); by name, a `PATCH /api/users/manage` with
  `is_active: false`, gated by `/dashboard/users`. Both sign the person out everywhere,
  switch their account off **and write a 24-hour `revoked:` sign-in block**. Reactivating
  the account via the same PATCH clears the block; a force-kick from the user registry does
  not, and can only be lifted here under **Sign-in blocks** (`#unblock`). See
  [`USER-MANAGEMENT.md`](USER-MANAGEMENT.md) §5.4. The owner's and vendor support's
  sessions and blocks are out of reach for anyone below them: the routes refuse, and the
  page says so on the button.
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
  both are logged in [`../MAINTENANCE.md`](../MAINTENANCE.md).

## Your sign-in alerts (2026-10-03)

The **Your alerts** tab, opened by `#alerts` (every alert email links to it), for the
signed-in person's **own** sign-in alert emails. Every choice is a row of chips, so all
of them show at once (2026-10-10; it was a card above the page with dropdowns). Rendered only for holders
of `/dashboard/sessions#alerts` (owner and vendor support by default; grantable on
the Access page); `GET`/`POST /api/sessions/sign-in-alerts` checks the same key.

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
  Each area has a 25, 50 or 100 km radius, can be renamed or resized, and
  **Remove** forgets it. Sign-ins inside an area are logged but not emailed.
- **Also email me about my own sign-ins** sends you a copy of each alert.
- Turning alerts down (a pause, a new or wider area, a lower mode) sends one email
  to the alert recipients and writes an audit row. Settings you change are your
  own again, even if an alert-policy holder set them before.

Whatever the card says, a sign-in is emailed once, not once per tab or portal
session it opens, and a sign-in that turns up in another country or on another
device is emailed as urgent ([sign-in alerts v2](../specs/2026-10-03-sign-in-alerts-v2-design.md)).

## Sign-in alert policy (2026-10-03)

The **Alert policy** tab, opened by `#alert-policy`, every choice a row of chips, for holders of
`/dashboard/sessions#alert-policy` (owner and vendor support by default);
`GET`/`POST /api/sessions/alert-policy` checks the same key.

- **Alerts go to:** up to 5 addresses; none means the built-in inbox. **Send a test
  email** sends one to the current list.
- **Successful sign-ins emailed, by role:** every sign-in, only unusual ones, or
  none. Every role starts at every sign-in.
- **Failed sign-ins emailed:** a switch for each of the five kinds, all on to
  start, and the repeat window for the same failure (5, 15 or 60 minutes).
- **Save policy** saves the lot. A save that turns alerts down, or changes the
  recipients, emails the recipients before and after the change.
- **People:** everyone active, with what their successful sign-ins send. A holder
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
Design and rationale: [`../specs/2026-09-16-access-revocation-remediation-design.md`](../specs/2026-09-16-access-revocation-remediation-design.md).

## Verification

`npm run typecheck`; `npx vitest run test/sessions-console.test.ts test/session-ref.test.ts
test/sessions-permissions.test.ts test/pipeline-session.test.ts test/sessionRisk.test.ts
test/exportSessions.test.ts test/login-method.test.ts` (the page's decisions, the session
handle, fragment denies, the session pipeline, the risk signals, the downloads and the
method labels). On a phone: open `/dashboard/sessions` as canonical Admin, check the five
tiles, open each tab, open a session and a sign-in, and confirm a `manager`/`staff` user
is access-denied; turn Live on and confirm it stops by itself after 5 minutes.

| Date | Checked by | Result |
|---|---|---|
| 2026-10-10 | claude | The whole page after the rebuild, against `src/pages/dashboard/sessions/index.astro`, every file in `src/components/admin/users/sessions/`, `src/pages/api/sessions/active-sessions.ts`, `active-revocations.ts`, `flush-sessions.ts`, `src/pages/api/users/[id]/session-status.ts`, `src/pages/api/audit/login-logs.ts`, `src/lib/auth/surface-guards.ts` and `src/lib/auth/session-ref.ts`; `test/sessions-console.test.ts` and `test/session-ref.test.ts` added. Not rendered in a browser (the owner checks on his phone); the live KV and D1 were not read. |
| 2026-10-03 | claude | The `#alert-policy` fragment, both card sections and the components list, against `src/pages/dashboard/sessions/index.astro`, `SignInAlertsCard.tsx`, `AlertPolicyPanel.tsx`, `src/lib/login-alerts/handlers.ts`, `policy-handlers.ts`, `test/login-alert-settings.test.ts` and `test/login-alert-policy.test.ts`, with migration `0065` read back from production. Not rendered in a browser. |
| 2026-10-03 | claude | The alert-email line in the history rows and the drawer, and the two lines added to "Your sign-in alerts", against `AuthHistoryPanel.tsx`, `AuthLogDetailDrawer.tsx`, `src/lib/login-alerts/outcomes.ts`, `src/pages/api/audit/login-logs.ts` and `test/login-alerts.test.ts`, with migration `0064` read back from production. Not rendered in a browser; the rest of the page was not re-read. |
| 2026-10-03 | claude | The `#alerts` fragment, its row in the fragment table, the card and its section, against `src/pages/dashboard/sessions/index.astro`, `src/components/admin/users/sessions/SignInAlertsCard.tsx`, `src/lib/login-alerts/handlers.ts` and `test/login-alert-settings.test.ts`. The rest of the page was not re-read. |
| 2026-09-19 | claude | Re-verified against code. Corrections: `API_PAGE_MAPPING` lives in `src/lib/auth/routes.ts`, not `src/middleware.ts`; IP masking is client-side only; the Edge Blocks tile shows a green zero until its tab is opened; `#export` has no route and `#flush` is inert; seven components and the Lock Out action were missing. |
