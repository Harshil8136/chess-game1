---
title: "Reports: an Email tab, from Email and Campaigns"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commit "Reports: an Email tab, with Email's and Campaigns' sections"; Oltrem Mail's commit of the same name]
---

# Reports: an Email tab, from Email and Campaigns

**Changed.** Reports has an Email tab. Email's section: sent and failed against the period
before and one line a day; once delivery reports come in, delivered, the share opened, bounced
and refused; each integration's messages and the addresses that bounce most. Campaigns' section:
the people mailed, the share that opened and clicked, the unsubscribes, and each campaign, at the
places the person may read. **Why.** The owner: "data collecting is endless"; batch 4 of the plan.

**Before → after.** Email's figures lived only on its own pages → on Reports beside money and
work, against the period before, from the rows Mail already keeps (no new table).

**Checked.** `pnpm verify` in Oltrem Mail and here; each section through its real route on D1,
another company's mail not counted, a place the person cannot read left out. Phone tests
P981-P983. Not checked: a real phone, a provider's live reports.
