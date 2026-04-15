# CF-ADMIN CHATBOT INTEGRATION

> **Status:** ✅ IMPLEMENTED  
> **Last Updated:** 2026-04-15

## 1. Overview

The **cf-admin** portal serves as the primary administrative interface for the **Madagascar AI Chatbot** (`cf-chatbot`), operating strictly as a secure, authenticated proxy. Since `cf-chatbot` lacks built-in front-end authentication layers (aside from webhook validation), `cf-admin` brokers all administrative commands through Astro SSR API endpoints using high-security environment secrets.

## 2. Proxy Architecture

### 2.1 The Astro API Proxy (`cf-admin/src/pages/api/chatbot/[...path].ts`)
All administrative functions interact with a monolithic proxy endpoint located at `/api/chatbot/*`. 
This endpoint strictly:
- Blocks all unauthenticated requests.
- Validates the `Role` of the user mapping against a specific RBAC proxy definition.
- Appends the `CHATBOT_ADMIN_API_KEY` to securely handshake with the `cf-chatbot` remote endpoint defined by `CHATBOT_WORKER_URL`.

### 2.2 Security Configuration
If `cf-admin` attempts to bridge with `cf-chatbot`, it **must** possess the correct variables across both environments:

**cf-admin (`.dev.vars` / production secrets):**
- `CHATBOT_WORKER_URL`: Local (`http://localhost:8787`) or production Worker endpoint.
- `CHATBOT_ADMIN_API_KEY`: A 64-character UUID-like string securing access.

**cf-chatbot (`.dev.vars` / production secrets):**
- `ADMIN_API_KEY`: Must perfectly match `CHATBOT_ADMIN_API_KEY`.

### 2.3 Preact Islands Workflow (`useChatbotApi.ts`)
To prevent page reloading and maximize the SPA-feel, all interactive chatbot panels utilize Preact islands orchestrating requests via `useChatbotApi.ts`.
- **Read-Operations**: Managed natively by standard component mounts invoking the proxy (`useChatbotApi('analytics')`).
- **Write-Operations**: Fired directly through the `mutate()` pipeline embedded inside the hook triggering `POST`, `PUT`, or `DELETE` methods.

## 3. UI Component System ("Chatbot Dashboard")

The chatbot integration relies strictly on decoupled islands mapped heavily inside `cf-admin/src/components/admin/chatbot/`:

1. **`AnalyticsDashboard.tsx`**: Renders real-time message telemetry, active session gauges, and performance logs directly from the D1 store.
2. **`BotConfig.tsx`**: Dynamically adjusts hyperparameters (`ai_temperature`, `max_history_turns`) and localized static messages using an uncontrolled boundary system binding natively to React DOM parameters (`value={config.fallback_model_id}`) to securely retain state.
3. **`ModelsCatalog.tsx`**: Lists authorized models mapped against Cloudflare's `@cf/` namespace or other providers. Renders strict logic to filter falsy `is_free_tier` mappings as opposed to printing `0` artifacts.
4. **`KnowledgeBase.tsx`**: Allows robust CRUD manipulations across language boundaries (`content_en`, `content_es`), securely mounting text into React's normalized `textarea` values instead of literal HTML children strings.
5. **`ConversationsManagement.tsx`**: Reviews end-to-end active/inactive channels with deep context retrieval. Controls background session sweeping configured by cron triggers on the remote worker side.

## 4. Design Guidelines mapping to cf-chatbot

- The UI maintains the `Midnight Slate` aesthetics per standard `cf-admin` rules.
- **NEVER** expose the true endpoint URLs of `cf-chatbot` to the client boundary.
- **NEVER** cache sensitive analytical payloads in the client framework; use the `refetch()` trigger from `useChatbotApi` post-mutations to maintain single-source-of-truth from the backend D1 container.
