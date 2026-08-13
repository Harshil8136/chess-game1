---

title: "Billing Model & Personal Viability"
status: active
audience: [owner]
last_verified: 2026-08-13
verified_against: [code, docs]
owner: harshil
related_code:
- src/lib/auth/plac.ts
- src/lib/auth/cf-access-sync.ts
- database/legacy_migrations/0004_create_admin_audit_log_table.sql
- migrations/0002_create_cf_access_sync_log.sql
related_docs:
- MODULE-PRICING-CATALOG.md
- PLATFORM-BUY-VS-BUILD-COMPARISON.md
- ../2026-07-26-commercial-model-costing-pricing-and-scale.md
- ../2026-07-27-go-to-market-prospecting-and-roadmap.md
tags: [commercial, billing, viability, cfzt, seat-metering, owner-only]

---

# Billing Model & Personal Viability

> **TL;DR:** Your CFZT-seat-metering idea is sound and is best understood as the
> **enforcement mechanism for seat counts Velox's pricing already has** (Starter 1 seat,
> Business 3, Professional 5, Enterprise 10, +$19/mo/extra seat), not a new pricing
> model — you already have the audit trail to run it today, no new code needed. Your
> "zero build fee + annual contract" instinct also already matches what's live (Velox's
> funnel charges the first 3 months upfront instead of a named setup fee — same effect,
> more honest framing). On personal viability: infra cost is genuinely ~$0, but "just
> working hours" undersells it — the existing commercial-model document already found
> that **operations, not infra, is 60-70% of true cost-to-serve**, and AI speeds up the
> *build* half of that, not the *support* half. The model is good. Don't price it like
> the working-hours cost is zero, because it isn't.

## 1. Your CFZT-based seat metering, evaluated directly

