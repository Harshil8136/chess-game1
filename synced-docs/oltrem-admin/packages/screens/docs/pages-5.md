---
title: "@oltrem/screens: the forms"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src/screens.tsx, forms.tsx, people.tsx, policy.tsx, access.tsx, layout.tsx]
---

# @oltrem/screens: the forms

> Part of [the @oltrem/screens README](../README.md).

## The forms

Each posts to the screen's own route, which calls the API as the signed-in person. A change that
worked redirects with a `done` key the page turns into a fixed sentence (no name travels in the
address); a refusal shows the page again with the API's reason and status, keeping what was typed.
A form posted from another site is refused. Choices of one are `ChoiceChips`. Secret fields are
password fields, never put back into a page.

| Form | Calls | Comes back with |
| --- | --- | --- |
| Invite people: up to 50 addresses (`inviteList`; more refused first), or a `.csv` or `.txt` file up to `INVITE_FILE_BYTES` (128 KB) whose addresses (`addressesIn`) join the box to check first; a role, place, end (the Owner role never ends), whether to email | `POST /api/iam/invitations/many`, then `GET /api/email/ready` | Who was queued (never "emailed"; with no service ready, a link to Email settings), links shown once with Copy, refusals with links to an existing account or the Invited list |
| Withdraw an invitation (asked first); send one again | `DELETE /api/iam/invitations/:id`; `POST .../again` with `send` | `/people?show=invited&done=withdrawn`; the new link queued or shown once |
| Give a role (`/people/:id/grant`): role, place, `ends` (`never` lets `iam.grant_days` decide; `8h` to `90d`; `at:<date>` keeps a change's end), only when switched on; the Owner role asks first (`OwnerConfirm`, `confirm=owner`). Change one (`/people/:id/grants/:binding/change`): new given and old ended ("Only half done" if one step fails). Remove one | `POST`, `DELETE /api/iam/bindings` | `?done=granted`, `role-changed`, `ended` |
| Copy access (`/people/:id/copy`, `from`): each role given; "Only part copied" or 422 "Nothing to copy" | `POST /api/iam/bindings` | `?done=copied` |
| Change permissions (`/people/:id/see`): each changed row gets its new Allow or Deny made, then its old one ended; a new Deny needs confirming (422 "Confirm the deny"); `POST /people/:id/exceptions` takes one alone | `POST`, `DELETE /api/iam/overrides` | `?done=perms-saved`, `nothing-changed`, `extra-added`, `exception-ended` |
| Save a user's policy (`POST /people/:id/see/policy`): `intent=check` or `save`, at most 12 changes, a new Deny only with `sure=yes` | `parsePersonPolicy`, `policyChanges`; `POST`, `DELETE /api/iam/overrides` | `?done=perms-saved` or `nothing-changed`; problems with the text kept (422) |
| Deactivate (a reason optional) or reactivate; change the name; end a sign-in or all | `POST /api/users/people/:id/deactivate`, `reactivate`; `PATCH .../profile`; `DELETE .../sessions/:device`, `POST .../sign-out` | `?done=off`, `on`, `profile-saved`, `session-ended`, `signed-out` |
| Create, save or remove a role: each module posts `level:<part>` and `was:<part>`; a changed level gives its permissions, else the ticked boxes count; a taken name is refused first | `POST /api/iam/roles` (placed lowest), `PATCH`, `DELETE` | `?done=role-made`, `role-saved`, `role-removed`; "The role was not created" with the reason |
| Move a role up or down (`/access/roles/:id/move/up\|down`): into the gap past its neighbour, else a swap; never above the Owner | `PATCH /api/iam/roles/:id` with `position` | `?done=role-moved` |
| Import a role policy (`/access/roles/:id/import`, `/access/roles/import`): Version `oltrem-2026-11`, Allow rules at `loc:*` of names, old ids, `*`, `area.*` or `*.verb`, saved as today's list; Deny, other Resources, Conditions, unknowns and the Owner's or Vendor's own refused with what to do | `parseRolePolicy`, `GET /api/iam/capabilities`, then `PATCH` or `POST /api/iam/roles` | `?done=role-imported` or `role-made`; "The policy was not imported" with every reason |
| Add, rename or remove a location | `POST /api/iam/scopes`, `PATCH`, `DELETE` | `?done=place-added` |
| Turn on a role; ask for access, withdraw a request | `POST /api/iam/me/grants/:id/activate`; `POST`, `DELETE /api/iam/me/requests` | `?done=turned-on`, `asked`, `request-withdrawn` |
| Approve or refuse a request or approval | `POST /api/iam/requests/:id/decision`, `/api/iam/approvals/:id/decision` | `?done=request-approved`, `request-refused`, `approval-given`, `approval-refused` |
| Start a review, keep or remove a grant, close it | `POST /api/iam/reviews`, `.../items/:binding`, `.../close` | `?done=review-opened`, `review-decided`, `review-closed` |
| Make, rename or remove a group; add members (a typed address looked up first), take one out; give the group a role, change it, end it | `POST`, `PATCH`, `DELETE /api/iam/groups`; `GET /api/iam/people?q=`, `POST .../members`, `DELETE .../members/:principalId`; `POST`, `DELETE /api/iam/bindings` | `?done=group-made`, `group-renamed`, `group-removed`, `member-added`, `member-removed`, `group-granted`, `group-grant-changed`, `group-grant-ended` |
| The Vendor's access mode, open or close a window; add a Vendor account, switch one off or on | `PUT /api/iam/tenant/vendor-access`, `POST`, `DELETE .../vendor-window`; `POST /api/iam/vendors`, `PUT .../:id/active` | `?done=vendor-mode`, `window-opened`, `window-closed`, `vendor-added`, `vendor-off`, `vendor-on` |
| Records: create, save or remove a list; add, save or remove a record; add, move or remove a field; import a CSV; download | `/api/records/lists`, `.../items`, `.../fields`, `.../move`, `.../import`, `GET .../export` | `?done=list-made`, `list-saved`, `list-removed`, `record-added`, `record-saved`, `record-removed`, `field-added`, `field-moved`, `field-removed`, `records-imported` |
| Forms: make, save, new address, remove; fields; take, release, mark, note, reply, remove an answer | `/api/forms/forms`, `.../key`, `.../fields`, `.../move`, `.../entries/:entry`, `.../notes` | `?done=form-made`, `form-saved`, `form-new-address`, `form-removed`, `form-field-added`, `form-field-moved`, `form-field-removed`, `answer-taken`, `answer-released`, `answer-marked`, `answer-noted`, `answer-replied`, `answer-removed` |
| Save the Settings page: `value:<key>` beside `was:<key>`, only changed rows, each alone; refusals named with how many saved (`settingsRefusal`); the colour tiles join as `settings.look` and clear one's own look cookie | `PUT /api/settings/values/:key` per row | `?done=settings-saved` or `settings-unchanged` |
| Save one setting (a list one item a line); reset to default; one value for settings sharing a name (`/settings/same/:name`, stopping at the first refusal) | `PUT /api/settings/values/:key` | `?done=setting-saved`, `setting-reset`, `settings-same` |
| Switch beside the work (`/do/switch`, the Vendor and Owners): extras atop a part's first page (`data-autosave`), Turn off beside a Status warning, Hide on Get started; only the Features page's own parts and extras | `GET`, `PUT /api/settings/parts` for those ids | Back with `?done=switched` or `switched-on` |
| Back up now (`/do/backup/run`): the ticked parts; with Keep these ticked, changed ticks saved to `backup.copy_database` or `backup.copy_files` | `GET /api/backup/status`, `POST /api/backup/runs { parts }` first, then `PUT` settings | `/backup?done=backup-started`, `-choice-kept`, `-choice-not-kept`, `-choice-not-saved` |
| Check every connection now (`/do/checkup/run`): the six checked longest ago, three at a time, each through its own part's check | `GET /api/providers/checkup`, then each part's probe or check route | `/health/checkup?done=checkup-done`, `checkup-more`, `checkup-none` |
| A Get started step (`/do/get-started`) | The module's steps read again, then only that step's `action.path` (POST) | `/?done=step-started` |
| Look up a domain | `POST /api/providers/detect` | What was found |
| Connect a provider: name and fields; the key checked at once; a working email key sends when none does, its addresses read and reports registered | `POST /api/providers/instances`, `.../probe`; email: `.../activate`, `POST /api/email/domains/discover`, `/api/email/instances/:id/reports` | Write with `?done=connected`; `connected-refused`; other kinds `checked` |
| Check again (`/providers/ready`); check the key; send a test | `POST /api/email/ready/check`; `.../probe`; `POST /api/email/canary` | `?done=rechecked`, `checked`, `tested` |
| Make it send (held mail released, `POST /api/email/release`), take out of use, remove; paste the key again | `.../activate`, `.../disable`, `DELETE`; `.../credential` | `?done=sends`, `taken-out`, `removed`, `key-saved` |
| Alerts: assign to me; resolve with a reason (words needed for Other) | `POST /api/alerts/items/:id/acknowledge`, `.../resolve` | `?done=acknowledged`, `alert-resolved` |
| Audit export: two dates (7 days default), fetched by the browser | `GET /api/audit/export?since=&until=` | The CSV |
| Theme (`POST /do/theme`, `theme` and `back`) | The `oltrem_theme` cookie (cleared for system) | `back` when a portal path, else Home |
| Sign out (account menu, `data-reload`) | Behind Access `SIGN_OUT`, `POST /api/iam/me/sign-out`, then `/cdn-cgi/access/logout`; locally `/local/sign-out` | Out of the portal |

Every page sits in the frame (`src/layout.tsx`, [the frame](frame.md#the-frame)): the sections in the
sidebar only (R-12); a head row (the group's icon, title, a line or `sub`, and `tools`); a set's
tabs; `ActionRow`, `Stats` from the answers already read, and the sections. Empty lists say so in a
dashed box.
