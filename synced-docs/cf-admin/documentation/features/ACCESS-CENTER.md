---
title: "Access Center (the panel, for the design pass)"
status: active
audience: [ai, technical, operator]
last_verified: 2026-10-02
verified_against: [code]
owner: harshil
related_code: [src/components/admin/users/AccessCenterPanel.tsx, src/lib/access-center/, src/pages/api/users/access-center.ts, src/pages/dashboard/users/[id]/access.astro, src/lib/vps-proxy.ts, test/access-center-rules.test.ts, test/access-center-profile.test.ts, test/access-center-api.test.ts]
related_docs: [../specs/2026-10-02-access-center-design.md, ../architecture/PERMISSIONS-SYSTEM.md, VPS-CONSOLE.md, USER-MANAGEMENT.md, ../reference/DESIGN-SYSTEM.md]
tags: [permissions, access-center, vps, design-handoff, ui]
---

# Access Center

> **TL;DR (non-technical):** A person's Access page now opens with one panel that
> lists everything they can open and do: every page and action in the portal,
> and every capability in the server console, each with the reason it is on or
> off. Server-console access can be changed right there, by anyone above that
> person who holds the capability themselves. Page access is still changed in
> the page editor below it. Every change is checked again by the system it
> belongs to.

This document is written for whoever restyles the panel (Antigravity). The panel
works and is deliberately plain: semantic HTML, a few layout classes, and stable
`data-ac-*` attributes to style against. The design is yours; the data, the API
calls and the rules are not, and section 6 lists exactly what must stay.

The design behind it, and why, is
[the Access Center spec](../specs/2026-10-02-access-center-design.md).

## 1. What the panel is

| | |
|---|---|
| Where | The top of `/dashboard/users/[id]/access` (a person's Access page), above the page editor |
| Component | `src/components/admin/users/AccessCenterPanel.tsx`, a Preact island loaded with `client:load` |
| Data | `GET /api/users/access-center?userId=<id>` once on load; `POST /api/users/access-center` to save |
| Server code | `src/lib/access-center/` (rules, the cf-vps client, the profile builder, the handlers) |
| Replaced | The old "Server console" section of the same page (removed 2026-10-02) |
| Unchanged | `AccessPolicyManager`, the page editor below it, which still makes every page change through `POST /api/users/access` |

It shows one section per **system**, three since stage 2 (2026-10-03):

1. **Portal pages and actions** (`pages`): read only here, grouped (General, Bookings and
   inquiries, Content, Emails, Chatbot, People, sessions and logs, Privacy and retention,
   Staff storage, Settings and system, Other pages). Email action keys such as
   `/dashboard/emails#compose` sit under Emails.
2. **Server console** (`vps`): every cf-vps capability, grouped Look / Operate / Administer,
   and an editor for this person's personal grant.
3. **Backup console** (`backup`): every cf-backup capability, grouped Look / Operate /
   Delete and download data / Backup keys / Administer, with the same editor. It is `hidden`
   (`need: console`) for a viewer who cannot open `/dashboard/backup`.

Both consoles serve the same contract, so one editor (`ConsoleEditor`) serves every system
whose `editVia` is `access-center`; a console added later appears the same way.

## 2. The data the panel receives

Every answer is either `{ "ok": true, "data": … }` or
`{ "ok": false, "error": { "code", "message", "need"?, "issues"? } }`, and is never cached.
The shapes are TypeScript types in `src/lib/access-center/types.ts`; import them, do not
copy them.

### 2.1 GET: the profile

```json
{
  "ok": true,
  "data": {
    "person": { "id": "…", "email": "…", "name": "…", "role": "manager", "roleLabel": "Manager" },
    "viewer": { "role": "admin", "canEditPerson": true },
    "systems": [
      {
        "id": "pages", "label": "Portal pages and actions", "status": "ok", "editVia": "page-editor",
        "groups": [
          { "id": "emails", "label": "Emails", "items": [
            { "key": "/dashboard/emails#compose", "label": "Send Emails", "kind": "action", "requiredRole": "manager",
              "effective": true, "source": "role", "editable": false, "whyNot": "page-editor" }
          ] }
        ]
      },
      {
        "id": "vps", "label": "Server console", "status": "ok", "editVia": "access-center",
        "rev": 7, "grantExpired": false, "canManage": false, "canDelegate": true,
        "grant": { "allow": ["host.view"], "deny": [], "expiresAt": "…", "note": "…", "grantedBy": "…", "grantedAt": "…" },
        "groups": [
          { "id": "read", "label": "Look", "items": [
            { "key": "host.view", "label": "Host", "description": "…", "effective": true, "source": "grant",
              "editable": true, "canAllow": true, "canDeny": true, "expiresAt": "…" },
            { "key": "audit.view", "label": "Audit timeline", "description": "…", "effective": false, "source": "locked",
              "editable": false, "canAllow": false, "canDeny": false, "whyNot": "locked" }
          ] }
        ]
      }
    ]
  }
}
```

| Field | Meaning |
|---|---|
| `person.role` | The person's role from the portal's own database (`null` when the stored value does not translate) |
| `viewer.canEditPerson` | Whether the viewer may change this person at all: they must strictly outrank them and not be them. When false, `viewer.whyNot` says why (`self` or `outranked`) |
| `system.status` | `ok`, `unavailable` (the system did not answer; `message` says why) or `hidden` (the viewer may not see it; `message` says why, `need` names the rule when there is one) |
| `system.editVia` | `page-editor` (change it in the page editor below) or `access-center` (change it here) |
| `system.rev`, `system.grant` | Console only: the policy revision and this person's stored grant (`null` for none). A save sends `rev` back |
| `system.grantExpired` | Console only: the grant's end date has passed |
| `system.canManage`, `system.canDelegate` | Console only: whether the viewer holds Manage access or Delegate access there |
| `item.key` | The permission key: a page path or action key for pages, a capability id for the console |
| `item.effective` | On or off, right now, for this person |
| `item.source` | Why (section 3) |
| `item.editable` | Whether the viewer may change it here. When false, `whyNot` says why (section 3) |
| `item.canAllow`, `item.canDeny` | Console only: which personal choices the viewer may set. "Follow the role" is always available when the item is editable |
| `item.expiresAt` | Console only, on a `grant` or `expired` item: the grant's end |
| `item.kind`, `item.requiredRole` | Pages only: `page` or `action`, and the role the registry gives it to |

### 2.2 POST: one console change

```json
{ "userId": "…", "system": "vps", "rev": 7,
  "grant": { "allow": ["host.view", "logs.view"], "deny": [], "expiresAt": "2026-12-31T23:59:59.000Z", "note": "on call in December" } }
```

The whole grant is sent, not a difference. `grant: null`, or a grant whose two lists are
empty, removes the person's grant so their role decides. Anything else in the body is
ignored: the person, and their role, are read from the database by `userId`.

| Status | `error.code` | Meaning, and what the panel does |
|---|---|---|
| 200 | | Saved. `data` is the person's new console system, plus `saved: { rev, changes }` (the console's own list of what changed). The panel swaps the system in and shows a toast |
| 400 | `bad_request` | Malformed, an unknown capability, an end date in the past or more than 366 days ahead, a note over 200 characters. `issues` lists them |
| 403 | `forbidden` | A rule refused. `need` names it: `self`, `outranked`, `access.delegate`, `access.manage`, `not-held:<capability>`, `locked:<capability>`, `trusted_target`, `console`, `read_only` |
| 404 | `not_found` | No such person, or a hidden account the viewer may not see |
| 409 | `conflict` | Someone saved first. The panel reloads the profile; the viewer makes the change again |
| 429 | `rate_limited` | More than 5 access changes in a minute (shared with the page editor) |
| 502 | `unavailable` | The console did not answer, or is not connected |