**It's a genuinely good idea, and it's more defensible than how most SaaS companies
actually meter seats.** Most per-seat SaaS billing counts *invited* or *provisioned*
accounts — easy to game (share a login, keep a departed employee's seat active). CF
Zero Trust identity requires a real authentication event per person, and the audit
infrastructure to count it **already exists in the codebase**, not something to build:

- `admin_authorized_users` — the source of truth for who's provisioned
- `cf_access_sync_log` (`migrations/0002_create_cf_access_sync_log.sql`) — every
  provisioning/deprovisioning event, durably logged
- `admin_audit_log` — every authenticated action, with actor, role, and timestamp

A "unique authenticated staff emails this billing period" query against data you
already collect is a report, not a feature. That's a real strength.

**Two things worth knowing before you rely on it:**

1. **It only meters the admin-portal side.** It says nothing about usage of the public
   site, the chatbot, or the booking flow — those aren't behind CF Access. It's a
   correct metering signal for *one* dimension (staff seats), not the whole platform's
   value. That's fine — it's exactly the dimension Velox's tiers already price on.
2. **It's really the verification layer under pricing that already exists**, not a
   parallel system. Velox's live tiers already cap seats (1/3/5/10) and already sell
   extra seats at $19/mo flat. What you're describing — count real logins, bill for
   overage — is how you'd actually *enforce* that cap instead of trusting a client's
   self-report. Frame it that way in your own head and in any contract language: "seats
   are metered by authenticated login, not self-declared," not a new pricing axis.

**On the trust-based enforcement you mentioned** ("we won't aggressively audit-chase
them"): that's a fine posture to hold, and it costs you nothing to keep holding it — but
consider making the *report* automatic even if the *enforcement* stays generous. A
monthly line — "4 unique logins this period, your plan includes 3" — generated from data
you're already collecting turns an awkward manual confrontation into a routine, factual
statement, and it's the same data whether you choose to bill the overage or wave it. The
generosity and the automation aren't in tension; automating the *visibility* doesn't
commit you to being strict about the *billing*.

**One edge case worth a sentence in the contract, not a feature:** a client could rotate
staff in and out within a month to stay under a seat count on paper while more than N
people effectively used the system. Given your stated posture, this probably isn't worth
building detection for — just make sure the contract says billing is based on unique
authenticated users in the period, so the definition is honest even if enforcement stays
soft.

## 2. Your build-fee / annual-contract idea, evaluated directly

**This already matches what's live**, and your instinct is correct that it should stay
that way. From the existing GTM document's funnel (stage 5): *"12-month minimum. First 3
months paid upfront on monthly billing. No setup fee."* That's the same economic effect
as a build fee — you get paid before you build — without the friction of naming it a
fee, which the existing GTM analysis found converts better (a demo-first, no-setup-fee
pitch is the flagship sales asset per that document's own "bottom line").

**Your refinement — some add-on modules get a build fee, some don't, decided per
module** — is the correct nuance and isn't explicitly stated in the existing docs, so
it's worth writing down as a real rule: **a module that's already built and generic
(Search Console Sync, Staff Storage, the AI chatbot, the blog/AI-visibility engine) costs
you close to zero marginal effort to switch on for a new client — charging a build fee
for flipping on something that already exists would be dishonest padding, not a real
cost recovery. A module that requires genuine custom work for one specific client
(anything outside the existing catalogue) is real hours and deserves a real, honestly
scoped fee.** That's the line, and it's a clean one to hold in a sales conversation: "is
this in the catalogue, or are you asking us to build something new for you specifically"
determines whether there's a fee, not negotiation.

Recommended concrete rule: **catalogue modules — $0 build fee, live same day, billed
from next cycle. Custom scope — quoted separately, same discipline the commercial-model
document already applies to Motion B's $1,500-5,000 setup fee** (real hours, quoted
honestly, not folded into a recurring number to make it look free).

## 3. Personal viability — the honest answer

**Yes, this is viable, and the margins are genuinely good — but "my cost is zero" isn't
quite the right frame, and pricing against that frame would leave real money and real
risk on the table.**

The existing commercial-model document already did this math and it doesn't change
because AI wrote some of the code:

- **Infra is not the cost. It never was.** ~$10-36/month depending on client count,
  already modeled, already close to zero. You're right about this part.
- **Operations is 60-70% of true cost-to-serve** at that document's own numbers — support
  requests, monthly updates, incident response, the fleet-wide version-drift problem.
  None of that gets cheaper because AI helped write the code faster. A client's 2am "I
  can't log in" doesn't resolve faster because the codebase was AI-assisted to build.
- **What AI actually did, verifiably, this session:** two substantial modules (automated
  Search Console/PageSpeed monitoring, an expanded staff file-storage system) went from
  request to built, hardened, documented, and shipped to production in hours, not the
  110-150 hours the existing blog-module spec estimated for comparable-scope work done
  the traditional way. **That's a real, measurable effect on the *build* half of cost.**
  It has no measured effect on the *support* half, which the existing document already
  flagged as **the single largest unmodeled unknown (assumption A6)** — track your
  actual support hours for the next 90 days, exactly as that document already
  recommended, before revising anything downward. AI changing your build velocity is not
  evidence about your support burden; don't let the first quietly stand in for the
  second.

**What to actually do with the AI-driven build-speed gain:** the existing pricing
($59-499/mo tiers, $79-129/mo for the flagship AI module, etc.) is anchored to
*competitor value and cost floor*, not to your own time cost — which is the correct way
to price a differentiated product, and it means the AI speedup **shows up as margin, not
as a reason to charge less.** The one exception worth considering deliberately: using
faster build time as a *sales* lever during Motion A's current phase (a shorter time from
signed contract to live demo is a real, quotable differentiator against agencies that
still need weeks) — that's a legitimate use of the AI dividend, spend it on **speed to
close**, not on discounting the recurring price.

**The one number that actually gates how viable this is at scale, and it's not
pricing:** the existing GTM document's fleet capacity ceiling — **roughly 10-15 client
deployments before manual operations collapse**, with the tooling that raises it
estimated at 2-4 weeks of focused work and still unstarted as of the last verification
pass. Adding two well-documented modules this session doesn't change that ceiling; it
makes each client under the ceiling worth more (an easier upsell conversation at the
month-3 review), which is the right lever to be pulling before the client-count lever.

## 4. Recommended pricing summary

Pulling together this document, the module catalog, and the existing commercial model
into one number set:

| | Low | Average (target) | High |
|---|---|---|---|
| **Base monthly (Velox tiers, already live)** | $59 (Starter — no admin deployment) | $299 (Professional) | $499+ (Enterprise) |
| **Framework/agency deployment (Motion B, gated — see GTM doc §5)** | $250/mo + $1,500 setup | $500/mo + $2,500 setup | $900+/mo + $5,000 setup |
| **Individual add-on module** | $19.99/mo (Search Console Sync standalone) | ~$47/mo (average of the 4 modules sampled on `/pricing` — $49.99/$24.99/$59.99/$54.99; the full 42-module catalogue wasn't fetched, so treat this as directional) | $129/mo (Content & AI Visibility Engine, the flagship) |
| **Extra staff seat** | $19/mo flat (already live) | — | — |
| **Blended realistic deal size once modules attach** (Professional tier + 1-2 add-ons) | ~$350/mo | **~$400-450/mo** | ~$550/mo |

The floor to never price under, restated from the commercial-model document because it's
the single most important number in this file: **~$36/month fully-loaded cost per client
carrying an admin deployment.** Every number above clears it comfortably. The $59 Starter
tier clears it too, but only because — stated plainly, the way the GTM document already
insists on — it carries no admin deployment at all.

## 5. What else to consider — pulled from existing risk registers, not re-derived

These are already written down in the GTM document's risk register and capacity-gate
section; restated here only because they're the most relevant ones to have in view while
thinking about pricing and billing specifically:

- **Two new modules mean two new onboarding steps that are currently manual per
  client.** Search Console Sync needs a real Google Cloud service account and a Search
  Console permission grant *per client* — that's genuine setup labor, not zero-marginal,
  and it should be accounted for in whichever tier/fee structure a client's onboarding
  falls into, the same way the existing $1,500-5,000 setup fee already accounts for
  manual provisioning work in Motion B.
- **The audit exceptions expire 2026-10-23** (`MAINTENANCE.md` C-1) — a hard date, not
  optional, and it fails the build gate fleet-wide if missed.
- **No uptime SLA can honestly be offered** — no DR drill has ever been run. Don't let a
  new module's polish (ops alerts, dashboards) create the impression of an availability
  guarantee that isn't backed by anything.
- **Single-reference concentration is still the biggest go-to-market risk**, unrelated
  to pricing but worth remembering while deciding how hard to push new-module upsells
  versus getting to three reference clients.

## 6. See also

- [`MODULE-PRICING-CATALOG.md`](MODULE-PRICING-CATALOG.md) — per-module pricing detail
- [`PLATFORM-BUY-VS-BUILD-COMPARISON.md`](PLATFORM-BUY-VS-BUILD-COMPARISON.md) — what the whole stack costs bought elsewhere
- [`../2026-07-26-commercial-model-costing-pricing-and-scale.md`](../2026-07-26-commercial-model-costing-pricing-and-scale.md) — the cost floor and unit economics this document is built on
- [`../2026-07-27-go-to-market-prospecting-and-roadmap.md`](../2026-07-27-go-to-market-prospecting-and-roadmap.md) — the funnel, capacity ceiling, and risk register referenced throughout
