---

title: "Chatbot Integration & AI Infrastructure — CF-Admin"
status: active
audience: [ai, technical]
last_verified: 2026-09-14
verified_against: [code]
owner: harshil
related_code: ["src/pages/api/chatbot/[...path].ts", src/lib/chatbot-proxy.ts, src/components/admin/chatbot/hooks/useChatbotApi.ts, src/lib/auth/routes.ts]
related_docs: [AI-HEALTH.md, ../security/SECURITY.md, ../architecture/PERMISSIONS-SYSTEM.md, ../records/reports/2026-08-31-ai-system-overhaul.md]
tags: [chatbot, ai, proxy, models, analytics]
---

# Chatbot Integration & AI Infrastructure — CF-Admin

> **TL;DR (non-technical):** How the customer-facing AI chatbot is configured and monitored from the admin portal — which AI models it uses, and how its analytics and conversations are surfaced.

> **Status:** ✅ Deployed
> **Last Updated:** 2026-09-19 — §3–§8 rebuilt from the live `chatbot-kb` D1 and the `cf-chatbot` checkout; they had described the April 2026 architecture. Earlier corrections 2026-08-31 and 2026-09-14 (see §11).
> **RLS Policy:** RLS is enabled on every chatbot table in the shared Supabase project — `chat_analytics`, `contacts`, `conversations`, `messages`, plus `intent_events`, `kb_gaps`, `conversation_metrics`, `feedback_events` and `tool_call_events`, which this note used to omit. Policy *content* has not been re-read; only that RLS is on. See [SECURITY.md](../security/SECURITY.md). *Corrected 2026-09-19.*
>
> **Scope note.** This document is cf-admin's view: the proxy, the admin UI, and enough of the pipeline to operate it. `cf-chatbot` owns the pipeline itself; where the two disagree, the live `bot_config` row and the `cf-chatbot` repository win.

---

## 1. Proxy Architecture

`cf-admin` serves as the administrative interface for the Madagascar AI Chatbot (`cf-chatbot`), brokering every administrative command through a monolithic Astro SSR proxy so that RBAC, PLAC and the audit trail apply to them.

> *Corrected 2026-09-19 — this said "`cf-chatbot` has no built-in admin auth".* It does: `cf-chatbot/src/admin/api.ts` compares an `X-Admin-Key` header or a `Bearer` token in constant time against its own `ADMIN_API_KEY` / `CHATBOT_ADMIN_API_KEY`. The proxy exists for governance, not because the other side is unguarded.

**Proxy endpoint:** `src/pages/api/chatbot/[...path].ts`

Every request through the proxy:

1. Blocks unauthenticated requests (session check)
2. Validates user RBAC clearance against required role
3. Calls `cf-chatbot` over the `CHATBOT_SERVICE` service binding first, falling back to HTTP against `CHATBOT_WORKER_URL`; `CHATBOT_ADMIN_API_KEY` is appended only when it is configured (`src/lib/chatbot-proxy.ts`). *Corrected 2026-09-14.*

> ⚠️ **Open security issue — the trust signal on the service-binding path is not a secret.** On the binding call the proxy also sends a fixed, build-time-constant trust header. `cf-chatbot` authorizes its **entire** `/admin/*` surface on that constant alone: it does not verify that the request actually arrived over a service binding, and it routes `/admin*` on its public custom domain. Anyone who learns the pair can therefore reach chatbot config, prompts, the knowledge base, model switching, conversations including send-message, and the paid-LLM `/admin/test` endpoint — without any cf-admin session.
>
> Neither the header name nor its value is recorded in this repository's documentation, and **neither is to be reintroduced** into any published doc. The value was redacted from the AI-overhaul record on 2026-09-19; the names live in code only.
>
> **The fix is in `cf-chatbot`, not here:** make it require the real shared secret even over the binding, then rotate. Removing the constant from cf-admin alone would break the proxy without closing anything. Found by code reading on 2026-09-19; not probed live.

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
- `mutate(path, method, body)` — fires POST/PUT/DELETE and returns the parsed body (throws on error); callers call `refetch()` themselves. *Corrected 2026-09-14 — this said `mutate` refetches.*
  (Documented here as `mutate(method, path, body)` until 2026-08-31 — the first
  two arguments were reversed, which is exactly the kind of error a reader
  copies straight into a bug.)
