---
title: "PostHog recordings played inside the portal"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# PostHog recordings played inside the portal

**Changed.** A visit opened on Recordings now plays in the page: Play the visit here, or a time in
its steps to start from that moment, with Pause, a seek bar, speeds from 1× to 8× and quiet moments
skipped. The rest of the visit loads while it plays.
**Why.** The owner's pick on 2026-11-27: "Yes, play them in the portal", which also approved the
player's dependency and the larger size budget.
**Before → after.** Before, every recording opened in PostHog. Now the frame fetches
`/ui/replay.js` (rrweb's Replayer, MIT, `@rrweb/replay` 2.2.2, 277 KiB, bundled alone) only on a
press. It reads the recording from `GET /api/analytics/web/:id/replay`, which asks PostHog for the
recording's blocks and then streams runs of up to 20 of them as PostHog sent them, so the key never
reaches the browser. Parts PostHog keeps gzipped are opened in the browser. The PostHog sign-in now
asks for `session_recording:read`, and a key needs Session recording Read; without it the page says
which to fix. The Worker's size budget goes from 1088 to 1216 KiB.
**Checked.** `pnpm verify`; phone tests P1051-P1054.
**Left.** The owner presses Reconnect on the PostHog connection (or adds Session recording Read to
the key); the relay is redeployed with the new scope. Batches 3 and 4: errors with events and
visitors, Cloudflare's own pages.
