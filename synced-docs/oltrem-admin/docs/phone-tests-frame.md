---
title: "Phone tests owed: Home and the frame"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [docs/phone-tests.md, which held these lines until 2026-11-26; the records each line links]
---

# Phone tests owed: Home and the frame

> **In plain words.** The phone tests still owed on Home and the frame every page sits in, split
> from [the main list](phone-tests.md) so each list stays small enough to read whole. They run
> the way that list says; a passed or failed line is noted there.

From [record](../archive/records/2026-11-12-instant-pages.md):

| # | Open | You should see |
|---|---|---|
| P153 | Open Users, then Settings, then press Back; open Settings again from the sidebar | Back shows Users at once; Settings opens at once the second time. Remove someone's access on another device and press Back on theirs: the page shows, then the refusal replaces it |

From [record](../archive/records/2026-11-12-ui-foundation.md):

| # | Open | You should see |
|---|---|---|
| P157 | Home, light and dark; then the setup page (`oltrem deploy --page`) | The sidebar mark, Home's welcome band and the setup page's mark and main button are one solid colour, with no glow under them; buttons look as before |

From [record](../archive/records/2026-11-12-no-wasted-room.md):

| # | Open | You should see |
|---|---|---|
| P164 | Users, Roles and Settings on the phone, then on a computer | Title and main button on one line; search and filters right under; content in the top fifth; no empty side band |
| P165 | Roles; then Create role | Each role is a card in its own colour (the Owner amber), with a bar of its permissions and who holds it; in Create role the modules are coloured cards (two columns on a computer) and the save bar runs the full width at the foot |
| P166 | Settings, then Settings, Modules | Settings fills the width, its sections cards with a coloured head (two columns on a wide screen); the counts are slim pills; Modules are tinted cards, an off one plain |
| P167 | System status: press **Copy the report for an AI** and paste it in a note; press **Check again now** | The paste names every check, the budgets and alerts; each problem links to its fix; checks run again within five minutes |
| P168 | Email settings, Integrations | Brevo, Resend, Mailgun and Mailtrap show their logos; **Get a key** and **Docs** open the provider's own page in a new tab; a dropdown in a card opens in full, not cut off |
| P169 | Addresses: scroll so a default address's dropdown sits near the foot of the screen, then open it; then open one near the top | Near the foot its choices open upward over the line, all of them visible; near the top they open downward |

From [record](../archive/records/2026-11-12-bold-look-and-role-pages.md):

| # | Open | You should see |
|---|---|---|
| P170 | Records, then Tasks, then System status, then Users | Each page in its section's colour (green Work, blue Users, violet System): the picked filter, an empty list's icon |
| P171 | Open a dialog with a long list in dark mode (Addresses, Edit), and scroll | The scrollbar is slim, in the page's colour, with no grey track and no arrows |
| P172 | Roles | One even list: each role a row with its name, what it reaches, a bar and count of permissions, who holds it and an arrow; the three ready sets on one line under it |
| P173 | Open a role, then a module's arrow; scroll to the foot | Levels a segmented control; a module opens without stretching its neighbour; special permissions are rows with a box; the save bar never covers "Who holds it" |
| P174 | Tap the heading of a sidebar group (Users & access), open another page, then reload | The group folds shut with its arrow turned and stays shut on the next page; the group of the page you are on is always open |

From [record](../archive/records/2026-11-12-system-status-report-fixes.md):

| # | Open | You should see |
|---|---|---|
| P175 | System status and Alerts, an hour after the update | No `iam.door` line; the old "Every email provider refused the message" alerts are under resolved, not open, and Home's Open alerts count dropped to the few still recent |
| P176 | Settings, Modules, Audit log: switch **Daily seal** off and save; then System status | No `audit.sealed` line, and `jobs.runs` is OK even though the seal job stays paused |
| P177 | System status, the budgets line, before and after setting a new `KIT_OPS_TOKEN` in the Worker's Variables and Secrets | Before: says what key to make; within fifteen minutes after: each budget shows today's figure |
| P179 | Your inbox and Alerts, a day after the update, with ImprovMX connected on Forwarding | No new "Forwarding addresses not all asked about" email; that alert is under resolved, not open |

