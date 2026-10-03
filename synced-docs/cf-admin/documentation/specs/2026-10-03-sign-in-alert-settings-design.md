---
title: "Sign-in alert settings: pause, trusted areas, and a throttle on failures"
status: active
audience: [owner, technical, ai, operator]
last_verified: 2026-10-03
verified_against: [code, infra]
owner: harshil
related_code: [src/lib/login-alerts/policy.ts, src/lib/login-alerts/store.ts, src/lib/login-alerts/handlers.ts, src/lib/login-alerts/throttle.ts, src/lib/auth/login-event.ts, src/lib/auth/stages/bootstrap.ts, src/lib/auth/security-logging.ts, src/lib/auth/surface-guards.ts, src/pages/api/sessions/sign-in-alerts.ts, src/components/admin/users/sessions/SignInAlertsCard.tsx, migrations/0063_sign_in_alerts_permission.sql]
related_docs: [../security/login-forensics.md, ../security/SECURITY.md, ../features/SESSION-MANAGEMENT.md, ../architecture/PERMISSIONS-SYSTEM.md, ../reference/schema-change-ledger.md, ../security/RoPA.md]
tags: [security, login, alerts, email, permissions, design]
---

# Sign-in alert settings: pause, trusted areas, and a throttle on failures

> **TL;DR (non-technical):** Every sign-in to the portal used to send an email, so the people
> who sign in every day were buried in alerts about themselves. Now a person with the "Sign-in
> alerts" permission can pause their own alerts for up to a week, or mark the area they sign in
> from as trusted, so sign-ins there are recorded but not emailed. Failed sign-ins are always
> emailed, at most once every 15 minutes for the same failure, and turning alerts down sends one
> email to the security inbox so it cannot be done unnoticed. Every sign-in is still recorded
> exactly as before.

## 1. Why (2026-10-03)

Every sign-in, successful or not, was logged to `admin_login_logs` and emailed to the security
inbox (`src/lib/auth/security-logging.ts`). Live D1, the 30 days to 2026-10-03:

| Sign-ins | Rows | What they were |
|---|---:|---|
| Successful, two daily operator accounts | 62 | All placed by Cloudflare in one metro area, at two points 14 km apart, over 21 distinct IPv6 addresses |
| Successful, other accounts | 2 | Another country |
| Failed | 13 | One account, one reason (`revocation_block_active`), one day, one email per refused request |

So 77 emails, nearly all describing two people signing in to their own accounts. An alert
nobody reads protects nothing. The aim: email only the sign-ins worth reading.

Two findings shaped the design:

- **Trusting an IP address cannot work** for these accounts: 21 IPv6 addresses in a month
  (privacy addresses and mobile networks rotate). Location can: Cloudflare already geolocates
  every request (`request.cf`), and over five months the furthest reading in the same region
  was 49 km from the usual one.
- **The failure flood was its own defect**, listed open in `SECURITY.md`: the inline path had
  no cap, unlike the cron path's 5 per batch.

## 2. Decisions (owner, 2026-10-03)

| # | Decision | Why |
|---|---|---|
| D1 | A **pause**, at most **7 days**, with no "off until I turn it back on" | A switch that is forgotten in the off position is the usual way alerting dies. A pause ends by itself |
| D2 | A pause keeps quiet only sign-ins **from the country it was set in** | Testing happens at home; a sign-in from abroad during a pause is exactly the one to read |
| D3 | **Trusted areas**: up to 3, each the place Cloudflare puts the request that adds it, radius 25, 50 or 100 km (default 50) | No geocoding service, no typed coordinates, and the comparison uses the same geolocation source as the sign-in, so its errors cancel |
| D4 | Failed sign-ins are **never** kept quiet; they are **throttled**: one email per account and reason per fixed 15-minute window, with the count of the past hour | Failures are the high-signal events; the throttle removes the flood without losing the signal |
| D5 | A new permission, **`/dashboard/sessions#alerts`**, default `owner` (owner and vendor support), grantable per person on the Access page | Alerts go to a shared inbox: letting anyone quiet their own sign-ins would hide them from the people who read it |
| D6 | Turning alerts down (a pause, a new area) **emails the security inbox once** and writes an audit row | A stolen session must not be able to silence alerts quietly |
| D7 | The permission is **re-checked at every sign-in** | Taking it away turns that person's alerts back on at their next sign-in |
| D8 | Vendor support may turn down its own alerts in this deployment | Here the vendor and the operator are the same people, and D6 keeps the customer's inbox informed. For other customers, vendor support's settings could be made changeable only by their owner (`MAINTENANCE.md`) |
| D9 | A **known-browser** requirement for trusted areas is deferred | It closes the VPN gap (§7) at the cost of one email per new or private-window browser. Recorded in `MAINTENANCE.md` |

## 3. How a sign-in is decided

| Sign-in | Emailed? | Code |
|---|---|---|
| Failed or blocked (inline) | Yes, at most once per account and reason per 15-minute window | `throttle.ts` `failureAlertGate` |
| Blocked at Cloudflare Access (cron) | Yes, at most 5 per batch (unchanged) | `src/workers/scheduled-log-sync.ts` |
| Successful, account without the permission, or with no settings | Yes, as before | `store.ts` `successAlertGate` |
| Successful, inside a trusted area (same country, within the radius) | No: logged only | `policy.ts` `decideSuccessAlert` |
| Successful, paused, from the country the pause was set in | No: logged only | same |
| Successful, paused, from another country | Yes, and the email says the account is paused | same |
| Settings unreadable or malformed | Yes: an unreadable row reads as no row | `parseSettings` |

Every email carries one line saying why it was sent. A sign-in kept quiet writes an
`auth.login_alert_skipped` line to Cloudflare Observability with the reason, and its row in
`admin_login_logs` is written exactly as before.

The order inside the login event's `waitUntil` (`src/lib/auth/login-event.ts`): decide (one D1
read), write the login row, then send or skip. The failure throttle reads before the row is
written so it counts only earlier attempts.

## 4. Storage

One `admin_portal_settings` row per person: `setting_key = 'login_alerts'`,
`scope_type = 'user'`, `scope_id` = the `admin_authorized_users` id, `category = 'security'`,
`setting_type = 'json'`. This is the per-user scope the table already carries for storage
overrides, read and written through `PortalSettingsRepository`'s scoped methods. No table, no
column, no environment variable (RULE #0.8, RULE #0.9).

```json
{
  "pausedUntil": "2026-10-03T23:00:00.000Z",
  "pausedCountry": "CA",
  "areas": [
    { "id": "1a2b3c4d", "label": "Toronto, Ontario, CA", "country": "CA",
      "lat": 43.71, "lon": -79.4, "radiusKm": 50, "addedAt": "2026-10-03T15:00:00.000Z" }
  ]
}
```

- Coordinates are rounded to 2 decimals (about 1 km), and Cloudflare's own reading is a city
  centroid, so a saved area is approximate by construction. It is personal data all the same:
  `RoPA.md` lists it, and the row is deleted with the account (`src/pages/api/users/manage.ts`).
- When nothing is left (no running pause, no area) the row is deleted rather than kept empty.
- Not `admin_user_settings.preferences`: `POST /api/settings/user` rewrites that whole field on
  every theme change, which would silently wipe these settings.

## 5. The permission

`/dashboard/sessions#alerts` (label "Sign-in alerts", icon `bell`, `required_role` `owner`,
migration `0063`). `denySignInAlerts` in `src/lib/auth/surface-guards.ts` checks the Sessions
page first and then requires an explicit grant of the key (`placRequireGrant`): a missing or
inactive row refuses, so before `0063` is applied only the owner and vendor support, who
bypass PLAC, hold it. The same check runs in three places:

1. the Sessions page, which renders the card only for holders;
2. the API, on every request;
3. the sign-in itself (`bootstrap.ts`), against the access map computed for that sign-in, so
   settings apply only while the permission is held (D7).

## 6. API and screen

`GET` and `POST` `/api/sessions/sign-in-alerts` (`src/lib/login-alerts/handlers.ts`), mapped to
`/dashboard/sessions`. Self-service only: there is no target user.

| Body | Effect | Emails the inbox? |
|---|---|---|
| `{ action: 'pause', hours }`, hours one of 1, 8, 24, 72, 168 | Pause until now + hours, for the request's country (refused when Cloudflare gives no country) | Yes |
| `{ action: 'resume' }` | End the pause | No |
| `{ action: 'trust-area', radiusKm }`, one of 25, 50, 100 | Trust where the request comes from; an area within 1 km of a saved one replaces it; at most 3 | Yes |
| `{ action: 'forget-area', id }` | Remove an area | No |

Both verbs answer `{ settings, here, options }`. No coordinates leave the server: the page
gets labels, radii, the pause end and the country, and `here` (where Cloudflare places the
caller, and whether it can be trusted).

The screen is a "Your sign-in alerts" card at the top of Security → Sessions
(`SignInAlertsCard.tsx`), anchored `#alerts`, which is where every alert email's "Manage
sign-in alerts" link goes.

## 7. Cost, and what it does not defend

**CPU.** Cloudflare geolocates the request before the Worker runs. The distance check is
arithmetic: a million haversine calls took 93 ms on a development machine, so a few trusted
areas cost about a ten-thousandth of a millisecond. The 10 ms CPU limit is not in play.

**I/O and quotas.** One D1 read per sign-in for the decision (sign-ins are about 2% of
requests), after the response, inside `waitUntil`; one D1 write per settings change. No KV
reads or writes, which are the free plan's tightest limit. Fewer Brevo sends.

**Residual risk.** A sign-in from inside a trusted area is not emailed even if it is not the
account holder, for example through a VPN or proxy that exits in the same area. It is still
logged and shown on Sessions. D9's known-browser check closes this gap and is deferred.

## 8. Rollout

| Step | Status |
|---|---|
| Failure throttle and alert email fixes (local time, location in the subject, reason line) | Pushed to `main` 2026-10-03 (`4e1320e`) |
| Settings, permission, API, card | Pushed to `main` 2026-10-03, with `0063` applied to production first (break-glass, at the owner's instruction: they work from a phone; see `reference/schema-change-ledger.md`) |
| Browser check | The owner, from a phone: trust the area, sign out and in (no email), pause, and confirm a failed sign-in still emails once |
