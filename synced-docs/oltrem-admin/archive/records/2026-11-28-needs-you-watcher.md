---
title: "Needs you becomes a watcher: every problem one row, its fix one press"
status: record
owner: vendor
last_verified: 2026-11-28
sources: [this commit; archive/proposals/2026-11-28-positioning.md]
---

# Needs you becomes a watcher

**Changed.** Home's Needs you lists each open alert as its own row with what to do and a button:
the alert's fix (Check again, Back up now) or Assign to me. Within the hour, every connection whose last
check failed, whoever checked it, raises one alert (emailed once), closed when it answers again. **Why.** The positioning's first pick: the portal earns its price by watching every service
and fixing in one press, which no provider's own dashboard does.

**Before → after.**

| | Before | After |
|---|---|---|
| Alerts on Home | one row: "2 open alerts nobody has taken" | one row each, with its fix |
| A connection stops working | seen only on Integrations or Checkup (analytics: a row on Home) | an alert, an email, a row with Check again; closes itself |
| A late backup | a "backup.fresh is failing" alert to open | the same alert with Back up now |

Parts: `TodoItem.action`, `HealthCheck.fix` (core-module); `/do/needs-you` (screens); `fix` on
`raise` and migration `0104` (alerts); `watch` run by the hourly checkup, `connectionAlert`, the
registry's `checked` (providers). Apps' own Needs you row went: the alert row replaces it.

**Checked.** `pnpm verify` (summary in the commit); phone tests P1080-P1083. Not checked on a live
portal yet.