From [record](../archive/records/2026-11-12-change-permissions-page.md):

| # | Open | You should see |
|---|---|---|
| P178 | Users: open someone who is not an Owner, then Change permissions; untick one that says From their roles, tick one that says Not in their roles, Save changes | Boxes ticked as they have it, with why; after Save: Taken away, Given to them, each with Reset |

From [record](../archive/records/2026-11-13-plain-cards-and-module-list.md):

| # | Open | You should see |
|---|---|---|
| P180 | Settings, then Modules; untick Analytics, then tick it again; Save | One list per group, each row an icon, name, words and a box lined up with the rows above; Analytics' icon goes grey while unticked; extras sit under their module |
| P181 | Home, Email settings > Integrations, and Tasks with nothing in it | Cards are white with colour only in the icon or logo; the empty Tasks box is short, with no glow |

From [record](../archive/records/2026-11-13-cloudflare-key-from-the-phone.md):

| # | Open | You should see |
|---|---|---|
| P182 | System status, while the key is still refused | A box above Checks, "Cloudflare does not accept the portal’s key", with three steps; Open the key form opens Cloudflare with D1 Edit and Account Analytics Read chosen |
| P183 | Make the key, set it as `KIT_OPS_TOKEN` in the Worker's Variables and Secrets, then Check again now | The box is gone and each budget shows today's use; Daily seal's Fix button opens Modules |

From [record](../archive/records/2026-11-13-email-menu-on-a-phone.md):

| # | Open | You should see |
|---|---|---|
| P187 | Home, then Users; tap ☰ each time, then outside the drawer | The menu opens every time at your page; a tap outside closes it |

From [record](../archive/records/2026-11-13-find-pages-and-jump-back.md):

| # | Open | You should see |
|---|---|---|
| P188 | Open three pages, tap Search, type "back", tap Backups | The box lists recent pages; typing finds Backups, which opens |
| P189 | Home, after opening a few pages; then Sign out and in again | "Jump back in" shows a chip for each page you opened; after signing out it is gone until you open pages again |

From [record](../archive/records/2026-11-13-users-page-and-motion.md):

| # | Open | You should see |
|---|---|---|
| P190 | Tap Users, then each tab | One Users row in the sidebar; the page has a sideways row of tabs, the open one underlined |
| P191 | On Users, tap Roles, Groups, Roles; open a role, press Back | Pages slide right going forward, left going back; the underline glides |
| P192 | Tap a group's heading twice in the menu; open a dialog | The group folds and opens smoothly; drawers and shades leave as they came |

From [record](../archive/records/2026-11-13-reads-and-changes-at-once.md):

| # | Open | You should see |
|---|---|---|
| P193 | Email, Inbox: tick two conversations and press Archive; then press the star on another | The two rows go the moment you press, with no dimming; the star turns at once; after a moment the list is the same |
| P194 | Email, Inbox: on a bold (unread) conversation use Mark as read, then Snooze on another | The row turns plain at once; the snoozed row leaves the list at once |
| P195 | Turn on flight mode, press the star on a conversation, then turn it off | The star turns, then turns back, and the page says the change may not have been saved |

From [record](../archive/records/2026-11-14-home-makeover-and-header-bell.md):

| # | Open | You should see |
|---|---|---|
| P196 | On a computer, any page; then Notifications | A round bell at the head's right with the unread figure; no Notifications row in the sidebar |
| P197 | Home on the phone | A greeting with today's date; three dials whose rings draw; a dial jumps to its part |
| P198 | Home, At a glance | One lined-up list, what needs a look first; a tap opens the page |

From [record](../archive/records/2026-11-14-quiet-off-and-switches.md):

| # | Open | You should see |
|---|---|---|
| P199 | Backups, then Audit log | Switches under the title; a flip saves at once and says Switched |
| P200 | System status: press Turn off beside a warning | The warning goes; its alert closes within minutes |

From [record](../archive/records/2026-11-14-loading-orb-and-status-list.md):

