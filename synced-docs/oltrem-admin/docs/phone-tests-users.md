---
title: "Phone tests owed: Users and access"
status: living
owner: vendor
last_verified: 2026-11-14
sources: [docs/phone-tests.md, which held the older lines until 2026-11-14; the records each line links]
---

# Phone tests owed: Users and access

> **In plain words.** The phone tests still owed on the Users pages and the access pages, split
> from [Phone tests owed](phone-tests.md) on 2026-11-14 so each list stays small enough to read
> whole. They run the same way, and a passed or failed line moves to that list's "Passed" or
> "Failed, to fix" with the date.

## Owed

| # | Open | You should see | From |
|---|---|---|---|
| P219 | As the Vendor: anyone's Overrides | Vendor-level permissions listed, marked Vendor level; ticking one and Save gives it; an Owner never sees them | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P218 | As the Vendor or another Owner: an Owner's Overrides; untick one, Save | It reads Denied for them; that Owner loses it from their next request; Reset gives it back | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P217 | Then Unblock them | They can sign in again; the browser the block signed out must sign in again | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P216 | A user (not an Owner), Sessions: Block sign-in, 1 day, a reason | Signed out at once; Users lists them under Blocked; their Sessions page says until when, with Unblock | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P215 | A user, Sessions: Set end time on an active session, In 1 hour, Save | The row says ends with the time; past it, that browser must sign in again | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P214 | A user's page | Their name is the heading; one line of facts; no big card; Overview, Permissions, Overrides, Sessions, Activity | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P213 | Users | A small Invite beside the heading; each row two lines, name then roles and last sign-in; a pill only for Blocked or Deactivated | [record](records/2026-11-14-users-sessions-blocking-owner-overrides.md) |
| P137 | As an Owner (not the Vendor): change a role or give a permission override | It is done at once; no "sign in again" page | [record](records/2026-11-11-users-pages.md) |
| P136 | Users: type part of a name in the search box; tap a role chip, then Deactivated | The list narrows as you type; each chip shows its count; the page never scrolls sideways | [record](records/2026-11-11-users-pages.md) |
| P135 | A user, Sessions: End one sign-in, then Sign out everywhere | Each asks first; the browser is signed out; Sign-in history lists their sign-ins with the browser in words | [record](records/2026-11-11-users-pages.md) |
| P134 | A user's page: give another role with Access ends 1 day; then Change it to another role | The row says "until" tomorrow; the change dialog offers Keep first; the grid of modules shows their level in colour | [record](records/2026-11-11-users-pages.md) |
| P133 | Users, Invite people: pick a role card, leave No end date, send | Each card says what the role does and how many have it; the invitation is made; its row says the role | [record](records/2026-11-11-users-pages.md) |
| P11 | Users, Invite people | the form, the invitation made, its link copyable | [record](records/2026-10-27-access-screens.md) |
| P12 | A person, View what they can do | the person's access by place, in words | [record](records/2026-10-21-see-it-as.md) |
| P126 | As the Vendor, invite an Owner | Invited; no second person asked | [iam](../modules/iam/README.md) |
