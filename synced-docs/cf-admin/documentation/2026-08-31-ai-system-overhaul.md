---

title: "AI System Overhaul — Reliability, Cost Truth and Observability"
status: active
audience: [owner, operator, technical, ai]
last_verified: 2026-08-31
verified_against: [code, infra, tests]
owner: harshil
related_docs: [./2026-08-30-blog-system-overhaul.md, ./security/compliance/AI-GOVERNANCE.md, ./features/CHATBOT.md, ../RULESAd.md]
tags: [workers-ai, neurons, observability, blog, chatbot, rag, cost-control]
---

# AI System Overhaul — 2026-08-31

> **TL;DR (non-technical):** The AI features were failing, spending more than
> anyone could see, and reporting things that were not true. Article generation
> failed every time. The knowledge base the articles were supposedly grounded
> in had never once been read. The spend counter under-reported by more than
> 6x, so the daily budget cap could not do its job. And nothing anywhere kept a
> record of any AI call, so none of the above was visible until someone
> complained. All of it is fixed, with tests that pin each fault so it cannot
> come back quietly.

## Context / Scope

The previous day's pass ([2026-08-30-blog-system-overhaul.md](./2026-08-30-blog-system-overhaul.md))
fixed the blog **data** layer. This pass covers the **AI** layer behind it:
five inference call sites across blog articles, suggested edits, AI-visibility
extraction, marketing email and the chatbot admin surface.

It was prompted by a report that "the AI system is not working well". It was
not. The most severe reason was a regression introduced by the previous pass
and fixed in `c053f8e` before this work began; the rest predated it.

**Not in scope:** cf-chatbot's own Worker (a separate repository — this repo is
its configuration proxy), and cf-astro.

---

## 1. What was wrong

Ranked by consequence. Every item was confirmed against source, the live
Cloudflare docs, the Workers AI binding types, or an executed reproduction.

### 1.1 Generation failed 100% of the time (fixed in `c053f8e`, before this pass)

`sanitizeAiBody` ran **before** `JSON.parse` on the only live route. That
function exists to unwrap a JSON envelope that has leaked into a body *field*,
and its trigger is `/^\{\s*"title"\s*:\s*"/`. A **correct** model response
begins with exactly that, because the prompt's schema lists `title` first. So
the guard fired on every well-formed response, stripped it to bare body HTML,
and handed that to `JSON.parse`.

Every attempt burned neurons and a daily quota slot, then told the operator
*"The model did not return a valid article"* — blaming the model for the
route's own bug. 529 tests passed throughout, because the only test covering
that function exercised the leaked-envelope direction and never the
well-formed one.

### 1.2 The RAG grounding was fake — not degraded, fake

`ai-knowledge.ts` **never returned a single knowledge base entry in its entire
existence.** Two independent bugs, either fatal alone:

1. It read `res.items || res.data`. The endpoint returns `{ entries, stats }` —
   `KnowledgeBase.tsx` reads `data.entries` from the *same* `/admin/kb` call.
2. Even with the right key, the declared type had `question`/`answer` while
   real rows carry `title_en`/`title_es`/`content_en`/`content_es`. Every entry
   would have rendered `Q: undefined / A: undefined`.

`const res: any` hid both. **Every published article and every generated
customer email was grounded in a hardcoded nine-line literal** that no operator
could see or edit, while the knowledge base editor they *do* use had no effect
on generation whatsoever. The failure was a `console.warn`; the route reported
`hasKbContext: true` either way; and the UI asserted the facts came from a
"D1 Vector Index" that does not exist anywhere in this product.

### 1.3 The spend cap could not work

Three compounding faults:

| | Before | Actual |
|---|---|---|
| `llama-3.3-70b` output price | $0.40 / M | **$2.253 / M** (5.6x under) |
| `llama-3.1-8b` output price | $0.07 / M | **$0.83 / M** (11.9x under) — *and Cloudflare deprecated it 5/30/2026* |
| Prompt tokens counted | **zero** | 800–1,500 per call |

The live route summed only the tokens it saw streaming *back*, then split that
one number 40/60 into synthetic "prompt" and "completion" figures shown to the
operator as measured telemetry. The system prompt — template plus knowledge
base context plus topic — was never counted at all.

The guard itself was the literal `> 9950`, copy-pasted into five route files,
with a divergent `9000` amber threshold in one UI and a hardcoded `10000` in
the quota endpoint. A 50-neuron buffer in front of calls costing hundreds.

