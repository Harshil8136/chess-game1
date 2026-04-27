{% raw %}
# Chatbot Integration & AI Infrastructure — CF-Admin

> **Status:** ✅ Deployed
> **Last Updated:** 2026-04-23 (Workers AI primary migration)
> **RLS Policy:** All chatbot tables (`chat_analytics`, `contacts`, `conversations`, `messages`) locked to `service_role` only. See [SECURITY.md](./SECURITY.md).

---

## 1. Proxy Architecture

`cf-admin` serves as the secure administrative interface for the Madagascar AI Chatbot (`cf-chatbot`). Since `cf-chatbot` has no built-in admin auth, `cf-admin` brokers all administrative commands through a monolithic Astro SSR proxy.

**Proxy endpoint:** `src/pages/api/chatbot/[...path].ts`

Every request through the proxy:
1. Blocks unauthenticated requests (session check)
2. Validates user RBAC clearance against required role
3. Appends `CHATBOT_ADMIN_API_KEY` to securely handshake with `cf-chatbot`

### Required Secrets (both Workers)

| Worker | Secret | Value |
|--------|--------|-------|
| `cf-admin` | `CHATBOT_WORKER_URL` | `http://localhost:8787` (local) or production Worker URL |
| `cf-admin` | `CHATBOT_ADMIN_API_KEY` | 64-character UUID-like string |
| `cf-chatbot` | `ADMIN_API_KEY` | Must exactly match `CHATBOT_ADMIN_API_KEY` |

> **Security rule:** Never expose `cf-chatbot` endpoint URLs to the client boundary. All URLs are server-side only.

---

## 2. UI Component System

All chatbot admin panels are Preact islands co-located in `src/components/admin/chatbot/`. Reads use standard component mounts; writes use the `mutate()` pipeline inside `useChatbotApi.ts`.

**Custom hook:** `src/components/admin/chatbot/hooks/useChatbotApi.ts`
- `useChatbotApi('analytics')` — fetches data on mount
- `mutate(method, path, body)` — fires POST/PUT/DELETE; calls `refetch()` on success
- Never caches sensitive payloads client-side — always re-fetches from the proxy

| Component | File | Purpose |
|-----------|------|---------|
| **AnalyticsDashboard** | `AnalyticsDashboard.tsx` | Real-time message telemetry, session gauges, performance logs |
| **BotConfig** | `BotConfig.tsx` | AI hyperparameters (`temperature`, `max_history_turns`), model dropdowns, fallback messages |
| **ModelsCatalog** | `ModelsCatalog.tsx` | Authorized model grid with Set Primary / Set Fallback actions |
| **KnowledgeBase** | `KnowledgeBase.tsx` | CRUD for KB entries across `content_en` / `content_es` |
| **ConversationsManagement** | `ConversationsBrowser.tsx` | End-to-end session viewer, deep context retrieval, cron session sweeping |
| **PromptsEditor** | `PromptsEditor.tsx` | System prompt management |
| **UsageAnalytics** | `UsageAnalytics.tsx` | Token usage, neuron consumption, cost tracking |

All panels maintain the **Midnight Slate** aesthetic per standard cf-admin rules.

---

## 3. AI Tiered Fallback Pipeline

```
User Message
    │
    ├── Classifier (Llama 3.2 1B — Workers AI)  ~0.3 neurons
    │      │
    │      ├── greeting / farewell / thanks   → Static response (0 cost)
    │      ├── human_request                  → Escalation email (0 cost)
    │      │
    │      └── faq / booking / pricing / complaint / unknown
    │            │
    │            ├── RAG Embedding (BGE-Small — Workers AI)  ~0.1 neurons
    │            │
    │            └── Main LLM Generation
    │                  │
    │                  ├─ TIER 1: Workers AI (Qwen3-30B-A3B)  ~10 neurons  ← FREE
    │                  ├─ TIER 2: Claude Haiku 4.5 (Anthropic API)  ~$0.001  ← only if T1 errors
    │                  └─ TIER 3: Static fallback message  ← only if both fail
```

**Key files:** `cf-chatbot/src/core/pipeline.ts` (orchestrator), `cf-chatbot/src/core/ai.ts` (provider abstraction), `cf-chatbot/src/core/classifier.ts`, `cf-chatbot/src/core/rag.ts`

---

