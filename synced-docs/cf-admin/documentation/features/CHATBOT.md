---

title: "The Chatbot section: the WhatsApp bot on n8n — CF-Admin"
status: active
audience: [ai, technical]
last_verified: 2026-10-17
verified_against: [code]
owner: harshil
related_code: [src/components/admin/chatbot/BotOverview.tsx, src/components/admin/chatbot/insights/BotInsights.tsx, src/components/admin/chatbot/insights/record.ts, src/lib/posthog/bot.ts, src/lib/posthog/bot-parts.ts, src/pages/api/whatsapp-bot/insights.ts, src/pages/api/whatsapp-bot/part.ts, src/layouts/ChatbotLayout.astro, src/lib/ai-knowledge.ts, src/lib/auth/routes.ts]
related_docs: [AI-HEALTH.md, WHATSAPP-LAB.md, ../security/SECURITY.md, ../architecture/PERMISSIONS-SYSTEM.md, ../records/reports/2026-08-31-ai-system-overhaul.md]
tags: [chatbot, whatsapp, n8n, ai, analytics]
---

# The Chatbot section: the WhatsApp bot on n8n — CF-Admin

> **TL;DR (non-technical):** Since 2026-11-05 the Chatbot section shows the hotel's one chatbot, the WhatsApp bot that runs on n8n on the server: whether it runs, what its AI costs against the month's allowance, how well it answers, and its test lab. The old website chatbot (charlar, `cf-chatbot`) is retired: its pages, its connection and its health check left the portal on 2026-11-05.