`error.message` is always a finished sentence for a person to read. Show it as it is.

## 3. Every state, and what it means

### 3.1 The panel

| `data-ac-state` on the panel | Meaning |
|---|---|
| `loading` | The profile has not arrived yet |
| `error` | The profile could not be loaded; a retry button is shown |
| `ready` | The profile is shown |

### 3.2 Sources

| `source` | Shown as | Meaning |
|---|---|---|
| `role` | From role | On because of the person's role |
| `grant` | Granted (until a date) | On because of a personal grant, which may end |
| `deny` | Denied | Off because of a personal deny, which beats the role. A deny in a console grant that has ended still applies until the grant is replaced |
| `expired` | Grant ended | Console only: a personal allow whose end date has passed. The role decides again, so `effective` may be either |
| `top-tier` | Owner and Vendor support open every page | Pages only: owner and vendor support pass every page check, whatever is stored |
| `locked` | Owner and Vendor support only | Console only: a floor capability, which only those two roles can ever hold |
| `none` | Not in role | Off: the role does not give it and there is no grant |

`effective` is the truth; `source` is the explanation. Never compute either in the browser.

### 3.3 Why an item cannot be changed

| `whyNot` | Meaning |
|---|---|
| `page-editor` | A page item: change it in the page editor below (every page item in stage 1) |
| `locked` | A floor capability; nobody can hand it out |
| `not-held` | The viewer does not hold it themselves, so they cannot give it or take it away |
| `outranked` | The person is at or above the viewer's level |
| `self` | It is the viewer's own access |
| `no-delegate` | The viewer holds neither Manage access nor Delegate access in the console |

### 3.4 The console editor

| What | When |
|---|---|
| Choice per editable item: Role / Allow / Deny | Allow only when `canAllow`, Deny only when `canDeny` |
| End date and reason fields, "Follow role only", Save | Only when at least one item is editable |
| "Follow role only" | Clears the items the viewer may change; anything they may not change stays as stored |
| Save | Enabled only when the draft differs from the stored grant |
| Note `grant-expired` | The person's grant has ended; saving replaces it |
| Note `read-only` | The viewer may see this person's console access but not change it |
| Message `conflict`, `forbidden`, `bad-request`, `error` | The last save's refusal, with the server's sentence |

A system whose `status` is not `ok` shows only its `message`, under `data-ac-message`
equal to the status.

