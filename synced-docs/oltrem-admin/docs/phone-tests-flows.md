---
title: "Phone tests owed: the flows fixed on 15 November"
status: living
owner: vendor
last_verified: 2026-11-21
sources: [docs/records/2026-11-15-flows-fixed.md; docs/records/2026-11-21-safer-and-calmer.md]
---

# Phone tests owed: the flows fixed on 15 November

> **In plain words.** The phone tests owed on every journey the flow audits of 15 November fixed,
> kept together so they can be run in one sitting. They run the same way as
> [Phone tests owed](phone-tests.md), and a passed or failed line moves to "Passed" or
> "Failed, to fix" with the date.

## Owed

### Every form

| # | Open | You should see | From |
|---|---|---|---|
| P251 | Tasks: New task, type a title, give it to an address nobody has, press Make it | The dialog opens again with the reason at its top and everything typed still there; reloading the page shows Tasks, not an error | [record](records/2026-11-15-flows-fixed.md) |

### People and access

| # | Open | You should see | From |
|---|---|---|---|
| P252 | People: Invite someone who already has an account, then the same address twice | Refused each time with the reason; the address stays in the field | [record](records/2026-11-15-flows-fixed.md) |
| P253 | People: invite someone new | Queued for email to them, not Emailed; the invitation has Send again, Copy link and Revoke (Revoke asks first) | [record](records/2026-11-15-flows-fixed.md) |
| P254 | Open an invitation link and press Accept | Home says You joined; opening the same link again explains it was used, with no Accept | [record](records/2026-11-15-flows-fixed.md) |
| P255 | Access, Locations: rename a place to the name of its sibling | Refused: two places side by side need different names | [record](records/2026-11-15-flows-fixed.md) |
| P256 | Access, as the Vendor: open My access | Your access, read only, with nothing to change by mistake | [record](records/2026-11-15-flows-fixed.md) |
| P257 | Access: Make someone an Owner | A dialog asks first | [record](records/2026-11-15-flows-fixed.md) |
| P258 | Settings: change two values, one of them wrong, and save | The reason names the wrong one and both typed values are kept | [record](records/2026-11-15-flows-fixed.md) |
| P259 | Delivery log: a message that is being tried again | Trying again, with the last try's time | [record](records/2026-11-15-flows-fixed.md) |

### Work

| # | Open | You should see | From |
|---|---|---|---|
| P260 | Bookings: pick a room, choose Fri, book a taken time | The refusal stays on Fri, not Today; Another day picks a later day, shown as its own chip | [record](records/2026-11-15-flows-fixed.md) |
| P261 | Approvals, as the only Owner: ask for a yes, open it | You answer this one yourself, with Approve; Approve asks first, then it is approved | [record](records/2026-11-15-flows-fixed.md) |
| P262 | Tasks, Mine: New task, Give it to me, Make it (also as the Vendor) | The task is yours, under Mine | [record](records/2026-11-15-flows-fixed.md) |
| P263 | Automations: Send an email, tick A website form is answered, fill To, Subject and Message, keep Switch it on now, Make it | It lands on the automation, on, with a done notice; with a value missing, Run now is greyed | [record](records/2026-11-15-flows-fixed.md) |
| P264 | Files: Make a link on a file | A Copy button beside the link | [record](records/2026-11-15-flows-fixed.md) |
| P265 | Files: Share with the customer, to an address that is no customer | Refused, with a link to Customers; to a customer, the notice says the email is queued | [record](records/2026-11-15-flows-fixed.md) |
| P266 | Files: move a file to the trash | It is in the trash, the days it is kept, and Undo; Undo brings it back | [record](records/2026-11-15-flows-fixed.md) |
| P267 | Analytics | Areas and Most frequent in words; tapping Refused or failed opens the audit log filtered | [record](records/2026-11-15-flows-fixed.md) |

### Team and sales

