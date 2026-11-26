---
title: "Reports, Money: days to get paid, the quote win rate, each currency apart"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commit "Reports, Money: days to get paid, the quote win rate, each currency apart"]
---

# Reports, Money: days to get paid, the quote win rate, each currency apart

**Changed.** The Invoices section on Reports adds the days from sent to paid on average, and the
Quotes section the win rate (of the quotes customers answered, the share accepted). Once a second
currency is used, each section lists every currency apart with what was invoiced, paid or
accepted in it; the figures stay in the main currency. A figure can be a share (`67%`) or a
number of days (`4.5 days`). **Why.** Batch 2 of the Reports plan of 2026-11-26.

**Before → after.** Money in the main currency only, no speed or win rate → both, with each
currency kept apart.

**Checked.** `pnpm verify`; the invoices and quotes tests read the new figures and lists through
the real route on D1; the page tests format a share and days. Phone tests P976-P978. Not checked:
a real phone.
