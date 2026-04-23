{% raw %}
# AI INFRASTRUCTURE — Deep Research Report

> **Status:** ✅ DEPLOYED  
> **Last Updated:** 2026-04-23  
> **Migration:** `0013_workers_ai_primary_migration.sql`  
> **Strategy:** Workers AI Primary + Claude Haiku Fallback  
> **Monthly Cost:** ~$0 (free tier covers expected traffic)

---

## 1. Architecture Overview

### 1.1 Tiered Fallback Pipeline

The chatbot uses a three-tier fallback chain ensuring 100% response availability:

```
User Message
    │
    ├── Classifier (Llama 3.2 1B — Workers AI) ──→ ~0.3 neurons
    │      │
    │      ├── greeting/farewell/thanks → Static response (0 neurons, 0 cost)
    │      ├── human_request → Escalation email (0 neurons, 0 cost)
    │      │
    │      └── faq/booking/pricing/complaint/unknown
    │            │
    │            ├── RAG Embedding (BGE-Small — Workers AI) ──→ ~0.1 neurons
    │            │
    │            └── Main LLM Generation
    │                  │
    │                  ├─ TIER 1: Workers AI (Qwen3-30B) ──→ ~10 neurons  ← FREE
    │                  │   (uses env.AI.run() — edge inference)
    │                  │
    │                  ├─ TIER 2: Claude Haiku 4.5 (Anthropic API) ──→ ~$0.001
    │                  │   (only if Workers AI errors or quota exceeded)
    │                  │
    │                  └─ TIER 3: Static fallback message ──→ 0 cost
    │                      (only if both AI providers fail)
```

### 1.2 Key Components

| Component | Location | Role |
|-----------|----------|------|
| `pipeline.ts` | `cf-chatbot/src/core/` | Orchestrator — routes through classifier → RAG → LLM with fallback |
| `ai.ts` | `cf-chatbot/src/core/` | Provider abstraction — Gemini, Claude, Workers AI implementations |
| `classifier.ts` | `cf-chatbot/src/core/` | Language detection + intent classification via Llama 3.2 1B |
| `rag.ts` | `cf-chatbot/src/core/` | Hybrid search (RRF: FTS5 + Vectorize) + context assembly |
| `d1.ts` | `cf-chatbot/src/storage/` | D1 queries — model registry, bot config, KB, prompts |
| `ModelsCatalog.tsx` | `cf-admin/components/admin/chatbot/` | Admin UI — model card grid with set primary/fallback actions |
| `BotConfig.tsx` | `cf-admin/components/admin/chatbot/` | Admin UI — config editor with model dropdowns |

### 1.3 Provider Registration System

The `ai.ts` module uses a clean provider pattern. Each provider implements `AIProvider`:

```typescript
interface AIProvider {
  generate(context, config, model, env, metadata?, startTime?): Promise<string>;
  generateStream(context, config, model, env, metadata?, startTime?): Promise<ReadableStream>;
}
```

Three providers are registered:
- `google` → `geminiProvider` (Google AI Studio API)
- `anthropic` → `claudeProvider` (Anthropic Messages API)  
- `workers-ai` → `workersAiProvider` (Cloudflare `env.AI.run()`)

The `getProvider(providerName)` switch selects the correct implementation based on the `provider` column in `model_registry`. **No code changes were needed** to support the model swap — only a D1 data update.

---

## 2. Provider Catalog — Workers AI (Cloudflare)

### 2.1 Free Tier Details

Every Cloudflare account (Free AND Paid plans) receives:

| Resource | Free Allowance | Reset |
|----------|:---:|---|
| **Neurons** | 10,000 / day | Daily at midnight UTC |
| **Models** | All models in catalog | No restrictions |
| **Requests** | Unlimited (neuron-gated) | — |

**What are neurons?** Cloudflare's unified billing unit for AI inference. Different models consume different amounts of neurons per token processed. MoE (Mixture-of-Experts) models are dramatically cheaper because only a fraction of parameters activate per inference.

