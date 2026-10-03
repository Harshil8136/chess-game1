---
title: "Access Center: one place to see and grant every permission"
status: active
audience: [owner, technical, ai, operator]
last_verified: 2026-10-02
verified_against: [code]
owner: harshil
related_code: [src/lib/access-center/, src/pages/api/users/access-center.ts, src/components/admin/users/access-editor/, src/pages/dashboard/users/[id]/access.astro, src/lib/vps-proxy.ts]
related_docs: [../architecture/PERMISSIONS-SYSTEM.md, ../features/VPS-CONSOLE.md, ../features/BACKUP-CONSOLE.md, ../features/ACCESS-CENTER.md]
tags: [permissions, rbac, plac, acm, access-center, vps, delegation, design]
---

# Access Center: one place to see and grant every permission

> **TL;DR (non-technical):** Today a person's permissions live in three places: the portal's
> page access, the server console, and the backup console, each with its own screen and its
> own rules. The Access Center puts them on one page per person, shows *why* each permission
> is on or off, and lets managers hand out what they themselves hold to people below them,
> following the same hierarchy the portal already uses for pages. Each console still checks
> every change itself, so nothing gets weaker.

**Screen and save superseded 2026-10-03** by
[Access Center v2](2026-10-03-access-center-v2-design.md): one editor per person, one save
for every system. The decisions, the console contract and the delegation rules (§1–§5) here
still hold.

## 1. Decisions (owner, 2026-10-02)

| Question | Decision |
|---|---|
| Scope | **One Access Center** for pages, email actions, the server console (VPS) and the backup console, built in stages |
| Who may grant | **Hierarchy, like pages:** you must outrank the person, can only grant what you hold, never above your own level; the locked (floor) permissions stay owner and vendor only |
| Approach | **Federate:** each console keeps its own catalog, stored grants and enforcement; cf-admin gets one screen, one API and one rule set on top, and every change is checked again by the console |
| Visual design | Antigravity owns the look. This spec defines the data, the rules and the API the screen uses. Claude builds a plain working panel that Antigravity restyles |

Not in scope: custom roles (the 2026-09-23 "System Admin defines roles" idea), moving users
out of Supabase, approval workflows. Each can come later without changing this design.

## 2. What already exists

cf-admin already runs RBAC + PLAC + ACM for pages ([PERMISSIONS-SYSTEM](../architecture/PERMISSIONS-SYSTEM.md)):

- **ACM**: the page registry (D1 `admin_pages`), including action keys such as `/dashboard/emails#compose`. Email permissions are already part of it.
- **RBAC**: six roles, vendor support (level 0) down to viewer (5).
- **PLAC**: per-person grant or deny on a page (D1 `admin_page_overrides`).
- **Provisioning gates** on `POST /api/users/access`: the actor must outrank the target, whose role is read from the database; owner and vendor accounts cannot be changed by lower ranks; you can only grant a page you can open; nothing above your own level.

The two consoles copy that shape for what happens *inside* them, and are the odd ones out:

| Console | Catalog | Stored grants | Who may change grants today |
|---|---|---|---|
| Server (cf-vps) | 19 capabilities in `contract/capabilities.ts` | One settings row, `vps:access`: role defaults + per-person allow/deny with end date and note | Owner and vendor only (`access.manage` is a floor capability) |
| Backup (cf-backup) | Its own capability catalog | One settings row, `backup:access` | Owner and vendor only |

## 3. The model

**A permission key** is a system plus a key: `pages` + `/dashboard/emails#compose`, or `vps` +
`terminal.ops`. Displayed as `vps:terminal.ops`. Each system keeps its own decision rule; the
Access Center never re-implements one, it only shows the result and routes changes.

**Every item the Access Center shows has a source**, so the screen can say *why*:

| Source | Meaning |
|---|---|
| `role` | On because of the person's role |
| `grant` | On because of a personal grant (may carry an end date) |
| `deny` | Off because of a personal deny, which beats the role |
| `expired` | A personal grant whose end date has passed; the role decides again |
| `top-tier` | On because owner and vendor bypass page checks (pages only) |
| `locked` | A floor capability: only owner and vendor ever hold it, and it cannot be granted |
| `none` | Off: not in the role, no grant |

## 4. Who may change what (console capabilities)

The same rules run twice: in cf-admin before anything is sent, and in the console, which
decides. A console change is allowed when **either** line holds:

1. **Manage.** The actor holds the console's `access.manage` (owner and vendor). All of today's
   validations apply unchanged.
