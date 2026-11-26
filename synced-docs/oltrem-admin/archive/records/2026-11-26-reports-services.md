---
title: "Reports: a Services tab"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [the commit "Reports: a Services tab, storage, webhooks and chat apps, automations, connections"]
---

# Reports: a Services tab

**Changed.** Reports has a Services tab with four sections: Storage (files and bytes added against
the period before, what the portal keeps against its room, each storage connection), Webhooks and
chat apps (went through, failed, the share on the first try, each webhook with its chat app),
Automations (went through, failed, skipped, each automation) and Connections (each one's last
check, the failing first, and the allowance used where a provider tells it). **Why.** The owner:
"data collecting is endless"; batch 5 of the plan.

**Before → after.** These lived on their own pages only → side by side on Reports, read from the
rows each module already keeps (no new table). Deliveries and runs are kept 30 days, so 90 days
says so; storage room and connections are today's state, with no period before.

**Checked.** `pnpm verify`; each section through its real route on D1 (a place-only holder
refused, the 30-day note, the room against the setting); the page (sizes, words, the note).
Phone tests P984-P987. Not checked: a real phone, a client's live figures.
