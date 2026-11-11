---
title: "Records: the index of dated records"
status: living
owner: vendor
last_verified: 2026-11-03
sources: [the records in this folder]
---

# Records

> **In plain words.** Every bigger change to the kit has a dated record here: what changed, why,
> and how it was checked. A record is frozen once written; a later change is a new record. This
> page lists them all, oldest first, so [the main index](../README.md) stays small enough to load
> whole. The docs gate counts a record as indexed when this page links it.

The records, each dated and frozen once written, with its decisions and how it was verified:

| Record | What it tells |
|---|---|
| [Phase 0: the repository basics](2026-10-19-phase-0-repository-basics.md) | what the first commit set up, why |
| [Phase 1: the toolchain and the configuration layers](2026-10-19-phase-1-toolchain-and-core-config.md) | what the toolchain and the first core package are |
| [The licence change](2026-10-20-licence-change.md) | why Apache-2.0 was replaced by the Oltrem Licence, the terms chosen, and what still needs a lawyer |
| [Phase 1: the command-line tool](2026-10-20-cli-manifest-check-and-doctor.md) | what the manifest check and the doctor are |
| [Phase 1: the core runtime](2026-10-20-core-runtime-packages.md) | what the five runtime packages are |
| [Phase 1: the design kit](2026-10-20-core-ui-tokens-and-primitives.md) | what the theme and the primitives are |
| [Phase 1: the client template and the setup command](2026-10-20-client-template-and-setup.md) | what the template and the migration and setup commands are |
| [Phase 1: the three widgets](2026-10-20-core-ui-widgets.md) | what the combobox, the menu and the date range are |
| [Phase 1: the generated reference](2026-10-20-cli-docs-command.md) | what `oltrem docs` writes in a client repository |
| [Phase 1: the two check commands](2026-10-20-cli-check-commands.md) | what `oltrem check agents` and `check tokens` refuse in a client repository |
| [Phase 2: the permission model and the check](2026-10-20-iam-model-and-check.md) | what the IAM module's tables, registry, compiler and check are |
| [Phase 2: sessions and the authorizer](2026-10-20-iam-sessions-and-authorizer.md) | how the compiled map travels in one KV record per person, the pipeline's session hook and authorizer |
| [Phase 2: governance](2026-10-20-iam-governance.md) | who may change access, and the second person |
| [Phase 2: the Vendor and the handover](2026-10-20-iam-vendor-and-handover.md) | the one company, its first Owner, the handover |
| [Phase 2: the routes](2026-10-20-iam-routes.md) | the IAM module's JSON routes |
| [Phase 2: the users module](2026-10-21-users-module.md) | the second module: the directory and the profile, the switch and its rules, how a module stands on the IAM module |
| [Phase 2 in the client template](2026-10-21-template-mounts-iam.md) | the template's Worker runs IAM and users; the Access audience secret |
| [The Vendor's address](2026-10-21-vendor-address.md) | the command that writes the Vendor's address after the first deploy, why it is in no file |
| [Phase 3: capabilities on the manifest](2026-10-21-module-capabilities.md) | how a module declares what its routes check, how the Worker registers it at its start and keeps the check current |
| [Phase 3: jobs and the tick](2026-10-21-jobs-and-the-tick.md) | how a module declares its periodic work, how the one tick runs it under a lease and records it |
| [Phase 3: health and the manifest's last data fields](2026-10-21-health-and-manifest-fields.md) | how a module declares health checks, migrations, settings, errors |
| [Phase 3: the module generator](2026-10-21-the-module-generator.md) | how `oltrem new module` writes a module |
| [Phase 3: the generated references](2026-10-21-generated-references.md) | how a client's reference reads its modules by importing them in Node, what the Modules page shows |
| [Phase 3: the capability version gate](2026-10-21-capability-version-gate.md) | why a module's version must move with its capabilities, how `oltrem docs` refuses a change made under the same version |
| [Phase 4: envelope encryption](2026-10-21-envelope-encryption.md) | how a stored credential is sealed and its key rotated |
| [Phase 4: providers as data](2026-10-21-providers-as-data.md) | a provider as a definition, never an adapter; the seven email definitions; an instance's sealed key and failover place |
| [Phase 4: the email adapters](2026-10-21-email-adapters.md) | how one HTTP adapter and one SMTP client send through every email definition, the auth schemes, the probe route |
| [Phase 4: the webhook verifiers](2026-10-21-webhook-verifiers.md) | how a provider's delivery report is checked by its own signature scheme and becomes the kit's delivery events |
| [Phase 4: provider detection](2026-10-21-provider-detection.md) | how a domain's public DNS suggests the providers it already uses, why a suggestion never sends by itself |
| [Phase 4: the email module](2026-10-21-email-module.md) | how a message is checked, held while no provider is ready, and sent once through the active instance or a failover |
| [Phase 4: the delivery reports' address](2026-10-21-delivery-reports.md) | why one public path skips the door, how a report is checked |
| [Phase 4: key recipes](2026-10-21-key-recipes.md) | how a module declares the Worker secrets it needs, the KEK's recipe, the Key recipes page, the check |
| [Phase 5: the age format](2026-10-21-age-format.md) | how a backup copy is locked in the standard age format with no package, why the private key never reaches the Worker |
| [Phase 5: the backup module](2026-10-21-backup-module.md) | how the nightly copy is asked of Cloudflare, encrypted on its way into the bucket and recorded, the one Workflow that runs it step by step |
| [Phase 5: the restore drill](2026-10-21-restore-drill.md) | how the newest backup is proven to open and load |
| [Phase 5: the GitHub module](2026-10-21-github-module.md) | how the portal learns its kit version, a newer release and its last deploy without a GitHub token |
| [Phase 5: the free plan's budgets](2026-10-21-free-plan-budgets.md) | what System health measures against the free plan, how the jobs pause, the token widened |
| [Phase 4 in the client template](2026-10-21-template-mounts-email.md) | the template's providers and email, the sending address |
| [Phase 5 in the client template](2026-10-21-template-mounts-backup.md) | the template's backup, deploy report and budgets, the Workflow and its schedules, the runtime stand-in for Node |
| [Phase 5: the backup's setup](2026-10-21-backup-setup.md) | the backup's settings and bucket rules, set once after the first deploy |
| [Phase 5: the Actions minutes](2026-10-21-actions-minutes.md) | how `oltrem doctor` reads the month's GitHub Actions minutes |
| [Working on Windows](2026-10-21-windows.md) | why `npm install` cannot install the kit, the Windows fixes, the line endings |
| [Working on Windows: the second run and pnpm dev](2026-10-21-windows-second-run.md) | the second Windows run's fixes, what `pnpm dev` shows |
| [Phase 6: oltrem upgrade](2026-10-21-oltrem-upgrade.md) | what an upgrade checks before it writes |
| [Verification log, 19 and 20 October](2026-10-19-to-20-verification-log.md) | the log's first rows, moved there unchanged |
| [Verification log, 21 October](2026-10-21-verification-log.md) | its first rows, moved |
| [Verification log, 21 to 24 October](2026-10-21-to-24-verification-log.md) | the rest of 21 October and 22 to 24 October, moved |
| [Verification log, 27 October, first part](2026-10-27-verification-log.md) | the first twenty-six rows of 27 October, moved |
| [The screens and two commands](2026-10-21-screens-and-npm.md) | `npm install`, `npm run dev`, the local sign-in, why the Worker renders the screens |
| [The screens that change things](2026-10-21-people-and-access-screens.md) | the forms for people, roles, places, email providers and settings, and how a form travels |
| [Phase 3: alerts](2026-10-21-alerts.md) | how a lasting problem is emailed once, held in the quiet hours, acknowledged and resolved |
| [Phase 3: Home widgets](2026-10-21-home-widgets.md) | how each module gives Home one card, and who sees it |
| [Audit page and seal](2026-10-21-audit-seal-and-export.md) | the log read, exported, sealed nightly |
| [See it as](2026-10-21-see-it-as.md) | one person's access shown, read only |
| [One command deploy](2026-10-21-one-command-deploy.md) | `npm run deploy` |
| [Deploy, first run](2026-10-21-deploy-first-run.md) | fixes |
| [Deploy screen](2026-10-21-deploy-screen.md) | questions explained |
| [Door, nothing copied](2026-10-21-door-without-copying.md) | Access on the Worker |
| [Portal frame](2026-10-22-portal-frame.md) | sidebar, theme, sign-in email |
| [Every page, phone menu](2026-10-22-every-page-and-phone-menu.md) | tiles, filters, drawer |
| [Your own records](2026-10-22-your-own-records.md) | lists, fields, permissions by place |
| [Forms and inbox](2026-10-22-forms-and-inbox.md) | website forms, inbox, replies |
| [Phase 6: versions and release notes](2026-10-21-changesets.md) | why Changesets, the version groups, what publishing still needs |
| [Client code checks](2026-10-24-client-code-checks.md), [two](2026-10-24-client-code-checks-part-two.md) | kit files, modules, packages, keys, size |
| [Automatic release](2026-10-24-automatic-release.md) | restore point, health, step back |
| [Operations menu](2026-10-24-operations-menu.md) | five jobs, no command line |
| [Actions minutes](2026-10-25-actions-minutes.md) | verify off push |
| [Automatic audit](2026-10-27-automatic-audit.md) | every change recorded by the pipeline, the audit page's filters |
| [Module pages](2026-10-27-module-pages.md) | a module brings its own pages and sidebar sections |
| [Portal makeover](2026-10-27-portal-makeover.md) | the new look, page-to-page motion, pages fetched ahead |
| [Files module](2026-10-27-files-module.md) | a drive per place opened by the roles there, links that end, the trash |
| [Campaigns module](2026-10-27-campaigns-module.md) | bulk email from a CSV file in chunks, one-click unsubscribe, suppression |
| [Developer module](2026-10-27-developer-module.md) | the jobs page, signed webhooks from the audit log, the API reference |
| [Automations module](2026-10-27-automations-module.md) | when something happens or on a schedule, an email or an alert; website answers audited |
| [Analytics module](2026-10-27-analytics-module.md) | the portal's activity by day, area and action, from the audit log, in charts and a CSV |
| [Access screens](2026-10-27-access-screens.md) | My access, requests and approvals, access reviews on the phone; expiry emails and the review check |
| [Needs you](2026-10-27-needs-you.md) | Home opens with what waits for the person signed in, from each module |
| [Privacy module](2026-10-27-privacy-module.md) | privacy requests answered on time: one search for a person's data across the portal, a copy once their identity is checked |
| [Tasks module](2026-10-27-tasks-module.md) | work given to people at a place, by a day, on Home and by email; automations make them too |
| [Approvals module](2026-10-27-approvals-module.md) | ask for a yes at a place; whoever decides there answers, never their own, a no with its reason |
| [Announcements module](2026-10-27-announcements-module.md) | notices to the people at a place, on Home until read, confirmed when they must be, who has read them |
| [Bookings module](2026-10-27-bookings-module.md) | rooms, vehicles and equipment booked by the hour on the company's clock, never twice at once |
| [The jobs within the queries of one tick](2026-10-27-jobs-query-budget.md) | each job's queries counted; what does not fit waits for the next tick |
| [Time off module](2026-10-27-timeoff-module.md) | days off asked at a place, answered by whoever decides there, counted against the vacation days a year; who is off, never why |
| [Expenses module](2026-10-27-expenses-module.md) | what people spent claimed back with the receipt, answered and marked paid at a place, a month as a spreadsheet for the accountant |
| [Equipment module](2026-10-27-assets-module.md) | who holds which laptop, phone or key, every hand-over kept, and what people whose account is off still hold |
| [Time clock module](2026-10-27-timeclock-module.md) | clocking in and out at a place, the week's hours, missed clock-outs fixed with why, the hours for payroll; the company's clock moved to the core |
| [Customer sign-in](2026-10-27-customer-sign-in.md) | customers sign in at /account with an emailed code, outside Access |
| [Shifts module](2026-10-27-shifts-module.md) | who works when at each place: drafts, the week published and emailed, open shifts taken, changes told |
| [Customer sign-in services](2026-10-27-customer-sign-in-services.md) | "Continue with" any OpenID Connect service |
| [Customer account sections](2026-10-27-customer-account-sections.md) | each module adds the customer's own things to their account page; forms shows the messages they sent and the replies staff sent them |
| [Files shared with customers](2026-10-27-files-shared-with-customers.md) | staff share a file with a customer, who downloads it from their account page, signed in, with no link to leak |
| [Quotes module](2026-10-27-quotes-module.md) | staff send a customer a price, line by line; the customer accepts or declines it on their account page, and the maker is told |
| [Invoices module](2026-10-27-invoices-module.md) | bill a customer; paid once; overdue in Needs you |
| [The kit's look in a terminal](2026-10-27-terminal-look.md) | one look for install, dev, update, deploy |
| [The setup page](2026-10-27-setup-page.md) | `npm run setup` puts a portal on Cloudflare with a page in the browser that asks each question and shows the progress, in the portal's look |
| [One-click setup](2026-10-28-one-click-setup.md) | a file to double-click on each system opens a start page; the deploy picks the account and domain, checks the key on paste and notices the door |
| [Setup that explains, repairs and hands over its details](2026-10-28-setup-help-and-repair.md) | each step explains and repairs itself |
| [A sidebar without reloads](2026-10-28-sidebar-without-reloads.md) | pages open in place with the sidebar kept; icons only when closed; groups |
| [Email statuses and the do-not-mail list](2026-10-28-email-statuses.md) | each email keeps its outcome; hard and soft bounces apart; bounces and spam reports stop all mail |
| [Sender addresses and sending domains](2026-10-28-senders-and-domains.md) | the portal sets up the company's domain with Resend or Brevo, checks it daily, and campaigns send only from a passing domain |
| [Saved email templates](2026-10-28-saved-templates.md) | designs from blocks or HTML, every version kept |
| [Saved email lists](2026-10-28-saved-lists.md) | who bulk mail goes to, from a file or typed, each with a reason; the do-not-mail list at every send |
| [The bulk sending engine](2026-10-28-bulk-sending-engine.md) | batch calls sized by the plan; nothing sent twice; large sends need a second person |
| [The watch over bulk mail](2026-10-28-bulk-mail-watch.md) | a campaign pauses itself above Gmail's limits |
| [Writing email like a mail app](2026-10-29-mail-write.md) | a Write page with Cc and Bcc, addresses from the provider, drafts, Send later and ten seconds to Undo; mail split into Messages and Mail settings |
| [A shorter sidebar, tabs and compact buttons](2026-10-29-shorter-sidebar.md) | main pages only, in five groups; sub-pages as tabs |
| [Ready to send](2026-10-31-ready-to-send.md) | the portal checks all an email needs to leave, provider account included, says what to do, and checks hourly |
| [The start page, remade compact](2026-10-31-start-page-remake.md) | each fact once, a fix as one command with Copy, errors counted; no pnpm warning when the kit fetches it |
| [The email pages, remade as a console](2026-10-31-email-console-remake.md) | every email page remade with the kit's console pieces |
| [Templates on Write, and who may use code](2026-10-31-write-templates-and-code.md) | letters and designs picked on Write, fields filled from To; code only with its permission; preview, save as template |
| [Setup remade; the door keeps itself; parts](2026-10-31-setup-door-parts.md) | a failed deploy's network cause, setup in sections, more sign-ins, the door kept by the Worker, parts off, access console |
| [Access, roles, settings and parts redesigned](2026-10-31-access-settings-redesign.md) | company first; a role per part; invite with role and place |
| [Standard admin terms](2026-10-31-standard-admin-terms.md) | Modules, Users, Locations, overrides, View, Edit, Admin |
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
| [Verification log, 27 to 31 October](2026-10-27-to-31-verification-log.md) | the log's rows of those days, moved when it passed its size |
| [The start page as a dashboard](2026-10-29-start-dashboard.md) | each start takes the newest kit, installs and checks; the page runs the portal |
| [Email allowance, and code kept once](2026-10-28-email-allowance-and-shared-code.md) | what each provider has left; bulk mail never past it; four helpers kept once |
| [Generated module pages](2026-10-27-module-generator-pages.md) | a client's new module has permissions and a sidebar page from its first deploy |
| [Email made to work like Gmail](2026-11-11-gmail-style-email.md) | Oltrem Mail's stars, labels, keyboard shortcuts, top bar and Usage and limits taken in; core-ui's mail pane in Gmail's groups with More, Labels and gauges, label colours, the top bar and its menus |
| [Everyday email out of Gmail's Promotions tab](2026-11-11-gmail-primary.md) | everyday email untracked and sent through a provider that does not track first; Brevo, Sender marked as always tracking; Ready to send says when every provider tracks |
| [A coded HTML email sent as designed, and noticed when pasted](2026-11-11-coded-html-intact.md) | one web font `@import` no longer empties the whole style sheet: only the risky line goes; Outlook comments, ids and http links stay; rules inlined by specificity; HTML code pasted into the message box turns it to HTML |
| [The portal's own name and icon, the Inter font, and lighter page moves](2026-11-11-portal-name-icon-font.md) | Name and icon on Settings for the Owner and the Vendor (initials, 32 icons or a picture made small on the device), the tab's icon, Inter, the page alone on a move, figures that glide; the CPU per page measured |
| [The Settings page redesigned, the Vendor never asked to sign in again, refusals that fail once](2026-11-11-settings-page-design.md) | figures, an icon and colour per section, a section list that stays in view, Colours for everyone on Settings; no fresh sign-in for the Vendor; an email every provider refused for itself fails once |
| [A blank CSV template, and a livelier campaign page](2026-11-11-campaign-page-design.md) | a blank CSV on the campaigns page and in a campaign's list step, the four steps as coloured cards with a Next marker and a progress bar, icon chips, a drop zone for the file |
| [Campaigns: any CSV, a sample list, template fields in any spelling, the provider's answers](2026-11-11-campaigns-csv-fields-runs.md) | a sample CSV, any client file read and sent in parts, fields like `*\|FNAME\|*` or `{phone}` listed with the column that fills them, the provider's words and the fix in the Run log |
| [Campaigns kept tidy, and Run now for a scheduled campaign](2026-11-11-campaigns-tidy.md) | Delete blank drafts in one press, Archive finished with an Archived chip and Take out of the archive, Run now starting a campaign set for later |
| [Compose as one window, and the phone's bar back at the top](2026-11-11-compose-and-phone-bar.md) | Compose's tinted head with the pen and a Ready to send chip, the fields flush, the message to the foot of the screen; on a phone a bar along the top opens the sidebar, nothing along the bottom |
| [The setup page: another Vendor, and a new look](2026-11-11-setup-page-look.md) | step 2 offers Add another Vendor; the start page and the seven steps in the Look 3 design: a band with the next move, a progress ring, steps on one line, role chips, motion |
| [Every push to the kit updates every client's portal](2026-11-11-fleet-updates.md) | `oltrem fleet` in one Workers Builds connection in the Vendor's account: the test portal first, each client from its own recorded choices, skipped when current, a GitHub issue when one does not update |
| [The sidebar tidied](2026-11-11-sidebar-tidy.md) | every row on one column, the bell inset, 18 px icons on the closed rail's centre line, the portal's mark at its top, no scroll bar and a soft fade |
| [Pages that move like the owner's clips](2026-11-11-page-motion.md) | panes and figures that sharpen in turn, numbers that count up, meters that fill, columns that grow, a marked tab, filter or section that glides, a slow page that dims |
| [Email settings made easy to start](2026-11-10-email-easy-start.md) | three numbered steps, a full example sender address to tap, info notes behind round buttons, a provider's domain added and checked by itself |
| [Email's panes, and Ready to send that checks itself](2026-11-10-email-panes.md) | one slim head and the same folders on every Email page, the delivery log too (`frames`); panes that slide; Ready to send re-checks by itself; a send-only key's domain proven by real sends or a test email |
| [Database reads, the timer's CPU, and the newest campaigns](2026-11-10-reads-cpu-and-campaigns.md) | why the campaign pages read so many rows and the server-side fix; why browser storage, tokens and KV would not help; the tick every minute with three jobs a run; Oltrem Mail's campaign steps and Run now taken in |
| [The Users pages remade](2026-11-11-users-pages.md) | no sign-in check and no end date by default, a searchable list with roles and last sign-in, role cards, a person's summary and pages for sessions and activity, a one-form permission override, Users & access in the sidebar |
| [Each page's queries pinned, and `pnpm cpu`](2026-11-11-page-costs.md) | each page's database queries pinned in the screens test so a rise of one is caught; `pnpm cpu` ranks every page and the cron tick by CPU on this computer; lazy loading and D1 read copies looked at and not built |
| [Write asks before it sends, and fits a phone](2026-11-11-write-smarter.md) | the To box reads pasted lists, names and duplicates; suggestions ranked by who is mailed most; Send asks once about a misspelt address or a file spoken of; leaving with words typed asks first; Write on a phone edge to edge with Back in its head |