### 2.2 LLM Models — Full Catalog with Neuron Costs

| Model | Params | Neurons/M Input | Neurons/M Output | Quality | Best For |
|-------|--------|:---:|:---:|---|---|
| **`@cf/qwen/qwen3-30b-a3b-fp8`** 🏆 | 30B MoE (3B active) | 4,625 | 30,475 | ⭐⭐⭐⭐ | **Primary chat — best bang-per-neuron** |
| **`@cf/google/gemma-4-26b-a4b-it`** | 26B MoE (4B active) | 9,091 | 27,273 | ⭐⭐⭐⭐ | Near-frontier quality alt |
| **`@cf/ibm-granite/granite-4.0-h-micro`** | 3B dense | 1,542 | 10,158 | ⭐⭐ | Ultra-budget FAQ |
| **`@cf/zai-org/glm-4.7-flash`** | ~9B | 5,500 | 36,400 | ⭐⭐⭐ | Multilingual, 131K context |
| `@cf/meta/llama-3.2-1b-instruct` | 1B | 2,457 | 18,252 | ⭐ | Classification only |
| `@cf/meta/llama-3.2-3b-instruct` | 3B | 4,625 | 30,475 | ⭐⭐ | Better classifier |
| `@cf/meta/llama-3.1-8b-instruct-fp8-fast` | 8B | 4,119 | 34,868 | ⭐⭐⭐ | General chat |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B | 26,668 | 204,805 | ⭐⭐⭐⭐⭐ | Near-Claude quality (expensive) |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | 24B | 31,876 | 50,488 | ⭐⭐⭐⭐ | 128K context, strong reasoning |
| `@cf/qwen/qwq-32b` | 32B | 60,000 | 90,909 | ⭐⭐⭐⭐ | Deep reasoning tasks |
| `@cf/deepseek-ai/deepseek-r1-distill-qwen-32b` | 32B | 45,170 | 443,756 | ⭐⭐⭐⭐ | Heavy reasoning (very expensive output) |
| `@cf/nvidia/nemotron-3-120b-a12b` | 120B MoE (12B) | 45,455 | 136,364 | ⭐⭐⭐⭐ | Multi-agent systems |

### 2.3 Per-Request Neuron Budget (Madagascar Chatbot)

Typical hotel chatbot turn: ~800 tokens input, ~200 tokens output.

| Model | Input Neurons | Output Neurons | **Total/Req** | **Free Requests/Day** |
|-------|:---:|:---:|:---:|:---:|
| **Granite 4.0 Micro** | 1.2 | 2.0 | **~3.2** | **~3,100** |
| **Qwen3 30B-A3B** 🏆 | 3.7 | 6.1 | **~9.8** | **~1,000** |
| **GLM 4.7 Flash** | 4.4 | 7.3 | **~11.7** | **~850** |
| **Gemma 4 26B-A4B** | 7.3 | 5.5 | **~12.8** | **~780** |
| **Llama 3.3 70B** | 21.3 | 41.0 | **~62.3** | **~160** |

> **Realistic scenario:** 15-25 conversations/day × 3-5 AI-powered turns each = **45-125 AI requests/day**. Qwen3 at ~10 neurons/req means ~450-1,250 neurons/day out of 10,000. **Massive headroom.**

### 2.4 Embedding Models

| Model | Neurons/M Input | Status |
|-------|:---:|---|
| `@cf/baai/bge-small-en-v1.5` | 1,841 | ✅ Currently used for RAG |
| `@cf/baai/bge-m3` | 1,075 | Multilingual — even cheaper |
| `@cf/qwen/qwen3-embedding-0.6b` | 1,075 | Newest, cheapest available |

---

## 3. Provider Catalog — Anthropic (Claude)

### 3.1 Available Models

| Model | Context | Input $/M | Output $/M | Role |
|-------|:---:|:---:|:---:|---|
| **Claude Haiku 4.5** | 200K | $1.00 | $5.00 | ✅ **Active Fallback** |
| Claude Sonnet 4.6 | 1M | $3.00 | $15.00 | Testing only |
| Claude Opus 4.7 | 1M | $15.00 | $75.00 | Not registered (too expensive) |

