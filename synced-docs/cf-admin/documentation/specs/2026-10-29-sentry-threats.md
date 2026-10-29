---
title: "Sentry's own signals and the Threats part — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-29
verified_against: [code, infra]
owner: harshil
related_code:
- src/lib/sentry/probes.ts
- src/lib/sentry/threats.ts
- src/lib/sentry/threat-types.ts
- src/lib/sentry/issues.ts
- src/lib/sentry/speed.ts
- src/lib/sentry/client.ts
- src/lib/sentry/types.ts
- src/components/dashboard/sentry/Threats.tsx
- src/components/dashboard/sentry/Issues.tsx
- src/components/dashboard/sentry/Speed.tsx
- src/components/dashboard/sentry/format.ts
- src/pages/api/sentry/[part].ts
- src/lib/schemas/operations.ts
- src/lib/auth/surface-guards.ts
- migrations/0089_sentry_threats.sql
- test/sentry-threats.test.ts
related_docs:
- ../features/SENTRY.md
- 2026-10-28-sentry-page.md
- 2026-10-29-sentry-console-look.md
- ../records/reports/2026-10-29-sentry-threats.md
- ../security/SECURITY.md
tags: [sentry, cloudflare, security, threats, scanners, issues, design]
---

# Sentry's own signals and the Threats part — design

> **TL;DR (non-technical):** Robots scan every website for doors left open, such as a debug page
> (`/_profiler/phpinfo`) or a file of passwords (`/.env`). Our sites have none of those, so the
> robots get "not found", but until now nobody could see them. Sentry does not judge requests, so
> it never flagged them; Cloudflare, which stands in front of our sites, sees every one. A new part
> of the Sentry page, **Threats**, puts together what Cloudflare saw, what it blocked, what got as
> far as our code, what visitors' browsers refused, and what Sentry set aside as noise. The Issues
> part also shows Sentry's own judgement now: its priority, its own lists (for review, getting
> worse, back after a fix, new), and each issue's thread in Sentry, where an Admin can add a note.

What each part shows is in the [feature document](../features/SENTRY.md) (§4, §7 and §11); the
change record (private) says what shipped and how it was
checked.

## 1. The ask, and what was found

Harshil on 2026-10-29: "Sentry one can be more better I believe. Also can we have threads,
issues, trends and such that are by sentry itself. Recently I say api response time for someone
pinging GET /_profiler/phpinfo was 0ms. I believe it would result into 404's for main site however
this is actually a threat. Dont sentry flag such type request or any of our service providers? Can
we see that?"

What the request was, read through the Sentry connector (counts and request names only):

- `GET /_profiler/phpinfo` is a scanner looking for Symfony's debug profiler, which on a careless
  PHP site prints its whole configuration. cf-astro timed it 40 times in 30 days; the website
  added a slash (308) and then said not found. Nothing was exposed: the site has no such tool.
- cf-admin's project holds many more from the old website's traffic: `/.env` (120),
  `/.env.local` (110), `/.git/HEAD` (100) and others, most timed at 0 ms.
- **0 ms is not a speed.** A Cloudflare Worker's clock only moves while it waits on something (a
  fetch, the database, the cache); Cloudflare stops it otherwise, against timing attacks. A
  redirect or a "not found" answered without waiting reads 0 ms. The Speed part showed that as a
  time, which suggested the route was fast.
- The website already has a probe filter (`cf-astro/src/lib/probe-filter.ts`) that answers most
  scanners with a fast "not found" before any page is built, and Sentry never sees those. The
  ones Sentry timed got past it.

## 2. Who flags what

| Service | What it does with scanners | What the portal can read |
|---|---|---|
| Sentry | Judges no request: it records errors and timed requests. It does judge its own issues (priority, escalating, regressed, new, for review), and its inbound filters set aside errors from known web crawlers and junk browser security reports before counting them | its issue fields and views, its timed requests by name, its `event.type:csp` reports, and `stats_v2` with `outcome=filtered` by reason |
| Cloudflare | Sees every request before our code. Its HTTP request records hold each request's path, site and answer; its Security Events hold what its protections (Bot Fight Mode, managed rules, our own rules, the security level) blocked or challenged | its GraphQL Analytics for the zone, with the token and zone the Analytics page already reads |
| PostHog | Records visitors' sessions, not raw requests; scanners do not run its script | nothing useful for this |

So the answer to "don't Sentry or our providers flag this?" is: Sentry no, by design;
Cloudflare yes, and it was already blocking some; neither was visible in the portal.

## 3. Choices

| Choice | Picked | Rejected, and why |
|---|---|---|
| Where it lives | a new Sentry part, Threats, with its own key (Admin by default) | the Overview (already full), the Analytics page's Website traffic (it counts visitors; scanners are not) |
| How a scanner's request is named | one pure function, `probeKind`, in four kinds (secrets and settings files, debug and admin tools, other platforms, path tricks), used by Threats and Speed | Cloudflare's own "threat" counts alone (they count only what it blocked, not what it answered); sharing the website's filter (it lives in cf-astro, and its job differs: it answers a request, so it must never catch a real page; this one only names, so it can be wider) |
| What Cloudflare is asked | paths matching 31 fixed patterns, by address, site and answer, by country and by day; its Security Events by action and protection, by address, by country and by day | every request's path (thousands of rows to sort in the Worker, against the 10 ms CPU budget); IP addresses (personal data, and not needed to judge a scanner) |
| What Sentry is asked | timed requests matching 23 fixed wildcards; browser security reports by directive and blocked address; errors set aside by reason | Sentry's events with `user` or IPs (never read on this page) |
| Near misses | every row Cloudflare or Sentry answers is named again by `probeKind`, so a page whose path merely contains `.php` in a word is dropped | trusting the patterns alone |
| Sentry's views | Sentry's own search terms as states in the same row of options: `is:unresolved issue.priority:[high,medium]` (its default "Prioritized"), `is:for_review`, `is:escalating`, `is:regressed`, `is:new` | inventing our own rules for "getting worse" |
| "Threads" | each issue's thread in Sentry (its activities: what Sentry found, what was done, the notes), with a note box behind `#triage` | a chat of our own (a new table, against RULE #0.9) |
| A tag's spread | Sentry's own count across every event (`issues/{id}/tags/`, eleven fixed keys, five values each) | counting from the latest event only |
| Fixing the scanners | not done here: widening cf-astro's filter and a Cloudflare edge rule are offered to the owner (MAINTENANCE SE-13) | changing cf-astro or Cloudflare's rules from this thread (another repository and production security settings, the owner's call) |

## 4. Privacy and safety

- No IP address is ever asked of Cloudflare or Sentry; a country is its two letters.
- An issue's tags are asked by a fixed list that never includes `user`.
- A thread entry's `user` is read only for whether it is there: the page says "someone on the
  team", "Sentry" or "an app connected to Sentry", never who.
- A note is written to Sentry as the portal's token, and the audit log keeps its length, never its
  words. A note is never sent twice: after a 5xx or a dropped connection Sentry may have made it,
  so the client does not ask again (a 429 is still asked again, since it was not made).
- Text is masked without See full details, as on every other part.

## 5. Limits

- Cloudflare keeps both datasets 31 days and answers 30 at once, so the longest period is 30 days.
  Its docs disagree on whether Security Events answer on the Free plan; a refused dataset costs
  only its panels (MAINTENANCE SE-11).
- Seven questions, three at a time, kept ten minutes. Cloudflare's four count against its 300
  GraphQL questions in five minutes, far below.
- Sentry's tags, activities and comments calls were written from its API, not yet seen against the
  portal's token (MAINTENANCE SE-12).
