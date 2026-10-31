# @oltrem/screens

The screens of a client portal: a home page with a card per mounted module, a page per module,
the two first-run forms (the Vendor creates the company, the first Owner accepts), and the forms
for people and access. They are rendered on the server with Preact inside the client's Worker,
behind the same door as the API, and work with no script, so a page works on a phone before
anything loads. One small script (`/ui/app.js`) then moves from page to page without a reload.

Every page reads and writes only through the portal's own API, called inside the same request
with the caller's identity headers (`src/api.ts`). The session hook, the permission check, the
schema and the audit run exactly as they do for any other caller, so a screen never shows or
changes more than the API allows. A refusal is shown as a notice in plain words, with what to do.

## Using it

```ts
import { createScreens } from '@oltrem/screens';

const screens = createScreens({ portal: client.name, owner: client.owner, modules });
const app = createApp<Env>({
  modules,
  publicRoutes: screens.publicRoutes, // the stylesheet, before the door
  localDoor: { enabled: (env) => !env.ACCESS_AUD, page: screens.signInPage },
  // ...the session hook, the authorizer and the rest, as in @oltrem/core-http
});
screens.mount(app); // every page, behind the door
```

A module the portal does not mount has no chip in the row, no card and no page. A module with a
`home` widget on its manifest (`@oltrem/core-module`) has a card on Home, a client's own module
too; a card links to its page when the module has one. `localVendor`,
the Vendor's address that the client's dev script writes on the owner's computer, is named on
the local sign-in page and filled in there, and named again to anyone signed in on that computer
with no account: on a new portal it is the only account.

A module that brings `pages` (`@oltrem/core-module`) has them mounted inside the same frame: a
page with a `nav` gets a section in the sidebar after the last one of its group, or just before
the section its `nav.before` names (a new group goes before Administration), a page without one sits under its module's first section, a posted form
must come from the portal itself, and the page answers only to someone with an account, like
every other page. A page's `api.send` takes a `File` from a form as it is, with its own type,
for an upload route. The stylesheet's build reads the kit modules' `src/pages.tsx` too, so
their classes are in it. `navWith` is how the sidebar is built from the kit's sections and the
modules' own.

## The pages

