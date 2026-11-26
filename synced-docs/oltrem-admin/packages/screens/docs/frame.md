---
title: "@oltrem/screens: the frame: toolbar, reads, views, panel, bell, sidebar, tabs, width"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: the frame (1 of 3)

> Part of [the @oltrem/screens README](../README.md). Every page sits in one frame, drawn on the
> server. Next: [the frame, 2 of 3](frame-2.md).

## The frame

| Part | What it does | Where |
|---|---|---|
| Toolbar | One line. Filter rows after the search that do not fit fold behind a Filters button with the count of active filters; on a phone every row folds, hidden by the stylesheet before the script runs. A state chip shows its `tone` as a dot, a thing chip its `hue`. | `foldFilters` in `client/frame.js` |
| A module switched off | Gone for that request: no sidebar entry, tab, Home card, Needs you or search hit; its pages answer 404. In the browser the page says which part is off; the Vendor and Owners get Switch on (`POST /do/switch`, back to the same address). | `partsOff` from `@oltrem/core-http`, `PartOff` |
| Reads go together | A page learns who is signed in (no trip of its own), then starts the bell's count, the tabs the person may open, the saved views and its own reads at once, so it waits for its slowest read only. | `probe`, `beside` in `src/screens.tsx` |

- **Saved views** (a list whose page sets `views`: a records list, a form's inbox, the audit log):
  the person's views as a sideways row of chips, All first, the current one marked; Save view (a
  small button, its dialog asks the name; folds behind Filters) or Remove view. Posts to
  `/do/views` and `/do/views/remove`, which call `@oltrem/users`'s `/api/users/me/views`. Twelve
  views a page at most. One D1 read; none when users is off.
- **A record beside its list** (frame script): a link inside `[data-peek="<dialog id>"]` whose
  path starts with that dialog's `data-peek-panel` opens in the dialog. The script fetches the
  page, shows its `[data-peek-body]` in `[data-peek-slot]`, names it from `[data-peek-title]` in
  `[data-peek-name]` and points `[data-peek-full]` (Open as a page) at it. Links under the same
  path stay in the panel; a form posts from it and shows its answer there; any other link closes
  it; after a change the list's live block is fetched again. The panel is `ui-drawer ui-peek` (42
  rem, full screen on a phone, its own 20 px gutter, tabs pinned at its top). The open row is
  marked (`data-peeked`); `data-peek-step="-1"`/`"1"` buttons and the keys K and J step through
  the list. Without the script every link opens the record's page. Used by Scheduled jobs.
- **A time that counts down** (frame script): `data-count-to="<ISO time>"` is rewritten each
  second ("in 4 min 12 s", "Due now"); `data-count="tick"` rolls on to the next minute. The server
  writes the first value. Used by Scheduled jobs.
- **Notifications**: a bell at the right of the head from 1024 px, and in the phone's top bar,
  with the unread figure (to "99+") and a tooltip. One indexed read a page; none without users.
  The bell opens a panel (`notify-panel`; X, Escape or a tap outside close it) filled from
  `/notifications`; without the script it opens that page: All or Unread chips, Mark all read,
  each row (unread bold) through `/notifications/:id`, which marks it read and opens its page;
  thirty a page with Older; then "How you are told": In the portal and By email per module, saved
  as each flips.
- **Keep portal emails in your main inbox** (`#primary` on `/notifications`, while email names a
  domain): **Gmail filter** (`/notifications/gmail-filter.xml`: mail from the portal's domains to
  Primary, never Spam, marked important), **Add to contacts** (`/notifications/portal-contact.vcf`,
  one vCard 3.0 with every sender) and **Send me a test** (`POST /notifications/primary-test`, which
  calls `POST /api/email/primary/test`); then steps for a computer, a phone and Outlook. Built in
  `src/primary.ts` from `GET /api/email/primary`. One more read; none without email.
- **Bulk actions** (a module that declares `bulk`): a tick on each row and one for the page, and
  `BulkBar` with the module's actions. The script counts the ticks and holds the buttons until one
  is ticked; a destructive action asks in a dialog. Posts to `/do/bulk`, which calls
  `POST /api/<module>/bulk/<action>` once and returns with
  `?bulk=<module>.<action>.<done>.<refused>`; the list reports both counts in the kit's words.
- **The sidebar**, from 1024 px, tinted with the portal's colour (`--ui-side`). From the top: an
  arrow that closes it, the mark, Search, Home, the sections by group, and who is signed in. Rows
  36 px (44 px on touch). Search (or `Ctrl K`, `⌘K`, "/") opens the palette `dialog#go-palette`:
  the pages that match from `template[data-go]` (`GoList`, every page and tab the person may
  open), then what `/search?as=json` finds; empty, the pages opened last (`oltrem_recent` in the
  browser, cleared at sign out). `data-palette data-q` opens it with words. There is no search
  page.
- **Groups**, in order: Customers (rose), Work (green), Team (amber), Email (cyan), Admin
  (violet). A module joins its group at its `before`; an unknown group sits before Admin
  (`groupRank` in `src/layout.tsx`). Each group's colour (`hueOf`) tints its heading, dot and each
  section's icon tile (solid for the section on screen, whose row is also tinted and bold). Open,
  the sidebar and the phone's drawer are 17 rem (less 56 px on a narrow screen); the account menu
  at least 15 rem. Home's At a glance uses the same colours.
- **Tabs.** Sections naming the same `tabs` (`PageNav.tabs`) fold into one sidebar entry, leading
  to the first tab (`tabSet`, `sideEntries` in `src/layout.tsx`). The tabs sit under the head
  (`PageHead`): on a set's pages the heading is the set's name and the marked tab names the page; a
  page inside a tab keeps the row and puts its title under it; a page in a section without tabs
  shows one back link ("‹ Data"). Tabs are links on an underline, the marked one in the group's
  colour, never bold, with a count from the page's `counts`. On a phone the row scrolls sideways
  and reopens where it was; arrow keys, Home and End move between tabs. From 1024 px the row sticks
  at the top (`scroll-state` where supported). Five tabs a set at most: a page that belongs to a
  tab names it in `under`, marks it while open, and shows as an "Also here" chip. Each tab shows to
  whoever its `NavEntry.may` allows.
- **Width.** A page is a `console` (default) or a `form` (`kind` in its answer). A console runs to
  96 rem with gutters of 16 px on a phone and 32, 40 and 48 px from 1024, 1280 and 1536 px; a form
  keeps its content to 56 rem under a head as wide as a console's. Sign-in pages are a 40 rem
  column. The scrollbar's room is always kept (`scrollbar-gutter: stable`). A page with no entry
  of its own sits under the entry its path starts with (`/email/sent/7` under Sent). With every kit
  module on, the sidebar holds 19 entries besides Home:

| Group | Entries (tabs) |
|---|---|
| Customers | Customers (Customers, Privacy requests), Bookings, Sales (Quotes, Invoices), Forms |
| Work | Tasks, Lists, Files, Approvals, Reports |
| Team | Time (Time off, Time clock, Shifts), Expenses, Equipment, Announcements |
| Email | Email (Compose, Inbox with Mail, Drafts, Sent, Delivery log, Templates), Campaigns (Campaigns, Mailing lists), Email settings (Setup, Addresses; with Mail, also Mail setup and Forwarding) |
| Admin | Integrations (Apps, Email services, Developer), Automations, Users and access (Users, Roles, Groups, Locations, Settings; Signed in today and Access requests open under Users, Access reviews and Vendor access under Settings), Settings (Features, Settings), System (Status, Alerts, Backups, Deployments, Audit log, Settings) |
