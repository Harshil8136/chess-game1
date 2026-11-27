---
title: "Reports: one pop-up, no blank room, a report for each kind of work"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [the commit "Reports: one pop-up, panes stacked, a focus on an area or action, latest log rows"]
---

# Reports: one pop-up, no blank room, a report for each kind of work

**Changed.** The Each day chart shows only its own card: the browser's grey title box that came
up with it is gone. Under the chart and What stands out, the panes stack down three columns on a
computer, each put in the shortest column, so a short pane no longer leaves blank room beside a
tall one; a phone keeps one column in the same order. A row of By area opens that area's own
report, and a row of Actions that action's: the figures, the chart, the hours, the people and the
lists counted only for it, under a **Showing** row (All areas, the area, the action) that leads
back. A refused row opens its action on Refused; a part of Who did the work shows that kind of work.
**Latest in the log** lists the last ten rows (who, what, when, refused or failed marked), each
opening its day in the Audit log, for people who may read the Audit log. The Audit log links on
the page carry the area or action.

**Why.** The owner: "we shouldnt have 2 popup of info at same time", "blank space can be better
managed, what other stats, redirection, logs view, get insight into that particular type stat".

**Before → after.** A card and a title box at once → the card only. Rows of panes as tall as the
tallest → stacks with no gaps. Lists that only opened the Audit log → each opens a report for that
kind of work, and the latest rows are on the page. No new table, setting or route: `GET /activity`
takes `area` or `action` and reads people and hours from the log through its action index; the
log rows ask for `audit.read`. CSS columns stay unused (the 2026-11-24 rule).

**Checked.** `pnpm verify`; tests for the stacks' order and columns, the chart without titles, the
narrowed counts, people, hours and log rows on real D1, the log refused without `audit.read`, bad
values refused, the page's focus, trail and links. Screenshots at 390 px and 1440 px from a local
render. Phone tests P1070-P1075. Not checked: a real phone.
