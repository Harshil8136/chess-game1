---
title: "Phone tests owed"
status: living
owner: vendor
last_verified: 2026-11-03
sources: [the records under archive/records/ from 2026-10-21 to 2026-11-03, their "not verified" lines; the verification log]
---

# Phone tests owed

> **In plain words.** Every change was tested by machine, and almost none of it
> has been looked at on a real phone yet. This is the one list of what is still owed, grouped by
> page, each a few taps with what you should see. When a line passes, say so (or tick it here)
> and it moves to "Passed" with the date; when it fails, say what you saw and it becomes a fix.
> Each line links the record that owes it. A new change adds its line here in the same commit
> (an Email or Mail page's line in [their own list](phone-tests-email.md), a Users or access
> page's in [theirs](phone-tests-users.md), a backup or System status line in
> [theirs](phone-tests-system.md)).

**How to run them.** Use one portal you can sign in to (your local start page, or the sandbox
once it exists). Open each page on the phone, in both light and dark if you have time. A test
passes when what the line says is what you see, and nothing is cut off, overlaps, or needs a
sideways scroll of the whole page (a row of chips scrolling sideways is meant to).

## Owed

### Home and the frame

Owed in [their own list](phone-tests-frame.md), P153 to P242.

### Lists, saved views and bulk actions

From [record](../archive/records/2026-11-03-saved-views.md):

| # | Open | You should see |
|---|---|---|
| P6 | Tasks, pick "Open", name it, Save view | a chip with the name above the list; tapping All and back to it works; Remove takes it away |
| P7 | A records list, filter by a choice | the filters and the list fit; the save field sits under the chips |

From [record](../archive/records/2026-11-03-bulk-actions.md):

| # | Open | You should see |
|---|---|---|
| P29 | Tasks, Open, with two tasks or more: tick two, press Mark done | the bar says "2 tasks chosen" and its buttons wake only once something is ticked; after the press, "Mark done: done for 2 rows" and both are on Done |
| P30 | Tasks, Done: tick the box at the top on a computer, or each task on a phone, press Remove | a dialog asks first; Cancel leaves them; Remove takes them all away |

### Settings

From [record](../archive/records/2026-11-12-quiet-portal.md):

| # | Open | You should see |
|---|---|---|
| P151 | Admin, Scheduled jobs, a day after the deploy | Jobs with nothing to do (alerts, webhooks, automations, usage) show a next run hours away, not minutes; **Run now** on one still runs it within a minute |

From [record](../archive/records/2026-11-03-optional-extras.md):

| # | Open | You should see |
|---|---|---|
| P8 | Settings, then the Modules page | each module a tile with its switch; the extras (daily audit seal, reminders, Get started) as smaller switches inside their tile |

From [record](../archive/records/2026-11-03-get-started.md):

| # | Open | You should see |
|---|---|---|
| P9 | Settings, switch Get started off and save | Home without the card; on again, it is back |

From [record](../archive/records/2026-10-31-access-settings-redesign.md):

| # | Open | You should see |
|---|---|---|
| P10 | Access, Roles, a role | the redesign at phone width: its permissions in groups, Save at the foot |

### People and access

Owed in their own list, [Phone tests owed: Users and access](phone-tests-users.md), split on
2026-11-14 like the Email list.

### Backups and System status

Owed in their own list, [Phone tests owed: Backups and System status](phone-tests-system.md),
split on 2026-11-15 like the Email list.

### The Files page, 23 November

Owed in [their own list](phone-tests-files.md), P447 to P454, P463 to P467 (Manage access), P475 to P478 (Limits) and P479 to P483 (Storage) P484 to P487 (Held for review, Shared links) P488 to P491 (Versions, Starred, Recent) P492 to P495 (File requests) P496 to P497 (earlier versions) P498 to P501 (Access review, request emails, activity export) P502 to P504 (Keep for, legal hold) P523 to P528 (the page made over) P530 to P535 (a file’s page) P536 to P538 (the public pages), P539, P551 and P552 (moving and bringing in files), P553 and P554 (reviewing held files), P555 (the folder's one row on a phone), P556 to P558 (the details panel), P563-P564, P567-P569, P576-P601 (titles to Supabase storage).

### The flows fixed on 15 November

Owed together in [their own list](phone-tests-flows.md), P251 to P294.

### The Apps page

Owed in [their own list](phone-tests-apps.md), P376-P385, P468-P474, P512-P514, P797-P798, P910-P916, P930-P947.

### Alerts, audit and errors

From [record](../archive/records/2026-11-03-error-log.md):

| # | Open | You should see |
|---|---|---|
| P13 | Alerts | open alerts, the worst first; a server error listed with where, how often and its stack |

From [record](../archive/records/2026-10-21-audit-seal-and-export.md):

| # | Open | You should see |
|---|---|---|
| P14 | Audit log, filter, Download | the list, the filters as chips; the file downloads on the phone |

### Email and Mail

Owed in their own list, [Phone tests owed: Email and Mail](phone-tests-email.md), kept apart so
each list stays small enough to read whole.

### Work modules

From [record](../archive/records/2026-10-27-tasks-module.md):

| # | Open | You should see |
|---|---|---|
| P18 | Tasks: make one, mark it done | it shows on Home's Needs you, then leaves |

From [record](../archive/records/2026-10-27-files-module.md):

| # | Open | You should see |
|---|---|---|
| P19 | Files: upload a photo, share a link | the upload from the camera roll, the link copied |

From [record](../archive/records/2026-10-27-expenses-module.md):

| # | Open | You should see |
|---|---|---|
| P20 | Expenses: add one with a receipt photo | the camera opens; the claim goes to approval |

From [approvals](../archive/records/2026-10-27-approvals-module.md), [announcements](../archive/records/2026-10-27-announcements-module.md), [equipment](../archive/records/2026-10-27-assets-module.md):

| # | Open | You should see |
|---|---|---|
| P21 | Approvals, Announcements, Equipment | each list and form fits; a decision is two taps |

From [bookings](../archive/records/2026-10-27-bookings-module.md), [time clock](../archive/records/2026-10-27-timeclock-module.md), [shifts](../archive/records/2026-10-27-shifts-module.md):

| # | Open | You should see |
|---|---|---|
| P22 | Bookings, Time off, Time clock, Shifts | the week or day views fit; clock in and out in one tap each |

From [quotes](../archive/records/2026-10-27-quotes-module.md), [invoices](../archive/records/2026-10-27-invoices-module.md):

| # | Open | You should see |
|---|---|---|
| P23 | Quotes and Invoices: make one, send it | the lines readable; the customer's page shows it |

From [record](../archive/records/2026-10-27-privacy-module.md):

| # | Open | You should see |
|---|---|---|
| P24 | Privacy: search an address | the rows found, grouped by module |

### Customers

From [sign-in](../archive/records/2026-10-27-customer-sign-in.md), [sections](../archive/records/2026-10-27-customer-account-sections.md):

| # | Open | You should see |
|---|---|---|
| P25 | The customer sign-in page, as a customer | the code arrives by email; the account page lists their sections |

From [record](../archive/records/2026-10-27-files-shared-with-customers.md):

| # | Open | You should see |
|---|---|---|
| P26 | A customer's account, Files | the files shared with them open |

## Passed

None yet. A line moves here with the date it passed and the phone it was run on.

## Failed, to fix

None yet.
