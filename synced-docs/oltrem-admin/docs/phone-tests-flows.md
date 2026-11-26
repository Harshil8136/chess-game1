---
title: "Phone tests owed: the flows fixed on 15 November"
status: living
owner: vendor
last_verified: 2026-11-22
sources: [archive/records/2026-11-15-flows-fixed.md; archive/records/2026-11-21-safer-and-calmer.md; archive/records/2026-11-22-audit-log-fuller.md; archive/records/2026-11-22-first-run-and-home.md; archive/records/2026-11-22-connect-apps.md; archive/records/2026-11-22-smooth-phone-frame.md; archive/records/2026-11-22-calm-and-modern.md; archive/records/2026-11-22-starting-setup-and-imports.md; archive/records/2026-11-22-connected-data-pages.md]
---

# Phone tests owed: the flows fixed on 15 November

> **In plain words.** The phone tests owed on every journey the flow audits of 15 November fixed,
> kept together so they can be run in one sitting. They run the same way as
> [Phone tests owed](phone-tests.md), and a passed or failed line moves to "Passed" or
> "Failed, to fix" with the date.

## Owed

### Every form

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P251 | Tasks: New task, type a title, give it to an address nobody has, press Make it | The dialog opens again with the reason at its top and everything typed still there; reloading the page shows Tasks, not an error |

### People and access

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P252 | People: Invite someone who already has an account, then the same address twice | Refused each time with the reason; the address stays in the field |
| P253 | People: invite someone new | Queued for email to them, not Emailed; the invitation has Send again, Copy link and Revoke (Revoke asks first) |
| P254 | Open an invitation link and press Accept | Home says You joined; opening the same link again explains it was used, with no Accept |
| P255 | Access, Locations: rename a place to the name of its sibling | Refused: two places side by side need different names |
| P256 | Access, as the Vendor: open My access | Your access, read only, with nothing to change by mistake |
| P257 | Access: Make someone an Owner | A dialog asks first |
| P258 | Settings: change two values, one of them wrong, and save | The reason names the wrong one and both typed values are kept |
| P259 | Delivery log: a message that is being tried again | Trying again, with the last try's time |

### Work

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P260 | Bookings: pick a room, choose Fri, book a taken time | The refusal stays on Fri, not Today; Another day picks a later day, shown as its own chip |
| P261 | Approvals, as the only Owner: ask for a yes, open it | You answer this one yourself, with Approve; Approve asks first, then it is approved |
| P262 | Tasks, Mine: New task, Give it to me, Make it (also as the Vendor) | The task is yours, under Mine |
| P263 | Automations: Send an email, tick A website form is answered, fill To, Subject and Message, keep Switch it on now, Make it | It lands on the automation, on, with a done notice; with a value missing, Run now is greyed |
| P264 | Files: Make a link on a file | A Copy button beside the link |
| P265 | Files: Share with the customer, to an address that is no customer | Refused, with a link to Customers; to a customer, the notice says the email is queued |
| P266 | Files: move a file to the trash | It is in the trash, the days it is kept, and Undo; Undo brings it back |
| P267 | Analytics | Areas and Most frequent in words; tapping Refused or failed opens the audit log filtered |

### Team and sales

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P268 | Quotes: a draft for an address that is no customer, then Send | That address is not a customer yet, with Add them; Send is refused the same way |
| P269 | Quotes: a quote the customer accepted | Make the invoice, opening a filled invoice; after it is sent, Open invoice N instead, and the quote is not offered again |
| P270 | Quotes or Invoices: Send, then Email it again | The email is queued, not emailed; with no email service, it says it waits for one, with Email settings |
| P271 | Time off, Expenses, Time clock, as the only Owner: your own request, claim or hours | Approve, Mark paid and Fix the times work for you; nobody is emailed about your own answer |
| P272 | Shifts: plan a shift for yourself | You land on that week with the draft and Publish the week (1); the publish dialog offers only places with drafts |
| P273 | Shifts, Equipment, Time clock: an address field | The company's people suggested, you first; an unknown address is refused with Invite the person |
| P274 | Time off on days already asked for; a customer who exists; an equipment tag in use | Each refusal links what it clashes with |
| P275 | Customers: open a customer with quotes | Their quotes and invoices, newest five, with Make a quote for them |
| P276 | Privacy: a Delete their data request, Find their data, then It is them | Links to their quotes and invoices, plain words on what cannot be erased; the results stay after It is them |
| P277 | As a customer on /account: Decline an open quote | Are you sure? Your answer is final, then Yes, decline |
| P278 | Expenses: claim with a file that is not a photo or PDF | The claim is kept and the notice says the receipt was not |

