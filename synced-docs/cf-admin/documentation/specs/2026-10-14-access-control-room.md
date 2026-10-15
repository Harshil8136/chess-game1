---
title: "Access control room — the person Access page and the Page Registry"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-15
verified_against: [code, infra]
owner: harshil
related_code: [migrations/0070_page_override_end_dates.sql, src/lib/auth/plac.ts, src/lib/auth/stages/access-map.ts, src/lib/access-center/overview.ts, src/lib/access-center/registry-access.ts, src/lib/access-center/history.ts, src/lib/access-center/draft.ts, src/lib/access-center/rules.ts, src/pages/api/system/access-overview.ts, src/pages/api/system/page-access.ts, src/pages/api/system/access-history.ts, src/pages/api/users/access-history.ts, src/pages/api/system/pages.ts, src/pages/api/users/force-kick.ts, src/pages/api/sessions/active-sessions.ts, src/components/admin/debug/registry/, src/components/admin/users/access-editor/, src/styles/pages/page-registry.css, test/registry-access.test.ts, test/access-history.test.ts, test/session-rank.test.ts, test/access-center-end-dates.test.ts, test/registry-ui-logic.test.ts]
related_docs: [../features/ACCESS-CENTER.md, ../architecture/PERMISSIONS-SYSTEM.md, ../operations/DEV-TOOLS.md, ../security/SECURITY.md, 2026-10-03-access-center-v2-design.md, 2026-10-02-access-center-design.md]
tags: [permissions, access-center, plac, registry, design, security]
---

# Access control room — design

> **In one minute:** Page Registry (`/dashboard/debug/pages`) is now the place to see and change
> who can open what across the whole portal, not only a list of pages. It shows every page and
> action, every person, every personal setting, the consoles' permissions, problems worth a look,
> and the full history of access changes, and it can change one page for many people at once. A
> person's Access page gained its own history, "copy access from someone else", and end dates on
> page settings. Two holes found on the way are closed: an Admin could sign out or block a peer.

## 1. What the owner asked for (2026-10-14)

Harshil, 04:13: *"in users/access && in /dashboard/debug/pages in cf-admin I need more better
ui/ux, feature and whatever you think we should add have as option, feature should be added. I
understand that permissions system is not limited to cf-admin architecture but also other
individual connected repos so review cf-vps, cf-backup and other services as well."*

04:15: *"/dashboard/debug/pages is more secured and ONLY accessible to VENDOR level, hence that
one should be more better, more feature rich, improved and all as currently many feature
permissions are fully locked but can be changed from USERS section!"*

Read as: make both screens clearer, add what an access administrator needs, review the
permissions of the other services, and make Page Registry the strongest of the two, because it is
the vendor's screen. "Locked … but can be changed from Users" is the complaint that the registry
could only change a page's default, while personal settings for a page could be made only one
person at a time from each person's Access page.

## 2. What the review found

The review read the permission code of cf-admin, cf-vps, cf-backup, cf-email-consumer, cf-astro
and cf-graph. This work fixes what sits inside the two screens and their routes; the rest is
listed in the private backlog with where it lives.

| Found | Fixed here |
|---|---|
| Force sign-out (`DELETE /api/users/force-kick`) refused only Owner and Vendor support targets: anyone with the Users page could sign out a peer or a senior, which also blocks their sign-in for 24 hours (PERMISSIONS-SYSTEM D6) | Yes: below Owner, only someone who strictly outranks the target (`canManageUser`) |
| Block account on the Sessions page had the same test, then turned the account off (D7); a failed account update was ignored, and a person could block themselves | Yes: the same rank rule; blocking yourself is refused (400); a failed update answers 502 with what to do |
| A personal page setting could not end: covering a colleague for a week meant remembering to undo it | Yes: an end date (migration `0070`) |
| Personal settings were visible only one person at a time, so stale ones (removed accounts, retired pages, settings equal to the role) went unseen | Yes: the Personal settings tab, with flags and bulk clean-up |
| No answer to "who changed this person's access, and why?" short of reading the whole Audit Log | Yes: a History tab on the Access page and in the registry |
| A new default role or a page switched off reached signed-in people within the hour, unless the editor ticked "apply now" | Yes: it reaches everyone on their next click |
| Viewer could be picked as a page's default, which the database cannot store, and the save failed with a generic error | Yes: refused with a clear message, and not offered |
| A page with a Vendor support default cannot be handed out by the Owner, and nothing says so (§10 of PERMISSIONS-SYSTEM) | Shown: the Checks tab lists those pages |
| The Owner-only `#force-kick` setting is checked nowhere; one session revoke signs out every device; the Audit Log can be bulk-deleted | No: each needs the owner's decision or its own piece of work (§7). Findings in the other services are tracked privately, with where each lives |

