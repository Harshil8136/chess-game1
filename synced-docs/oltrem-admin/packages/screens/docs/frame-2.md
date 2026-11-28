---
title: "@oltrem/screens: the frame: account, phone bar, one sidebar, no reloads, live blocks"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: the frame (2 of 3)

> Part of [the @oltrem/screens README](../README.md). Before: [1 of 3](frame.md); next:
> [3 of 3](frame-3.md).

## The frame, continued

- **Closed to icons.** The arrow closes the sidebar to a 64 px rail; only the words fade. A
  section's name shows beside the rail on hover or focus. Posts `side` (`closed`/`open`) and
  `back` to `POST /do/side`, kept in the `oltrem_side` cookie so the next page draws the same.
- **Your account**, at the foot: a menu with the address, My access, Look and colours (`/look`),
  six colour dots (`DOTS`), the theme as three icons, and Sign out. The theme posts `theme`
  (light, dark, system) and `back` to `POST /do/theme` (`oltrem_theme` cookie, cleared for
  system; the frame sets `data-theme`). A dot posts `palette` and `back` to `POST /do/look`.
  Both return to `back` when it is a portal path, else Home, and refuse a cross-site form. With
  the script the new colours spread from the button as a circle (a 450 ms view transition).
- **On a phone**, a top bar (`PhoneBar`, `ui-phone-bar`): Menu (the sidebar as a drawer, a
  `dialog` opened by `commandfor`; a tap outside closes it), the mark and name to Home, Search,
  and the bell. A set that hides its tabs row (Email) also gets a gear to its Settings tab.
  Nothing sits along the bottom. A head marked `data-bar` drops only its icon and line. The page
  names the browser bar's colour for light and dark.
- **One sidebar, everywhere.** No second pane, no phone section menu: the sidebar holds only the
  sections. A page's own menu (Email's folders, `MailShell`) is drawn in the page: `Frame` renders
  the body inside core-ui's `SideMenu` context, where `MailShell` leaves its folders
  (`SideMenuData`), then the head, then `PageMenu` as a row under the head. The sidebar's colours
  are `--ui-side`, `--side-fg`, `--side-fg-3` and `--side-fg-strong`, light and dark; the page on
  screen is tinted in its group's colour with a marker at its edge. Where a browser lacks
  `commandfor` (Safari before 26.2, Samsung Internet, Firefox before 144) the script does what the
  button asks and closes a `closedby="any"` dialog on a press outside.
- **The first page of a fresh copy.** `createScreens` draws the frame once while the Worker loads
  (`warmFrame`), so the renderer, frame and icons are compiled before the first request; a fault
  there is printed and the Worker starts anyway.

## No reloads

The frame's script (`src/client/frame.js`, served at `/ui/app.js` under its version) opens a
portal link, a search, a filter or a form's change in place: it fetches the next page and swaps
`main.ui-page` only. The address, title, Back and Forward (with scroll) behave as on a load.

| Behaviour | How |
|---|---|
| How a trip ended | A page shows `?trip=` once: on a load or a swap the script drops it from the address (`replaceState`), so a reload or Back never repeats an old notice. |
| A refused form | Keeps the address it was sent from. On a refusal (`data-refused`) the script refills the form by field name (hidden, file and password fields as drawn), reopens its dialog and shows the reason at its top. |
| Motion | One 150 ms fade of the content where view transitions exist and motion is on; the head and tabs stay still. Sidebar groups glide; drawers slide; a pressed sidebar row gives a little (`theme.css`). The marked tab, segment or section carries `.ui-mark`, which glides; a filter on the same page moves the mark alone (`data-vt="mark"`). Figures count up and meters fill; a live figure glides to its new value in 400 ms. None under reduced motion. |
| Focus and scroll | Focus moves to the new heading or to a form's errors. A change back to the same page keeps its scroll and brings its outcome into view. A link to `#section` is the browser's own. |
| Fetch ahead | The page under the pointer is fetched a moment ahead. A `data-preload` part (Email's folders) has its links fetched when idle, 16 at most; `data-preload-skip` opts out; nothing while hidden or on data saver. |
| Pages kept in memory | Each opened page is kept in the tab's memory for 15 minutes, 40 at most, never on disk. A kept page shows at once; older than 15 seconds it is fetched again with every check and swapped in unless the person has tapped, typed or opened a dialog. Any change sent (a POST, a module's own `fetch` other than `/do/side` and `/do/theme`) or a failure forgets them all. |
| Marked once shown | `data-seen` naming an `/api/…/read` address sends it an empty JSON POST once the page is shown, never when only fetched ahead or kept. |
| Loading | The loading orb (`oltremOrb`, from thinking-orbs, placed by `pnpm ui:build`) in a round chip at the top, and in a form's button while it sends; after 150 ms the page dims (`data-loading`). One still frame under reduced motion. |
| A change shown at once | A form or button with `data-optimistic` changes its row (`data-optimistic-row`) or the ticked rows before sending: `hide`, `set:<name>`, `unset:<name>`, `toggle:<name>` (with `aria-pressed` and `data-optimistic-label`). No dimming; the answer puts the true page in place; no answer puts every row back and says the change may not have been saved. |
| Small helpers | `data-copy` copies a value and says "Copied" (aloud too) for two seconds. `data-fill` (a field's id) with `data-value` puts an example in the field. |
| Lists to filter | `data-filter` hides the `data-filter-item` rows and emptied `data-filter-group`s of the element it names, and shows its `data-filter-empty` line when none match; the control starts `hidden` with `data-enhance`. |
| Needed by | A box with `data-needed-by` shows its `aria-describedby` element while it is off and one of the named values is on (Features). |

## The page alone

Each page carries a key of its frame (`data-frame`: name and icon, the person, the sidebar's rows,
the unread count, a page's own menu). The script sends it as `x-ui-frame`; when the new page's key
matches, the answer is only `<div class="ui-frame" data-here="…"><main>…</main></div>`, 40 to 80
percent smaller and 1 to 2.5 ms less CPU; `data-here` names the sidebar row to mark. A page whose
key differs opens whole.

## Live blocks

A block with `data-live="name"` and `data-refresh="seconds"` (five at least) is refetched (from the
page, or the lighter one `data-refresh-from` names) and swapped alone. No fetch while the tab is
hidden, a dialog is open, a page is loading or the person is in a form. A copy without
`data-refresh` stops it; a failed fetch dims the block (`data-stale`) until one works. A campaign's
progress is one.
