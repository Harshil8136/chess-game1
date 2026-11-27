---
title: "PostHog's errors, events and visitors in an app's full view"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# PostHog's errors, events and visitors in an app's full view

**Changed.** A PostHog app's full view on Reports gains three pages beside Recordings. **Errors**:
the errors visitors met, the most frequent first, with how often, in how many visits, on which page,
when first and last met; each opens its issue in PostHog, and Watch opens the latest visit that met
it on Recordings. **Events**: everything the site sent, PostHog's own in words, with how many times,
how many visitors and the move against the same days before. **Visitors**: everyone who opened a
page, with how many are new and returning, and the latest 50 as a sentence each (on what, from
where, which website sent them), first and last seen, visits, pages and their latest visit.
**Why.** The owner: PostHog "does close to nothing"; the third of four batches toward a PostHog and
Cloudflare view on the level of the first client's own portal, taken as a design only (R-03).
**Before → after.** Before, the board showed five errors and no events or visitors list. Now
`GET /api/analytics/web/:id/list?of=` asks one HogQL question (two for visitors), read fresh on each
open, no cache. Nothing that names a person is asked for: no address, email, browser string or id
beyond the latest visit's, which opens on Recordings.
**Checked.** `pnpm verify`; the four questions run read-only on the owner's PostHog project; phone
tests P1055-P1058.
**Left.** Batch 4: Cloudflare's own pages.
