---
title: "Staying current with providers without code for each new feature"
status: proposed
owner: vendor
last_verified: 2026-11-28
sources: [the owner's question of 2026-11-28; archive/proposals/2026-11-28-positioning.md; modules/providers/src/adapters/http.ts]
---

# Staying current with providers

> **In plain words.** The owner asked how one developer keeps the portal current when PostHog,
> Supabase and the others ship new features every week. The answer: Oltrem stops copying their
> dashboards, does only the jobs no single provider does, touches a small, stable part of each
> API, and sends people to the provider's own page for everything else.

## The rule: watch, link and describe; never copy

No portal can grow screens for features it has never seen. A copy of a provider's dashboard is
always behind and always needs code. So:

| Part | What Oltrem does | Code per new provider feature |
|---|---|---|
| Watching | the hourly check of each connection, alerts, Needs you, the fix in one press | none: a check asks "do you answer" and one number |
| Linking | "Open in PostHog" (or Supabase, Cloudflare) on every card and list, to that page in the app | none: new features show up there by themselves |
| Pinning | a page pinned to the sidebar by an Owner, so an app's board is one press away | none |
| Asking | one query box per app: PostHog's SQL (HogQL), Supabase's SQL, Cloudflare's GraphQL | none: a new table or event is reachable the day it ships |
| Describing | each provider as data (its fields, steps, checks), one definition the fleet pushes to every portal | one data edit, not a feature |
| Warning | every answer's `Deprecation` and `Sunset` headers kept (`retiringOf`), so a check warns before an API the kit calls goes away | none |

## What this means for the cut list

The positioning's cut list (the PostHog and Cloudflare boards, the recordings player, the
database editor) is the same decision: those are copies, and copies are what need code each time
a provider moves. They stay, off by default, and nothing new is added to them.

## Next steps, small

1. Make "Open in <app>" a field of each provider's definition (its dashboard address with the
   project or site filled in), so every card gets it with no page code.
2. A query box for each app that has a query language, saved queries pinnable to the sidebar.
3. Needs you shows a row when a provider's answer says an API is retiring.

None is built yet; each waits for the owner's word.