| # | Open | You should see |
|---|---|---|
| P202 | Open a page on a slow connection | An orb of dots in a chip at the top, no line |
| P203 | Press Save on a setting | The orb turns inside the button until the answer |
| P204 | System status | Only problems listed, buttons on their row; "N checks pass" opens the rest |

From [record](../archive/records/2026-11-14-sidebar-rail-and-notifications-panel.md):

| # | Open | You should see |
|---|---|---|
| P205 | Sidebar closed: tap rows in each group | Icons stay put; the tint glides to the row tapped, never wider than the rail |
| P206 | Bell on any page; Unread; close | A panel over the page; Unread stays in it; X, Escape or outside closes it |
| P207 | Write on a computer: ⋮ More | A card over the message, not in the bar; a tap outside closes it |
| P208 | Write: drop or paste a file; ⋮ and template | No page scroll; file attached; one bar, cards whole |
| P209 | Sent: open one | Coloured tags; subject with Forward, Send again |

From [record](../archive/records/2026-11-14-page-heads-on-a-band.md):

| # | Open | You should see |
|---|---|---|
| P210 | Users, then Records | Head and tabs on a tinted band; Invite people on the head's line |
| P211 | Users on a computer: the filters | Who and Role in two trays; counts as badges |
| P212 | System status, Settings | Tabs with icons; each section heading with a colour mark |

From [record](../archive/records/2026-11-14-switched-off-pages-and-head-menus.md):

| # | Open | You should see |
|---|---|---|
| P225 | Bulk mail off in Modules; a list with contacts: Send email, then Switch on Bulk mail | "This page is part of Bulk mail"; the press opens New campaign to that list, saying Switched on |
| P226 | A list's ⋮ (with Bulk mail on and off); then Edit name and description | The menu opens just under the ⋮ and fades in, then fades out on a tap elsewhere; the edit window opens |

From [record](../archive/records/2026-11-12-quiet-portal.md):

| # | Open | You should see |
|---|---|---|
| P149 | After the deploy, move between Home, Users, Settings, Email and back, a few times | Each page opens sooner than before; the bell still shows its number and every tab is there |

From [record](../archive/records/2026-11-12-screen-actions-behind-the-door.md):

| # | Open | You should see |
|---|---|---|
| P132 | On the live portal, once the fleet has updated it (no deploy needed): Look and colours, tap a palette; the account menu, tap a colour dot; then a theme icon, and close and open the sidebar | The colours change at once and stay after a reload; no "Not signed in" (KIT-E-0401) page |

From [record](../archive/records/2026-11-11-portal-name-icon-font.md):

| # | Open | You should see |
|---|---|---|
| P130 | Home, then leave it open a minute while an email goes out or a task changes | A figure that changes glides to its new number instead of jumping |
| P129 | Tap from Home to People, Settings and Email | The sidebar stays where it was scrolled and marks the new page; pages open a little quicker; the letters are the new font, Inter |
| P128 | Settings, Name and icon: Upload a picture, pick a logo from the phone, Save | The picture shows in the tile, the sidebar, the top bar and the tab; it stays after a reload; a file that is not a picture is refused in words |
| P127 | As the Vendor or an Owner: Settings, Name and icon: type a new name, tap an icon, Save | The sidebar, the phone's top bar and the browser tab show the new name and icon; Initials puts the letters back |

From [record](../archive/records/2026-11-11-setup-page-look.md):

| # | Open | You should see |
|---|---|---|
| P125 | On the PC: the start page (`npm start`), Overview and Put it on Cloudflare; narrow and dark too | A band names the next move; tiles have icons; a ring shows the steps done; the steps sit on one line |
| P124 | On the PC: `npm run setup`; at step 2 pick Add another Vendor, type a second address of yours | The next list has it with the Another Vendor chip; after the deploy it signs in as a Vendor |

From [record](../archive/records/2026-11-08-look-3-pages.md):

