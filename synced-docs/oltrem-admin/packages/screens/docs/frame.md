---
title: "@oltrem/screens: The frame: A page's reads go together"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: The frame: A page's reads go together

> Part of [the @oltrem/screens README](../README.md).

## The frame

Every page sits in one frame, drawn on the server:

The toolbar is one line: the page script (`foldFilters` in `client/frame.js`) folds the
`.ui-filters` rows after a page's search that do not fit on its line behind a Filters button there,
with how many filters the address narrows by; on a phone every such row folds, hidden by the
stylesheet before the script runs. A chip that names a state shows its `tone`, one that names a
thing its `hue`, as a dot before its words (Users' Active and Invited, a role; the Audit log's
Refused and Failed, each section).

A module switched off on the Features page (the `partsOff` set `@oltrem/core-http` puts on each
request) is gone for that request: no sidebar entry or tab, no Home card or Needs you, nothing in
the search; its pages, a module's own by their pattern and a kit section by its address, answer
404. Opened in the browser, such a page says which part it belongs to and that it is switched off
     (`PartOff`); the Vendor and Owners get Switch on, which posts to `/do/switch` and comes back to
     the same address with its query. Switched back on, all of it is there on the next request.

**A page's reads go together**. Each read is a trip to the database, tens to a few hundred
milliseconds from where the Worker runs, and a page that makes them one after another waits for
their sum. So a page first learns who is signed in (the session, which every read needs and which
costs no trip of its own), then starts everything else at once: the bell's count, the tabs the
person may open (`probe`), the saved views and the page's own reads (`beside` in `src/screens.tsx`).
The count, the tabs and the reads used to wait for each other, three or four trips before a page's
own first read; now a page waits for its slowest read.

- **Saved views**, above a list page that keeps them (`views` on a module's page; a records list, a
  form's inbox and the audit log): the person's views as a sideways row of chips, All first and the
  one on screen marked, then Save view (since 2026-11-24 a small button whose dialog asks the name,
  and the row folds behind the toolbar's Filters button with the filter rows), or Remove view on a
  saved one. Both post to `/do/views` and `/do/views/remove`, which call `@oltrem/users`'s
  `/api/users/me/views` and return to the list; a refusal (twelve views on the page already) is
  shown with the way back. One D1 read per such page; nothing when users is off.
- **A record beside its list** (the frame script; the owner: a job opens in a panel from the right,
  not a page of its own): a link inside `[data-peek="<dialog id>"]` whose path starts with that
  dialog's `data-peek-panel` opens in the dialog instead. The script fetches the linked page, shows
  its `[data-peek-body]` in the dialog's `[data-peek-slot]`, names it from its `[data-peek-title]`
  in `[data-peek-name]` and points `[data-peek-full]` (Open as a page) at it. Links under the same
  path (the record's tabs) stay in the panel, a form posted in it is sent from it and its answer
  shown there (a confirm dialog over the panel closes first), any other link closes the panel and
  opens as usual, and once the panel closes after a change the list's live block is fetched again.
  The panel is `ui-drawer ui-peek` (42 rem wide, the whole screen on a phone, its body a container
  so its panes lay out by its own width); a page wraps its body in `<div data-peek-body
  class="contents">`, which the page lays out as before. Without the script every link opens the
  record's page. Used by Scheduled jobs. Later the same day: the panel has its own 20 px gutter and
  clips sideways, so a row of tabs never makes it scroll left and right; its tabs stay at its top as
  it scrolls; the open record's row is marked in the list (`data-peeked`, a tint and a bar at its
  start); buttons marked `data-peek-step="-1"` or `"1"` and the keys K and J open the previous or
  next record of the list without closing the panel; an empty panel shows a soft placeholder while
  the record loads.
- **A time that counts down** (the frame script): an element with `data-count-to="<ISO time>"` is
  rewritten each second as "in 4 min 12 s", "in 9 s" or "Due now"; with `data-count="tick"` it rolls
  on to the next minute once it passes, as the scheduler's tick does. The server writes the first
  value, so without the script it still reads right when the page was made. Used by Scheduled jobs'
  Next tick and a job's next run.
- **Notifications**: a bell at the right of the page's head from 1024 px , and on the phone's bar
  along the top, with the unread figure (to "99+") and, a tooltip naming it ("Notifications: 3
  unread"), read on every page beside the page's own reads (one indexed read more; none without the
  users module). Since 2026-11-14 a bell opens a panel over the page (`notify-panel`, closed by X,
  Escape or a tap outside) filled from `/notifications`, whose list works inside it; without the
  script it opens `/notifications`: All or Unread as chips, Mark all read, each notification a row
  (unread ones bold) that opens through `/notifications/:id`, which marks it read and goes to its
  page (a path inside the portal, else the list); thirty a page with Older; under them "How you are
  told", a grid of two switches per module, In the portal and By email (both on is `both`, neither
  is `off`), saved as one flips (a Save button only without the page script); only what changed is
  sent. Since 2026-11-22, under them, **Keep portal emails in your main inbox** (`#primary`, while
  email is on and names a domain): Gmail puts the portal's notices under Updates, and only the
  reader's own filter or contact keeps them in Primary. A sideways row of three: **Gmail filter**
  (`/notifications/gmail-filter.xml`, a filter file in Gmail's own export format: mail from any of
  the portal's domains to Primary, never to Spam, marked important; import it on a computer), **Add
  to contacts** (`/notifications/portal-contact.vcf`, one vCard 3.0 contact with every sender
  address, for a phone) and **Send me a test** (`POST /notifications/primary-test`, which calls
  `POST /api/email/primary/test` and comes back with "A test email is on its way"); then the steps
  for a computer, a phone and Outlook, and who the mail comes from. Both files are built in
  `src/primary.ts` from `GET /api/email/primary` (`@oltrem/email`); with nothing to name, each link
  leads back to the page. One more read on the page, none without email.
- **Bulk actions**, on a list whose module declares `bulk` (the tasks): a tick on each row and card,
  one in the header for the whole page, and the bar (`BulkBar`) above the list with the module's
  actions. The frame script counts the ticks ("3 tasks chosen"), keeps a row's two ticks alike and
  holds the buttons until one is ticked; a destructive action asks in a dialog. A press posts to
  `/do/bulk`, which calls `POST /api/<module>/bulk/<action>` once and returns to the list with
  `?bulk=<module>.<action>.<done>.<refused>`; the list shows how many were done and how many
  refused, in the kit's own words, never words from the address.
- **The sidebar**, from 1024 px wide, down the left edge in a tint of the portal's colour with one line
  beside it. From the top: an arrow that closes it, the portal's mark, Search (since 2026-11-25 a
  button that looks like a box; closed to icons, a search icon; on a phone, the bar's Search; or
  `Ctrl K`, `⌘K` or "/" from anywhere) that opens the palette, one pop-up over the page
  (`dialog#go-palette`, outside the sidebar): its box, then the pages that match as you type, from
  the sidebar's `template[data-go]` (`GoList`: every page and tab the person may open, without
  the probed tabs), then what the portal finds (`/search?as=json`); empty, the pages opened last,
  kept in the browser's `oltrem_recent` alone and cleared at sign out; Enter or a tap opens one in
  place and closes it, Escape or a press outside closes it. Files' "Search all of Files" opens it
  with its words (`data-palette data-q`). There is no search page any more), Home, then every mounted section under its group,
  and at the foot who is signed in. Rows are 36 px (44 px on a touch screen).
