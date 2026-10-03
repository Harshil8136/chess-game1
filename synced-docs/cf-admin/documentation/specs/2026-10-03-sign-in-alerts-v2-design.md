---
title: "Sign-in alerts v2: one email per sign-in, a policy, and a record of every email"
status: active
audience: [owner, technical, ai, operator]
last_verified: 2026-10-03
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/login-alerts/decide.ts, src/lib/login-alerts/dispatch.ts, src/lib/login-alerts/handlers.ts, src/lib/login-alerts/policy-handlers.ts, src/pages/api/sessions/alert-policy.ts, src/components/admin/users/sessions/SignInAlertsCard.tsx, src/components/admin/users/sessions/AlertPolicyPanel.tsx, migrations/0065_alert_policy_permission.sql, src/lib/login-alerts/outcomes.ts, src/lib/login-alerts/policy.ts, src/lib/login-alerts/store.ts, src/lib/login-alerts/throttle.ts, src/lib/auth/security-logging.ts, src/lib/auth/login-event.ts, src/lib/auth/stages/bootstrap.ts, src/lib/dal/LoginLogRepository.ts, src/workers/scheduled-log-sync.ts, src/components/admin/users/sessions/AuthHistoryPanel.tsx, src/components/admin/users/sessions/AuthLogDetailDrawer.tsx, src/components/admin/logs/LoginForensicsTab.tsx, migrations/0064_login_alert_outcome.sql]
related_docs: [2026-10-03-sign-in-alert-settings-design.md, ../security/login-forensics.md, ../security/SECURITY.md, ../features/SESSION-MANAGEMENT.md, ../reference/schema-change-ledger.md, ../MAINTENANCE.md]
tags: [security, login, alerts, email, design]
---

# Sign-in alerts v2: one email per sign-in, a policy, and a record of every email

> **TL;DR (non-technical):** A sign-in now sends one email, not one for every tab or expired
> session it opens. If that same sign-in later turns up in another country or on another
> device, which is what a stolen session cookie looks like, it sends an urgent email whatever
> the settings say. Every sign-in in the history now shows whether it was emailed and, if not,
> why. Behind that sits an alert policy: who receives alerts, whether each role's successful
> sign-ins are emailed every time, only when unusual, or never, and which kinds of failed
> sign-in are emailed. The policy starts at the default, which emails exactly what was emailed
> before, minus the duplicates, and the owner changes it on the Sessions page.

This extends [the first version](2026-10-03-sign-in-alert-settings-design.md) (pause, trusted
areas, the failure throttle and the `#alerts` permission), which still describes those parts.

## 1. Why (2026-10-03)

The owner found the first version not granular enough. Live D1 showed what else was wrong:

| Finding (live `admin_login_logs`, all rows to 2026-10-03) | Number |
|---|---:|
| Successful sign-in rows carrying an Access assertion tail | 370 |
| Distinct sign-ins among them (account and tail) | 282 |
| Sign-ins that produced more than one row, so more than one email | 71 |
| Extra emails those produced | 88 |
| The same, last 30 days: rows against distinct sign-ins | 66 against 47 |

One sign-in at Cloudflare Access produced a row and an email for every portal session it
opened: a second tab, a portal session that expired while the Access one had not, a sign-out
that kept the Access cookie. The gaps between repeats: 31 within 2 seconds (tabs opened
together), 15 within 2 minutes, 18 within an hour, 24 later.

Of the repeats, exactly one came from a different device than the sign-in's first row: on
2026-04-28 the same assertion arrived first as "Android 6.0; Nexus 5", which is the User-Agent
of Chrome's developer-tools device emulation, and 40 minutes later as Windows. That is the
pattern the urgent alert (D2) looks for, and also its one known false positive (§6).

The device label in the emails was wrong for phones: `deviceLabel` tested "Mac OS X" before
"iPhone" and "Linux" before "Android", so every Android sign-in (57 in 90 days) read
"Chrome on Linux". Fixed here, because the new-device rule depends on the label.

## 2. Decisions (owner, 2026-10-03)

