---
title: "@oltrem/screens: Using it"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/screens/src; split from packages/screens/README.md]
---

# @oltrem/screens: Using it

> Part of [the @oltrem/screens README](../README.md).

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

`createScreens({ frames })` draws one of the kit's own pages inside a module's frame, by its
address: the function takes the page as drawn and the page's API and returns what the frame shows.
The client template hands `{ '/email': emailFrame }` from `@oltrem/email/pages`, so the delivery log
sits beside Email's folders like every other Email page.

`pinned()` returns the `settings.pinned` lines: those pages show under Home for whoever is shown
their section, and an Owner or the Vendor gets a pin beside each title (`/do/pin`). A page's
`name` names it there; else its title. `createScreens({ brand, files })` give the portal its own name and icon: `brand()` returns the
`settings.portal_name`, `settings.portal_mark` and `settings.portal_tagline` (`line`) values (the
template's reads them from the settings snapshot), and `files(env)` the portal's one bucket, where a
picture icon is kept under `ui/mark/`. Without `brand` the name is `portal` and the tile its
initials; without `files` a picture cannot be the icon. The name and icon show in the sidebar, on a
phone's top bar, on the sign-in and customer pages, and as the tab's icon: the picture itself, or
the initials or icon drawn on the look's colours as a small SVG written into the page (`faviconOf`,
`src/marks.tsx`), so no page asks for `/favicon.ico`.
