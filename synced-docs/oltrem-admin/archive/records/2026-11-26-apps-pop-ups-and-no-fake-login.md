---
title: "The Apps page in colour, every Connect a pop-up, no fake login"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [modules/connect/src/pages.tsx; modules/connect/src/module.ts; packages/core-ui/src/primitives/form.tsx; packages/core-ui/src/theme.css; modules/data/src/pages.tsx]
---

# The Apps page in colour, every Connect a pop-up, no fake login

**Changed.** Every Connect on the Apps page opens a pop-up over Apps: the eight website analytics
apps, each database and "Any other database". A refused key reopens the pop-up with the reason and
what was typed. Logos sit on their own colour in a large tile (`.ui-brand`), a connected app's
summary is a dot and a word, and the chat apps' steps are numbered (`.ui-steps`). Every key box is
`SecretInput` (dots, never `type="password"`), and buttons say "Continue with" an app and
"Reconnect", never "Sign in with".

**Why.** The owner's review ("color less", small logos, "stuck at Connect Plausible"), then a
browser's dangerous-site warning on a portal's PostHog Connect page, where a company logo, "Sign
in with PostHog" and a password box sat together, the shape of a fake login page.

**Before → after.** Connect opened a page of its own, with a password box beside the app's logo.
Now it is a pop-up on Apps; the analytics pop-ups' fields ride in the links answer (no query of
their own, the page stays at its pin); the old pages still answer a link to them.

**Checked.** The connect, data, core-ui and client template tests (pop-ups opened by their cards,
unique ids, a refused key reopening Apps, no password box, no "Sign in with"), then `pnpm verify`;
phone tests P940-P947. Not checked: the live portal, and whether the warning lifts, which waits on
Google's review of the domain.