### Alerts, Developer, Backups, Deployments

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P279 | Alerts: an error alert | A plain title, the detail folded under Details, and Mark resolved |
| P280 | Developer: a job that is off, a webhook refreshed twice within a minute | The job reads Off with no Check again now; the second refresh is refused |
| P281 | Backups on a new portal | Database greyed with its reason; no false alert |
| P282 | Deployments | From reads Computer, Fleet or the commit |
| P283 | Get started, when the last email check failed | Email is not ticked |
| P284 | Settings, Modules: untick Customers | Quotes and Invoices switch off with it, and the page says so |

### Email and campaigns

From [record](../archive/records/2026-11-15-flows-fixed.md):

| # | Open | You should see |
|---|---|---|
| P285 | Campaigns, as the only Owner and approver: a draft over the approval limit, step 4 | Send it; the dialog says your yes is recorded as the approval, and it starts |
| P286 | Email settings, Setup: a new address and a wrong key, Connect | The new address stays; the key was refused and nothing changed; the old service still sends |
| P287 | A campaign's Message: a subject too long, Save | Subject and words are still there |
| P288 | Lists: Paste addresses with not an address | The text stays; the words name the addresses, no CSV advice |
| P289 | Setup: a failed test or reports line, Try again | That line is checked again |
| P290 | A sent campaign's not heard notice: Register delivery reports | Setup's Delivery reports, registered in one press |
| P291 | A draft's From, with a sender whose domain is not passing | It waits for its domain to pass its check, linked to the domain |
| P292 | Write, or Send me a test, with no working service | One sentence: it waits (or fails if the key failed); the test is queued, with Delivery log and Email settings |
| P293 | Lists, Contacts: Remove | A dialog asks first |
| P294 | A broken unsubscribe link | A small page saying the link is no longer known and what to do |

### Finished on 20 November

From [record](../archive/records/2026-11-20-left-items-finished.md):

| # | Open | You should see |
|---|---|---|
| P295 | As the only Owner: Approvals, Ask for a yes, then For you, and Home | Your own request is in For you, counted, and Home's Needs you says 1 request waits for your answer |
| P296 | Alerts, signed in as someone who may only read them | No I am on it and no Mark resolved; an alert nobody took says Nobody yet |
| P297 | Settings, Company: a time zone (as America/Mexico_City), then Automations, New automation, On a schedule | The time field reads At (America/Mexico_City); a made automation says every day at 08:00 America/Mexico_City, and its next run is 08:00 there |
| P298 | The same time zone, then a campaign's Pace | The sending hours name America/Mexico_City |

### Fuller audit log, 20 November

## Passed

None yet.

## Failed, to fix

None yet.

### The codebase review, 20 November

From [record](../archive/records/2026-11-20-codebase-review.md):

| # | Open | You should see |
|---|---|---|
| P302 | Mail setup: press Send test | An answer within about 15 seconds: ready, or the next step to take |
| P303 | Expenses, Invoices and Quotes: open one with an amount in a currency other than yours | Amounts and currencies as before |
| P304 | Users, the Roles and Access tabs, then one role | Every list and button as before |
| P305 | Settings and System status: switches, check boxes, a select and a progress bar | They look as before |
| P306 | System status | Files storage, Campaign reputation and the email allowance checks are listed and green |
| P307 | Email's inbox: archive or delete every message of one conversation, then come back after an hour | The conversation is gone from every box |

### Your two picks, 21 November

From [log](../archive/records/2026-11-25-to-26-verification-log.md):

| # | Open | You should see |
|---|---|---|
| P308 | Settings, Modules, Access | Ending access emails and Access review reminder stay as you left them on your portal; a portal set up from now on shows both off |
| P309 | Email, Sent, after an email Brevo or Cloudflare gave no clear answer for | It reads May have been sent, not Failed, and was sent once only |

### Safer and calmer, 21 November

From [record](../archive/records/2026-11-21-safer-and-calmer.md):

