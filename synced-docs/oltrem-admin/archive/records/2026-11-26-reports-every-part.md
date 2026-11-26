---
title: "Reports: a tab for money, customers and work, and a section from every part"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commit "Reports: a tab for money, customers and work, and a section from every part"; the owner's message of 26 November, 06:20 UTC]
---

# Reports: a tab for money, customers and work, and a section from every part

**Changed.** The Reports page has tabs in a sideways row: Activity, Website, Money, Customers and
Work. Each part of the portal brings its own section, the way it brings its hits to search:
invoices, quotes and expenses under Money; customers and form answers under Customers; tasks and
bookings under Work. A section shows a few figures against the period before, one line a day and
a list or two whose rows open their pages, counted only where the person may see. **Why.** The
owner: integrations keep landing and "data collecting is endless"; batch 1 of the plan that
followed.

**Before → after.**

| Before | After |
|---|---|
| One page: the audit log's activity, then the website at its foot | Tabs; the activity as before, the website on its own tab, a tab for each kind of section |
| Reports counted only the audit log | Each part counts its own records through `report` (`@oltrem/core-module`, its README), with no new table |

**Checked.** `pnpm verify`, 14 gates passed. Each part's section read through its real route on
D1; the route's validation and trimming; `GET /parts`; the page's tabs, only the open tab's
sections asked, money in its currency, a refused section left out. Phone tests P970-P974. Not
checked: a real phone, a client's live figures.
