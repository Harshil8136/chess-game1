---
title: "Keeping data in the browser: what to cache where, and how updates still arrive at once"
status: proposed
owner: vendor
last_verified: 2026-11-01
sources: [packages/core-http/src/app.ts; packages/screens/src/screens.tsx; packages/screens/src/client/frame.js; modules/iam/src/sessions.ts; Cloudflare Workers limits (free plan); MDN Web Storage, HTTP caching, Clear-Site-Data, BroadcastChannel]
---

# Keeping data in the browser

> **In plain words.** The owner asked whether data that rarely changes (figures, lists, names)
> could be kept in the person's browser, so the portal does not rebuild it on every visit, while
> anything that must show at once (a new email on Sent, an approval waiting) still does. Yes,
> with one rule: **the browser may remember, but the server always decides.** The browser keeps
> a copy and asks "has anything changed since version N?"; the server answers "no" in a few
> microseconds without building the page, or sends the new copy. Permissions, keys and other
> people's private data are never trusted from the browser.

## Where the CPU actually goes (2026-11-01)

The production chart the owner shared (CPU P50 34 ms, P99 47 ms, Oct 31 to Nov 1) is mostly the
**five-minute background job**, not people's page views: a portal with few visitors runs that job
288 times a day, so it decides the median. Browser caching cannot help the job; the fix for it is
on the server (the CPU budget work, record of 2026-11-01). Browser caching helps the other half:
each page view today rebuilds its HTML and calls its own API several times (about 9 to 18 ms
measured locally, profiler included).

## The options, best first

| # | Where the copy lives | What it is good for | What it must never hold | Cost |
|---|---|---|---|---|
| 1 | **The Worker's own memory** (per isolate) | settings, the permission index, module lists, rendered icons: anything identical for every request | nothing personal across tenants | none; lost when the isolate restarts |
| 2 | **HTTP validation: ETag and 304** | every page and every read: the browser sends `If-None-Match`, the server compares one version number and answers 304 without rendering | — | one small read of a version stamp |
| 3 | **The browser's `sessionStorage`** (one tab, gone when it closes) | the last copy of a page's data or HTML fragment, shown at once while the 304 check runs | keys, tokens, other people's data beyond what that page already showed | up to about 5 MB a site |
| 4 | **The browser's `localStorage`** (stays after closing) | non-personal reference data and preferences: module names, setting labels, the sidebar state, a chosen tab, chart ranges | anything personal or secret: a shared office computer keeps it | up to about 5 MB a site, synchronous |
| 5 | **A signed cookie** (the "token in the browser") | a small session snapshot: who, which company, the policy version, signed by the Worker | the permission decision itself, any key | sent with every request (keep it under 1 KB); HMAC check each time |
| 6 | **Cloudflare's cache** (Cache API at the edge) | the same answer for everyone: public pages, the stylesheet and script (already cached for a year by version) | anything per person | per data centre |

IndexedDB is the larger, asynchronous cousin of 3 and 4; it is worth it only for offline work or
big tables, which the portal does not need yet.

## The recommended default: versioned reads

One approach for every module, so a new module gets it for free:

1. **A change stamp per area.** Each module area (email sent, users, settings, …) has a number
   that goes up on every write. The kit already sees every write (the audit log and the outbox),
   so the stamp is bumped in the same place, inside the same D1 batch as the write: a row in
   D1, never a KV key (see the budgets below). It is read once a request and held in the
   Worker's memory for a few seconds.
2. **Every read answers with an ETag** built from the stamps it depends on and the person's
   policy version. A repeat visit sends `If-None-Match`; when nothing changed the Worker answers
   `304 Not Modified` before rendering anything. This is where the CPU is saved, and it needs no
   browser storage at all.
3. **The frame script keeps the last copy in `sessionStorage`**, keyed by person, company, kit
   version and address. Moving between tabs shows the copy at once and checks in the background;
   a 304 keeps it, a 200 replaces it. Per tab and gone at close, so nothing outlives the visit.
