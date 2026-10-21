---
title: "The people and access screens (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the owner's request of 2026-10-21 15:32; this repository]
---

# The people and access screens

> **In plain words.** The portal's screens can now change things, not only show them. An Owner
> can invite someone with a role at a place, withdraw an invitation, give a person a role or end
> one, switch an account off with a reason or back on, make and edit a role by ticking what it
> may do, and add a place such as a site or a team. Every change goes through the same checks as
> the API, so a screen can never do more than the person may.

The owner asked on 2026-10-21 at 15:32 to start the next phases; the thread put the core parts
of version 1 that were still missing first, starting with the screens that change things.

## What changed

| Part | Change |
|---|---|
| `@oltrem/core-ui` | `ChoiceChips`: a choice of one as native radios inside chips in the sideways row, so a role or a place is never picked from a dropdown alone (R-12) |
| `@oltrem/screens` | `src/forms.tsx`: the invitation form and the invitations waiting, the person page (roles held, give a role, the account switch), the role form with its capabilities grouped by module, the place form; `screens.tsx` registers the pages and the form routes; the people and role tables link to their records |
| The client template | its screens test runs the whole set of changes as the Owner |

How a form travels:

```mermaid
flowchart LR
  F["a form on a page, posted with no script"] --> R["the screen's route: same-origin check"]
  R --> A["the portal's API, called inside the request as the signed-in person"]
  A -- "allowed" --> D["303 back to the page with ?done=key"] --> P["the page says what was done, in fixed words"]
  A -- "refused" --> E["the page again, with the API's reason and status"]
```

## Decisions

- **The API decides, the screen asks.** No rule is repeated in a screen: the grant rules, the
  fresh sign-in, the second person for an Owner, the reason a switch needs. A refusal is shown
  with the API's own words.
- **Fixed words after a change.** The redirect carries a key such as `granted`, never an address
  or a name, so nothing personal sits in the address bar or the browser's history. The only thing
  shown from a write is the invitation link, rendered once and never put in an address.
- **A new role sits below every role there is.** Its order is the lowest one plus ten, so the
  person making it outranks it and can give it; changing the order comes with the role editor's
  later work.
- **Invitations live with the people.** The waiting ones and the form are on the People page; the
  Access page keeps the company, roles, groups and places.

## Not done here

- Groups, overrides with their three states (inherit, allow, deny), reviews, requests,
  approvals, the Vendor's access, profiles.
- Seen in a browser or on a phone: the owner's test.

## How it was verified

- `npm run verify`: the twelve gates pass.
- The template's screens test, inside the Workers runtime: the Owner makes a role with two
  capabilities and sees them ticked, adds a place, sees an invitation without a role refused with
  422, invites someone who accepts, ends and gives their role again, switches the account off
  (the person then has no account) and on, withdraws a second invitation, and a form posted from
  another site is refused with 403.
- `@oltrem/core-ui`'s test of `ChoiceChips`: the fieldset and legend, one radio per option, the
  given one chosen, `required` on each.