| # | Decision | Why |
|---|---|---|
| D1 | **One email per sign-in.** A success whose Access assertion tail an earlier success of the same account already has is a repeat: logged, not emailed | The assertion is the sign-in; portal sessions are not. The claim is made inside the row's INSERT, so tabs opened in the same second cannot both win |
| D2 | **A sign-in that moves is urgent.** The same assertion from a country or device it was not seen on is emailed with a 🚨 subject, whatever the settings, pause or policy say, once per new country and device | A copied session cookie looks exactly like this, and it is the one alert that must never be silenced |
| D3 | Successful sign-ins have **three modes**: every one, only unusual ones, or never (logged only). The policy sets one per role; **every role defaults to every**, no preset | The owner chose to keep today's behaviour until they change it themselves |
| D4 | **Unusual** means a new place (more than 100 km from every place the account signed in from in 90 days; the country when Cloudflare gives no coordinates) or a new device label in those 90 days | Learned from the account's own history, so nothing to configure; Cloudflare's own geolocation on both sides |
| D5 | Failed sign-ins fall into **five kinds**, each emailed unless the policy switches it off (all on by default); the repeat window is **5, 15 or 60 minutes** (default 15) | Lets the inbox drop noise it understands (a directory outage) without losing the rest |
| D6 | **Every row records what happened to its email** in a new column, and the Sessions history and the Activity Center show it | "Why did I not get an email for this?" is answerable from the page |
| D7 | The policy: **up to 5 recipients** (none means the built-in inbox), the role modes, the failure kinds and the window, in one global settings row, changed by holders of a new `#alert-policy` key (step 2) | One home for the rules; RULE #0.8 and #0.9 |
| D8 | The personal settings grow: a mode (follow the policy, every, or unusual), a pause for every country, a copy to the account holder, and editable areas (step 2). Only an alert-policy holder may set another person to never | A person cannot silence their own successful sign-ins completely |
| D9 | Alerts go through the **email queue** with a delivery record, after checking its consumer accepts the security sender (step 3) | Brevo then Resend failover, and the Email Log shows each alert |

## 3. How a sign-in is decided (step 1, in `src/lib/login-alerts/decide.ts`)

A successful sign-in, in order; the first rule that applies wins:

| # | Rule | Emailed? | Outcome stored |
|---|---|---|---|
| 1 | Same assertion seen before, on this device, in this country | No | `repeat` |
| 1b | Same assertion seen before, but not on this device or not in this country | Yes, urgent | `sent-urgent` |
| 2 | Inside one of the account's trusted areas | No | `area` |
| 3 | Paused, for this country or for every country | No | `paused` |
| 4 | Mode `never` | No | `never` |
| 5 | Mode `unusual`, with a place and device used in the last 90 days | No | `usual` |
| 6 | Mode `unusual`, new place or new device: the email says which | Yes | `sent` |
| 7 | Mode `every` | Yes | `sent` |

The person's own settings (rules 2, 3 and their mode) apply while they hold `#alerts`, as in
version 1, or when an alert-policy holder wrote them (`managedBy`). The mode is the person's
own when set, else the policy's for their role, else `every`.

A failed sign-in: its kind (`failureKind`), then the policy's switch for that kind (`off`),
then the repeat window (`throttled`), else emailed (`sent`). The kinds, from the reasons
`bootstrap.ts` writes:

| Kind | Reasons |
|---|---|
| `unknown_person` | `not_whitelisted` |
| `account_blocked` | `account_inactive`, `revocation_block_active` |
| `outage` | `directory_unavailable` |
| `failed_check` | `jwt_email_mismatch`, `bot_score_too_low_*`, and any reason added later |
| `access_blocked` | `LOGIN_BLOCKED` rows from the 5-minute Cloudflare Access cron, still capped at 5 emails a batch |

The order inside the login event's `waitUntil` (`src/lib/login-alerts/dispatch.ts`): read the
policy, the person's settings and the account's recent sign-ins; decide; write the row with
the outcome (`sending` for an email about to go); send; record `sent`, `sent-urgent` or
`failed`. An unreadable history reads as empty, which makes a sign-in look new: alerts fail
loud. A row whose INSERT finds the sign-in already claimed is stored as `repeat` and not
emailed, whatever was decided a moment earlier.

## 4. Storage

**Migration `0064`** ([ledger](../reference/schema-change-ledger.md)):

- `admin_login_logs.alert TEXT`, nullable, no default. The values are
  `src/lib/login-alerts/outcomes.ts`'s `ALERT_OUTCOMES`. Rows from before have none, and the
  pages show "Not recorded".
- `idx_login_logs_email_created` on `(email, created_at DESC)`: the history read and the
  INSERT's claim were whole-table scans without it.

**The alert policy**: one `admin_portal_settings` row, `setting_key = 'login_alerts_policy'`,
scope `global`, category `security`. Absent or malformed reads as the default, which switches
nothing off:

```json
{
  "recipients": [],
  "success": { "staff": "unusual" },
  "failures": { "outage": false },
  "repeatWindowMinutes": 15
}
```

**The personal settings** keep their row (`login_alerts`, scope `user`) and gain optional
fields: `mode` (`policy`, `every`, `unusual`, or `never` when `managedBy` is set),
`pausedEverywhere`, `copyToMe`, `managedBy`. A row from version 1 parses unchanged.

## 5. Cost