| # | Open | You should see | From |
|---|---|---|---|
| P268 | Quotes: a draft for an address that is no customer, then Send | That address is not a customer yet, with Add them; Send is refused the same way | [record](records/2026-11-15-flows-fixed.md) |
| P269 | Quotes: a quote the customer accepted | Make the invoice, opening a filled invoice; after it is sent, Open invoice N instead, and the quote is not offered again | [record](records/2026-11-15-flows-fixed.md) |
| P270 | Quotes or Invoices: Send, then Email it again | The email is queued, not emailed; with no email service, it says it waits for one, with Email settings | [record](records/2026-11-15-flows-fixed.md) |
| P271 | Time off, Expenses, Time clock, as the only Owner: your own request, claim or hours | Approve, Mark paid and Fix the times work for you; nobody is emailed about your own answer | [record](records/2026-11-15-flows-fixed.md) |
| P272 | Shifts: plan a shift for yourself | You land on that week with the draft and Publish the week (1); the publish dialog offers only places with drafts | [record](records/2026-11-15-flows-fixed.md) |
| P273 | Shifts, Equipment, Time clock: an address field | The company's people suggested, you first; an unknown address is refused with Invite the person | [record](records/2026-11-15-flows-fixed.md) |
| P274 | Time off on days already asked for; a customer who exists; an equipment tag in use | Each refusal links what it clashes with | [record](records/2026-11-15-flows-fixed.md) |
| P275 | Customers: open a customer with quotes | Their quotes and invoices, newest five, with Make a quote for them | [record](records/2026-11-15-flows-fixed.md) |
| P276 | Privacy: a Delete their data request, Find their data, then It is them | Links to their quotes and invoices, plain words on what cannot be erased; the results stay after It is them | [record](records/2026-11-15-flows-fixed.md) |
| P277 | As a customer on /account: Decline an open quote | Are you sure? Your answer is final, then Yes, decline | [record](records/2026-11-15-flows-fixed.md) |
| P278 | Expenses: claim with a file that is not a photo or PDF | The claim is kept and the notice says the receipt was not | [record](records/2026-11-15-flows-fixed.md) |

### Alerts, Developer, Backups, Deployments

| # | Open | You should see | From |
|---|---|---|---|
| P279 | Alerts: an error alert | A plain title, the detail folded under Details, and Mark resolved | [record](records/2026-11-15-flows-fixed.md) |
| P280 | Developer: a job that is off, a webhook refreshed twice within a minute | The job reads Off with no Check again now; the second refresh is refused | [record](records/2026-11-15-flows-fixed.md) |
| P281 | Backups on a new portal | Database greyed with its reason; no false alert | [record](records/2026-11-15-flows-fixed.md) |
| P282 | Deployments | From reads Computer, Fleet or the commit | [record](records/2026-11-15-flows-fixed.md) |
| P283 | Get started, when the last email check failed | Email is not ticked | [record](records/2026-11-15-flows-fixed.md) |
| P284 | Settings, Modules: untick Customers | Quotes and Invoices switch off with it, and the page says so | [record](records/2026-11-15-flows-fixed.md) |

### Email and campaigns

| # | Open | You should see | From |
|---|---|---|---|
| P285 | Campaigns, as the only Owner and approver: a draft over the approval limit, step 4 | Send it; the dialog says your yes is recorded as the approval, and it starts | [record](records/2026-11-15-flows-fixed.md) |
| P286 | Email settings, Setup: a new address and a wrong key, Connect | The new address stays; the key was refused and nothing changed; the old service still sends | [record](records/2026-11-15-flows-fixed.md) |
| P287 | A campaign's Message: a subject too long, Save | Subject and words are still there | [record](records/2026-11-15-flows-fixed.md) |
| P288 | Lists: Paste addresses with not an address | The text stays; the words name the addresses, no CSV advice | [record](records/2026-11-15-flows-fixed.md) |
| P289 | Setup: a failed test or reports line, Try again | That line is checked again | [record](records/2026-11-15-flows-fixed.md) |
| P290 | A sent campaign's not heard notice: Register delivery reports | Setup's Delivery reports, registered in one press | [record](records/2026-11-15-flows-fixed.md) |
| P291 | A draft's From, with a sender whose domain is not passing | It waits for its domain to pass its check, linked to the domain | [record](records/2026-11-15-flows-fixed.md) |
| P292 | Write, or Send me a test, with no working service | One sentence: it waits (or fails if the key failed); the test is queued, with Delivery log and Email settings | [record](records/2026-11-15-flows-fixed.md) |
| P293 | Lists, Contacts: Remove | A dialog asks first | [record](records/2026-11-15-flows-fixed.md) |
| P294 | A broken unsubscribe link | A small page saying the link is no longer known and what to do | [record](records/2026-11-15-flows-fixed.md) |

### Finished on 20 November

| # | Open | You should see | From |
|---|---|---|---|
| P295 | As the only Owner: Approvals, Ask for a yes, then For you, and Home | Your own request is in For you, counted, and Home's Needs you says 1 request waits for your answer | [record](records/2026-11-20-left-items-finished.md) |
| P296 | Alerts, signed in as someone who may only read them | No I am on it and no Mark resolved; an alert nobody took says Nobody yet | [record](records/2026-11-20-left-items-finished.md) |
| P297 | Settings, Company: a time zone (as America/Mexico_City), then Automations, New automation, On a schedule | The time field reads At (America/Mexico_City); a made automation says every day at 08:00 America/Mexico_City, and its next run is 08:00 there | [record](records/2026-11-20-left-items-finished.md) |
| P298 | The same time zone, then a campaign's Pace | The sending hours name America/Mexico_City | [record](records/2026-11-20-left-items-finished.md) |