## 3. Decisions

| # | Decision | Why, and what was rejected |
|---|---|---|
| D1 | **A personal page setting can have an end date**: one nullable column, `admin_page_overrides.expires_at` (migration `0070`), the whole chosen day in UTC, at most 366 days ahead, as the console grants already work | A separate table would add a join to every access-map build (RULE #0.9). The consoles keep their own end dates in their `vps:access` and `backup:access` rows, so nothing else changed |
| D2 | **An ended setting is ignored, not deleted.** `computeAccessMap` skips it, so the role decides again; the map carries `refreshAt`, the earliest end still ahead, and the session recomputes its map when that passes, instead of waiting for the hourly refresh | Deleting at the end would need a cron job, and the screens could not say "ended on". Ended rows are removed from the Personal settings tab |
| D3 | **One read for the control room**: `GET /api/system/access-overview` answers every page, every person the viewer may see, every personal setting with its flags, and the checks. The server applies the viewer's rules before anything leaves: hidden accounts stay hidden below Owner and Vendor support, and an Owner's or Vendor support's settings are Vendor support's alone | Six tabs each calling their own route would mean six permission checks to keep in step. About 120 pages and a few dozen people is a small answer |
| D4 | **Bulk changes go through their own route**, `POST /api/system/page-access`: at most 100 changes, each checked by the same page gates as the Access page, all of them before any is written (one refusal refuses the request), then one D1 batch, one activity-log row per change (surface `page-registry`) and one re-check mark per person. One request is one unit of the shared 5-a-minute access-change limit | Reusing the Access page's save one person at a time would make 20 calls for 20 people and trip the limit. A partial write would leave the page half-changed |
| D5 | **Access history is read from the activity log**, which every access change already writes: page settings and access requests (`plac`), page defaults (`registry`), role and account changes (`users`), and console permissions changed from this portal. Fifty rows a page, newest first, with a cursor | No new table (RULE #0.9). An Owner's or Vendor support's history answers "kept for vendor support" below Vendor support, as their settings do |
| D6 | **A page's default role or switch applies at once**: `PATCH /api/system/pages` marks every active person for a re-check whenever either changes. The client's `forceLogoutAffected` is still accepted and no longer needed | The old "apply now" box was easy to miss, and leaving it unticked meant an hour in which the screen and the truth disagreed. Nobody is signed out |
| D7 | **The impact of a default change is shown before saving**, by name, from the overview (`defaultChangeImpact`), and the dry-run route `POST /api/system/preview` was removed with the old screen, its only caller | The old preview counted roles; the new one names who gains, who loses and who keeps the page through a personal setting |
| D8 | **Copy access from someone else** builds a draft on the Access page, nothing more: either everything the other person can open and use, or only their personal settings. Each copied item must be one the viewer may change, and the rest are counted as skipped. Owner and Vendor support are not offered as a source (they open everything) | Saving straight away would skip the review step every other change goes through |
| D9 | **Both screens use the console kit** (the look of the Backup and Server consoles), with every choice in a sideways row of chips or tabs, never a drop-down, and every pop-up through the shared Dialog | The owner's standing preference (2026-10-09) and RULES 7.8 |

## 4. Page Registry, the control room

Five tiles at the top, each a shortcut: pages switched on, people, personal settings, checks,
and console permissions. Under them, six tabs in one sideways row. The tab follows the address
(`#who`, `#personal`…), so a link opens the right one.

| Tab | What it does |
|---|---|
| **Pages** | Every page and its actions, grouped by sidebar group, with search and chips (everything, pages, actions, switched off, with personal settings, and each group). Each row shows its default role, how many active people open it and how many personal settings it has. Tapping a page opens its pop-up |
| **Who opens what** | *By role*: a table of pages against the six roles, from the defaults alone. *By person*: pick a person and see every page they open and why (role, personal setting, ended setting, full access) |
| **Personal settings** | Every personal setting in the portal, with its person, who set it, why, when it ends, and flags: account removed or off, ended, on an Owner or Vendor support account, on a switched-off page, the same as the role. Tick several and remove them together |
| **Consoles** | The Backup and Server consoles' permissions, one block per console, each with its default role and a Change button (moved here from inside the page list) |
| **Checks** | Problems worth a look: an unrecognised default role, actions given to more roles than their page, actions without a page, actions on a switched-off page, pages only Vendor support can hand out, pages without a description, and personal settings carrying any of the flags above. Each opens the pages or settings it names |
| **History** | Every access change in the portal, newest first, with chips by kind (page settings, page defaults, roles, accounts, consoles) and a link to the person it changed |

**The page pop-up** has three tabs. *Settings*: name, description, sidebar group, default role
(chips, "Manager and above"), order and the on/off switch, with who gains or loses the page
before you save, and a reason for the log. *People*: every person with a badge for why they do
or do not open it, and three choices each (role decides, open, closed), applied together with an
optional end date and a reason. *Actions*: the page's own `#` actions, each opening its own pop-up.

## 5. The person Access page

- **History tab** beside Access: this person's access changes, newest first.
- **Copy access from…** in the toolbar (D8).
- **End date for page changes** in the review dialog: one date ends every page grant and revoke
  in that save. "No end" keeps them until someone removes them.
- **A line under each changed row**: who set it, when, why and until when, or when it ended.
- The *Show* and *Section* pickers are chip rows, and the state "Grant ended" reads "Ended",
  because a closed setting can end too.

## 6. Who may do what

| Who | May |
|---|---|
| Vendor support | Everything on both screens |
| Owner | Everything on the Access page except: an Owner's or Vendor support's personal settings and history stay Vendor support's. Page Registry: nothing since 2026-10-15 (§7); until then everything on it, with the same exception |
| Anyone else holding the Page Registry key (`/dashboard/debug/pages`, by grant) | Nothing since 2026-10-15 (§7): the grant no longer opens it. Until then: read every tab; change a page's default and switch only where their own role opens the page and only to their own role or below; change personal settings with the same gates as the Access page (strictly outrank the person, hold the page, page within their clearance). Those rules stay in the code behind the floor |
| A read-only account | Read only |
| Vendor support alone | Remove a setting left by an account that is no longer in the directory |

The routes check all of this again; the screens only hide what the routes would refuse.

## 7. Not done, and why

| Item | Why not here |
|---|---|
| ~~**Should Page Registry be Vendor support only?** Today the Owner opens it too, because the Owner and Vendor support pass every page check (ADR-0002)~~ | **Decided 2026-10-15: Vendor support only.** A floor in `src/lib/auth/page-floors.ts` that binds the owner too, checked by `canUsePageRegistry` in the page, its hub card and every `/api/system/` route it calls; a grant of the key no longer opens it ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §5) |
| ~~**Should `/dashboard/users#force-kick` be enforced?** Its default is Owner, but nothing checks it~~ | **Decided 2026-10-15: enforced.** The owner chose to enforce it. `denyForceKick` checks it in the route and the Users page, so below the owner and vendor support only a grant opens it ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md) §5) |
| Revoking one session signs the person out on every device (D8 in PERMISSIONS-SYSTEM) | A change to the Cloudflare Access call, outside these screens |
| The Audit Log is not tamper-evident (C-9) | Designed, not built; ROADMAP chunk 19 |
| Viewer cannot be stored as a role (C-11) | The role-name migration, its own piece of work |

## 8. Tests

| Test | Pins |
|---|---|
| `test/plac.test.ts` | The map ignores an ended setting, `refreshAt` is the earliest end still ahead, and the session stage recomputes a map once a setting in it has ended |
| `test/access-center-end-dates.test.ts` | The Access page stores, shows and logs an end date, reads an ended setting as ended, and refuses an end in the past, more than a year ahead or on a reset before writing anything |
| `test/registry-access.test.ts` | The overview's rules (who opens what, flags, checks, the impact of a default change), its visibility rules for an Admin holding the key, and the bulk route: one batch with end dates, nothing written when one change is refused, the person gates, switched-off pages, removed accounts, no-ops and bad input |
| `test/access-history.test.ts` | Which activity rows count as access changes, the cursor across rows of the same second, the Page Registry key, and the hidden answer for top-tier people |
| `test/session-rank.test.ts` | Force sign-out and block account refuse peers and seniors, nobody blocks themselves, ending your own session still works, and the 502 on a failed account update; since 2026-10-15, force sign-out without a grant of `#force-kick` is refused and the Users page's button follows the same check |
| `test/registry-ui-logic.test.ts` | Which page fields a form sends, which personal-setting changes a set of choices makes, the open counts, and the "set by" line |
