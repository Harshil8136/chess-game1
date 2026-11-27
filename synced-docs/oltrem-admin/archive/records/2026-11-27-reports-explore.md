---
title: "Reports: charts you can explore"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [the commit "Reports: charts you can explore"]
---

# Reports: charts you can explore

**Changed.** Every day-by-day chart on Reports can be read and moved through. A finger or the mouse
on it shows a line on that day with a card beside it: the day, its count, the same day of the
period before with the change, and what happened that day. A tap keeps the card, with **Open this
day** (the Audit log for that day, on Activity) and **Zoom to the week around it**. A finger slid
sideways reads day after day; a mouse dragged across days zooms to them; the arrow keys, Home and
End step through the days once the chart has focus. The dashed line's key hides or shows it. The
five figures above the Activity chart pick what it draws, the picked one underlined. **Earlier**
and **Later** beside the periods move the same number of days back or on, within the last year. A
tap on a week-of-hours cell reads it, since a phone has no hover. On a computer the chart takes two
thirds of the row with What stands out beside it. The chart's fill fades in its own colour.

**Why.** The owner: "can we make it more interactive, like access graph, navigate it", "improve
organization and visual effects". Patterns taken as designs: figures that switch the graph
(Plausible), a readout against the period before (Stripe), drag to zoom (Grafana), tap to read for
phones.

**Before → after.** A still picture, a period chosen only from fixed chips, a separate metric row →
a chart to read day by day, any day opened in the Audit log, zoom by drag or by link, a period
stepped back and on. No new table, route or setting; the page sends the days it already had, and
the browser script does the rest. The stylesheet limit rose from 204 to 208 KiB with the owner's
yes of 2026-11-27.

**Checked.** `pnpm verify`; the browser script's tests for the mouse, the keys, a drag, a tap, a
finger scrub, the key and a heat cell; the chart's data and focus; the page's figures, Earlier and
Later at the year's edge. Screenshots at 390 px and on a computer from a local render. Phone tests
P1040-P1046. Not checked: a real phone, a screen reader.
