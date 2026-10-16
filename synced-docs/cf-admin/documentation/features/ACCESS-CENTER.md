---
title: "Access Center (the per-person access editor)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-16
verified_against: [code]
owner: harshil
related_code: [src/components/admin/users/access-editor/, src/lib/access-center/, src/pages/api/users/access-center.ts, src/pages/api/users/access-templates.ts, test/access-templates.test.ts, src/pages/api/users/access-history.ts, src/pages/dashboard/users/[id]/access.astro, src/styles/components/access-editor.css, src/components/admin/debug/ConsoleFeatures.tsx, src/components/admin/debug/registry/, src/pages/api/system/console-features.ts, test/access-center-end-dates.test.ts, test/access-history.test.ts, test/registry-ui-logic.test.ts, test/access-center-rules.test.ts, test/access-center-draft.test.ts, test/access-center-profile.test.ts, test/access-center-api.test.ts, test/access-page-gates.test.ts, test/access-why.test.ts, test/see-as.test.ts, test/access-console-requests.test.ts]
related_docs: [../specs/2026-10-14-access-control-room.md, ../specs/2026-10-03-access-center-v2-design.md, ../specs/2026-10-02-access-center-design.md, ../architecture/PERMISSIONS-SYSTEM.md, VPS-CONSOLE.md, BACKUP-CONSOLE.md, USER-MANAGEMENT.md, ../reference/DESIGN-SYSTEM.md]
tags: [permissions, access-center, plac, vps, backup, registry, ui]
---

# Access Center

> **TL;DR (non-technical):** A person's Access page is one editor. It lists every portal
> page and page action, every server-console permission and every backup-console
> permission, each with the role that gets it by default and whether this person has it
> and why. Anything you are allowed to change has a switch. Switches only change a draft;
> you review the changes and save them together, with an optional end date for page
> changes. A History tab shows every access change made to the person, *Copy access
> from…* fills the draft from someone else's access, and *Templates* switches on a named set
> ("Front desk") the Owner saved. Page Registry
> (`/dashboard/debug/pages`) is the portal-wide view of the same thing: every page, person,
> personal setting and console permission, checks, and the history of every change; it can
> change one page for many people at once ([its design](../specs/2026-10-14-access-control-room.md)).

The design, and the reasons for it, are in
[the v2 spec](../specs/2026-10-03-access-center-v2-design.md); the console rules (T1–T5,
floors, delegation) are in [the v1 spec](../specs/2026-10-02-access-center-design.md) §4. End
dates, history, copying and the registry's control room were added on 2026-10-14
([the control-room spec](../specs/2026-10-14-access-control-room.md)).

## 1. Where things are

| | |
|---|---|
| Screen | `/dashboard/users/[id]/access`: the header (name, email, role badge, *Back to Users*), then the `UserAccessEditor` island |
| Components | `src/components/admin/users/access-editor/`: `UserAccessEditor` (load, draft, save, the Access and History tabs), `AccessChrome` (summary pills, toolbar, save bar), `AccessSections` (category and console cards), `AccessRow`, `AccessReviewDialog`, `AccessHistoryList` (the history, shared with Page Registry), `CopyAccessDialog`, `TemplatesDialog`, `labels.ts` (every word the rows use) |
| Styles | `src/styles/components/access-editor.css`, imported by `global.css`; colours from `data-category` and `data-class` |
| Data | `GET /api/users/access-center?userId=<id>` on load; `POST /api/users/access-center` to save; `GET /api/users/access-history?userId=<id>&before=<cursor>` for the History tab; `GET/POST/DELETE /api/users/access-templates` for *Templates* (§3.3) |
| Server | `src/lib/access-center/`: `page-gates.ts` and `rules.ts` (who may change what), `pages.ts` and `profile.ts` (the profile), `handlers.ts` (the two verbs), `history.ts` (the history), `console-client.ts` and `consoles.ts` (the console calls), `draft.ts` (the browser's draft, the copy and the templates' apply, pure), `templates.ts` (the stored templates) |
| Registry | `src/components/admin/debug/registry/` (the control room, §4) and `ConsoleFeatures.tsx` (its Consoles tab); `GET /api/system/access-overview`, `POST /api/system/page-access`, `GET /api/system/access-history`, `GET/POST/PATCH /api/system/console-features` (`src/lib/access-center/registry-access.ts`, `history.ts`, `registry.ts`) |

