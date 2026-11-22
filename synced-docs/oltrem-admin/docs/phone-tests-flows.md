---
title: "Phone tests owed: the flows fixed on 15 November"
status: living
owner: vendor
last_verified: 2026-11-22
sources: [docs/records/2026-11-15-flows-fixed.md; docs/records/2026-11-21-safer-and-calmer.md; docs/records/2026-11-22-audit-log-fuller.md; docs/records/2026-11-22-connect-apps.md; docs/records/2026-11-22-smooth-phone-frame.md; docs/records/2026-11-22-calm-and-modern.md; docs/records/2026-11-22-starting-setup-and-imports.md]
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

### Connect apps, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P325 | The sidebar, Work, Connect apps | Four tabs in one sideways row: Chat alerts, Calendar, Spreadsheets, and “Make, Zapier, n8n”; each service a card with its logo (Teams, Outlook and Excel a plain icon) | [record](records/2026-11-22-connect-apps.md) |
| P326 | Chat alerts, Slack; paste a link from Slack (Incoming Webhooks), Connect Slack | Slack is connected; a test line arrives in the channel; Your chat alerts lists it as Working | [record](records/2026-11-22-connect-apps.md) |
| P327 | Chat alerts, Discord; paste any web address that is not Discord's | Refused: that is not a Discord address, with the start of the right one | [record](records/2026-11-22-connect-apps.md) |
| P328 | Calendar, Create my calendar link, then Add to Google Calendar (or Apple Calendar on an iPhone) | The calendar app asks to add it; your bookings, shifts, days off and due tasks show there within a day | [record](records/2026-11-22-connect-apps.md) |
| P329 | Spreadsheets, pick Invoices, Create a spreadsheet link; in a new Google Sheet paste the cell into A1 | The invoices fill the sheet; Your spreadsheet links shows it, Last used once the sheet read it | [record](records/2026-11-22-connect-apps.md) |
| P330 | The same link, Delete link, then refresh the sheet | The dialog asks first; the sheet shows the link no longer works | [record](records/2026-11-22-connect-apps.md) |
| P331 | As a person whose role lacks Share live spreadsheets, Spreadsheets | Ask an Owner, and no Create button; the Calendar tab still works for them | [record](records/2026-11-22-connect-apps.md) |

### A frame that never moves, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P332 | Email settings: tap each tab in turn, then back | The title and the row of tabs never move; a tab's buttons sit under the tabs; the row does not scroll by itself while the tab you tapped is in view | [record](records/2026-11-22-smooth-phone-frame.md) |
| P333 | Any two pages from the sidebar | The content fades in quickly; nothing slides, blurs or rises in one part after another | [record](records/2026-11-22-smooth-phone-frame.md) |
| P334 | Modules: scroll to the foot and back, tick a few boxes, Save | Scrolling is smooth; the top bar is solid, nothing shows through it; after Save the page fades back once | [record](records/2026-11-22-smooth-phone-frame.md) |
| P335 | Audit log: open a row's Details that shows an address | Everything stays inside the screen, the Done tag too; the page never slides sideways and its scroll does not jump | [record](records/2026-11-22-smooth-phone-frame.md) |
| P336 | Any page on the phone | The title is small (the size of the top bar's name), the tabs and content start higher | [record](records/2026-11-22-smooth-phone-frame.md) |

### Calm and modern, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P337 | Modules, light and dark | A plain page, no colour wash; the chips small rounded squares; Save a flat button; no coloured bar before Work | [record](records/2026-11-22-calm-and-modern.md) |
| P338 | System status | Its figures as plain numbers in a row (16 Checks, 14 OK…), no boxes; a state a dot and a word | [record](records/2026-11-22-calm-and-modern.md) |
| P339 | Email settings, Integrations, then Addresses | Find from a domain and Connect sit under the tabs; switching tabs never moves the title or the tabs | [record](records/2026-11-22-calm-and-modern.md) |
| P340 | Audit log | Each row's Done is a green dot and the word; the marked tab is underlined with no box behind it | [record](records/2026-11-22-calm-and-modern.md) |

### Starting setup and imports, 22 November

| # | Open | You should see | From |
|---|---|---|---|
| P341 | As the Owner of a new portal, Home | Get started's first step is Set up for your business; it opens the page (on a portal whose modules were saved before, the step is already ticked) | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P342 | Set up for your business; tap Shop, then Office | The kinds in one sideways row; each tap shows in words the modules it switches off, the roles and the list it makes | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P343 | Pick a kind, press Set up the portal for this | "The portal is set up for your business"; Modules shows the ones switched off; Roles has Full admin above Standard user; Records has the starter list; Next steps offer Add your locations | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P344 | Customers, Import from a spreadsheet; choose a CSV file with Email and Name columns | How many customers were added and how many skipped as customers already; nobody gets an email | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P345 | Users, Invite people; leave the box empty, choose a CSV file of addresses, Send invitations | "N addresses found": the addresses fill the box and nobody is invited yet; pick the role and send again to invite them | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P346 | Admin, Settings, Features, Reports, switch on Monday summary | The switch stays on after the page reloads | [record](records/2026-11-22-starting-setup-and-imports.md) |
| P347 | Your inbox on the Monday after, from 01:00 UTC, on a portal with work done in the last two weeks | "Last week at" the company: the work done last week against the week before, and how to switch it off | [record](records/2026-11-22-starting-setup-and-imports.md) |

### Five groups and plain names, 22 November

The rows above this section use the names of their day: Records is now Lists, Modules Features,
Bulk mail Campaigns, Analytics Reports, System status Status, Connect apps Apps, and
Integrations (the email keys) Email services, under Admin, Integrations.

| # | Open | You should see | From |
|---|---|---|---|
| P354 | The sidebar | Home, then Customers, Work, Team, Email and Admin, Admin last; each group in its own colour | [record](records/2026-11-22-five-groups-and-names.md) |
| P355 | Admin, Integrations | Three tabs: Apps, Email services, Developer; each opens its page | [record](records/2026-11-22-five-groups-and-names.md) |
| P356 | Admin, System | Five tabs: Status, Alerts, Backups, Deployments, Audit log | [record](records/2026-11-22-five-groups-and-names.md) |
| P357 | Admin, Settings | Three tabs: Settings, Features, Set up for your business; Features lists the modules under the five groups | [record](records/2026-11-22-five-groups-and-names.md) |
| P358 | An old bookmark (/records, /settings/parts, /providers) | Each opens, under its new name: Lists, Features, Email services | [record](records/2026-11-22-five-groups-and-names.md) |
| P359 | Forms (or Users and access, Roles) on the phone, dark, with your Aurora look | No darker strip behind the title; Create form is a compact button beside the title, nothing past an edge | [record](records/2026-11-22-calm-and-modern.md) |
| P360 | Look, Aurora, then any page | The background is a faint glow, no patches or blotches behind the content | [record](records/2026-11-22-calm-and-modern.md) |
