---
title: "Access Center (the per-person access editor)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-14
verified_against: [code]
owner: harshil
related_code: [src/components/admin/users/access-editor/, src/lib/access-center/, src/pages/api/users/access-center.ts, src/pages/api/users/access-history.ts, src/pages/dashboard/users/[id]/access.astro, src/styles/components/access-editor.css, src/components/admin/debug/ConsoleFeatures.tsx, src/components/admin/debug/registry/, src/pages/api/system/console-features.ts, test/access-center-end-dates.test.ts, test/access-history.test.ts, test/registry-ui-logic.test.ts, test/access-center-rules.test.ts, test/access-center-draft.test.ts, test/access-center-profile.test.ts, test/access-center-api.test.ts, test/access-page-gates.test.ts]
related_docs: [../specs/2026-10-14-access-control-room.md, ../specs/2026-10-03-access-center-v2-design.md, ../specs/2026-10-02-access-center-design.md, ../architecture/PERMISSIONS-SYSTEM.md, VPS-CONSOLE.md, BACKUP-CONSOLE.md, USER-MANAGEMENT.md, ../reference/DESIGN-SYSTEM.md]
tags: [permissions, access-center, plac, vps, backup, registry, ui]
---

# Access Center

> **TL;DR (non-technical):** A person's Access page is one editor. It lists every portal
> page and page action, every server-console permission and every backup-console
> permission, each with the role that gets it by default and whether this person has it
> and why. Anything you are allowed to change has a switch. Switches only change a draft;
> you review the changes and save them together, with an optional end date for page
> changes. A History tab shows every access change made to the person, and *Copy access
> from…* fills the draft from someone else's access. Page Registry
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
| Components | `src/components/admin/users/access-editor/`: `UserAccessEditor` (load, draft, save, the Access and History tabs), `AccessChrome` (summary pills, toolbar, save bar), `AccessSections` (category and console cards), `AccessRow`, `AccessReviewDialog`, `AccessHistoryList` (the history, shared with Page Registry), `CopyAccessDialog`, `labels.ts` (every word the rows use) |
| Styles | `src/styles/components/access-editor.css`, imported by `global.css`; colours from `data-category` and `data-class` |
| Data | `GET /api/users/access-center?userId=<id>` on load; `POST /api/users/access-center` to save; `GET /api/users/access-history?userId=<id>&before=<cursor>` for the History tab |
| Server | `src/lib/access-center/`: `page-gates.ts` and `rules.ts` (who may change what), `pages.ts` and `profile.ts` (the profile), `handlers.ts` (the two verbs), `history.ts` (the history), `console-client.ts` and `consoles.ts` (the console calls), `draft.ts` (the browser's draft and the copy, pure) |
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
3. **Category cards**, one per registry category in registry order, coloured as in the
   registry. A page's `#` actions sit under it with a tree line and a *Feature* tag. A
   feature whose page is off says it has no effect until the page is on.
4. **Console cards**, *Server console* then *Backup console*, each headed by the console's own
   page row (*Console page*), then its permissions by class, then **Personal grant** (end date
   and note, which apply to everything granted there). Floors a role can never hold are one
   collapsed line, not disabled rows. A console that is hidden from the viewer or does not
   answer still shows its page row, with the reason and *Retry*.
5. **Save bar** (sticky): pages open, personal overrides; with unsaved changes, their count,
   *Discard* and *Review N changes*.
6. **Review dialog**: every change *was → will be*, by section; grant end date and note
   changes; with page changes, *Page changes end on* (a day from today to 366 days ahead, or
   *No end*), which ends every page grant and revoke in the save; warnings; an optional reason
   for the activity log; *Apply*.

### 2.1 A row

| Part | Meaning |
|---|---|
| Default-role badge | The lowest role that has it by default (that role and every role above). *Custom* with role dots: a console default that is not a ladder. *Owner & Vendor*: a floor. *Unrecognised*: a page whose stored role this portal cannot read (nobody below Owner is let in) |
| State | *From role*, *Not in role*, *Granted* and *Revoked* (each with its end date), *Ended* (a setting whose end date has passed: the role decides again), *Full access* (Owner and Vendor support open every page), *Owner & Vendor only* (floor) |
| The line under it | For a stored setting: who set it, when, why and until when, or when it ended (`overrideMeta` in `labels.ts`) |
| Reset / Undo | Reset removes a stored override; Undo drops an unsaved change |
| Switch | Whether the person will have it. Disabled with a tooltip when the viewer may not make that change |
| *Unsaved* tag and amber edge | The row differs from what is stored |

A switch sets the smallest override: off for what the role gives is a deny, on for what it
does not give is a grant, and back to the role's answer removes the override. A viewer may
be able to take something away but not give it (above their clearance), or give but not
take; the switch is disabled in the direction they cannot go.

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
| `system.rev`, `grant`, `grantExpired`, `canManage`, `canDelegate` | Console: the policy revision, the person's grant, and what the viewer holds there |
| `item.kind` | `page`, `feature` (`parent` is its page) or `capability` |
| `item.requiredRole`, `customRoles` | The default role, or the roles of a custom console default |
| `item.baseline` | Whether the role gives it, before any override |
| `item.override` | `grant`, `deny` or `null`, as it applies now (an ended console allow is `null`; a deny still applies) |
| `item.effective`, `source` | On or off now, and why (`role`, `grant`, `deny`, `expired`, `top-tier`, `locked`, `none`) |
| `item.editable`, `canAllow`, `canDeny`, `whyNot` | What the viewer may change, and why not (`self`, `outranked`, `top-tier-target`, `full-access`, `read-only`, `not-held`, `above-clearance`, `locked`, `no-delegate`) |
| `item.overrideBy`, `overrideAt`, `overrideReason`, `expiresAt` | Who set a page override, when and why; when a page override or a console grant ends (`source: expired` once it has) |

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
lists, removes it. The person and their role are read from the database by `userId`;
anything else in the body is ignored. The browser builds this with `toSave` in `draft.ts`.

| Status | Meaning |
|---|---|
| 200 | `data` is `{ profile, results }`: the fresh profile and `{ ok, changes }` or `{ ok: false, code, message, need?, issues? }` per system sent. A console can still refuse here (a stale revision): only that system's changes stay in the draft |
| 400 | Malformed, nothing to save, an unknown or repeated page, an unknown capability, an end date (page or console) in the past or over 366 days, an end date on a reset, a long note. Nothing was saved |
| 403 | A rule refused (`need`, and `system` for the part). Nothing was saved |
| 404 | No such person, or a hidden account the viewer may not see |
| 429 | More than 5 access saves a minute (one save counts once) |
| 502 | A console that had to be asked did not answer. Nothing was saved |

## 4. Page Registry and its Consoles tab

Page Registry (`/dashboard/debug/pages`) is the control room for everyone's access: tiles, then
six tabs (Pages, Who opens what, Personal settings, Consoles, Checks, History). The tabs, the
page pop-up and who may do what are in
[the control-room spec](../specs/2026-10-14-access-control-room.md) §4 and §6; the routes are
in [`DEV-TOOLS.md`](../operations/DEV-TOOLS.md) §2. Personal settings made there go through the
same page gates as this screen (`page-gates.ts`) and appear in the person's History tab.

The **Consoles** tab shows one block per console (Server, then Backup) with one row per
capability: label, key, class, default role and the live personal grants that mention it, and a
*Change* button. Change opens a dialog: pick the new default from a row of chips ("Manager and
above"), see who gains and who loses it among active people, give a reason, apply. Floors are
locked. The save goes to the console's `POST access/role`, which keeps every personal grant,
and writes one activity-log row under the console's module. Since 2026-10-10 the rows are for
anyone holding the Page Registry key, not vendor support alone; below vendor support a
permission moves only when it starts at the editor's own role or below and stays there, and
the console still checks the person's own `access.manage`
([`DEV-TOOLS.md`](../operations/DEV-TOOLS.md) §2.2).

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
cf-backup, trusted target header `x-vps-target` or `x-backup-target`), which decides. Every
page change writes a `grant_access`, `revoke_access` or `reset_access` row (module `plac`);
every console save writes one row under the console's module; all rows of one save share a
correlation id.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-14 | §1 to §4 against the code after the 2026-10-14 work: `UserAccessEditor.tsx`, `AccessChrome.tsx`, `AccessRow.tsx`, `AccessReviewDialog.tsx`, `AccessHistoryList.tsx`, `CopyAccessDialog.tsx`, `labels.ts`, `draft.ts` (`toSave`, `copyFrom`), `handlers.ts` (`pageEndIssues`), `history.ts` and the registry under `src/components/admin/debug/registry/`; the live `admin_page_overrides.expires_at` column and the `0070` ledger row through the D1 connector; the screens server-rendered with edge-case data; `test/access-center-end-dates.test.ts`, `test/access-history.test.ts`, `test/registry-ui-logic.test.ts` | §5 and §6 re-read, not re-derived; the screens in a phone browser (the owner's test) |