## 2. The screen

From top to bottom, under two tabs, **Access** and **History** (the person's access changes,
newest first, fifty at a time, with chips by kind):

1. **Summary pills**: pages open, personal overrides, each console's permissions held, and
   unsaved changes. A notice follows when the viewer may look but not change (their own
   account, someone at or above their role, a read-only account).
2. **Toolbar**: search; *Show* and *Section*, each a sideways row of chips (everything,
   different from the role, has access, no access, I can change, unsaved changes; then one chip
   per section); *Copy access from…*; *Resend invite*; *Reset all to role*, which marks every
   override the viewer may remove (nothing is saved until review).
   *Copy access from…* lists the other active people (not Owner or Vendor support, who open
   everything) and offers *Match everything* (what they can open and use) or *Personal
   settings only* (their own grants and revokes). It fills the draft with the changes the
   viewer may make, says how many it skipped, and saves nothing.
   *Templates* (since 2026-10-16, item #32) lists the saved templates, each with its note and
   the first items it opens. Picking one says how many switches it would turn on for this
   person; *Switch on N* puts them in the draft. It never switches anything off: a page or
   permission the person already has, or one the template does not name, stays as it is. An
   item the viewer may not give is counted and left alone, and an item this person's access
   does not list (a console not answering, a page since removed) is counted as missing. The
   Owner and Vendor support also see *Save as a new template* (what this person opens with the
   unsaved changes, without what their role or a floor fixes), *Replace* and *Remove* (tap
   twice). At most 20 templates, names unique and up to 40 characters, notes up to 200.
3. **Category cards**, one per registry category in registry order, coloured as in the
   registry. A page's `#` actions sit under it with a tree line and a *Feature* tag. A
   feature whose page is off says it has no effect until the page is on.
4. **Console cards**, *Server console* then *Backup console*, each headed by the console's own
   page row (*Console page*), then its permissions by class, then **Personal grant** (end date
   and note, which apply to everything granted there). Since 2026-10-15 (item #23) a console
   grant that starts giving a permission above the role, where none was in force, starts with
   an end 90 days ahead; *No end* clears it, and the date stays cleared for the rest of that
   draft. Floors a role can never hold are one
   collapsed line, not disabled rows. A console that is hidden from the viewer or does not
   answer still shows its page row, with the reason and *Retry*.
5. **Save bar** (sticky): pages open, personal overrides; with unsaved changes, their count,
   *Discard* and *Review N changes*.
6. **Review dialog**: every change *was → will be*, by section; grant end date and note
   changes; with page changes, *Page changes end on* (a day from today to 366 days ahead, or
   *No end*), which ends every page grant and revoke in the save; warnings; an optional reason
   for the activity log; *Apply*. Since 2026-10-15 (item #23) a save that only opens pages
   starts with an end 90 days ahead, until the person picks a day or *No end*; a save that also
   closes a page starts with none, since the one date would end the closing too. The servers
   still accept no end; the default is the editor's (`DEFAULT_GRANT_DAYS`,
   `src/lib/access-center/limits.ts`). Page Registry's personal settings for many people do the
   same on the first *Open*.

### 2.1 A row

| Part | Meaning |
|---|---|
| Default-role badge | The lowest role that has it by default (that role and every role above). *Custom* with role dots: a console default that is not a ladder. *Owner & Vendor*: a floor. *Admin and above* or *Vendor support only*: a page's role floor (`src/lib/auth/page-floors.ts`). *Unrecognised*: a page whose stored role this portal cannot read (nobody below Owner is let in) |
| State | *From role*, *Not in role*, *Granted* and *Revoked* (each with its end date), *Ended* (a setting whose end date has passed: the role decides again), *Full access* (Owner and Vendor support open every page), *Owner & Vendor only* (floor), *Not for this role* (a page whose role floor keeps the person's role out, whatever is stored: since 2026-10-16 such a row is closed and fixed, and offers only a Reset when a setting is stored; open item AC-9) |
| The line under it | For a stored setting: who set it, when, why and until when, or when it ended (`overrideMeta` in `labels.ts`). A console permission given for a while (an approved request, #22) reads *Given for a while · until* its own end |
| Reset / Undo | Reset removes a stored override; Undo drops an unsaved change |
| Switch | Whether the person will have it. Disabled with a tooltip when the viewer may not make that change |
| *Unsaved* tag and amber edge | The row differs from what is stored |

A switch sets the smallest override: off for what the role gives is a deny, on for what it
does not give is a grant, and back to the role's answer removes the override. A viewer may
be able to take something away but not give it (above their clearance), or give but not
take; the switch is disabled in the direction they cannot go.

**Permissions given for a while** (since 2026-10-16, permissions item #22). An approved console
permission request ([USER-MANAGEMENT §6.1](USER-MANAGEMENT.md)) is kept by the console beside the
grant, in `temporary`, with its own end. Here it shows as *Granted* with that end. Saving the
person keeps it exactly as it is, and never moves it into the allow list, so it still ends on
its own date; turning it off takes it away. The **Personal grant** end date does not cover it,
and the card says so when the person has one.

## 3. The data

Every answer is `{ "ok": true, "data": … }` or
`{ "ok": false, "error": { "code", "message", "need"?, "issues"?, "system"? } }`, never
cached. The shapes are in `src/lib/access-center/types.ts`; import them, do not copy them.

### 3.1 GET: the profile

`data` is `{ person, viewer, systems }`. `systems` is always `[pages, vps, backup]`.

| Field | Meaning |
|---|---|
| `system.status` | `ok`, `unavailable` (did not answer; `message` says why) or `hidden` (not for this viewer; `need` names the rule) |
| `system.groups` | Pages: one per category (`category` is its colour). Console: `page` (the door's `#` features, if any) and one per capability class |
| `system.door` | Console: its page in this portal, a pages item |
| `system.lockedItems` | Console: floors this person's role can never hold |
| `system.rev`, `grant`, `grantExpired`, `canManage`, `canDelegate` | Console: the policy revision, the person's grant (with `temporary`, the permissions given for a while still running), and what the viewer holds there |
| `item.kind` | `page`, `feature` (`parent` is its page) or `capability` |
| `item.requiredRole`, `customRoles` | The default role, or the roles of a custom console default |
| `item.baseline` | Whether the role gives it, before any override |
| `item.override` | `grant`, `deny` or `null`, as it applies now (an ended console allow is `null`; a deny still applies) |
| `item.effective`, `source` | On or off now, and why (`role`, `grant`, `deny`, `expired`, `top-tier`, `locked`, `none`) |
| `item.editable`, `canAllow`, `canDeny`, `whyNot` | What the viewer may change, and why not (`self`, `outranked`, `top-tier-target`, `full-access`, `read-only`, `not-held`, `above-clearance`, `locked`, `no-delegate`) |
| `item.overrideBy`, `overrideAt`, `overrideReason`, `expiresAt` | Who set a page override, when and why; when a page override or a console grant ends (`source: expired` once it has) |
| `item.temporaryUntil` | A console permission given for a while: when it ends (`expiresAt` is the same). It counts until then whatever the grant's own end, and a deny still wins |

### 3.2 POST: one save

```json
{ "userId": "…", "reason": "covering the front desk",
  "pages": [{ "path": "/dashboard/emails#compose", "action": "grant" }],
  "vps": { "rev": 7, "grant": { "allow": ["host.view"], "deny": [], "expiresAt": "2026-12-31T23:59:59.000Z", "note": "on call" } },
  "backup": { "rev": 4, "grant": null } }
```

`action` is `grant`, `revoke` or `reset`. A grant or revoke may carry `expiresAt` (ISO 8601,
UTC, the whole chosen day: `2026-12-31T23:59:59.000Z`), stored in
`admin_page_overrides.expires_at` (migration `0070`); a reset may not. A console's grant is sent whole; `null`, or empty
lists, removes it. It may carry `temporary`, `{ "<capability>": { "until", "note"? } }`: the
editor sends back the running permissions given for a while, and one left out is taken away.
One whose end has passed is dropped before sending; one that is a floor, has no future end or
runs past 90 days is refused, as the console would. The person and their role are read from the database by `userId`;
anything else in the body is ignored. The browser builds this with `toSave` in `draft.ts`.

| Status | Meaning |
|---|---|
| 200 | `data` is `{ profile, results }`: the fresh profile and `{ ok, changes }` or `{ ok: false, code, message, need?, issues? }` per system sent. A console can still refuse here (a stale revision): only that system's changes stay in the draft |
| 400 | Malformed, nothing to save, an unknown or repeated page, an unknown capability, an end date (page or console) in the past or over 366 days, an end date on a reset, a long note. Nothing was saved |
| 403 | A rule refused (`need`, and `system` for the part). Nothing was saved |
| 404 | No such person, or a hidden account the viewer may not see |
| 429 | More than 5 access saves a minute (one save counts once) |
| 502 | A console that had to be asked did not answer. Nothing was saved |

### 3.3 Templates

`GET /api/users/access-templates` answers `{ templates, canManage }` to anyone the Users page
opens for; `canManage` is true for the Owner and Vendor support. A template is
`{ id, name, note, items: [{ entry, label }], savedBy, savedAt }`, where `entry` is the draft's
key: `pages|<path>` for a page or `#` feature, `vps|<capability>` or `backup|<capability>`.

```json
{ "id": "…", "name": "Front desk", "note": "Reception shifts",
  "items": [{ "entry": "pages|/dashboard/bookings", "label": "Bookings" },
            { "entry": "backup|runs.view", "label": "Backup console: See runs" }] }
```

`POST` saves one: without `id` a new template, with `id` a replacement. `DELETE ?id=<id>`
removes one. Both answer `{ templates, canManage }` (a save adds `template`) and write one
activity-log row (module `users`, target `access_template`, the entries in its context).

| Status | Meaning |
|---|---|
| 400 | Malformed: no name, no items, more than 200 items, an entry that is not a page or console permission, an unknown field, a name over 40 or a note over 200 characters |
| 403 | Not the Owner or Vendor support (saving and removing), or the Users page is closed |
| 404 | The template no longer exists |
| 409 | Already 20 templates, or another template has that name (in any case) |
| 429 | More than 10 template changes a minute |

The templates are one JSON row of `admin_portal_settings` (`access:templates`, category
`access`), so there is no new table. Two saves at the same moment can lose one; with only the
Owner and Vendor support writing, that is accepted. A read checks the row by hand rather than
with the save schema, which keeps a full row (20 templates of 200 items) at about 1.3 ms of CPU
(measured in the test pool, 2026-10-16). Applying a template runs only in the browser
(`applyTemplate` in `draft.ts`).

## 4. Page Registry and its Consoles tab

Page Registry (`/dashboard/debug/pages`) is the control room for everyone's access: tiles, then
seven tabs (Pages, Who opens what, See it as, Personal settings, Consoles, Checks, History). The tabs, the
page pop-up and who may do what are in
[the control-room spec](../specs/2026-10-14-access-control-room.md) §4 and §6; the routes are
in [`DEV-TOOLS.md`](../operations/DEV-TOOLS.md) §2. Personal settings made there go through the
same page gates as this screen (`page-gates.ts`) and appear in the person's History tab.
Since 2026-10-16 (open item AC-9) Page Registry reads a page's role floor first too: *Who opens
what* shows a floored page as closed to the roles it keeps out ("Not for the role"), a stored
grant the floor ignores is flagged *No effect: page floor* on Personal settings and counted on
Checks, and a new grant the floor would ignore is refused, as it is here and at an invitation.

*Since 2026-10-16 (#26)* **See it as** previews, read-only, what a role or one person gets: pick
*A role* or *A person* from the chips, and see their sidebar as the sidebar draws it (each page
open or locked, grouped and ordered the same way), each page opening onto its actions and
sub-pages with why each opens or not, and their Server and Backups powers with the number held,
whether the console's page opens for them, and which powers were given personally. A person's
console powers are this screen's own profile read (§3); a role's are the Consoles tab's defaults.
Nothing is saved from it; *Change on their Access page* leads here.

The **Consoles** tab shows one block per console (Server, then Backup) with one row per
capability: label, key, class, default role and the live personal grants that mention it, and a
*Change* button. Change opens a dialog: pick the new default from a row of chips ("Manager and
above"), see who gains and who loses it among active people, give a reason, apply. Floors are
locked. The save goes to the console's `POST access/role`, which keeps every personal grant,
and writes one activity-log row under the console's module. Since 2026-10-15 Page Registry,
this tab included, is vendor support only (the owner's decision); from 2026-10-10 until then
anyone holding its key used the rows, moving a permission only within their own role. The
console still checks the person's own `access.manage`
([`DEV-TOOLS.md`](../operations/DEV-TOOLS.md) §2.2).

*Since 2026-10-16 (#28)* a console's block warns when its page lets in a role that holds no
permission there by default: a Manager opening a console whose permissions all start at Admin
would find a console that refuses everything. The warning names those roles and offers **Give
{front-page permission} to {the page's role} and above**, which opens the Change dialog with that
role already picked, so the impact preview shows before anything is applied. The front-page
permission is the console's `viewCapability` (`host.view` on the Server console, `console.view`
on the Backup console); when it is a floor, the warning only says what to do. The check is
`consoleGap` in `src/components/admin/debug/registry/logic.ts`, from the registry's page roles
and the console's role defaults; personal grants are left out. On 2026-10-16 both console pages
start at Admin (read through the D1 connector), so no warning shows today.

## 5. Working on the screen

- The words are in `labels.ts` and `src/lib/access-center/messages.ts` (shared with the
  server's refusals); change them there, not in a component.
- Style with Tailwind for layout and `access-editor.css` for colour. `npm run verify` counts
  inline `style={` (A6) and raw hex outside `src/styles` (A7); neither may rise. Every button
  needs text or an `aria-label`, every dialog a label (`scripts/a11y_check.py`).
- No browser in this repo: check a change by compiling the real theme and server-rendering the
  components with edge-case data (see DESIGN-SYSTEM.md).
- Never call a console from the browser, never compute `effective`, `source` or what is
  editable in the browser, and never offer a switch direction the item does not allow.

## 6. Where the rules live

The page gates run in `page-gates.ts`, for both the rows and the save. The console rules run
twice: in cf-admin (`rules.ts`) to mark rows and refuse early, and in the console (cf-vps or
cf-backup, trusted target header `x-vps-target` or `x-backup-target`), which decides. The
header names the person by email, this portal's role and (since 2026-10-16, #35) their account
id; the console binds the grant it saves to that id, and shows a grant bound to an earlier
account with the same email as no grant at all. Every
page change writes a `grant_access`, `revoke_access` or `reset_access` row (module `plac`);
every console save writes one row under the console's module; all rows of one save share a
correlation id.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-16 | **Scope-limited to §6's target header (#35).** `consoleTarget` in `profile.ts` and its callers (`handlers.ts`, `role-preview.ts`); `grantFor` and the person route in cf-backup and cf-vps; `test/access-center-api.test.ts`, `access-center-profile.test.ts` and `role-preview.test.ts` pass | The screen itself: nothing on it changed |
| 2026-10-16 | **Scope-limited to templates (#32).** The TL;DR, §1's rows, §2 step 2's *Templates* paragraph and the new §3.3 against `TemplatesDialog.tsx`, `AccessChrome.tsx` (`onTemplates`), `UserAccessEditor.tsx`, `draft.ts` (`templateItems`, `applyTemplate`), `limits.ts`, `templates.ts` and the route; `test/access-templates.test.ts` and `test/access-center-draft.test.ts` pass; every live `admin_pages.path` (117) matches the entry pattern, read through the D1 connector; the read's CPU measured with a 20-template, 200-item row | The dialog in a phone browser (the owner's test); it was not server-rendered |
| 2026-10-16 | **Scope-limited to permissions given for a while (#22).** §2.1's line and new paragraph, §3.1's `grant` and `temporaryUntil` rows and §3.2's `temporary` sentence against `types.ts`, `temporary.ts`, `rules.ts` (`vpsSource`, `vpsOverride`, `activeGrant`, `changedCapabilities`, `vpsChangeRefusal`, `grantIssues`), `profile.ts`, `draft.ts` (`consoleGrant`), `handlers.ts` (`toGrantInput`), `labels.ts` and `AccessSections.tsx`; `test/access-console-requests.test.ts` and the Access Center suites pass | The editor in a phone browser (the owner's test) |
| 2026-10-16 | §4's See it as paragraph (#26) against `SeeAsPanel.tsx`, `RegistryConsole.tsx`, `src/lib/access-center/see-as.ts` and `src/lib/auth/nav-pages.ts`; `test/see-as.test.ts` passes; the live registry's sub-pages and their sidebar pages read through the D1 connector (every sub-page's sidebar page is switched on today, so "Only by address" is empty) | The tab in a phone browser (the owner's test) |
| 2026-10-16 | §4's console warning (#28) against `ConsoleFeatures.tsx`, `RegistryConsole.tsx`, `logic.ts` (`consoleGap`), `registry.ts` (`viewKey`), `vps.ts` and `backup.ts` (`viewCapability`); `test/registry-ui-logic.test.ts` passes; the two console pages' default roles read live through the D1 connector | The warning in a phone browser; it shows only when a console page's role is lowered |
| 2026-10-16 | §2.1's floor state and §4's floor paragraph (AC-9) against `pages.ts` (`pageItem`), `rules.ts` (`pageEditability`), `overview.ts` (`personOpens`, `roleOpensPage`, `switchFlags`, `changeRefusal`), `labels.ts`, `AccessRow.tsx` and the registry panels; `test/access-why.test.ts` and the AC-9 case in `test/access-center-api.test.ts` pass | The rest of the page; the screens in a phone browser (the owner's test) |
| 2026-10-15 | §2 steps 4 and 6, the default end of item #23, against `draft.ts` (`withDefaultEnd`, `defaultPageUntil`), `limits.ts`, `UserAccessEditor.tsx`, `AccessSections.tsx`, `AccessReviewDialog.tsx`, `PageSheet.tsx`; `test/access-center-draft.test.ts` | Everything else |
| 2026-10-15 | §4's Consoles paragraph after Page Registry became vendor support only: `canUsePageRegistry` and the `gate()` in `src/lib/access-center/registry.ts`; `test/registry-console-features.test.ts` | Everything else |
| 2026-10-14 | §1 to §4 against the code after the 2026-10-14 work: `UserAccessEditor.tsx`, `AccessChrome.tsx`, `AccessRow.tsx`, `AccessReviewDialog.tsx`, `AccessHistoryList.tsx`, `CopyAccessDialog.tsx`, `labels.ts`, `draft.ts` (`toSave`, `copyFrom`), `handlers.ts` (`pageEndIssues`), `history.ts` and the registry under `src/components/admin/debug/registry/`; the live `admin_page_overrides.expires_at` column and the `0070` ledger row through the D1 connector; the screens server-rendered with edge-case data; `test/access-center-end-dates.test.ts`, `test/access-history.test.ts`, `test/registry-ui-logic.test.ts` | §5 and §6 re-read, not re-derived; the screens in a phone browser (the owner's test) |