- Never caches sensitive payloads client-side — always re-fetches from the proxy

| Component | File | Purpose |
|-----------|------|---------|
| **AnalyticsDashboard** | `AnalyticsDashboard.tsx` | AI Command Center (`/dashboard/chatbot/analytics`), served by `/api/chatbot/analytics/command-center` and `/analytics/kb-clusters` |
| **BotConfig** | `BotConfig.tsx` (+ `BotConfigShared.tsx`, `BotConfigThinkingSection.tsx`) | AI hyperparameters (`ai_temperature`, `max_history_turns`), model dropdowns, fallback messages |
| **ModelsCatalog** | `ModelsCatalog.tsx` | Authorized model grid with Set Primary / Set Fallback actions |
| **KnowledgeBase** | `KnowledgeBase.tsx` | CRUD for KB entries across `content_en` / `content_es` |
| **ConversationsBrowser** | `ConversationsBrowser.tsx` | Channel/status filters, paginated conversation table, message-thread modal with per-message AI metadata, status / takeover / release-to-AI / send-message actions. *2026-09-14: this row claimed "cron session sweeping"; no such feature exists in cf-admin.* |
| **PromptsEditor** | `PromptsEditor.tsx` | System prompt management |
| **UsageAnalytics** | `UsageAnalytics.tsx` | Token usage, neuron consumption, cost tracking |
| **ChatbotDashboard** | `ChatbotDashboard.tsx` | Overview page (`/dashboard/chatbot/dashboard`), served by the bare `/api/chatbot/analytics` |
| **ChatbotSubnav** | `ChatbotSubnav.tsx` | The "AI Models" / hub sub-navigation |

All panels maintain the **Midnight Slate** aesthetic per standard cf-admin rules.

---

## 3. AI Tiered Fallback Pipeline

*Rewritten 2026-09-19 from the live `chatbot-kb` `bot_config` row. The previous
version described the April 2026 arrangement — a free Workers AI Qwen3 primary
with Claude only on error — which has not been true since migration `0015`.*

```
User Message
    │
    ├── Language + intent classifier (Llama 4 Scout 17B — Workers AI)
    │      │      (config.classifier_model; short phrases skip the model entirely)
    │      │
    │      ├── greeting / farewell / thanks   → Static response (0 cost)
    │      ├── human_request                  → Escalation email (0 cost)
    │      │
    │      └── faq / booking / pricing / complaint / unknown
    │            │
    │            ├── RAG embedding (BGE-Small — Workers AI)
    │            │
    │            └── Main LLM generation
    │                  │
    │                  ├─ PRIMARY:  gemini-3.5-flash (Google, paid)
    │                  ├─ FALLBACK: claude-haiku-4-5 (Anthropic, paid)
    │                  └─ LAST:     static fallback message
```

Live values, read 2026-09-19:

| `bot_config` column | Value | Provider |
|---|---|---|
| `primary_model_id` | `gemini-3.5-flash` | google (paid) |
| `fallback_model_id` | `claude-haiku-4-5` | anthropic (paid) |
| `classifier_model` | `@cf/meta/llama-4-scout-17b-16e-instruct` | workers-ai (neurons) |

Two consequences the old text hid:

- **Customer messages go to Google.** The primary path is a paid third-party
  processor, not free Workers AI inference. That is a data-processing fact for
  the privacy record, not just a cost one.
- **Only the classifier and the embeddings spend neurons** — and they run on
  *every* inbound message, from the same account-wide 10,000/day allocation
  that cf-admin's own AI features draw on. See §4.

**Key files:** `cf-chatbot/src/core/pipeline.ts` (orchestrator), `cf-chatbot/src/core/ai.ts` (provider abstraction), `cf-chatbot/src/core/classifier.ts`, `cf-chatbot/src/core/rag.ts`

---

## 4. Workers AI — Free Tier & Model Catalog

Every Cloudflare account receives **10,000 neurons/day** free (resets midnight UTC). All models in the catalog are accessible.

**What are neurons?** Cloudflare's unified billing unit. MoE models are cheaper because only a fraction of parameters activate per inference.

