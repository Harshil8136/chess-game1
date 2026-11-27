---
title: "Cloudflare's own figures for the website's domain"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# Cloudflare's own figures for the website's domain

**Changed.** A Cloudflare connection now reads the website's domain as well as, or instead of,
Web Analytics. The token gets two more read permissions (Zone Read, Zone Analytics Read), and the
portal finds the domain itself when the token reads only one. The Website board gains a part
"At Cloudflare": every request Cloudflare answered, people and bots alike, with data served, the
cache's share, threats stopped, HTTPS and distinct visitors against the window before and each
day; how Cloudflare answered, with the pages that failed; its cache; subdomains and pages;
countries with their threats; content types and HTTP and TLS versions; then Security (what each
protection did, the pages and countries it acted on most, the latest events with their rule) and
Bots and addresses (verified bots by kind, what Cloudflare knows of the addresses). No visitor's
address or browser string is asked for. Each part opens Cloudflare's own page. With the domain
alone, the board's figures come from it too.
**Why.** The owner: "Cloudflare have ton more data thats extractable and presentable".
**Before → after.** Web Analytics' page loads only → the domain's year of days, 30 days in
detail and its security, in four calls (the last two side by side, each skipped when the report's
share of calls runs out).
**Checked.** `pnpm verify`; every GraphQL field and its free-plan reach (365 days daily, 30 days
in detail) read on a live free-plan domain first; `GET /zones` needs Zone Read (Cloudflare's API
schema); the security question (actions by protection, `firewallEventsAdaptive` without
addresses, verified bots, `ipClassMap`) read on the same domain, 31 days kept; phone tests
P1025-P1030.
**Left.** DNS, Email Routing and Turnstile (batch 3).
