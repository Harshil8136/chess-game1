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
| P125 | On the PC: the start page (`npm start`), Overview and Put it on Cloudflare; narrow and dark too | A band names the next move; tiles have icons; a ring shows the steps done; the steps sit on one line | [record](records/2026-11-11-setup-page-look.md) |
| P124 | On the PC: `npm run setup`; at step 2 pick Add another Vendor, type a second address of yours | The next list has it with the Another Vendor chip; after the deploy it signs in as a Vendor | [record](records/2026-11-11-setup-page-look.md) |
| P90 | Email settings, Integrations, before email is set up: Ready to send | Each check that stops email says what to do in a soft coloured box you can press, not a long underlined line; the letters on the service tiles are easy to read | [record](records/2026-11-08-look-3-pages.md) |
| P79 | Email in the sidebar, then its tabs row | The page that lists every email sent is called Delivery log, in the tabs row and as its heading (no Activity) | [record](records/2026-11-08-look-3-pages.md) |
| P78 | System status, Alerts, with nothing open; then Roles | An empty list shows a calm box with its sentence centred, not a thin strip; the roles sit on a white card | [record](records/2026-11-08-look-3-pages.md) |
| P77 | Settings: change one value (a time zone, or a switch), then press Save changes in the dark bar that rises at the foot; then change one and press Discard | No Save on each row; the bar appears only once something changed, says "Your changes were saved" after Save, and Discard puts the value back | [record](records/2026-11-08-look-3-pages.md) |
| P76 | Home, then any other page from the menu | Home opens with a coloured Welcome back band saying what waits, with a chip to Get started; Get started has a bar of the steps done; each page's parts come in one after another, quickly; with reduce motion on, nothing moves | [record](records/2026-11-08-look-3-pages.md) |
| P74 | Settings, Users or any page with a switch or a tick box; then wait on a page that shows a toast (save something) | Switches and tick boxes are round, smooth and in the portal's colour, also in dark; the toast draws a line that empties over six seconds and stops while your finger is on it | [record](records/2026-11-08-look-3-foundation.md) |
| P73 | Any page: open your account (Menu, then your name at the foot), press the green dot; then the moon icon | The colours change in a circle spreading from the dot, the menu stays open on the same page; dark mode spreads the same way. With reduce motion on in the phone's settings, it just changes | [record](records/2026-11-08-look-3-foundation.md) |
| P72 | Any page on the phone, scrolled to the bottom | Nothing sits along the bottom any more (2026-11-11): the page runs to the foot of the screen; the page's own heading (with its buttons) is under the bar at the top, no empty space above it | [record](records/2026-11-11-compose-and-phone-bar.md) |
| P71 | Any page on the phone: tap each button of the bar along the top | Menu (left) opens the sidebar as a drawer from the left; the portal's name goes Home; Search and the bell (with its unread figure) open their pages; there is no bar along the bottom | [record](records/2026-11-11-compose-and-phone-bar.md) |
| P68 | On the live portal as the Vendor: People & Access, Vendor access, Vendor accounts: Add a Vendor account with a second address of yours; then sign in with that address on another browser; then, as the first Vendor, Switch off the second | The second address lands on Home as a Vendor with no invite to accept; once switched off, its next page says No account here; your own row has no Switch off | [record](records/2026-11-08-vendor-accounts.md) |
| P66 | Email settings, Integrations, the Resend service whose last check failed: paste a new key from resend.com/api-keys and press Save the new key | The page says the new key was sealed and checked just now; Last check shows today's time and Worked, and Ready to send turns green (a wrong key shows Resend's answer at once) | [record](records/2026-11-08-first-run-sign-in.md) |
| P65 | On the PC: pull, then `npm run deploy` in the client folder. On a portal with no company yet, open it as the Vendor | The Create the company form shows the Owner named at step 2 as the first Owner, not owner@example.com | [record](records/2026-11-08-first-run-sign-in.md) |
| P64 | On the PC: pull, then `npm run deploy` in the client folder; at step 6 open the link it shows (or let the browser open) and allow cf; stop it once to see it start again 10 seconds later. Then on the phone sign in as the Vendor, make the company if asked; then sign in as a person named at step 2 | Step 6 shows a link and a code and sets the door; the Vendor lands on Home; the named person lands on Home with their role, no Invite or Accept pressed | [record](records/2026-11-08-first-run-sign-in.md) |
| P63 | On the PC: pull, then `npm run deploy` in the client folder; allow cf in the browser when it opens. Then on the phone open the portal as the Vendor, and as an address nobody invited | The deploy says the door is set; the phone gets the email-code page (no "Cloudflare" button), the Vendor lands on Home, the stranger reads "No account here" | [record](records/2026-11-05-no-key-door.md) |
| P62 | The live portal, after its new key (replaced by P63: the door needs no key now): open its address as the Vendor | Cloudflare's page asks for your email and sends a code, no "Cloudflare" button; after the code, the portal loads | [record](records/2026-11-05-dead-key.md) |
| P61 | After Update it: Users, under Named at setup press Invite all; then on another phone (or a private tab) open the portal as one of those people and enter the code from the email | Users says the invitations are made and no email is needed; the other person lands on "You are invited … as Standard user" (or Full admin, Owner), presses Accept and sees Home | [record](records/2026-11-04-setup-people.md) |
| P60 | The live portal, after Update it: open its address, enter the code from the email | Home loads with its look (colours, the sidebar), not "Not signed in"; a second page opens without a reload | [record](records/2026-11-04-sign-in-and-static-files.md) |
| P59 | In the dark theme: Email, Write, then Settings, then Look and pick two other palettes | main buttons are a deep colour with white text, not pale with dark text; text boxes a shade darker than their card; a switch that is on has the same deep colour; links and tabs still light and easy to read | [record](records/2026-11-04-colour-pass.md) |
| P58 | Email, Templates, then Users, then a list in Records | the bar says Email (or Users, Records) with its coloured icon; no second big title or description under it; the tabs right under the bar; a list's own name still shows under the tabs | [record](records/2026-11-04-phone-top.md) |
| P1 | Home on a new portal | "Get started: 0 of 5 done", each open step a row; tapping one opens its page | [record](records/2026-11-03-get-started.md) |
| P2 | Home | Needs you first (or "Nothing waits for you"), then the cards in two columns at most | [record](records/2026-10-27-needs-you.md) |
| P3 | The menu button, then a section | the sidebar slides in over the page; a section opens without the whole page reloading | [record](records/2026-10-28-sidebar-without-reloads.md) |
| P4 | Any page with tabs (Email, Access) | the tabs as one sideways row under the title, the open one marked | [record](records/2026-10-29-shorter-sidebar.md) |
| P5 | The theme switch at the foot of the sidebar | light and dark both readable, buttons 40 px tall, fields do not zoom when tapped | [record](records/2026-10-27-portal-makeover.md) |
| P32 | The bell (sidebar, or beside Search on a phone), after someone gives you a task | a figure on the bell; the page lists the task, bold; tapping it opens the task and the figure goes down |
| P33 | Notifications, How you are told: switch Tasks' By email off | "Saved" shows at once, no Save button; the next task given to you is under the bell and no email comes |
| P34 | Any page with chips (Tasks, Access), on a phone and on a computer | small rounded chips on one soft row, the open one tinted in the brand colour; buttons 40 px on the phone and 36 px under a mouse | [record](records/2026-11-03-look-2.md) |
| P35 | Save any change (a task done), then a change refused (a form left blank) | "Saved" or "done" comes up at the bottom right (the foot on a phone) and leaves by itself after 6 s; a refusal stays until you press × | [record](records/2026-11-03-look-2.md) |
| P36 | Settings, Find a setting; Parts, Find a module | one field with a magnifier and an arrow inside it, no separate big button; the page loads styled straight away | [record](records/2026-11-03-look-2.md) |
| P37 | Users, Roles, Create role, Start from Standard user | every module a row with None, View, Edit and Admin always showing (a level the module has not is faded); Set all shown to Admin, then type in Find a module and press None: only the rows shown change; the arrow on Records lists its four permissions; the sentence in the Save bar follows | [record](records/2026-11-03-role-matrix.md) |
| P40 | Your account (the foot of the sidebar), Look and colours: tap Emerald, then Dots; then open Tasks; switch the theme to Dark | each tap changes the page at once with a "saved" note; the green and the dots stay on every page and in dark; Back to the portal's own returns the blue | [record](records/2026-11-03-looks.md) |
| P41 | Users, a user who holds a role: What they can do | one row per module with "3 of 4" and a word (View, Edit, Admin, Custom); the arrow on a row lists each permission and where it comes from | [record](records/2026-11-03-role-matrix.md) |
| P42 | Automations, Files, a booking | the filters (All, On, Off) are soft chips; what you can do (When something happens, Upload a file, New folder) are white buttons with a border, so the two never look alike | [record](records/2026-11-03-look-2.md) |
| P43 | Search (the magnifier), Customers, a records list, a form's answers | each search is one field with the magnifier in front and the arrow inside; Enter or the arrow searches | [record](records/2026-11-03-look-2.md) |
| P44 | Users → Roles; Developer → Jobs | Roles lists View only, Standard user and Full admin under "Start a role from a ready set"; a press opens the editor filled in, named, ready to save. In Jobs each time sits on one line with its cost beneath, and Run soon and Pause are two bordered buttons side by side | [record](records/2026-11-03-look-2.md) |
| P46 | Approvals, Automations, Records on a computer; then on the phone | on the computer the page's button sits at the right of the filters (or of the heading on Records); on the phone it has its own row under them; nothing is cut off | [record](records/2026-11-03-look-2-step-2.md) |
| P47 | Notifications, How you are told, on the phone | one grid, a row per module with two switches, In the portal and By email, all in view without sideways scrolling | [record](records/2026-11-03-look-2-step-2.md) |
| P48 | Look and colours | each palette a gradient tile, each background a small preview; the one in use ringed; a tap changes the page at once | [record](records/2026-11-03-look-2-step-2.md) |
| P49 | Users, Locations, Add a location; then Files, a file, Make a link | the add form opens in a dialog; the link comes up in the corner and stays until you press × | [record](records/2026-11-03-look-2-step-2.md) |
| P50 | Bookings, Notifications, Tasks with nothing in them | the same dashed box on each, never a box inside a box | [record](records/2026-11-03-look-2-step-3.md) |
| P51 | Settings on a computer, then on the phone | on the computer each setting's name and words on the left, its box and Save on the right; on the phone one under the other | [record](records/2026-11-03-look-2-step-3.md) |
| P54 | Home on a new portal, as the Owner: tap Connect an email service | the one-step email setup opens straight away, not the list of integrations | [record](records/2026-11-03-easier-setup.md) |
| P55 | Home on a portal whose backups are set up but have no copy yet: press Make it now | "Started" at the bottom right; within minutes Backups lists the copy and the step is ticked (left alone, it starts by itself within a quarter of an hour) | [record](records/2026-11-03-easier-setup.md) |
| P52 | As an Owner: Look and colours, pick Forest and Grid, press Make it everyone's look; then sign in as another user | "saved for everyone"; the other user sees green and the grid without picking anything; their own pick still wins on their phone | [record](records/2026-11-03-look-2-step-3.md) |
| P45 | Records → a list → a record → Remove the record | the notice in the corner says it was removed and has Undo; Undo brings the record back with its values; leave it and it stays removed | [record](records/2026-11-03-undo.md) |

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
| P69 | Email settings in the sidebar | Its tabs in a row: Email settings (connect a service), Addresses, Integrations, Mail setup, Forwarding; Email itself shows Write, Inbox, Drafts, Sent, Templates | [record](records/2026-11-08-email-for-the-client.md) |
| P70 | Email, Write: attach a file over 10 MB, send it to yourself | The email ends with Files to download, the file's name, size and a link; the link downloads it | [record](records/2026-11-08-email-for-the-client.md) |
| P75 | A portal with Mail and a mailbox: Email, Inbox, then open a conversation; on a computer too | Phone: folder chips (Inbox, Updates, Snoozed, Archived, Spam, All, Drafts, Sent) over the list, a round Compose button at the bottom right; a conversation fills the screen with Back to the same list. Computer: folders with Compose on the left, the list, the conversation beside it | [record](records/2026-11-08-email-for-the-client.md) |
| P80 | Email: open Drafts, Sent and one sent email, then Compose; on a computer too | One row of folders (Inbox and its boxes with Mail, Drafts, Sent, a line, Delivery log, Templates) and no second row of tabs; rows show who, a short time, the subject and what became of it; a sent email opens beside the Sent list on a computer and fills the screen with Back on a phone; Compose is a card titled New email; ticking drafts and pressing Delete removes them | [record](records/2026-11-08-email-for-the-client.md) |
| P91 | Email, Compose with no email service connected; then with one connected, on a phone and a computer | With none: a calm card, Email can’t leave yet, with one button (Open Email settings) that opens the page to fix it. With one: the compose card beside the folders on a computer, the whole screen with Back on a phone, and no row of tabs over it | [record](records/2026-11-08-email-for-the-client.md) |
| P96 | Email: open Compose, Inbox, Sent, Templates, the Delivery log and Mailboxes and rules, one after another; on a computer too | The same folders on every one, in the same order, with the Inbox's unread number beside it; the page title is one slim line, no sentence under it; on a computer the soft highlight glides from folder to folder and the panes slide instead of jumping | [record](records/2026-11-10-email-panes.md) |
| P97 | Email on a phone: Inbox, then scroll the list | The round Compose button stays at the bottom right, and the folder row opens with the current folder in view | [record](records/2026-11-10-email-panes.md) |
| P98 | Email, Compose, while something is not ready (a new domain, say), then wait two or three minutes on the page | Ready to send says when it last checked and that it checks again by itself; the lines turn green on their own once the domain passes, with no reload | [record](records/2026-11-10-email-panes.md) |
| P99 | A portal whose Resend key may only send, with a domain not yet proven: open Email settings, then Compose | Within a few minutes the domain's line says Resend took a test email from it, with the time; or, if Resend refuses the domain, what Resend said and where to add it | [record](records/2026-11-10-email-panes.md) |
| P100 | Email settings on a portal with no email provider yet | Three numbered steps in coloured circles; the Sender address shows a full example on your own domain (such as admin@ and your business's domain), and tapping the example fills it in; the address and name already set are filled in | [record](records/2026-11-10-email-easy-start.md) |
| P101 | Email settings: tap each round (i) button beside Sender address, Name and The provider's key; on a computer, rest the pointer on one | A tinted note fades in under the button, saying what the field is and where to find the key; a tap elsewhere closes it | [record](records/2026-11-10-email-easy-start.md) |
| P102 | Add an email provider on Integrations only (not on Email settings), then open Email settings | A message says the domain your provider sends from was added and is being checked; Addresses lists it, and Compose's Ready to send turns green by itself once its records pass | [record](records/2026-11-10-email-easy-start.md) |
| P103 | Open Email's delivery log from another Email page | The strip of figures keeps its frame while each figure's words come in one after another and sharpen from a light blur; a figure above zero counts up to its value; the chart's columns grow from the base one after another | [record](records/2026-11-11-page-motion.md) |
| P104 | On a computer, open Records, then Forms, then Approvals from the sidebar | The tinted highlight and its coloured edge glide from the old section to the new one instead of jumping | [record](records/2026-11-11-page-motion.md) |
| P105 | On the delivery log, tap Failed, then Everything, in the Show row | The tint glides to the filter tapped while the list changes at once; the figures do not count again | [record](records/2026-11-11-page-motion.md) |
| P106 | On a slow connection (or with the phone's data saver on), tap a page in the sidebar | The page dims at once while the line at the top moves, then the new page arrives; with Reduce motion on in the phone's settings nothing moves and every number shows at once | [record](records/2026-11-11-page-motion.md) |
| P107 | On a computer, close the sidebar with the arrow at its top, then rest the pointer on the portal's mark | The closed rail shows the portal's mark at the top and every icon on one line down the middle, the bell too; the open button appears over the mark with its label beside it; no scroll bar shows when the pointer is on the rail | [record](records/2026-11-11-sidebar-tidy.md) |
| P108 | Open the menu on a phone and scroll its list | Notifications lines up with Home and the rest; the last rows fade softly above your account while more is below, and the first rows fade at the top once you scroll down | [record](records/2026-11-11-sidebar-tidy.md) |
| P109 | Email, Compose on a computer and on a phone | One window: a head tinted in the portal's colour with the pen and New email, the fields flush inside it, the message box growing down to the foot of the screen with Send under it; no empty column beside it; on a phone it runs edge to edge | [record](records/2026-11-11-compose-and-phone-bar.md) |
| P110 | Email, Compose: tap Ready to send in the window's head | A green chip opens to every check with Check again; tap it again and it closes. When a check fails, the chip is red ("Can’t send yet") and a card above the window says what to do | [record](records/2026-11-11-compose-and-phone-bar.md) |
| P111 | Email, Inbox on a phone, then show a toast (save something) | The round Compose button and the toast sit at the foot of the screen, nothing above them | [record](records/2026-11-11-compose-and-phone-bar.md) |
| P112 | Campaigns, after making two campaigns and leaving them empty | **Delete blank drafts (2)** next to New campaign; tap it, it asks once, then both are gone and a toast says so. A draft with anything in it stays | [record](records/2026-11-11-campaigns-tidy.md) |
| P113 | Campaigns: a sent or cancelled campaign, Archive; then the Archived chip, Take out of the archive. On a scheduled one, Run now | it leaves the list and shows under Archived, then comes back; **Archive finished (N)** does them all. Run now starts the scheduled one at once and its Run log names you | [record](records/2026-11-11-campaigns-tidy.md) |
| P114 | Campaigns, a draft, step 1: **Download a sample CSV** | a CSV with email, name and a column for each field the message uses, three example rows; filled in and uploaded, it is taken in | [record](records/2026-11-11-campaigns-csv-fields-runs.md) |
| P115 | Campaigns, a draft, step 1: upload a big CSV from your phone (several MB, many columns, your own headings such as Correo) | "Sending part 1 of N…" under the box, then "The list was taken in" with the people counted; a file with more people than the settings allow is refused before anything is taken | [record](records/2026-11-11-campaigns-csv-fields-runs.md) |
| P116 | Campaigns, a draft written with `*\|FNAME\|*` or `{phone}` (or pick a template from another tool), step 2 | **Fields in the message** lists each field, how it is written and the column that fills it; pick another column or write words for an empty value, Save; the preview shows them filled | [record](records/2026-11-11-campaigns-csv-fields-runs.md) |
| P117 | Campaigns, a sending campaign with an address that fails | its Run log shows the provider's words, how many people, and a Fix line under that run | [record](records/2026-11-11-campaigns-csv-fields-runs.md) |
| P118 | Campaigns page: **Blank CSV template** | a CSV with email, name, first_name, last_name, phone and company and no rows; filled in a spreadsheet and uploaded to a campaign, it is taken in | [record](records/2026-11-11-campaign-page-design.md) |
| P119 | Campaigns, a new draft | four step cards with icons: the first open one ringed and marked Next, the others Needs you or Later, a bar of how many are done; press a card and that step opens; done steps turn green | [record](records/2026-11-11-campaign-page-design.md) |
| P120 | Campaigns, a draft, step 1 | the details under the title as chips with icons; a dashed box to drop or tap for a CSV, with **Blank template** (the message's own columns, no rows) and **Sample with example rows** under it | [record](records/2026-11-11-campaign-page-design.md) |
| P121 | Settings | four figures at the top; each section with its coloured icon and a line on what it holds; on a phone a sideways row of section chips with icons; a changed setting marked along its left edge, its default as a small tag | [record](records/2026-11-11-settings-page-design.md) |
| P122 | Settings as an Owner or the Vendor: **Colours for everyone**, pick a palette and a background, Save | the whole portal turns to those colours; anyone who picked their own on the Look page keeps theirs | [record](records/2026-11-11-settings-page-design.md) |
| P123 | Signed in as the Vendor more than ten minutes ago: Settings, Modules, change a switch and Save | it saves; no "Sign in again first" | [record](records/2026-11-11-settings-page-design.md) |
| P15 | Email, Write | From, To as chips (red when not an address), Cc and Bcc under More, template buttons in a row | [record](records/2026-11-01-email-remake.md) |
| P16 | Email, Sent, then Addresses | the console pages fit; a domain's records with Copy buttons | [record](records/2026-10-31-email-console-remake.md) |
| P56 | Integrations: connect Resend or Brevo from a tile under Email in one step, then open the provider's own webhooks page | Email in one step with Set up email on top; at the provider, the portal's address is already registered there, nothing copied by hand | [record](records/2026-11-03-easier-setup.md) |
| P92 | Campaigns, open a campaign, then press each step: Who, What, Check, Send | the four steps in a row, a tick on the finished ones; each step shows only its part, with a Next link at its foot | [record](records/2026-11-10-reads-cpu-and-campaigns.md) |
| P93 | A campaign whose Check step says it needs the footer: press Write the footer | it opens step 3 at the Footer box; save who sends it, why and a postal address, and the blocker is gone | [record](records/2026-11-10-reads-cpu-and-campaigns.md) |
| P94 | A campaign that is sending: press Run now, then watch Progress | one run happens at once; the Run log under Progress shows its line (how many sent, in how many calls), newest first; pressed twice quickly, it says a run is already going | [record](records/2026-11-10-reads-cpu-and-campaigns.md) |
| P95 | Tasks (the jobs page), a few minutes after the deploy | the five-minute jobs have run at different minutes, and each last ran within the past five minutes | [record](records/2026-11-10-reads-cpu-and-campaigns.md) |
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
| P53 | Email, Write on a portal whose email service is connected under Integrations but has no address yet: press Check again | one press: the address is read from the service and Write says your addresses were read; with no service at all, the fix links to Set up email | [record](records/2026-11-03-mail-tick.md) |
| P57 | Email, Addresses on a portal with two everyday addresses: under Which address each kind of mail comes from, pick the second for Invoices, Save; then send an invoice | Saved pops up; the invoice email comes from the address picked; every other kind still comes from the main address | [record](records/2026-11-03-mail-tick.md) |
| P28 | A deployed portal with Mail: add a mailbox, write to it from your own email, open it, reply | it arrives within a minute or two; your reply reaches you from the mailbox's address | [record](records/2026-11-02-oltrem-mail-inbox.md) |

The Mail add-on's own owed tests (its bundles A, B, C, F and L) are listed in Oltrem Mail's
documents, packed in [vendor/mail](../vendor/mail/README.md); they are run with a domain on the
Cloudflare route.

## Passed

None yet. A line moves here with the date it passed and the phone it was run on.

## Failed, to fix

None yet.
