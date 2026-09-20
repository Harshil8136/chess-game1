---

title: "AI Governance — Model Inventory, Human Oversight & NIST AI RMF Self-Map"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-09-19
verified_against: [code, config]
owner: harshil
related_docs: [../RoPA.md, ../../features/CHATBOT.md, ../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
tags: [ai-governance, iso42001, eu-ai-act, nist-ai-rmf, transparency, compliance]
---

# AI Governance

> **TL;DR (non-technical):** What AI this platform uses, which models, who is
> accountable for the output, and how that maps to the AI rules buyers and
> regulators are starting to ask about. The short version: **five narrow,
> staff-facing inference surfaces** — blog drafting (two routes), suggested
> edits, AI-visibility answers and email drafting — plus a configuration proxy
> for the customer chatbot, each with a human in the loop before anything
> reaches a customer, and none of them anywhere near the EU AI Act's
> "high-risk" tier. This is a **self-assessment**, not a certification.
> *(Corrected 2026-09-19: this said "two narrow, staff-facing AI features",
> which had not been updated when the inventory in §1 was corrected to five on
> 2026-08-31. One open regulatory action is overdue — see §4.)*

## Context / Scope

Closes gaps **G15** (no AI governance documentation) and **G16** (EU AI Act
transparency-disclosure verification) from
[`../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../../records/reviews/2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).

Covers AI used by **`cf-admin`**. The customer-facing chatbot itself is a
separate Worker (`cf-chatbot`); this repo is its configuration proxy and
analytics dashboard, which changes the obligations materially — see §4.

## 1. Model inventory

> **Corrected 2026-08-31.** The previous version of this table listed ONE of
> five inference call sites and named three models, two of which the product
> no longer offers (one had been deprecated by Cloudflare). Blog article
> generation — the busiest AI surface in the product, and the only one whose
> output is published to the public internet — was absent entirely. An
> inventory that omits the highest-impact use is not an inventory.

| # | Feature | Entry point | Provider | Data sent | Human in loop? |
|---|---|---|---|---|---|
| 1 | Blog article drafting | `POST /api/content/ai-generate-stream` | Cloudflare Workers AI / OpenRouter | Staff-authored topic + brand knowledge base. **No customer PII.** | ✅ Draft lands in the Blog Studio editor; a separate publish action with a blocking quality gate is required |
| 2 | Blog article drafting (non-streaming twin) | `POST /api/content/ai-generate` | Same | Same | ✅ Same |
| 3 | Suggested edits to a published article | `POST /api/content/blog/suggest` | Cloudflare Workers AI | The existing article + an optional editor instruction | ✅ Proposals are stored for review; a human accepts or rejects each one |
| 4 | AI-visibility direct answers | `POST /api/content/ai-visibility` | Cloudflare Workers AI | Article title and body excerpt | ⚠️ Accepted answers are emitted as schema.org markup on publish — reviewed as part of the article, not separately |
| 5 | Marketing-email drafting | `POST /api/emails/ai-generate` | Cloudflare Workers AI / OpenRouter | Staff-authored prompt + brand parameters. **No customer PII.** | ✅ Always — output lands in a draft the operator must review and send |
| 6 | Chatbot configuration & analytics | `/api/chatbot/[...path]` (proxy) | — | Configures `cf-chatbot`; no inference here | ✅ Config changes are explicit operator actions |

**Models.** The catalogue is `AI_MODELS` in `src/lib/ai-pricing.ts` — the
single source of truth, from which the zod enums, both model pickers and all
neuron accounting are derived. Re-verified 2026-09-19: the three models, their
neuron rates and their context windows below match the code exactly. One
nuance, added the same day: **neuron accounting covers Workers AI only.** The
cost helper returns 0 for an unknown model id, so a call routed through
OpenRouter bills a third party and is deliberately outside the neuron budget.
As of 2026-08-31:

| Model | Neurons / M in | Neurons / M out | Context | Role |
|---|---:|---:|---:|---|
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 24,545 | 77,273 | 131k | Default for articles and email |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 26,668 | 204,805 | 24k | Highest quality, ~2.6x the output cost |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 4,625 | 30,475 | 32k | Cheapest; default for short extraction |

**Membership rule:** a model may only be listed if the Workers AI binding
accepts a JSON schema for it (`supportsGuidedJson`, a required field, asserted
by `test/ai-pricing.test.ts`). Every route asks the model for a JSON document
and discards a response that will not parse, so a model that cannot be
constrained to JSON fails more often AND bills for the attempt. Two models were
briefly selected on price before this rule existed; neither supported guided
decoding and one had been made the default.

**The model set is closed.** `aiGenerateSchema` (`src/lib/schemas/ai.ts`) and
`aiContentGenerateSchema` (`src/lib/schemas/ai-content.ts`) constrain `modelId`
to `AI_MODELS` or a bounded `openrouter/<vendor>/<model>` pattern. Before
2026-07-25 any string prefixed `openrouter/` was forwarded verbatim to a paid
third party, which meant the reachable model set was effectively unbounded.
Adding a model is a deliberate code change.

**OpenRouter is code-supported but not configured in production**
*(verified 2026-09-19).* Both schemas accept the bounded
`openrouter/<vendor>/<model>` pattern and `src/lib/ai/` holds the client, but
no OpenRouter API key exists among the Worker's live environment entries — so
every inference that actually runs today goes to Cloudflare Workers AI. Rows 1
and 5 above list it as an available provider; read that as "reachable if a key
is added", not as a live data flow. It stays in `RoPA.md` §3 and in the
transfer table because enabling it is a configuration change, not a code
change.

## 2. Human oversight

No inference surface makes an automated decision about a person. Every one of
them produces a draft, a proposal or a suggested answer that a human reviews,
edits and explicitly publishes or sends — with the one caveat recorded against
row #4 in §1 (accepted AI-visibility answers are emitted as schema.org markup
when the article is published, and are reviewed as part of the article rather
than separately).

- **No Art. 22 GDPR concern** — no automated decision-making producing legal or
  similarly significant effects.
- **No profiling, scoring, or ranking of individuals.**
- **Access, corrected 2026-09-19.** The three bullets that used to sit here
  were wrong in three different directions, so each is restated against the
  code:
  - *The inference routes are not "admin-role gated".* Four of the five call
    `requireAuth(context)` with **no minimum role** — any authenticated portal
    user passes that step. The gate that actually holds is **PLAC page access**
    to Blog Studio (`/dashboard/content/blog`) or the Email Portal
    (`/dashboard/emails`), whose registry default today is the canonical
    **manager** tier and which is overridable per user, plus the per-user rate
    limit and the shared neuron budget. Only the AI-visibility route passes an
    explicit `'admin'` minimum.
  - *The chatbot proxy does not "require the most restrictive `dev` role".* It
    applies a per-endpoint ladder: **staff** for reads, live takeover and
    knowledge-base auto-generation; **admin** for knowledge-base, config,
    prompt, model and cache mutations. `vendor_support` (the `dev` role) is the
    **fail-closed default for paths that match no rule**, not the floor for the
    surface. Read the old wording and you would believe staff cannot reach
    chatbot analytics; they can, by design.
  - *Prompt-injection screening does not cover every route.* A documented
    keyword screen rejects obvious override attempts before inference on most,
    **but not all**, of the prompt-taking routes — coverage is not uniform, and
    one route also accepts an operator-supplied system-prompt override that
    replaces the template wholesale. Both are tracked as engineering work; see
    MEASURE 2.7 in §5, which is downgraded accordingly. The compensating
    control is unchanged and is the one that matters: the output is a draft, it
    is never an action, and a human publishes it.
- Prompts are capped by schema: **2,000 characters** for email drafting
  (`src/lib/schemas/ai.ts`) and **3,000** for blog article generation
  (`src/lib/schemas/ai-content.ts`). *(Corrected 2026-09-19 — this said 2000
  for everything.)*

## 3. Risk assessment

> **Corrected 2026-08-31.** The previous table rated cost overrun's residual
> risk "Low" on the strength of a "usage dashboard" that did not exist, and
> omitted the risks specific to publishing generated text to the open internet.
> A control cited in a compliance document has to be a control that exists.

| Risk | Likelihood | Impact | Mitigation | Residual |
|---|---|---|---|---|
| Model emits inaccurate marketing or article copy | Medium | Medium | Mandatory human review before send/publish; generation is grounded in the knowledge base and the UI states whether real entries or built-in defaults were used | Low |
| Fabricated content reaches the public web | **Was High** | High | Routes never synthesize a replacement for an unusable model response — they fail loudly (RULE #0.5). The publish quality gate blocks on missing cover, alt text, length and slug. This risk was realised once, on 2026-08-30 | Low |
| Cost overrun | Medium | Low | Per-user quota + rate limit; one shared `checkNeuronBudget` with a reserve sized to the most expensive single call; per-inference telemetry in `admin_audit_log` and `GET /api/ai/health`; an alert at 80% of the daily allocation | Low |
| Under-counted spend defeating the cap | **Was High** | Medium | Prices are Cloudflare's published neurons-per-M, not a rounded dollar round-trip, and a test asserts our arithmetic reproduces them. Both prompt and completion are counted. Before 2026-08-31 output was under-priced by up to 11.9x and the prompt was not counted at all | Low |
| Prompt injection redirects the system prompt | Low | Low | Keyword screen on most prompt-taking routes — **coverage is not uniform** (2026-09-19; see §5 MEASURE 2.7). The control that carries the risk is structural: output is a draft, never an action, and a human publishes it | Low–Medium |
| Unapproved/unpriced model selected | **Was High** | Medium | Closed enum + bounded pattern (2026-07-25); pickers render from the catalogue so a removed model cannot linger in a UI | Low |
| Prompt content leaks to a third party | Low | Medium | Prompts are staff-authored and contain no customer PII by design; OpenRouter is optional | Low |
| Silent AI outage | **Was High** | Medium | Every inference writes an outcome row; `/api/ai/health` reports success rate and failures by code, and since 2026-09-08 an operator can read it without curl — it is surfaced on the AI Health tab of `/dashboard/logs`, which renders a null success rate as an em dash rather than 100% when no call was made. Before 2026-08-31 there was NO record of any AI call, and a 100%-failure day was invisible to everything except the operators experiencing it | Low |
| Bias in generated copy | Low | Low | Marketing and pet-care copy only; human review | Low |

**Telemetry retention.** Inference rows record route, model, provider,
outcome, latency, tokens, neurons and grounding source. They record **no
prompts and no responses** — outcome and cost, not content — so this trail
adds no new personal-data or content-retention obligation, and is covered by
the existing audit-log retention policy.

**Not applicable by design:** biometric identification, emotion recognition,
social scoring, employment/credit/education decisions, law enforcement or
migration use. None of these exist in the product and none is on the roadmap.

## 4. EU AI Act position

| Question | Answer |
|---|---|
| Role | **Deployer**, not provider — deployer obligations are materially lighter. In `cf-admin` the foundation models are Meta's and Qwen's, served by Cloudflare Workers AI; OpenRouter is a router to third-party providers, not a model owner, and is dormant in production (see §1). **The chatbot's own model inventory lives in `cf-chatbot` and is not reproduced here.** *(Split 2026-09-19: one row was conflating the two repositories' providers.)* |
| Risk tier | **Limited risk** for the customer-facing chatbot (Art. 50 transparency); the email drafting feature is staff-facing and arguably minimal risk. |
| High-risk (Annex III)? | **No.** No biometrics, no credit/employment/education decisioning, no critical infrastructure, no law enforcement. |
| GPAI provider duties (in force Aug 2025)? | **No** — those bind model providers. |
| Key date | **2 August 2026 — PASSED.** Art. 50 transparency obligations have been in application since that date. See the overdue action below. |

### Art. 50 transparency — status

Art. 50(1) requires that a person interacting with an AI system be told so,
unless it is obvious.

- **Email drafting (this repo): satisfied.** The feature is inside an admin UI
  labelled "AI Generator"; the operator knowingly invokes it and the success
  toast reads "AI-generated email inserted into composer." No end user
  interacts with it.
- **Customer chatbot (`cf-chatbot`): OVERDUE since 2026-08-02 — still not
  verified.** The chatbot is the surface where a consumer actually converses
  with an AI, and its UI lives in a different repository. **This document does
  not close G16 for the chatbot.** An explicit, user-visible "you are chatting
  with an AI assistant" disclosure had to be in place by 2 August 2026 if any
  EU user can reach the widget. As of 2026-09-19 that is **48 days past the
  date** and the disclosure has still not been confirmed by anyone.

| Overdue action | Owner | Due | Status |
|---|---|---|---|
| Confirm (or ship) a user-visible AI disclosure in the `cf-chatbot` widget, screenshot it, and link the evidence from this section. If EU users cannot reach the widget, record *that* determination here instead — with what it is based on — and the obligation falls away. | harshil | **was 2026-08-02** | 🔴 **OVERDUE — 48 days on 2026-09-19** |

Two things keep this from being an emergency, and neither closes it: the
platform makes **no** EU AI Act compliance claim anywhere (§7 forbids it), and
Art. 50(1) is satisfied by a visible label, which is hours of work rather than
a project. The risk is that an obligation sat in a compliance document in the
future tense for seven weeks after it came into application. **Mirror this row
into `MAINTENANCE.md` so it is visible outside this file** — a deadline tracked
only in the document that describes it is not tracked.

## 5. NIST AI RMF 1.0 self-map

Voluntary, free, self-assessed. Not an audit.

| Function | Status | Evidence / gap |
|---|---|---|
| **GOVERN 1.1** — policies for AI risk | 🟡 Partial | This document is the first. No standalone AI policy or review cadence. |
| **GOVERN 2.1** — accountability | ✅ | Single accountable owner (§ owner front-matter). |
| **GOVERN 4.1** — risk culture | 🟡 | Risks documented (§3); no recurring review. |
| **GOVERN 6.1** — third-party risk | ✅ | Providers inventoried (§1); sub-processors in `../RoPA.md` §3. |
| **MAP 1.1** — context established | ✅ | §1–§2. |
| **MAP 2.3** — capabilities and limits | ✅ | §2–§3; human-in-loop stated. |
| **MAP 5.1** — impacts characterised | ✅ | §3. |
| **MEASURE 2.1** — systems evaluated | 🔴 Gap | **No systematic output evaluation.** No bias testing, no accuracy benchmark, no red-teaming. Mitigated in practice by mandatory human review, but there is no measurement. |
| **MEASURE 2.7** — security/resilience | 🟡 | Closed model enum, rate limits, shared neuron budget and schema tests all hold. **Downgraded 2026-09-19:** the prompt-injection keyword screen is **not applied uniformly across the prompt-taking routes**, and one route accepts an operator-supplied system-prompt override that replaces the template. A control that covers most call sites is a partial control, and a self-assessment should say so. Tracked as engineering work; re-raise to ✅ when the screen (and a bound on the override) sits in one shared helper every route calls. |
| **MEASURE 3.1** — tracking over time | 🟡 | Token usage and cost tracked; output *quality* is not. |
| **MANAGE 1.2** — risks prioritised | ✅ | §3. |
| **MANAGE 2.2** — sustained response | 🟡 | Ad hoc; no defined AI-incident path (the general IR runbook applies). |
| **MANAGE 4.1** — post-deployment monitoring | 🟡 | Usage dashboards; no quality monitoring. |

**Honest overall: ~55%.** Higher than the 45% the 07-22 audit estimated,
because the model-selection hole is now closed and the inventory is real — but
**MEASURE is genuinely weak**, and any buyer asking about bias testing or
output evaluation should be told plainly that none is performed today.

## 6. ISO/IEC 42001 readiness

~40%. The technical controls (access, logging, model constraint, cost caps)
map reasonably; the **AI management system layer** — AI policy, defined roles,
impact assessments, internal audit, management review, continual improvement —
does not exist.

**Recommendation unchanged from the 07-22 audit: do not pursue 42001
speculatively.** It is a paid, externally audited certification worth starting
only when a specific enterprise deal names it. This document is the interim
answer to "show us your AI governance," which is what that audit found most
buyers actually ask for first.

## 7. Claimable vs not

**True today:**
- "Our AI features are staff-facing with mandatory human review; no automated
  decisions are made about individuals."
- "We maintain a model inventory and constrain model selection to an approved
  set."
- "We are a deployer, not a provider, under the EU AI Act, and our systems are
  not high-risk under Annex III."
- "We have self-mapped to the NIST AI RMF."

**Not true — do not say:**
- "ISO 42001 certified" (no certification exists).
- "EU AI Act compliant" — the Art. 50 chatbot disclosure is unverified and
  **overdue since 2026-08-02** (§4).
- "Bias tested" or "independently evaluated" (§5 MEASURE 2.1).
- "Every AI route screens for prompt injection" — coverage is not uniform
  (§2, §5 MEASURE 2.7). *(Added 2026-09-19.)*

## 8. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | §2's access statements against `src/pages/api/content/ai-generate-stream.ts`, `content/ai-generate.ts`, `emails/ai-generate.ts`, `content/ai-visibility.ts` and `src/lib/auth/guard.ts` (only the last passes a minimum role), against `src/pages/api/chatbot/[...path].ts` (`RBAC_RULES` ladder + fail-closed default) and against the live `admin_pages` rows for `/dashboard/content/blog` and `/dashboard/emails` (`required_role = admin` in the stored vocabulary = canonical **manager**); prompt caps in `src/lib/schemas/ai.ts` (2,000) and `src/lib/schemas/ai-content.ts` (3,000); injection-screen coverage across the prompt-taking routes; `AI_MODELS`, `AI_NEURON_DAILY_CAP`/`RESERVE` and `calculateNeurons()` returning 0 for unknown ids in `src/lib/ai-pricing.ts`; the absence of an OpenRouter key in `wrangler.toml`'s `[secrets] required` and in the live Worker inventory; today's date against the Art. 50 deadline. | Whether `cf-chatbot` now carries a user-visible AI disclosure (different repository — this is the overdue item in §4); the claim at §3 that the fabricated-content risk "was realised once, on 2026-08-30"; the chatbot's own model inventory |