| # | Open | You should see |
|---|---|---|
| P310 | Settings, Modules | Sign-in alerts, Unusual sign-ins, What changed card and Service status are off; everything else as you left it |
| P311 | Switch Sign-in alerts on, then sign in from another browser | An email naming that browser, your country and the time, with Sign out everywhere |
| P312 | My access, Your sign-ins | Each browser signed in as you, this one marked; Sign out everywhere asks first, then signs you out |
| P313 | Users, Signed in today, as the Owner | Who signed in in the last day, from which browser and country, the refused addresses, and Sign everyone else out behind a dialog |
| P314 | Switch Unusual sign-ins on; System status | Unusual sign-ins is listed and OK |
| P315 | Settings, Files, Allowed types: documents; then upload a photo in Files | Refused: This kind of file is not allowed here; set back to any, the photo uploads |
| P316 | Files, share a file with a passcode and your email address; open the link from the email | The email names the file and says a passcode is asked; a wrong passcode asks again; the right one downloads |
| P317 | Admin, Scheduled jobs, the trash job | Each job shows its last 24 hours; Check for work on the trash job (Deletes for good what has been in the trash…) says what waits and deletes nothing |
| P318 | Switch What changed card on; Home | What others changed since you last looked; Mark as seen leaves Nobody else changed anything |
| P319 | Forms, Try the form and send an answer; then the inbox | The answer is bold and Unread (1); open it and go back, it is plain; Mark unread makes it bold again |
| P320 | Switch Service status on; System status, Check again now | Service status is listed, naming Cloudflare and your email service |

From [record](../archive/records/2026-11-22-audit-log-fuller.md):

| # | Open | You should see |
|---|---|---|
| P321 | Change a task's title and due day, then Audit log | The row's To what is the task's old title; Details shows Title: old → new and Due on: old → new, and the address, country and browser it came from |
| P322 | Change a customer's name and note, then Audit log | To what is Customer and the start of their id, never their name; Details shows Name and Note: Changed (the value is not kept) |
| P323 | Edit a role (rename it, add a permission), then Audit log | To what is the role's old name; Details shows Name: old → new and Added: the permission |
| P324 | On a new portal, as an Owner, with a grant of someone else ending this week, open Home | Needs you says 1 person's access ends this week; a review is due after 90 days without one |

### Connect apps, 22 November

From [record](../archive/records/2026-11-22-connect-apps.md):

| # | Open | You should see |
|---|---|---|
| P325 | The sidebar, Work, Connect apps | Four tabs in one sideways row: Chat alerts, Calendar, Spreadsheets, and “Make, Zapier, n8n”; each service a card with its logo (Teams, Outlook and Excel a plain icon) |
| P326 | Chat alerts, Slack; paste a link from Slack (Incoming Webhooks), Connect Slack | Slack is connected; a test line arrives in the channel; Your chat alerts lists it as Working |
| P327 | Chat alerts, Discord; paste any web address that is not Discord's | Refused: that is not a Discord address, with the start of the right one |
| P328 | Calendar, Create my calendar link, then Add to Google Calendar (or Apple Calendar on an iPhone) | The calendar app asks to add it; your bookings, shifts, days off and due tasks show there within a day |
| P329 | Spreadsheets, pick Invoices, Create a spreadsheet link; in a new Google Sheet paste the cell into A1 | The invoices fill the sheet; Your spreadsheet links shows it, Last used once the sheet read it |
| P330 | The same link, Delete link, then refresh the sheet | The dialog asks first; the sheet shows the link no longer works |
| P331 | As a person whose role lacks Share live spreadsheets, Spreadsheets | Ask an Owner, and no Create button; the Calendar tab still works for them |

### A frame that never moves, 22 November

From [record](../archive/records/2026-11-22-smooth-phone-frame.md):

