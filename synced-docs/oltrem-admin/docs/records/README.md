---
title: "Records: the index of dated records"
status: living
owner: vendor
last_verified: 2026-11-21
sources: [the records in this folder]
---

# Records

> **In plain words.** Every bigger change to the kit has a dated record here: what changed, why,
> and how it was checked. A record is frozen once written; a later change is a new record. This
> page lists them, oldest first, so [the main index](../README.md) stays small enough to load
> whole; a month that is over moves to its own page, linked below. The docs gate counts a record
> as indexed when this page or a month's page it links names it.

Earlier months: [October 2026](2026-10.md), the 118 records from the first commit to 31 October.

The records, each dated and frozen once written, with its decisions and how it was verified:

| Record | What it tells |
|---|---|
| [Core hardening](2026-11-01-core-hardening.md) | ctx.access sign-in, keys bound to hosts, tick fits, rollback |
| [Mail moved to Oltrem Mail](2026-11-02-mail-moved-out.md) | email and campaigns in their own repository, packed in vendor/mail/ |
| [Oltrem Mail in the tool](2026-11-02-oltrem-mail-in-the-tool.md) | asked on the first deploy, `oltrem mail add` or `remove` later; off by default |
| [Mail's inbox in the portal](2026-11-02-oltrem-mail-inbox.md) | the email handler, the bucket, mailboxes on a computer |
| [One repo per client](2026-11-01-one-repo-per-client.md) | kit vendored in kit/, `oltrem new client`, upgrade --from |
| [Frame and page head](2026-11-01-frame-and-page-head.md) | no sideways shift, wider pages, new head, tabs |
| [Email remake](2026-11-01-email-remake.md) | Write, Sent at once, From adds an address, Addresses |
| [CPU budget](2026-11-01-cpu-budget.md) | in-process API calls, audit recheck spread, time zones once |
| [Every server error kept](2026-11-03-error-log.md) | each error an alert, grouped, counted, emailed once |
| [Worker size budget](2026-11-03-size-gate.md) | verify refuses a bigger Worker |
| [Optional extras](2026-11-03-optional-extras.md) | audit seal and reminders switched off |
| [Faster start, smaller index](2026-11-03-faster-start-records-index.md) | the kit's email providers no longer checked at each start; records indexed here |
| [Get started on Home](2026-11-03-get-started.md) | a new portal's first steps, each ticked by what is stored |
| [Saved views](2026-11-03-saved-views.md) | a list's filters kept under a name, a chip above the list |
| [Bulk actions](2026-11-03-bulk-actions.md) | tick rows on a list, one press for all, each row checked |
| [Undo after removing a record](2026-11-03-undo.md) | the removal's notice offers Undo; the record waits a day in a trash table |
| [Test coverage per package](2026-11-03-coverage.md) | verify counts the lines each package's tests run and refuses a drop below its floor |
| [Notifications](2026-11-03-notifications.md) | a bell with what modules told a person, and their choice per module |
| [Phone and accessibility check](2026-11-03-phone-a11y-check.md) | every page's names, labels and viewport checked on verify |
| [Mail with one tick](2026-11-03-mail-tick.md) | the start page's Try it here puts Oltrem Mail in or out |
| [Look 2, step 1](2026-11-03-look-2.md) | lean chips and buttons, every notice a toast, the style and script served as files |
| [The role editor as a permission matrix](2026-11-03-role-matrix.md) | every module's level in view, set all, find, special permissions apart |
| [Looks: palettes and backgrounds](2026-11-03-looks.md) | 24 palettes and 7 backgrounds each person picks, at no stylesheet cost |
| [Sign-in refused on a live portal](2026-11-04-sign-in-and-static-files.md) | static files hid the Access sign-in; the Worker serves its style and script again, and the deploy refuses static files |
| [Colour pass](2026-11-04-colour-pass.md) | solid buttons with white text, darker fields, a richer dark theme in every look |
| [The phone's top](2026-11-04-phone-top.md) | the bar names the page; the content starts about 150 px higher on a phone |
| [The people named at setup get in](2026-11-04-setup-people.md) | the Users page invites everyone setup step 2 named in one press; each accepts after the door's code, no email or link |
| [A key Cloudflare does not know](2026-11-05-dead-key.md) | the door names a dead key, the deploy asks for a new one and waits, a new key is used on the next check |
| [The door with no key](2026-11-05-no-key-door.md) | the deploy sets Cloudflare Access once with Cloudflare's own sign-in; anyone may ask for a code, the portal lets in only its own people |
| [First run: named people get in](2026-11-08-first-run-sign-in.md) | people named at setup get their account at the first sign-in; Cloudflare's sign-in shows its link and code and tries again 10 seconds after a failure |
| [Several Vendor accounts](2026-11-08-vendor-accounts.md) | setup names Another Vendor; a Vendor adds and switches Vendor accounts on Vendor access; never your own, never the last one |
| [Email reworked for the client](2026-11-08-email-for-the-client.md) | one email per person; Email opens on Write; files attached up to 10 MB and larger ones as 30-day links; campaigns in four steps; Email settings in one entry |
| [Look 3, wave 1: the foundation](2026-11-08-look-3-foundation.md) | daisyUI's controls in the portal's own colours, the phone's bar at the bottom, colour dots with a circle reveal, the seven Email pieces |
| [Look 3, wave 2: the pages](2026-11-08-look-3-pages.md) | pages arrive on the owner's timings, a welcome band on Home, Settings with one Save bar and real switches, calm empty lists |
| [Easier setup](2026-11-03-easier-setup.md) | email in one step from Home and Integrations, delivery reports registered by themselves, the first backup without waiting for the night |
| [Look 2, step 3](2026-11-03-look-2-step-3.md) | one empty box everywhere, settings side by side, an Owner's look for everyone |
| [Look 2, step 2](2026-11-03-look-2-step-2.md) | each page's button beside its heading or filters, smaller empty boxes, shown-once results as toasts, a switch grid for notifications, Look tiles |
| [Email made to work like Gmail](2026-11-11-gmail-style-email.md) | Oltrem Mail's stars, labels, keyboard shortcuts, top bar and Usage and limits taken in; core-ui's mail pane in Gmail's groups with More, Labels and gauges, label colours, the top bar and its menus |
| [Everyday email out of Gmail's Promotions tab](2026-11-11-gmail-primary.md) | everyday email untracked and sent through a provider that does not track first; Brevo, Sender marked as always tracking; Ready to send says when every provider tracks |
| [A coded HTML email sent as designed, and noticed when pasted](2026-11-11-coded-html-intact.md) | a web font `@import` no longer empties the style sheet; pasted HTML code turns the message to HTML |
| [The portal's own name and icon, the Inter font, and lighter page moves](2026-11-11-portal-name-icon-font.md) | Name and icon on Settings, the tab's icon, Inter, lighter page moves; the CPU per page measured |
| [The Settings page redesigned, the Vendor never asked to sign in again, refusals that fail once](2026-11-11-settings-page-design.md) | Settings by section, Colours for everyone; no fresh sign-in for the Vendor; a refused email fails once |
| [A blank CSV template, and a livelier campaign page](2026-11-11-campaign-page-design.md) | a blank CSV on the campaigns page and in a campaign's list step, the four steps as coloured cards with a Next marker and a progress bar, icon chips, a drop zone for the file |
| [Campaigns: any CSV, a sample list, template fields in any spelling, the provider's answers](2026-11-11-campaigns-csv-fields-runs.md) | a sample CSV, any client file sent in parts, fields like `*\|FNAME\|*` matched to columns, the provider's words and fix in the Run log |
| [Campaigns kept tidy, and Run now for a scheduled campaign](2026-11-11-campaigns-tidy.md) | Delete blank drafts in one press, Archive finished with an Archived chip and Take out of the archive, Run now starting a campaign set for later |
| [Compose as one window, and the phone's bar back at the top](2026-11-11-compose-and-phone-bar.md) | Compose's tinted head and Ready to send chip; on a phone a bar along the top opens the sidebar |
| [The setup page: another Vendor, and a new look](2026-11-11-setup-page-look.md) | step 2 offers Add another Vendor; the start page and the seven steps in the Look 3 design: a band with the next move, a progress ring, steps on one line, role chips, motion |
| [Every push to the kit updates every client's portal](2026-11-11-fleet-updates.md) | `oltrem fleet` in one Workers Builds connection: the test portal first, a GitHub issue when one does not update |
| [The sidebar tidied](2026-11-11-sidebar-tidy.md) | every row on one column, the bell inset, 18 px icons on the closed rail's centre line, the portal's mark at its top, no scroll bar and a soft fade |
| [Pages that move like the owner's clips](2026-11-11-page-motion.md) | panes and figures that sharpen in turn, numbers that count up, meters that fill, columns that grow, a marked tab, filter or section that glides, a slow page that dims |
| [Email settings made easy to start](2026-11-10-email-easy-start.md) | three numbered steps, a full example sender address to tap, info notes behind round buttons, a provider's domain added and checked by itself |
| [Email's panes, and Ready to send that checks itself](2026-11-10-email-panes.md) | the same folders on every Email page (`frames`); Ready to send re-checks by itself |
| [Database reads, the timer's CPU, and the newest campaigns](2026-11-10-reads-cpu-and-campaigns.md) | why the campaign pages read so many rows and the fix; why browser storage, tokens and KV would not help; the tick every minute; Oltrem Mail's campaign steps and Run now |
| [The Users pages remade](2026-11-11-users-pages.md) | no sign-in check and no end date by default, a searchable list with roles and last sign-in, role cards, a person's summary and pages for sessions and activity, a one-form permission override, Users & access in the sidebar |
| [Each page's queries pinned, and `pnpm cpu`](2026-11-11-page-costs.md) | each page's queries pinned in the screens test; `pnpm cpu` ranks every page by CPU |
| [Write asks before it sends, and fits a phone](2026-11-11-write-smarter.md) | pasted lists in To, ranked suggestions, Send asks about a misspelt address or a missing file; Write edge to edge |
| [The Email pages tidied for a phone](2026-11-11-email-pages-tidy.md) | a page head that keeps a short title's buttons beside it, pane heads that wrap, no box in a box, one chip look, faded folder row, tabs showing the one before, Write's narrower labels, no empty chart |
| [Coded emails found anywhere, one dropdown, Write without the portal's bar](2026-11-12-coded-email-and-dropdowns.md) | why a pasted coded email showed as text, the core-ui Dropdown, one Cc/Bcc, chips with room, the compose head as a phone's only bar, the 148 KiB cap |
| [A quiet portal costs almost nothing, and a page waits for one trip less](2026-11-12-quiet-portal.md) | where 202,000 reads and 10,000 writes a day went; idle jobs sleep; nightly extras off until switched on; a page's reads together |
| [The screens' actions moved behind the door on every portal](2026-11-12-screen-actions-behind-the-door.md) | why the colour change said Not signed in after a fleet update (an old door leaves `/ui/*` open); the actions moved to `/do/` |
| [Pages kept in the tab's memory, and Email's folders in a drawer on a phone](2026-11-12-instant-pages.md) | pages seen again shown at once from the tab's memory, then checked; Email fetched ahead; a folders drawer on a phone |
| [Why the test email landed in Promotions](2026-11-12-promotions-tab.md) | Mail cc48720: a designed offer; Write asks once, campaigns warn of a shared address; P155-P156 |
| [Class names, button looks and the two design skills](2026-11-12-ui-foundation.md) | the four-step overhaul: the audit, `cn()` and `cva`, the skills `ui-design-system` and `preact-ui`, gradients and glows taken off |
| [Addresses in three views, and the Edit dialog in parts](2026-11-12-addresses-three-views.md) | Oltrem Mail 5ee9ec9: three views on Addresses, one Add an address, Edit in parts; P158, P159 |
| [Forwarding through ImprovMX, and plainer Forwarding and Mail setup pages](2026-11-12-forwarding-through-improvmx.md) | Oltrem Mail cb27410: the `forwarding` kind and ImprovMX; Forwarding in two views; Mail setup led by its next step; P160 to P163 |
| [No wasted room: full-width pages, colour cards, logos and a System status for an AI](2026-11-12-no-wasted-room.md) | the golden rule (part of R-12): full width, colour cards, a report for an AI; P164 to P168 |
| [A bold, even look: section colours, scrollbars in the palette, and the role pages redone](2026-11-12-bold-look-and-role-pages.md) | section colours, palette scrollbars, Roles as one even list; P170 to P174 |
| [A live portal's System status report, fixed](2026-11-12-system-status-report-fixes.md) | a refused key named with its fix; quiet errors resolve; gone checks hidden; switched-off jobs not counted; P175 to P177 |
| [A person's permissions on one page: tick what they should have](2026-11-12-change-permissions-page.md) | every permission ticked as the person has it, with why, Reset and one Save; P178 |
| [Modules as one even list, plain cards and empty states](2026-11-13-plain-cards-and-module-list.md) | Modules as rows with boxes; plain cards; P180, P181 |
| [The Cloudflare key fixed from a phone](2026-11-13-cloudflare-key-from-the-phone.md) | System status leads through a new key; P182, P183 |
| [Email's menu on a phone](2026-11-13-email-menu-on-a-phone.md) | Menu works on every phone and opens Email's own menu; P185 to P187 |
| [Find any page as you type, and jump back to recent ones](2026-11-13-find-pages-and-jump-back.md) | search lists pages; Jump back in; P188, P189 |
| [Users as one page, and motion that says where you went](2026-11-13-users-page-and-motion.md) | Users & access as tabs of Users; motion by direction; P190-P192 |
| [Fewer database reads, indexes for growing lists, and changes shown at once](2026-11-13-reads-and-changes-at-once.md) | fewer reads, seven indexes, changes at once; P193-P195 |
| [New Home, bell in the head](2026-11-14-home-makeover-and-header-bell.md) | P196-P198 |
| [Quiet Off, switches](2026-11-14-quiet-off-and-switches.md) | P199-P201 |
| [Loading orb](2026-11-14-loading-orb-and-status-list.md) | P202-P204 |
| [Sidebar rail, notifications panel](2026-11-14-sidebar-rail-and-notifications-panel.md) | P205-P206 |
| [Heads on a band](2026-11-14-page-heads-on-a-band.md) | P210-P212 |
| [ECC agents](2026-11-14-review-agents-from-ecc.md) | 2 taken, rest left out |
| [Users list, sessions, blocking, Owner overrides](2026-11-14-users-sessions-blocking-owner-overrides.md) | P213-P219 |
| [Lists made plain, no blank fields](2026-11-14-lists-add-contacts.md) | Mail 7d8f1ff, file preview; P220-P224 |
| [Off pages, head menus](2026-11-14-switched-off-pages-and-head-menus.md) | P225-P226 |
| [Backups](2026-11-14-backups-complete.md) | P227-P231 |
| [Backup alerts, budgets at midnight](2026-11-15-backup-alerts-and-budgets-at-midnight.md) | P232-P233 |
| [One sidebar, more colour](2026-11-15-one-sidebar-and-colour.md) | P237-P245 |
| [Campaigns as plain letters](2026-11-15-campaigns-as-letters.md) | Gmail's tab named on Check it; P246-P247 |
| [First-request CPU](2026-11-15-cpu-first-request.md) | load-time warm-up; `pnpm cpu` fixed |
| [Review team, CPU check, first run](2026-11-15-review-team-cpu-and-first-run.md) | twelve reviewers; CPU judged by the median and stopped requests; company form on module pages; P248-P250 |
| [Every journey walked and fixed](2026-11-15-flows-fixed.md) | refused forms keep what was typed; one person answers their own; queued, not emailed; P251-P294 |
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
| [Questions in SQL on a connected database](2026-11-23-connected-data-questions.md) | `data.questions.run`: one statement that only reads on Neon (read-only batch, cursor) and Turso (described first), 100 rows; the text box now shows its value on every edit form; P443-P446 |
| [Editing a connected database](2026-11-23-connected-data-edits.md) | Turn on editing per database, off at first; a row's own page to change it only while it holds what was seen; deleting an Owner's alone; each change audited without its values and undone for 30 days from Recent changes; P435-P442 |
| [Everyone's links, and a link read too often](2026-11-24-everyones-links.md) | `connect.links.manage`: every link in the company on `/connect/links`, whose it is, Delete any, audited; a link read more than 60 times in ten minutes refused for the rest of them; P505-P507 |
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
| [Public addresses rest before a limit](2026-11-24-public-hooks-rest.md) | the fleet's edge rule `oltrem_hooks`, 60 hook calls a minute per address, 503 near the day's D1 limit, migration rules as a test, one Analytics Engine figure per request; P510-P511 |
| [Which day today is follows the company time zone](2026-11-24-company-time-zone.md) | invoices, quotes, expenses and time off read today from `bookings.time_zone`, now titled Company time zone; P529 |
| [System status shows the last day of requests](2026-11-24-request-charts.md) | `GET /api/health/requests` from Analytics Engine: requests, failures and the 95th percentile by hour, the five slowest routes; P560 |
| [Report a sign-in that was not you](2026-11-24-report-a-sign-in.md) | one press on My access signs out everywhere and raises a critical alert naming the other browsers; the sign-in alert points to it; a report is resolved by hand; P640-P642 |
| [The Audit log remade, and every page full width](2026-11-24-audit-log-remade-and-full-width.md) | one sentence a row under its day in your clock, search and quick filters, repeats folded, a row opens to what changed; a lone card or form fills the page width; P540-P546 |
| [Sign-in alerts on for everyone](2026-11-24-sign-in-alerts-on.md) | the owner's pick: on from the start, and on every portal but where an admin switched them off; migration 0085; P643 |
| [API keys: another system calls the portal](2026-11-24-api-keys.md) | an Owner makes a key with a role at a location, never the Owner role; `/hooks/api/...` as its service account; shown once, kept as a hash, revoked at once; migration 0089; P650-P651 |
| [A second backup copy outside Cloudflare](2026-11-24-backup-second-copy.md) | each database copy also kept, still encrypted, in a storage connection of Files an Owner picks on the Backups page; off until one is picked; P652 |
| [Layout rules: card grids, no width caps, four page layouts](2026-11-24-layout-rules.md) | cards in a set fill the row as a grid; no page, card or form caps its width (a check refuses it); every page body one of four layouts; each library one job; P547-P548 |
| [The Audit log in colour, and sign-ins by browser](2026-11-24-audit-log-colour.md) | each row's section in its sidebar colour, refused and failed rows edged red and amber, a sign-in's browser in a few words; P565-P566 |
| [Verification log, 2 and 3 November](2026-11-02-to-03-verification-log.md) | the log's rows of those days, moved when it passed its size |
| [Verification log, 4 to 21 November](2026-11-04-to-21-verification-log.md) | the log's rows of those days, moved when it reached its size |
