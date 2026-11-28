---
title: "Cloudflare's security events and Workers in an app's full view"
status: record
owner: vendor
last_verified: 2026-11-28
sources: [this commit]
---

# Cloudflare's security events and Workers in an app's full view

**Changed.** A Cloudflare app's full view on Reports gains two pages beside Overview.
**Security**: what Cloudflare's security stopped in the last days (30 at most), the count stopped
by what was done and by host, and the latest 100 events: the page asked for, what happened, when,
from which country, and on a wide screen the protection, the rule, the method and the answer.
**Workers**: each Worker of the account, the busiest first, with its requests against the same days
before, median CPU, slowest 1% CPU, median time, errors and calls out; each opens its metrics in
Cloudflare.
**Why.** The owner's pick on 2026-11-28 ("Security events and Workers"), the fourth and last batch
toward a PostHog and Cloudflare view on the level of the first client's own portal, taken as a
design only (R-03).
**Before → after.** Before, the board showed ten security events and nothing about Workers. Now
`GET /api/analytics/web/:id/list?of=security|workers` asks one GraphQL question, read fresh on
each open. The free plan keeps no grouped security events, so the counts come from the domain's
requests (`httpRequestsAdaptiveGroups`); Workers come from the account's
`workersInvocationsAdaptive` and need the account ID and Account Analytics Read. No visitor's
address, browser string or a rule's id is asked for.
**Checked.** `pnpm verify`; both questions run read-only on the client's account (18 events, one
Worker); phone tests P1076-P1079.
**Left.** Nothing in this set of batches.
