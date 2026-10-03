---
title: "Access Center v2: one editor per person, and console features in the page registry"
status: active
audience: [owner, technical, ai, operator]
last_verified: 2026-10-03
verified_against: [code, infra]
owner: harshil
related_code: [src/components/admin/users/access-editor/, src/lib/access-center/, src/pages/api/users/access-center.ts, src/pages/api/system/console-features.ts, src/components/admin/debug/PageRegistryManager.tsx, src/components/admin/debug/ConsoleFeatures.tsx, src/styles/components/access-editor.css]
related_docs: [2026-10-02-access-center-design.md, ../features/ACCESS-CENTER.md, ../architecture/PERMISSIONS-SYSTEM.md, ../reference/DESIGN-SYSTEM.md]
tags: [permissions, access-center, plac, acm, registry, design]
---

# Access Center v2: one editor per person, and console features in the page registry

> **TL;DR (non-technical):** The first Access Center sat beside the old page editor, looked
> unlike the rest of the portal, and let you change only server-console permissions. v2 is
> one editor per person, in the portal's own style. Every page, email action, server-console
> and backup-console permission is listed with its required role and its state, and anything
> you are allowed to change is changed in the same place. Changes are collected, reviewed, and
> saved together. The page registry also lists the consoles' permissions, so their default
> roles are managed beside the pages they belong to.

## 1. What the owner found wrong with v1 (2026-10-03)

1. Not everything was editable: page access was read-only in the panel, and edited in a
   second, separate editor below it.
2. It was not in the portal's design: unstyled radio buttons and plain text, no colour, no
   structure, no use of the role badges, category colours or row layout the rest of the portal
   uses.
3. `/dashboard/debug/pages` (the access control map) had no console features, so their default
   roles could not be managed there.

Found while redesigning, fixed with it:

- The registry hid rows whose category is not in its list (the four `/dashboard/retention#…`
  features, category `admin`), and nested a feature under its page only when both shared a
  category, so `/dashboard/privacy#delete` and its siblings appeared detached from their page.
- The old editor grouped pages by its own path rules, not the registry's categories, so the two
  screens disagreed about where a page belongs.
- Every access change shares one limit of 5 a minute, so the old one-request-per-toggle editor
  failed after the fifth quick toggle.
- `POST /api/system/preview` compared stored role names (`super_admin`, `dev`) with canonical
  levels, so its counts of who gains or loses access were wrong. `registry-impact.ts` already
  translates them; the preview now uses it.

## 2. The per-person editor (`/dashboard/users/<id>/access`)

One island, `UserAccessEditor`, replaces `AccessCenterPanel` and `AccessPolicyManager`. It follows
the existing editor's anatomy: a toolbar, section cards, one row per permission, and a sticky
footer.

| Part | Content |
|---|---|
| Summary | Stat pills, as in the registry: pages open, personal overrides, each console's permissions held, and unsaved changes |
| Toolbar | Search (label, key or description); Show (everything, different from the role, has access, no access, I can change, unsaved changes); Section; Resend invite; Reset all to role (marks every override the viewer may remove, for review) |
| Sections | One card per registry category in registry order (Main, Content, Communication, Tools and storage, Management, System, Administration, then any other category), coloured with the category's section colour, then **Server console** (violet) and **Backup console** (cyan). Cards collapse from their header |
| Rows | Icon tile, label, the key in mono and the description; the default-role badge; the state; Reset (or Undo for an unsaved change); the switch |
| Features | A page's `#` actions sit under it with the registry's tree line and a "Feature" tag, whatever category they are stored under |
| Console card | Headed by the console's own page row ("Console page"), then its permissions by class (Look, Operate, …), then **Personal grant**: the grant's end date and note, which apply to everything granted there. A warning shows when the person cannot open the console page |
| Save bar | Sticky: pages open and personal overrides; with unsaved changes, their count, Discard and Review |
| Review | A native `<dialog>`: every change was → will be by section, the grant's end date and note when they change, warnings (closing a page with features still on; a grant with no end date), an optional reason, and after a partial save what each system answered |

**Row state** (the second column a person reads):

| State | Meaning |
|---|---|
| From role | The role gives it, no override |
| Not in role | The role does not give it, no override |
| Granted | A personal grant gives it (a console grant may show its end date) |
| Revoked | A personal deny takes it away |
| Grant ended | A console grant whose end date passed; the role decides again |
| Full access | Owner or vendor support: every page is open to them |
| Owner & Vendor only | A floor console capability; it follows those two roles and is never given to anyone else |

