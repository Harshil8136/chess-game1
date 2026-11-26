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
  publicRoutes: screens.publicRoutes, // /ui/app.css, /ui/app.js, the font and the icon, before the door
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

`createScreens({ brand, files })` (2026-11-11) give the portal its own name and icon:
`brand()` returns the `settings.portal_name`, `settings.portal_mark` and (2026-11-23) `settings.portal_tagline` (`line`) values (the template's
reads them from the settings snapshot), and `files(env)` the portal's one bucket, where a picture
icon is kept under `ui/mark/`. Without `brand` the name is `portal` and the tile its initials;
without `files` a picture cannot be the icon. The name and icon show in the sidebar, on a phone's
top bar, on the sign-in and customer pages, and as the tab's icon: the picture itself, or the
initials or icon drawn on the look's colours as a small SVG written into the page (`faviconOf`,
`src/marks.tsx`), so no page asks for `/favicon.ico`.

## The pages

| Path | Shows | Reads |
|---|---|---|
| `/` | a Vendor with no company yet: the company form, its first Owner the one setup named as Owner (`GET /api/iam/setup-people`), the client file's address only when setup named none (2026-11-08: the placeholder was invited instead of the named Owner); anyone else (redesigned 2026-11-14): a band with a greeting for the time of day and the date (the frame script writes both in the person's clock), a line on what waits and how many parts need a look, and dials with rings to Needs you, Get started (while a step is open) and At a glance (`HomeWelcome`), after the first run's question while Set up for your business is an open step (2026-11-22, `FirstRun` in `start.tsx`, to whoever may do it): "What kind of business do you run?", the kinds of business as chips, each opening `/start?kind=` with its modules ticked, and nothing saved until that page's button; every line of Needs you, Get started and that question opens the exact page and tab (Switch on backups at System's Settings, the alert recipients at `#settings-alerts` there, Invite a second person at `/people/invite`), which the client template's test opens one by one; then Jump back in (2026-11-13), a row of chips to the pages opened last that the frame script fills from the browser (`HomeRecent`, hidden while empty); then, side by side from a page 60rem wide, Needs you (what waits for them from each module that answers it, each a row to the page that acts on it, or a line saying nothing waits) over Get started, with a bar of the steps done, while a step of setting the portal up is open (each step ticked by what is stored, an open one a row to its page, or with a button when one press does it, `POST /do/get-started`; with email on, the email step leads to the one-step setup, `/email/connect`, and comes first, so the invitations of the step after it can be emailed (2026-11-15); the Features page can switch the card off, and its Hide does the same for the Vendor and Owners), What changed (2026-11-21, an extra that starts off, `audit.since`): for whoever may read the audit log, what others changed since they last pressed Mark as seen (a day back before the first press, a week back at most), the kinds of change the most made first, each a row to the audit log of its module, with "N other changes" for the rest, or "Nobody else changed anything."; Mark as seen (`POST /do/seen`) moves the mark, and showing the card never does, and At a glance: the Home figure of each mounted module that has one and that they may read, one row each with lined-up columns (tile, name and line, figure, state), failing and needing a look first, work switched off last as a quiet Off that the band does not count | `/api/iam/me` (and `/api/iam/setup-people` for the company form), then each `/api/<module>/onboarding`, `/api/<module>/todo` and `/api/<module>/home`, together, with `/api/users/me/seen` then `/api/audit/since?at=` while What changed is on |
| every module page, `/records`, `/forms` | before the company exists (2026-11-15): the company form, as on `/` (the Vendor's) or "This portal has no company yet" (anyone else), never the page's own refusal; the portal's own pages (Status, Settings, Look, Notifications, the delivery log, Email services) still open as themselves | `/api/iam/me`, `GET /api/iam/setup-people` |
| `/search?as=json&q=` | no page since 2026-11-25 (the owner: "completely wipe" the search page; an old link to `/search` goes Home): the JSON the palette shows under its pages as someone types (after a 250 ms pause), for two letters or more: the sections by name, line and `keywords`, the settings by title and line (to the Settings page searched for it), the roles and the locations by name, then each module that searches, as the person (a module that refuses them is left out). The palette also lists each `NAV` entry's `actions` (what the page starts: New role, Invite a user) under Actions, five before a word is typed, and any page opens one of its dialogs from `?open=<id>`, once, the word then dropped from the address (2026-11-25) | each `/api/<module>/search` |
| `/look` | Look and colours (2026-11-03): the 24 palettes of `looks.ts` (a primary, an accent and greys leaning to its hue, both themes) as tiles showing their gradient, and the backgrounds (Soft wash, Plain, Aurora, Sunrise, Dots, Grid, Lines) as tiles showing a piece of each (`preview`); a press saves at once (`data-autosave`), Save only for a page without its script, Back to the portal's own. An Owner or the Vendor also has Make it everyone's look: `POST /do/look/everyone` saves the look on the form as the `settings.look` setting through `PUT /api/settings/values/settings.look` and clears their own cookie (a refusal shows as a toast). `POST /do/look` keeps `<palette>.<pattern>` in the `oltrem_look` cookie (an id not in the lists is the kit's own; reset clears it); every page then carries the look's CSS in `<style id="ui-look">` in its head, about a kilobyte, none for the kit's own look; the frame's script swaps it with the page. `createScreens({ look })` is the portal's look until a person picks one: a string, or a function read on each page (the template's returns `settings.look`, else the client file's `brand.look`) | `/api/iam/me`; `PUT /api/settings/values/settings.look` |
| `/notifications?show=&before=` | the person's notifications, All or Unread, Mark all read, thirty a page, and how each module tells them; `/notifications/:id` marks one read and opens its page; Keep portal emails in your main inbox (2026-11-22): `/notifications/gmail-filter.xml`, `/notifications/portal-contact.vcf`, `POST /notifications/primary-test` | `/api/users/me/notifications`, `/api/users/me/notifications/choices`, `GET /api/email/primary`, `POST /api/email/primary/test` |
| `/settings/section/:id?show=changed&q=` | a section's own Settings tab (2026-11-22, `section-settings.tsx`), last in the row of every section whose parts define a setting the Settings page does not keep (Users and access, Sales, Files, Email, System and so on, the id the section's name in lower case with dashes): its parts' options (their extras as switches) at the top, then its settings in a card per part (since 2026-11-24, like the Options card above them: headed with the part's name, or Settings when there is one part), in the same rows, Save bar, Changed, search and one value for all as the Settings page, without the figures and the jump list when it holds fewer than eight; then **Set up**, the pages opened under it (`under`): Email's Setup, Addresses, Mail setup and Forwarding, Users and access's Access reviews and Vendor access. Every form on it sends `to`, so its answer comes back to the tab. The tab shows to an Owner and the Vendor, and to anyone who may open a page set up under it; the API still decides each row | `/api/settings/values`, `/api/settings/parts` |
| `/settings/parts?show=&q=&preset=` | whoever holds `settings.parts` (every Owner and the Vendor at first, anyone a role gives it to; the tab shows to them alone, asked of the API when the Settings tabs are on screen, and anyone else at the address reads "You need the permission to switch modules"): the Features page, a dashboard. All, On (n) and Off (n) chips and a search box (at once with the frame script, by `?q=` without it); the presets as "Start from" chips (Everything, Email only, Nothing optional, and the set saved now) that fill the boxes without saving; a one-line note; then a section per sidebar group (Work, Company, Users and access, Messages, System), each one even list (2026-11-13) whose rows line up their columns on a wide screen: the sidebar's icon, the name, one line, what it needs and what needs it, and a checkbox (Always on for the core), the icon grey while unticked, and, while it is unticked, a line that the modules needing it go off with it (kept in step by the frame script before Save; since 2026-11-15 Save switches them off in the same save and the page names them at the top, `?also=`, where before it was refused until they were unticked by hand); under a module's line, its optional extras (the daily audit seal, the emails about access ending, the review and restore-drill reminders), each a row with its own box under the module, a core module's too, kept as they are saved when a preset fills the module boxes; one Save bar at the bottom sends the whole set | `/api/settings/parts`, `PUT /api/settings/parts` |
| `/start?kind=&done=` | Set up for your business (2026-11-22), a tab of the Settings set beside Features and the first step of Get started, to whoever holds `settings.parts` (anyone else reads that they need the permission): the kinds of business as chips in a sideways row (Services by appointment, Shop, Office, Field team, Something else); the kind picked, with "Which of these do you use?" (2026-11-22): every module that can be switched off as a ticked chip in a sideways row, the ones the kind uses ticked (what is on now for Something else), a ticked one keeping on what it needs, the unticked ones switched off with their data kept; then what one press also does in words (the roles Admin and Member, Admin ranked above, or that the roles are left to whoever manages them when the person cannot see them, the starter list with its columns, each "there already" when it is) and "Set up the portal for this" ("Run it again" for the kind saved, "Save what I use" for Something else); then the next steps: Invite your team, Add your locations, Bring in your customers, Fill in your lists. The press saves the modules and the kind in one save, then makes what is missing (a role by name, the list, Records included when this press switched it on): pressing again makes nothing twice and deletes nothing, a step that fails is named while the others stay done, and one press stays under 30 database queries (locations, about ten each, are added on the Locations page) | `GET /api/settings/parts`, `PUT /api/settings/parts`, `/api/iam/roles`, `/api/iam/capabilities`, `/api/records/lists` |
| `/setup/company` | the invitation link for the first Owner, with Copy, after the form is sent; a refusal keeps the name and address typed and says why and what to do (`companyRefusal`: giving the Vendor's own address says the first Owner is the client, 2026-11-15) | `POST /api/iam/tenant` |
| `/accept?token=` | the invitation and its Accept button; accepting returns to `/?done=joined`, where Home says "You joined <the portal's name>." (2026-11-15). A refusal shows the problem's title, its detail and its next step; an invitation that cannot be used (410) or one for another address offers no Accept, and every invitation page, like the no-account page, has a way to sign in with another address: the local door's sign-out on this computer, Cloudflare Access's `/cdn-cgi/access/logout` behind Access (`SignOutToSwitch`) | `POST /api/iam/invitations/accept` |
| `/records` | the lists the person may see, with their records and location; Create list when a role allows it somewhere | `/api/records/lists` |
| `/records/new` | a new list: its name, its location picked from a row, and a starting shape (blank, contacts, tasks, stock, orders, equipment) | `/api/records/lists` |
| `/records/:id?q=&field=&value=&sort=&dir=&page=` | a list's records: searched, narrowed by a row of chips per choice or yes or no field, sorted from a row, paged; the add form and Add from a spreadsheet when the person may add | `/api/records/lists/:id`, `items` |
| `/records/:id/items/:item` | one record with who added and changed it; the form to change it and Remove, as the person may | `/api/records/lists/:id`, `items/:item` |
| `/records/:id/fields` | the designer: the fields in order with up, down and Remove; Add a field; the name and location; Remove the list once empty | `/api/records/lists/:id`, `/api/records/lists` |
| `/forms` | the forms the person may see, with their new answers and whether each takes answers; Make a form when a role allows it somewhere | `/api/forms/forms` |
| `/forms/new` | a new form: its name, its location picked from a row, and a starting shape (contact us, quote request, feedback, sign-up, blank) | `/api/forms/forms` |
| `/forms/:id?view=&mine=&q=&page=` | the inbox: a row of statuses with their counts (to do, new, open, done, all, and Unread since 2026-11-21); an answer nobody has opened yet in bold, read aloud as unread, a row for the answers the person took, a search box, paged; Try the form, the designer, the download | `/api/forms/forms/:id`, `entries` |
| `/forms/:id/entries/:entry` | one answer as it was sent; Take it or Let it go, Mark new, open or done; its notes and email replies, and the form that adds one; Remove, as the person may; shown, the page marks the answer read for the team through the frame's `data-seen`, and Mark unread puts it back (2026-11-21) | `/api/forms/forms/:id`, `entries/:entry`, `entries/:entry/read` |
| `/forms/:id/design` | the designer: the code for a website, a new address, the fields with up, down and Remove, Add a field, the settings (name, line, taking answers, the page after sending, who is told, location), Remove | `/api/forms/forms/:id`, `/api/forms/forms` |
| `/forms/:id/try` | the form as a website shows it, posting to its public address | `/api/forms/forms/:id`, `/hooks/forms/:key` |
| `/people?show=&role=&q=` | the Users page (remade 2026-11-11; tidied 2026-11-14, the owner: "Even pixel level boxes, section, filter size is important"): a small Invite button beside the heading (Button size `chip`), the page's one main action, its own page; a search box over name, email and role (at once with the frame script, by `?q=` on the API without it); Everyone, Active, Deactivated and Invited chips, each with its count, Blocked only while someone is blocked, and a chip per role with how many hold it; since 2026-11-25 **Signed in today** (a browser sign-in within 24 hours; it opens `/people/signed-in` for whoever may, else narrows the list) and **Not used lately** (an active account with no sign-in for 45 days, `UNUSED_DAYS`, or none since it was made that long ago, with a line on why to deactivate it), each shown only while it holds someone; an exact email address in the search (`?q=`) opens that user's page; whoever may give access sees "N access requests wait for you" with Review (to `/access/decisions`) while any wait, unexpired; then every user as a two-line row: their initials and name (the email under it when they have a display name), then the roles they hold directly as badges (with "until" when one ends) and "Last sign-in 3 h ago" or "Never signed in"; a pill only for Blocked ("Blocked until …") or Deactivated. Invited lists the pending invitations, each with its role, Send again (a new link for another week, emailed when the portal can, else shown once with Copy; `POST /people/invitations/:id/again`) and Revoke, asked first in a dialog and back to `?show=invited` (2026-11-15); the people named at setup and the pending invitations follow the list too | `/api/iam/me`, `/api/users/people?limit=200&q=`, `/api/iam/bindings?subjectKind=principal&inForce=true`, `roles`, `invitations?status=pending`, `setup-people`, `/api/users/signed-in?probe=1`, `requests?status=pending` and `approvals?status=pending` for whoever may give |
| `/people/invite` | Invite by email: first "Same access as" (2026-11-22), each active user whose role the person may give as a chip in a sideways row (`sameAccess`); one picked (`?like=`), their highest such role and its location are chosen when the form opens, and a line names any other role they hold, to give on the new user's page once they accept (an invitation carries one role; a role only when switched on, or one that ends, is not copied); then addresses one per line or by commas (up to fifty); the roles the person may give as cards (below their own standing; the Owner role only for the Vendor and Owners), each with what it lets a person do in words ("Views 25 modules, edits 19.") and how many hold it ("No users yet", "1 user"); the location folded to "Location: Whole company (change)"; Access ends, No end date (chosen) or 8 hours, 1 day, 1 week, 30 or 90 days; whether to email each person their invitation link; Send invitations; then the pending invitations | `/api/iam/me`, `roles`, `scopes`, `capabilities`, `bindings`, `invitations?status=pending`, `/api/users/people` |
| `/people/:id` | one user (2026-11-14, the owner: no big user-info box on top): their name is the page's heading and their email the line under it; then one wrapping line of facts (Blocked or Deactivated when so, their roles, last sign-in, member since; since 2026-11-26 pills with icons) and the row of their pages (since 2026-11-26 one track with icons, `PersonHead`): Overview, Permissions, Sessions, Activity (Overrides merged into Permissions, 2026-11-22). Since 2026-11-23 (the owner: "each and every part of this is terrible and un-usable") the overview reads in the order access is made, as numbered cards whose tools sit at their top right (`Card`, the locked anatomy), with Account in a rail beside them from 1024 px: **1 Roles**, rows "Role, at Location, no end date" or with its end, each with a quiet Change role (a dialog: another role, location or end; the old grant ends and the new one is given in one step) and Remove role (a dialog first), and Add role at the top right opening a dialog (filled when they have none), without the roles they already hold at the whole company, with Copy access beside it (`/people/:id/copy`); since 2026-11-25 the role cards in Add role and Change role say what each pick does to what they can do, against every role they hold: "Gains N: …" in green, "Loses N: …" in red, "Their role now" on the one a change replaces, nothing for the Owner role (`compareOf`, `roleDiff` in `forms.tsx`); **2 Their own Allow and Deny** with Change (to Permissions); **3 What they can do**, one even list of the areas they hold anything in, most first (Manage, Edit, View, Limited), each its level as a dot and a word and "X of Y", opening that area on the Permissions page, the areas with nothing as one closing line "No access to ..."; **Account**: the display name, and Deactivate (a dialog, the reason optional) or Reactivate. The facts line starts with their avatar. The chips of pages under Users (Signed in today, Access requests) show only on the Users list and those pages, no longer on a user's | `/api/users/people/:id`, `/api/iam/bindings?subjectId=&inForce=true`, `roles`, `scopes`, `overrides`, `capabilities`, `people/:id/access` |
| `/people/:id/copy` | Copy access from another user (2026-11-25; until then only an invitation could copy): each active user holding a role the viewer may give that this user lacks, by name, with exactly what a press adds ("Adds Desk at North, until <date>, only when switched on") and Copy; nothing is taken away, the Owner role is never copied (it is given on its own, after its question), and a user with nothing to add is left off (`copyFrom` in `people.tsx`). Never on your own page | `/api/iam/roles`, `scopes`, `bindings?subjectKind=principal&inForce=true`, `/api/users/people?kind=person` |
| `/people/:id/sessions` | Sessions (2026-11-14, the owner: see past and active sessions, change or end one, block for a while or for good): Sign-in, the account's state with Block sign-in (a dialog: 1 hour, 1 day, 7 days, 30 days or Permanently, and an optional reason; never for an Owner or yourself) or Unblock / Reactivate; Active sessions, each browser by its own description ("Safari on iPhone"), when it signed in and when it ends if set, with Set end time (a dialog: in 1 hour to 30 days, or Never) and End session (a dialog first), and Sign out everywhere; Past sessions, the ended ones and earlier sign-ins from the audit log on browsers no longer active, one row per browser, newest first. Never your own here | `/api/users/people/:id/sessions`, `/api/audit/entries?action=iam.sign-in&target=`, `/api/iam/roles`; `PATCH /api/users/people/:id/sessions/:device` (end time), `POST …/block`, `…/unblock` |
| `/people/:id/activity?about=&before=` | Activity: What they did (the audit rows they are the actor of) or Changes to their account (the rows whose target is their account), picked from a row, as a timeline in plain words ("A role was added", "Signed in", "Sign-in was blocked"), who did it when it was not them, the browser, a refusal with "Reason:"; Older pages back | `/api/audit/entries?actor=` or `?target=` |
| `/people/:id/exceptions` | moved (2026-11-22, the access review): a 301 to `/people/:id/see`, where the Overrides page was merged in | — |
| `/people/:id/see?place=`, `?view=json` | two views (2026-11-22), Permissions and Policy JSON, switched at the right end of the row of their pages (2026-11-23). Permissions (since 2026-11-22 also the old Overrides page): every permission at one location (a row of locations when there is more than one), "They have N of M permissions" (since 2026-11-24 one line: "N of M permissions at <location> and inside it", then for an Owner what an Owner has and who can deny one, or "Viewing this does not sign you in as them"; the Owner notice box is gone), then (since 2026-11-26, the owner: a row per module "wastes so much space") the count as a ring beside the search and the modules as tiles side by side (`#m-<module>`, where the Overview's areas lead), each with a bar of how much they hold in its colour and its level as a coloured pill, an open one taking the whole row with its permissions as compact rows, two side by side on a wide page, each marked yes (green tick) or no, red when their own Deny; each tile with its level (None, View, Edit, Manage or Custom) and "N of M", that opens to its permissions, each with yes or no, where it comes from (the role and location, a group's role, or their own Allow or Deny, a deny first) and its `area.thing.verb` name in code type with Copy. Whoever may change their access gets Inherit, Allow and Deny on each row that may be changed (the Owner's own only on an Owner, by the Vendor or another Owner; the Vendor's own only for the Vendor), a search box (alone above the list since 2026-11-24), Access ends (under the list) and one Save; since 2026-11-24 a row offers only the picks the portal would save (`choices` in `person-perms.tsx`: the Vendor's own Inherit or Allow, by the Vendor; the Owner's own Inherit or Deny, on an Owner; an Owner's Users and access permissions Inherit or Allow unless the Vendor changes them), and a saved pick always stays on show; an untick no longer makes a silent deny, and a new Deny is saved only with "Yes, deny what I picked" ticked, since it wins over every role. `?view=json` (editable since 2026-11-23, the owner: "verify before save like AWS"): **Their own policy**, their own Allow and Deny as one policy (one rule per effect, location and end date) in a box with Format, Copy and Download at the card's top right, a line saying at once whether it is valid JSON and where not, "Yes, save any new Deny in it", Check and Save, and How to write a rule (an example and the locations by name); read only, the same text in a block, for whoever may not change their access (as on Permissions). Beside it **From roles**, each role they hold with its location and end, linking to the role's Policy JSON, and Copy all (everything they get as one policy). `POST /people/:id/see/policy` (`intent=check\|save`, `policy`, `sure`) reads the text with `parsePersonPolicy` (Effect Allow or Deny; Action a name, an id, `*`, `area.*` or `*.verb`, a wildcard never taking the Owner's or the Vendor's own; Resource `loc:*` or a location's path; Condition only `Ends`, a date to come; the same permission allowed and denied at one place refused; a JSON error by line and column), works out what to make and what to end (`policyChanges`), and Check shows the problems or "Adds N Allow, adds N Deny, ends N of their own" with the names; Save makes the new rules first and then ends the old ones, at most 12 changes a save (`MAX_POLICY_CHANGES`, the free plan's queries: 13 measured for 2), a new Deny only once confirmed; the portal still checks every change; the page itself reads nothing more for it. A refusal keeps the picks and Access ends; a search opens the modules it finds; `?open=<module>` (the Overview's tiles) opens that module. A deactivated account says so. Viewing it does not sign you in as them | `/api/users/people/:id`, `/api/iam/scopes`, `/api/iam/people/:id/access`, `overrides`; for `?view=json` also `bindings`, `roles`, `capabilities` |
| `/people/signed-in?show=` | Signed in today (2026-11-21, a tab of Users for whoever may manage sessions, so the tab's probe is the page's own read; since 2026-11-25 also the Users list's Signed in today chip): a row of chips, Everyone today, New browser or country and Unusual (from two countries within an hour), each with its count; then each person who signed in within the last day, newest first, with each sign-in's browser, country, time and a New or Unusual mark, and Sign out for that person (a dialog first); Refused sign-ins, the addresses with no account here that tried; Sign everyone else out for an Owner or the Vendor (a dialog first) | `/api/users/signed-in`; `POST /api/users/people/:id/sign-out`, `POST /api/users/sign-out-everyone` |
| `/people/signed-in/history?outcome=&q=&before=` | Sign-in history (2026-11-25, the History chip of Signed in today, under the Users tab): a search by address, chips Today (back to Signed in today), All, Signed in and Refused, then every sign-in the audit log keeps, newest first, fifty a page, each row who (opening their sessions when let in), when, the browser and country and New, Unusual or Refused; Newest and Older below; Download CSV beside the heading (the last 90 days). The Users list's heading also carries Download CSV, for whoever manages people at the company | `/api/users/sign-ins`; downloads `/api/users/sign-ins/export?days=90`, `/api/users/export` |
| `/access` | Roles, the first access page: Create role (the page's one main action, for those who may make roles); each role in a line with the modules it reaches, how many permissions and how many hold it; "How permissions work" folded. Since 2026-11-13 the Users and access pages are tabs of one page, Users, under its head (the owner: "make a page and make all this sub-page ... selection sections"): Users, Roles, Groups, Locations, and Access requests and Access reviews for those who may give roles, Vendor access for Owners and the Vendor (from `may` in `/api/iam/me` through `NavEntry.may`, so a tab shows only to whoever may open it, and the API still checks each page); the sidebar holds one Users row under Users and access, and a page inside a tab (a role, a group, a review) keeps the row with its tab marked (`accessSection`). Before the company exists each of them shows "First, name the company" with the company form instead, and nothing that would fail | `/api/iam/me`, `roles`, `bindings?inForce=true` |
| `/access/groups` | the groups with their member counts, and Create group | `/api/iam/groups` |
| `/access/places` | the Locations page: the locations of the company as a tree (each with the locations it sits inside), and the form to add one (Add location); since 2026-11-15 each location below the company has Change, a dialog to rename it or remove it (`POST /access/places/:id/rename` and `/remove`; the API refuses a location with locations inside it or a role ever given there, and a name a sibling has) | `/api/iam/scopes`, `PATCH` and `DELETE /api/iam/scopes/:id` |
| `/access/roles/new?from=&name=`, `/access/roles/:id?view=` | three tabs at the top (2026-11-22, the owner's redesign): Permissions (the default, the editor below), Assigned to (`?view=holders`, an existing role only: who holds it, the Rank and Remove; since 2026-11-24 the page is titled with the role's name, and the tab is three cards, Assigned to (with Pick a user when none hold it) and, beside it, Rank and Remove; the page reads people, groups and grants only here) and Policy JSON (`?view=json`, open, no fold). The role editor: its name first; for a new role, Start from Nothing, a ready-made role (Viewer, Member, Admin: View, Edit or Manage in every module; renamed 2026-11-22) or Copy of any role but the Owner, as buttons of the same form so the name typed is kept (`from=template:see\|do\|manage`, `role:<id>`); then the permission matrix (2026-11-03): one row per module, by the module's name (`names.ts`), sorted, each with how many of its permissions the role holds and its level as four chips always in view, None / View / Edit / Manage (each holds the one before; a level the module has not shows a dash in its place since 2026-11-22, faded chips before; since 2026-11-22 a level holds what asks for a fresh sign-in or a second person's yes too, tagged beside it, and never the Owner's or the Vendor's own), no chip on and "Custom" when the ticks match none; the modules are one bordered list of rows since 2026-11-22 (cards in two columns before); the arrow at a row's end opens its permissions to pick one by one, in words, each with its `area.thing.verb` name and Copy beside its box. Above the rows, on a row of their own, with the page script, Find a module (it hides the rows it does not match) and Set all shown to None / View / Edit / Manage (each shown row takes that level, or its highest below it). Under them, on the Owner role only, Special permissions: the Owner's own, grouped by module, to tick on purpose; Vendor-only never. A Save bar at the bottom holds the sentence of what it holds ("Views 6 modules, edits 3, manages 1"). The page script ticks a level's boxes and moves the level as boxes change; without it the server works the level out (below). The Owner role is the Vendor's to change: anyone else reads it as a summary with no Save. An existing role's Assigned to tab shows who holds it and Remove the role (a dialog first) only while it was never given; a role given, now or before, stays for the record and the page says so instead of offering a Remove the API refuses (2026-11-15). Since 2026-11-22 a role but the Owner shows its Rank ("3 of 5, the Owner first") with Move up and Move down on Assigned to, and the Policy JSON tab shows: the role by its permissions' new names (the Owner role as `*`) with Copy, and a box to paste one and Import it in its place (a new role's page shows what it starts from and imports a new role, its Name needed) | `/api/iam/roles/:id`, `roles`, `capabilities`, `me`, `bindings?roleId=&inForce=true`, `groups`, `people` |
| `/access/mine` | My access, for everyone (also linked under the account in the sidebar): the roles they hold, each at its location, through them or a group, until when, and in force, ended, not started or only when switched on; the form to switch such a role on for 1 to 12 hours with a reason; the form to ask for a role at a place with a reason (every role but the Owner's); their requests and what became of each; Your sign-ins (2026-11-21, `#sign-ins`, where a sign-in alert's link lands): each browser signed in as them, this one marked, where else one was used in the attention colour ("Also used from Firefox on Android, from Mexico", 2026-11-25) and Sign out on each other browser (a dialog first, `POST /access/mine/sign-ins/:id/end`, `DELETE /api/iam/me/devices/:id`), then Report a sign-in (2026-11-24: signs them out everywhere and tells whoever looks after access, as a critical alert) and Sign out everywhere in one sideways row, each a dialog first and posted by the browser itself. The Vendor holds no role and asks for none, so it reads one line saying so, with a link to Vendor access (2026-11-15) | `/api/iam/me/options`, `me/grants`, `me/requests`, `me`, `me/devices`; `POST /api/iam/me/sign-out-everywhere`, `POST /api/iam/me/sign-ins/report` |
| `/access/decisions` | Access requests: the access requests still open (who, the role and location, why) and the approvals for a change that needs a second person, each with Approve and a quiet Refuse | `/api/iam/requests`, `approvals`, `people`, `roles`, `scopes` |
| `/access/reviews` | the access reviews, each open, past due or closed, and the form to start one at a location | `/api/iam/reviews`, `people`, `roles`, `scopes` |
| `/access/reviews/:id` | one review: its location and counts, every grant under review with Keep and Remove, and Close the review (a dialog first) once each is decided | `/api/iam/reviews/:id`, `groups`, `people`, `roles`, `scopes` |
| `/access/groups/new`, `/access/groups/:id` | a new group's name; one group: its members, each with a quiet Take out (a dialog first); Add members, ticked from the users with an account who are not in it yet (never yourself), or by an address typed under "Someone not listed?"; the roles it holds as rows with Change and Remove; Give the group a role with the same role and place fields as inviting; Rename or remove the group, folded (Remove only for a group that never held a role, 2026-11-15). Adding several members tries every one: a refusal stops none, and the page says "2 added, 1 not" with who and why (`membersRefusal`) | `/api/iam/groups/:id`, `bindings`, `roles`, `scopes`, `people?active=true&kind=person` |
| `/access/vendor` | how the Vendor may enter (at any time, in a window an Owner opens, only in an incident it declares), picked from a row by an Owner; the Vendor reads it with "Your client's Owner decides this" and no Save, which the API would refuse (2026-11-15); the open window with its reason and Close it now, or the form to open one for 1 to 12 hours; for a Vendor only, Vendor accounts: each address, On or Off, with Switch off or Switch on (not on your own), and Add a Vendor account | `/api/iam/tenant`, `/api/iam/me`, and `/api/iam/vendors` for a Vendor |
| `/providers` | Find from a domain and Connect in the page's tools; Ready to send as a pane; with the email module, Email in one step first (Set up email opens `/email/connect`: the address and the key, and the portal does the rest), the provider tiles below it the way by hand (with the email module: every check an email needs to leave, what to do under each that did not pass, Check again, which posts `/providers/ready`, and the list folded away once all pass), the connected providers as cards (initials, state, today's use on a meter where the provider tells it, the key and its last answer), the providers to connect as tiles (two across on a phone, more as the page widens, a heading per kind when there is more than one), and the domain look-up | `/api/providers/instances`, `definitions`, `/api/email/usage` |
| `/providers/add/:definition` | where to make the provider's key and what it needs, then its fields to paste | `/api/providers/definitions` |
| `/providers/:id` | one connected provider, titled with its name: its state, its key (sealed or missing, never shown) and its last check as figures, the last failure in full, what can be done to it, Ready to send for an email service, the provider's own steps folded; beside them on a wide page, the test message and its fields to paste again; a new key saved there (`POST /providers/:id/key`) is checked at once, so Last check and Ready to send show the new key's answer (2026-11-08) | `/api/providers/instances/:id`; after a new key, its `/probe` |
| `/email?state=` | Delivery log (named Activity before 2026-11-08): the day's figures (sent, on the way, problems, opened, from the last 14 days), then the latest messages as rows (whom, the subject or what kind, what became of it, a mark at the edge for a problem; since 2026-11-15 a message tried and not yet taken reads Trying again with its last error under it, "Last try: …", rather than On the way), or only those sent, waiting or failed, picked from a row with the counts; a 14-day chart of what went out by outcome, with its table for a screen reader (with nothing sent in 14 days, one line says so in its place, 2026-11-11); then, with the campaigns mounted, **Campaigns today** (messages left under the daily limit, the messages the database writes leave room for, a run's size on the client's Cloudflare plan, the campaigns sending now with how far each is), for a person who may read campaigns; **Provider allowance**, a block per provider that may send: what it says is left (today, this month or on the plan) and when it starts again, and what the portal sent through it today, this week and this month beside the provider's own count, with the provider's words when its key may not read the count | `/api/email/messages`, `stats`, `usage`, `/api/campaigns/room`, `/api/campaigns/campaigns?status=sending` |
| `/backup` | Backups (2026-11-14): Database and Files as ticked rows (Database not ticked and not tickable while the copy cannot run, 2026-11-15), Keep these for the nightly copy too, and Back up now, what a database copy waits for with each fix (a command the deploy runs, `npm run deploy` again, or Status for the key), the newest run as steps refreshed every five seconds while it runs, the figures, every run with what it copied and what its check found, then (2026-11-26) Your databases’ own backups: a card per connected Supabase or Neon database given its access token or API key, what its service keeps (Supabase's daily copies, the newest and whether point-in-time recovery is on; Neon's restore window), linked to the database's page; left out when the person may not see a database's insights or the Data part is off, and a failure said in it | `/api/backup/status`, `/api/backup/runs`, `/api/data/backups` |
| `/github` | the kit version, a newer release with how it arrives (the fleet, or `pnpm exec oltrem upgrade` and `npm run deploy` for a portal kept out), the deploys from GitHub, from a computer and by the fleet (Running now says Computer or Fleet when a deploy has no commit) | `/api/github/status`, `runs` |
| `/health` | the checks (2026-11-14): those that need a look as one list, each with what was seen, its name, where it is fixed and its Turn off, then the checks that pass folded into one line that opens them; Service status among the checks while switched on (2026-11-21: a major outage Cloudflare or an email service set to send reports on its own status page needs a look; its Turn off is the extra's); the free plan's budgets; how many measured ones are close to their line (one not measured yet is not counted); while the Cloudflare key is missing, refused or too narrow, three steps above the checks to fix it from a phone (the key form already filled in, the Worker's secrets, Check again now, which measures the budgets first). Check again now goes through Developer's job commands, so it shows only while Developer is switched on; a press after it was switched off comes back to the page (2026-11-15) | `/api/health/checks`, `budgets` |
| `/settings?show=changed&q=` | since 2026-11-22 (the owner's pick, "a design anyone can follow") only what is company-wide: Name and icon, Colours for everyone, the Settings module's own rows and Security (who may get in and how), then **Each section's settings**, a row for each section's own Settings tab this person may open with how many settings it holds; every other setting lives on its section's tab (`/settings/section/:id`, below). Before that: the settings in sections with plain names, in a fixed order (Company, Email, Money, Users and access, Security; System for the Vendor alone), each a chip in a sideways row and an anchor; All and Changed (n) chips and a search box (at once with the frame script, by `?q=` without it). Each row: its title, one line, its value in a control of its type (a box, a number with its unit, a switch with On or Off beside it as it stands, 2026-11-15: it said On either way, a choice as chips, a list one item per line); since Look 3 (2026-11-08) one Save bar rises at the foot once anything changed, with Discard, instead of a Save on every row (always showing without the page script); Changed with the default and Reset to default when it is not the default, and who changed it last and when. An Owner, or anyone but the Vendor, sees only the rows they may change, and one line counting the rest; the Vendor also sees each key, small and muted. Settings that share a name across modules (the currencies, the time zones) get one form above them that sets them all. Since 2026-11-11 (the owner's ask for icons, colour palettes and a better arrangement): the page opens with its figures (settings, changed, sections, after a deploy); each section has its icon and colour (the sidebar's group colours) and a line on what it holds, with its count and how many are changed; on a wide screen the sections are a list down the left that stays in view, on a phone a sideways row of the same chips with icons; a changed row is marked along its left edge, and its default and last change are small tags; whoever may change `settings.look` (an Owner, the Vendor) gets **Colours for everyone** first: the 24 palettes and the 7 backgrounds of `looks.ts` as tiles in two sideways rows, saved with the page's one form; and (2026-11-11) **Name and icon** for an Owner and the Vendor: the portal's name (up to 40 letters, empty for the client file's) and its tile as a sideways row: Initials, the 32 icons of `MARK_ICONS` (Lucide, each named for what it draws) and Picture, with Upload a picture. The frame script draws the picked file on a 128 px canvas and sends it as WebP (PNG where the browser cannot) in `brand:picture`; `POST /settings` takes it only as WebP, PNG or JPEG read from its own bytes, at most 48 KB (`pictureOf`), keeps it in the bucket under the first 16 hex digits of its SHA-256 and saves `picture:<file>`; `brand:name` and `brand:mark` save `settings.portal_name` and `settings.portal_mark` with the rest of the form | `/api/settings/values` |
| `/alerts` | the open alerts with what became of their email and who is on each, then the ones resolved lately | `/api/alerts/items` |
| `/audit?q=&range=&who=&module=&outcome=&actor=&target=&day=&ip=&asn=&key=&session=&signal=&before=` | the Audit log, remade 2026-11-24 (the owner: "difficult to read"), the way GitHub's and Google Workspace's logs read: a search over people, records, addresses and actions beside Export; chip rows for When (24 hours, 7, 30 or 90 days; 30 by default), Everyone, People, Automatic or API keys, the result and the section; one line with how many entries and how many refused, the tamper check and the time zone; the signals (2026-11-25): Refused, API key calls, Downloads and New places, each a count in the range and a tap to its rows; from 7 days up, a strip of one column a day coloured by result (2026-11-25), a tap listing that day alone (`day=`) while the strip keeps the range; then the rows under their days in the viewer's own clock (the frame script keeps the zone in a cookie), each one sentence ("Ana changed the role Front desk", `audit-words.ts`), with the section in its sidebar colour, the browser in a few words and the country under it, a refusal's reason in red, an unusual country or new browser on a sign-in in amber, and a red (refused) or amber (failed) edge down the row; the same thing done again right after folds into one row ("3 times"); a call made with an API key says so, with a key in its picture, and a file handed over is named under its row; a row opens to What changed (field, before muted, after in green; a value the log does not keep as "Not kept"), why it was refused (its own words, error code, the fields), who and how (the API key, the sign-in), where from (address, place, network and its number, browser, the agent as sent), how (request, answer, time taken, file and size, calls held back), its fingerprint, its other facts and the entry itself, with links to everything that person did, in that sign-in, with that API key, to that record, from that address and from that network; Older pages back; the daily seals and the export form | `/api/audit/entries` with `since` (or a day's `since` and `until`), `count=1`, `offset` and `countSince`, `seals` |

The forms, each posting to the screen's own route, which calls the API as the signed-in person:

| Form | Calls | Comes back with |
|---|---|---|
| Invite people (`/people/invite`): one address or up to fifty (one per line, or separated by commas or spaces, each once whatever its case, `inviteList`), a role, a location, when access ends (no end date unless picked; the Owner role never ends), and whether to email each link. More than fifty is refused before anything is asked ("51 addresses: up to 50 at a time", 2026-11-15). Or a spreadsheet file (2026-11-22, `.csv` or `.txt`, 128 KB at most): its email addresses join those typed in the box (`addressesIn`: quotes, brackets and `mailto:` taken off around a cell, never inside an address), shown to be checked with "N addresses found", and nobody is invited until the form is sent again; a file with none is refused ("The file holds no email address") | `POST /api/iam/invitations/many`, then `GET /api/email/ready` when one was queued | the Invite page with who was queued for email (never "emailed": it goes once the email service takes it, and with no service ready the page says so and links to Email settings), the links to pass on by hand (shown once, each with Copy), and who was refused with the reason, an address with an account linking to their page and one already invited to the Invited list |
| Create list (`/records/new`), save its name and location, remove it once empty (a dialog first) | `POST /api/records/lists`, `PATCH`, `DELETE /api/records/lists/:id` | the list with `?done=list-made`; `list-saved`, `list-removed` |
| Add a record, save one, remove one (a dialog first) | `POST /api/records/lists/:id/items`, `PATCH`, `DELETE .../items/:item` | `?done=record-added`, `record-saved`, `record-removed`; a refused value keeps what was typed |
| Add a field, move it up or down, remove it with its values (a dialog first) | `POST /api/records/lists/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=field-added`, `field-moved`, `field-removed` |
| Make a form, save its settings, give it a new address, remove it with its answers (a dialog first) | `POST /api/forms/forms`, `PATCH`, `POST .../key`, `DELETE /api/forms/forms/:id` | the designer with `?done=form-made`; `form-saved`, `form-new-address`, `form-removed` |
| Add, move and remove a form's field (a dialog first) | `POST /api/forms/forms/:id/fields`, `POST .../move`, `DELETE .../fields/:field` | `?done=form-field-added`, `form-field-moved`, `form-field-removed` |
| Take an answer or let it go, mark it, add a note or an email reply, remove it (a dialog first) | `PATCH /api/forms/forms/:id/entries/:entry`, `POST .../notes`, `DELETE` | `?done=answer-taken`, `answer-released`, `answer-marked`, `answer-noted`, `answer-replied`, `answer-removed`; a refused note keeps what was typed |
| Add from a spreadsheet (`/records/:id/import`): a CSV file whose first row names the fields | `POST /api/records/lists/:id/import` (the file as the body) | `?done=records-imported`; a refused file shows the list again with the rows named |
| Download for a spreadsheet; the browser asks the API itself | `GET /api/records/lists/:id/export` | the CSV file |
| Withdraw an invitation (asked first) | `DELETE /api/iam/invitations/:id` | `/people?show=invited&done=withdrawn` |
| Send an invitation again | `POST /api/iam/invitations/:id/again` with `send` | the Users page with the new link queued for email, or shown once with Copy |
| Give a role (`/people/:id/grant`): the role, the location, when access ends (`ends`: `never`, the default, sends no end, so the setting `iam.grant_days` decides; `8h`, `1d`, `7d`, `30d`, `90d`; `at:<date>` keeps a change's old end; the Owner role never ends) and whether it is used only when switched on; picking the Owner role asks first (`OwnerConfirm`: what an Owner can do, then Make Owner, which posts the same choice with `confirm=owner`, or Cancel, 2026-11-15); change one (`/people/:id/grants/:binding/change`): the new one given and the old one ended, or the old one ended first for the same role and place, a step that fails after the other worked said plainly ("Only half done"), keeping "only when switched on"; remove one | `POST /api/iam/bindings`, `DELETE /api/iam/bindings/:id` | `?done=granted`, `role-changed`, `ended` |
| Copy access (`/people/:id/copy`, `from`): the list read again, then each role it shows given with its location, end and "only when switched on", one grant each; one refused says "Only part copied" with how many were added and which was refused; nothing left to copy is 422 "Nothing to copy" | `POST /api/iam/bindings` | `?done=copied` |
| Change permissions (`/people/:id/see`, 2026-11-22): each row whose pick changed gets, unless the pick is Inherit, a new Allow or Deny at this location with Access ends, and then its own earlier one there ended (made first, so a refusal never leaves a Deny gone; one already ended counts as done); a new Deny without "Yes, deny what I picked" comes back 422 "Confirm the deny" with the picks kept; `POST /people/:id/exceptions` still takes one permission alone and goes back to Permissions | `POST /api/iam/overrides`, `DELETE /api/iam/overrides/:id` | `?done=perms-saved`, `nothing-changed`, `extra-added`, `exception-ended` |
| Switch the account off, with a reason if one is given, or on | `POST /api/users/people/:id/deactivate`, `reactivate` | `?done=off`, `on` |
| Change their name (`/people/:id/profile`); end one sign-in (`/people/:id/sessions/:sid/end`) or all (`/people/:id/sign-out`) | `PATCH /api/users/people/:id/profile`; `DELETE /api/users/people/:id/sessions/:device`, `POST /api/users/people/:id/sign-out` | `?done=profile-saved`; the Sessions page with `session-ended`, `signed-out` |
| Create a role, save one, remove one (`/access/roles/:id/remove`) | `POST /api/iam/roles` (placed below every existing role), `PATCH`, `DELETE /api/iam/roles/:id`; each module posts `level:<part>` and the level it showed, `was:<part>`: a changed level gives that level's permissions, otherwise the module's ticked `capabilities` count (so Custom, and a box ticked without the script, are kept); special permissions only from their boxes. A name another role has, or nothing chosen, is refused before the API | the role with `?done=role-made`; `role-saved`; `/access` with `role-removed`; a refusal shows the page again with the name and the choices as sent, under "The role was not created" (or saved) and the reason in words |
| Move a role up or down (`/access/roles/:id/move/up\|down`, 2026-11-22) | `PATCH /api/iam/roles/:id` with `position`: into the gap just past its neighbour, or, with no gap, the neighbour moved first and the two swapped; never above the Owner role | the role's Assigned to with `?done=role-moved`; a refusal in words |
| Save a user's policy (`POST /people/:id/see/policy`, 2026-11-23) | `parsePersonPolicy` and `policyChanges` (`policy.tsx`) against `capabilities`, `scopes` and their `overrides`; `intent=check` shows the result, `intent=save` makes each new one (`POST /api/iam/overrides`) then ends each old one (`DELETE /api/iam/overrides/:id`), at most 12, a new Deny only with `sure=yes` | Policy JSON with `?done=perms-saved` (or `nothing-changed`); a problem shows the page with each reason and the text back in its box (422) |
| Import a policy (`/access/roles/:id/import`, `/access/roles/import`, 2026-11-22) | `parseRolePolicy` (`policy.tsx`) against `GET /api/iam/capabilities`, then `PATCH` or `POST /api/iam/roles`: Version `oltrem-2026-11`; each rule an Allow at `loc:*` of permission names or old ids, `*`, `area.*` or `*.verb`, expanded to today's permissions and saved as that list (a permission added later is not covered until the role is saved again); a Deny, another Resource, a Condition, an unknown field or permission, and the Owner's or Vendor's own are refused, each named with what to do instead | the role with `?done=role-imported` (a new one `role-made`); a refusal shows the page with "The policy was not imported", every reason and the pasted text back in its box |
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
| Switch beside the work (`/do/switch`, 2026-11-14, the Vendor and Owners): a part's extras in a row at the top of its own first page (Backups, Audit log, Roles), each saving when flipped (`data-autosave`); Turn off beside a Status warning that the extra stopping it, or its part when not core, silences; Hide on Get started. `ids` names what changes, each on when `on` names it too; only the Features page's own parts and extras, never a core part | `GET /api/settings/parts`, then `PUT /api/settings/parts` with the list off changed for those ids alone (its permission, recent sign-in and audit row apply); the names and what each extra stops are read once per isolate | back to the page (a path on this portal with a plain query, else Home) with `?done=switched`, or `?done=switched-on` when every id posted was switched on, which a module's own page shows too; a refusal shows its reason |
| Back up now (`/do/backup/run`, 2026-11-14): the ticked parts, and, only with Keep these for the nightly copy too ticked (2026-11-15: a files-only copy had switched the nightly database copy off), each tick that changed saved to `backup.copy_database` or `backup.copy_files` so the nightly copy follows it | `GET /api/backup/status`, `POST /api/backup/runs { parts }` first (so a refused start changes nothing), then `PUT /api/settings/values/<key>` for a changed tick | `/backup?done=backup-started`, `backup-started-choice-kept`, `backup-started-choice-not-kept` (no right to change settings) or `backup-started-choice-not-saved` (the save failed); a refusal (nothing ticked, not set up, one running) shows the page with its reason |
| Do a Get started step on Home (`/do/get-started`: the module and the step's place) | the module's steps read again (`GET /api/<module>/onboarding`), then only that step's own `action.path` (POST, empty body); a step without one, or a module with no steps, calls nothing | `/?done=step-started`; a refusal shows Home again with the reason as a toast |
| Look up a domain (`/providers/detect`) | `POST /api/providers/detect` | what was found, on the page |
| Connect a provider (`/providers/add/:definition`): a name and its fields; one step since 2026-10-29: the key is checked at once, and a working email key becomes the one that sends when none does, has its addresses read and (since 2026-11-03) its delivery reports registered at the provider by API | `POST /api/providers/instances`, then `.../probe`; for email `.../activate`, `POST /api/email/domains/discover` and `POST /api/email/instances/:id/reports` (Resend, Brevo, Mailjet; another provider answers that it is set up by hand, and the address stays on its page) | Write with `?done=connected`; a refused key its provider with `?done=connected-refused`; another kind `?done=checked` |
| Check again, under Ready to send (`/providers/ready`, back to the page it was pressed on) | `POST /api/email/ready/check` | `?done=rechecked` |
| Check the key; Send a test message, to the address typed or your own | `POST /api/providers/instances/:id/probe`, `POST /api/email/canary` (`to`) | `?done=checked`, `tested`; the answer under Last check |
| Make it the one that sends (then the email held while none did is sent: `POST /api/email/release`), take it out of use, remove it | `POST .../activate`, `.../disable`, `DELETE /api/providers/instances/:id` | `?done=sends`, `taken-out`, `removed` |
| Paste the key again | `POST /api/providers/instances/:id/credential` | `?done=key-saved` |
| Save the Settings page (`/settings`, Look 3, 2026-11-08): every row is one form's, `value:<key>` beside `was:<key>`, the value it showed; only a row that differs is sent, each in turn as if saved alone; since 2026-11-15 a refusal stops none of the others, and the page names each row not saved with why and how many others were saved (`settingsRefusal`), the first refused value back in its box; the Colours for everyone tiles send `look:palette` and `look:pattern`, joined as `settings.look` (since 2026-11-11); saved, it also clears the person's own pick on their device (the look cookie), as the Look page's Make it everyone's look does, so they see what they saved (2026-11-22) | `PUT /api/settings/values/:key` for each changed row | `?done=settings-saved`, or `settings-unchanged` when nothing differed |
| Save a setting (`/settings/:key`): text, a number, On or Off, a choice, or a list one item per line (blank lines dropped), turned into the setting's type; a refused value comes back in its box | `PUT /api/settings/values/:key` | `?done=setting-saved` |
| Reset a setting to its default (`/settings/:key/reset`, the row's quiet button) | `PUT /api/settings/values/:key` with the default the list names | `?done=setting-reset` |
| One value for the settings that share a name (`/settings/same/:name`, as `currency`): each saved in turn through the API, so each is checked and audited as if saved alone; the first refusal stops it, and the ones before it stay saved | `PUT /api/settings/values/:key`, once each | `?done=settings-same` |
| Assign to me (`/alerts/:id/acknowledge`) | `POST /api/alerts/items/:id/acknowledge` | `?done=acknowledged` |
| Resolve incident (`/alerts/:id/resolve`): the reason picked and a few words, needed for Other | `POST /api/alerts/items/:id/resolve` with `{ reason, words }` | `?done=alert-resolved` |
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
switch posts `theme` (light, dark or system) and `back` to `POST /do/theme`, which keeps the choice
in the `oltrem_theme` cookie (cleared for system) and returns to `back` when it is a path on the
portal, Home otherwise; the frame then sets `data-theme` on the page. A form posted from another
site is refused.
Sign out, in the same account menu, is a plain post (`data-reload`, so the browser follows it out
of the portal): behind Access to `SIGN_OUT`, `POST /api/iam/me/sign-out`, which ends this
sign-in and sends the browser on to Cloudflare Access's `/cdn-cgi/access/logout`, ending the
door's session too; on this computer to the local door's `/local/sign-out`.

## The frame

Every page sits in one frame, drawn on the server:

The toolbar is one line (2026-11-24): the page script (`foldFilters` in `client/frame.js`) folds
the `.ui-filters` rows after a page's search that do not fit on its line behind a Filters button
there, with how many filters the address narrows by; on a phone every such row folds, hidden by
the stylesheet before the script runs. A chip that names a state shows its `tone`, one that names
a thing its `hue`, as a dot before its words (Users' Active and Invited, a role; the Audit log's
Refused and Failed, each section).

A module switched off on the Features page (the `partsOff` set `@oltrem/core-http` puts on each
request) is gone for that request: no sidebar entry or tab, no Home card or Needs you, nothing in
the search; its pages, a module's own by their pattern and a kit section by its address, answer
404. Opened in the browser, such a page says which part it belongs to and that it is switched off
(`PartOff`, 2026-11-14: a list's Send email showed "Nothing at this address" while Campaigns was
off); the Vendor and Owners get Switch on, which posts to `/do/switch` and comes back to the same
address with its query. Switched back on, all of it is there on the next request.

**A page's reads go together** (2026-11-12). Each read is a trip to the database, tens to a few
hundred milliseconds from where the Worker runs, and a page that makes them one after another
waits for their sum. So a page first learns who is signed in (the session, which every read needs
and which costs no trip of its own), then starts everything else at once: the bell's count, the
tabs the person may open (`probe`), the saved views and the page's own reads (`beside` in
`src/screens.tsx`). The count, the tabs and the reads used to wait for each other, three or four
trips before a page's own first read; now a page waits for its slowest read.

- **Saved views** (since 2026-11-03), above a list page that keeps them (`views` on a module's
  page; a records list, a form's inbox and the audit log): the person's views as a sideways row of
  chips, All first and the one on screen marked, then Save view (since 2026-11-24 a small button
  whose dialog asks the name, and the row folds behind the toolbar's Filters button with the filter
  rows), or Remove view on a saved one. Both post to `/do/views` and `/do/views/remove`, which
  call `@oltrem/users`'s `/api/users/me/views` and return to the list; a refusal (twelve views on
  the page already) is shown with the way back. One D1 read per such page; nothing when users is
  off.
- **A record beside its list** (2026-11-26, the frame script; the owner: a job opens in a panel
  from the right, not a page of its own): a link inside `[data-peek="<dialog id>"]` whose path
  starts with that dialog's `data-peek-panel` opens in the dialog instead. The script fetches the
  linked page, shows its `[data-peek-body]` in the dialog's `[data-peek-slot]`, names it from its
  `[data-peek-title]` in `[data-peek-name]` and points `[data-peek-full]` (Open as a page) at it.
  Links under the same path (the record's tabs) stay in the panel, a form posted in it is sent
  from it and its answer shown there (a confirm dialog over the panel closes first), any other
  link closes the panel and opens as usual, and once the panel closes after a change the list's
  live block is fetched again. The panel is `ui-drawer ui-peek` (42 rem wide, the whole screen on
  a phone, its body a container so its panes lay out by its own width); a page wraps its body in
  `<div data-peek-body class="contents">`, which the page lays out as before. Without the script
  every link opens the record's page. Used by Scheduled jobs. Later the same day: the panel has
  its own 20 px gutter and clips sideways, so a row of tabs never makes it scroll left and right;
  its tabs stay at its top as it scrolls; the open record's row is marked in the list
  (`data-peeked`, a tint and a bar at its start); buttons marked `data-peek-step="-1"` or `"1"`
  and the keys K and J open the previous or next record of the list without closing the panel;
  an empty panel shows a soft placeholder while the record loads.
- **Notifications** (since 2026-11-03): a bell at the right of the page's head from 1024 px
  (since 2026-11-14; it was a sidebar row), and on the phone's bar along the top (2026-11-11), with
  the unread figure (to "99+") and, since 2026-11-26, a tooltip naming it ("Notifications: 3
  unread"), read on every
  page beside the page's own reads (one indexed read more; none without the users module). Since
  2026-11-14 a bell opens a panel over the page (`notify-panel`, closed by X, Escape or a tap
  outside) filled from `/notifications`, whose list works inside it; without the script it opens
  `/notifications`: All or
  Unread as chips, Mark all read, each notification a row (unread ones bold) that opens through
  `/notifications/:id`, which marks it read and goes to its page (a path inside the portal, else
  the list); thirty a page with Older; under them "How you are told", a grid of two switches per
  module, In the portal and By email (both on is `both`, neither is `off`), saved as one flips
  (a Save button only without the page script); only what changed is sent. Since 2026-11-22,
  under them, **Keep portal emails in your main inbox** (`#primary`, while email is on and names
  a domain): Gmail puts the portal's notices under Updates, and only the reader's own filter or
  contact keeps them in Primary. A sideways row of three: **Gmail filter**
  (`/notifications/gmail-filter.xml`, a filter file in Gmail's own export format: mail from any
  of the portal's domains to Primary, never to Spam, marked important; import it on a computer),
  **Add to contacts** (`/notifications/portal-contact.vcf`, one vCard 3.0 contact with every
  sender address, for a phone) and **Send me a test** (`POST /notifications/primary-test`, which
  calls `POST /api/email/primary/test` and comes back with "A test email is on its way"); then
  the steps for a computer, a phone and Outlook, and who the mail comes from. Both files are built
  in `src/primary.ts` from `GET /api/email/primary` (`@oltrem/email`); with nothing to name, each
  link leads back to the page. One more read on the page, none without email.
- **Bulk actions** (since 2026-11-03), on a list whose module declares `bulk` (the tasks): a
  tick on each row and card, one in the header for the whole page, and the bar (`BulkBar`) above
  the list with the module's actions. The frame script counts the ticks ("3 tasks chosen"), keeps
  a row's two ticks alike and holds the buttons until one is ticked; a destructive action asks in
  a dialog. A press posts to `/do/bulk`, which calls `POST /api/<module>/bulk/<action>` once and
  returns to the list with `?bulk=<module>.<action>.<done>.<refused>`; the list shows how many
  were done and how many refused, in the kit's own words, never words from the address.
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
  2026-11-22, in place of Work, Company, Users and access, Messages, System; since 2026-10-29,
  few entries, sub-pages as tabs). A module's page joins its group wherever the module
  is listed, at its `before` when it names one; a group the kit does not know sits before Admin
  (`groupRank` in `src/layout.tsx`). The colours: Customers rose, Work green, Team amber, Email
  cyan, Admin violet.
  Each group has a colour (`hueOf`): its heading, its dot, and since 2026-11-15 each section's icon
  on a small tile of that colour (solid for the section on screen, whose row is tinted and bold,
  so it never rests on colour alone). The sidebar itself is tinted with the portal's colour
  (`--ui-side`). Open, it is 17 rem wide (2026-11-26: fitted to its longest name the day before,
  it was "TOO thin"), and so is the phone's drawer, less 56 px on a narrow screen; the account's
  menu is never narrower than 15 rem and its colour dots wrap rather than leave it. Home's At a glance rows use
  the same colours.
- **Tabs.** Sections that name the same `tabs` (`PageNav.tabs`) fold into one sidebar entry under
  that name, at the first one's place, leading to the first tab and marked on any of them (`tabSet`
  and `sideEntries` in `src/layout.tsx`). The section labelled as the set is the first tab, the rest
  follow in the sidebar's order. Since 2026-11-01 the tabs sit under the page's head, as a
  console's do (`PageHead`): on a set's own pages the heading is the set's name (Email) and the
  marked tab names the page, so no word shows twice (a screen reader hears "Email: Sent"); a page
  inside a tab (a message, `Connect an integration`) keeps the set's row and tabs and puts its own
  title under them; a page inside a section with no tabs (a list in Lists, Create form) shows a
  link back to the section above its title (since 2026-11-26 one link with its arrow pointing
  back, "‹ Data", where a lone "Data >" read as an orphan). The tabs are links on an underline, the marked
  one in the group's colour and never bold (no label moves), a count beside a tab when the page
  gives one (`counts` in a page's answer, by the tab's path). On a phone the row scrolls sideways
  into the gutters, which fade; since 2026-11-22 (the owner: the tabs jumped on every page) the frame script opens the same row scrolled where it was on the page before, and moves it only as far as shows the marked tab whole. A page's commands start its content, under the tabs, so the head and the tabs are the same on every page of a set; the arrow
  keys, Home and End move between tabs. From 1024 px the row stays at the top while a long page
  scrolls, on the page's colour once stuck, where the browser can tell (`scroll-state` queries; elsewhere it
  scrolls with the page). The head and the tabs keep still in a page change; only the content
  below them fades. Users and access is one entry whose pages are tabs (2026-11-13), each shown to
  whoever its `may` says yes for (`NavEntry.may`). A set holds five tabs at most: a page that
  belongs to a tab but is no tab of its own names it in `under` (2026-11-22), so it is left out
  of the row, marks that tab while it is open, shows as a chip under the tabs ("Also here") or in
  a Settings tab's Set up list, and is still found by the search box.
- **Width.** A page is a console or a form (`kind` in a page's answer; `console` by default). A
  console uses the screen up to 96 rem, its gutters 16 px on a phone and 32, 40 and 48 px from 1024,
  1280 and 1536 px; a form (Settings, Connect an integration) keeps its content to 56 rem under a
  head and tabs as wide as a console's, so they never move between the two. The sign-in pages
  stay a 40 rem column.
- **No sideways shift.** The document keeps the scrollbar's room on every page
  (`scrollbar-gutter: stable`), so a short page and a long one start at the same place; before
  2026-11-01 a classic scrollbar (Windows) came and went between pages and moved the centred page
  by half its width. A page with no entry of its own sits under the module's entry its
  path starts with (`/email/sent/7` under Sent). With every kit module on (2026-11-22), the sidebar
  holds 19 entries besides Home; the addresses did not change, only the names and the groups:

  | Group | Entries (tabs) |
  |---|---|
  | Customers | Customers (Customers, Privacy requests), Bookings, Sales (Quotes, Invoices), Forms |
  | Work | Tasks, Lists, Files, Approvals, Reports |
  | Team | Time (Time off, Time clock, Shifts), Expenses, Equipment, Announcements |
  | Email | Email (Compose, Inbox with Mail, Drafts, Sent, Delivery log, Templates), Campaigns (Campaigns, Mailing lists), Email settings (Setup, Addresses; with Mail, also Mail setup and Forwarding) |
  | Admin | Integrations (Apps, Email services, Developer), Automations, Users and access (Users, Roles, Groups, Locations, Settings; since 2026-11-22 Signed in today and Access requests open under Users, Access reviews and Vendor access under Settings), Settings (Features, Settings), System (Status, Alerts, Backups, Deployments, Audit log, Settings) |
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
- **On a phone** (2026-11-11, the owner's ask: "only the sidebar", in place of
  Look 3's bar along the bottom), a bar along the top (`PhoneBar`, `ui-phone-bar`): Menu, which
  opens the sidebar's parts as a drawer from the left (a `dialog` opened by the browser's
  `commandfor`; a tap outside closes it), the portal's mark and name to Home, Search, and the bell
  with the unread figure. A set that hides its tabs row (Email, whose folders hold the set) also gets a gear before the bell, to the set's Settings tab, and the same tab as a Settings row in its sidebar menu (2026-11-22; the frame finds the tab under `/settings/section/`, and the stylesheet shows the gear only on such a page). Nothing sits along the bottom, so the page runs to the foot of the
  screen. The page's own head names where you are under the bar, so a head marked `data-bar`
  keeps its heading and actions and drops only its icon and line. The document names the phone
  browser's bar colour (light, dark, or both for the device's own).
- **One sidebar, everywhere** (2026-11-15, the owner: "the double sidebar is not something I am
  a fan of ... sidebar should be universal"): there is no second pane beside the sidebar and no
  phone section menu. The sidebar holds only the sections (2026-11-25, the owner: no sub-rows
  from Files and Email in it). A page with a menu of its own (Email's folders, from core-ui's
  `MailShell`) has it drawn in the page: `Frame` renders the page's body first inside core-ui's
  `SideMenu` context, where `MailShell` leaves its folders (`SideMenuData`) instead of drawing
  them, then the head, then core-ui's `PageMenu` as a row under the head. A folder or a count
  changes only the page, so the browser keeps its sidebar. The sidebar's look is solid
  (2026-11-25): its own colours (`--ui-side`, `--side-fg`, `--side-fg-3`, `--side-fg-strong`,
  light and dark), each icon bare in its group's colour, the page on screen tinted in that colour
  with a marker at its edge, each group's name after a dot of its colour. Menu on a phone opens
  the portal's drawer, scrolled so the page on screen is in view. Where the browser has no
  command buttons (`commandfor`: Safari before 26.2, Samsung Internet, Firefox before 144) the
  script does what the button asks, and closes a `closedby="any"` dialog on a press outside it.
- **The first page of a fresh copy** (2026-11-15): `createScreens` draws the frame once while
  the Worker loads, into nothing (`warmFrame`), so the renderer, the frame, the sidebar and its
  icons are compiled before the first request, whose CPU the Free plan counts; a fault there is
  printed and the Worker starts as before ([record](../../archive/records/2026-11-15-cpu-first-request.md)).
- **Colours in the account menu** (2026-11-08): six coloured dots (`DOTS`) above the theme icons
  post `palette` and `back` to `POST /do/look`, which keeps the pattern the cookie already holds.
  With the script, the new colours and a change of theme spread from the button pressed as a
  circle (a view transition, 450 ms); without it, or under reduced motion, the page just changes.

**No reloads.** The frame's script (`src/client/frame.js`, served at `/ui/app.js` under its
version) opens a link to one of the portal's pages, a search, a filter or a form's change in
place: it fetches the next page and swaps only the page's content (`main.ui-page`), so the
sidebar stays on screen where it was scrolled and the section on screen is marked as the new page
marks it. The address, the title, Back and Forward (with the page's scroll) behave as on a load.
**A refused form** (2026-11-15) keeps the address of the page it was sent from, never the form's
own address, which often answers nothing to a reload; and when the answer is a refusal (the
problem notice's `data-refused`), the script gives the form back as it was sent, by field name
(hidden, file and password fields as the page drew them), opens its dialog again and shows the
reason at the top of the dialog, so no module redraws a refused form by hand.
A page change fades the content in where the browser has view transitions and motion is on: one
fade of 150 ms since 2026-11-22 (the owner: page changes were a jerk, never subtle), with no rise,
blur or slide and no part coming in after another; the head and its tabs stay still, and Email's
panes keep their own moves. A sidebar group folds and opens by gliding, the phone's folders and
section drawer slide out as they came, a dialog's shade fades both ways, a fold's contents drop in
as it opens, and a sidebar row gives a little under a press (`theme.css`); a
change that comes back to the same page keeps its scroll and brings its outcome (a `Done` notice
or an error) into view. Focus moves to the new page's heading, or to a form's errors. The page
under the pointer is fetched a moment ahead, so the click opens it at once. **Pages kept in
memory** (2026-11-12, the owner: no waiting for a page, Back included): each page opened is kept
in the tab's memory for 15 minutes, 40 at most, and never on disk. Back, Forward and a link to a
kept page show it at once; when the copy is older than 15 seconds the portal is asked for the page
again with every check, and a page that changed is put in place unless the person has already
tapped, typed or opened a dialog (then it is kept for the next time). An answer that is not the
page (a session that ended) opens as the browser would, and a failure forgets every copy. Any
change sent (a form's POST, a module script's own `fetch` other than the frame's sidebar and
theme switches, `/do/side` and `/do/theme`)
forgets them all, since it may change any page. **Marked once shown** (2026-11-21): an element
with `data-seen` naming a read mark of the portal's API (an address under `/api/` ending in
`/read`, a form answer's; no other address is ever sent) has that address sent an empty JSON POST
once the page is shown, never when it is only fetched ahead or
kept, so a page fetched under the pointer marks nothing until it is opened. A part of a page marked `data-preload` (Email's
folders) has its links fetched one at a time when the browser is idle, 16 at most, and kept, so
moving between them is instant; a link with `data-preload-skip` (Compose, which checks the senders
when it opens, and the + of Labels) is not, nor anything while the tab is hidden or the phone
saves data. The arrow and the
theme switch act at once and save behind the scenes. A button with `data-copy` copies that value
to the clipboard and says "Copied", aloud too, for two seconds. A button with `data-fill` (a
field's id) and `data-value` puts that example in the field and moves there (2026-11-10: the
example sender address on Email settings). Since 2026-11-14 a page still loading shows the loading orb
(thinking-orbs' engine, which `pnpm ui:build` puts before the frame's script as `oltremOrb`) in a
round chip at the top, under the phone's top bar, and a form's button shows it while the form is
sent; one still frame with reduced motion. It replaced the thin line at the top, and after 150 ms the page dims (`data-loading`), so a press is seen. **A change
shown at once** (2026-11-13, the owner: the screen changes before the server answers): a form or
its button marked `data-optimistic` changes its row (`data-optimistic-row`), or for a list's command
the rows ticked for it, before it is sent. `hide` takes the row away, `set:<name>` and
`unset:<name>` put or take the row's `data-<name>`, and `toggle:<name>` flips it with the button's
`aria-pressed` and its `data-optimistic-label` for the other label. Such a send neither dims the
page nor shows the line; the portal's answer puts the true page in place, and with no answer at all
every row is put back as it was and the page says the change may not have been saved. The marked
tab, segment and section carry a mark (`.ui-mark`) the script adds and names alike on both pages
of a change, so it glides; a filter on the same page moves the mark alone (`data-vt="mark"`). A
page that arrives counts its plain figures up and fills its meters, keeping the real figure for a
screen reader (2026-11-11, the owner's V22 and V30 clips); a figure a live block brings changed glides from the old value to the new in 400 ms (none under reduced motion). A link to a section of the page on screen (`#invite`) is the browser's own: it
scrolls there, and the popstate it fires is not taken for Back (until 2026-10-31 it fetched the
page again and put it back at the top, which looked like a reload). Lists of boxes to tick: a
group's ticks are counted (`data-check-group` with `data-count`, the form's in
`data-count-all`), `data-check-all` ticks or clears one group, and an input with `data-filter`
hides the `data-filter-item` rows (and emptied `data-filter-group`s) of the element it names;
those controls start `hidden` with `data-enhance` and appear with the script. A box or switch whose
`data-needed-by` names the values of other boxes of its name (the Features page) shows the
element its `aria-describedby` names while it is off and one of them is on.

**The page alone.** Each page carries a key of its frame (`data-frame`: the portal's name and
icon, the person, the sidebar's rows, the unread count, a page's own menu in the sidebar). The script sends it as `x-ui-frame` on
every page it fetches; when the server's key for the new page is the same, the answer is only
`<div class="ui-frame" data-here="…"><main>…</main></div>`, 40 to 80 percent smaller and 1 to
2.5 ms less CPU (2026-11-11, [the record](../../archive/records/2026-11-11-portal-name-icon-font.md)),
and `data-here` names the sidebar row to mark (`data-here-as="true"` when the row holds the
page's own menu). A page whose key differs is opened whole.

**Live blocks.** A block marked `data-live="name"` with `data-refresh="seconds"` (at least five)
is kept up to date: the script fetches the page again, or the lighter page `data-refresh-from`
names, and swaps that block alone, so what the person is reading or typing elsewhere stays. It
does not fetch while the tab is hidden, a dialog is open, a page is on its way or the person is in
a form. A block whose new copy has no `data-refresh` stops refreshing; a fetch that fails dims the
block (`data-stale`) until one works. A campaign's progress is the first such block.

**Compose boxes** (the email Write page, 2026-11-01). An input with `data-chips` turns each
address typed into a chip (its class is the attribute's value; a chip that is not an address gets
`data-bad`), while a hidden input of the same name posts them comma-separated as before. Since
2026-11-11 the box reads addresses out of whatever it is given, typed or pasted: a list split by
commas, semicolons, tabs or lines, `Name <address>`, `Name (address)`, `mailto:` links, a name
and an address on one line; an address already there is not added again, and a bare address the
box's suggestions know (its `list`) takes their name. A form with `data-keep-typed` (Email's
Write), once typed in, is not left by a link or a closed tab without the browser asking first;
sending it, or saving it, leaves freely; `data-keep-typed="unsaved"` counts it as typed from the
start (a page drawn again with what was typed). A form with `data-keep-draft="<address>"`
(Write, 2026-11-13) saves itself there three seconds after the last change and before the page
is left in place or the tab hidden: the JSON answer `{ id, url }` fills its `draft` field and the
address bar, drops the kept copies of the page and of `data-keep-draft-forget`'s pages, and its
`[data-keep-draft-state]` says Saving, Saved or Not saved yet; `data-keep-draft-hide` nodes hide.
Such a form, once saved, leaves freely; one whose save failed asks first, and a Send waits for a
save under way. A `details[data-pick]` (Write's From,
2026-11-11) is a dropdown of radios: a change shows the chosen option's `[data-pick-face]` in
its summary's, a press on an option (the one already chosen too) closes it, the arrow keys only
move the choice, Enter closes it instead of sending the form, and a click elsewhere or Escape
closes it; core-ui's `Dropdown` draws it (2026-11-12). A line
marked `data-fold` with an empty input folds behind the button whose `data-unfold` names it; since
2026-11-12 `data-unfold` may list several ids (Write's one Cc/Bcc button), shown while all are
empty. A
button with `data-mark` (`strong`, `em`, `list`, `link`) puts that mark around the selection in
the box its `aria-controls` names; a block with `data-marks-of` draws that box's words with
their marks as they are typed (a list takes `data-list-class`). Ctrl or Cmd with Enter in a form
with `data-send-key` presses its `data-send` button, and a select, a file input or (since
2026-11-12) a radio with `data-submit-with` presses the button it names when it changes, that button hidden (a file input:
since 2026-11-08, Write's Attach a file). A file input with `data-upload` (2026-11-08) sends each
file chosen straight to that address as the body, with its `name` and the values of the form's
fields named in `data-upload-with` added to the address, then opens `data-upload-done`; a
refusal's words show on the input itself. A large file so never passes through a page's form
(Mail's files over 10 MB, up to 95 MB). A file input with `data-drop-file` (2026-11-14, Write's
paper clip) takes a file dropped anywhere on its form, which is outlined while one is over it, or
pasted into it with no words (a screenshot), and sends it as a choice would. A file input with `data-file-peek` (2026-11-14, Lists' Add contacts) shows the chosen CSV in the block it names before anything is sent: the name and size, how many rows (`data-rows`, `{n}`), the headings (`data-cols`, `{list}`), and one warning line: `data-no-email` when no heading or column holds addresses, `data-big` (the file unread) when it is over `data-max` bytes, `data-unread` when it cannot be read as text. Only the first 51 rows are read cell by cell; the rest are counted by their lines. A file input with `data-csv` (2026-11-11) reads a CSV
list of any size in the browser: past 30 columns it keeps the address, the name, the files and
the columns named in `data-csv-need`, then the rest in order; it sends the rows in parts of about
600,000 characters, each with its heading, the first to `data-csv` and the rest to
`data-csv-more`, with the form's fields named in `data-csv-with` on the address (and `total`,
the people of the whole file, on the first), says which part
goes in the element `data-csv-progress` names, then opens `data-csv-done` with `added` (the
people taken in). Campaigns' list upload uses it. Without the script each is a plain box, line, select and
button, and the form posts the file.

**The composer** (Oltrem Mail's Write page, 2026-11-08). A block with `data-rich` naming a
textarea shows (it starts `hidden`) and the textarea hides. Its `[contenteditable]` takes the
textarea's words with their marks made HTML, or its HTML when the block has `data-rich-html`.
Buttons, selects and colour inputs with `data-rich-cmd` run the browser's editing command of that
name (`quote` toggles a blockquote; `link` opens the block's `data-rich-link` line, whose
`data-rich-link-add` and `data-rich-link-close` buttons add the link or close it; Ctrl or Cmd K
opens it too). A paste keeps only the composer's tags and looks; a paste whose plain text is HTML code (it opens with a tag, ends with one and closes one) instead checks the form's `format` radio set to `html` and puts the code in the textarea as it is, when the block has `data-rich-code`, with an info notice; without `data-rich-code` it goes in as words from the plain text, and the notice says why (2026-11-11). The composer writes its HTML into the textarea on a send only while it is on, so code in the textarea is what goes. The textarea holds the
composer's HTML and the form gains a hidden `editor=rich`. Nodes marked `data-rich-hide` hide and
those marked `data-rich-show` show; a `format` radio set to `html` hands the textarea back as code,
and another choice takes it into the composer again. Since 2026-11-12 (a coded email went as its
own code shown as words) the code is read wherever it comes from: a chat's answer with words and a
fenced html block (the code alone is taken), a long run put in at once without a paste (a phone
keyboard's clipboard); choosing `html` with code in the composer hands the textarea the code itself,
not the composer's lines of it; going back with code in the textarea shows it as the composer's
lines, which the server reads as the code. A block with no `format` radios (an address's
signature) gives pasted code the textarea as it is and steps aside. The server cleans the HTML
again; without the script the textarea works as before.

What the script leaves to the browser: another site, a new tab, a download, the API, the hooks,
`/ui/*` (the frame's public files), `/do/*` (the screens' own actions), the local door and the invitation link (`NATIVE` in the script), and an answer that is
not a page. When the sidebar itself changed (a section given or taken away, another account: the
frame's `data-frame` key), it draws the new sidebar and keeps where it was scrolled. When a form's
change gets no answer, it says so on the page instead of sending it twice. With no script at all,
every link and form works as a plain load.

The screens' own actions (the colour, the theme, the sidebar, saved views, bulk, Get started) sit
under `/do/`, and only the public files sit under `/ui/`, which answers GET alone
(`test/paths.test.ts`). Until 2026-11-12 the actions sat under `/ui/` too: a portal whose Access
was set before 2026-11-11 still leaves all of `/ui/*` open, so they reached the Worker with no one
signed in and were refused with KIT-E-0401, and the fleet, which cannot change Access, never closed
it. Under `/do/` they are behind the door on every portal, whatever its Access says.

An address that answers nothing, opened in a browser (a `GET` that accepts HTML, outside
`/api/`), is the **Not found** page in the frame, with a way to the home page, still with the 404
status. Only the API's problem answer is replaced: a page's own 404 is kept, and `/api/` keeps
the problem.

## The stylesheet and the script

`/ui/app.css` is the one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s theme and
the classes the pages, the primitives and every module's `src/*.tsx` use, under the 80 KiB a
test allows (64 until the colour pass of 2026-11-04, by the owner's yes). A colour with an opacity (`bg-primary/10`) is written once, as its `color-mix()`:
Tailwind's second copy for browsers without it, about a tenth of the file, is left out
(2026-11-03), as the theme's own rules use the mix bare. `/ui/app.js` is the orb's engine
and the frame's script (`src/client/frame.js`), each shrunk by esbuild (2026-11-24, the owner's yes:
whitespace, comments and inner names left out), 88 KiB where the copy without comment lines was
131 KiB; the build checks that each part still compiles.

**The font** (2026-11-11): Inter Variable, Latin letters only (English first, Spanish's accents
ready), 47 KiB, from `@fontsource-variable/inter` at build time (SIL Open Font License 1.1, its
notice in the generated file). The build puts its `@font-face` at the top of `/ui/app.css`, and
the Worker serves it at `/ui/inter.woff2` under its version (`APP_FONT_VERSION`), kept for good
and preloaded by every page; the device's own font shows until it arrives (`font-display: swap`).
It is decoded once per copy of the Worker with a plain loop (2026-11-20: a callback per character
took about 4 ms of that first request).
A brand font (`--brand-font`) still comes first. **The icon** is served at `/ui/mark/:file`, a
name made of its contents, kept for good, with its own type and `nosniff`; anything else is 404.

**Served by the Worker, never as static assets.** The stylesheet, the script and the font are strings in
`src/generated/assets.ts`, served by `publicRoutes` before the door, cached for good under the
version every page links (`src/generated/versions.ts`) and `no-cache` without it. From 2026-11-03
to 2026-11-04 they were Cloudflare static assets: a Worker with static assets runs behind
Cloudflare's asset router, which does not hand it the Access sign-in (`ctx.access`), so every page
of a live portal refused everyone with KIT-E-0401 ([the record](../../archive/records/2026-11-04-sign-in-and-static-files.md)).
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

`test/css.test.ts` holds the committed stylesheet to its build; `test/marks.test.ts` holds what a mark setting names, a picture icon read from its own bytes and never large, and the tab's icon; `test/frame.test.ts` the frame script's moves, the page alone with its frame key among them; `test/module-pages.test.ts` mounts a module's pages on Node: the sidebar entry in its group, the page in the frame, a form back by its redirect and another site's refused; `test/section-settings.test.ts` (2026-11-22) holds which sections get a Settings tab, last in their row, a single row folding into one, what stays on the Settings page, and a page under a tab marking it and found by the search box; `test/same-access.test.ts` (2026-11-22) holds who Same access as offers and with which role; `test/people-access.test.ts` holds the invitation to the roles the person may give and the Users and access row to the pages each person may use and the addresses read from an invitation file and put back in the box (2026-11-22); `test/start.test.ts` holds Set up for your business: what each kind switches off with the extras kept, the modules ticked for a kind and the ticks saved with what a ticked one needs, Home's first-run question, and the plan's words, the roles left to whoever manages them when they cannot be read; `test/first-run.test.ts` (2026-11-15) the first run and the core pages on Node: more than fifty addresses refused in words, a refused company keeping what was typed, an accepted invitation said on Home and a dead one offering sign-out, Settings trying every changed row, the Owner role asked first, invitations queued with Copy and Send again, several members added, and stuck mail with its last error. The client template's
`test/screens.test.ts` runs the whole first run inside the Workers runtime: the Vendor signs in on
this computer, creates the company, the Owner accepts, every page answers with its words and
Home shows every module's card; a
stranger is told there is no account; behind Access the local door does not exist. Before that,
the Vendor finds every Users and access page asking for the company first, with no action that
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
bad address is refused with its row; the Owner then chooses a spreadsheet file, sees its address in the box with nobody invited, and
invites it from there, a blank file and one over 128 KB refused; and, on Set up for your
business, with Records switched off first, picks Shop: one press within 30 queries switches the
modules, makes Admin above Member and the Products list, a second press makes
nothing twice, Something else leaves the modules as they are and a kind that is not there is
refused. A
third connects Resend, with the provider's answers stood in for: a missing key refused, the key
checked, a test message refused for want of a sending address, the address refused when malformed
and saved on the Settings page, the test message then sent, the provider made the one that sends,
refused removal while it sends, taken out of use, its key pasted again, and removed. A fourth
names an alert recipient on the Settings page, lets a failed deploy report fail its check twice
on the tick, and sees the alert emailed, on the Alerts page and on Home, acknowledges it, and
sees it resolved once the check passes. The last counts the database queries of Home and of every page in the
sidebar once the journeys have filled the tables: Home within 40 and every other page within 10 of
the Free plan's 50 an invocation, each page over its share named.
