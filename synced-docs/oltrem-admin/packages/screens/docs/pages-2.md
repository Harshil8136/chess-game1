---
title: "@oltrem/screens: the pages, Users"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src/users.tsx, people.tsx, person-perms.tsx, policy.tsx, forms.tsx, access.tsx]
---

# @oltrem/screens: the pages, Users

> Part of [the @oltrem/screens README](../README.md).

## The pages, continued

The Users and access pages are tabs of one page, Users: Users, Roles, Groups, Locations, and Access
requests and Access reviews for those who may give roles, Vendor access for Owners and the Vendor
(each tab from `may` in `/api/iam/me` via `NavEntry.may`; the API still checks). The sidebar has one
Users row; a page inside a tab keeps it marked (`accessSection`). Before the company exists each
shows "First, name the company" with the form.

| Path | Shows | Reads |
| --- | --- | --- |
| `/people?show=&role=&q=` | A small **Invite** beside the heading; search over name, email, role (an exact email opens that user); chips Everyone, Active, Deactivated, Invited with counts, Blocked while anyone is, one per role, **Signed in today** and **Not used lately** (`UNUSED_DAYS` 45) while they hold someone; "N access requests wait for you" with Review; two-line rows (initials, name, email, direct roles as badges with "until", last sign-in; a pill only for Blocked or Deactivated). Invited lists invitations with Send again (`POST /people/invitations/:id/again`, emailed or shown once) and Revoke (asked first). Download CSV for people managers | `/api/iam/me`, `/api/users/people?limit=200&q=`, `/api/iam/bindings?subjectKind=principal&inForce=true`, `roles`, `invitations?status=pending`, `setup-people`, `/api/users/signed-in?probe=1`, pending requests and approvals |
| `/people/invite` | "Same access as" chips (`sameAccess`, `?like=`): their highest givable role and place chosen, others named for later (one role an invitation). Addresses by line or comma (50); givable roles as cards with what each allows ("Views 25 modules, edits 19.") and how many hold it (the Owner role for the Vendor and Owners only); the place folded; Access ends (none, 8 hours to 90 days); whether to email links; Send invitations | `/api/iam/me`, `roles`, `scopes`, `capabilities`, `bindings`, pending invitations, `/api/users/people` |
| `/people/:id` | Name and email as the heading, a facts line (avatar, state, roles, last sign-in, member since) and the page track (`PersonHead`): Overview, Permissions, Sessions, Activity. Numbered `Card`s with Account in a rail from 1024 px: **1 Roles** (Change role and Remove role in dialogs, **Add role**, **Copy access**; role cards show "Gains N" green and "Loses N" red against everything held, `compareOf`, `roleDiff`); **2 Their own Allow and Deny**; **3 What they can do** (areas by level, "X of Y", to Permissions; nothing as one closing line); **Account** (display name, Deactivate or Reactivate) | `/api/users/people/:id`, `/api/iam/bindings?subjectId=&inForce=true`, `roles`, `scopes`, `overrides`, `capabilities`, `people/:id/access` |
| `/people/:id/copy` | Each active user with givable roles this one lacks, with what a press adds; nothing taken away, never the Owner role, never one's own page (`copyFrom`) | `roles`, `scopes`, `bindings`, `/api/users/people?kind=person` |
| `/people/:id/sessions` | Block sign-in (1 hour to Permanently, a reason; never an Owner or oneself) or Unblock; active sessions by browser with Set end time and End session (dialogs) and Sign out everywhere; past sessions from the audit log, one row a browser. Never one's own | `/api/users/people/:id/sessions`, `/api/audit/entries?action=iam.sign-in&target=`; `PATCH .../sessions/:device`, `POST .../block`, `.../unblock` |
| `/people/:id/activity?about=&before=` | What they did, or Changes to their account, as a plain-words timeline with who, browser and refusal reasons; Older | `/api/audit/entries?actor=` or `?target=` |
| `/people/:id/exceptions` | 301 to `/people/:id/see` | |
| `/people/:id/see?place=`, `?view=json` | **Permissions**: one place at a time; "N of M permissions at <place> and inside it" as a ring by the search; modules as tiles (`#m-<module>`) with a bar and level (None, View, Edit, Manage, Custom), opening to rows marked yes or no with their source (role and place, a group's role, their own Allow or Deny) and `area.thing.verb` with Copy. Those who may change it get Inherit, Allow and Deny where saveable (`choices` in `person-perms.tsx`: the Vendor's own by the Vendor; the Owner's own on an Owner; an Owner's Users and access only Allow unless the Vendor), Access ends and one Save; a new Deny needs "Yes, deny what I picked". **Policy JSON**: their own Allow and Deny as one policy with Format, Copy, Download, live validity, Check and Save (`POST /people/:id/see/policy`, `intent=check\|save`), read through `parsePersonPolicy` (Allow or Deny; Action a name, id, `*`, `area.*` or `*.verb`, wildcards never taking the Owner's or Vendor's own; Resource `loc:*` or a path; only `Ends`; errors by line and column) and `policyChanges` ("Adds N Allow, adds N Deny, ends N"); at most `MAX_POLICY_CHANGES` (12) a save, new rules made before old ones end. **From roles** beside it, with Copy all. Viewing never signs you in as them | `/api/users/people/:id`, `/api/iam/scopes`, `/api/iam/people/:id/access`, `overrides`; JSON also `bindings`, `roles`, `capabilities` |
| `/people/signed-in?show=` | Signed in today (a Users tab for session managers): chips Everyone today, New browser or country, Unusual (two countries within an hour); each person's sign-ins (browser, country, time, mark) with Sign out; refused addresses; **Sign everyone else out** for an Owner or the Vendor | `/api/users/signed-in`; `POST /api/users/people/:id/sign-out`, `/api/users/sign-out-everyone` |
| `/people/signed-in/history?outcome=&q=&before=` | Sign-in history: search, chips Today, All, Signed in, Refused; 50 a page; Download CSV (90 days) | `/api/users/sign-ins`, `.../export?days=90`, `/api/users/export` |
| `/access` | Roles: **Create role**; each role with its modules, permission count and holders; "How permissions work" folded | `/api/iam/me`, `roles`, `bindings?inForce=true` |
| `/access/groups` | Groups with member counts; Create group | `/api/iam/groups` |