2. **Delegate.** The actor holds the console's new **`access.delegate`** (not a floor capability;
   default roles owner, vendor support and admin), and all of:
   - **T1 trusted target.** cf-admin names the person being changed, with the role it read
     from its database, in a header the gateway never forwards from a browser
     (`x-vps-target`). Missing, malformed, or not matching the person in the body: refused.
   - **T2 not yourself.**
   - **T3 outrank.** The actor's role level is strictly higher than the target's
     (vendor 0 < owner 1 < admin 2 < manager 3 < staff 4 < viewer 5). Owner and vendor targets
     can therefore only be changed by a manager of access, never by delegation.
   - **T4 hold it.** Every capability whose state changes (added to or removed from the allow
     or deny list) is one the actor holds right now.
   - **T5 not locked.** No floor capability changes.
   - The existing limits still apply: an end date at most 366 days ahead, a note of at most
     200 characters, at most 50 people with grants, compare-and-swap on the revision.

Viewing one person's console access needs `access.view`, or `access.delegate` plus T1 and T3.

Page permissions keep their existing editor and gates in stage 1 (section 9).

## 5. Pieces and data flow

| Piece | Where | Does |
|---|---|---|
| Console catalog | cf-vps `GET /api/access/catalog` | Describes every capability (label, class, floor, description), the role defaults, and what the calling actor holds and may do |
| Trusted target header | `cf-vps/src/gateway/target.ts`, cf-admin `src/lib/vps-proxy.ts` | `x-vps-target`: base64url JSON `{ "v": 1, "email", "role" }`, set only by cf-admin server code |
| Delegated save | cf-vps `POST /api/access/person` | Rules of section 4; answers with the person's new state and an `x-vps-audit` line |
| Rule library | cf-admin `src/lib/access-center/rules.ts` | Pure functions for section 4, used to mark items editable and to refuse early |
| Console client | cf-admin `src/lib/access-center/vps.ts` | Calls the VPS binding server-side with the actor and target headers |
| Profile builder | cf-admin `src/lib/access-center/profile.ts` | Joins pages and console data into one profile with sources (section 6) |
| Access Center API | cf-admin `src/pages/api/users/access-center.ts` | `GET` one profile, `POST` one console change |
| Panel | cf-admin `src/components/admin/users/AccessCenterPanel.tsx` (removed 2026-10-03: superseded by the v2 editor, `access-editor/`) | Plain working UI on `/dashboard/users/<id>/access`, replacing the separate server-console panel |

```text
browser → /dashboard/users/<id>/access → GET/POST /api/users/access-center
  cf-admin: session + users page access, target read from the database, rules (section 4)
    → pages: registry + overrides (read)                 [stage 1: read only here]
    → server console: VPS binding with x-vps-actor + x-vps-target → cf-vps re-checks, saves
  ← profile / result;  audit line → cf-admin activity log
```

## 6. API contract (what the screen gets)

### `GET /api/users/access-center?userId=<id>`

```json
{
  "ok": true,
  "data": {
    "person": { "id": "…", "email": "…", "name": "…", "role": "manager", "roleLabel": "Manager" },
    "viewer": { "role": "admin", "canEditPerson": true },
    "systems": [
      {
        "id": "pages",
        "label": "Portal pages and actions",
        "status": "ok",
        "editVia": "page-editor",
        "groups": [
          {
            "id": "emails",
            "label": "Emails",
            "items": [
              { "key": "/dashboard/emails#compose", "label": "Compose", "effective": true, "source": "role", "editable": false }
            ]
          }
        ]
      },
      {
        "id": "vps",
        "label": "Server console",
        "status": "ok",
        "rev": 7,
        "grant": { "allow": ["host.view"], "deny": [], "expiresAt": null, "note": "" },
        "groups": [
          {
            "id": "read",
            "label": "Look",
            "items": [
              { "key": "host.view", "label": "Host overview", "description": "…", "effective": true, "source": "grant", "editable": true, "expiresAt": "2026-12-31" },
              { "key": "audit.view", "label": "Audit record", "effective": false, "source": "locked", "editable": false, "whyNot": "locked" }
            ]
          }
        ]
      }
    ]
  }
}
```

- `status` is `ok`, `unavailable` (the console did not answer; `message` says why) or `hidden` (the viewer may not see this system).
- `editable: false` always comes with `whyNot`: `locked`, `not-held`, `outranked`, `self`, `no-delegate`, or `page-editor` (pages in stage 1).
- `grant` and `rev` are the console's stored grant for this person and the policy revision; a save sends both back.

### `POST /api/users/access-center`

```json
{ "userId": "…", "system": "vps", "rev": 7,
  "grant": { "allow": ["host.view", "logs.view"], "deny": [], "expiresAt": "2026-12-31", "note": "on call in December" } }
```