- **Groups**, in this order: Customers, Work, Team, Email, Admin (the five the owner picked on
  2026-11-22, in place of Work, Company, Users and access, Messages, System; since 2026-10-29, few
  entries, sub-pages as tabs). A module's page joins its group wherever the module is listed, at its
  `before` when it names one; a group the kit does not know sits before Admin (`groupRank` in
  `src/layout.tsx`). The colours: Customers rose, Work green, Team amber, Email cyan, Admin violet.
  Each group has a colour (`hueOf`): its heading, its dot, and each section's icon on a small tile
  of that colour (solid for the section on screen, whose row is tinted and bold, so it never rests
  on colour alone). The sidebar itself is tinted with the portal's colour (`--ui-side`). Open, it is
  17 rem wide, and so is the phone's drawer, less 56 px on a narrow screen; the account's menu is
  never narrower than 15 rem and its colour dots wrap rather than leave it. Home's At a glance rows
  use the same colours.
- **Tabs.** Sections that name the same `tabs` (`PageNav.tabs`) fold into one sidebar entry under
  that name, at the first one's place, leading to the first tab and marked on any of them (`tabSet`
  and `sideEntries` in `src/layout.tsx`). The section labelled as the set is the first tab, the rest
  follow in the sidebar's order. The tabs sit under the page's head, as a console's do (`PageHead`):
  on a set's own pages the heading is the set's name (Email) and the marked tab names the page, so
  no word shows twice (a screen reader hears "Email: Sent"); a page inside a tab (a message,
  `Connect an integration`) keeps the set's row and tabs and puts its own title under them; a page
  inside a section with no tabs (a list in Lists, Create form) shows a link back to the section
  above its title (since 2026-11-26 one link with its arrow pointing back, "‹ Data", where a lone
  "Data >" read as an orphan). The tabs are links on an underline, the marked one in the group's
  colour and never bold (no label moves), a count beside a tab when the page gives one (`counts` in
  a page's answer, by the tab's path). On a phone the row scrolls sideways into the gutters, which
  fade; the frame script opens the same row scrolled where it was on the page before, and moves it
  only as far as shows the marked tab whole. A page's commands start its content, under the tabs, so
  the head and the tabs are the same on every page of a set; the arrow keys, Home and End move
  between tabs. From 1024 px the row stays at the top while a long page scrolls, on the page's
  colour once stuck, where the browser can tell (`scroll-state` queries; elsewhere it scrolls with
  the page). The head and the tabs keep still in a page change; only the content below them fades.
  Users and access is one entry whose pages are tabs, each shown to whoever its `may` says yes for
  (`NavEntry.may`). A set holds five tabs at most: a page that belongs to a tab but is no tab of its
  own names it in `under`, so it is left out of the row, marks that tab while it is open, shows as a
  chip under the tabs ("Also here") or in a Settings tab's Set up list, and is still found by the
  search box.
- **Width.** A page is a console or a form (`kind` in a page's answer; `console` by default). A
  console uses the screen up to 96 rem, its gutters 16 px on a phone and 32, 40 and 48 px from 1024,
  1280 and 1536 px; a form (Settings, Connect an integration) keeps its content to 56 rem under a
  head and tabs as wide as a console's, so they never move between the two. The sign-in pages
  stay a 40 rem column.
- **No sideways shift.** The document keeps the scrollbar's room on every page (`scrollbar-gutter:
  stable`), so a short page and a long one start at the same place; before 2026-11-01 a classic
  scrollbar (Windows) came and went between pages and moved the centred page by half its width. A
  page with no entry of its own sits under the module's entry its path starts with (`/email/sent/7`
  under Sent). With every kit module on, the sidebar holds 19 entries besides Home; the addresses
  did not change, only the names and the groups:
