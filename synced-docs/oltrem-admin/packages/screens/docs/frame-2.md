---
title: "@oltrem/screens: The frame: No reloads, The page alone, Live blocks"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: The frame: No reloads, The page alone, Live blocks

> Part of [the @oltrem/screens README](../README.md).

## The frame, continued

  | Group | Entries (tabs) | |---|---| | Customers | Customers (Customers, Privacy requests),
  Bookings, Sales (Quotes, Invoices), Forms | | Work | Tasks, Lists, Files, Approvals, Reports | |
  Team | Time (Time off, Time clock, Shifts), Expenses, Equipment, Announcements | | Email | Email
  (Compose, Inbox with Mail, Drafts, Sent, Delivery log, Templates), Campaigns (Campaigns, Mailing
  lists), Email settings (Setup, Addresses; with Mail, also Mail setup and Forwarding) | | Admin |
  Integrations (Apps, Email services, Developer), Automations, Users and access (Users, Roles,
  Groups, Locations, Settings; Signed in today and Access requests open under Users, Access reviews
  and Vendor access under Settings), Settings (Features, Settings), System (Status, Alerts, Backups,
  Deployments, Audit log, Settings) |
- **Closed to icons.** The arrow closes the sidebar to a 64 px rail and opens it again. Only the
  words fade: no icon moves. A section's name shows beside the rail while the pointer or the
  keyboard is on it. The choice posts `side` (`closed` or `open`) and `back` to `POST /do/side`,
  which keeps it in the `oltrem_side` cookie, so the next page is drawn the same with no jump.
- **Your account**, at the foot: pressed, a small menu opens above it (to the right of the closed
  rail) with your address, My access, Look and colours (`/look`), the colour theme as three
  icons and, on this computer, Sign out. The theme posts `theme` (light, dark or system) and `back` to `POST /do/theme`, which keeps
  the choice in the `oltrem_theme` cookie (cleared for system); the frame then sets `data-theme`
  on the page. Both switches return to `back` when it is a path on the portal, Home otherwise, and
  refuse a form posted from another site.
- **On a phone**, a bar along the top (`PhoneBar`, `ui-phone-bar`): Menu, which opens the sidebar's
  parts as a drawer from the left (a `dialog` opened by the browser's `commandfor`; a tap outside
  closes it), the portal's mark and name to Home, Search, and the bell with the unread figure. A set
  that hides its tabs row (Email, whose folders hold the set) also gets a gear before the bell, to
  the set's Settings tab, and the same tab as a Settings row in its sidebar menu. Nothing sits along
  the bottom, so the page runs to the foot of the screen. The page's own head names where you are
  under the bar, so a head marked `data-bar` keeps its heading and actions and drops only its icon
  and line. The document names the phone browser's bar colour (light, dark, or both for the device's
  own).
