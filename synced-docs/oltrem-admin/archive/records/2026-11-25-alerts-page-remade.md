---
title: "The Alerts page remade, and sign-in alert emails that were refused (2026-11-25)"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [modules/alerts/src/alerts.ts; modules/alerts/migrations/0096_alerts_manage.sql; modules/iam/src/care.ts; packages/screens/src/alerts.tsx]
---

# The Alerts page remade, and sign-in alert emails that were refused

> **In plain words.** On 25 November the owner sent his live portal's Alerts page and asked for a
> deep look and a complete remake of how alerts are managed. The look found a bug: the email
> telling a person their sign-in was used from another browser was refused every time, so the
> person was never told. That is fixed. The page now reads like the Audit log, one row per alert
> that opens in place, with chips to pick what to see, a search, ticks to act on many at once,
> notes, muting emails for a while, resolving any alert, and deleting resolved ones.

## The bug

The open "Check what you entered (Audit)" alert held `KIT-E-0422 … messageKey: letters, digits and
. _ : -, at most 120`, raised from `signInMoved`. The sign-in-moved email was keyed by the
browser's name, `Chrome on Windows`, whose spaces Email refuses in a message key, so every such
email failed and opened an error alert instead. The key now ends in the name in lower case with
dashes (`…:CA:chrome-on-windows`); a test holds it to Email's rule. The access alert beside it
said the person "was emailed"; from now on it is true.

## What changed

| Before | Now |
|---|---|
| Four big number boxes, an info box, then two wide tables | One search, a Show row (Open, Nobody on it, Mine, Critical, Resolved, Everything, each with its count) and a Kind row (Checks, Errors, Sign-ins and reports) |
| Who is emailed behind a link in an info box | One line: who is emailed, the quiet hours, Change |
| A table row with a folded stack | One row per alert under its day, in the viewer's time zone, with a red or amber edge, who is on it and the email state; it opens to what was seen, what to do, when, who, the email, the key and the technical details, with Copy |
| I am on it; Mark resolved for errors and reports only | I am on it or Let go; Mark resolved on any alert; a note; mute emails for 1, 7 or 30 days, or unmute |
| Nothing to clear the 30 resolved ones shown | Delete a resolved alert (confirm dialog), tick many to take, resolve or delete together, page back through older ones; resolved alerts are deleted after 90 days |
| `alerts.read`, `alerts.manage` | plus `alerts.delete` (Delete resolved alerts), given to every Owner role |

A mute belongs to the problem: a new alert under the same key stays listed but is not emailed
until the mute ends. Migration `0096` adds `resolved_by`, `note`, `note_by`, `note_at` and
`muted_until` and an index on the key and the mute. Routes and rules:
[modules/alerts/README.md](../../modules/alerts/README.md).

```mermaid
flowchart LR
  A[Problem raised] --> B{Muted for this key?}
  B -- yes --> C[Listed, not emailed]
  B -- no --> D[Emailed once]
  C --> E[Alerts page]
  D --> E
  E --> F[I am on it / Let go]
  E --> G[Note]
  E --> H[Mute 1, 7 or 30 days]
  E --> I[Mark resolved]
  I --> J[Delete, or gone after 90 days]
```

## Then: the sidebar and the search list

The same evening the owner asked for a more compact sidebar and called the search box's list
"really ugly, no color, completely blend". The sidebar, open, is now as wide as its longest row,
between 12 and 16 rem, on a computer (on a phone too at first; see below). The search list had lost its look: the frame
script named it `ui-finder`, a class with no style, so it showed bare. It is `.ui-go` again, and
each row now has its section's icon on a coloured tile, the page's name over its section, the
selected row in its colour with Enter, suggestions when nothing was opened yet, and a line of key
hints on a computer. The stylesheet cap rose from 184 to 185 KiB for it (P819 to P822).

Then the owner asked to "completely wipe" the separate search page for something more compact.
It is gone: every Search (the sidebar's box, its folded icon, the phone bar's button, Ctrl K)
opens one pop-up over the page with the same coloured list, and the "Search everything" row went
with the page. `/search` now answers only the pop-up's JSON; an old link to it goes Home. Files'
"Search all of Files" opens the pop-up with its words (P821 to P825).