| # | Open | You should see |
|---|---|---|
| P90 | Email settings, Integrations, before email is set up: Ready to send | Each check that stops email says what to do in a soft coloured box you can press, not a long underlined line; the letters on the service tiles are easy to read |
| P79 | Email in the sidebar, then its tabs row | The page that lists every email sent is called Delivery log, in the tabs row and as its heading (no Activity) |
| P78 | System status, Alerts, with nothing open; then Roles | An empty list shows a calm box with its sentence centred, not a thin strip; the roles sit on a white card |
| P77 | Settings: change one value (a time zone, or a switch), then press Save changes in the dark bar that rises at the foot; then change one and press Discard | No Save on each row; the bar appears only once something changed, says "Your changes were saved" after Save, and Discard puts the value back |
| P76 | Home, then any other page from the menu | Home opens with a coloured Welcome back band saying what waits, with a chip to Get started; Get started has a bar of the steps done; each page's parts come in one after another, quickly; with reduce motion on, nothing moves |

From [record](../archive/records/2026-11-08-look-3-foundation.md):

| # | Open | You should see |
|---|---|---|
| P74 | Settings, Users or any page with a switch or a tick box; then wait on a page that shows a toast (save something) | Switches and tick boxes are round, smooth and in the portal's colour, also in dark; the toast draws a line that empties over six seconds and stops while your finger is on it |
| P73 | Any page: open your account (Menu, then your name at the foot), press the green dot; then the moon icon | The colours change in a circle spreading from the dot, the menu stays open on the same page; dark mode spreads the same way. With reduce motion on in the phone's settings, it just changes |

From [record](../archive/records/2026-11-11-compose-and-phone-bar.md):

| # | Open | You should see |
|---|---|---|
| P72 | Any page on the phone, scrolled to the bottom | Nothing sits along the bottom any more: the page runs to the foot of the screen; the page's own heading (with its buttons) is under the bar at the top, no empty space above it |
| P71 | Any page on the phone: tap each button of the bar along the top | Menu (left) opens the sidebar as a drawer from the left; the portal's name goes Home; Search and the bell (with its unread figure) open their pages; there is no bar along the bottom |

From [record](../archive/records/2026-11-08-vendor-accounts.md):

| # | Open | You should see |
|---|---|---|
| P68 | On the live portal as the Vendor: People & Access, Vendor access, Vendor accounts: Add a Vendor account with a second address of yours; then sign in with that address on another browser; then, as the first Vendor, Switch off the second | The second address lands on Home as a Vendor with no invite to accept; once switched off, its next page says No account here; your own row has no Switch off |

From [record](../archive/records/2026-11-08-first-run-sign-in.md):

| # | Open | You should see |
|---|---|---|
| P66 | Email settings, Integrations, the Resend service whose last check failed: paste a new key from resend.com/api-keys and press Save the new key | The page says the new key was sealed and checked just now; Last check shows today's time and Worked, and Ready to send turns green (a wrong key shows Resend's answer at once) |
| P65 | On the PC: pull, then `npm run deploy` in the client folder. On a portal with no company yet, open it as the Vendor | The Create the company form shows the Owner named at step 2 as the first Owner, not owner@example.com |
| P64 | On the PC: pull, then `npm run deploy` in the client folder; at step 6 open the link it shows (or let the browser open) and allow cf; stop it once to see it start again 10 seconds later. Then on the phone sign in as the Vendor, make the company if asked; then sign in as a person named at step 2 | Step 6 shows a link and a code and sets the door; the Vendor lands on Home; the named person lands on Home with their role, no Invite or Accept pressed |

From [record](../archive/records/2026-11-05-no-key-door.md):

| # | Open | You should see |
|---|---|---|
| P63 | On the PC: pull, then `npm run deploy` in the client folder; allow cf in the browser when it opens. Then on the phone open the portal as the Vendor, and as an address nobody invited | The deploy says the door is set; the phone gets the email-code page (no "Cloudflare" button), the Vendor lands on Home, the stranger reads "No account here" |

From [record](../archive/records/2026-11-05-dead-key.md):

| # | Open | You should see |
|---|---|---|
| P62 | The live portal, after its new key (replaced by P63: the door needs no key now): open its address as the Vendor | Cloudflare's page asks for your email and sends a code, no "Cloudflare" button; after the code, the portal loads |

