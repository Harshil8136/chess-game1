---
title: "@oltrem/screens: The pages, continued (6)"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: The pages, continued (6)

> Part of [the @oltrem/screens README](../README.md).

## The pages, continued

| Form | Calls | Comes back with |
|---|---|---|
| Save the Settings page (`/settings`, Look 3, 2026-11-08): every row is one form's, `value:<key>` beside `was:<key>`, the value it showed; only a row that differs is sent, each in turn as if saved alone; a refusal stops none of the others, and the page names each row not saved with why and how many others were saved (`settingsRefusal`), the first refused value back in its box; the Colours for everyone tiles send `look:palette` and `look:pattern`, joined as `settings.look`; saved, it also clears the person's own pick on their device (the look cookie), as the Look page's Make it everyone's look does, so they see what they saved | `PUT /api/settings/values/:key` for each changed row | `?done=settings-saved`, or `settings-unchanged` when nothing differed |
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

Every page sits in the same frame (`src/layout.tsx`); [The frame](frame.md#the-frame) below has the
detail. The sections are in the sidebar only, the owner's choice of 2026-10-22 (R-12). Each section's page opens with
its head (since 2026-11-01, the owner's point 12): one row with the group's icon on its colour, the
title, one short line on what it is for (a module page may give its own, `sub`) and, on the right,
the page's tools (`tools`: a few links in a button's look, the main one last); then, for a section
that is one of a set, the set's tabs ([The frame](frame.md#the-frame)). Then a row of
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
