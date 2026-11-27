---
title: "Records: the index of dated records"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [the records in this folder]
---

# Records

> **In plain words.** The kit's history: one dated record per bigger change, frozen once written.
> It lives outside `docs/` so no agent loads it for a task; open it only to answer what was done
> and when. Living documents say what is true now and link here at most once.

**Writing a new record** (the docs gate holds one dated after 2026-11-26 to 4 KB):

```markdown
---
title: "<what changed, in plain words>"
status: record
owner: vendor
last_verified: <date>
sources: [<commits>]
---

# <title>

**Changed.** One to three sentences. **Why.** One sentence.
**Before → after.** Two short lines, or one small table.
**Checked.** `pnpm verify` summary; phone tests P<n>-P<m>; what was not checked.
```

Detail (routes, tables, numbers) goes in the document that owns it, not here. Add one row below.

Earlier months: [October 2026](2026-10.md), the 118 records from the first commit to 31 October;
[November 2026](2026-11.md), its records from the 1st to the 15th so far.

The records since 16 November:

| Record | What it tells |
|---|---|
| [What did not land is sent again](2026-11-17-outbox-replay.md) | the outbox replay wired to a job, with an end; queue retries wait; two events an invocation |
| [Four left items finished](2026-11-20-left-items-finished.md) | own request in For you; Alerts buttons; company clock; autoUpdate kept; P295-P298 |
| [Security and access](2026-11-20-security-and-access.md) | company pages for the company alone; ended sign-ins stay ended; bodies read to their cap; time limits; P299-P301 |
| [The full codebase review](2026-11-20-codebase-review.md) | the master audit, five batches, measurements, lines, proposals for a yes, directions to expand; P302-P307 |
| [Safer and calmer](2026-11-21-safer-and-calmer.md) | sign-in alerts, Signed in today, file kinds and room, passcodes on links, the jobs' last day, What changed, read and unread, Service status; four extras off; P310-P320 |
| [A fuller audit log](2026-11-22-audit-log-fuller.md) | from where on every row; To what by name; from → to; Needs you for whoever looks after access; P321-P324 |
| [Connect apps](2026-11-22-connect-apps.md) | chat alerts to Slack, Teams, Discord, Google Chat; a calendar link; live spreadsheet links; Make, Zapier, n8n; the services' logos; P325-P331 |
| [A frame that never moves](2026-11-22-smooth-phone-frame.md) | tabs keep their place, buttons under the tabs, one quick fade, solid bars, a small title, no page wider than the phone; P332-P336 |
| [A lighter database and a health watch](2026-11-22-lighter-database.md) | audit log 90 days in D1, older days in the bucket; finished sends, ended sign-ins, old records removed; no compile rows; email services probed hourly; web addresses to watch; P348-P353 |
| [Calm and modern](2026-11-22-calm-and-modern.md) | a plain page, flat buttons, quiet chips, status as a dot, plain figures, a set's buttons under its tabs; later the head on the page, compact head buttons, a faint Aurora; P337-P340, P359-P360 |
| [Starting setup and imports](2026-11-22-starting-setup-and-imports.md) | Set up for your business in one press; customers from a spreadsheet; invitations from a file; the Monday summary, off at first; migration 0074; P341-P347 |
| [Five groups and plain names](2026-11-22-five-groups-and-names.md) | Customers, Work, Team, Email, Admin; Lists, Features, Campaigns, Reports, Status, Apps, Email services; same addresses; P354-P358 |
| [Each section's own Settings tab](2026-11-22-section-settings.md) | a Settings tab last in each section's row, options on top, setup pages under it; the Settings page keeps the company-wide; Email's setups as one; Users and access in four tabs and Settings; My access from the account menu; P361-P368 |
| [The portal's mail in the main inbox](2026-11-22-main-inbox-step.md) | why Gmail files notices under Updates; the Gmail filter file, the contact card and a test on Notifications; sign-in notices, invitations and alerts point to it; P400-P405 |
| [Permissions anyone can follow](2026-11-22-permissions.md) | levels None, View, Edit, Manage; Admin, Member and Viewer; one Permissions page with Inherit, Allow or Deny and a confirmed Deny; a role's rank; one count; permission names `area.thing.verb`; Policy JSON to read, copy and import; P369-P375 |
| [The Apps page and one-click connect](2026-11-22-apps-page-and-one-click-connect.md) | one catalogue with Connected on top; Slack, Discord and Google Sheets in one press through the Vendor's connect relay; Any other app worked out from its link; a calendar link for each app; the seven reviews' fixes; P376-P385 |
| [Connected data: the Data pages](2026-11-22-connected-data-pages.md) | one paste box or a card per service; a database's tables and rows on a phone; reads held at the company, in the Manage level; a key never shown back; P386-P393 |
| [Sign in with Supabase](2026-11-22-supabase-one-click.md) | Supabase through the connect relay: the project and its secret key read there, a project picker, "Connect <project>?" before anything is saved; P394-P398 |
| [Database checks, Rename and one connection per database](2026-11-22-database-checks-and-rename.md) | an hourly check of each database, off until switched on, with Home's Databases line; Rename; a table opened by its name past the 500 listed; Connect pressed twice opens the one already there; P425-P429 |
| [Sign in with Airtable](2026-11-22-airtable-sign-in.md) | Airtable's card signs in on Airtable's own page, the bases picked there, "Connect Airtable?" confirmed; the relay's fifth service, a public integration, so each portal renews its own tokens; P430-P434 |
| [First run and Home](2026-11-22-first-run-and-home.md) | "What kind of business do you run?" on Home, "Which of these do you use?" on Set up for your business, picks saved with what each needs; Same access as on the Invite page; every Home line to the exact tab, opened by a test; P410-P415 |
| [Email settings, Compose and the role editor](2026-11-22-email-settings-compose-role-editor.md) | a gear and a Settings row to Email settings; Compose like Gmail (Send with Schedule send, one More); Inherit, Allow and Deny fixed; permission names with Copy on every row; Policy JSON a tab on a role and a user; a role's page in three tabs, one list; P416-P421 |
| [Hidden and masked columns on a connected database](2026-11-23-connected-data-hidden-columns.md) | `data.hidden.read`; a manager hides or masks each column per table, kept as the connection's `columns` option; left out or masked on every page, never searched, sorted or changed; P460-P462 |
| [A locked page layout, the user page remade, Policy JSON you can edit](2026-11-23-locked-layout-user-page-policy-editor.md) | page anatomy rules; a user's overview as 1 Roles, 2 their own Allow and Deny, 3 what they can do (one list); editable Policy JSON with Check and Save; the line under the portal's name; P455-P459 |
| [The access pages checked against the locked layout](2026-11-24-access-pages-review.md) | a role titled by its name, Assigned to in cards, only the picks the portal saves, a phone's Permissions shorter; the gaps found and the next phases |
| [One toolbar line and coloured chips](2026-11-24-one-line-toolbar-and-colour.md) | filter rows fold behind one Filters button beside the search; states and sections as colour dots |
| [One title, no wrapping, a lighter dark theme](2026-11-25-one-title-no-wrap-lighter-dark.md) | a view of a tab keeps the tab's head; words never wrap in a control; dark greys lifted, the section tile on a phone |
| [A solid sidebar, brighter colours, page menus inside the page](2026-11-25-solid-sidebar-and-page-menus.md) | the sidebar one solid colour with bare bright icons; Email's folders a row under its title; the group colours brighter; API keys a tab of Integrations; P674-P677 |
| [Questions in SQL on a connected database](2026-11-23-connected-data-questions.md) | `data.questions.run`: one statement that only reads on Neon (read-only batch, cursor) and Turso (described first), 100 rows; the text box now shows its value on every edit form; P443-P446 |
| [Editing a connected database](2026-11-23-connected-data-edits.md) | Turn on editing per database, off at first; a row's own page to change it only while it holds what was seen; deleting an Owner's alone; each change audited without its values and undone for 30 days from Recent changes; P435-P442 |
| [Everyone's links, and a link read too often](2026-11-24-everyones-links.md) | `connect.links.manage`: every link in the company on `/connect/links`, whose it is, Delete any, audited; a link read more than 60 times in ten minutes refused for the rest of them; P512-P514 |
| [The Apps page: logos, what is running, a log of everything outside](2026-11-23-apps-logs-connected-look.md) | logos on a dark tile in dark mode and Zapier's asterisk; a connected card shows its health and opens what is running, with Add another; every public address and every read of a connected database audited, the flood capped; cards answer hover and the keyboard; P468-P474 |
| [Files as a file manager, batch 1](2026-11-23-files-explorer.md) | a folder tree, List or Grid with sorting, ticks to trash many, drop, paste or folder upload with a bar each, drag rows into a folder, Make a copy, a details pane with a preview and who opened the file; staff downloads audited; P447-P454 |
| [Files: Manage access, batch 2](2026-11-23-files-access.md) | None, View, Edit or Manage on a folder or file for a person, group or role, View only and an end date; restricted folders hidden from all not listed; Shared with me; `files.access`; migration 0079; P463-P467 |
| [Files: Storage locations, batch 3](2026-11-23-files-storage.md) | a location's files in a bucket of the company's own: Amazon S3, R2, Backblaze B2, Wasabi, Spaces or any S3 service, joined and checked on Files, Storage; migration 0080; P479-P483 |
| [Files: Held for review and Shared links, batch 4](2026-11-23-files-safety.md) | uploads with a program, macros, a password or a PDF's active content kept but held until Manage releases them; names that hide their ending refused; every open link on one page; migration 0081; P484-P487 |
| [Files: Versions, Starred and Recent, batch 5](2026-11-23-files-versions.md) | a file's new version keeps its name and links, the newest ten earlier versions kept and restorable; a star per person; the newest files at the person's locations; migration 0082; P488-P491 |
| [Files: File requests, batch 6](2026-11-23-files-requests.md) | people outside send files into a folder by link, with an end, a file count, an optional passcode and the upload checks; public hooks may read their own body; migration 0083; P492-P495 |
| [Files: tidy, safer writes and earlier versions, phase 7](2026-11-24-files-tidy.md) | repeated code folded into helpers; stored content deleted again when its row fails; earlier versions counted in rooms and downloadable; P496-P497 |
| [Files: access review, request emails and activity export, phase 8](2026-11-24-files-access-review.md) | every extra access at one's locations with End access in bulk; a file request's maker emailed; activity as CSV; P498-P501 |
| [Files: keep for and legal hold, phase 9a](2026-11-24-files-keep.md) | a folder keeps its files a set time and a legal hold freezes what it covers; trash, delete, move and the trash job refused; migration 0084; P502-P504 |
| [Files: the page made over, and its Settings tab](2026-11-24-files-makeover.md) | the Files menu in the portal sidebar, the folder as one panel with New, compact coloured rows, ticks and the bulk bar only when needed, details over the page; the section Settings tab as one plain list, a setting's `setOn` linking to its page; P523-P528 |
| [Files: a file's page made over](2026-11-24-files-item-page.md) | a file's or folder's page as cards: its buttons beside the title, Who has access with one row per person and Add people in a dialog, links, customers, versions and Keep each with its form in a dialog, the activity |
| [Files: the public pages made over](2026-11-24-files-public-pages.md) | the passcode, file request and ended link pages as one card in light or dark; an ended link says so on a page; dates in words |
| [Files: the details panel made clear](2026-11-24-files-details-panel.md) | the type in words, times in the viewer's zone, names from Users, Who has access in the panel with Add people by person, group or role, Activity with coloured icons and words; P556-P558 |
| [Files: reviewing a held file](2026-11-24-files-held-review.md) | Release and Move to the trash on a held file's notice, its details panel and its menu; Held for review lists them for whoever manages the location; P553-P554 |
| [Files: moving a location's files, and bringing in a bucket's](2026-11-24-files-storage-moves.md) | Move takes a location's old files to the storage it uses now, ten a press; Bring in makes a bucket's files files of a location, with no copy |
| [Files: one title on every page, and colour in the lists](2026-11-25-files-one-title.md) | every Files page keeps the title Files at one size, its list or part named in a card with a coloured tile and count; a file's page heads its content with its name and buttons; P563, P564 |
| [Files: the file page, the details panel and New made over](2026-11-25-files-file-page-makeover.md) | New opens under itself; no blank preview box (text files show their text, served as plain text); the page's and the panel's head in the file's colour, a coloured tile on every card; P567-P569 |
| [API keys: limits, rotation, a page per key](2026-11-25-api-keys-management.md) | read only, parts, addresses, pace, start and end; rotate with an overlap, change access, delete; every call and change logged; How to use |
| [Files: the whole page reviewed and fixed](2026-11-25-files-review.md) | nothing clipped; panel slides in below the phone bar; compact upload and trash boxes; P576-P586 |
| [Files: Type chips, Previous and Next](2026-11-25-files-type-and-steps.md) | Type chips with counts, panel steps by arrows or swipe, drop into a folder row; P592-P594 |
| [Files: room for files and Cloudflare use](2026-11-25-files-storage-management.md) | Room for all files, most per person, warning share, `files.limits.manage`; R2 Class A, B and storage on Files, Storage; P595-P599 |
| [Files: a Supabase project's storage](2026-11-25-files-supabase-storage.md) | Supabase Storage joined from a project under Data, ref filled in; P600-P601 |
| [The Alerts page remade](2026-11-25-alerts-page-remade.md) | sign-in alert emails no longer refused; chips, search, rows that open, ticks, notes, mute, resolve any, delete resolved, 90 days kept; a sidebar that fits its names; the search list in colour; standard incident words, a reason with each resolve (mig 0098), times in your zone; label-first figures, a back link, the bell's tooltip; P810-P826, P841-P851 |
| [Files: menu in the page, trash, moving several](2026-11-25-files-menu-trash-move.md) | Menu row, Empty the trash, Move ticked, confirm ends, search all; P587-P591 |
| [API key pages made over](2026-11-25-api-key-pages-made-over.md) | How to use as coloured cards: Quick start in cURL, JS, Python, endpoints open to a ready call, errors with their fix, the checks in order; the list, Details, Calls and History with figures and coloured tags; P667-P669, P678, P679 |
| [API reference with fields, an OpenAPI file, keys in Needs you](2026-11-25-api-reference-and-openapi.md) | each route's fields and an example body, one part at a time; an OpenAPI 3.1 file for the portal or a key; Needs you names keys ending this week or unused for 90 days; P794-P796 |
| [API keys made safer, retries without doubles, webhook replay](2026-11-26-api-keys-safer-retries-replay.md) | a key's account takes a role only on its page; Idempotency-Key and RateLimit headers; webhook secret overlap and Resend missed events; P995-P999 |
| [Scheduled jobs](2026-11-25-scheduled-jobs-page.md) | a page per job; P720-P725 |
| [Scheduled jobs remade](2026-11-25-scheduled-jobs-remade.md) | Run now, timed pause; P880-P885 |
| [Scheduled jobs in panes](2026-11-26-scheduled-jobs-panes.md) | rows that open, pills; P960-P964 |
| [Scheduled jobs in a side panel](2026-11-26-scheduled-jobs-side-panel.md) | a job opens beside the list, a summary strip; P960, P961, P965 |
| [The jobs panel polished](2026-11-26-scheduled-jobs-panel-polish.md) | no sideways scroll, previous and next, sticky tabs; P966 |
| [Scheduled jobs: reasons, Pause all, countdowns](2026-11-26-scheduled-jobs-notes-and-pause-all.md) | a why with each change, pause or resume every job, live times; P967-P969 |
| [Public addresses rest before a limit](2026-11-24-public-hooks-rest.md) | the fleet's edge rule `oltrem_hooks`, 60 hook calls a minute per address, 503 near the day's D1 limit, migration rules as a test, one Analytics Engine figure per request; P510-P511 |
| [Which day today is follows the company time zone](2026-11-24-company-time-zone.md) | invoices, quotes, expenses and time off read today from `bookings.time_zone`, now titled Company time zone; P529 |
| [System status shows the last day of requests](2026-11-24-request-charts.md) | `GET /api/health/requests` from Analytics Engine: requests, failures and the 95th percentile by hour, the five slowest routes; P560 |
| [Report a sign-in that was not you](2026-11-24-report-a-sign-in.md) | one press on My access signs out everywhere and raises a critical alert; P640-P642 |
| [The Audit log remade, and every page full width](2026-11-24-audit-log-remade-and-full-width.md) | one sentence a row under its day in your clock, search and quick filters, repeats folded, a row opens to what changed; a lone card or form fills the page width; P540-P546 |
| [Sign-in alerts on for everyone](2026-11-24-sign-in-alerts-on.md) | the owner's pick: on, unless an admin switched them off; migration 0085; P643 |
| [A sign-in used from another country or browser](2026-11-25-sign-in-used-elsewhere.md) | the person emailed and an alert raised once per other place; local times in sign-in emails; P644-P645 |
| [API keys: another system calls the portal](2026-11-24-api-keys.md) | an Owner makes a key with a role at a location, never the Owner role; `/hooks/api/...` as its service account; shown once, kept as a hash, revoked at once; migration 0089; P650-P651 |
| [A second backup copy outside Cloudflare](2026-11-24-backup-second-copy.md) | each database copy also kept, still encrypted, in a storage connection of Files an Owner picks on the Backups page; off until one is picked; P652 |
| [Layout rules: card grids, no width caps, four page layouts](2026-11-24-layout-rules.md) | cards in a set fill the row as a grid; no page, card or form caps its width (a check refuses it); every page body one of four layouts; each library one job; P547-P548 |
| [The Audit log in colour, and sign-ins by browser](2026-11-24-audit-log-colour.md) | each row's section in its sidebar colour, refused and failed rows edged red and amber, a sign-in's browser in a few words; P565-P566 |
| [A real portal on this computer, and the rules for Antigravity](2026-11-25-live-portal-and-antigravity.md) | `npm run live` copies a client's live data into the local database, the live portal only read; `.agents/` gives Antigravity the rule and the skills; the owner's standing orders in rules.md |
| [The start page for local testing, and connected to live](2026-11-25-start-page-local-and-connected.md) | no deploy on the start page; which data: new, a copy of the live portal, or connected to it after a typed yes; `live-windows.cmd` |
| [Local or Production: no copy of live data on a computer](2026-11-26-local-or-production.md) | which data is Local or Production; `npm run live` runs on the live resources after a typed yes, never a copy; the portal always asked, with another Cloudflare login; a sign-in through Cloudflare Access with the person's own login |
| [The start page remade: run, retry, reconnect, log](2026-11-26-start-page-remade.md) | Run the portal first with Local or Production as two big choices; a crashed portal starts again by itself; a lost page reconnects; every run logged with times in `.oltrem/runs/`; Which portal? asked on the page |
| [The audit log, rich enough to trace a breach or a stolen key](2026-11-25-audit-log-for-investigations.md) | every API key call and refusal, downloads, refused reads, audit log reads, network and sign-in on each row, settings before and after, refusal reasons; signals and pivots on the page; P786-P791 |
| [The Audit log: a strip of days, unusual sign-ins, every action in words](2026-11-25-audit-log-days-and-words.md) | the range as a chart of days, a tap lists one day; sign-ins from an unusual country or new browser flagged; every action written has a sentence, kept by a test; P780-P782 |
| [Every dialog remade](2026-11-25-dialogs-remade.md) | head, body, foot |
| [Reports remade](2026-11-26-reports-remade.md) | one trend with the period before, six figures with their move, what stands out in words, who and when, every list with its trend and an audit log link, the website from connected apps; migration 0097; P900-P905 |
| [Reports: a tab for money, customers and work](2026-11-26-reports-every-part.md) | Activity, Website, Money, Customers and Work as tabs; invoices, quotes, expenses, customers, form answers, tasks and bookings each bring a section: figures against the period before, a line a day, lists into their pages; no new table; P970-P974 |
| [Reports, Money: days to get paid, win rate, each currency](2026-11-26-reports-money.md) | Invoices' days from sent to paid, the quotes' win rate, every currency listed apart once there are two; P976-P978 |
| [Reports, Money: from visit to paid](2026-11-26-reports-funnel.md) | one funnel across apps on the Money tab: visitors, form answers, quotes sent and accepted, invoices paid, each with its move and the share that carried on; P979-P980 |
| [Reports: an Email tab, from Email and Campaigns](2026-11-26-reports-email.md) | Email's sent, delivered, opened, bounced, refused, each integration and the addresses that bounce most; Campaigns' people mailed, opens, clicks and each campaign; P981-P983 |
| [Reports: a Services tab](2026-11-26-reports-services.md) | storage against its room, webhooks and chat apps, automations, each connection's last check and allowance; P984-P987 |
| [Reports: smarter readings](2026-11-26-reports-smarter.md) | the trend marks campaigns, invoices and new versions; an unusual day in words and, with the Unusual days extra, on Alerts; money and visitors in the Monday summary; Custom days; migration 0103; P988-P989, P1000-P1002 |
| [Verification log, 22 November](2026-11-22-verification-log.md) | the log's rows of that day, moved when it reached its size |
| [Verification log, 23 November](2026-11-23-verification-log.md) | the log's rows of that day, moved when it reached its size |
| [Verification log, 24 November](2026-11-24-verification-log.md) | the log's rows of that day, moved when it reached its size |
| [Verification log, 25 and 26 November](2026-11-25-to-26-verification-log.md) | the log's last rows, moved when it was retired |
| [Where things stood, to 26 November](2026-11-26-status-history.md) | every phase's parts and every round since 27 October, each with its record |
| [Living documents trimmed](2026-11-26-living-docs-trimmed.md) | proposals, the verification log and done work out of the living set; phone-test sources once; wrong names fixed |
| [Big READMEs split into pages](2026-11-26-readmes-split.md) | 16 READMEs over 16 KB split into 67 pages beside them; dated asides stripped |
| [Website analytics apps on the Apps page](2026-11-26-website-analytics-apps.md) | PostHog, Plausible, Umami and Cloudflare Web Analytics connected with a read-only key under Apps, Analytics; the last 7 days on the connection's page; one report for the Analytics page, kept ten minutes; P910-P916 |
| [Google Analytics, Matomo and Fathom on the Apps page](2026-11-26-more-analytics-apps.md) | three more website analytics apps: a GA4 service account signed in the Worker, Matomo in one request, Fathom five calls at a time; P917-P919 |
| [Sign in with PostHog and Google Analytics](2026-11-26-analytics-sign-in.md) | PostHog and Google Analytics connected by signing in through the relay, the key the second way; tokens renewed before a read; a daily check and "sign in again" on Home; cards keep their own height; Everyone's links moved off the top; P933-P939 |
| [Records moved out of docs/, and kept short](2026-11-26-records-out-of-docs.md) | records live in archive/records/, hidden from search; a new record is 4 KB at most, from a template |
| [The Apps page in colour, every Connect a pop-up, no fake login](2026-11-26-apps-pop-ups-and-no-fake-login.md) | the owner's review: logos on their own colour, every Connect a pop-up over Apps, a refused key reopens it; key boxes no longer password fields and no "Sign in with" wording, after a browser flagged a portal; P940-P947 |
| [A Checkup page that checks every connection daily](2026-11-26-vendor-checkup.md) | Status, Checkup: every outside connection with its last check, Check every connection now; an hourly job checks each daily, asks a passing failure once more, audits every check and marks a retiring API; P1003-P1007 |
| [The sign-in service linked to every portal by the fleet](2026-11-26-relay-linked-by-fleet.md) | each fleet run finds the relay, fills every portal's empty Sign-in service setting and keeps the relay's list of portals; nobody pastes either; P1008 |
| [Sign-ins fixed: outside calls Cloudflare Workers refused](2026-11-26-workers-redirect-mode.md) | `redirect: 'error'` throws in Workers, so every one-step sign-in failed at its first outside call; now `'manual'` with the `res.ok` check, and lint refuses the old mode |
| [Continue with PostHog fixed: projects read the way PostHog allows](2026-11-26-posthog-projects-by-scope.md) | a sign-in for chosen projects may not read PostHog's project list, so every such sign-in failed; now each project by its own address, in the region PostHog names; PostHog's own refusals logged, not called a cancel; a failure notice said once; P1009 |
| [Continue with PostHog fixed again: its 7-day sign-in accepted, failures in the audit log](2026-11-26-posthog-week-long-sign-in.md) | PostHog gives an app like ours a 7-day token and the portal refused more than a day, silently; now kept as a day and renewed, and every failed sign-in is in the audit log with its step; P1010 |
| [Website tab remade as a full board, PostHog read in full](2026-11-27-website-board.md) | each analytics app's report as a board of about 15 parts, each opening the app's own page; PostHog asked four questions; the last good report kept a day as the fallback; P1011-P1016 |
| [The other six website apps fill the board too](2026-11-27-website-other-apps.md) | Plausible, Umami, Google Analytics, Matomo, Fathom and Cloudflare fill the board's parts where their APIs allow, sharing one request's calls; P1017-P1020 |
| [PostHog on the Website board: recordings, errors and a funnel](2026-11-27-website-funnel.md) | the recordings and errors worth a look, each opening in PostHog, and a funnel from two to five steps picked in a pop-up, in the question PostHog is already asked; P1021-P1024 |
| [Cloudflare's own figures for the website's domain](2026-11-27-cloudflare-domain.md) | a Cloudflare connection reads the domain too (two more read permissions, found by itself): every request, the cache, threats, status codes and failing pages, subdomains, countries, security events and bots; P1025-P1030 |
| [Cloudflare's DNS, routed mail and Turnstile on the Website board](2026-11-27-cloudflare-dns-mail-turnstile.md) | DNS lookups, mail through Email Routing and Turnstile join the domain's part, and its sentences join "In plain words"; P1031-P1033 |
| [An analytics app's full view on Reports](2026-11-27-website-full-view.md) | Each app's own view: Apps row, Settings, every call, a chart against the days before, PostHog's right now every 30 seconds; P1034-P1037 |
| [PostHog's recordings in an app's full view](2026-11-27-website-recordings.md) | 50 visits narrowed by chips, a sentence each, one visit's steps in order, each recording watched in PostHog; P1047-P1050 |
| [PostHog recordings played inside the portal](2026-11-27-website-replay.md) | Play, or a time in the steps, plays the visit in the page with Pause, seek and speed; the recording streamed through the portal; P1051-P1054 |
| [The master key moves into Cloudflare Secrets Store](2026-11-27-master-key-in-secrets-store.md) | the KEK in the account's Secrets Store, put there by npm run deploy and bound by every release; connector keys stay sealed in the database |
| [Reports: charts you can explore](2026-11-27-reports-explore.md) | a finger, the mouse or the keys read a chart day by day against the period before; a tap opens the day in the Audit log or zooms to its week; figures pick the chart; Earlier and Later; P1040-P1046 |