From [record](../archive/records/2026-11-04-setup-people.md):

| # | Open | You should see |
|---|---|---|
| P61 | After Update it: Users, under Named at setup press Invite all; then on another phone (or a private tab) open the portal as one of those people and enter the code from the email | Users says the invitations are made and no email is needed; the other person lands on "You are invited … as Member" (or Admin, Owner), presses Accept and sees Home |

From [record](../archive/records/2026-11-04-sign-in-and-static-files.md):

| # | Open | You should see |
|---|---|---|
| P60 | The live portal, after Update it: open its address, enter the code from the email | Home loads with its look (colours, the sidebar), not "Not signed in"; a second page opens without a reload |

From [record](../archive/records/2026-11-04-colour-pass.md):

| # | Open | You should see |
|---|---|---|
| P59 | In the dark theme: Email, Write, then Settings, then Look and pick two other palettes | main buttons are a deep colour with white text, not pale with dark text; text boxes a shade darker than their card; a switch that is on has the same deep colour; links and tabs still light and easy to read |

From [record](../archive/records/2026-11-04-phone-top.md):

| # | Open | You should see |
|---|---|---|
| P58 | Email, Templates, then Users, then a list in Records | the bar says Email (or Users, Records) with its coloured icon; no second big title or description under it; the tabs right under the bar; a list's own name still shows under the tabs |

From [record](../archive/records/2026-11-03-get-started.md):

| # | Open | You should see |
|---|---|---|
| P1 | Home on a new portal | "Get started: 0 of 5 done", each open step a row; tapping one opens its page |

From [record](../archive/records/2026-10-27-needs-you.md):

| # | Open | You should see |
|---|---|---|
| P2 | Home | Needs you first (or "Nothing waits for you"), then the cards in two columns at most |

From [record](../archive/records/2026-10-28-sidebar-without-reloads.md):

| # | Open | You should see |
|---|---|---|
| P3 | The menu button, then a section | the sidebar slides in over the page; a section opens without the whole page reloading |

From [record](../archive/records/2026-10-29-shorter-sidebar.md):

| # | Open | You should see |
|---|---|---|
| P4 | Any page with tabs (Email, Access) | the tabs as one sideways row under the title, the open one marked |

From [record](../archive/records/2026-10-27-portal-makeover.md):

| # | Open | You should see |
|---|---|---|
| P5 | The theme switch at the foot of the sidebar | light and dark both readable, buttons 40 px tall, fields do not zoom when tapped |

| # | Open | You should see |
|---|---|---|
| P32 | The bell (sidebar, or beside Search on a phone), after someone gives you a task | a figure on the bell; the page lists the task, bold; tapping it opens the task and the figure goes down |
| P33 | Notifications, How you are told: switch Tasks' By email off | "Saved" shows at once, no Save button; the next task given to you is under the bell and no email comes |

From [record](../archive/records/2026-11-03-look-2.md):

| # | Open | You should see |
|---|---|---|
| P34 | Any page with chips (Tasks, Access), on a phone and on a computer | small rounded chips on one soft row, the open one tinted in the brand colour; buttons 40 px on the phone and 36 px under a mouse |
| P35 | Save any change (a task done), then a change refused (a form left blank) | "Saved" or "done" comes up at the bottom right (the foot on a phone) and leaves by itself after 6 s; a refusal stays until you press × |
| P36 | Settings, Find a setting; Parts, Find a module | one field with a magnifier and an arrow inside it, no separate big button; the page loads styled straight away |
| P42 | Automations, Files, a booking | the filters (All, On, Off) are soft chips; what you can do (When something happens, Upload a file, New folder) are white buttons with a border, so the two never look alike |
| P43 | Search (the magnifier), Customers, a records list, a form's answers | each search is one field with the magnifier in front and the arrow inside; Enter or the arrow searches |
| P44 | Users → Roles; Developer → Jobs | Roles lists Viewer, Member and Admin under "Start a role from a ready set"; a press opens the editor filled in, named, ready to save. In Jobs each time sits on one line with its cost beneath, and Run soon and Pause are two bordered buttons side by side |