> **The allocation is per account, and two apps share it.** *Corrected
> 2026-09-19 — this section, like `AI-HEALTH.md`, described the pool as though
> only its own app drew on it.* `cf-chatbot` spends neurons on the Llama 4
> Scout classifier and BGE embeddings for every inbound message; `cf-admin`
> spends them on blog generation and AI visibility extraction and meters itself
> against the same 10,000 in Upstash. Neither counter can see the other, so
> **neither is the account total** — cf-admin's soft limit can trip while its
> own panel shows headroom, and vice versa. The only authoritative figure is
> Workers AI usage in the Cloudflare dashboard. See
> [`AI-HEALTH.md`](AI-HEALTH.md) §3.

### LLM Models

These are registered and switchable, but **none of them is the live primary**
(see §3). Prices are Workers AI neuron rates as recorded when this table was
written; they have not been re-fetched from Cloudflare.

| Model | Params | Neurons/M Input | Neurons/M Output | Role today |
|-------|--------|:---:|:---:|---|
| `@cf/meta/llama-4-scout-17b-16e-instruct` | 17B MoE | 24,545 | 77,273 | **Live classifier** — runs on every inbound message |
| `@cf/qwen/qwen3-30b-a3b-fp8` | 30B MoE (3B active) | 4,625 | 30,475 | Registered; also cf-admin's extraction default |
| `@cf/google/gemma-4-26b-a4b-it` | 26B MoE (4B active) | 9,091 | 27,273 | Registered alternative |
| `@cf/ibm-granite/granite-4.0-h-micro` | 3B dense | 1,542 | 10,158 | Registered — ultra-budget FAQ |
| `@cf/zai-org/glm-4.7-flash` | ~9B | 5,500 | 36,400 | Registered — multilingual, 131K context |
| `@cf/meta/llama-3.2-1b-instruct` | 1B | 2,457 | 18,252 | Registered; **was** the classifier until migration `0016` |
| `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | 70B | 26,668 | 204,805 | Registered — expensive |

*Corrected 2026-09-19: the Qwen3 row was marked "🏆 Primary chat — best value",
and a "Per-Request Neuron Budget" table concluded **"Massive headroom"** from a
Qwen3 primary that has not existed since migration `0015`. Both are removed
rather than restated: with the chat path on paid Gemini, the meaningful budget
question is the shared account allocation above, and the per-request estimates
were never measured against live telemetry.*

### Embedding Models

| Model | Neurons/M Input | Status |
|-------|:---:|---|
| `@cf/baai/bge-small-en-v1.5` | 1,841 | ✅ Currently used for RAG |
| `@cf/baai/bge-m3` | 1,075 | Multilingual — even cheaper |
| `@cf/qwen/qwen3-embedding-0.6b` | 1,075 | Newest, cheapest |

---

## 5. Claude (Anthropic) — Fallback Provider

Prices below are the `model_registry` values read live on 2026-09-19, not
list prices from a vendor page.

| Model | `model_id` | Context | Input $/M | Output $/M | Role |
|-------|---|:---:|:---:|:---:|---|
| **Claude Haiku 4.5** | `claude-haiku-4-5` | 200K | $1.00 | $5.00 | ✅ **Active fallback** (`bot_config.fallback_model_id`) |
| Claude Sonnet 4.6 | `claude-sonnet-4-6` | 1M | $3.00 | $15.00 | Registered |
| Claude Sonnet 5 | `claude-sonnet-5` | 1M | $2.00 | $10.00 | Registered |
| Claude Opus 4.7 | `claude-opus-4-7` | 1M | $5.00 | $25.00 | Registered |
| Claude Opus 4.8 | `claude-opus-4-8` | 1M | $5.00 | $25.00 | Registered |
| Claude Fable 5 | `claude-fable-5` | 1M | $10.00 | $50.00 | Registered |

*Corrected 2026-09-19: Opus 4.7 was listed at $15/$75 and "Not registered". It
has been registered since migration `0014` at $5.00/$25.00, and four further
Anthropic models have been added since.*

Claude is **NOT** available on Workers AI free neurons — it is proprietary Anthropic software. AI Gateway can proxy requests but you still pay Anthropic's token prices.

> The old "monthly fallback cost ≈ $0.01–0.50 (fallback triggers <5% of
> requests)" is removed. It assumed a free primary; with `gemini-3.5-flash` on
> the primary path at $1.50/$9.00 per M, the chat spend is the Google line, not
> the Anthropic one, and neither figure has been measured against live volume.
> Use the Usage Analytics panel rather than this document for cost.

---

## 6. Google (Gemini) — the live primary provider

*Retitled and rebuilt 2026-09-19: this was headed "Optional Provider". Google
has carried the primary chat path since migration `0015`.*

Registered, not deprecated, read live on 2026-09-19:

| Model | `model_id` | Context | Input $/M | Output $/M | Notes |
|-------|---|:---:|:---:|:---:|---|
| **Gemini 3.5 Flash** | `gemini-3.5-flash` | 1M | $1.50 | $9.00 | ✅ **Live primary** |
| Gemini 3.1 Pro | `gemini-3.1-pro` | 1M | $2.00 | $12.00 | Registered |
| Gemini 3.1 Flash-Lite | `gemini-3.1-flash-lite` | 1M | $0.25 | $1.50 | Registered |
| Gemini 2.5 Pro | `gemini-2.5-pro` | 1M | $1.25 | $10.00 | Registered |
| Gemini 2.5 Flash | `gemini-2.5-flash` | 1M | $0.30 | $2.50 | Registered |
| Gemini 2.5 Flash-Lite | `gemini-2.5-flash-lite` | 1M | $0.10 | $0.40 | Registered |

The registry also carries the Gemma open models at $0/$0 and several rows
flagged `is_deprecated = 1` (`gemini-2.0-flash`, `gemini-2.0-flash-lite`,
`gemini-3-flash-preview`, and the `-preview` duplicates of the 3.1 models).
`ModelsCatalog.tsx` reads the table directly, so the UI is the current list.

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

1. **Admin UI:** Chatbot → "AI Models" sub-nav → "Set Primary" or "Set Fallback" on any card
2. **Admin API:** `POST /api/chatbot/models/switch` with `{"role": "primary", "model_id": "..."}`
3. **Direct D1:** `UPDATE bot_config SET primary_model_id = '<model_id>' WHERE id = 1`

Changes take effect immediately — no Worker redeployment needed.

### Adding a New Model

1. Insert into `model_registry` via D1 migration or Admin API
2. The `ModelsCatalog.tsx` UI auto-discovers new models
3. Ensure `provider` column matches a registered provider in `ai.ts`

---

## 8. Migration History

*Extended 2026-09-19 — this table stopped at `0013`, nine migrations behind.
`cf-chatbot/migrations/` holds 22 files, up to `0022`.*

| Migration | Date | Changes |
|-----------|------|---------|
| `0002_seed_models.sql` | 2026-04-15 | Initial model registry: Gemini, Gemma, Claude, Workers AI classifiers |
| `0006_workers_ai_models.sql` | 2026-04-17 | Added Llama 3.1/3.3, Mistral Small, DeepSeek R1 |
| `0012_fix_config_and_models.sql` | 2026-04-22 | Increased max_tokens 350→1024, disabled thinking |
| `0013_workers_ai_primary_migration.sql` | 2026-04-23 | Added Qwen3/Gemma4/Granite/GLM. Swapped primary to Workers AI, fallback to Claude Haiku |
| `0014_add_claude_opus47.sql` | — | Registered Claude Opus 4.7 at $5.00/$25.00 |
| `0015_update_ai_models_2026.sql` | — | **Moved the primary off Workers AI to a Google model** |
| `0016_add_llama4_classifier.sql` | — | Classifier moved from Llama 3.2 1B to Llama 4 Scout 17B |
| `0017_fix_model_registry_regressions.sql` | — | Registry repairs |
| `0018_add_max_history_tokens.sql` | — | `max_history_tokens` config |
| `0019_add_tool_calling_support.sql` | — | `supports_tools` column |
| `0020_add_business_id_and_branding.sql` | — | Multi-business fields |
| `0021_haiku_fallback_swap.sql` | — | Fallback set to `claude-haiku-4-5` |
| `0022_update_google_aistudio_models.sql` | — | Current Google catalog, incl. `gemini-3.5-flash` |

Dates for `0014`–`0022` are not recorded here; read them from the `cf-chatbot` git history rather than assuming.

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

> ⚠️ **The knowledge-gaps panel has no data source yet.** `cluster_topic` is
> populated by the "Background AI Clustering Cron" listed under §9 Future
> Enhancements — which has not been built. The panel is therefore empty because
> nothing writes to it, not because the bot has no gaps. Until 2026-08-31 it
> rendered "No knowledge gaps detected yet. The AI is answering all queries
> successfully.", which stated a conclusion no measurement supported. Do not
> reintroduce a reassuring empty state here.

**Zero-blocking telemetry:** `cf-chatbot/src/storage/supabase.ts` uses `Promise.allSettled` for fire-and-forget inserts after response is sent — zero latency added to chat experience.

**Admin API routes** (protected by `X-Admin-Key`):

- `GET /admin/analytics/command-center?days=N`
- `GET /admin/analytics/kb-clusters?resolved=false`

### Cost Impact

- Zero additional AI tokens (SQL aggregations only)
- Two optimized RPC reads per dashboard load
- Zero additional Worker costs

### Future Enhancements

1. **Background AI Clustering Cron** — scheduled Worker to assign `cluster_topic` to unclustered `kb_gaps` rows. Still unbuilt; this is why the knowledge-gaps panel is empty.

*Corrected 2026-09-19: "CSAT UI Widget" was listed here as future work. It
exists — `cf-chatbot/src/channels/web/chat.ts` calls the `feedback_events`
insert in `cf-chatbot/src/storage/supabase.ts`, and the live table holds rows.
The 2026-09-14 verification log claimed to have found "no writer of
`cluster_topic` / `feedback_events` in either checkout" while also listing
cf-chatbot as not on disk; the checkout is at `E:\1\Madagascar Project\cf-chatbot`.
Global CSAT on the dashboard is therefore a real, if thin, measurement — treat
a low sample count as low confidence, not as absence.*

---

## 10. What You Cannot Do

- ❌ Run Claude Haiku/Sonnet/Opus on Workers AI neurons — Claude is proprietary
- ❌ Get Anthropic-quality for free via Cloudflare
- ❌ Use AI Gateway to bypass Anthropic billing — it's a proxy, not a credit substitute
- ❌ Use Gemini 3.1 Pro on free tier — paid-only

## 11. Verification log

*Section renumbered 2026-09-19 — it was §12 with no §11.*

| Date | Checked | Not checked |
|---|---|---|
| 2026-09-19 | Live `chatbot-kb` D1 via `wrangler … --remote`: `bot_config` (primary / fallback / classifier), the full `model_registry` (ids, providers, context windows, prices, deprecation flags), the `model_registry` column list; `cf-chatbot/migrations/` (22 files, to `0022`); `cf-chatbot/src/admin/api.ts` (key-based auth **and** the static trust-header bypass); `cf-chatbot/src/core/pipeline.ts` (classifier from config), `cf-chatbot/src/core/rag.ts` (BGE-Small), `cf-chatbot/src/storage/supabase.ts` + `cf-chatbot/src/channels/web/chat.ts` (`feedback_events` writer); cf-admin `src/lib/chatbot-proxy.ts`; `src/lib/ai-pricing.ts` on the shared account allocation | Workers AI neuron prices in §4 (carried forward, not re-fetched from Cloudflare); RLS **policy content** (only that RLS is enabled); the §9 Supabase RPCs and `/admin/analytics/*` handlers; live conversation volume or cost |
| 2026-09-14 | Proxy route `src/pages/api/chatbot/[...path].ts` (session check, per-pattern RBAC floor, path-traversal rejection, ghost audit); `CHATBOT_WORKER_URL` / `CHATBOT_ADMIN_API_KEY` in `wrangler.toml` and `worker-configuration.d.ts`; the `CHATBOT_SERVICE` binding; every component file in §3 on disk (three were missing from the table and are now listed); the hook signatures in `useChatbotApi.ts`; the analytics endpoints each island calls; `POST models/switch` payload; `content_en` / `content_es` in `KnowledgeBase.tsx`; the knowledge-gaps empty state; no clustering cron in `wrangler.toml` (two triggers) and no writer of `cluster_topic` / `feedback_events` in either checkout. Seven corrections above. | Everything inside `cf-chatbot` (not on disk here): pipeline files, `thinking_param`, `model_registry` / `bot_config` tables, migration history, Supabase RPCs, `/admin/analytics/*` routes; Workers AI neuron pricing (§4–6, §10); live RLS state |