### 3.2 Key Facts

- **NOT available on Workers AI free neurons.** Claude is proprietary Anthropic software.
- **AI Gateway** can proxy requests to Anthropic for logging/caching/rate-limiting, but you still pay Anthropic's token prices.
- Prompt caching available at $0.10/1M cache reads — significantly reduces repeat costs.
- Extended thinking supported but disabled for chatbot use (`thinkingBudget: 0`).

### 3.3 Per-Request Cost Estimate (Fallback Only)

| Scenario | Input Tokens | Output Tokens | Cost/Request |
|----------|:---:|:---:|:---:|
| Typical FAQ | 800 | 200 | ~$0.0018 |
| Complex booking | 1,200 | 400 | ~$0.0032 |
| **Daily (if 100% fallback)** | — | — | ~$0.18-0.32 |

In practice, fallback triggers <5% of requests, so monthly Anthropic cost ≈ **$0.01-0.50**.

---

## 4. Provider Catalog — Google (Gemini / Gemma)

### 4.1 Gemini Models (Google AI Studio API)

| Model | Context | Input $/M | Output $/M | Thinking | Status |
|-------|:---:|:---:|:---:|---|---|
| Gemini 2.5 Flash-Lite | 1M | $0.10 | $0.40 | `thinkingBudget` | ✅ GA (Stable) |
| Gemini 2.5 Flash | 1M | $0.30 | $2.50 | `thinkingBudget` | ✅ GA |
| Gemini 2.5 Pro | 1M | $1.25 | $10.00 | `thinkingBudget` | ✅ GA |
| Gemini 3 Flash Preview | 1M | $0.50 | $3.00 | `thinkingLevel` ⚠️ | ⚠️ Preview |
| Gemini 3.1 Flash-Lite Preview | 1M | $0.25 | $1.50 | `thinkingLevel` ⚠️ | ⚠️ Preview |
| Gemini 3.1 Pro Preview | 1M | $1.25 | $10.00 | `thinkingLevel` ⚠️ | ⚠️ Preview (Paid only) |

### 4.2 ⚠️ Gemini 3.x Critical Compatibility Note

> **BREAKING CHANGE:** Gemini 3.x models use `thinkingLevel` (string: `"minimal"`, `"low"`, `"medium"`, `"high"`) instead of `thinkingBudget` (integer). Sending `thinkingBudget` to a 3.x model or `thinkingLevel` to a 2.x model causes **400 Bad Request** errors.

**How we handle it:** The `model_registry` has per-model `thinking_param` and `thinking_values` columns. The `buildThinkingConfig()` function in `ai.ts` reads the model's `thinking_param` and selects the correct format. The `bot_config.thinking_config` stores both formats: `{"thinkingBudget": 0, "thinkingLevel": "minimal"}`.

**Other Gemini 3.x gotchas:**
- "Thought signatures" must be preserved in multi-turn conversations — dropping/altering them causes API failures
- 3.1 Flash-Lite has weaker tool-calling persistence compared to 3 Flash
- All 3.x models are in Developer Preview — no SLA stability guarantees
- Gemini 3.1 Pro is **paid-only** (no free tier access)

### 4.3 Gemma Models (FREE via Google AI Studio)

| Model | Params | Context | RPM | RPD | Notes |
|-------|--------|:---:|:---:|:---:|---|
| Gemma 4 31B | 31B dense | 256K | 16 | 1,500 | Best quality, limited RPD |
| Gemma 4 26B MoE | 26B (4B active) | 256K | 16 | 1,500 | MoE efficiency |
| Gemma 3 27B | 27B | 128K | 16 | 14,000 | Highest RPD |
| Gemma 3 12B | 12B | 128K | 16 | 14,000 | Good balance |
| Gemma 3 4B | 4B | 128K | 16 | 14,000 | Fast, lower quality |

