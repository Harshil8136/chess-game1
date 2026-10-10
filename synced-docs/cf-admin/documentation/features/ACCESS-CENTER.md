---
title: "Access Center (the per-person access editor)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-03
verified_against: [code]
owner: harshil
related_code: [src/components/admin/users/access-editor/, src/lib/access-center/, src/pages/api/users/access-center.ts, src/pages/dashboard/users/[id]/access.astro, src/styles/components/access-editor.css, src/components/admin/debug/ConsoleFeatures.tsx, src/pages/api/system/console-features.ts, test/access-center-rules.test.ts, test/access-center-draft.test.ts, test/access-center-profile.test.ts, test/access-center-api.test.ts, test/access-page-gates.test.ts]
related_docs: [../specs/2026-10-03-access-center-v2-design.md, ../specs/2026-10-02-access-center-design.md, ../architecture/PERMISSIONS-SYSTEM.md, VPS-CONSOLE.md, BACKUP-CONSOLE.md, USER-MANAGEMENT.md, ../reference/DESIGN-SYSTEM.md]
tags: [permissions, access-center, plac, vps, backup, registry, ui]
---

# Access Center

> **TL;DR (non-technical):** A person's Access page is one editor. It lists every portal
> page and page action, every server-console permission and every backup-console
> permission, each with the role that gets it by default and whether this person has it
> and why. Anything you are allowed to change has a switch. Switches only change a draft;
> you review the changes and save them together. The page registry
> (`/dashboard/debug/pages`) also lists the consoles' permissions, so vendor support, or
> someone granted Page Registry, can change which role each one starts at (the latter only
> within their own role).

The design, and the reasons for it, are in
[the v2 spec](../specs/2026-10-03-access-center-v2-design.md); the console rules (T1–T5,
floors, delegation) are in [the v1 spec](../specs/2026-10-02-access-center-design.md) §4.

## 1. Where things are

| | |
|---|---|
| Screen | `/dashboard/users/[id]/access`: the header (name, email, role badge), then the `UserAccessEditor` island |
| Components | `src/components/admin/users/access-editor/`: `UserAccessEditor` (load, draft, save), `AccessChrome` (summary pills, toolbar, save bar), `AccessSections` (category and console cards), `AccessRow`, `AccessReviewDialog`, `labels.ts` (every word the rows use) |
| Styles | `src/styles/components/access-editor.css`, imported by `global.css`; colours from `data-category` and `data-class` |
| Data | `GET /api/users/access-center?userId=<id>` on load; `POST /api/users/access-center` to save |
| Server | `src/lib/access-center/`: `page-gates.ts` and `rules.ts` (who may change what), `pages.ts` and `profile.ts` (the profile), `handlers.ts` (the two verbs), `console-client.ts` and `consoles.ts` (the console calls), `draft.ts` (the browser's draft, pure) |
| Registry | `src/components/admin/debug/ConsoleFeatures.tsx` and `GET/POST/PATCH /api/system/console-features` (`src/lib/access-center/registry.ts`) |

## 2. The screen

From top to bottom:

1. **Summary pills**: pages open, personal overrides, each console's permissions held, and
   unsaved changes. A notice follows when the viewer may look but not change (their own
   account, someone at or above their role, a read-only account).
2. **Toolbar**: search; *Show* (everything, different from the role, has access, no access,
   I can change, unsaved changes); *Section*; *Resend invite*; *Reset all to role*, which marks
   every override the viewer may remove (nothing is saved until review).
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
   changes; warnings; an optional reason for the activity log; *Apply*.

### 2.1 A row

| Part | Meaning |
|---|---|
| Default-role badge | The lowest role that has it by default (that role and every role above). *Custom* with role dots: a console default that is not a ladder. *Owner & Vendor*: a floor. *Unrecognised*: a page whose stored role this portal cannot read (nobody below Owner is let in) |
| State | *From role*, *Not in role*, *Granted* (with its end date), *Revoked*, *Grant ended*, *Full access* (Owner and Vendor support open every page), *Owner & Vendor only* (floor) |
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
| `item.overrideBy`, `overrideReason`, `expiresAt` | Who set a page override and why; a console grant's end |

### 3.2 POST: one save

```json
{ "userId": "…", "reason": "covering the front desk",
  "pages": [{ "path": "/dashboard/emails#compose", "action": "grant" }],
  "vps": { "rev": 7, "grant": { "allow": ["host.view"], "deny": [], "expiresAt": "2026-12-31T23:59:59.000Z", "note": "on call" } },
  "backup": { "rev": 4, "grant": null } }
```

`action` is `grant`, `revoke` or `reset`. A console's grant is sent whole; `null`, or empty
lists, removes it. The person and their role are read from the database by `userId`;
anything else in the body is ignored. The browser builds this with `toSave` in `draft.ts`.

| Status | Meaning |
|---|---|
| 200 | `data` is `{ profile, results }`: the fresh profile and `{ ok, changes }` or `{ ok: false, code, message, need?, issues? }` per system sent. A console can still refuse here (a stale revision): only that system's changes stay in the draft |
| 400 | Malformed, nothing to save, an unknown or repeated page, an unknown capability, an end date in the past or over 366 days, a long note. Nothing was saved |
| 403 | A rule refused (`need`, and `system` for the part). Nothing was saved |
| 404 | No such person, or a hidden account the viewer may not see |
| 429 | More than 5 access saves a minute (one save counts once) |
| 502 | A console that had to be asked did not answer. Nothing was saved |

## 4. The registry's console rows

Under `/dashboard/vps` and `/dashboard/backup` in `/dashboard/debug/pages`, a *Console* header
row and one row per capability: key, label, class, default role, live personal grants that
mention it, and an edit button. Edit opens a dialog: pick the new default ("Manager and
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
