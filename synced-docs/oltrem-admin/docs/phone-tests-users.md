---
title: "Phone tests owed: Users and access"
status: living
owner: vendor
last_verified: 2026-11-22
sources: [docs/phone-tests.md, which held the older lines until 2026-11-14; docs/records/2026-11-22-email-settings-compose-role-editor.md; the records each line links]
---

# Phone tests owed: Users and access

> **In plain words.** The phone tests still owed on the Users pages and the access pages, split
> from [Phone tests owed](phone-tests.md) on 2026-11-14 so each list stays small enough to read
> whole. They run the same way, and a passed or failed line moves to that list's "Passed" or
> "Failed, to fix" with the date.

## Owed

| # | Open | You should see | From |
|---|---|---|---|
| P400 | Notifications, scroll past How you are told | Keep portal emails in your main inbox: Gmail filter, Add to contacts and Send me a test in one row (it slides sideways if narrow), four steps, and who portal emails come from | [record](records/2026-11-22-main-inbox-step.md) |
| P401 | Press Send me a test | A notice that a test is on its way; within a minute an email "Is this email in your main inbox?", plain text, from the portal's address | [record](records/2026-11-22-main-inbox-step.md) |
| P402 | On a computer: Gmail filter, then in Gmail Settings, See all settings, Filters and Blocked Addresses, Import filters, the file, Create filters | One filter, from the portal's domain, Categorize as Primary, Never send it to Spam; press Send me a test again and it lands in Primary | [record](records/2026-11-22-main-inbox-step.md) |
| P403 | On the phone: Add to contacts | The phone offers to save one contact, named after the portal's mail, with its email addresses | [record](records/2026-11-22-main-inbox-step.md) |
| P404 | Sign in from a new browser (Sign-in alerts on), then open the email | It starts with Hello, and its last line points to the one-minute step; tapping the address opens Notifications at that section | [record](records/2026-11-22-main-inbox-step.md) |
| P405 | Users and access, invite one of your own other addresses, then open the email | It starts with Hello, and ends with Once you are in, and the same line | [record](records/2026-11-22-main-inbox-step.md) |
| P299 | As someone whose role was given at one location only, open Settings or Integrations | Refused, saying it is needed for the whole company; as the Owner, the same page works | [record](records/2026-11-20-security-and-access.md) |
| P300 | An invitation link, opened in two tabs: press Accept in both | One account and one role; the other tab says the invitation was used or withdrawn | [record](records/2026-11-20-security-and-access.md) |
| P301 | Developer, make a webhook whose address has a path; then Activity log | The log names only the host of the address | [record](records/2026-11-20-security-and-access.md) |
| P249 | A new portal, as the Vendor, before the company is named: open Tasks, Invoices, Campaigns, Analytics from the sidebar | Each shows First, name the company with the form; never Invalid input or You do not have access | [record](records/2026-11-15-review-team-cpu-and-first-run.md) |
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

### Email settings, Compose and the role editor, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P416 | Email, any folder | A gear in the top bar, beside Search (on a computer, at the head's right beside the bell); press it: Email settings. Back in Email, a Settings row at the foot of the sidebar (on a phone, in the menu) opens the same page | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P417 | Email, Compose | A plain head with New email and Close; at the foot one row: Send with an arrow beside it, Attach, Template, Preview, a green check mark when it is ready, and More | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P418 | The arrow beside Send; then More | Schedule send with a day and a time; then More opens Save draft and Save as template. The bold, italic and list buttons sit under the message | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P419 | Users, a user, Permissions, open a module | Each permission with Inherit, Allow and Deny as one even control, nothing cut off or faded, and its name such as `access.users.read` in small code type with a Copy button; Copy puts the name on the clipboard | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P420 | The same user: the Policy JSON tab at the top | Their access as Policy JSON with Copy, one tap from Permissions | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P421 | Users, Roles, a role | Three tabs: Permissions, Assigned to, Policy JSON. Permissions is one list of modules with None, View, Edit and Manage; a level a module has not shows a dash. Assigned to shows the users and groups, Move up and Move down, and Remove when the role was never given | [record](records/2026-11-22-email-settings-compose-role-editor.md) |
| P455 | Users, a user (Overview) | Under their name one line with their avatar, status and role, then Overview, Permissions, Sessions, Activity; no Signed in today or Access requests chips. Cards numbered 1 Roles (Add role at the top right), 2 Their own Allow and Deny (Change at the top right), 3 What they can do; Account beside them on a computer, under them on a phone | [record](records/2026-11-23-locked-layout-user-page-policy-editor.md) |
| P456 | The same user, 3 What they can do | One even list: each area with a coloured dot and Manage, Edit, View or Limited, and "2 of 8"; the areas with no access as one line at the end; tap an area: its permissions open | [record](records/2026-11-23-locked-layout-user-page-policy-editor.md) |
| P457 | The same user, Permissions, then Policy JSON at the right end of the row | Their own policy in a box with Format, Copy and Download at the top right; From roles beside it (under it on a phone) with each role's Policy JSON link | [record](records/2026-11-23-locked-layout-user-page-policy-editor.md) |
| P458 | Policy JSON: delete a comma | The line under the box says Not valid JSON at line N, column N; press Format: back in order once fixed. Press Check with a valid edit: what Save would add and end; Save: Their permissions were saved | [record](records/2026-11-23-locked-layout-user-page-policy-editor.md) |
| P459 | Settings, Name and icon | A preview of the sidebar, the phone bar and the browser tab; type a name and a Line under the name (Front desk): all three change as you type; Save: the sidebar shows Front desk under the name | [record](records/2026-11-23-locked-layout-user-page-policy-editor.md) |
| P505 | Users, Roles, a role, Assigned to | The role's name as the page title; a card Assigned to (Pick a user when no one holds it), and beside it (under it on a phone) Rank with Move up and Move down, and Remove | [record](records/2026-11-24-access-pages-review.md) |
| P506 | Users, Groups with no groups | One empty state, No groups yet, saying what a group is for | [record](records/2026-11-24-access-pages-review.md) |
| P507 | As the Vendor: an Owner, Permissions, on a phone | One line, "N of M permissions at ... As an Owner they have all but the Vendor's", then the search, then the modules near the top; no blue box | [record](records/2026-11-24-access-pages-review.md) |
| P508 | The same page, open Users and access, then a module with the Owner's own | Each row shows only what can be saved: the Owner's own as Inherit and Deny; nothing that would be refused on Save | [record](records/2026-11-24-access-pages-review.md) |
| P509 | As an Owner (not the Vendor): another Owner, Permissions, Users and access | Its rows offer Inherit and Allow only; the line says only the Vendor or another Owner can deny one | [record](records/2026-11-24-access-pages-review.md) |