4. **`localStorage` only for what is not personal**: labels, preferences, the sidebar. It carries
   the kit version in its key, so an upgrade starts clean.
5. **Signing out clears everything**: the sign-out answer sends `Clear-Site-Data: "storage"`, and
   the frame also clears its own keys, so the next person on that computer sees nothing.

### Figures and statistics

Figures that are expensive to count (Analytics, email totals, the Home tiles) are counted once on
the server, kept with an "as of" time, and shown from the browser's copy with that time beside
them ("as of 2 minutes ago"). A Refresh button asks for a fresh count. Nothing is shown without
its age, so a stale number never looks live.

## Updates that must arrive at once

Caching must not delay what people wait for (a sent email, an approval, an alert). Three ways,
cheapest first:

| Way | How it works | When to use |
|---|---|---|
| **Ask on return** | when the tab comes back into view or the network returns, the frame checks the stamps once (`visibilitychange`, `online`) | always on; costs one tiny request |
| **Light polling of the stamps** | one small `GET /api/changes?since=…` every few seconds while something is moving (an email in its Undo window, a backup running), slowing to a minute when idle, stopping in a hidden tab; one tab polls and tells the others through `BroadcastChannel` | the default for "instant"; Sent already polls this way, by itself |
| **Push** | a WebSocket to a Durable Object that the Worker wakes on a write; the browser updates the moment it happens | only if polling proves too slow or too costly: it adds a resource to every client (owner's yes, R-09) |

The answer to `/api/changes` is a handful of numbers, served from the Worker's memory: far
cheaper than any page.

## The signed cookie, honestly

A signed cookie can carry the session snapshot (who, the company, the policy version, the sign-in
time) so the Worker skips one KV read per request. Two facts decide whether it is worth it:

- A KV read is waiting time, not CPU time; the free plan counts CPU. Checking the signature
  (HMAC-SHA-256 with Web Crypto) costs a little CPU on every request.
- Whatever the cookie says, the Worker still checks the current policy version and refuses a
  cookie older than it (fail closed, R-10), so a removed permission takes effect on the next
  request.

So it is built only if the CPU profile shows the session read as a real cost; the CPU budget work
measures it. It never holds the permission decision itself, a key, or anything another person
should not see.

## What stays on the server, always

- **Every permission check.** A copy in the browser only decides what to show first; the server
  decides what happens.
- **Keys, tokens and secrets.** Never in browser storage, never in a cookie the page can read.
- **Other people's data beyond the page in front of you.** No prefetching of records a person has
  not opened.

## The free plan's budgets decide the design

| Limit (free plan, per day unless said) | What it rules out | What the design uses instead |
|---|---|---|
| **10 ms CPU** per request and per cron run | rebuilding a page that has not changed; heavy signature checks on every request | a 304 answered from one stamp read; the Worker's memory |
| **1,000 KV writes** | a KV key bumped on every change (a busy hour alone would spend it); a session rewritten on every request | stamps as D1 rows (100,000 writes a day), KV written only when something really changed: the settings snapshot on a save, a session on a new device or a permission change, the door at most hourly |
| **100,000 KV reads** | a KV read per request for each stamp | one stamps read per request at most, then memory for a few seconds |
| **100,000 D1 rows written, 5,000,000 rows read** | a stamp table that is scanned | one row per company and area, read by its key |
| **50 D1 queries** per invocation | a page that asks once per area | all of a page's stamps in one query |

The browser's own storage costs the Worker nothing: every copy kept there is a request, a KV read
and a render that never happen. That is why the design leans on it for what is safe to keep there.

## Order of work

1. The server side first: the Worker's memory and the five-minute job (the CPU budget work).
2. Change stamps and ETag/304 for every read: the largest saving per page view.
3. The frame's `sessionStorage` copy and the stamps check on tab return.
4. `/api/changes` light polling shared across tabs, replacing each page's own timer.
5. Measure; only then decide on the signed cookie and on push.

Each step is measured with the local CPU profile before and after, and a test holds what it saves.
