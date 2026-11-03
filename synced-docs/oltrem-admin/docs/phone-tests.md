---
title: "Phone tests owed"
status: living
owner: vendor
last_verified: 2026-11-03
sources: [the records under docs/records/ from 2026-10-21 to 2026-11-03, their "not verified" lines; the verification log]
---

# Phone tests owed

> **In plain words.** Every change since 2026-10-21 was tested by machine, and almost none of it
> has been looked at on a real phone yet. This is the one list of what is still owed, grouped by
> page, each a few taps with what you should see. When a line passes, say so (or tick it here)
> and it moves to "Passed" with the date; when it fails, say what you saw and it becomes a fix.
> Each line links the record that owes it. A new change adds its line here in the same commit.

**How to run them.** Use one portal you can sign in to (your local start page, or the sandbox
once it exists). Open each page on the phone, in both light and dark if you have time. A test
passes when what the line says is what you see, and nothing is cut off, overlaps, or needs a
sideways scroll of the whole page (a row of chips scrolling sideways is meant to).

## Owed

### Home and the frame

| # | Open | You should see | From |
|---|---|---|---|
| P1 | Home on a new portal | "Get started: 0 of 5 done", each open step a row; tapping one opens its page | [record](records/2026-11-03-get-started.md) |
| P2 | Home | Needs you first (or "Nothing waits for you"), then the cards in two columns at most | [record](records/2026-10-27-needs-you.md) |
| P3 | The menu button, then a section | the sidebar slides in over the page; a section opens without the whole page reloading | [record](records/2026-10-28-sidebar-without-reloads.md) |
| P4 | Any page with tabs (Email, Access) | the tabs as one sideways row under the title, the open one marked | [record](records/2026-10-29-shorter-sidebar.md) |
| P5 | The theme switch at the foot of the sidebar | light and dark both readable, buttons 40 px tall, fields do not zoom when tapped | [record](records/2026-10-27-portal-makeover.md) |
| P32 | The bell (sidebar, or beside Search on a phone), after someone gives you a task | a figure on the bell; the page lists the task, bold; tapping it opens the task and the figure goes down |
| P33 | Notifications, How you are told: Tasks to Portal only, Save | "Saved" shows; the next task given to you is under the bell and no email comes |
| P34 | Any page with chips (Tasks, Access), on a phone and on a computer | small rounded chips on one soft row, the open one tinted in the brand colour; buttons 40 px on the phone and 36 px under a mouse | [record](records/2026-11-03-look-2.md) |
| P35 | Save any change (a task done), then a change refused (a form left blank) | "Saved" or "done" comes up at the bottom right (the foot on a phone) and leaves by itself after 6 s; a refusal stays until you press × | [record](records/2026-11-03-look-2.md) |
| P36 | Settings, Find a setting; Parts, Find a module | one field with a magnifier and an arrow inside it, no separate big button; the page loads styled straight away | [record](records/2026-11-03-look-2.md) |
| P37 | Users, Roles, Create role, Start from Standard user | every module a row with None, View, Edit and Admin always showing (a level the module has not is faded); Set all shown to Admin, then type in Find a module and press None: only the rows shown change; the arrow on Records lists its four permissions; the sentence in the Save bar follows | [record](records/2026-11-03-role-matrix.md) |
| P40 | Your account (the foot of the sidebar), Look and colours: tap Emerald, then Dots; then open Tasks; switch the theme to Dark | each tap changes the page at once with a "saved" note; the green and the dots stay on every page and in dark; Back to the portal's own returns the blue | [record](records/2026-11-03-looks.md) |
| P41 | Users, a user who holds a role: What they can do | one row per module with "3 of 4" and a word (View, Edit, Admin, Custom); the arrow on a row lists each permission and where it comes from | [record](records/2026-11-03-role-matrix.md) |
| P42 | Automations, Files, a booking | the filters (All, On, Off) are soft chips; what you can do (When something happens, Upload a file, New folder) are white buttons with a border, so the two never look alike | [record](records/2026-11-03-look-2.md) |
| P43 | Search (the magnifier), Customers, a records list, a form's answers | each search is one field with the magnifier in front and the arrow inside; Enter or the arrow searches | [record](records/2026-11-03-look-2.md) |
| P44 | Users → Roles; Developer → Jobs | Roles lists View only, Standard user and Full admin under "Start a role from a ready set"; a press opens the editor filled in, named, ready to save. In Jobs each time sits on one line with its cost beneath, and Run soon and Pause are two bordered buttons side by side | [record](records/2026-11-03-look-2.md) |

### Lists, saved views and bulk actions

| # | Open | You should see | From |
|---|---|---|---|
| P6 | Tasks, pick "Open", name it, Save view | a chip with the name above the list; tapping All and back to it works; Remove takes it away | [record](records/2026-11-03-saved-views.md) |
| P7 | A records list, filter by a choice | the filters and the list fit; the save field sits under the chips | [record](records/2026-11-03-saved-views.md) |
| P29 | Tasks, Open, with two tasks or more: tick two, press Mark done | the bar says "2 tasks chosen" and its buttons wake only once something is ticked; after the press, "Mark done: done for 2 rows" and both are on Done | [record](records/2026-11-03-bulk-actions.md) |
| P30 | Tasks, Done: tick the box at the top on a computer, or each task on a phone, press Remove | a dialog asks first; Cancel leaves them; Remove takes them all away | [record](records/2026-11-03-bulk-actions.md) |