And `getGlobalAiNeurons` had no `try/catch` and returned a bare `0` when Redis
was absent — so an outage **silently disabled the cap** while every display
showed a reassuring zero.

### 1.4 Nothing recorded anything

**There was no record of any AI call this product had ever made.** No table, no
dashboard, no alerting, no log line beyond a Sentry exception. When generation
failed 100% of the time for a day, nothing anywhere could have surfaced that.
"Which model is spending the budget?" had no answer.

### 1.5 The UI asserted things nobody computed

- `"Passed 6/6 Pre-Audit Gate ✅"` — hardcoded, rendered whenever a result
  existed, never computed. It could not have been true: the gate's cover-image
  checks always fail on a fresh generation, because the model supplies no image.
- `"Ground-Truth KB Facts Retreived from D1 Vector Index"` with a retrieved
  count of the literal `3`. No vector index, no embeddings, no Vectorize
  binding — and per §1.2, not from the KB either.
- `"No knowledge gaps detected yet. The AI is answering all queries
  successfully."` — permanent, because the cron that populates `cluster_topic`
  is listed as a *future enhancement*. A fabricated **conclusion**.
- `"API Error — Retrying"` — nothing retried. No loop, no backoff, no timer.
- "Neurons Consumed" on the chatbot usage card was a raw **token** count —
  roughly 200x off, on the card whose entire job is "am I near the free cap?".

### 1.6 The client re-fabricated what the server refused

`BlogManager.tsx` set `cover_image_alt: article.cover_image_alt || … ||
article.title`, putting the headline back as alt text. That satisfied the
publish gate's blocking alt-text check with a string describing no image, fully
neutralising the previous day's server-side fix — and a screen-reader user
would have been read the headline as a description of the picture. It also
persisted the model's self-reported `seo_score` (a number the prompt asked it
to invent, typically 95) into the column `evaluateSeoGate` computes.

### 1.7 Reliability basics were absent

No retry and no timeout on **any** AI call anywhere. Cloudflare documents error
3040 "Out of capacity" as a routine transient condition; it surfaced as a 500
and consumed one of the operator's twenty daily generations. `max_tokens: 3500`
was fixed against a word slider the schema allows up to 2500 — and truncation
there is not graceful degradation, it ends the JSON mid-string and loses the
whole generation after paying for every token. The prompt fought itself:
`{target_words}` said ~300 while rule 2 demanded "4 to 6 `<h2>` sections, each
with 2-3 detailed paragraphs", a ~1,200-word floor. And `mode` — four values,
accepted by the schema, destructured by both routes — was used by neither.

### 1.8 Chatbot: data loss on an ordinary save

The model `<select>` is populated from `models?show_deprecated=false`. If the
configured model had since been deprecated it matched no `<option>`, the
browser selected the `value=""` placeholder, and `handleSave` — which harvests
every `[name]` field — PUT `primary_model_id: ""`. **An admin editing a
greeting would silently unset the bot's model**, under a green success toast.

Also: two error paths told operators to run `python scripts/sync_chatbot_keys.py`,
a file that does not exist and never has; `apiKey || 'service-binding-cf-admin-v1'`
sent a hardcoded fake credential as `X-Admin-Key`; and `/api/chatbot/analytics`
was PLAC-mapped to a page it does not serve, so revoking a user's Analytics
page did not revoke the API filling it.

---

## 2. What changed

### 2.1 One place to call Workers AI from — `src/lib/ai/inference.ts`

| | Before | After |
|---|---|---|
| Structured output | none on the live route | `response_format: { type: 'json_schema', json_schema }` on every call |
| Temperature | unset (model default) | 0.3 |
| `max_tokens` | fixed 3500 | `computeMaxTokens(targetWordCount)` — scales, floor 1,200, cap 16,000 |
| Retry | none | one, with jitter, on 3040/429/5xx only |
| Timeout | none | 60s server, 150s client |
| Error reporting | raw upstream string | typed outcome + honest `retryable` flag |

**One retry, not three.** The failures worth retrying clear in under a second;
each further attempt spends real neurons against a 10,000/day allocation to
reach the same answer. Permanent errors (400, bad schema, over-context) are not
retried at all.

**The route no longer streams tokens**, and that is a deliberate trade. The
streamed tokens never became the article — they went to a log box showing JSON
escape sequences scrolling past, while the article arrived whole in the
`complete` event. `stream: true` also rules out both the usage object and
reliable guided decoding. The five stage events remain and now carry real
messages.

