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
| P658 | Users and access, API keys, Make a key: a name, a role, Read only, 15 calls a minute, More limits: one part, an end in 7 days | The key is shown once with Copy; the list shows okey_ and its id, the role, Works until the date; Users does not list it | [record](records/2026-11-25-api-keys-management.md) |
| P659 | Tap the key | Details: state, role, Read only, 15, the part, Any address, Never used; Rotate, Change limits, Change access, Revoke in one row | [record](records/2026-11-25-api-keys-management.md) |
| P660 | On a computer, run the curl line from How to use with the key | A JSON answer; a minute later Calls shows a column and the call with its status and your address | [record](records/2026-11-25-api-keys-management.md) |
| P661 | Run a POST with the read-only key, then add an address in Change limits that is not yours and call again | 403 saying the key only reads, then 403 naming your address; both refused calls show in Calls | [record](records/2026-11-25-api-keys-management.md) |
| P662 | Rotate, keep the old secret 1 hour | The new key shown once; calls work with both until the hour is up; Details shows until when the old one works | [record](records/2026-11-25-api-keys-management.md) |
| P663 | Change access to another role | The role in Details changes; History lists every step in plain words | [record](records/2026-11-25-api-keys-management.md) |
| P664 | Revoke, then Delete | After Revoke only Delete is offered; after Delete the key leaves the list and the Audit log keeps both | [record](records/2026-11-25-api-keys-management.md) |
| P665 | Open the old key account link you had in Users | It says it belongs to an API key and links to the key's page | [record](records/2026-11-25-api-keys-management.md) |
| P667 | Users and access, API keys, How to use | Chips Quick start, Endpoints, Errors, How access works; coloured cards; cURL, JavaScript and Python each with Copy; an endpoint opens to its cURL line | [record](records/2026-11-25-api-key-pages-made-over.md) |
| P668 | The keys list, then a key | Figures above coloured key rows with a state tag; the key's page titled with its name, figures and two cards, Access and Key | [record](records/2026-11-25-api-key-pages-made-over.md) |
| P669 | The key's Calls, then History | A 7-day chart and the latest calls with method and status tags; History steps with coloured tags | [record](records/2026-11-25-api-key-pages-made-over.md) |
| P670 | The key's How to use, a read-only key with one part | Only GET routes of that part, each opening to a ready call; the errors list with colours and fixes | [record](records/2026-11-25-api-key-pages-made-over.md) |
| P643 | Settings, Modules, Access (a portal where nobody switched Sign-in alerts off) | Sign-in alerts on; signing in from another browser brings the email | [record](records/2026-11-24-sign-in-alerts-on.md) |
| P640 | My access, Your sign-ins | Report a sign-in, then Sign out everywhere, in one row; Report a sign-in asks first and says whoever looks after access is told | [record](records/2026-11-24-report-a-sign-in.md) |
| P641 | Signed in on two browsers: press Report a sign-in on one, then Report and sign out | Signed out on both; the alert recipients get a Critical email naming you and the other browser | [record](records/2026-11-24-report-a-sign-in.md) |
| P642 | As the Owner, Alerts | The report is open, with Mark resolved; pressing it moves it to resolved | [record](records/2026-11-24-report-a-sign-in.md) |
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
| P549 | Users and access, Settings (then System, Settings) | Options in a card, then the settings in a card headed Settings (on System one card per part: Alerts, Status, Backups), Set up under them; nothing loose on the page | [screens](../packages/screens/README.md) |
| P561 | Users, on a phone | Invite, Signed in today and Access requests, then the search with Filters beside it, then the users; Filters opens Active (green dot), Deactivated (grey), Invited (blue) and the roles, each with its own colour; pick one: Filters shows 1 | [record](records/2026-11-24-one-line-toolbar-and-colour.md) |
| P562 | System, Audit log, on a phone: press Filters; then on a computer | The search and Filters on one line, the list right under it; Filters opens When, Who, Result (Refused with an amber dot, Failed red) and Section (each in its sidebar colour). On a computer the search, Export, Filters, When and Who share one line | [record](records/2026-11-24-one-line-toolbar-and-colour.md) |
| P574 | System, Audit log: pick Refused, on a phone and on a computer | No Name these filters field above the list; Filters shows 1; open it: Save view among the filters, which asks the name in a dialog | [screens](../packages/screens/README.md) |
| P654 | Files, then Starred, Recent and Shared with me | "Files" at the same size and place on every one; no Starred title on a line of its own, the chip shows which is open | [record](records/2026-11-25-one-title-no-wrap-lighter-dark.md) |
| P655 | Dark theme: Files, then Users and access, then a user | Lighter, blue-tinted greys, not near-black; each section's coloured tile beside its name on a phone; no button or chip with its words on two lines | [record](records/2026-11-25-one-title-no-wrap-lighter-dark.md) |
| P656 | Files, + New; then a row's ⋯ menu; then New folder, light and dark | Each menu opens right at its button, a lightly coloured card with coloured icons; the New folder dialog is tinted and the page behind is only dimmed | the 2026-11-25 row in the [verification log](verification-log.md) |
| P657 | Files, + New on a phone and a computer; then a file row's ⋯ menu near the foot of the list | Every item shows in full, nothing cut by the box around it; the menu stays on screen and moves with the page when you scroll | the 2026-11-25 row in the [verification log](verification-log.md) |
| P666 | Settings, pick another colour, Save changes; then any form's main button on a slow connection | The orb shows over the button's words; the button keeps its size and nothing beside it moves | the 2026-11-25 row in the [verification log](verification-log.md) |
| P650 | As an Owner: Users and access, Settings, API keys, Make a key: a name, a role (no Owner offered), Make the key | The key shown once with Copy; the list shows it with No end date, never used | [record](records/2026-11-24-api-keys.md) |
| P651 | The same key's row, Revoke, Revoke it | The key was revoked; its row says Revoked with today's date and no Revoke button | [record](records/2026-11-24-api-keys.md) |
| P653 | Sign in as someone who may give access but whose role lacks a permission that a lower role carries; Users, Invite | That lower role is not offered; roles whose every permission they hold are | [record](records/2026-11-20-codebase-review.md) |
| P671 | Users and access | API keys is a tab of its own, after Locations | the 2026-11-25 row in the [verification log](verification-log.md) |
| P672 | The search box, type token, then history, then the name of a setting or a person | API keys, then Audit log, under Pages; settings, people and other finds listed under them as you type; a tap opens one | the 2026-11-25 row in the [verification log](verification-log.md) |
| P673 | System, Alerts; Users and access, Settings | Each section's card has a coloured top edge and its table head a matching tint; the counts carry the colour | the 2026-11-25 row in the [verification log](verification-log.md) |