> **Note:** Gemma models are also available on Workers AI via `@cf/google/gemma-*` model IDs, consuming from the 10K neuron pool instead of Google API quotas.

---

## 5. Quality Rankings vs Claude Haiku 4.5

Based on MMLU, SWE-bench, Arena, LiveBench benchmarks:

| Rank | Model | Quality vs Haiku | Notes |
|:---:|---|---|---|
| 1 | **Claude Haiku 4.5** | 100% (baseline) | 73.3% SWE-bench |
| 2 | Llama 3.3 70B | ~75-80% | Very expensive in neurons |
| 3 | **Gemma 4 26B-A4B** | ~65-70% | Outstanding per-parameter |
| 4 | **Qwen3 30B-A3B** 🏆 | ~60-65% | Exceptional value |
| 5 | Mistral Small 3.1 | ~55-60% | Strong 128K + reasoning |
| 6 | Llama 3.1 8B | ~40-45% | Solid general purpose |
| 7 | GLM 4.7 Flash | ~40-45% | Great long docs, weaker reasoning |
| 8 | Granite 4.0 Micro | ~30-35% | Cheapest, simple FAQ only |

> **For hotel customer-service** (FAQ, booking redirects, service info), the quality gap narrows significantly. The chatbot needs instruction following, multilingual support, and RAG grounding — not coding or advanced reasoning. **Qwen3-30B-A3B delivers ~85-90% of Claude's quality for this use case at $0 cost.**

---

## 6. Cost Analysis

### 6.1 Before vs After Migration

| Metric | Before (Claude Primary) | After (Workers AI Primary) |
|--------|---|---|
| **Primary Model** | Claude Haiku 4.5 | Qwen3 30B-A3B (Workers AI) |
| **Fallback Model** | Claude Sonnet 4.6 | Claude Haiku 4.5 |
| **Daily AI Cost** | ~$0.05-0.15 (Anthropic) | **$0** (free tier) |
| **Monthly AI Cost** | ~$1.50-4.50 | **~$0** |
| **Quality (hotel FAQ)** | Excellent | Very Good (85-90% of Claude) |
| **Latency** | ~600-800ms (API roundtrip) | **~200-400ms (edge inference)** |
| **Reliability** | Single provider | Dual fallback chain |
| **Capacity** | Unlimited (pay per use) | ~1,000 AI req/day free |

### 6.2 Scaling Projections

| Daily AI Requests | Workers AI Neurons Used | Overage? | Total Monthly Cost |
|:---:|:---:|---|:---:|
| 50 | ~500 | No (5% of budget) | **$0** |
| 200 | ~2,000 | No (20% of budget) | **$0** |
| 500 | ~5,000 | No (50% of budget) | **$0** |
| 1,000 | ~10,000 | At limit | **$0** (fallback kicks in) |
| 2,000 | ~20,000 | Yes | ~$0.55/mo (Workers Paid plan) |

---

## 7. Model Selection Matrix

Decision framework for choosing models per use case:

| Use Case | Recommended Model | Provider | Why |
|----------|---|---|---|
| **Primary chat (production)** | `@cf/qwen/qwen3-30b-a3b-fp8` | Workers AI | Best quality/neuron ratio |
| **Premium fallback** | `claude-haiku-4-5` | Anthropic | Highest quality safety net |
| **Budget primary (high volume)** | `@cf/ibm-granite/granite-4.0-h-micro` | Workers AI | 3x cheaper than Qwen3 |
| **Multilingual heavy** | `@cf/zai-org/glm-4.7-flash` | Workers AI | 100+ languages, 131K context |
| **Classification** | `@cf/meta/llama-3.2-1b-instruct` | Workers AI | Cheapest possible (~0.3 neurons) |
| **RAG embeddings** | `@cf/baai/bge-small-en-v1.5` | Workers AI | Already integrated, proven |
| **Testing/evaluation** | `claude-sonnet-4-6` | Anthropic | Premium quality benchmark |

---

## 8. Operational Playbook