## 4. Workers AI — Free Tier & Model Catalog

Every Cloudflare account receives **10,000 neurons/day** free (resets midnight UTC). All models in the catalog are accessible.

**What are neurons?** Cloudflare's unified billing unit. MoE models are cheaper because only a fraction of parameters activate per inference.

### LLM Models

| Model | Params | Neurons/M Input | Neurons/M Output | Quality | Use Case |
|-------|--------|:---:|:---:|:---:|---|
| `@cf/qwen/qwen3-30b-a3b-fp8` 🏆 | 30B MoE (3B active) | 4,625 | 30,475 | ⭐⭐⭐⭐ | **Primary chat — best value** |
| `@cf/google/gemma-4-26b-a4b-it` | 26B MoE (4B active) | 9,091 | 27,273 | ⭐⭐⭐⭐ | Near-frontier quality alt |
| `@cf/ibm-granite/granite-4.0-h-micro` | 3B dense | 1,542 | 10,158 | ⭐⭐ | Ultra-budget FAQ |
| `@cf/zai-org/glm-4.7-flash` | ~9B | 5,500 | 36,400 | ⭐⭐⭐ | Multilingual, 131K context |
| `@cf/meta/llama-3.2-1b-instruct` | 1B | 2,457 | 18,252 | ⭐ | Classification only |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B | 26,668 | 204,805 | ⭐⭐⭐⭐⭐ | Near-Claude quality (expensive) |

### Per-Request Neuron Budget (typical hotel chatbot: ~800 input / ~200 output tokens)

| Model | Total Neurons/Req | Free Requests/Day |
|-------|:---:|:---:|
| Granite 4.0 Micro | ~3.2 | ~3,100 |
| **Qwen3 30B-A3B** 🏆 | **~9.8** | **~1,000** |
| Llama 3.3 70B | ~62.3 | ~160 |

**Realistic load:** 15-25 conversations/day × 3-5 AI turns each = 45-125 AI requests/day. Qwen3 at ~10 neurons/req = 450-1,250 neurons/day out of 10,000. **Massive headroom.**

### Embedding Models

| Model | Neurons/M Input | Status |
|-------|:---:|---|
| `@cf/baai/bge-small-en-v1.5` | 1,841 | ✅ Currently used for RAG |
| `@cf/baai/bge-m3` | 1,075 | Multilingual — even cheaper |
| `@cf/qwen/qwen3-embedding-0.6b` | 1,075 | Newest, cheapest |

---

## 5. Claude (Anthropic) — Fallback Provider

| Model | Context | Input $/M | Output $/M | Role |
|-------|:---:|:---:|:---:|---|
| **Claude Haiku 4.5** | 200K | $1.00 | $5.00 | ✅ **Active fallback** |
| Claude Sonnet 4.6 | 1M | $3.00 | $15.00 | Testing/evaluation only |
| Claude Opus 4.7 | 1M | $15.00 | $75.00 | Not registered |

Claude is **NOT** available on Workers AI free neurons — it's proprietary Anthropic software. AI Gateway can proxy requests but you still pay Anthropic's token prices. Monthly fallback cost ≈ **$0.01-0.50** (fallback triggers <5% of requests).

---

## 6. Google (Gemini) — Optional Provider

| Model | Context | Input $/M | Output $/M | Notes |
|-------|:---:|:---:|:---:|---|
| Gemini 2.5 Flash-Lite | 1M | $0.10 | $0.40 | ✅ GA (Stable) |
| Gemini 2.5 Flash | 1M | $0.30 | $2.50 | ✅ GA |
| Gemini 2.5 Pro | 1M | $1.25 | $10.00 | ✅ GA |

> ⚠️ **Gemini 3.x Breaking Change:** Uses `thinkingLevel` (string: `"minimal"`, `"low"`, `"medium"`, `"high"`) instead of `thinkingBudget` (integer). Sending the wrong param causes 400. Handled via `thinking_param` column in `model_registry` and `buildThinkingConfig()` in `ai.ts`.

---

## 7. Provider Abstraction & Model Registry

`cf-chatbot/src/core/ai.ts` uses a clean provider pattern:

```typescript
interface AIProvider {
  generate(context, config, model, env, metadata?, startTime?): Promise<string>;
  generateStream(context, config, model, env, metadata?, startTime?): Promise<ReadableStream>;
}
```