The whole grant for that system is sent (not a diff); `grant: null` removes the person's grant.
The 200 answer's system entry also carries `saved: { rev, changes }`, the console's own list of
what changed. Answers:

| Status | `error.code` | Meaning |
|---|---|---|
| 200 | | Saved; `data` is the person's new system entry |
| 400 | `bad_request` | Malformed body, unknown capability, end date in the past or over 366 days |
| 403 | `forbidden` | A rule refused; `error.need` names it (`access.delegate`, `not-held:<cap>`, `locked:<cap>`, `outranked`, `self`) |
| 409 | `conflict` | Someone saved first; reload and try again |
| 502 | `unavailable` | The console did not answer |

## 7. The local preview (cf-vps)

On `localhost`, the console signs with the dev key, which the server agent limits to looking.
So pages and buttons that change something used to be hidden, the Terminal and the Access
editor among them, and Antigravity could not design them. From now on:

- `GET /api/me` in the local preview also returns `"preview": true`, `caps` lists every
  capability the dev actor holds (so every page and control shows), and `agentCaps` lists what
  the server agent will actually accept from a laptop (the read-only ones).
- Access edits in the preview save to the **local test database** on the PC, never the real one.
- Anything that would change the server (actions, the terminal) is refused by the agent; the
  screen shows that error. The UI can key a "Preview" banner off `preview`.

## 8. Failure handling and audit

- A console that does not answer within 10 s gives that system `status: "unavailable"`; the
  rest of the profile still loads. Page data never depends on a console.
- The console catalog is cached for 5 minutes per isolate (metadata only). Grants are never cached.
- Every console save writes one cf-admin activity-log row from the console's `x-vps-audit`
  line, marked as made through the Access Center, and as delegated when it was.
- cf-admin never trusts the request body for the target's role: it reads it from the database,
  as `POST /api/users/access` does. Hidden users stay visible only to owner and vendor.

## 9. Stages

| Stage | Delivers |
|---|---|
| **1 (shipped 2026-10-02)** | Server console: `access.delegate`, the trusted target header, the catalog, delegated saves, the full local preview. cf-admin: the rule library, the profile with pages (read) and server console (read and edit), the API, the plain panel replacing the old server-console panel. Page edits stay in the existing page editor on the same screen |
| **2 (shipped 2026-10-03)** | The backup console joins with the same console contract (`x-backup-target`, its own `access.delegate` and catalog; cf-backup `7d5c2b9`). cf-admin: one console client (`console-client.ts`) and a registry (`consoles.ts`) serve both consoles; the panel edits any console system |
| 3 | Page edits move into the Access Center API, after the four existing page gates are extracted into the rule library with tests that pin today's behaviour; then the old page editor can go |

## 10. Testing

- cf-vps: delegation rules T1–T5 (each refusal and each pass), forged and missing target
  headers, compare-and-swap conflicts, the catalog, the preview fields of cf-vps `GET /api/me`, and that
  `access.manage` behaves exactly as before.
- cf-admin: the rule library as a table of cases; the profile builder with the console mocked
  (ok, unavailable, hidden); the API reading the target role from the database and refusing a
  body that claims another role; the existing page-access tests unchanged.

## 11. Stage 1 as built in cf-admin (2026-10-02)

What the code does where this design left a choice. The screen's view of it is
[ACCESS-CENTER](../features/ACCESS-CENTER.md).

- **cf-admin's own gate comes first.** A change (and an editable item) needs the viewer to
  strictly outrank the person, as `canManageUser` does for every other account action, and
  never to be the person. This holds for `access.manage` holders too: an owner changes another
  owner's console access in the console's own Access page, not here.
- **The console's part needs the console.** Someone who cannot open `/dashboard/vps` sees the
  server console system as `hidden`, and cf-vps is not asked.
- **A body's role is never read.** Unknown keys in a POST body (a `role`, a `targetRole`, an
  `email`) are dropped by the schema; the person is read again from the database by id.
- **The early refusal reads first.** A POST asks cf-vps for the person (and the cached catalog)
  before sending the change, so T4 and T5 are checked against the stored grant and the viewer's
  console rights, and an unknown capability or an out-of-range end date is refused with 400.
  A grant that holds nothing is sent as `null`.
- **One budget for access changes.** A save counts against the same 5-a-minute limiter as the
  page editor (`plac`), so no new Redis key family exists.
- **Audit.** A save cf-vps confirms writes one `vps_access_change` row (module `vps`, target the
  person), with `surface: access-center` and `delegated` from cf-vps's `via=delegate`. A save
  whose answer never came (a dropped connection or a timeout) writes the same row as
  "outcome unknown". A refusal writes none; a cf-vps refusal that cf-admin's rules allowed is
  reported once to Sentry as rule drift.
