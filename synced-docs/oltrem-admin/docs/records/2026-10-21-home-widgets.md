---
title: "Phase 3: Home widgets (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 4.4 and 12.5; this repository]
---

# Phase 3: Home widgets

> **In plain words.** Home now shows one card per part of the portal, each with one figure (how
> many people, how long ago the last backup, how many alerts are open), a line under it and a
> coloured state: OK, needs a look, or failing. A person sees only the cards of the parts they
> are allowed to see. A client's own part can add its card the same way.

## What changed, and why

| What | Why |
|---|---|
| **`home` on the module manifest** (`@oltrem/core-module`): a title, a capability, and a `read` that answers a figure, a line and a state; `defineModule` adds `GET /api/<module>/home` under that capability | Plan 4.4: the dashboard home with module widgets, the widgets coming from the modules |
| **A card for each kit module**: people, roles and places, providers, email in the last 24 hours, the last backup, deploys, open alerts, System health | Each module reads its own tables, so Home asks no module for more than its figure |
| **Home in `@oltrem/screens`** reads every mounted module's card in parallel, leaves out the ones the person may not read, and orders them as the row | Before, Home held one hard-coded line per kit module, read from each module's lists, and could not show a client's module |

## Decisions taken while building

- **The card is a route.** `defineModule` turns `home` into an ordinary `GET` route, so the
  session, the capability check and a refusal work as for any read, and a client's module needs
  nothing else for its card to appear.
- **A card the person may not read is left out**, where the old Home said "Not in your access":
  Home shows what the person can use.
- **Four states**, the same as the status pills: `ok`, `attention`, `failing`, `unknown`.
- **The module template gets no card yet.** Its capabilities are not declared until the kit's
  generator writes them, so a card would be refused to everyone.

## How it was verified

- `@oltrem/core-module`'s test: the route added under the capability and answering what `read`
  returns; a missing title, a capability the module does not declare and a second `GET /home`
  refused.
- The users module's test reads its card through the pipeline (five people on, one switched off)
  and is refused it without `users.read`; the alerts module's test reads three open, one critical.
- The template's screens test: every kit module's card on Home after the first run; a person
  whose exception denies `users.read` and allows `health.read` sees the health card and not the
  people card; the alerts card after an alert opens.
- `pnpm verify` with its twelve gates.

Not verified: Home in a browser or on a phone, and the cost of eight reads per Home in the sandbox.