Three providers registered: `google` → `geminiProvider`, `anthropic` → `claudeProvider`, `workers-ai` → `workersAiProvider`.

Model selection is driven entirely by the `provider` column in the D1 `model_registry` table — **no code changes needed to swap models**.

### How to Swap Models

1. **Admin UI:** Chatbot Hub → Models → "Set Primary" or "Set Fallback" on any card
2. **Admin API:** `POST /api/chatbot/models/switch` with `{"role": "primary", "model_id": "..."}`
3. **Direct D1:** `UPDATE bot_config SET primary_model_id = '<model_id>' WHERE id = 1`

Changes take effect immediately — no Worker redeployment needed.

### Adding a New Model

1. Insert into `model_registry` via D1 migration or Admin API
2. The `ModelsCatalog.tsx` UI auto-discovers new models
3. Ensure `provider` column matches a registered provider in `ai.ts`

---

## 8. Migration History

| Migration | Date | Changes |
|-----------|------|---------|
| `0002_seed_models.sql` | 2026-04-15 | Initial model registry: Gemini, Gemma, Claude, Workers AI classifiers |
| `0006_workers_ai_models.sql` | 2026-04-17 | Added Llama 3.1/3.3, Mistral Small, DeepSeek R1 |
| `0012_fix_config_and_models.sql` | 2026-04-22 | Increased max_tokens 350→1024, disabled thinking |
| `0013_workers_ai_primary_migration.sql` | 2026-04-23 | Added Qwen3/Gemma4/Granite/GLM. Swapped primary to Workers AI, fallback to Claude Haiku |

---

## 9. Enterprise Analytics Command Center

### Overview

Analytics shifted from tracking raw technical metrics to tracking **customer outcomes**. The `AnalyticsDashboard.tsx` is driven entirely by live Supabase data via two Mega-RPCs.

### 3-Pillar Dashboard Layout

**Tier 1 — Executive ROI:**
- Containment Rate (AI-resolved without human escalation)
- Global CSAT (average satisfaction score)
- Cost per Resolution (total API cost ÷ contained sessions)
- Average Handle Time

**Tier 2 — AI Quality & Diagnostics:**
- Volume, Fallback Rate, Escalation Rate, Abandonment Rate
- Model Distribution (which LLM handles what share of traffic, latency, KB hit rates)
- Top Intents (semantic intent bar chart)

**Tier 3 — Actionable Intelligence (Clustered KB Gaps):**
- Grouped topic clusters of failed queries with volume, sample queries, last-seen timestamp
- Enables prioritizing the most impactful knowledge base additions

### Backend Architecture

**Supabase schema additions (Migration 0004):**
- `feedback_events` table — CSAT scores/comments tied to conversations
- `conversation_metrics` extensions — `containment_status`, `csat_score`, `fallback_count`, `user_device`, `user_country`
- `kb_gaps` extensions — `cluster_topic` column for grouping

**Mega-RPCs (two reads per page load):**
- `get_command_center_analytics(p_days)` — aggregates executive/operations/model/intent data for a given period
- `get_kb_clusters(p_resolved)` — groups kb_gaps by cluster_topic using `jsonb_agg`

**Zero-blocking telemetry:** `cf-chatbot/src/storage/supabase.ts` uses `Promise.allSettled` for fire-and-forget inserts after response is sent — zero latency added to chat experience.

**Admin API routes** (protected by `X-Admin-Key`):
- `GET /admin/analytics/command-center?days=N`
- `GET /admin/analytics/kb-clusters?resolved=false`

### Cost Impact
- Zero additional AI tokens (SQL aggregations only)
- Two optimized RPC reads per dashboard load
- Zero additional Worker costs

### Future Enhancements
1. **CSAT UI Widget** — thumbs up/down widget in chat interface to populate `feedback_events`
2. **Background AI Clustering Cron** — scheduled Worker to assign `cluster_topic` to unclustered `kb_gaps` rows

---

## 10. What You Cannot Do

- ❌ Run Claude Haiku/Sonnet/Opus on Workers AI neurons — Claude is proprietary
- ❌ Get Anthropic-quality for free via Cloudflare
- ❌ Use AI Gateway to bypass Anthropic billing — it's a proxy, not a credit substitute
- ❌ Use Gemini 3.1 Pro on free tier — paid-only

{% endraw %}