| Path | Shows | Reads |
|---|---|---|
| `/` | a Vendor with no company yet: the company form; anyone else: Needs you first (what waits for them from each module that answers it, each a row to the page that acts on it, or a line saying nothing waits), then the Home card of each mounted module that has one and that they may read (a figure, a line, a state), in the row's order | `/api/iam/me`, then each `/api/<module>/todo` and `/api/<module>/home`, together |
| `/search?q=` | the search box, then what matches two letters or more: the sections by name and line, then each module that searches, as the person (a module that refuses them is left out); nothing found says so | each `/api/<module>/search` |
| `/setup/company` | the invitation link for the first Owner, after the form is sent | `POST /api/iam/tenant` |
| `/accept?token=` | the invitation and its Accept button; accepting returns to `/` | `POST /api/iam/invitations/accept` |
| `/records` | the lists the person may see, with their records and place; Make a list when a role allows it somewhere | `/api/records/lists` |
| `/records/new` | a new list: its name, its place picked from a row, and a starting shape (blank, contacts, tasks, stock, orders, equipment) | `/api/records/lists` |
| `/records/:id?q=&field=&value=&sort=&dir=&page=` | a list's records: searched, narrowed by a row of chips per choice or yes or no field, sorted from a row, paged; the add form and Add from a spreadsheet when the person may add | `/api/records/lists/:id`, `items` |
| `/records/:id/items/:item` | one record with who added and changed it; the form to change it and Remove, as the person may | `/api/records/lists/:id`, `items/:item` |
| `/records/:id/fields` | the designer: the fields in order with up, down and Remove; Add a field; the name and place; Remove the list once empty | `/api/records/lists/:id`, `/api/records/lists` |
| `/forms` | the forms the person may see, with their new answers and whether each takes answers; Make a form when a role allows it somewhere | `/api/forms/forms` |
| `/forms/new` | a new form: its name, its place picked from a row, and a starting shape (contact us, quote request, feedback, sign-up, blank) | `/api/forms/forms` |
| `/forms/:id?view=&mine=&q=&page=` | the inbox: a row of statuses with their counts (to do, new, open, done, all), a row for the answers the person took, a search box, paged; Try the form, the designer, the download | `/api/forms/forms/:id`, `entries` |
| `/forms/:id/entries/:entry` | one answer as it was sent; Take it or Let it go, Mark new, open or done; its notes and email replies, and the form that adds one; Remove, as the person may | `/api/forms/forms/:id`, `entries/:entry` |
| `/forms/:id/design` | the designer: the code for a website, a new address, the fields with up, down and Remove, Add a field, the settings (name, line, taking answers, the page after sending, who is told, place), Remove | `/api/forms/forms/:id`, `/api/forms/forms` |
| `/forms/:id/try` | the form as a website shows it, posting to its public address | `/api/forms/forms/:id`, `/hooks/forms/:key` |
| `/people?show=` | everyone in the directory, or only those switched on (`on`) or off (`off`), picked from a row; the invitations waiting, and the invitation form | `/api/users/people`, `/api/iam/roles`, `scopes`, `invitations` |
| `/people/:id` | one person: the roles they hold, the form to give one (for 30 days, 90 or a year, and off until they turn it on if chosen), their exceptions in force, switching the account off or on | `/api/users/people/:id`, `/api/iam/bindings`, `roles`, `scopes`, `overrides`, `capabilities` |
| `/people/:id/exceptions?place=` | one person's exceptions at one place, picked from a row: every capability that may be given one person at a time, with three chips (as their roles say, allow, deny) | `/api/iam/overrides`, `capabilities`, `scopes` |
| `/people/:id/see?place=` | "See it as": what the person can do at one place, picked from a row, each capability with yes or no and why, grouped by module; an account switched off says so. Read only, never their session | `/api/users/people/:id`, `/api/iam/scopes`, `/api/iam/people/:id/access` |
| `/access` | the company, its roles, groups and places, and the form to add a place | `/api/iam/tenant`, `roles`, `groups`, `scopes` |
| `/access/roles/new`, `/access/roles/:id` | a role's name and its capabilities as a checklist grouped by module | `/api/iam/roles/:id`, `/api/iam/capabilities` |
| `/access/mine` | My access, for everyone (also linked under the account in the sidebar): the roles they hold, each at its place, through them or a group, until when, and in force, ended, not started or off until turned on; the form to turn on an eligible role for 1 to 12 hours with a reason; the form to ask for a role at a place with a reason (every role but the Owner's); their requests and what became of each | `/api/iam/me/options`, `me/grants`, `me/requests` |
| `/access/decisions` | Waiting for a decision: the access requests still open (who, the role and place, why) and the approvals for a change that needs a second person, each with Approve and Refuse | `/api/iam/requests`, `approvals`, `people`, `roles`, `scopes` |
| `/access/reviews` | the access reviews, each open, past due or closed, and the form to start one at a place | `/api/iam/reviews`, `people`, `roles`, `scopes` |
| `/access/reviews/:id` | one review: its place and counts, every grant under review with Keep and Remove, and Close the review (a dialog first) once each is decided | `/api/iam/reviews/:id`, `groups`, `people`, `roles`, `scopes` |
| `/access/groups/new`, `/access/groups/:id` | a new group's name; one group: its members with Take out, Add a member by address (the people offered as the browser types), the roles it holds with End, Give the group a role, Rename, and Remove the group (a dialog first) | `/api/iam/groups/:id`, `bindings`, `roles`, `scopes`, `people` |
| `/access/vendor` | how the Vendor may enter (at any time, in a window an Owner opens, only in an incident it declares), picked from a row; the open window with its reason and Close it now, or the form to open one for 1 to 12 hours | `/api/iam/tenant` |
| `/providers` | Ready to send (with the email module: every check an email needs to leave, what to do under each that did not pass, and Check again, which posts `/providers/ready`), the connected providers, the providers to connect as tiles (a colour and initials each, two across on a phone, a heading per kind when there is more than one), and the domain look-up | `/api/providers/instances`, `definitions` |
| `/providers/add/:definition` | where to make the provider's key and what it needs, then its fields to paste | `/api/providers/definitions` |
| `/providers/:id` | one connected provider: its state, its key (stored or not, never shown), Ready to send for an email service, the last check, what can be done to it, and its fields to paste again | `/api/providers/instances/:id` |
| `/email?state=` | a row of the email pages (Write, Addresses, Templates, Lists, and Campaigns and Providers when mounted); first the latest messages and their state, or only those sent, waiting or failed, picked from a row whose chips carry the counts; then, with the campaigns mounted, **Bulk mail today** (messages left under the daily limit, the messages the database writes leave room for, a run's size on the client's Cloudflare plan, the campaigns sending now with how far each is), for a person who may read campaigns; **Provider allowance**, a block per provider that may send: what it says is left (today, this month or on the plan) and when it starts again, and what the portal sent through it today, this week and this month beside the provider's own count, with the provider's words when its key may not read the count | `/api/email/messages`, `/api/email/usage`, `/api/campaigns/room`, `/api/campaigns/campaigns?status=sending` |
| `/backup` | the backup runs | `/api/backup/runs` |
| `/github` | the kit version, a newer release, the deploy runs | `/api/github/status`, `runs` |
| `/health` | each health check with its state, and the free plan's budgets; how many measured ones are close to their line (one not measured yet is not counted) | `/api/health/checks`, `budgets` |
| `/settings` | every setting grouped by module: its value, where it comes from, and a form when the person may change it | `/api/settings/values` |
| `/alerts` | the open alerts with what became of their email and who is on each, then the ones resolved lately | `/api/alerts/items` |
| `/audit?outcome=&module=&actor=&before=` | the audit log, newest first, narrowed from two rows (everything, refused, failed; every section or one) and to one person by tapping their address, paged by Older; each change with how it arrived (method, route, status, code) and, on a computer, where from; the daily seals and whether each holds; the export form | `/api/audit/entries`, `seals` |

The forms, each posting to the screen's own route, which calls the API as the signed-in person:

| Form | Calls | Comes back with |
|---|---|---|
| Invite someone (`/people/invite`): one address or up to fifty (separated by commas, spaces or new lines), a role, a place, and whether to email each link | `POST /api/iam/invitations/many` | who was emailed, the links to pass on by hand (shown once), and who was refused with the reason |
| Make a list (`/records/new`), save its name and place, remove it once empty (a dialog first) | `POST /api/records/lists`, `PATCH`, `DELETE /api/records/lists/:id` | the list with `?done=list-made`; `list-saved`, `list-removed` |
| Add a record, save one, remove one (a dialog first) | `POST /api/records/lists/:id/items`, `PATCH`, `DELETE .../items/:item` | `?done=record-added`, `record-saved`, `record-removed`; a refused value keeps what was typed |
| Add a field, move it up or down, remove it with its values (a dialog first) | `POST /api/records/lists/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=field-added`, `field-moved`, `field-removed` |
| Make a form, save its settings, give it a new address, remove it with its answers (a dialog first) | `POST /api/forms/forms`, `PATCH`, `POST .../key`, `DELETE /api/forms/forms/:id` | the designer with `?done=form-made`; `form-saved`, `form-new-address`, `form-removed` |
| Add, move and remove a form's field (a dialog first) | `POST /api/forms/forms/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=form-field-added`, `form-field-moved`, `form-field-removed` |
| Take an answer or let it go, mark it, add a note or an email reply, remove it (a dialog first) | `PATCH /api/forms/forms/:id/entries/:entry`, `POST .../notes`, `DELETE` | `?done=answer-taken`, `answer-released`, `answer-marked`, `answer-noted`, `answer-replied`, `answer-removed`; a refused note keeps what was typed |
| Add from a spreadsheet (`/records/:id/import`): a CSV file whose first row names the fields | `POST /api/records/lists/:id/import` (the file as the body) | `?done=records-imported`; a refused file shows the list again with the rows named |
| Download for a spreadsheet; the browser asks the API itself | `GET /api/records/lists/:id/export` | the CSV file |
| Withdraw an invitation | `DELETE /api/iam/invitations/:id` | `?done=withdrawn` |
| Give a role (`/people/:id/grant`): the role, the place, for how long (30 days, 90 or a year) and whether it is off until turned on; end one | `POST /api/iam/bindings`, `DELETE /api/iam/bindings/:id` | `?done=granted`, `ended` |
| Save the exceptions (`/people/:id/exceptions`): only what changed is written; end one from the person page | `POST /api/iam/overrides`, `DELETE /api/iam/overrides/:id` | `?done=exceptions-saved`, `exception-ended` |
| Switch the account off, with a reason, or on | `POST /api/users/people/:id/deactivate`, `reactivate` | `?done=off`, `on` |
| Make a role, save one | `POST /api/iam/roles` (placed below every existing role), `PATCH /api/iam/roles/:id` | `?done=role-made`, `role-saved` |
| Add a place (`/access/places`) | `POST /api/iam/scopes` | `?done=place-added` |
| Turn on a role (`/access/mine/turn-on`): which, for how many hours, why | `POST /api/iam/me/grants/:id/activate` | `?done=turned-on` |
| Ask for access (`/access/mine/ask`), withdraw a request | `POST /api/iam/me/requests`, `DELETE /api/iam/me/requests/:id` | `?done=asked`, `request-withdrawn` |
| Approve or refuse a request or an approval (`/access/requests/:id/approve`, `/access/approvals/:id/refuse`) | `POST /api/iam/requests/:id/decision`, `POST /api/iam/approvals/:id/decision` | `?done=request-approved`, `request-refused`, `approval-given`, `approval-refused` |
| Start a review (`/access/reviews`), keep or remove a grant, close it | `POST /api/iam/reviews`, `POST .../items/:binding`, `POST .../close` | the review with `?done=review-opened`; `review-decided`, `review-closed` |
| Make a group (`/access/groups`), rename it, remove it | `POST /api/iam/groups`, `PATCH`, `DELETE /api/iam/groups/:id` | the group with `?done=group-made`; `group-renamed`, `group-removed` |
| Add a member by address, take one out | `GET /api/iam/people?q=` then `POST /api/iam/groups/:id/members`, `DELETE .../members/:principalId` | `?done=member-added`, `member-removed`; an address with no account says so |
| Give the group a role, end one | `POST /api/iam/bindings` (subject the group), `DELETE /api/iam/bindings/:id` | `?done=group-granted`, `group-grant-ended` |
| The Vendor's access (`/access/vendor/mode`), open a window, close it | `PUT /api/iam/tenant/vendor-access`, `POST`, `DELETE /api/iam/tenant/vendor-window` | `?done=vendor-mode`, `window-opened`, `window-closed` |
| Look up a domain (`/providers/detect`) | `POST /api/providers/detect` | what was found, on the page |
| Connect a provider (`/providers/add/:definition`): a name and its fields; one step since 2026-10-29: the key is checked at once, and a working email key becomes the one that sends when none does and has its addresses read | `POST /api/providers/instances`, then `.../probe`; for email `.../activate` and `POST /api/email/domains/discover` | Write with `?done=connected`; a refused key its provider with `?done=connected-refused`; another kind `?done=checked` |
| Check again, under Ready to send (`/providers/ready`, back to the page it was pressed on) | `POST /api/email/ready/check` | `?done=rechecked` |
| Check the key; Send a test message, to the address typed or your own | `POST /api/providers/instances/:id/probe`, `POST /api/email/canary` (`to`) | `?done=checked`, `tested`; the answer under Last check |
| Make it the one that sends (then the email held while none did is sent: `POST /api/email/release`), take it out of use, remove it | `POST .../activate`, `.../disable`, `DELETE /api/providers/instances/:id` | `?done=sends`, `taken-out`, `removed` |
| Paste the key again | `POST /api/providers/instances/:id/credential` | `?done=key-saved` |
| Save a setting (`/settings/:key`): text, a number or a switch, turned into the setting's type | `PUT /api/settings/values/:key` | `?done=setting-saved` |
| I am on it (`/alerts/:id/acknowledge`) | `POST /api/alerts/items/:id/acknowledge` | `?done=acknowledged` |
| Download as CSV: two dates, the last 7 days by default; the browser asks the API itself, so the file downloads | `GET /api/audit/export?since=&until=` | the CSV file |

A change that worked redirects to its page with a `done` key, which the page turns into a fixed
sentence: no address or name travels in the address bar. A change the API refused shows the page
again with the API's reason and its status. Choices of one (a role, a place, a kind) are
`ChoiceChips` from `@oltrem/core-ui`: every option visible in a sideways row. A provider's secret
fields are password fields; an optional field left empty is left out, and a secret is never put
back into a page.

Every page sits in the same frame (`src/layout.tsx`); [The frame](#the-frame) below has the
detail. The sections are in the sidebar only, the owner's choice of 2026-10-22 (R-12). Each section's page says in one line what it is for, then a row of its actions
(`ActionRow`, links to the page's own forms), a row of summary tiles counted from the same API
answers the page already reads (`Stats`; no extra request), and its sections, a form in a panel.
Empty lists say so in a dashed box, and a list picked down to nothing says nothing matches. The theme
switch posts `theme` (light, dark or system) and `back` to `POST /ui/theme`, which keeps the choice
in the `oltrem_theme` cookie (cleared for system) and returns to `back` when it is a path on the
portal, Home otherwise; the frame then sets `data-theme` on the page. A form posted from another
site is refused.

## The frame

Every page sits in one frame, drawn on the server:

- **The sidebar**, from 1024 px wide, down the left edge in the page's own colour with one line
  beside it. From the top: an arrow that closes it, the portal's mark, a search box (a plain form
  to `/search`, `Ctrl K` or `⌘K` from anywhere), Home, then every mounted section under its group,
  and at the foot who is signed in. Rows are 36 px (44 px on a touch screen).
- **Groups**, in this order: Work, Company, People, Messages, System (since 2026-10-29, the owner's ask:
  few entries, sub-pages as tabs). A module's page joins its group wherever the module
  is listed; a group the kit does not know sits before System (`groupRank` in `src/layout.tsx`).
  Each group has a colour (`hueOf`): its dot, its icons, and the tint and edge marker of the
  section on screen, which is also bold, so it never rests on colour alone. Home's cards use the
  same colours.
- **Tabs.** Sections that name the same `tabs` (`PageNav.tabs`) fold into one sidebar entry under
  that name, at the first one's place, leading to the first tab and marked on any of them; each
  of their pages opens with the set as a sideways row of tabs above its title (`tabSet` and
  `sideEntries` in `src/layout.tsx`). The section labelled as the set is the first tab, the rest
  follow in the sidebar's order. A page with no entry of its own sits under the module's entry its
  path starts with (`/email/sent/7` under Sent). With every kit module on, the sidebar holds 18
  entries besides Home:

  | Group | Entries (tabs) |
  |---|---|
  | Work | Records, Forms, Bookings, Tasks, Files, Approvals, Announcements, Analytics, Automations |
  | Company | Team (Shifts, Time clock, Time off, Expenses, Equipment), Sales (Quotes, Invoices) |
  | People | People (People, Access), Customers (Customers, Privacy) |
  | Messages | Email (Write, Drafts, Sent, Activity, Addresses, Providers), Campaigns (Campaigns, Templates, Lists) |
  | System | System health (System health, Backups, Deploys, Alerts), Settings (Settings, Audit log), Developer |
- **Closed to icons.** The arrow closes the sidebar to a 64 px rail and opens it again. Only the
  words fade: no icon moves. A section's name shows beside the rail while the pointer or the
  keyboard is on it. The choice posts `side` (`closed` or `open`) and `back` to `POST /ui/side`,
  which keeps it in the `oltrem_side` cookie, so the next page is drawn the same with no jump.
- **Your account**, at the foot: pressed, a small menu opens above it (to the right of the closed
  rail) with your address, My access, the colour theme as three icons and, on this computer, Sign
  out. The theme posts `theme` (light, dark or system) and `back` to `POST /ui/theme`, which keeps
  the choice in the `oltrem_theme` cookie (cleared for system); the frame then sets `data-theme`
  on the page. Both switches return to `back` when it is a path on the portal, Home otherwise, and
  refuse a form posted from another site.
- **On a phone**, a top bar with a Menu button that opens the same parts as a drawer from the left
  (a `dialog` opened by the browser's `commandfor`; a tap outside closes it); the phone's bar also
  has a search button. The document names the phone browser's bar colour (light, dark, or both for
  the device's own).

**No reloads.** The frame's script (`src/client/frame.js`, served at `/ui/app.js` under its
version) opens a link to one of the portal's pages, a search, a filter or a form's change in
place: it fetches the next page and swaps only the page's content (`main.ui-page`), so the
sidebar stays on screen where it was scrolled and the section on screen is marked as the new page
marks it. The address, the title, Back and Forward (with the page's scroll) behave as on a load.
A page change fades the content in where the browser has view transitions and motion is on; a
change that comes back to the same page keeps its scroll and brings its outcome (a `Done` notice
or an error) into view. Focus moves to the new page's heading, or to a form's errors. The page
under the pointer is fetched a moment ahead, so the click opens it at once. The arrow and the
theme switch act at once and save behind the scenes. A button with `data-copy` copies that value
to the clipboard and says "Copied", aloud too, for two seconds. A thin line at the top shows a page that is
still loading.

**Live blocks.** A block marked `data-live="name"` with `data-refresh="seconds"` (at least five)
is kept up to date: the script fetches the page again, or the lighter page `data-refresh-from`
names, and swaps that block alone, so what the person is reading or typing elsewhere stays. It
does not fetch while the tab is hidden, a dialog is open, a page is on its way or the person is in
a form. A block whose new copy has no `data-refresh` stops refreshing; a fetch that fails dims the
block (`data-stale`) until one works. A campaign's progress is the first such block.

What the script leaves to the browser: another site, a new tab, a download, the API, the hooks,
`/ui/*`, the local door and the invitation link (`NATIVE` in the script), and an answer that is
not a page. When the sidebar itself changed (a section given or taken away, another account: the
frame's `data-frame` key), it draws the new sidebar and keeps where it was scrolled. When a form's
change gets no answer, it says so on the page instead of sending it twice. With no script at all,
every link and form works as a plain load.

An address that answers nothing, opened in a browser (a `GET` that accepts HTML, outside
`/api/`), is the **Not found** page in the frame, with a way to the home page, still with the 404
status. Only the API's problem answer is replaced: a page's own 404 is kept, and `/api/` keeps
the problem.

## The stylesheet and the script

`src/generated/app-css.ts` holds the one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s
theme and the classes the pages and primitives use, about 46 KiB. `src/generated/app-js.ts` holds
the frame's script, copied from `src/client/frame.js`, about 20 KiB. They are served at
`/ui/app.css` and `/ui/app.js`, cached for good under their version and `no-cache` without it.
After changing a class in a page or a primitive, or the script, run `pnpm ui:build`; a test fails
while a committed file differs from what the build writes. Both files are generated: never edit
them by hand (R-06).

## Not here yet

- **The other forms.** Profiles, a setting whose value is not text, a number or a switch, a
  provider's delivery-report address and the client's own provider definitions: still the API
  until their forms come.
- **The kit's own pages from the manifest.** A module's own pages mount from its manifest; the
  kit's first pages are still the fixed list in `src/layout.tsx`, and move onto their modules'
  manifests one at a time. The i18n fields come later.
- **Astro.** The plan names Astro for the screens. These are Preact components rendered by the
  Worker itself, so the kit's two commands run them with no second build; the same components
  move under Astro when its renderer is built, if the sandbox measurement favours it.
- **Spanish.** Every word is English until the i18n fields exist.

## Tests

`test/css.test.ts` holds the committed stylesheet to its build; `test/module-pages.test.ts` mounts a module's pages on Node: the sidebar entry in its group, the page in the frame, a form back by its redirect and another site's refused. The client template's
`test/screens.test.ts` runs the whole first run inside the Workers runtime: the Vendor signs in on
this computer, creates the company, the Owner accepts, every page answers with its words and
Home shows every module's card; a
stranger is told there is no account; behind Access the local door does not exist. A second test
makes a role and a place, invites someone who accepts, ends and gives their role, switches the
account off and on, allows one thing and denies another as exceptions (the person is then refused
the denied page and shown the allowed one, and Home shows them only the cards they may read), puts one back to their roles and ends the other,
withdraws an invitation, and sees a refusal and a cross-site form refused; later the Owner invites
two people at once with their links emailed, their own address refused, and a member asks for a
role, the Owner approves it (the member is refused deciding it themselves), then opens an access
review at the company, keeps every grant and closes it; then the Owner makes a group, adds the
member (an unknown address refused), gives the group a role that is off until turned on, which the
member turns on for an hour, ends it, is refused removing the group, and opens and closes a window
for the Vendor; and the Owner adds two suppliers to a list from a CSV file after a file with a
bad address is refused with its row. A
third connects Resend, with the provider's answers stood in for: a missing key refused, the key
checked, a test message refused for want of a sending address, the address refused when malformed
and saved on the Settings page, the test message then sent, the provider made the one that sends,
refused removal while it sends, taken out of use, its key pasted again, and removed. A fourth
names an alert recipient on the Settings page, lets a failed deploy report fail its check twice
on the tick, and sees the alert emailed, on the Alerts page and on Home, acknowledges it, and
sees it resolved once the check passes. The last counts the database queries of Home and of every page in the
sidebar once the journeys have filled the tables: Home within 40 and every other page within 10 of
the Free plan's 50 an invocation, each page over its share named.