Per sign-in, after the response, inside `waitUntil`: three reads (the policy row, the
person's row, up to 300 of the account's sign-ins in 90 days through the new index), one
INSERT and, for an email, one UPDATE. Sign-ins run at about 2.6 rows a day (79 in the 30 days
to 2026-10-03). The comparison is arithmetic over at most 300 rows, a few hundredths of a
millisecond; the 10 ms CPU limit is not in play. No KV.

## 6. What it does not defend, and its false positives

- **Only a new portal session is a sign-in event.** Someone who copies the portal session
  cookie together with the Access cookie continues that session: no row, no decision, no
  alert. The urgent alert catches the copied Access cookie used to open a session of its own.
- **The device label comes from the User-Agent, which the client sets.** An attacker who
  copies the cookie and the User-Agent string and connects from the same country is a repeat:
  logged, not emailed. The row is still there, with its IP address and place.
- **Anything that changes the User-Agent changes the device**: Chrome's device emulation (the
  2026-04-28 row in §1), a phone's "desktop site" switch, a browser that changes its string
  on update. Each sends one urgent email per new label per sign-in. Recorded in
  `MAINTENANCE.md`.
- Version 1's residual risk stands: a sign-in from inside a trusted area through a VPN that
  exits there is not emailed.

## 7. Rollout

| Step | What | Status |
|---|---|---|
| 1 | The engine: one email per sign-in, urgent moves, the policy read (default only), failure kinds, the `alert` column and its display, the device-label fix; migration `0064` applied to production before the push | Pushed to `main` 2026-10-03 (`30a3efe`) |
| 2 | The alert policy panel on Sessions behind `#alert-policy` (a new key, migration `0065`, applied first), the personal card's new options, alert emails for every change that reduces alerts or changes the recipients, `RoPA.md` for the recipients and the holder copy (§8) | Pushed to `main` 2026-10-03 |
| 3 | Delivery through the email queue, with the direct Brevo call as the fallback | Next |

## 8. Step 2: the two screens and their APIs

Both sit on Security → Sessions ([`SESSION-MANAGEMENT.md`](../features/SESSION-MANAGEMENT.md)).

**"Your sign-in alerts"** (`#alerts`, `GET`/`POST /api/sessions/sign-in-alerts`,
`src/lib/login-alerts/handlers.ts`). New actions beside version 1's pause, resume, trust and
forget:

| Body | Effect | Emails the recipients? |
|---|---|---|
| `{ action: 'set-mode', mode }`, mode `policy`, `every` or `unusual` | The person's own mode; `never` is refused | When the effective mode goes down |
| `{ action: 'pause', hours, everywhere: true }` | A pause for every country, also when Cloudflare gives no country | Yes |
| `{ action: 'trust-place', ref, radiusKm }` | Trust a place the account signed in from: `ref` is one of its own successful `admin_login_logs` rows, offered by `GET` as `places` (grouped within 10 km, up to 5, newest first, those already trusted left out) | Yes |
| `{ action: 'edit-area', id, radiusKm?, label? }` | Rename or resize an area | When the radius grows |
| `{ action: 'copy-to-me', on }` | A copy of each alert to the account holder (not when they are already a recipient) | No |

A write through this API removes `managedBy`: the settings are the person's own again, and
apply while they hold `#alerts`. The answer gains `mode`, `roleMode`, `effectiveMode`,
`pausedEverywhere`, `copyToMe`, `managedBy` and `places`; still no coordinates.

**"Sign-in alert policy"** (`#alert-policy`, migration `0065`, `GET`/`POST
/api/sessions/alert-policy`, `src/lib/login-alerts/policy-handlers.ts`):

| Body | Effect | Email |
|---|---|---|
| `{ action: 'save', policy }` | Replace the policy (recipients trimmed, lower-cased, without repeats; at most 5) | When it turns alerts down or changes the recipients: to the recipients before and after, with each change listed (`describePolicyChange`) |
| `{ action: 'test' }` | A test email to the recipients, audited as `notify` | The test itself |
| `{ action: 'set-person', userId, mode }` | Another person's mode, `never` included; stores `managedBy` (the holder's email) so it applies whether or not the person holds `#alerts` | When their effective mode goes down |
| `{ action: 'reset-person', userId }` | Delete another person's settings | No |

`GET` answers the policy, the built-in recipient, and `people`: every active person from the
Supabase directory (`listActivePeople`, which `listActiveRoles` now reads through, so the
number of Supabase call sites is unchanged) with their role, mode, effective mode, pause,
areas and `managedBy`. A holder's own account is refused by `set-person` and `reset-person`:
it is managed from the card, where never is not offered.

Every change writes a `security` audit row. The emails reuse `sendAlertSettingsEmail`, which
gains a "Changed by" row and a title for a recipients-only change; the test is
`sendAlertTestEmail`.