### 2.2 The catalogue has a membership rule

A model may be listed **only if the Workers AI binding accepts a JSON schema
for it**. Everything this product asks a model for is a JSON document, and
every route discards a response that will not parse — so a model without guided
JSON is not a cheaper option, it is one that fails more often *and* bills for
the attempt. `supportsGuidedJson` is a **required** field, and a test asserts
every entry is `true`.

This rule exists because of a mistake made during this very pass: two models
(`mistral-small-3.1-24b`, `gpt-oss-120b`) were selected on price and
multilingual reputation, one of them as the **default**, before checking the
binding types showed that neither accepts `response_format`. Only six
text-generation models in the entire Workers AI catalogue support it.

| Model | Neurons/M in | Neurons/M out | Context | Role |
|---|---:|---:|---:|---|
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 24,545 | 77,273 | 131k | **Default** |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 26,668 | 204,805 | 24k | Highest quality |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 4,625 | 30,475 | 32k | Cheapest; extraction default |

Removed: `llama-3.1-8b` (deprecated by Cloudflare, and hardcoded into
ai-visibility) and `qwen2.5-coder-32b` (a **code** model labelled "Recommended
for HTML" and used to write Spanish marketing prose about pet boarding).

Both model pickers now render from the catalogue, so a removed model cannot
linger in a UI — the email modal had been offering two models its own zod enum
would reject with a 400, and defaulting to one of them.

### 2.3 Neurons are the unit; dollars are derived

Cloudflare bills in Neurons and publishes neurons-per-million-tokens; its USD
column is that figure rounded for display. The old code stored the **rounded
dollars** and multiplied back out, reintroducing the rounding into every
charge. `neuronsPerM` is now the stored value and `pricePerMillion()` derives
dollars for humans — one number per model per side, so they cannot drift.

`test/ai-pricing.test.ts` asserts `calculateNeurons` reproduces Cloudflare's
published figures **exactly**, and that the reserve still covers the most
expensive single call the product can make.

### 2.4 One shared budget guard

`checkNeuronBudget()` replaces the `9950` literal in five routes, the `9000` in
the UI and the `10000` in the quota endpoint. Thresholds live in
`ai-pricing.ts`. The reserve is 1,000 neurons — sized to the worst-case single
call, with a test that fails if the catalogue outgrows it.

`getGlobalAiNeurons` now returns **`null` for "unknown"**, distinct from `0`
for "no spend", and the guard reports that as a degraded state. **Fail-open is
deliberate and documented**: this cap protects a free-tier allocation, not
correctness or security, and failing closed would take the whole authoring
surface offline on an unrelated Redis blip. The HUD shows "Usage unknown"
instead of a green zero.

### 2.5 Real grounding, and it says which

`getKnowledgeBaseContext` returns a discriminated result — `source: 'kb' |
'fallback'`, a real `count`, and on a fallback the `reason` (`unreachable`,
`empty`, `malformed`). It is locale-aware: a Spanish article is grounded in the
Spanish copy of each entry. Callers surface it; the banner turns amber when the
knowledge base was unreachable. A fallback is a legitimate degraded mode —
presenting it as retrieved ground truth is not, and the type now makes that
hard to do by accident.

### 2.6 Observability — and **no new table**

Every inference now writes one row: route, model, provider, outcome,
error_code, latency, prompt/completion tokens, whether those were *reported or
estimated*, neurons, attempts and grounding source. **No prompts and no
responses** — outcome and cost, not content.

> **RULE #0.9 reuse-check.** The plan for this work called for an
> `ai_generations` table, arguing that `admin_audit_log` has no columns for
> tokens, neurons, latency or model. That is a sound argument against adding
> **columns** — which would pollute a table five modules depend on — and the
> wrong conclusion. RULE #0.9 names the alternative explicitly: *"structured
> JSON payload fields in active tables"*. `admin_audit_log.details` is exactly
> that, already documented as `{v, summary, diff, context}`, and the grain
> matches perfectly: one row per AI call, by a known user, through a known
> route. The table already carries actor identity, session id, request path,
> Ray ID and correlation id — all of which an inference log wants and none of
> which a new table would have had — plus a prune job and a UI.
>
> **Result: zero new tables, zero migrations, no ledger row.** `module` and
> `action` are plain `TEXT` with no CHECK constraint (verified against the live
> schema via the D1 connector), so the two new enum values are a TypeScript
> change only. Aggregation goes through `json_extract`, which D1 supports
> natively.

`GET /api/ai/health` reports spend today, success rate, p50 latency, spend by
model, failures by code, and grounding source. When nothing has run it returns
zeros with `hasData: false` and a **null** success rate — a rate over zero
calls is not 100%, and this panel must never fill itself in.

`fireAlert` (which existed, called from two non-AI places) now fires when spend
crosses 80% of the allocation, once per UTC day via a dated fingerprint.

### 2.7 Everything else

- A failed generation no longer costs a daily slot. The per-minute limiter
  stays abuse protection (charged per attempt); the per-day quota is fair use
  and is charged only once an article exists.
- AI routes go through `safeRateLimit`, which existed for exactly this and was
  used by 8 storage routes and **0** AI routes.
- The publish-gate badge runs the real `evaluateSeoGate` and lists what is
  outstanding.
- Alt text and `seo_score` are no longer re-fabricated on the client;
  `seo_score` is gone from the article schema entirely, so the model no longer
  grades itself.
- The prompt's section count derives from `{target_words}` instead of
  contradicting it.
- `mode` is removed. A parameter that is accepted, typed and silently ignored
  is worse than an absent one.
- The chatbot's "Location" quick-reply told customers the business is in
  **Monterrey**. Every other reference in the repository says Aguascalientes,
  and `MADAGASCAR_LOCATIONS` carries both real branches with postcodes. Now
  sourced from there. **Worth a human confirming** — it is an address a
  customer is told to drive to.

---

## 3. Metrics

### 3.1 Cost, for one typical generation (1,200 prompt + 2,000 completion tokens)

| | Neurons | Note |
|---|---:|---|
| **Recorded** by the old counter | 70 | output-only, split 40/60, wrong prices |
| **Actually charged** (llama-3.3-70b) | 442 | **6.3x under-counted** |
| **Charged and recorded now** (llama-4-scout) | 184 | figures agree |

**What that meant for the cap.** The old counter would allow **142**
generations before tripping at 9,950 — by which point real spend was **62,764
neurons, 6.3x the entire free daily allocation.** The cap could not prevent the
overrun it existed for.

**What it means now.** Within the 9,000 soft limit: **48** generations/day on
the default model, 20 on the 70B, and every one of them counted correctly.

| Model | Neurons | USD @ $0.011/1k |
|---|---:|---:|
| llama-4-scout (default) | 184 | $0.00202 |
| llama-3.3-70b | 442 | $0.00486 |
| qwen3-30b | 67 | $0.00074 |

Switching the default from the 70B to Scout is a **2.4x increase in daily
capacity** at the same allocation, with a 5x larger context window.

### 3.2 Reliability

| | Before | After |
|---|---|---|
| Blog generation success rate | **0%** (§1.1) | guided JSON + one retry + timeout |
| Articles grounded in the real KB | **0** — every one used the fallback | real entries, count reported |
| Transient capacity failure (3040) | 500 + a burned daily slot | retried once, quota untouched |
| Truncation at 1,500+ words | total loss of the generation | budget scales with the request |
| A Redis blip | cap silently disabled, shows 0 | reported as "Usage unknown" |

### 3.3 Resource utilisation

| Resource | Change | Why |
|---|---|---|
| Neurons per generation | **−58%** at the default (442 → 184) | model change; not an accounting artefact |
| Neurons *recorded* | +531% (70 → 442 for the same 70B call) | the old number was wrong, not the cost |
| D1 rows | **+1 per inference** in `admin_audit_log` (~200 bytes) | covered by the existing prune job |
| D1 tables | **0 added** | §2.6 |
| Migrations | **0** | §2.6 |
| Env vars | **0 added** (cap 41, RULE #0.8) | thresholds are code constants |
| Redis ops | unchanged | same single counter key |
| Worker CPU | ≈0 added on the hot path | telemetry writes via `ctx.waitUntil` |
| Wall-clock per generation | **+0–900ms** in the rare retry case only | non-streaming is not slower to a usable article |

### 3.4 Code and tests

| | Value |
|---|---|
| Commits | 6 (`b0c231c` → `1c73419`) |
| Source | 28 files, +2,098 / −472 |
| Tests | 6 files, **+717 lines, 610 passing** (was 529) |
| New modules | 3 (`ai/inference.ts`, `ai/telemetry.ts`, `blog/article-schema.ts`) |
| Verify gate | typecheck 0 errors · lint 0 errors · rules_check 0 violations · a11y 0 findings |

The five new test files exist because **each pins a specific fault so it cannot
return silently**: the parse/sanitize ordering in both directions, our
arithmetic against Cloudflare's published neuron figures, the KB response
contract (including the old wrong key now reported as malformed), retry and
timeout behaviour, telemetry never claiming 100% over zero calls, and the PLAC
mappings.

---

## 4. How it works now

```
Operator clicks Generate
  │
  ├─ PLAC: /dashboard/content/blog          ← the Studio's own permission
  ├─ Rate limit: 3/min          (charged per attempt — abuse protection)
  ├─ Daily quota: 20/day        (CHECKED here, CHARGED only on success)
  ├─ checkNeuronBudget()        (one shared guard; fail-open + reported)
  │
  ├─ getKnowledgeBaseContext(env, 10, locale)
  │     └─ {source, count, reason}  → reported to the operator verbatim
  │
  ├─ runGuidedInference()
  │     ├─ response_format json_schema · temperature 0.3
  │     ├─ max_tokens = f(targetWordCount)
  │     ├─ 60s timeout
  │     └─ one retry with jitter on 3040/429/5xx
  │
  ├─ parseAiArticleResponse()   ← parse, THEN sanitize the body (§1.1)
  │     └─ null → fail loudly. Never synthesize. (RULE #0.5)
  │
  ├─ resolveUsage()             ← provider figures, else estimate BOTH sides
  ├─ calculateNeurons() → trackAiNeurons()
  ├─ recordAiGeneration()       ← via ctx.waitUntil, admin_audit_log
  ├─ alertOnNeuronThreshold()   ← once per UTC day at 80%
  └─ consumeDailyQuota()        ← only now
        │
        └─ SSE `complete` → editor → evaluateSeoGate → human publishes
```

---

## 5. Known gaps and future work

Stated plainly, because a document that lists only wins is the problem this
pass was fixing.

1. **The knowledge base is not a vector index, and grounding is not retrieval.**
   It injects the top N active entries by the API's own ordering — there is no
   embedding, no similarity search and no relevance ranking. The UI no longer
   claims otherwise. Real retrieval would need Vectorize; worth it only once
   the KB is large enough that "top 10" stops being most of it.
2. **OpenRouter spend is not tracked.** `calculateNeurons` returns 0 for
   unknown ids, which is correct for the *neuron* budget (a third party bills
   it) but means real money can be spent with no counter. The telemetry rows
   record the provider, so the data to build this now exists.
3. **`/api/ai/health` has no UI yet.** The endpoint is complete and tested; a
   panel on the ops dashboard is the obvious next step.
4. **Model quality is unbenchmarked.** llama-4-scout was chosen on published
   price, context window and guided-JSON support — all verified — but nobody
   has compared its Spanish prose against the 70B on this workload. The picker
   makes switching a one-click operator decision.
5. **`syncCmsToChatbot` has zero callers.** Nothing has ever invoked it, so CMS
   changes do not reach the chatbot knowledge base by that path. Kept and
   labelled; wiring it is a real piece of work, not a cleanup.
6. **Knowledge-gap clustering still does not run.** The panel now says so
   rather than congratulating the bot.
7. **The chatbot module has almost no test coverage.** This pass added the
   authz-mapping tests; the islands themselves remain untested.
8. **The Monterrey → Aguascalientes address change needs human confirmation**
   (§2.7).

---

## 6. Related

- [`./2026-08-30-blog-system-overhaul.md`](./2026-08-30-blog-system-overhaul.md)
  — the data-layer pass this builds on. Its "ai-visibility neuron accounting …
  now accurate" claim was wrong and is corrected in place.
- [`./security/compliance/AI-GOVERNANCE.md`](./security/compliance/AI-GOVERNANCE.md)
  — model inventory and risk table, both rewritten here: the inventory listed
  one of five call sites, and rated cost overrun "Low" on a usage dashboard
  that did not exist.
- [`./features/CHATBOT.md`](./features/CHATBOT.md) — `mutate()` argument order
  corrected, component names corrected, and the gap-clustering caveat added.
- [`../RULESAd.md`](../RULESAd.md) — RULE #0.5 (no fabricated data), #0.6
  (reuse before create), #0.9 (migration-minimal design — see §2.6).
