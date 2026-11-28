---
title: "Pages pinned to the sidebar, and connect buttons in the app's colours"
status: record
owner: vendor
last_verified: 2026-11-28
sources: [this commit; archive/proposals/2026-11-28-staying-current.md]
---

# Sidebar pins and brand buttons

**Changed.** An Owner or the Vendor pins any page to the sidebar with the pin beside its title;
it shows under Home for everyone shown its section, an app's board by the app's name. Connect
buttons get one shared look, `BrandButton`: 44 px, the app's mark on a white tile, "Continue with
<app>", the brand as a soft tint and glow, Google's own drawn to Google's rules. Data's Supabase and
Airtable use it now, the key form behind "Use a key instead". **Why.** The owner: important pages
sat a page inside a page inside a page, and "Connect to PostHog" looked off.

**Before → after.**

| | Before | After |
|---|---|---|
| An app's board | Reports, Website, the app's chip | one press from the sidebar, once pinned |
| A connect button | the portal's plain primary button | the app's colours and mark |
| Sign in or key (Data) | both on one page | the sign-in alone; the key form its own view |

Parts: `PINNED_SETTING` (core-config), `pinned` option, `pinsFrom`, `HeadPin` and `/do/pin`
(screens), `name` on a page's result (core-module, analytics), `BrandButton` (core-ui).
The Apps page takes `BrandButton` in its own remake.

**Checked.** `pnpm verify` (summary in the commit); phone tests P1084-P1086. Not checked on a live
portal yet.
