---
title: "Reports, Money: from visit to paid"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commit "Reports, Money: days to get paid, win rate, each currency, and from visit to paid"]
---

# Reports, Money: from visit to paid

**Changed.** The Money tab opens with one funnel across apps: the website's visitors, then form
answers, quotes sent, quotes accepted and invoices paid. Each step shows its count, how it moved
against the period before and the share of the step before that carried on. A part declares the
steps it counts (`steps` in its `report`); a step the person may not see is left out. **Why.**
Batch 3 of the Reports plan of 2026-11-26: no single app holds more than one step.

**Before → after.** Each part's numbers on their own → one line from a visit to a payment.

**Checked.** `pnpm verify`; the core-module test (steps passed through, an undeclared one dropped,
an unknown one refused), the forms, quotes and invoices tests read their steps through the real
route, the page test draws the funnel and leaves it out with one step. Phone tests P979-P980.
Not checked: a real phone.