### 8.1 How to Swap Models

Models can be swapped via:

1. **Admin UI:** Navigate to Chatbot Hub → Models → Click "Set Primary" or "Set Fallback" on any model card.
2. **Admin API:** `POST /api/chatbot/models/switch` with `{"role": "primary", "model_id": "@cf/qwen/qwen3-30b-a3b-fp8"}`.
3. **Direct D1:** `UPDATE bot_config SET primary_model_id = '<model_id>' WHERE id = 1;`

Changes take effect immediately — no Worker redeployment needed.

### 8.2 Adding New Models

1. Insert into `model_registry` via D1 migration or Admin API.
2. The `ModelsCatalog.tsx` UI auto-discovers new models.
3. Ensure the `provider` column matches a registered provider in `ai.ts` (`google`, `anthropic`, or `workers-ai`).

### 8.3 Monitoring Neuron Usage

- **Cloudflare Dashboard:** Workers & Pages → AI → Usage tab shows daily neuron consumption.
- **Per-request:** The pipeline metadata tracks `inputTokens`, `outputTokens`, `modelUsed`, and `costEstimate` — stored in Supabase `messages` table.

### 8.4 Handling Quota Exceeded

When the 10K neuron daily limit is reached:
1. Workers AI returns an error response.
2. `pipeline.ts` catches the error in the try/catch block (line ~187).
3. Automatically falls back to Claude Haiku 4.5 via Anthropic API.
4. If Anthropic also fails, returns the static fallback message from `bot_config`.

No manual intervention required — the fallback chain is fully automatic.

---

## 9. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|:---:|:---:|---|
| Workers AI quality < Claude for edge cases | Medium | Medium | Fallback chain catches this automatically |
| 10K neuron quota exceeded on busy days | Low | Low (need 1000+ AI req) | Auto-fallback to Anthropic; monitor dashboard |
| Model deprecation on Workers AI | Low | Low | Multiple models registered; easy swap via Admin UI |
| Streaming format differences | Low | Very Low | Already handled in `normalizeProviderStream()` |
| Workers AI cold starts / rate limits | Medium | Low | Retry logic + fallback already in pipeline |
| Gemini 3.x Preview instability | Medium | Medium | Don't use as primary; keep as optional testing model |

---

## 10. Migration History

| Migration | Date | Changes |
|-----------|------|---------|
| `0002_seed_models.sql` | 2026-04-15 | Initial model registry: Gemini, Gemma, Claude, Workers AI classifiers |
| `0006_workers_ai_models.sql` | 2026-04-17 | Added Llama 3.1/3.3, Mistral Small, DeepSeek R1, Kimi K2.5 |
| `0012_fix_config_and_models.sql` | 2026-04-22 | Increased max_tokens 350→1024, disabled thinking, added Gemini 3.1 Pro |
| **`0013_workers_ai_primary_migration.sql`** | **2026-04-23** | **Added Qwen3/Gemma4/Granite/GLM chat models. Swapped primary to Workers AI, fallback to Claude Haiku. Fixed dual-format thinking_config.** |

---

## 11. What You CANNOT Do

- ❌ Run Claude Haiku/Opus/Sonnet on Workers AI neurons — Claude is proprietary Anthropic software
- ❌ Get Anthropic-quality models for free through Cloudflare
- ❌ Use AI Gateway to bypass Anthropic billing — it's a proxy, not a credit substitute
- ❌ Use Gemini 3.1 Pro on free tier — it's paid-only

## 12. What You CAN Do

- ✅ Run 25+ powerful open-weight LLMs on 10K free neurons/day
- ✅ Get 85-90% of Claude's quality for hotel FAQ at $0/month
- ✅ Use Workers AI as primary + Claude as premium fallback
- ✅ Leverage edge inference for lower latency (~200-400ms vs ~600-800ms)
- ✅ Use AI Gateway for caching, analytics, and fallback routing (free features)
- ✅ Swap models instantly via Admin UI with zero downtime

{% endraw %}