Last, the owner found an open alert bland and hard to read: "everything looks same", with small
gaps and parts out of line. Every fact stays, arranged better: What was seen and What to do are
two tinted panels (the alert's colour and blue); When, Who, Email and The alert are four lined-up
columns in one card, each headed in its own colour with the labels one width; the note's box and
button are one height; the actions are one bar, with Mark resolved solid, the mute choices one
track and Copy and Delete at its end (P826). The stylesheet cap rose to 188 KiB for both.

## The next morning: the account menu on a phone

On 2026-11-26 the owner found the account menu broken in the phone's drawer: once the drawer
followed its names it was too narrow, so the colour dots and the theme buttons ran past its edge
and Look and colours and the email were cut short. The drawer keeps its full width again (16 rem,
or the screen less 56 px), the colour dots wrap to a second line instead of leaving the menu, and
on a computer the menu is never narrower than 15 rem (P820). The same morning the owner found the
fitted sidebar "TOO thin": the portal's name was cramped and the address cut. The sidebar is now a
steady 17 rem, on a computer and as the phone's drawer (P819).

## The incident-management review (2026-11-26)

The owner sent a long review of the page as security incident management, asking to take its
hints without making the system complicated. What changed, with no new dependency:

- **Standard words.** I am on it became Assign to me, Nobody on it Unassigned, Mark resolved
  Resolve incident, What was seen Observed activity, What to do Recommended response, the alert's
  key the event fingerprint, Change Edit notification settings, Copy Copy alert details.
- **A row's head** reads severity · kind, the title, then Open or Resolved and who it is assigned
  to; once resolved, its reason and who resolved it.
- **One time zone.** Every time reads in the viewer's zone with its short name; a sign-in
  alert's "on 2026-11-26 at 05:18 UTC" is rewritten the same way. UTC stays only in the folded
  technical details.
- **Facts regrouped** as Timing, Ownership, Notifications (with the recipients, for whoever may
  manage) and Classification, under plain grey headings instead of one colour each.
- **A reason with each resolve.** Resolve incident opens a dialog: Legitimate activity verified,
  Unauthorized activity contained, False positive, Duplicate, Problem fixed, or Other with a few
  words, kept in the new `resolution` column (migration `0098`, one added column) and in the
  audit entry. Ticked alerts can be resolved with a reason too, except Other.
- **Recommended response** for an account-access alert is two short lists, if it was them and if
  it was not, with links to Users and the sign-in history, pages that exist; no new action.
- **The note** is a full-width box with a footer row (who sees it, Remove note, Save note); an
  empty note cannot be saved. Only one note per alert is kept, so there is no note history.
- **Mute** says what it does, Mute emails for this alert, and when muted, until when, with Unmute.
- **Bulk actions** sit in a bar at the foot that shows only once an alert is ticked, with the
  count and Clear selection, counted by the stylesheet with no script.
- **Settings** in one quiet row above the list: Email notifications, Quiet hours, Resolved alerts
  kept, Times shown in, Edit notification settings.

The refusals now say what happened: someone else is already assigned, or someone may have
resolved it already. Every action still goes through the alerts API's permission check and audit
entry, which were already there. P841-P847.

The same push took three portal-wide points from the owner's review of Supabase Settings: the
lone "Data >" row above a page inside a section is now one link back with its arrow pointing
back; the bell has a tooltip naming it and how many are unread (its spoken name, hover and count
were already there); and every page's figures read label first, then the number (P848, P849).

An hour later the owner found two things still wrong: the tick box kept touching the row's
coloured edge, and an open alert was too tall to see on one screen. The edge now runs down the
whole row, left of the box, with room between them (P850). An open alert lost about half its
height (P851): the four fact columns became one wrapping band of label and value, without the
status, severity, category, event type and channel the row's head already shows; the sign-in
steps are two short lines; and the note is one box beside its button, the author line kept, with
Remove note in the same form.

## Verified

- `modules/alerts` tests: let go, note, mute that survives a new alert and unmute, delete only
  when resolved and only with `alerts.delete`, bulk, paging, `emailing` hidden from a reader, the
  90-day clean-up; any open alert resolvable, keeping who did it.
- `modules/iam` test: the sign-in-moved key passes Email's message-key rule.
- `packages/screens` tests: the views and kinds, the actions and ticks for a manager only,
  Delete only on a resolved alert for whoever may delete, the empty states.
- 2026-11-26: `modules/alerts` tests for a resolve's reason (Other without words refused, an
  unknown reason refused, the words kept after the label, a bulk reason); `packages/screens` tests
  for the new words, the bar, the settings row, times in a zone with its name and the sign-in
  alert's steps and links; the client template's test resolving a reported sign-in with a reason
  through the page and reading it back from the API.
- `packages/screens` and the client template's tests: one palette outside the sidebar, opened
  by every Search, no link to a search page, `/search` sending a page request Home and answering
  the pop-up's JSON; Files' link opening the palette with its words.
- `pnpm verify` before the push. Not checked: the live portal on a phone (phone tests P810 to
  P826).