## 4. Styling hooks

Style against these attributes; they are stable and the tests and the next stages rely
on them. The Tailwind classes in the component are placeholders and can all change.

| Attribute | On | Values |
|---|---|---|
| `data-ac-panel` | the whole panel (`section`) | |
| `data-ac-state` | the panel | `loading`, `error`, `ready` |
| `data-ac-header` | the panel heading block | |
| `data-ac-system` | each system (`section`) | `pages`, `vps`, `backup` |
| `data-ac-status` | each system | `ok`, `unavailable`, `hidden` |
| `data-ac-need` | each system, when hidden by a named rule | the rule, e.g. `console`, `outranked` |
| `data-ac-group` | each group (`details` for pages, `div` for the console) | the group id, e.g. `emails`, `read` |
| `data-ac-count` | a page group's "on" count | |
| `data-ac-items` | each list of items (`ul`) | |
| `data-ac-item` | each item (`li`) | the permission key |
| `data-ac-source` | each item | section 3.2 |
| `data-ac-effective` | each item | `true`, `false` |
| `data-ac-editable` | each item | `true`, `false` |
| `data-ac-why-not` | each item that cannot be changed | section 3.3 |
| `data-ac-kind` | each page item | `page`, `action` |
| `data-ac-choice` | each editable console item | the draft's choice: `inherit`, `allow`, `deny` |
| `data-ac-label`, `data-ac-key`, `data-ac-description` | the parts of an item | |
| `data-ac-state` (on a `span`) | the On / Off text | `on`, `off` |
| `data-ac-source-text`, `data-ac-why-not-text` | the explaining texts | |
| `data-ac-control` | controls | `choice` (the `fieldset`), `expires`, `note`, `reset`, `save`, `retry` |
| `data-ac-choice-option` | each radio's `label` | `inherit`, `allow`, `deny` |
| `data-ac-editor` | the console editor (`form`) | |
| `data-ac-grant-fields` | the end date, reason and buttons row | |
| `data-ac-note` | explanatory notes | `page-editor`, `grant-expired`, `read-only`, `granted-by` |
| `data-ac-message` | status and refusal messages | `loading`, `load-error`, `unavailable`, `hidden`, `conflict`, `forbidden`, `bad-request`, `error` |
| `data-ac-link` | links | `vps-console`, `backup-console` |

## 5. Working on it

- When a console does not answer (for example a local run with no console behind its
  binding), its system is `unavailable`. The other states are pinned with fixed answers in
  `test/access-center-profile.test.ts` and `test/access-center-api.test.ts`; those shapes
  are what the screen gets.
- Icons come from `lucide-preact` only. No new dependencies (`RULESAd.md` §7.3).
- A modal or dialog must follow `RULESAd.md` §7.8 (`showModal()`, a label, inline sizing).
- `npm run verify` counts inline `style={` attributes and raw six-digit hex colours
  (ratchet A6 and A7, which may not rise) and runs the accessibility rules
  (`scripts/a11y_check.py`): every button needs text or an `aria-label`, every link needs
  text, no positive `tabIndex`. Use the design tokens.
- Keep every control a real form control (radio, date, text, button) inside a `label` or a
  `fieldset` with a `legend`; the panel is keyboard-usable today and must stay so.

## 6. What must not change

1. **The API calls.** `GET /api/users/access-center?userId=<id>` on load and
   `POST /api/users/access-center` with `{ userId, system, rev, grant }`, the whole grant,
   `rev` taken from the system as received, and `system` its `id` (`vps` or `backup`). No
   other endpoint, and never a console directly.
2. **The keys.** `item.key` values are permission keys in other systems; show them, never
   rewrite them. The draft is built from `system.grant` (`src/lib/access-center/draft.ts`),
   and an end date is saved as that whole day in UTC (`T23:59:59.000Z`).
3. **The rules.** Whether an item is on, why, and whether it can be changed all come from the
   server. Do not offer a choice the item does not allow (`editable`, `canAllow`, `canDeny`),
   and do not infer one from the role. The server and cf-vps refuse anything else anyway; the
   screen must not invite it.
4. **The refusal handling.** Show `error.message` as given; on `conflict`, reload the profile.
5. **The page editor stays separate** in stage 1: page items are read only here, with
   `whyNot: page-editor`.
6. **The `data-ac-*` attributes** in section 4, by name and value.

## 7. Where the rules live

The same rules run twice: in cf-admin (`src/lib/access-center/rules.ts`) to mark items and
refuse early, and in the console (cf-vps or cf-backup, each with its own target header,
`x-vps-target` or `x-backup-target`), which decides. Each console is one entry in
`src/lib/access-center/consoles.ts`; the calls are `console-client.ts`. cf-admin also applies its own account rule first:
nobody changes a person they do not strictly outrank, or themselves, here. The full rule set
(T1–T5, floors, delegation) is in section 4 of
[the spec](../specs/2026-10-02-access-center-design.md), and how the portal's own page
permissions work is in [PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md).

Every console save made here writes one activity-log row, marked as made through the Access
Center, and as delegated when it was.
