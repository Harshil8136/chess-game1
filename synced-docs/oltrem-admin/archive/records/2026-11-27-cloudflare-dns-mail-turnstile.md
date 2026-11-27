---
title: "Cloudflare's DNS, routed mail and Turnstile on the Website board"
status: record
owner: vendor
last_verified: 2026-11-27
sources: [this commit]
---

# Cloudflare's DNS, routed mail and Turnstile on the Website board

**Changed.** The domain's part of the Website board gains three parts, each shown only when there
is something in it and each opening Cloudflare's own page: DNS lookups (all, the names looked up
most, kinds of record, answers in words), mail through Email Routing (what happened to each
message, and how many passed SPF, DKIM and DMARC), and Turnstile (checks shown and passed on the
domain and its subdomains, other hosts on the account left out). The board's "In plain words"
gains the domain's sentences: requests and the cache's share, failures at the website's server,
what the protections did, how many Turnstile checks passed.
**Why.** The owner: "Cloudflare have ton more data thats extractable and presentable"; the last of
three batches.
**Before → after.** Four calls for the domain → six: one more zone question (DNS and mail) and one
account question (Turnstile), side by side with the others, each skipped when the report's share
of calls runs out. Turnstile reaches back a week at most, the widest one question may span on the
free plan; a token without Account Analytics Read leaves it out quietly.
**Checked.** `pnpm verify`; every field, its retention (31 days for DNS and mail, a week and an
hour for one Turnstile question) and Cloudflare's own page links read live on a free-plan domain
and account first; phone tests P1031-P1033.
**Left.** Nothing of the three batches.