### Settings

| # | Open | You should see | From |
|---|---|---|---|
| P8 | Settings, then the Modules page | each module a tile with its switch; the extras (daily audit seal, reminders, Get started) as smaller switches inside their tile | [record](records/2026-11-03-optional-extras.md) |
| P9 | Settings, switch Get started off and save | Home without the card; on again, it is back | [record](records/2026-11-03-get-started.md) |
| P10 | Access, Roles, a role | the redesign at phone width: its permissions in groups, Save at the foot | [record](records/2026-10-31-access-settings-redesign.md) |

### People and access

| # | Open | You should see | From |
|---|---|---|---|
| P11 | People, Invite | the form, the invitation made, its link copyable | [record](records/2026-10-27-access-screens.md) |
| P12 | A person, View what they can do | the person's access by place, in words | [record](records/2026-10-21-see-it-as.md) |

### Alerts, audit and errors

| # | Open | You should see | From |
|---|---|---|---|
| P13 | Alerts | open alerts, the worst first; a server error listed with where, how often and its stack | [record](records/2026-11-03-error-log.md) |
| P14 | Audit log, filter, Download | the list, the filters as chips; the file downloads on the phone | [record](records/2026-10-21-audit-seal-and-export.md) |

### Email

| # | Open | You should see | From |
|---|---|---|---|
| P15 | Email, Write | From, To as chips (red when not an address), Cc and Bcc under More, template buttons in a row | [record](records/2026-11-01-email-remake.md) |
| P16 | Email, Sent, then Addresses | the console pages fit; a domain's records with Copy buttons | [record](records/2026-10-31-email-console-remake.md) |
| P17 | Email, a bulk run | the results card readable without overflow | [record](records/2026-10-28-bulk-mail-watch.md) |

### Work modules

| # | Open | You should see | From |
|---|---|---|---|
| P18 | Tasks: make one, mark it done | it shows on Home's Needs you, then leaves | [record](records/2026-10-27-tasks-module.md) |
| P19 | Files: upload a photo, share a link | the upload from the camera roll, the link copied | [record](records/2026-10-27-files-module.md) |
| P20 | Expenses: add one with a receipt photo | the camera opens; the claim goes to approval | [record](records/2026-10-27-expenses-module.md) |
| P21 | Approvals, Announcements, Equipment | each list and form fits; a decision is two taps | [approvals](records/2026-10-27-approvals-module.md), [announcements](records/2026-10-27-announcements-module.md), [equipment](records/2026-10-27-assets-module.md) |
| P22 | Bookings, Time off, Time clock, Shifts | the week or day views fit; clock in and out in one tap each | [bookings](records/2026-10-27-bookings-module.md), [time clock](records/2026-10-27-timeclock-module.md), [shifts](records/2026-10-27-shifts-module.md) |
| P23 | Quotes and Invoices: make one, send it | the lines readable; the customer's page shows it | [quotes](records/2026-10-27-quotes-module.md), [invoices](records/2026-10-27-invoices-module.md) |
| P24 | Privacy: search an address | the rows found, grouped by module | [record](records/2026-10-27-privacy-module.md) |

### Customers

| # | Open | You should see | From |
|---|---|---|---|
| P25 | The customer sign-in page, as a customer | the code arrives by email; the account page lists their sections | [sign-in](records/2026-10-27-customer-sign-in.md), [sections](records/2026-10-27-customer-account-sections.md) |
| P26 | A customer's account, Files | the files shared with them open | [record](records/2026-10-27-files-shared-with-customers.md) |

### Mail

| # | Open | You should see | From |
|---|---|---|---|
| P27 | Messages, Inbox, on a portal started with Mail on your computer: add a mailbox `hello`, then run `oltrem mail try --to` its address | the mailbox is made at once, with no Cloudflare step; the test email is in the Inbox and opens on tap | [record](records/2026-11-02-oltrem-mail-inbox.md) |
| P31 | The start page on your computer, Try it here: tick **With Oltrem Mail**, press Start; then on your phone (the portal shared to it) Forwarding, **Send a test** to an alias | the start says Oltrem Mail is in, then the portal starts with Mail setup, Inbox and Forwarding; the test says Forwarded, with no Cloudflare step | [record](records/2026-11-03-mail-tick.md) |
| P38 | Email, Mail setup on a portal whose Settings, Email has a From address | the domain, Send as and name are already filled in from it, with a line saying so; Forwarding's Add a domain has the same domain | [record](records/2026-11-03-mail-tick.md) |
| P39 | Email, Write: send one; then Forwarding, Send a test | "Sending to …" with Undo comes up at the bottom right and leaves by itself; "Forwarded" or "Refused" comes up the same way, and a refusal stays until you press × | [record](records/2026-11-03-mail-tick.md) |
| P28 | A deployed portal with Mail: add a mailbox, write to it from your own email, open it, reply | it arrives within a minute or two; your reply reaches you from the mailbox's address | [record](records/2026-11-02-oltrem-mail-inbox.md) |

The Mail add-on's own owed tests (its bundles A, B, C, F and L) are listed in Oltrem Mail's
documents, packed in [vendor/mail](../vendor/mail/README.md); they are run with a domain on the
Cloudflare route.

## Passed

None yet. A line moves here with the date it passed and the phone it was run on.

## Failed, to fix

None yet.