From [record](../archive/records/2026-11-03-role-matrix.md):

| # | Open | You should see |
|---|---|---|
| P37 | Users, Roles, Create role, Start from Member | every module a row with None, View, Edit and Manage always showing (a level the module has not is faded); Set all shown to Manage, then type in Find a module and press None: only the rows shown change; the arrow on Records lists its four permissions; the sentence in the Save bar follows |
| P41 | Users, a user who holds a role: What they can do | one row per module with "3 of 4" and a word (View, Edit, Admin, Custom); the arrow on a row lists each permission and where it comes from |

From [record](../archive/records/2026-11-03-looks.md):

| # | Open | You should see |
|---|---|---|
| P40 | Your account (the foot of the sidebar), Look and colours: tap Emerald, then Dots; then open Tasks; switch the theme to Dark | each tap changes the page at once with a "saved" note; the green and the dots stay on every page and in dark; Back to the portal's own returns the blue |

From [record](../archive/records/2026-11-03-look-2-step-2.md):

| # | Open | You should see |
|---|---|---|
| P46 | Approvals, Automations, Records on a computer; then on the phone | on the computer the page's button sits at the right of the filters (or of the heading on Records); on the phone it has its own row under them; nothing is cut off |
| P47 | Notifications, How you are told, on the phone | one grid, a row per module with two switches, In the portal and By email, all in view without sideways scrolling |
| P48 | Look and colours | each palette a gradient tile, each background a small preview; the one in use ringed; a tap changes the page at once |
| P49 | Users, Locations, Add a location; then Files, a file, Make a link | the add form opens in a dialog; the link comes up in the corner and stays until you press × |

From [record](../archive/records/2026-11-03-look-2-step-3.md):

| # | Open | You should see |
|---|---|---|
| P50 | Bookings, Notifications, Tasks with nothing in them | the same dashed box on each, never a box inside a box |
| P51 | Settings on a computer, then on the phone | on the computer each setting's name and words on the left, its box and Save on the right; on the phone one under the other |
| P52 | As an Owner: Look and colours, pick Forest and Grid, press Make it everyone's look; then sign in as another user | "saved for everyone"; the other user sees green and the grid without picking anything; their own pick still wins on their phone |

From [record](../archive/records/2026-11-03-easier-setup.md):

| # | Open | You should see |
|---|---|---|
| P54 | Home on a new portal, as the Owner: tap Connect an email service | the one-step email setup opens straight away, not the list of integrations |

From [record](../archive/records/2026-11-03-undo.md):

| # | Open | You should see |
|---|---|---|
| P45 | Records → a list → a record → Remove the record | the notice in the corner says it was removed and has Undo; Undo brings the record back with its values; leave it and it stays removed |

From [record](../archive/records/2026-11-15-one-sidebar-and-colour.md):

| # | Open | You should see |
|---|---|---|
| P240 | Home, Users and Settings, press Menu; light and dark | The sidebar tinted with the portal's colour, each icon on a tile of its group's colour, the page on screen a solid tile and bold |
| P242 | Any page, press Menu | The drawer as narrow as the computer's sidebar, no wide blank strip beside the names; a long address ends in … |

From [record](../archive/records/2026-11-28-needs-you-watcher.md):

| # | Open | You should see |
|---|---|---|
| P1080 | Home with an alert open nobody took | One row per alert, worst first, with what to do and a button; Assign to me takes it off |
| P1081 | Integrations: paste a wrong key on a connection and press Check | One email "<name> stopped working"; on Home its row with Check again |
| P1082 | Paste the right key back, then press Check again on Home | The row leaves; Alerts shows it resolved |
| P1083 | Home when backups are two days late | A row with Back up now; it starts a copy, and the row leaves once done |
| P1084 | As Owner, open an app's board in Reports and press the pin by its title | It shows under Home in the sidebar, by the app's name; the pin again removes it |
| P1085 | As a Member, the same portal | The pinned page shows if you may open it; no pin by titles |
