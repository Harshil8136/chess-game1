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
When the app has core-http's inner call (`INNER_CALL`), `api` answers in process with the page's
own identity instead of sending each call through the whole pipeline again: the same checks run,
and a page is one pass through the pipeline however many calls it makes (core-http's README).

## Using it

```ts
import { createScreens } from '@oltrem/screens';

const screens = createScreens({ portal: client.name, owner: client.owner, modules });
const app = createApp<Env>({
  modules,
  publicRoutes: screens.publicRoutes, // /ui/app.css and /ui/app.js, before the door
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

`createScreens({ frames })` (2026-11-10) draws one of the kit's own pages inside a module's
frame, by its address: the function takes the page as drawn and the page's API and returns what
the frame shows. The client template hands `{ '/email': emailFrame }` from `@oltrem/email/pages`,
so the delivery log sits beside Email's folders like every other Email page.

## The pages

| Path | Shows | Reads |
|---|---|---|
| `/` | a Vendor with no company yet: the company form, its first Owner the one setup named as Owner (`GET /api/iam/setup-people`), the client file's address only when setup named none (2026-11-08: the placeholder was invited instead of the named Owner); anyone else (Look 3, 2026-11-08): a welcome band saying how much waits, with a chip to Needs you and to Get started when either has something; then Get started, with a bar of the steps done, while a step of setting the portal up is open (each step ticked by what is stored, an open one a row to its page, or with a button when one press does it, `POST /ui/get-started`; with email on, the email step leads to the one-step setup, `/email/connect`; the Modules page can switch the card off), then Needs you (what waits for them from each module that answers it, each a row to the page that acts on it, or a line saying nothing waits), then the Home card of each mounted module that has one and that they may read (a figure, a line, a state), in the row's order | `/api/iam/me` (and `/api/iam/setup-people` for the company form), then each `/api/<module>/onboarding`, `/api/<module>/todo` and `/api/<module>/home`, together |
| `/search?q=` | the search box, then what matches two letters or more: the sections by name and line, then each module that searches, as the person (a module that refuses them is left out); nothing found says so | each `/api/<module>/search` |
| `/look` | Look and colours (2026-11-03): the 24 palettes of `looks.ts` (a primary, an accent and greys leaning to its hue, both themes) as tiles showing their gradient, and the backgrounds (Soft wash, Plain, Aurora, Sunrise, Dots, Grid, Lines) as tiles showing a piece of each (`preview`); a press saves at once (`data-autosave`), Save only for a page without its script, Back to the portal's own. An Owner or the Vendor also has Make it everyone's look: `POST /ui/look/everyone` saves the look on the form as the `settings.look` setting through `PUT /api/settings/values/settings.look` and clears their own cookie (a refusal shows as a toast). `POST /ui/look` keeps `<palette>.<pattern>` in the `oltrem_look` cookie (an id not in the lists is the kit's own; reset clears it); every page then carries the look's CSS in `<style id="ui-look">` in its head, about a kilobyte, none for the kit's own look; the frame's script swaps it with the page. `createScreens({ look })` is the portal's look until a person picks one: a string, or a function read on each page (the template's returns `settings.look`, else the client file's `brand.look`) | `/api/iam/me`; `PUT /api/settings/values/settings.look` |
| `/notifications?show=&before=` | the person's notifications, All or Unread, Mark all read, thirty a page, and how each module tells them; `/notifications/:id` marks one read and opens its page | `/api/users/me/notifications`, `/api/users/me/notifications/choices` |
| `/settings/parts?show=&q=&preset=` | whoever holds `settings.parts` (every Owner and the Vendor at first, anyone a role gives it to; the tab shows to them alone, asked of the API when the Settings tabs are on screen, and anyone else at the address reads "You need the permission to switch modules"): the Modules page, a dashboard. How many modules are on; All, On (n) and Off (n) chips and a search box (at once with the frame script, by `?q=` without it); the presets as "Start from" chips (Everything, Email only, Nothing optional, and the set saved now) that fill the switches without saving; then a section per sidebar group (Work, Company, Users & access, Messages, System), each module a tile in one column on a phone and two on a wide screen with the sidebar's icon, its name, one line, On or Off and its switch, Always on for the core, what it needs and what needs it, and a warning when it is off while a module that needs it is on (kept in step by the frame script before Save); under a module's line, its optional extras (the daily audit seal, the emails about access ending, the review and restore-drill reminders), each with its own switch, a core module's too, kept as they are saved when a preset fills the module switches; one Save bar at the bottom sends the whole set, and a refusal names the module that still needs another | `/api/settings/parts`, `PUT /api/settings/parts` |
| `/setup/company` | the invitation link for the first Owner, after the form is sent | `POST /api/iam/tenant` |
| `/accept?token=` | the invitation and its Accept button; accepting returns to `/` | `POST /api/iam/invitations/accept` |
| `/records` | the lists the person may see, with their records and location; Create list when a role allows it somewhere | `/api/records/lists` |
| `/records/new` | a new list: its name, its location picked from a row, and a starting shape (blank, contacts, tasks, stock, orders, equipment) | `/api/records/lists` |
| `/records/:id?q=&field=&value=&sort=&dir=&page=` | a list's records: searched, narrowed by a row of chips per choice or yes or no field, sorted from a row, paged; the add form and Add from a spreadsheet when the person may add | `/api/records/lists/:id`, `items` |
| `/records/:id/items/:item` | one record with who added and changed it; the form to change it and Remove, as the person may | `/api/records/lists/:id`, `items/:item` |
| `/records/:id/fields` | the designer: the fields in order with up, down and Remove; Add a field; the name and location; Remove the list once empty | `/api/records/lists/:id`, `/api/records/lists` |
| `/forms` | the forms the person may see, with their new answers and whether each takes answers; Make a form when a role allows it somewhere | `/api/forms/forms` |
| `/forms/new` | a new form: its name, its location picked from a row, and a starting shape (contact us, quote request, feedback, sign-up, blank) | `/api/forms/forms` |
| `/forms/:id?view=&mine=&q=&page=` | the inbox: a row of statuses with their counts (to do, new, open, done, all), a row for the answers the person took, a search box, paged; Try the form, the designer, the download | `/api/forms/forms/:id`, `entries` |
| `/forms/:id/entries/:entry` | one answer as it was sent; Take it or Let it go, Mark new, open or done; its notes and email replies, and the form that adds one; Remove, as the person may | `/api/forms/forms/:id`, `entries/:entry` |
| `/forms/:id/design` | the designer: the code for a website, a new address, the fields with up, down and Remove, Add a field, the settings (name, line, taking answers, the page after sending, who is told, location), Remove | `/api/forms/forms/:id`, `/api/forms/forms` |
| `/forms/:id/try` | the form as a website shows it, posting to its public address | `/api/forms/forms/:id`, `/hooks/forms/:key` |
| `/people?show=` | the Users page: everyone in the directory, or only the Active (`on`) or Deactivated (`off`), picked from a row; Invite someone (the page's one main action, `#invite` on the same page); the invitations waiting, each with a quiet Withdraw; the one invitation form: addresses one per line or by commas, the roles the person may give as chips (below their own standing; the Owner role only for the Vendor and Owners), the location folded to "Location: Whole company · change", and "Review access in" 30 days, 90 (the default) or a year | `/api/iam/me`, `/api/users/people`, `/api/iam/roles`, `scopes`, `invitations` |
| `/people/:id` | one user: who they are and whether they are Active or Deactivated; their roles as rows, "Role · at Location · until date", each with a quiet Change (a dialog: another role or location; the old grant ends and the new one is given in one step) and a quiet Remove (a dialog first); Give another role, folded, without the roles they already hold at the whole company (the API refuses a duplicate in plain words too), with "Only when they switch it on (for a few hours)" under More options; What they can do, a row per module with how many of its permissions they hold and their level in the role editor's words (View, Edit, Admin, Custom; Special only), its arrow opening each permission with where it comes from, and the link to view it at another location; their permission overrides with Add a permission override; Deactivate the user or Reactivate the user in a Danger zone at the bottom | `/api/users/people/:id`, `/api/iam/bindings?inForce=true`, `roles`, `scopes`, `overrides`, `capabilities`, `people/:id/access` |
| `/people/:id/exceptions?part=` | Permission overrides: only what the user has, each with a quiet End (a dialog first), and Add a permission override: a module picked from a row of links, then one of its permissions, Allow (the default) or Deny (folded, explained in one line), the location folded to the whole company, and when it is looked at again. Only permissions that may be given one user at a time are offered; a module with nothing left to add is not | `/api/iam/overrides`, `capabilities`, `scopes` |
| `/people/:id/see?place=` | "View what they can do": what the user can do at one location, picked from a row, each capability with yes or no and where it comes from (the role and location, a group's role, or a permission override, a deny first), grouped by module; a deactivated user says so. Read only, never their session | `/api/users/people/:id`, `/api/iam/scopes`, `/api/iam/people/:id/access` |
| `/access` | Roles, the first page of Users & access: Create role (the page's one main action, for those who may make roles); each role in a line with the modules it reaches, how many permissions and how many hold it; "How permissions work" folded. Every Users & access page opens with one row of tabs under its head: Users, Roles, Groups, Locations, and Access requests and Access reviews for those who may give roles, Vendor access for Owners and the Vendor (`PeopleNav`, from `may` in `/api/iam/me`); the frame draws no tabs above them (`ownRow`). Before the company exists each of them shows "First, name the company" with the company form instead, and nothing that would fail | `/api/iam/me`, `roles`, `bindings?inForce=true` |
| `/access/groups` | the groups with their member counts, and Create group | `/api/iam/groups` |
| `/access/places` | the Locations page: the locations of the company as a tree (each with the locations it sits inside), and the form to add one (Add location) | `/api/iam/scopes` |
| `/access/roles/new?from=&name=`, `/access/roles/:id` | the role editor: its name first; for a new role, Start from Nothing, a ready set (View only, Standard user, Full admin: View, Edit or Admin in every module) or Copy of any role but the Owner, as buttons of the same form so the name typed is kept (`from=template:see\|do\|manage`, `role:<id>`); then the permission matrix (2026-11-03): one row per module, by the module's name (`names.ts`), sorted, each with how many of its permissions the role holds and its level as four chips always in view, None / View / Edit / Admin (each holds the one before; a level the module has not is faded and cannot be picked; a level never holds a special permission), no chip on and "Custom" when the ticks match none; the arrow at a row's end opens its permissions to tick one by one, in words (its id only in the title). Above the rows, with the page script, Find a module (it hides the rows it does not match) and Set all shown to None / View / Edit / Admin (each shown row takes that level, or its highest below it). Under them, Special permissions grouped by module, each badged "asks for a fresh sign-in", "needs a second person's yes" or "Owner role only", to tick on purpose; Owner-only permissions listed only on the Owner role, Vendor-only never. A Save bar at the bottom holds the sentence of what it holds ("Views 6 modules, edits 3, administers 1"). The page script ticks a level's boxes and moves the level as boxes change; without it the server works the level out (below). The Owner role is the Vendor's to change: anyone else reads it as a summary with no Save. An existing role adds who holds it and Remove the role (a dialog first) | `/api/iam/roles/:id`, `roles`, `capabilities`, `me`, `bindings?roleId=&inForce=true`, `groups`, `people` |
| `/access/mine` | My access, for everyone (also linked under the account in the sidebar): the roles they hold, each at its location, through them or a group, until when, and in force, ended, not started or only when switched on; the form to switch such a role on for 1 to 12 hours with a reason; the form to ask for a role at a place with a reason (every role but the Owner's); their requests and what became of each | `/api/iam/me/options`, `me/grants`, `me/requests` |
| `/access/decisions` | Access requests: the access requests still open (who, the role and location, why) and the approvals for a change that needs a second person, each with Approve and a quiet Refuse | `/api/iam/requests`, `approvals`, `people`, `roles`, `scopes` |
| `/access/reviews` | the access reviews, each open, past due or closed, and the form to start one at a location | `/api/iam/reviews`, `people`, `roles`, `scopes` |
| `/access/reviews/:id` | one review: its location and counts, every grant under review with Keep and Remove, and Close the review (a dialog first) once each is decided | `/api/iam/reviews/:id`, `groups`, `people`, `roles`, `scopes` |
| `/access/groups/new`, `/access/groups/:id` | a new group's name; one group: its members, each with a quiet Take out (a dialog first); Add members, ticked from the users with an account who are not in it yet (never yourself), or by an address typed under "Someone not listed?"; the roles it holds as rows with Change and Remove; Give the group a role with the same role and place fields as inviting; Rename or remove the group, folded | `/api/iam/groups/:id`, `bindings`, `roles`, `scopes`, `people?active=true&kind=person` |
| `/access/vendor` | how the Vendor may enter (at any time, in a window an Owner opens, only in an incident it declares), picked from a row; the open window with its reason and Close it now, or the form to open one for 1 to 12 hours; for a Vendor only, Vendor accounts: each address, On or Off, with Switch off or Switch on (not on your own), and Add a Vendor account | `/api/iam/tenant`, `/api/iam/me`, and `/api/iam/vendors` for a Vendor |
| `/providers` | Find from a domain and Connect in the page's tools; Ready to send as a pane; with the email module, Email in one step first (Set up email opens `/email/connect`: the address and the key, and the portal does the rest), the provider tiles below it the way by hand (with the email module: every check an email needs to leave, what to do under each that did not pass, Check again, which posts `/providers/ready`, and the list folded away once all pass), the connected providers as cards (initials, state, today's use on a meter where the provider tells it, the key and its last answer), the providers to connect as tiles (two across on a phone, more as the page widens, a heading per kind when there is more than one), and the domain look-up | `/api/providers/instances`, `definitions`, `/api/email/usage` |
| `/providers/add/:definition` | where to make the provider's key and what it needs, then its fields to paste | `/api/providers/definitions` |
| `/providers/:id` | one connected provider, titled with its name: its state, its key (sealed or missing, never shown) and its last check as figures, the last failure in full, what can be done to it, Ready to send for an email service, the provider's own steps folded; beside them on a wide page, the test message and its fields to paste again; a new key saved there (`POST /providers/:id/key`) is checked at once, so Last check and Ready to send show the new key's answer (2026-11-08) | `/api/providers/instances/:id`; after a new key, its `/probe` |
| `/email?state=` | Delivery log (named Activity before 2026-11-08): the day's figures (sent, on the way, problems, opened, from the last 14 days), then the latest messages as rows (whom, the subject or what kind, what became of it, a mark at the edge for a problem), or only those sent, waiting or failed, picked from a row with the counts; a 14-day chart of what went out by outcome, with its table for a screen reader; then, with the campaigns mounted, **Bulk mail today** (messages left under the daily limit, the messages the database writes leave room for, a run's size on the client's Cloudflare plan, the campaigns sending now with how far each is), for a person who may read campaigns; **Provider allowance**, a block per provider that may send: what it says is left (today, this month or on the plan) and when it starts again, and what the portal sent through it today, this week and this month beside the provider's own count, with the provider's words when its key may not read the count | `/api/email/messages`, `stats`, `usage`, `/api/campaigns/room`, `/api/campaigns/campaigns?status=sending` |
| `/backup` | the backup runs | `/api/backup/runs` |
| `/github` | the kit version, a newer release, the deploy runs | `/api/github/status`, `runs` |
| `/health` | each health check with its state, and the free plan's budgets; how many measured ones are close to their line (one not measured yet is not counted) | `/api/health/checks`, `budgets` |
| `/settings?show=changed&q=` | the settings in sections with plain names, in a fixed order (Company, Email, Money, Users & access, Security; System for the Vendor alone), each a chip in a sideways row and an anchor; All and Changed (n) chips and a search box (at once with the frame script, by `?q=` without it). Each row: its title, one line, its value in a control of its type (a box, a number with its unit, a switch, a choice as chips, a list one item per line); since Look 3 (2026-11-08) one Save bar rises at the foot once anything changed, with Discard, instead of a Save on every row (always showing without the page script); Changed with the default and Reset to default when it is not the default, and who changed it last and when. An Owner, or anyone but the Vendor, sees only the rows they may change, and one line counting the rest; the Vendor also sees each key, small and muted. Settings that share a name across modules (the currencies, the time zones) get one form above them that sets them all | `/api/settings/values` |
| `/alerts` | the open alerts with what became of their email and who is on each, then the ones resolved lately | `/api/alerts/items` |
| `/audit?outcome=&module=&actor=&before=` | the audit log, newest first, narrowed from two rows (everything, refused, failed; every section or one) and to one person by tapping their address, paged by Older; each change with how it arrived (method, route, status, code) and, on a computer, where from; the daily seals and whether each holds; the export form | `/api/audit/entries`, `seals` |

The forms, each posting to the screen's own route, which calls the API as the signed-in person:

| Form | Calls | Comes back with |
|---|---|---|
| Invite someone (`/people/invite`): one address or up to fifty (one per line, or separated by commas or spaces), a role, a location, when access is looked at again (the Owner role never ends), and whether to email each link | `POST /api/iam/invitations/many` | who was emailed, the links to pass on by hand (shown once), and who was refused with the reason |
| Create list (`/records/new`), save its name and location, remove it once empty (a dialog first) | `POST /api/records/lists`, `PATCH`, `DELETE /api/records/lists/:id` | the list with `?done=list-made`; `list-saved`, `list-removed` |
| Add a record, save one, remove one (a dialog first) | `POST /api/records/lists/:id/items`, `PATCH`, `DELETE .../items/:item` | `?done=record-added`, `record-saved`, `record-removed`; a refused value keeps what was typed |
| Add a field, move it up or down, remove it with its values (a dialog first) | `POST /api/records/lists/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=field-added`, `field-moved`, `field-removed` |
| Make a form, save its settings, give it a new address, remove it with its answers (a dialog first) | `POST /api/forms/forms`, `PATCH`, `POST .../key`, `DELETE /api/forms/forms/:id` | the designer with `?done=form-made`; `form-saved`, `form-new-address`, `form-removed` |
| Add, move and remove a form's field (a dialog first) | `POST /api/forms/forms/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=form-field-added`, `form-field-moved`, `form-field-removed` |
| Take an answer or let it go, mark it, add a note or an email reply, remove it (a dialog first) | `PATCH /api/forms/forms/:id/entries/:entry`, `POST .../notes`, `DELETE` | `?done=answer-taken`, `answer-released`, `answer-marked`, `answer-noted`, `answer-replied`, `answer-removed`; a refused note keeps what was typed |
| Add from a spreadsheet (`/records/:id/import`): a CSV file whose first row names the fields | `POST /api/records/lists/:id/import` (the file as the body) | `?done=records-imported`; a refused file shows the list again with the rows named |
| Download for a spreadsheet; the browser asks the API itself | `GET /api/records/lists/:id/export` | the CSV file |
| Withdraw an invitation | `DELETE /api/iam/invitations/:id` | `?done=withdrawn` |
| Give a role (`/people/:id/grant`): the role, the location, when it is looked at again (30 days, 90 or a year; the Owner role never ends) and whether it is used only when switched on; change one (`/people/:id/grants/:binding/change`): the new one given and the old one ended, or the old one ended first for the same role and place, a step that fails after the other worked said plainly ("Only half done"); remove one | `POST /api/iam/bindings`, `DELETE /api/iam/bindings/:id` | `?done=granted`, `role-changed`, `ended` |
| Add a permission override (`/people/:id/exceptions`): one permission, allowed or denied, at a location, until a date; end one | `POST /api/iam/overrides`, `DELETE /api/iam/overrides/:id` | `?done=extra-added`, `exception-ended` |
| Switch the account off, with a reason, or on | `POST /api/users/people/:id/deactivate`, `reactivate` | `?done=off`, `on` |
| Create a role, save one, remove one (`/access/roles/:id/remove`) | `POST /api/iam/roles` (placed below every existing role), `PATCH`, `DELETE /api/iam/roles/:id`; each module posts `level:<part>` and the level it showed, `was:<part>`: a changed level gives that level's permissions, otherwise the module's ticked `capabilities` count (so Custom, and a box ticked without the script, are kept); special permissions only from their boxes. A name another role has, or nothing chosen, is refused before the API | the role with `?done=role-made`; `role-saved`; `/access` with `role-removed`; a refusal shows the page again with the name and the choices as sent, under "The role was not created" (or saved) and the reason in words |
| Add location (`/access/places`) | `POST /api/iam/scopes` | `/access/places` with `?done=place-added` |
| Turn on a role (`/access/mine/turn-on`): which, for how many hours, why | `POST /api/iam/me/grants/:id/activate` | `?done=turned-on` |
| Ask for access (`/access/mine/ask`), withdraw a request | `POST /api/iam/me/requests`, `DELETE /api/iam/me/requests/:id` | `?done=asked`, `request-withdrawn` |
| Approve or refuse a request or an approval (`/access/requests/:id/approve`, `/access/approvals/:id/refuse`) | `POST /api/iam/requests/:id/decision`, `POST /api/iam/approvals/:id/decision` | `?done=request-approved`, `request-refused`, `approval-given`, `approval-refused` |
| Start a review (`/access/reviews`), keep or remove a grant, close it | `POST /api/iam/reviews`, `POST .../items/:binding`, `POST .../close` | the review with `?done=review-opened`; `review-decided`, `review-closed` |
| Make a group (`/access/groups`), rename it, remove it | `POST /api/iam/groups`, `PATCH`, `DELETE /api/iam/groups/:id` | the group with `?done=group-made`; `group-renamed`, `group-removed` |
| Add members, ticked or by address, take one out; give the group a role, change it, end it | `GET /api/iam/people?q=` for a typed address, then `POST /api/iam/groups/:id/members` for each, `DELETE .../members/:principalId`; `POST`, `DELETE /api/iam/bindings` | `?done=member-added`, `member-removed`, `group-granted`, `group-grant-changed`, `group-grant-ended`; an address with no account says so |
| Give the group a role, end one | `POST /api/iam/bindings` (subject the group), `DELETE /api/iam/bindings/:id` | `?done=group-granted`, `group-grant-ended` |
| The Vendor's access (`/access/vendor/mode`), open a window, close it | `PUT /api/iam/tenant/vendor-access`, `POST`, `DELETE /api/iam/tenant/vendor-window` | `?done=vendor-mode`, `window-opened`, `window-closed` |
| Add a Vendor account (`/access/vendor/accounts`), switch one off or on (`/access/vendor/accounts/:id/off`, `/on`) | `POST /api/iam/vendors`, `PUT /api/iam/vendors/:id/active` | `?done=vendor-added`, `vendor-off`, `vendor-on` |
| Do a Get started step on Home (`/ui/get-started`: the module and the step's place) | the module's steps read again (`GET /api/<module>/onboarding`), then only that step's own `action.path` (POST, empty body); a step without one, or a module with no steps, calls nothing | `/?done=step-started`; a refusal shows Home again with the reason as a toast |
| Look up a domain (`/providers/detect`) | `POST /api/providers/detect` | what was found, on the page |
| Connect a provider (`/providers/add/:definition`): a name and its fields; one step since 2026-10-29: the key is checked at once, and a working email key becomes the one that sends when none does, has its addresses read and (since 2026-11-03) its delivery reports registered at the provider by API | `POST /api/providers/instances`, then `.../probe`; for email `.../activate`, `POST /api/email/domains/discover` and `POST /api/email/instances/:id/reports` (Resend, Brevo, Mailjet; another provider answers that it is set up by hand, and the address stays on its page) | Write with `?done=connected`; a refused key its provider with `?done=connected-refused`; another kind `?done=checked` |
| Check again, under Ready to send (`/providers/ready`, back to the page it was pressed on) | `POST /api/email/ready/check` | `?done=rechecked` |
| Check the key; Send a test message, to the address typed or your own | `POST /api/providers/instances/:id/probe`, `POST /api/email/canary` (`to`) | `?done=checked`, `tested`; the answer under Last check |
| Make it the one that sends (then the email held while none did is sent: `POST /api/email/release`), take it out of use, remove it | `POST .../activate`, `.../disable`, `DELETE /api/providers/instances/:id` | `?done=sends`, `taken-out`, `removed` |
| Paste the key again | `POST /api/providers/instances/:id/credential` | `?done=key-saved` |
| Save the Settings page (`/settings`, Look 3, 2026-11-08): every row is one form's, `value:<key>` beside `was:<key>`, the value it showed; only a row that differs is sent, each in turn as if saved alone, and the first refusal comes back with its value in its box | `PUT /api/settings/values/:key` for each changed row | `?done=settings-saved`, or `settings-unchanged` when nothing differed |
| Save a setting (`/settings/:key`): text, a number, On or Off, a choice, or a list one item per line (blank lines dropped), turned into the setting's type; a refused value comes back in its box | `PUT /api/settings/values/:key` | `?done=setting-saved` |
| Reset a setting to its default (`/settings/:key/reset`, the row's quiet button) | `PUT /api/settings/values/:key` with the default the list names | `?done=setting-reset` |
| One value for the settings that share a name (`/settings/same/:name`, as `currency`): each saved in turn through the API, so each is checked and audited as if saved alone; the first refusal stops it, and the ones before it stay saved | `PUT /api/settings/values/:key`, once each | `?done=settings-same` |
| I am on it (`/alerts/:id/acknowledge`) | `POST /api/alerts/items/:id/acknowledge` | `?done=acknowledged` |
| Download as CSV: two dates, the last 7 days by default; the browser asks the API itself, so the file downloads | `GET /api/audit/export?since=&until=` | the CSV file |

A change that worked redirects to its page with a `done` key, which the page turns into a fixed
sentence: no address or name travels in the address bar. A change the API refused shows the page
again with the API's reason and its status. Choices of one (a role, a location, a kind) are
`ChoiceChips` from `@oltrem/core-ui`: every option visible in a sideways row. A provider's secret
fields are password fields; an optional field left empty is left out, and a secret is never put
back into a page.

Every page sits in the same frame (`src/layout.tsx`); [The frame](#the-frame) below has the
detail. The sections are in the sidebar only, the owner's choice of 2026-10-22 (R-12). Each section's page opens with
its head (since 2026-11-01, the owner's point 12): one row with the group's icon on its colour, the
title, one short line on what it is for (a module page may give its own, `sub`) and, on the right,
the page's tools (`tools`: a few links in a button's look, the main one last); then, for a section
that is one of a set, the set's tabs ([The frame](#the-frame)). Then a row of
its actions (`ActionRow`, links to the page's own forms), a strip of figures counted from the same
API answers the page already reads (`Stats`; no extra request), and its sections, a form in a
panel. The pages remade on 2026-10-31 use the console pieces of `@oltrem/core-ui` instead.
Empty lists say so in a dashed box, and a list picked down to nothing says nothing matches. The theme
switch posts `theme` (light, dark or system) and `back` to `POST /ui/theme`, which keeps the choice
in the `oltrem_theme` cookie (cleared for system) and returns to `back` when it is a path on the
portal, Home otherwise; the frame then sets `data-theme` on the page. A form posted from another
site is refused.
Sign out, in the same account menu, is a plain post (`data-reload`, so the browser follows it out
of the portal): behind Access to `SIGN_OUT`, `POST /api/iam/me/sign-out`, which ends this
sign-in and sends the browser on to Cloudflare Access's `/cdn-cgi/access/logout`, ending the
door's session too; on this computer to the local door's `/local/sign-out`.

## The frame

Every page sits in one frame, drawn on the server:

A module switched off on the Modules page (the `partsOff` set `@oltrem/core-http` puts on each
request) is gone for that request: no sidebar entry or tab, no Home card or Needs you, nothing in
the search; its pages, a module's own by their pattern and a kit section by its address, answer
the portal's Not found page. Switched back on, all of it is there on the next request.

- **Saved views** (since 2026-11-03), above a list page that keeps them (`views` on a module's
  page; a records list, a form's inbox and the audit log): the person's views as a sideways row of
  chips, All first and the one on screen marked, then a field to name the filters on screen and
  Save view, or Remove on a saved one. Both post to `/ui/views` and `/ui/views/remove`, which
  call `@oltrem/users`'s `/api/users/me/views` and return to the list; a refusal (twelve views on
  the page already) is shown with the way back. One D1 read per such page; nothing when users is
  off.
- **Notifications** (since 2026-11-03): a bell under the search box in the sidebar, and Alerts in the
  phone's bottom bar, with the unread figure (to "99+"), read with `/api/iam/me` on every
  page (one indexed read more; none without the users module). It opens `/notifications`: All or
  Unread as chips, Mark all read, each notification a row (unread ones bold) that opens through
  `/notifications/:id`, which marks it read and goes to its page (a path inside the portal, else
  the list); thirty a page with Older; under them "How you are told", a grid of two switches per
  module, In the portal and By email (both on is `both`, neither is `off`), saved as one flips
  (a Save button only without the page script); only what changed is sent. With the sidebar closed to icons the figure is hidden.
- **Bulk actions** (since 2026-11-03), on a list whose module declares `bulk` (the tasks): a
  tick on each row and card, one in the header for the whole page, and the bar (`BulkBar`) above
  the list with the module's actions. The frame script counts the ticks ("3 tasks chosen"), keeps
  a row's two ticks alike and holds the buttons until one is ticked; a destructive action asks in
  a dialog. A press posts to `/ui/bulk`, which calls `POST /api/<module>/bulk/<action>` once and
  returns to the list with `?bulk=<module>.<action>.<done>.<refused>`; the list shows how many
  were done and how many refused, in the kit's own words, never words from the address.
- **The sidebar**, from 1024 px wide, down the left edge in the page's own colour with one line
  beside it. From the top: an arrow that closes it, the portal's mark, a search box (a plain form
  to `/search`, `Ctrl K` or `⌘K` from anywhere), Home, then every mounted section under its group,
  and at the foot who is signed in. Rows are 36 px (44 px on a touch screen).
- **Groups**, in this order: Work, Company, Users & access, Messages, System (since 2026-10-29, the owner's ask:
  few entries, sub-pages as tabs). A module's page joins its group wherever the module
  is listed; a group the kit does not know sits before System (`groupRank` in `src/layout.tsx`).
  Each group has a colour (`hueOf`): its dot, its icons, and the tint and edge marker of the
  section on screen, which is also bold, so it never rests on colour alone. Home's cards use the
  same colours.
- **Tabs.** Sections that name the same `tabs` (`PageNav.tabs`) fold into one sidebar entry under
  that name, at the first one's place, leading to the first tab and marked on any of them (`tabSet`
  and `sideEntries` in `src/layout.tsx`). The section labelled as the set is the first tab, the rest
  follow in the sidebar's order. Since 2026-11-01 the tabs sit under the page's head, as a
  console's do (`PageHead`): on a set's own pages the heading is the set's name (Email) and the
  marked tab names the page, so no word shows twice (a screen reader hears "Email: Sent"); a page
  inside a tab (a message, `Connect an integration`) keeps the set's row and tabs and puts its own
  title under them; a page inside a section with no tabs (a list of Records, Create form) shows a
  breadcrumb back to the section above its title. The tabs are links on an underline, the marked
  one in the group's colour and never bold (no label moves), a count beside a tab when the page
  gives one (`counts` in a page's answer, by the tab's path). On a phone the row scrolls sideways
  into the gutters, which fade, and the frame script scrolls the marked tab into view; the arrow
  keys, Home and End move between tabs. From 1024 px the row stays at the top while a long page
  scrolls, on glass once stuck, where the browser can tell (`scroll-state` queries; elsewhere it
  scrolls with the page). The head and the tabs keep still in a page change; only the content
  below them fades. Users & access draws the same tabs in its pages (`PeopleNav`, `ownRow`).
- **Width.** A page is a console or a form (`kind` in a page's answer; `console` by default). A
  console uses the screen up to 96 rem, its gutters 16 px on a phone and 32, 40 and 48 px from 1024,
  1280 and 1536 px; a form (Settings, Connect an integration) keeps its content to 56 rem under a
  head and tabs as wide as a console's, so they never move between the two. The sign-in pages
  stay a 40 rem column.
- **No sideways shift.** The document keeps the scrollbar's room on every page
  (`scrollbar-gutter: stable`), so a short page and a long one start at the same place; before
  2026-11-01 a classic scrollbar (Windows) came and went between pages and moved the centred page
  by half its width. A page with no entry of its own sits under the module's entry its
  path starts with (`/email/sent/7` under Sent). With every kit module on, the sidebar holds 19
  entries besides Home:

  | Group | Entries (tabs) |
  |---|---|
  | Work | Records, Forms, Bookings, Tasks, Files, Approvals, Announcements, Analytics, Automations |
  | Company | Team (Shifts, Time clock, Time off, Expenses, Equipment), Sales (Quotes, Invoices) |
  | Users & access | Users (its pages share one row of chips: Users, Roles, Groups, Locations, Access requests, Access reviews, Vendor access), Customers (Customers, Privacy) ||
  | Messages | Email (Write, Drafts, Sent, Delivery log, Templates), Email settings (Email settings, Addresses, Integrations; with Mail, also Mail setup and Forwarding), Campaigns (Campaigns, Lists) ||
  | System | System status (System status, Backups, Deployments, Alerts), Settings (Settings, Modules, Audit log), Developer ||
- **Closed to icons.** The arrow closes the sidebar to a 64 px rail and opens it again. Only the
  words fade: no icon moves. A section's name shows beside the rail while the pointer or the
  keyboard is on it. The choice posts `side` (`closed` or `open`) and `back` to `POST /ui/side`,
  which keeps it in the `oltrem_side` cookie, so the next page is drawn the same with no jump.
- **Your account**, at the foot: pressed, a small menu opens above it (to the right of the closed
  rail) with your address, My access, Look and colours (`/look`), the colour theme as three
  icons and, on this computer, Sign out. The theme posts `theme` (light, dark or system) and `back` to `POST /ui/theme`, which keeps
  the choice in the `oltrem_theme` cookie (cleared for system); the frame then sets `data-theme`
  on the page. Both switches return to `back` when it is a path on the portal, Home otherwise, and
  refuse a form posted from another site.
- **On a phone** (Look 3, 2026-11-08), a bar along the bottom within reach of the thumb: Home,
  Email (when the portal has it), Search, Alerts with the unread figure, and Menu, which opens the
  same parts as a drawer from the left (a `dialog` opened by the browser's `commandfor`; a tap
  outside closes it). The page's own head names where you are, so a head marked `data-bar` keeps
  its heading and actions and drops only its icon and line. The document names the phone
  browser's bar colour (light, dark, or both for the device's own).
- **Colours in the account menu** (2026-11-08): six coloured dots (`DOTS`) above the theme icons
  post `palette` and `back` to `POST /ui/look`, which keeps the pattern the cookie already holds.
  With the script, the new colours and a change of theme spread from the button pressed as a
  circle (a view transition, 450 ms); without it, or under reduced motion, the page just changes.

**No reloads.** The frame's script (`src/client/frame.js`, served at `/ui/app.js` under its
version) opens a link to one of the portal's pages, a search, a filter or a form's change in
place: it fetches the next page and swaps only the page's content (`main.ui-page`), so the
sidebar stays on screen where it was scrolled and the section on screen is marked as the new page
marks it. The address, the title, Back and Forward (with the page's scroll) behave as on a load.
A page change fades the content in where the browser has view transitions and motion is on (Look 3,
2026-11-08, the owner's timings: it rises 6 px out of a 4 px blur over 320 ms, then its parts
rise one after another, 60 ms apart; a page that comes back to itself or follows something live
stays still); a
change that comes back to the same page keeps its scroll and brings its outcome (a `Done` notice
or an error) into view. Focus moves to the new page's heading, or to a form's errors. The page
under the pointer is fetched a moment ahead, so the click opens it at once. The arrow and the
theme switch act at once and save behind the scenes. A button with `data-copy` copies that value
to the clipboard and says "Copied", aloud too, for two seconds. A button with `data-fill` (a
field's id) and `data-value` puts that example in the field and moves there (2026-11-10: the
example sender address on Email settings). A thin line at the top shows a page that is
still loading, and after 150 ms the page dims (`data-loading`), so a press is seen. The marked
tab, segment and section carry a mark (`.ui-mark`) the script adds and names alike on both pages
of a change, so it glides; a filter on the same page moves the mark alone (`data-vt="mark"`). A
page that arrives counts its plain figures up and fills its meters, keeping the real figure for a
screen reader (2026-11-11, the owner's V22 and V30 clips). A link to a section of the page on screen (`#invite`) is the browser's own: it
scrolls there, and the popstate it fires is not taken for Back (until 2026-10-31 it fetched the
page again and put it back at the top, which looked like a reload). Lists of boxes to tick: a
group's ticks are counted (`data-check-group` with `data-count`, the form's in
`data-count-all`), `data-check-all` ticks or clears one group, and an input with `data-filter`
hides the `data-filter-item` rows (and emptied `data-filter-group`s) of the element it names;
those controls start `hidden` with `data-enhance` and appear with the script. A switch whose
`data-needed-by` names the values of other switches of its name (the Modules page) shows the
element its `aria-describedby` names while it is off and one of them is on.

**Live blocks.** A block marked `data-live="name"` with `data-refresh="seconds"` (at least five)
is kept up to date: the script fetches the page again, or the lighter page `data-refresh-from`
names, and swaps that block alone, so what the person is reading or typing elsewhere stays. It
does not fetch while the tab is hidden, a dialog is open, a page is on its way or the person is in
a form. A block whose new copy has no `data-refresh` stops refreshing; a fetch that fails dims the
block (`data-stale`) until one works. A campaign's progress is the first such block.

**Compose boxes** (the email Write page, 2026-11-01). An input with `data-chips` turns each
address typed into a chip (its class is the attribute's value; a chip that is not an address gets
`data-bad`), while a hidden input of the same name posts them comma-separated as before. A line
marked `data-fold` with an empty input folds behind the button whose `data-unfold` names it. A
button with `data-mark` (`strong`, `em`, `list`, `link`) puts that mark around the selection in
the box its `aria-controls` names; a block with `data-marks-of` draws that box's words with
their marks as they are typed (a list takes `data-list-class`). Ctrl or Cmd with Enter in a form
with `data-send-key` presses its `data-send` button, and a select or a file input with
`data-submit-with` presses the button it names when it changes, that button hidden (a file input:
since 2026-11-08, Write's Attach a file). A file input with `data-upload` (2026-11-08) sends each
file chosen straight to that address as the body, with its `name` and the values of the form's
fields named in `data-upload-with` added to the address, then opens `data-upload-done`; a
refusal's words show on the input itself. A large file so never passes through a page's form
(Mail's files over 10 MB, up to 95 MB). Without the script each is a plain box, line, select and
button, and the form posts the file.

**The composer** (Oltrem Mail's Write page, 2026-11-08). A block with `data-rich` naming a
textarea shows (it starts `hidden`) and the textarea hides. Its `[contenteditable]` takes the
textarea's words with their marks made HTML, or its HTML when the block has `data-rich-html`.
Buttons, selects and colour inputs with `data-rich-cmd` run the browser's editing command of that
name (`quote` toggles a blockquote; `link` opens the block's `data-rich-link` line, whose
`data-rich-link-add` and `data-rich-link-close` buttons add the link or close it; Ctrl or Cmd K
opens it too). A paste keeps only the composer's tags and looks. The textarea holds the
composer's HTML and the form gains a hidden `editor=rich`. Nodes marked `data-rich-hide` hide and
those marked `data-rich-show` show; a `format` radio set to `html` hands the textarea back as code,
and another choice takes it into the composer again. The server cleans the HTML again; without the
script the textarea works as before.

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

`/ui/app.css` is the one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s theme and
the classes the pages, the primitives and every module's `src/*.tsx` use, under the 80 KiB a
test allows (64 until the colour pass of 2026-11-04, by the owner's yes). A colour with an opacity (`bg-primary/10`) is written once, as its `color-mix()`:
Tailwind's second copy for browsers without it, about a tenth of the file, is left out
(2026-11-03), as the theme's own rules use the mix bare. `/ui/app.js` is the frame's
script, copied from `src/client/frame.js` with its comment lines and indents left out, about
28 KiB (39 KiB as written). The build refuses a string or template that spans lines, the one case
where that is not safe, and checks that the result compiles.

**Served by the Worker, never as static assets.** Both files are strings in
`src/generated/assets.ts`, served by `publicRoutes` before the door, cached for good under the
version every page links (`src/generated/versions.ts`) and `no-cache` without it. From 2026-11-03
to 2026-11-04 they were Cloudflare static assets: a Worker with static assets runs behind
Cloudflare's asset router, which does not hand it the Access sign-in (`ctx.access`), so every page
of a live portal refused everyone with KIT-E-0401 ([the record](../../docs/records/2026-11-04-sign-in-and-static-files.md)).
`oltrem deploy` and `oltrem upgrade` take that `assets` line out, and the deploy refuses any other.
After changing a class in a page or a primitive, or the script, run `pnpm ui:build`; a test fails
while a committed file differs from what the build writes. The two files are generated: never
edit them by hand (R-06).

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

`test/css.test.ts` holds the committed stylesheet to its build; `test/module-pages.test.ts` mounts a module's pages on Node: the sidebar entry in its group, the page in the frame, a form back by its redirect and another site's refused; `test/people-access.test.ts` holds the invitation to the roles the person may give and the Users & access row to the pages each person may use. The client template's
`test/screens.test.ts` runs the whole first run inside the Workers runtime: the Vendor signs in on
this computer, creates the company, the Owner accepts, every page answers with its words and
Home shows every module's card; a
stranger is told there is no account; behind Access the local door does not exist. Before that,
the Vendor finds every Users & access page asking for the company first, with no action that
would fail. A second test
creates a role and a location, invites someone who accepts, ends and gives their role, is refused the
same role at the same location again (and is not offered it), changes the role to another and back in
one step, deactivates and
reactivates the user, allows one thing and denies another as permission overrides, picked by module and then
permission (the person is then refused
the denied page and shown the allowed one, and Home shows them only the cards they may read), ends the deny and then the other,
withdraws an invitation, and sees a refusal and a cross-site form refused; later the Owner invites
two people at once with their links emailed, their own address refused, and a member asks for a
role, the Owner approves it (the member is refused deciding it themselves), then opens an access
review at the company, keeps every grant and closes it; then the Owner makes a group, adds the
member ticked from the people with an account (an unknown typed address refused), gives the group a
role used only when switched on, which the
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