> **Status:** ✅ Deployed
> **Last Updated:** 2026-11-05 — the section moved to the n8n WhatsApp bot (§0); charlar left the portal (§1, §2); seven analytics tabs and a new Overview (§0.1); Money, Models and steps, and System read the server's record first (§0.1). §3 to §10 are history (below).
> **RLS Policy:** RLS is enabled on every chatbot table in the shared Supabase project — `chat_analytics`, `contacts`, `conversations`, `messages`, plus `intent_events`, `kb_gaps`, `conversation_metrics`, `feedback_events` and `tool_call_events`, which this note used to omit. Policy *content* has not been re-read; only that RLS is on. See [SECURITY.md](../security/SECURITY.md). *Corrected 2026-09-19.*
>
> **Scope note.** This document is cf-admin's view of the Chatbot section. The WhatsApp bot itself lives on the server (cf-vps, the `whatsapp` app group); its test lab is [WHATSAPP-LAB.md](WHATSAPP-LAB.md).
>
> **The WhatsApp lab** (since 2026-11-05) is the section's other tab group: it tests the hotel's n8n WhatsApp bot on the server, and [WHATSAPP-LAB.md](WHATSAPP-LAB.md) owns it.
>
> **The server access notice** (since 2026-11-05, the owner's ask): every Chatbot page shows the Server page's access notice, the same words from `src/lib/vps-notice.ts`, until the sign-in has accepted it; one acceptance covers both places ([design §7](../specs/2026-10-11-server-access-notice.md)).
>
> **charlar is retired** (the owner's decision, 2026-11-05). The n8n WhatsApp bot on the server is the hotel's one chatbot. On 2026-11-05 charlar left the portal: its seven pages (Quality, Conversations, Usage, Knowledge Base, Instructions, AI Models, Settings), the `/api/chatbot` proxy, the `CHATBOT_SERVICE` binding and the *Website chat assistant* health check were removed, and migration `0095` switched their registry rows off (change record (private)). charlar's knowledge base, prompts and settings are outdated and kept only as history in `cf-chatbot`'s `archive/` folder (commit `dc0aa48`): never a source for the n8n bot or anything else. Its conversations stay in the shared Supabase project, inside the nightly encrypted backup, until the delete step; the Worker, its database and its tables are deleted one by one with the owner's yes.
>
> **The RLS note** above and §3 to §10 describe charlar as it ran until 2026-11-05. They are kept until its stores are deleted, so the history is readable; nothing in them describes what the portal does now.

---

## 0. The WhatsApp bot on n8n: the Overview

*Since 2026-11-05, the owner's ask: the Chatbot section becomes the n8n WhatsApp bot's.* The
section's front page (`/dashboard/chatbot/dashboard`, `BotOverview.tsx`) no longer shows
charlar: it shows the WhatsApp bot that runs on the server, from two sources, each named on
screen. It is the first part of the plan the owner approved on 2026-11-05 (one chatbot system on
n8n); the full records (every chat, take-overs, switches, models and instructions) follow with
the server's records helper.

| Part | Source | What it shows |
|------|--------|---------------|
| Status strip and figures | both below | Since the remake of 2026-11-05 evening (§0.1): four tiles (parts running on the server, x of y; live or not yet; this month's AI spend against the allowance; urgent flags), then six figures (replies, checks passed with their likely range, AI calls, typical call time, cost per reply, this month) |
| On the server | the server console's `apps` read through its gateway (`lab-api.ts` `serverApps`), the same read as the Server page's Apps screen | Each member of the groups `whatsapp` (the live bot: WAHA, n8n, Redis, Whisper, the model door) and `whatsapp-lab` (the lab): running or not, since when, restarts, memory. It needs the person's Server page access too; without it the panel says so and the rest of the page still shows |
| Spend this month | PostHog, every `$ai_generation`'s `$ai_total_cost_usd` since the 1st, the hotel's time; the allowance from D1 | A meter against the month's AI allowance, coloured by the owner's brake as shares of it: emails at 60% and 80%, the free model from 90% (US$30, US$40 and US$45 of US$50) |
| Live and lab | PostHog `$ai_generation` and `$ai_trace` in the window | Replies, chats, AI calls, failed calls, average call time and cost, split by source: an event with a `lab_chat` property is the lab's test, any other is the live bot's |
| AI checks | PostHog `$ai_evaluation` | The five weakest checks, each with passed of answered, its rate and its 95% likely range (§0.1) |
| Needs a look | `GET /api/whatsapp-bot/part?part=flags`, read only when the person may open Flags | The latest five things flagged, each linking to its chat |
| By step, By model | `$ai_generation` | Calls, failures, average time and cost per step and per model |
| By day, Busiest hours | `$ai_trace` | Replies per day and per hour of day, the hotel's time (America/Mexico_City) |
| Errors | failed `$ai_generation` | The five most frequent error texts, with their count and when last seen |

**The monthly AI allowance** (the owner, 2026-11-05): one limit in US dollars for everything that uses AI in a month (the bot, PostHog AI and the portal's AI), which the client sets each month. It is the `admin_portal_settings` row `ai_monthly_allowance_usd` (migration `0094`); with no row it is 5, and Vendor support set it at 50 on 2026-11-05. The page compares it with the AI spend PostHog was told about, which today is the bot's (lab) calls only; no screen changes it yet.

The numbers come from `GET /api/whatsapp-bot/insights?days=7|30|90` (`src/lib/posthog/bot.ts`:
nine fixed HogQL questions through the PostHog page's client, kept 10 minutes; the page's
Refresh asks again). Numbers only, the owner's choice of 2026-11-05: no message text and no
phone number is asked of PostHog or reaches the page. Until the live bot answers customers
from the server (after move night) only the lab sends these events, so the live figures are 0
and the page says every figure is from the lab's tests.

### 0.1 The seven tabs (since 2026-11-05 evening)

*The owner's ask of 2026-11-05: "multiple sections from header like posthog, our pricing
analytics from collected data, trends, any flags by ai, confidence rate"; phase 1 of the
[analytics design](../specs/2026-11-05-chatbot-analytics.md), which owns what each tab shows and
why.* The section's tab row now runs Overview, Chats, Quality, Flags, Money, Trends, Models and
steps, System, then the WhatsApp lab. Each tab is a page of its own (`[part].astro`, migration
`0096`), read through `GET /api/whatsapp-bot/part?part=…&days=7|30|90` (`src/lib/posthog/bot-parts.ts`),
and all of them, with the Overview, are drawn with the PostHog page's kit in the bot's teal
(`ChatbotLayout scene`, `src/styles/pages/chatbot-insights.css`).

| Tab | Path | Default holders |
|---|---|---|
| Chats | `/dashboard/chatbot/chats` | Owner (it shows the lab chats' words) |
| Quality | `/dashboard/chatbot/quality` | Admin |
| Flags | `/dashboard/chatbot/flags` | Admin |
| Money | `/dashboard/chatbot/money` | Admin |
| Trends | `/dashboard/chatbot/trends` | Admin |
| Models and steps | `/dashboard/chatbot/steps` | Admin |
| System | `/dashboard/chatbot/system` | Admin |

A tab needs the Chatbot section's key and its own, each by exact key (`denyBotPart`), in the page
and in the route, so it can be given or kept back alone on the Access page. Every pass rate shows
its 95% Wilson range and how many answers it rests on; under 20 answers it is marked as resting on
few. A judge's reasoning is asked of PostHog only for the lab's tests, never for a real customer.

**The server's record (phase 2, since 2026-11-05 night).** Money, Models and steps, and System
ask the bot's own record in the server's Postgres first (`insights/record.ts`): the lab's
(`whatsapp-lab`, member `phone`) and the real bot's recorder's (`whatsapp`, member `recorder`),
both read as `record/money|models|system?days=` through the console bridge the lab's pages
already use (`memberView` in `lab-api.ts`; cf-vps `apps/whatsapp-lab/src/record.ts` answers in
the shapes of `bot-parts.ts`). When at least one answers, the page draws it: Money adds both
(each source's month and tokens apart), Models and System show one source at a time with the
Real customers / Lab tests row, and System adds each n8n workflow's runs and usually slowest
step. When neither answers (not installed, an older lab, no database), the page reads PostHog
as before. A line under each page's choices says which it shows and why a record is missing.
Money's allowance comes from the page (`[part].astro`), since the record does not carry it. The
Overview, Quality, Flags and Trends stay on PostHog until phase 3
(change record (private)).

---

## 1. The connection to charlar (removed 2026-11-05)

Until 2026-11-05 the portal reached `cf-chatbot`'s private `AdminApi` entrypoint over the
`CHATBOT_SERVICE` service binding, through the proxy `src/pages/api/chatbot/[...path].ts` and
`src/lib/chatbot-proxy.ts` (lock-down record (private)).
All three are gone: no portal page, check or AI feature talks to charlar any more. The two
secrets that once held its address and key (`CHATBOT_WORKER_URL`, `CHATBOT_ADMIN_API_KEY`) have
had no reader since 2026-11-04 and are still set on the Worker until the owner deletes them
(MAINTENANCE (private) CB-1).

The portal's writing AI (the blog's assistant and the email designer) used to fetch charlar's
knowledge base for its facts. Since 2026-11-05 it uses the website's own facts only
(`src/lib/ai-knowledge.ts`, [CMS](CMS.md)).

---

## 2. UI Component System

The section's pages are Preact islands in `src/components/admin/chatbot/` (the Overview) and
`src/components/admin/chatbot/whatsapp/` (the lab, [WHATSAPP-LAB.md](WHATSAPP-LAB.md)).

| Component | File | Purpose |
|-----------|------|---------|
| **BotInsights** | `insights/BotInsights.tsx`, `insights/kit.tsx` | The seven tabs of §0.1 (since 2026-11-05 evening), one component per tab, and the words, figures, choices, likely-range bars, allowance meter and server list they share with the Overview |
| **BotOverview** | `BotOverview.tsx` | The Overview page (`/dashboard/chatbot/dashboard`) since 2026-11-05: the n8n WhatsApp bot, §0; rebuilt the same evening on the PostHog page's kit, its panels linking to the tabs of §0.1. It replaced `ChatbotDashboard.tsx`, charlar's overview; charlar's other seven pages (`AnalyticsDashboard`, `BotConfig`, `ModelsCatalog`, `KnowledgeBase`, `ConversationsBrowser`, `PromptsEditor`, `UsageAnalytics`) and their hook `useChatbotApi.ts` were deleted the same day |
| **Shared pieces** | `parts.tsx` | The Refresh button (`RefreshIcon`, for the page bar), the 7/30/90-day chips ("7d", announced "7 days"), a panel and bar rows (largest first, or as given with `inOrder`, for days); `Head` retired 2026-11-05, when the last page moved onto the page bar; the empty, failed and loading states and the badge come from the Sessions console's parts |
| **Page bar** | `PageBar.tsx` | The slim bar each page opens on (2026-11-05): a small hue icon, the name, one line cut to fit, the actions, an optional row of `Figure` pills. Every page opens on it since 2026-11-05; `parts.tsx` `Head` is retired. Its segmented row of sub-pages (`SubNav`) was removed the same evening, when the WhatsApp lab's pages joined the tab row |
| **Tab row** | `src/components/navigation/RegistryTabs.astro` (`variant="line"`), in `src/layouts/ChatbotLayout.astro` | The section's tabs as one underlined row (since 2026-11-05, [frame design](../specs/2026-11-05-chatbot-section-frame.md)), a divider before WhatsApp lab setting the lab apart from the Overview (until 2026-11-05 it set the WhatsApp bot apart from the website's chatbot). Since the evening of 2026-11-05 the lab's own three pages (Test chat, Usage, Set-up) stand in this row after a small green "WhatsApp lab" caption (`expand`), so there is no second row of tabs ([frame design](../specs/2026-11-05-chatbot-section-frame.md) §7). Since 2026-10-10 its names, order and icons come from the page registry (`admin_pages`), as do each page's heading and tab title, and a tab shows only when the person may open that page (`src/lib/auth/registry-tabs.ts`). It replaced `ChatbotSubnav.tsx`, which kept its own list of eight names |

**Look (since 2026-11-04):** every page sits on the console kit (`src/styles/components/console.css`, [DESIGN-SYSTEM.md](../reference/DESIGN-SYSTEM.md) §9.9) in the section's own cyan hue (`data-hue="chat"`, the lab in WhatsApp's green), with `src/styles/pages/chatbot.css` for the few pieces the kit has no part for. Time windows, filters, categories and short settings are chip rows, tables stack into cards on a phone, results are the portal's toasts and confirmations are its shared confirm. The old hard-coded dark stylesheets (`src/styles/components/chatbot/`, deleted) are gone. Change record: the Chatbot section's new look (private).

**A figure not known reads as a dash, never as zero** (the review of charlar's pages, 2026-11-05 (private), kept for the Overview).

---

> **History from here to §10:** charlar (`cf-chatbot`) as it ran until 2026-11-05, kept until its stores are deleted. Nothing below describes what the portal does now.

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

**Key files** (all removed with charlar's code on 2026-11-05, cf-chatbot `7ade002`; the source is kept in its `archive/`): `cf-chatbot/src/core/pipeline.ts` (orchestrator), `cf-chatbot/src/core/ai.ts` (provider abstraction), `cf-chatbot/src/core/classifier.ts`, `cf-chatbot/src/core/rag.ts`

---

## 4. Workers AI — Free Tier & Model Catalog

Every Cloudflare account receives **10,000 neurons/day** free (resets midnight UTC). All models in the catalog are accessible.

**What are neurons?** Cloudflare's unified billing unit. MoE models are cheaper because only a fraction of parameters activate per inference.

> **The allocation is per account, and two apps share it.** *Corrected
> 2026-09-19 — this section, like `AI-HEALTH.md`, described the pool as though
> only its own app drew on it.* `cf-chatbot` spends neurons on the Llama 4
> Scout classifier and BGE embeddings for every inbound message; `cf-admin`
> spends them on blog generation and AI visibility extraction and meters itself
> against the same 10,000 by summing its own `ai_inference` audit rows (an
> Upstash counter until 2026-10-04). Neither counter can see the other, so
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

`cf-chatbot/src/core/ai.ts` (removed 2026-11-05, kept in cf-chatbot's `archive/`) used a clean provider pattern:

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

**Zero-blocking telemetry:** `cf-chatbot/src/storage/supabase.ts` (removed 2026-11-05, kept in cf-chatbot's `archive/`) used `Promise.allSettled` for fire-and-forget inserts after response is sent — zero latency added to chat experience.

**Admin API routes** (on the private `AdminApi` entrypoint, reached only over the binding):

- `GET /admin/analytics/command-center?days=N`
- `GET /admin/analytics/kb-clusters?resolved=false`

### Cost Impact

- Zero additional AI tokens (SQL aggregations only)
- Two optimized RPC reads per dashboard load
- Zero additional Worker costs

### Future Enhancements

1. **Background AI Clustering Cron** — scheduled Worker to assign `cluster_topic` to unclustered `kb_gaps` rows. Still unbuilt; this is why the knowledge-gaps panel is empty.

*Corrected 2026-09-19: "CSAT UI Widget" was listed here as future work. It
existed — `cf-chatbot/src/channels/web/chat.ts` (removed 2026-11-04) called the `feedback_events`
insert in `cf-chatbot/src/storage/supabase.ts`, and the live table holds rows.
**2026-11-04:** the web chat, its widget and that writer were removed with the
public test page, so no new `feedback_events` rows are written; the existing
rows stay.
The 2026-09-14 verification log claimed to have found "no writer of
`cluster_topic` / `feedback_events` in either checkout" while also listing
cf-chatbot as not on disk; the 2026-09-19 pass read a local cf-chatbot checkout.
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
| 2026-11-05 | §0.1's server-record paragraph against `insights/record.ts`, `insights/BotInsights.tsx`, `insights/kit.tsx`, `lab-api.ts`, `[part].astro` and cf-vps `apps/whatsapp-lab/src/record.ts` (`shapeView`) and `recorder.ts`; `test/whatsapp-bot-record.test.ts` and `test/chatbot-look.test.ts` pass | The pages against the installed record (not on the server yet); §1 and §3 to §10; `last_verified` left as it was; the pages on the owner's phone |
| 2026-11-05 | §0's Overview rows and the new §0.1 against `BotOverview.tsx`, `insights/BotInsights.tsx`, `insights/kit.tsx`, `src/lib/posthog/bot-parts.ts`, `src/pages/api/whatsapp-bot/part.ts`, `denyBotPart` and migration `0096` (its rows read back live through the D1 connector); `test/whatsapp-bot-sections.test.ts`, `test/whatsapp-bot-overview.test.ts` and `test/chatbot-look.test.ts` pass; local screenshots at 390 px and 1,280 px from live lab numbers | §1 and §3 to §10; `last_verified` left as it was; the pages on the owner's phone |
| 2026-11-05 | The header, §1 and §2 rewritten for charlar leaving the portal: `src/pages/dashboard/chatbot/` (dashboard, index and the lab only), `src/components/admin/chatbot/`, `src/lib/auth/routes.ts` (the `/api/chatbot` keys removed), `src/lib/health/catalog.ts` (no `chatbot` check), `wrangler.toml` (no `CHATBOT_SERVICE`), `src/lib/ai-knowledge.ts`; the live `admin_pages` rows after `0095` (seven off) read through the D1 connector; the tests named in the change record pass | §3 to §10 marked as history, not re-read; the pages in a browser (the owner's phone test) |
| 2026-11-05 | §0 and §2's BotOverview row against `BotOverview.tsx`, `src/lib/posthog/bot.ts`, `src/pages/api/whatsapp-bot/insights.ts`, `lab-api.ts` and cf-vps `contract/views.ts` (`AppRow`); every HogQL question run live against the PostHog project (lab events only; the live bot sends none yet); `test/whatsapp-bot-overview.test.ts` and `test/chatbot-look.test.ts` pass | §1 and §3 to §10; `last_verified` left as it was; the page in a browser (the owner's phone test) |
| 2026-11-05 | §2's component rows against the code and against the live data (Supabase conversations, analytics functions and metric tables; D1 `chatbot-kb` knowledge base, prompts and model registry) and `cf-chatbot/src/admin/api.ts`, `cf-chatbot/src/storage/d1.ts`, `cf-chatbot/src/core/pipeline.ts` | §1 and §3 to §10 not re-read; `last_verified` left as it was; the pages were not opened in a browser (the owner's phone test) |
| 2026-11-05 | The access notice note against `src/layouts/ChatbotLayout.astro` and `test/chatbot-look.test.ts` | The rest of the document; the pages in a browser (the owner's phone test) |
| 2026-11-05 | The retirement note: `cf-chatbot` `archive/` (commit `dc0aa48`) against the live `chatbot-kb` (checksum over all 28 articles and 4 prompts equal); the nine chatbot tables are in the `public` schema the nightly backup exports (run of 2026-11-04, verdict ok, read from `backup_runs`) | The rest of the document; `last_verified` left as it was |
| 2026-11-05 | §2's tab row and page bar rows again after the one-row change: `RegistryTabs.astro` (`expand`), `ChatbotLayout.astro`, `PageBar.tsx` (`SubNav` removed), `test/chatbot-look.test.ts` | The rest of the document; the row in a browser (the owner's phone test) |
| 2026-11-05 | §2's tab row and page bar rows, against `ChatbotLayout.astro`, `RegistryTabs.astro`, `src/lib/auth/registry-tabs.ts`, `PageBar.tsx` and `test/chatbot-look.test.ts` | The rest of the document; the pages in a browser (the owner's phone test) |
| 2026-11-04 | §2 for the makeover: every component in `src/components/admin/chatbot/`, the layout, `parts.tsx`, `src/styles/pages/chatbot.css`; each page's API paths unchanged (read against the old code line by line) | §3 to §10 not re-read; the pages were not opened in a browser (the owner's phone test) |
| 2026-11-04 | §1 rewritten for the lock-down: cf-admin `src/lib/chatbot-proxy.ts` (binding only, no header, no HTTP fallback), `src/lib/health/catalog.ts` (`chatbot` check over the binding), `wrangler.toml` (`entrypoint = "AdminApi"`, the two secrets out of `[secrets] required`); cf-chatbot `src/index.ts`, `src/router.ts`, `src/admin/api.ts` (no key check; public door is `/health` and `/whatsapp/webhook` only), both checked running in workerd through a binding to the entrypoint; §9 CSAT note (writer removed) | §2 to §8 and §10 (models, prompts, pricing, RPCs): not re-read. Not probed live: this session cannot reach the public domain or deploy cf-chatbot |
| 2026-10-17 | cf-admin's side again: `src/pages/api/chatbot/[...path].ts` (RBAC rules per path and method), `src/lib/chatbot-proxy.ts` (binding first, HTTP fallback, `X-Admin-Key` only when set, 8 s timeout, and the constant trust header on the binding call is still sent, so the §1 issue stands), the `mutate(path, method, body)` signature in `useChatbotApi.ts`, every component in §2 and the nine pages under `src/pages/dashboard/chatbot/`. Removed a local Windows path from §9 | Everything inside `cf-chatbot` (§3 to §9: live `bot_config`, `model_registry`, its migrations, RPCs and routes): no cf-chatbot checkout in this session, so those stand as read on 2026-09-19 |
| 2026-10-07 | The neuron-budget note (changed 2026-10-04): cf-admin's budget is the sum of today's `ai_inference` audit rows (`src/lib/dal/RateLimitRepository.ts` `sumAiNeuronsToday`, `src/lib/ratelimit.ts`), no longer an Upstash counter | The chatbot Worker's own counter; everything else in this document |
| 2026-09-19 | Live `chatbot-kb` D1 via `wrangler … --remote`: `bot_config` (primary / fallback / classifier), the full `model_registry` (ids, providers, context windows, prices, deprecation flags), the `model_registry` column list; `cf-chatbot/migrations/` (22 files, to `0022`); `cf-chatbot/src/admin/api.ts` (key-based auth **and** the static trust-header bypass); `cf-chatbot/src/core/pipeline.ts` (classifier from config), `cf-chatbot/src/core/rag.ts` (BGE-Small), `cf-chatbot/src/storage/supabase.ts` + `cf-chatbot/src/channels/web/chat.ts` (`feedback_events` writer); cf-admin `src/lib/chatbot-proxy.ts`; `src/lib/ai-pricing.ts` on the shared account allocation | Workers AI neuron prices in §4 (carried forward, not re-fetched from Cloudflare); RLS **policy content** (only that RLS is enabled); the §9 Supabase RPCs and `/admin/analytics/*` handlers; live conversation volume or cost |
| 2026-09-14 | Proxy route `src/pages/api/chatbot/[...path].ts` (session check, per-pattern RBAC floor, path-traversal rejection, ghost audit); `CHATBOT_WORKER_URL` / `CHATBOT_ADMIN_API_KEY` in `wrangler.toml` and `worker-configuration.d.ts`; the `CHATBOT_SERVICE` binding; every component file in §3 on disk (three were missing from the table and are now listed); the hook signatures in `useChatbotApi.ts`; the analytics endpoints each island calls; `POST models/switch` payload; `content_en` / `content_es` in `KnowledgeBase.tsx`; the knowledge-gaps empty state; no clustering cron in `wrangler.toml` (two triggers) and no writer of `cluster_topic` / `feedback_events` in either checkout. Seven corrections above. | Everything inside `cf-chatbot` (not on disk here): pipeline files, `thinking_param`, `model_registry` / `bot_config` tables, migration history, Supabase RPCs, `/admin/analytics/*` routes; Workers AI neuron pricing (§4–6, §10); live RLS state |
