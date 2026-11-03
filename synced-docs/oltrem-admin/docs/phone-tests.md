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

### Lists and saved views

| # | Open | You should see | From |
|---|---|---|---|
| P6 | Tasks, pick "Open", name it, Save view | a chip with the name above the list; tapping All and back to it works; Remove takes it away | [record](records/2026-11-03-saved-views.md) |
| P7 | A records list, filter by a choice | the filters and the list fit; the save field sits under the chips | [record](records/2026-11-03-saved-views.md) |

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
| P28 | A deployed portal with Mail: add a mailbox, write to it from your own email, open it, reply | it arrives within a minute or two; your reply reaches you from the mailbox's address | [record](records/2026-11-02-oltrem-mail-inbox.md) |

The Mail add-on's own owed tests (its bundles A, B, C, F and L) are listed in Oltrem Mail's
documents, packed in [vendor/mail](../vendor/mail/README.md); they are run with a domain on the
Cloudflare route.

## Passed

None yet. A line moves here with the date it passed and the phone it was run on.

## Failed, to fix

None yet.