- **One sidebar, everywhere**: there is no second pane beside the sidebar and no phone section menu.
  The sidebar holds only the sections. A page with a menu of its own (Email's folders, from
  core-ui's `MailShell`) has it drawn in the page: `Frame` renders the page's body first inside
  core-ui's `SideMenu` context, where `MailShell` leaves its folders (`SideMenuData`) instead of
  drawing them, then the head, then core-ui's `PageMenu` as a row under the head. A folder or a
  count changes only the page, so the browser keeps its sidebar. The sidebar's look is solid : its
  own colours (`--ui-side`, `--side-fg`, `--side-fg-3`, `--side-fg-strong`, light and dark), each
  icon bare in its group's colour, the page on screen tinted in that colour with a marker at its
  edge, each group's name after a dot of its colour. Menu on a phone opens the portal's drawer,
  scrolled so the page on screen is in view. Where the browser has no command buttons (`commandfor`:
  Safari before 26.2, Samsung Internet, Firefox before 144) the script does what the button asks,
  and closes a `closedby="any"` dialog on a press outside it.
- **The first page of a fresh copy**: `createScreens` draws the frame once while the Worker loads,
  into nothing (`warmFrame`), so the renderer, the frame, the sidebar and its icons are compiled
  before the first request, whose CPU the Free plan counts; a fault there is printed and the Worker
  starts as before ([record](../../../archive/records/2026-11-15-cpu-first-request.md)).
- **Colours in the account menu**: six coloured dots (`DOTS`) above the theme icons post `palette`
  and `back` to `POST /do/look`, which keeps the pattern the cookie already holds. With the script,
  the new colours and a change of theme spread from the button pressed as a circle (a view
  transition, 450 ms); without it, or under reduced motion, the page just changes.

**No reloads.** The frame's script (`src/client/frame.js`, served at `/ui/app.js` under its version)
opens a link to one of the portal's pages, a search, a filter or a form's change in place: it
fetches the next page and swaps only the page's content (`main.ui-page`), so the sidebar stays on
screen where it was scrolled and the section on screen is marked as the new page marks it. The
address, the title, Back and Forward (with the page's scroll) behave as on a load. **A refused
form** keeps the address of the page it was sent from, never the form's own address, which often
answers nothing to a reload; and when the answer is a refusal (the problem notice's `data-refused`),
the script gives the form back as it was sent, by field name (hidden, file and password fields as
the page drew them), opens its dialog again and shows the reason at the top of the dialog, so no
module redraws a refused form by hand. A page change fades the content in where the browser has view
transitions and motion is on: one fade of 150 ms, with no rise, blur or slide and no part coming in
after another; the head and its tabs stay still, and Email's panes keep their own moves. A sidebar
group folds and opens by gliding, the phone's folders and section drawer slide out as they came, a
dialog's shade fades both ways, a fold's contents drop in as it opens, and a sidebar row gives a
little under a press (`theme.css`); a change that comes back to the same page keeps its scroll and
brings its outcome (a `Done` notice or an error) into view. Focus moves to the new page's heading,
or to a form's errors. The page under the pointer is fetched a moment ahead, so the click opens it
at once. **Pages kept in memory**: each page opened is kept in the tab's memory for 15 minutes, 40
at most, and never on disk. Back, Forward and a link to a kept page show it at once; when the copy
is older than 15 seconds the portal is asked for the page again with every check, and a page that
changed is put in place unless the person has already tapped, typed or opened a dialog (then it is
kept for the next time). An answer that is not the page (a session that ended) opens as the browser
would, and a failure forgets every copy. Any change sent (a form's POST, a module script's own
`fetch` other than the frame's sidebar and theme switches, `/do/side` and `/do/theme`) forgets them
all, since it may change any page. **Marked once shown**: an element with `data-seen` naming a read
mark of the portal's API (an address under `/api/` ending in `/read`, a form answer's; no other
address is ever sent) has that address sent an empty JSON POST once the page is shown, never when it
is only fetched ahead or kept, so a page fetched under the pointer marks nothing until it is opened.
A part of a page marked `data-preload` (Email's folders) has its links fetched one at a time when
the browser is idle, 16 at most, and kept, so moving between them is instant; a link with
`data-preload-skip` (Compose, which checks the senders when it opens, and the + of Labels) is not,
nor anything while the tab is hidden or the phone saves data. The arrow and the theme switch act at
once and save behind the scenes. A button with `data-copy` copies that value to the clipboard and
says "Copied", aloud too, for two seconds. A button with `data-fill` (a field's id) and `data-value`
puts that example in the field and moves there. A page still loading shows the loading orb
(thinking-orbs' engine, which `pnpm ui:build` puts before the frame's script as `oltremOrb`) in a
round chip at the top, under the phone's top bar, and a form's button shows it while the form is
sent; one still frame with reduced motion. It replaced the thin line at the top, and after 150 ms
the page dims (`data-loading`), so a press is seen. **A change shown at once**: a form or its button
marked `data-optimistic` changes its row (`data-optimistic-row`), or for a list's command the rows
ticked for it, before it is sent. `hide` takes the row away, `set:<name>` and `unset:<name>` put or
take the row's `data-<name>`, and `toggle:<name>` flips it with the button's `aria-pressed` and its
`data-optimistic-label` for the other label. Such a send neither dims the page nor shows the line;
the portal's answer puts the true page in place, and with no answer at all every row is put back as
it was and the page says the change may not have been saved. The marked tab, segment and section
carry a mark (`.ui-mark`) the script adds and names alike on both pages of a change, so it glides; a
filter on the same page moves the mark alone (`data-vt="mark"`). A page that arrives counts its
plain figures up and fills its meters, keeping the real figure for a screen reader; a figure a live
block brings changed glides from the old value to the new in 400 ms (none under reduced motion). A
link to a section of the page on screen (`#invite`) is the browser's own: it scrolls there, and the
popstate it fires is not taken for Back (until 2026-10-31 it fetched the page again and put it back
at the top, which looked like a reload). Lists of boxes to tick: a group's ticks are counted
(`data-check-group` with `data-count`, the form's in `data-count-all`), `data-check-all` ticks or
clears one group, and an input with `data-filter` hides the `data-filter-item` rows (and emptied
`data-filter-group`s) of the element it names; those controls start `hidden` with `data-enhance` and
appear with the script. A box or switch whose `data-needed-by` names the values of other boxes of
its name (the Features page) shows the element its `aria-describedby` names while it is off and one
of them is on.

**The page alone.** Each page carries a key of its frame (`data-frame`: the portal's name and icon,
the person, the sidebar's rows, the unread count, a page's own menu in the sidebar). The script
sends it as `x-ui-frame` on every page it fetches; when the server's key for the new page is the
same, the answer is only `<div class="ui-frame" data-here="…"><main>…</main></div>`, 40 to 80
percent smaller and 1 to 2.5 ms less CPU ([the
record](../../../archive/records/2026-11-11-portal-name-icon-font.md)), and `data-here` names the
sidebar row to mark (`data-here-as="true"` when the row holds the page's own menu). A page whose key
differs is opened whole.

**Live blocks.** A block marked `data-live="name"` with `data-refresh="seconds"` (at least five)
is kept up to date: the script fetches the page again, or the lighter page `data-refresh-from`
names, and swaps that block alone, so what the person is reading or typing elsewhere stays. It
does not fetch while the tab is hidden, a dialog is open, a page is on its way or the person is in
a form. A block whose new copy has no `data-refresh` stops refreshing; a fetch that fails dims the
block (`data-stale`) until one works. A campaign's progress is the first such block.
