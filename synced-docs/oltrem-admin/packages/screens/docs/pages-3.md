---
title: "@oltrem/screens: the pages, access, integrations, email, backups, status"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src/access.tsx, pages.tsx, backups.tsx, checkup.tsx, names.ts]
---

# @oltrem/screens: the pages, access, integrations, email, backups, status

> Part of [the @oltrem/screens README](../README.md).

## The pages, continued

| Path | Shows | Reads |
| --- | --- | --- |
| `/access/places` | Locations as a tree with Add location; Change renames or removes one (`POST /access/places/:id/rename`, `/remove`; refused with locations inside, a role ever given there, or a sibling's name) | `/api/iam/scopes`, `PATCH`, `DELETE /api/iam/scopes/:id` |
| `/access/roles/new?from=&name=`, `/access/roles/:id?view=` | Tabs Permissions, **Assigned to** (`?view=holders`: holders, Rank with Move up and down, Remove only for a role never given) and **Policy JSON** (`?view=json`: the role by names, Owner as `*`, with Copy and Import). The editor: the name; for a new role Start from Nothing, Viewer, Member, Admin or Copy of a role (`from=template:see\|do\|manage`, `role:<id>`); a row per module (`names.ts`) with "N of M" and None, View, Edit, Manage chips (each holding the one before; "Custom" when none fits; never the Owner's or Vendor's own), opening to its permissions with `area.thing.verb` and Copy; Find a module and Set all shown to a level; on the Owner role only, Special permissions (the Owner's own; never Vendor-only); a Save bar with "Views 6 modules, edits 3, manages 1". Without the script the server works out the level. The Owner role is the Vendor's to change | `/api/iam/roles/:id`, `roles`, `capabilities`, `me`; on Assigned to `bindings?roleId=&inForce=true`, `groups`, `people` |
| `/access/mine` | My access, for everyone: roles held (place, how, until, state); switch a role on for 1 to 12 hours with a reason; ask for a role (not the Owner's); requests; **Your sign-ins** (`#sign-ins`): each browser, this one marked, "Also used from …" in the attention colour, Sign out on others (`POST /access/mine/sign-ins/:id/end`), Report a sign-in and Sign out everywhere. The Vendor reads one line with a link to Vendor access | `/api/iam/me/options`, `me/grants`, `me/requests`, `me`, `me/devices`; `POST /api/iam/me/sign-out-everywhere`, `/api/iam/me/sign-ins/report` |
| `/access/decisions` | Open requests and approvals with Approve and a quiet Refuse | `/api/iam/requests`, `approvals`, `people`, `roles`, `scopes` |
| `/access/reviews` | Reviews (open, past due, closed) and Start one at a place | `/api/iam/reviews`, `people`, `roles`, `scopes` |
| `/access/reviews/:id` | Place, counts, each grant with Keep and Remove, Close (asked first) once all are decided | `/api/iam/reviews/:id`, `groups`, `people`, `roles`, `scopes` |
| `/access/groups/new`, `/access/groups/:id` | Members with Take out (asked first); Add members ticked or typed (never oneself; each tried, "2 added, 1 not" with why, `membersRefusal`); roles with Change and Remove; Give the group a role; Rename or remove, folded (remove only if it never held a role) | `/api/iam/groups/:id`, `bindings`, `roles`, `scopes`, `people?active=true&kind=person` |
| `/access/vendor` | How the Vendor may enter (any time, a window, incidents only), an Owner's pick; the open window with Close it now, or open one for 1 to 12 hours; for a Vendor, Vendor accounts with Switch off or on (not one's own) and Add | `/api/iam/tenant`, `/api/iam/me`, `/api/iam/vendors` |
| `/providers` | Find from a domain, Connect; Ready to send as a pane (each failing check's fix, Check again via `/providers/ready`, folded once all pass); Email in one step first (`/email/connect`); connected providers as cards (state, today's use, key, last answer); providers to connect as tiles, headed by kind | `/api/providers/instances`, `definitions`, `/api/email/usage` |
| `/providers/add/:definition` | Where to make the key, then its fields | `/api/providers/definitions` |
| `/providers/:id` | State, key (never shown), last check, last failure, actions, Ready to send, the provider's steps folded; the test and fields to paste again; a new key (`POST /providers/:id/key`) is probed at once | `/api/providers/instances/:id`, `/probe` |
| `/email?state=` | Delivery log: 14-day figures, latest messages (whom, subject, outcome; Trying again with "Last try: …"), state chips with counts, a 14-day chart with its table; **Campaigns today** for campaign readers; **Provider allowance** per provider beside the portal's own counts | `/api/email/messages`, `stats`, `usage`, `/api/campaigns/room`, `/api/campaigns/campaigns?status=sending` |
| `/backup` | Database and Files as ticked rows (Database untickable while the copy cannot run), Keep these for the nightly copy, Back up now, what a copy waits for with each fix, the newest run's steps (refreshed every 5 s), figures, every run; Your databases' own backups (Supabase and Neon, with a key) | `/api/backup/status`, `runs`, `/api/data/backups` |
| `/github` | Kit version, a newer release and how it arrives (the fleet, or `pnpm exec oltrem upgrade` and `npm run deploy`), deploys from GitHub, a computer and the fleet | `/api/github/status`, `runs` |
| `/health` | Checks needing a look (what was seen, where it is fixed, Turn off), passing ones folded; Service status; the free plan's budgets and how many are close; a missing or narrow Cloudflare key's three steps; Check again now while Developer is on | `/api/health/checks`, `budgets` |
| `/health/checkup` | Checkup, for Integrations readers: counts, Check every connection now, every outside connection failing first (logo, kind, last words, a retiring API's day, what fixed itself), Open on its part's page | `/api/providers/checkup` |
