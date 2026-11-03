---
title: "Oltrem Mail: every step still done by hand, and what runs by itself (2026-11-03)"
status: living
owner: vendor
last_verified: 2026-11-03
sources: [the owner's ask of 2026-11-03 05:29; Cloudflare's Email Service documentation (Email Sending onboarding, the Email Sending API, Email Routing addresses), read 2026-11-03; this repository's modules as built on 2026-11-03; the kit's start page, dev script and deploy as built on 2026-11-03]
---

# Oltrem Mail: every step still done by hand, and what runs by itself

> **In plain words.** The owner asked that setting up mail be clicks, checks that run by
> themselves, verification and fallbacks, with as little work by hand as possible. This page goes
> through every step of Oltrem Mail, from trying it on a computer to a live portal, and says which
> ones now run by themselves, which still need a person, and why that person cannot be skipped.
> When a step can be automated later, the page says what would have to change first.

## 1. What runs by itself

| Step | How it runs now | Fallback when it cannot |
|---|---|---|
| Put Mail in a portal on a computer | one tick, **With Oltrem Mail**, on the kit start page's Try it here, then Start; or `npm run dev -- --mail` | the start says why in words and the portal starts as it was |
| Keep the kit up to date with Mail ticked in | the start takes Mail out, brings the newer kit in, and puts Mail back | if anything else is changed too, the update waits, as before, and says so |
| Try arriving mail on a computer | **Send a test** on Forwarding and Mailboxes: forwarded, kept or refused, in words | none needed: nothing leaves the computer |
| Forwarding on a computer | asks Cloudflare nothing: every alias counts as confirmed | none needed |
| Put Mail in a client's portal | the first deploy asks once ("Should this portal have Oltrem Mail?"); a new key's form comes with DNS Edit chosen and names the two Email Routing rights to add | the Mail setup page checks the key's rights and names the one missing |
| A provider (Brevo, Resend and the others) | the key names its provider; the domain is added there; DNS records are written on Cloudflare; the domain is checked every 5 minutes in its first hour, hourly in its first day, then daily; delivery reports registered; DMARC written only when none covers the domain | everyday mail moves to the backup provider once the main one is down to its last tenth; a domain not passing in a day warns on System health |
| Email Routing on the domain | turned on through the API | on a 403, the one dashboard tap is shown |
| Staff and forwarding addresses | Cloudflare is asked to email each its link; the portal reads the answer back every 5 minutes for a day, then daily; the aliases' rules are made once a link is pressed | the page lists who has not pressed yet |
| The Cloudflare route's test | sent on a press; **new on 2026-11-03:** a test refused only because the domain is not onboarded is sent again by itself every 5 minutes for a day, and the route turns ready once Cloudflare takes it | after a day it waits for a press, so a domain left alone is not tried for ever |
| Moving from ImprovMX | the aliases read in one press with the account's key (never kept), or pasted | the key refused or a page not read is named; the paste still works |

## 2. What still needs a person, and why

| Step | Who | Why it cannot run by itself |
|---|---|---|
| Press Cloudflare's link in the email it sends to each new staff or forwarding address | each person, once per address | Cloudflare's own rule: an address receives forwarded mail only after its owner proves it is theirs. No API marks an address verified, and none should: it is what stops a portal forwarding mail to a stranger |
| Onboard the domain for Email Sending (the Cloudflare route only) | the Owner, once per domain | Cloudflare has no API for it: checked again on 2026-11-03, the Email Sending API covers sending, suppressions and SMTP, not onboarding. The step's line now links straight to the dashboard page, and the test runs again by itself (section 1) |
| Make the provider's account and copy its key | the Owner, once | no provider lets a stranger open an account through an API; the key is the person's consent to the portal using it |
| Make the portal's Cloudflare key, or add Mail's rights to an old one | the Owner, once | a key can only change keys if it holds the right to edit API tokens, which the portal deliberately never asks for (least privilege). The deploy's form chooses DNS Edit; the two Email Routing rights are added with "Add more" (section 3) |
| Confirm a move from ImprovMX, and Move back | the Owner, on purpose | it changes where a domain's mail goes: a step that should never happen by itself (rule R-11) |
| Turn Email Routing off after taking Mail out | the Owner, if nothing else uses it | it stops every address of the domain receiving mail; the tool says how and leaves it to the person |

## 3. What would let more of it run by itself

- **Onboarding for Email Sending:** if Cloudflare adds an onboarding call, the Mail setup page can
  take the step itself; the key would then need Email Sending Edit, an owner decision (plan
  decision 3).
- **The key's form with every Mail right chosen:** Cloudflare's account-token form links accept
  a permission group's ID where no short key exists (its token template documentation, read
  2026-11-03), so the two Email Routing rights could be chosen too. The IDs are 32 hexadecimal
  characters, which the kit's identifier gate refuses by design; allowing these public IDs is the
  owner's call, asked in the kit's thread on 2026-11-02 and not answered yet.
- **A key that edits its own rights:** possible only with the API Tokens Edit right, which would
  let a leaked key make new keys. Not recommended.
- **Gmail and Outlook "Send as":** skipped by the owner on 2026-11-03 (bundle G), as Gmail ends
  it for non-Google addresses in January 2027.
