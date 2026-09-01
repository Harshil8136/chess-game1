---

title: "AI Governance — Model Inventory, Human Oversight & NIST AI RMF Self-Map"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-08-31
verified_against: [code, config]
owner: harshil
related_docs: [../RoPA.md, ../../features/CHATBOT.md, ../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md]
tags: [ai-governance, iso42001, eu-ai-act, nist-ai-rmf, transparency, compliance]
---

# AI Governance

> **TL;DR (non-technical):** What AI this platform uses, which models, who is
> accountable for the output, and how that maps to the AI rules buyers and
> regulators are starting to ask about. The short version: two narrow,
> staff-facing AI features, both with a human in the loop before anything
> reaches a customer, and neither anywhere near the EU AI Act's "high-risk"
> tier. This is a **self-assessment**, not a certification.

## Context / Scope

Closes gaps **G15** (no AI governance documentation) and **G16** (EU AI Act
transparency-disclosure verification) from
[`../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md`](../../2026-07-22-compliance-certification-audit-all-frameworks-and-roadmap.md).

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
neuron accounting are derived. As of 2026-08-31:

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

## 2. Human oversight

Neither feature makes an automated decision about a person. Both produce a
draft that a human reviews, edits and explicitly sends.

- **No Art. 22 GDPR concern** — no automated decision-making producing legal or
  similarly significant effects.
- **No profiling, scoring, or ranking of individuals.**
- Access is gated: the AI route is admin-role gated, PLAC-checked, rate-limited
  and quota-capped. The chatbot proxy requires the most restrictive `dev` role.
- Prompt-injection screening rejects a documented keyword set before inference.
- Prompts are capped at 2000 characters.

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
| Prompt injection redirects the system prompt | Low | Low | Keyword screen; output is a draft, not an action | Low |
| Unapproved/unpriced model selected | **Was High** | Medium | Closed enum + bounded pattern (2026-07-25); pickers render from the catalogue so a removed model cannot linger in a UI | Low |
| Prompt content leaks to a third party | Low | Medium | Prompts are staff-authored and contain no customer PII by design; OpenRouter is optional | Low |
| Silent AI outage | **Was High** | Medium | Every inference writes an outcome row; `/api/ai/health` reports success rate and failures by code. Before 2026-08-31 there was NO record of any AI call, and a 100%-failure day was invisible to everything except the operators experiencing it | Low |
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
| Role | **Deployer**, not provider. The foundation models belong to Cloudflare, Meta, Qwen and OpenRouter — deployer obligations are materially lighter. |
| Risk tier | **Limited risk** for the customer-facing chatbot (Art. 50 transparency); the email drafting feature is staff-facing and arguably minimal risk. |
| High-risk (Annex III)? | **No.** No biometrics, no credit/employment/education decisioning, no critical infrastructure, no law enforcement. |
| GPAI provider duties (in force Aug 2025)? | **No** — those bind model providers. |
| Key date | **2 August 2026** — Art. 50 transparency obligations apply. |

### Art. 50 transparency — status

Art. 50(1) requires that a person interacting with an AI system be told so,
unless it is obvious.

- **Email drafting (this repo): satisfied.** The feature is inside an admin UI
  labelled "AI Generator"; the operator knowingly invokes it and the success
  toast reads "AI-generated email inserted into composer." No end user
  interacts with it.
- **Customer chatbot (`cf-chatbot`): NOT VERIFIED HERE.** The chatbot is the
  surface where a consumer actually converses with an AI, and its UI lives in a
  different repository. **This document does not close G16 for the chatbot.**
  An explicit, user-visible "you are chatting with an AI assistant" disclosure
  must be confirmed in `cf-chatbot` before 2 August 2026 if any EU user can
  reach it. Recorded as a cross-repository action, not as done.

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
| **MEASURE 2.7** — security/resilience | ✅ | Prompt-injection screen; closed model enum; rate limits; schema tests. |
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
- "EU AI Act compliant" (Art. 50 chatbot disclosure unverified — §4).
- "Bias tested" or "independently evaluated" (§5 MEASURE 2.1).