### Fuller audit log, 20 November

| # | Open | You should see | From |
|---|---|---|---|

## Passed

None yet.

## Failed, to fix

None yet.

### The codebase review, 20 November

| # | Open | You should see | From |
|---|---|---|---|
| P302 | Mail setup: press Send test | An answer within about 15 seconds: ready, or the next step to take | [record](records/2026-11-20-codebase-review.md) |
| P303 | Expenses, Invoices and Quotes: open one with an amount in a currency other than yours | Amounts and currencies as before | [record](records/2026-11-20-codebase-review.md) |
| P304 | Users, the Roles and Access tabs, then one role | Every list and button as before | [record](records/2026-11-20-codebase-review.md) |
| P305 | Settings and System status: switches, check boxes, a select and a progress bar | They look as before | [record](records/2026-11-20-codebase-review.md) |
| P306 | System status | Files storage, Campaign reputation and the email allowance checks are listed and green | [record](records/2026-11-20-codebase-review.md) |
| P307 | Email's inbox: archive or delete every message of one conversation, then come back after an hour | The conversation is gone from every box | [record](records/2026-11-20-codebase-review.md) |

### Your two picks, 21 November

| # | Open | You should see | From |
|---|---|---|---|
| P308 | Settings, Modules, Access | Ending access emails and Access review reminder stay as you left them on your portal; a portal set up from now on shows both off | [log](verification-log.md) |
| P309 | Email, Sent, after an email Brevo or Cloudflare gave no clear answer for | It reads May have been sent, not Failed, and was sent once only | [log](verification-log.md) |

### Safer and calmer, 21 November

| # | Open | You should see | From |
|---|---|---|---|
| P310 | Settings, Modules | Sign-in alerts, Unusual sign-ins, What changed card and Service status are off; everything else as you left it | [record](records/2026-11-21-safer-and-calmer.md) |
| P311 | Switch Sign-in alerts on, then sign in from another browser | An email naming that browser, your country and the time, with Sign out everywhere | [record](records/2026-11-21-safer-and-calmer.md) |
| P312 | My access, Your sign-ins | Each browser signed in as you, this one marked; Sign out everywhere asks first, then signs you out | [record](records/2026-11-21-safer-and-calmer.md) |
| P313 | Users, Signed in today, as the Owner | Who signed in in the last day, from which browser and country, the refused addresses, and Sign everyone else out behind a dialog | [record](records/2026-11-21-safer-and-calmer.md) |
| P314 | Switch Unusual sign-ins on; System status | Unusual sign-ins is listed and OK | [record](records/2026-11-21-safer-and-calmer.md) |
| P315 | Settings, Files, Allowed types: documents; then upload a photo in Files | Refused: This kind of file is not allowed here; set back to any, the photo uploads | [record](records/2026-11-21-safer-and-calmer.md) |
| P316 | Files, share a file with a passcode and your email address; open the link from the email | The email names the file and says a passcode is asked; a wrong passcode asks again; the right one downloads | [record](records/2026-11-21-safer-and-calmer.md) |
| P317 | Developer, Jobs | Each job shows its last 24 hours; Check for work on the trash job (Deletes for good what has been in the trash…) says what waits and deletes nothing | [record](records/2026-11-21-safer-and-calmer.md) |
| P318 | Switch What changed card on; Home | What others changed since you last looked; Mark as seen leaves Nobody else changed anything | [record](records/2026-11-21-safer-and-calmer.md) |
| P319 | Forms, Try the form and send an answer; then the inbox | The answer is bold and Unread (1); open it and go back, it is plain; Mark unread makes it bold again | [record](records/2026-11-21-safer-and-calmer.md) |
| P320 | Switch Service status on; System status, Check again now | Service status is listed, naming Cloudflare and your email service | [record](records/2026-11-21-safer-and-calmer.md) |
| P321 | Change a task's title and due day, then Audit log | The row's To what is the task's old title; Details shows Title: old → new and Due on: old → new, and the address, country and browser it came from | [record](records/2026-11-22-audit-log-fuller.md) |
| P322 | Change a customer's name and note, then Audit log | To what is Customer and the start of their id, never their name; Details shows Name and Note: Changed (the value is not kept) | [record](records/2026-11-22-audit-log-fuller.md) |
| P323 | Edit a role (rename it, add a permission), then Audit log | To what is the role's old name; Details shows Name: old → new and Added: the permission | [record](records/2026-11-22-audit-log-fuller.md) |
| P324 | On a new portal, as an Owner, with a grant of someone else ending this week, open Home | Needs you says 1 person's access ends this week; a review is due after 90 days without one | [record](records/2026-11-22-audit-log-fuller.md) |