**Toggle semantics:** the toggle shows whether the person will have it. Turning it on or off
writes the smallest override that gets there: off for something the role gives is a deny, on for
something the role does not give is a grant, and moving back to what the role gives removes the
override. Turning it back to what is stored drops the change. Reset removes the stored override;
Undo drops an unsaved change. The default-role badge reads "Manager" for "Manager and every role
above it", **Custom** with role dots when a console's defaults are not a ladder, and **Owner &
Vendor** for a floor.

**When a row cannot change,** the toggle is disabled and the row says why in plain words: your
own account; someone at or above your role; a page you cannot open yourself; above your own
clearance (grant only, revoking stays possible); a console capability you do not hold; Owner &
Vendor only; read-only account. Floor capabilities for a role that can never hold them are
collapsed into one line per console rather than listed as disabled rows.

## 3. Saving

`POST /api/users/access-center` takes the whole draft:

```json
{ "userId": "…", "reason": "on call in December",
  "pages": [{ "path": "/dashboard/emails#compose", "action": "grant" }],
  "vps": { "rev": 7, "grant": { "allow": ["host.view"], "deny": [], "expiresAt": "2026-12-31T23:59:59.000Z" } },
  "backup": { "rev": 4, "grant": null } }
```

- Everything is checked before anything is written; a refusal names the part (`error.system`)
  and nothing is saved. Page changes go through the four page gates (`page-gates.ts`, the
  same function the editor uses to mark rows) after a change that is already stored is
  dropped. Console changes go through the console rules (v1 §4).
- Pages are written in one D1 batch, the person's sessions re-check their map once, and each
  page change writes its own activity-log row (`grant_access`, `revoke_access`, `reset_access`,
  module `plac`), as before. Then each console saves its grant and writes its row.
- One save counts once against the 5-a-minute limit, however many changes it carries.
- The answer is the new profile plus a result per section. If a console refuses after the
  pages were saved (a race, a stale revision), the dialog says which section did not save and
  keeps only those changes in the draft. If the page batch fails, no console is sent.
- `POST /api/users/access` (one page per request) is retired: the editor was its only caller,
  and the batch save applies the same gates and writes the same rows.

## 4. Console features in the registry (`/dashboard/debug/pages`)

- Each console capability appears as a feature row under its console's page (`/dashboard/vps`,
  `/dashboard/backup`), with a "Console" tag, its label and description, and its required role.
  A capability's required role is the lowest role that holds it by default. When the stored
  defaults are not a clean "this role and above" set, the row shows **Custom** and lists the
  roles.
- Editing a row sets one required role: that role and every role above it get the capability,
  and every role below loses it. The change goes to the console's new `POST access/role` route,
  which keeps every personal grant. It shows the same impact preview (who gains, who loses)
  and needs the same confirmation, with a reason, as a page change.
- Floor capabilities show **Owner & Vendor only** and cannot be edited.
- Overrides counts the live personal grants that mention the capability.
- The registry is vendor-support only, as before, and only a holder of the console's
  `access.manage` can change its defaults (owner and vendor support).
- `GET /api/system/console-features` lists every console's features (reading `access/catalog`
  and `access` from each console); `POST` previews a change (active people by role, from the
  directory); `PATCH { system, capability, minRole, rev, reason? }` saves it through the
  console's `POST access/role` (3 a minute, as page registry changes). The activity-log row is
  written under the console's module, marked as made through the page registry. A console that
  does not answer shows one row saying so, with Retry.
- Features stored under a category the registry did not list now show under their page, and
  the impact preview's counts translate stored roles.

## 5. Styling

Per DESIGN-SYSTEM.md: Tailwind for layout, theme tokens for colour, and no new inline styles
or raw hex (ratchet A6 and A7). Category colours come from `data-category` and the existing
`--color-section-*` tokens, in `src/styles/components/access-editor.css`. Role badges are the
existing `.role-badge--<role>` classes. Every control is a real button, switch or input with a
label.

## 6. What does not change

The permission model, every gate and every console rule. Hidden accounts stay invisible below
owner and vendor. The consoles keep their own Access pages; the registry and this editor call
the same console routes.
