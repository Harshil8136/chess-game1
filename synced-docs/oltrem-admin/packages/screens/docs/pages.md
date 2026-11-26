---
title: "@oltrem/screens: the pages, Home to forms"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src/screens.tsx, start.tsx, look-page.tsx, looks.ts, parts.tsx, section-settings.tsx, records.tsx, forms.tsx]
---

# @oltrem/screens: the pages, Home to forms

> Part of [the @oltrem/screens README](../README.md).

## The pages

| Path | Shows | Reads |
| --- | --- | --- |
| `/` | The Vendor before a company exists: the company form, its first Owner the one setup named (`GET /api/iam/setup-people`). Anyone else: a band (greeting and date in their clock, what waits, dials to Needs you, Get started, At a glance: `HomeWelcome`); while Set up for your business is open, `FirstRun` asks the kind of business as chips to `/start?kind=`; Jump back in (`HomeRecent`, from the browser); Needs you (a row per waiting thing to the exact page and tab) over Get started (a bar, each open step a row or a one-press button, `POST /do/get-started`; with email on, `/email/connect` first; the Features page or Hide switches it off); What changed (extra `audit.since`: others' changes since **Mark as seen**, `POST /do/seen`, a week back at most); At a glance (each module's Home figure in lined-up rows, failing first, switched-off work last as Off) | `/api/iam/me`, then each module's `onboarding`, `todo` and `home` together; `/api/users/me/seen`, `/api/audit/since?at=` |
| Any module page, `/records`, `/forms` | Before the company exists: the company form (the Vendor) or "This portal has no company yet"; the portal's own pages still open | `/api/iam/me`, `/api/iam/setup-people` |
| `/search?as=json&q=` | The palette's JSON after a 250 ms pause, two letters on: sections (name, line, `keywords`), settings, roles, locations, then each module that searches as the person. Each `NAV` entry's `actions` show under Actions (five before typing); `?open=<id>` opens a page's dialog once | each `/api/<module>/search` |
| `/look` | 24 palettes (`looks.ts`) and 7 backgrounds as tiles, saved at once (`data-autosave`) in the `oltrem_look` cookie (`POST /do/look`, `<palette>.<pattern>`); pages carry its CSS in `<style id="ui-look">`. An Owner or the Vendor has **Make it everyone's look** (`POST /do/look/everyone`, the `settings.look` setting). `createScreens({ look })` is the default (the template's: `settings.look`, else `brand.look`) | `/api/iam/me`; `PUT /api/settings/values/settings.look` |
| `/notifications?show=&before=` | All or Unread, Mark all read, 30 a page, each module's channels; `/notifications/:id` marks read and opens; Keep portal emails in your main inbox (`gmail-filter.xml`, `portal-contact.vcf`, `POST /notifications/primary-test`) | `/api/users/me/notifications`, `.../choices`, `GET /api/email/primary`, `POST /api/email/primary/test` |
| `/settings/section/:id?show=changed&q=` | A section's Settings tab (`section-settings.tsx`), last in its row: its parts' options and extras, then a card of settings per part with the Settings page's rows, Save bar, Changed and search (no figures or jump list under eight); then **Set up**, the pages opened under it (`under`). Forms send `to`. Shown to an Owner, the Vendor, or anyone who may open a page under it | `/api/settings/values`, `/api/settings/parts` |
| `/settings/parts?show=&q=&preset=` | Features, for `settings.parts` holders: All, On, Off chips, search, "Start from" presets (Everything, Email only, Nothing optional, the saved set) that fill without saving; a section per sidebar group of lined-up rows (icon, name, line, needs and needed by, a box; Always on for the core) with each module's extras beneath. Unticking names what goes off with it, switched off in the same save (`?also=`). One Save bar | `/api/settings/parts`, `PUT` |
| `/start?kind=&done=` | Set up for your business, for `settings.parts` holders: kinds as chips (Services by appointment, Shop, Office, Field team, Something else); then each optional module as a ticked chip (what the kind uses); what the press also makes (roles Admin and Member, the starter list), and **Set up the portal for this**. One save, then what is missing is made; again makes nothing twice and deletes nothing; a failed step is named; under 30 queries. Then the next steps | `GET`, `PUT /api/settings/parts`, `/api/iam/roles`, `/api/iam/capabilities`, `/api/records/lists` |
| `/setup/company` | The first Owner's invitation link with Copy; a refusal keeps what was typed (`companyRefusal`) | `POST /api/iam/tenant` |
| `/accept?token=` | The invitation and Accept (to `/?done=joined`); a refusal shows its title, detail and next step; an unusable or other-address invitation offers no Accept but a way to sign in as someone else (`SignOutToSwitch`) | `POST /api/iam/invitations/accept` |
| `/records` | Visible lists with records and location; Create list where allowed | `/api/records/lists` |
| `/records/new` | Name, location, a starting shape (blank, contacts, tasks, stock, orders, equipment) | `/api/records/lists` |
| `/records/:id?q=&field=&value=&sort=&dir=&page=` | Records searched, narrowed by chips, sorted, paged; add and Add from a spreadsheet | `/api/records/lists/:id`, `items` |
| `/records/:id/items/:item` | One record with who added and changed it; change and Remove | `.../items/:item` |
| `/records/:id/fields` | The designer: fields with up, down, Remove; Add a field; name and location; Remove an empty list | `/api/records/lists/:id` |
| `/forms` | Visible forms with new answers and whether open; Make a form where allowed | `/api/forms/forms` |
| `/forms/new` | Name, location, a starting shape (contact us, quote request, feedback, sign-up, blank) | `/api/forms/forms` |
| `/forms/:id?view=&mine=&q=&page=` | The inbox: status chips with counts (to do, new, open, done, all, Unread), unread in bold, the person's own, search, paged; Try, design, download | `/api/forms/forms/:id`, `entries` |
| `/forms/:id/entries/:entry` | One answer; Take it, Let it go, Mark new, open or done; notes and email replies; Remove; read for the team on view (`data-seen`), Mark unread | `.../entries/:entry`, `.../read` |
| `/forms/:id/design` | The website code, a new address, fields, settings (name, line, open, after-send page, who is told, location), Remove | `/api/forms/forms/:id` |
| `/forms/:id/try` | The form as a website shows it | `/hooks/forms/:key` |