| # | Open | You should see |
|---|---|---|
| P332 | Email settings: tap each tab in turn, then back | The title and the row of tabs never move; a tab's buttons sit under the tabs; the row does not scroll by itself while the tab you tapped is in view |
| P333 | Any two pages from the sidebar | The content fades in quickly; nothing slides, blurs or rises in one part after another |
| P334 | Modules: scroll to the foot and back, tick a few boxes, Save | Scrolling is smooth; the top bar is solid, nothing shows through it; after Save the page fades back once |
| P335 | Audit log: open a row's Details that shows an address | Everything stays inside the screen, the Done tag too; the page never slides sideways and its scroll does not jump |
| P336 | Any page on the phone | The title is small (the size of the top bar's name), the tabs and content start higher |

### Calm and modern, 22 November

From [record](../archive/records/2026-11-22-calm-and-modern.md):

| # | Open | You should see |
|---|---|---|
| P337 | Modules, light and dark | A plain page, no colour wash; the chips small rounded squares; Save a flat button; no coloured bar before Work |
| P338 | System status | Its figures as plain numbers in a row (16 Checks, 14 OK…), no boxes; a state a dot and a word |
| P339 | Email settings, Integrations, then Addresses | Find from a domain and Connect sit under the tabs; switching tabs never moves the title or the tabs |
| P340 | Audit log | Each row's Done is a green dot and the word; the marked tab is underlined with no box behind it |

### Starting setup and imports, 22 November

From [record](../archive/records/2026-11-22-starting-setup-and-imports.md):

| # | Open | You should see |
|---|---|---|
| P341 | As the Owner of a new portal, Home | Get started's first step is Set up for your business; it opens the page (on a portal whose modules were saved before, the step is already ticked) |
| P342 | Set up for your business; tap Shop, then Office | The kinds in one sideways row; each tap shows in words the modules it switches off, the roles and the list it makes |
| P343 | Pick a kind, press Set up the portal for this | "The portal is set up for your business"; Modules shows the ones switched off; Roles has Admin above Member; Records has the starter list; Next steps offer Add your locations |
| P344 | Customers, Import from a spreadsheet; choose a CSV file with Email and Name columns | How many customers were added and how many skipped as customers already; nobody gets an email |
| P345 | Users, Invite people; leave the box empty, choose a CSV file of addresses, Send invitations | "N addresses found": the addresses fill the box and nobody is invited yet; pick the role and send again to invite them |
| P346 | Admin, Settings, Features, Reports, switch on Monday summary | The switch stays on after the page reloads |
| P347 | Your inbox on the Monday after, from 01:00 UTC, on a portal with work done in the last two weeks | "Last week at" the company: the work done last week against the week before, and how to switch it off |

### Five groups and plain names, 22 November

The rows above this section use the names of their day: Records is now Lists, Modules Features,
Bulk mail Campaigns, Analytics Reports, System status Status, Connect apps Apps, and
Integrations (the email keys) Email services, under Admin, Integrations.

From [record](../archive/records/2026-11-22-five-groups-and-names.md):

| # | Open | You should see |
|---|---|---|
| P354 | The sidebar | Home, then Customers, Work, Team, Email and Admin, Admin last; each group in its own colour |
| P355 | Admin, Integrations | Three tabs: Apps, Email services, Developer; each opens its page |
| P356 | Admin, System | Five tabs: Status, Alerts, Backups, Deployments, Audit log |
| P357 | Admin, Settings | Three tabs: Settings, Features, Set up for your business; Features lists the modules under the five groups |
| P358 | An old bookmark (/records, /settings/parts, /providers) | Each opens, under its new name: Lists, Features, Email services |

From [record](../archive/records/2026-11-22-calm-and-modern.md):

| # | Open | You should see |
|---|---|---|
| P359 | Forms (or Users and access, Roles) on the phone, dark, with your Aurora look | No darker strip behind the title; Create form is a compact button beside the title, nothing past an edge |
| P360 | Look, Aurora, then any page | The background is a faint glow, no patches or blotches behind the content |

### Each section's own Settings tab, 22 November

From [record](../archive/records/2026-11-22-section-settings.md):

| # | Open | You should see |
|---|---|---|
| P361 | Admin, Settings, Settings | Name and icon, Colours for everyone, then Each section's settings: a row per section with how many settings it holds; no currencies, no trash days |
| P362 | Customers, Sales | Three tabs: Quotes, Invoices, Settings; Settings holds both currencies and One currency for all |
| P363 | Work, Files, Settings tab: change Time in the trash, Save | "Saved", and you stay on Files' Settings tab |
| P364 | Email, Settings | The sending settings, then Set up: Setup, Addresses, Mail setup, Forwarding; no Email settings row in the sidebar |
| P365 | Admin, Users and access | Five tabs: Users, Roles, Groups, Locations, Settings; Users shows Signed in today and Access requests as chips under the tabs |
| P366 | Users and access, Settings | The two job switches at the top, then Set up: Access reviews, Vendor access; opening one keeps Settings marked |
| P367 | Your name at the foot of the sidebar, My access | Your own page, no Users and access tabs; as an Owner, no Ask for access |
| P368 | Users and access, Groups, a group; Users, someone with a role at a location | The group's page is titled with its name; the badge reads "Role at Location"; a grant without an end reads "No end date" |

### Permissions anyone can follow, 22 November

From [record](../archive/records/2026-11-22-permissions.md):

| # | Open | You should see |
|---|---|---|
| P369 | Users and access, Roles; then Create role | The ready-made roles read Admin, Member, Viewer; Start from offers Viewer, Member, Admin; each module's levels read None, View, Edit, Manage, and a fresh sign-in is a small tag beside its permission |
| P370 | Users, someone, Permissions | One row per module with its level and "N of M"; opening one lists its permissions with Yes or No, where it comes from, and Inherit, Allow, Deny |
| P371 | On that page pick Deny on one permission, Save without the box; then tick "Yes, deny what I picked", Save | First "Confirm the deny" with your pick kept; then saved, and that row reads No, denied for them |
| P372 | An old link to someone's Overrides page | It opens their Permissions page |
| P373 | Roles, any role but the Owner | Rank "N of M, the Owner first" with Move up and Move down; Move up says the rank was changed and the role moves up the list |
| P374 | A role, Policy JSON at the foot; Copy; paste `{"Version":"oltrem-2026-11","Statement":[{"Effect":"Allow","Action":"lists.*","Resource":"loc:*"}]}`, Import | The JSON lists names like `lists.read`; Copy copies it; after Import, "The policy was imported" and only Lists' permissions are ticked |
| P375 | The same box with `"Effect":"Deny"`; then a user's Permissions, See their access as Policy JSON | Refused: a role only allows, deny on their Permissions page; your text stays in the box. The user's JSON lists each role and their own Allow or Deny with its location |

The Apps page's tests (P376-P385, P468-P474, P512-P514, P797-P798, P910-P916, P930-P947) are in [Phone tests owed: the Apps page](phone-tests-apps.md).

### Connected data, the Data pages, 22 November

You need a database to read: an Upstash Redis database (free) with its Read Only token is the
quickest.

From [record](../archive/records/2026-11-22-connected-data-pages.md):

| # | Open | You should see |
|---|---|---|
| P386 | Work, Data | "No database connected yet" with Connect a database; Admin, Features lists Data under Work with its words |
| P387 | Connect a database; paste the two lines Upstash shows under REST API (the URL and the Read Only token), Find my database | The database's page opens with "Connected. The database answered the first check.", its key groups under Tables |
| P388 | A key group, then All keys; tap a column chip, Next page, then search for part of a key | Back at the top; the sort chips above the rows, one card per key with its value; the search keeps the sort and starts at page one; First page and Clear the search work |
| P389 | Connect a database; paste only the Upstash URL | "This is Upstash Redis" with the address filled in, the form first, asking for the Read Only token; no key is ever shown back |
| P390 | Change key; paste a wrong token, Save and check | "The new key is saved, but the database did not answer", then "The service refused the key" with what to press, the service's own words in small type |
| P391 | Change key with the right token; then Check now twice quickly | "The new key is saved, and the database answered"; the second press answers at once without a new check |
| P392 | As a person with View access only: Data, and Admin, Integrations, Apps; then an Owner gives them See of Data (Manage level) at the company, and they open a database and a service card | First Data refuses and Apps shows no database cards. Then the database's page has no Change key or Remove, and a service's page shows its steps with "Ask an Owner", no form |
| P393 | Remove database; Keep database, then Remove database again | One confirm saying the database itself is not touched; Keep leaves it; Remove lands on Data with "The database is removed from the portal" |

### First run and Home, 22 November

From [record](../archive/records/2026-11-22-first-run-and-home.md):

| # | Open | You should see |
|---|---|---|
| P410 | A new portal, signed in as its first Owner: Home | At the top, "What kind of business do you run?" with the kinds of business as chips in one sideways row |
| P411 | Press Shop | Set up for your business with Shop picked, and "Which of these do you use?" with every feature as a chip: Bookings, Quotes and Approvals not selected, Invoices selected |
| P412 | Clear Tasks, press Set up the portal for this | Set up; Tasks is gone from the sidebar, the others as selected; Home no longer asks the question |
| P413 | Users, Invite | "Same access as" with a chip per user; press one: their role is picked and the location reads theirs, with a line saying it is copied |
| P414 | Home, Get started: Switch on backups (Nightly backup off) | System, Settings, with Nightly backup among the switches at the top |
| P415 | Home, Get started: Invite a second person; then Name who gets alerts by email | The Invite page; then System, Settings, scrolled to the Alerts card |

The tests of 22 November for Email settings, Compose and the role editor (P416-P421) are in
[Phone tests owed: Users and access](phone-tests-users.md).
