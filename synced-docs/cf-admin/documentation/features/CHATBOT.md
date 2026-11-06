---

title: "The Chatbot section: the WhatsApp bot on n8n — CF-Admin"
status: active
audience: [ai, technical]
last_verified: 2026-10-17
verified_against: [code]
owner: harshil
related_code: [src/workers/scheduled-bot-flags.ts, src/workers/scheduled-bot-weekly.ts, src/lib/posthog/bot-words.ts, src/pages/dashboard/chatbot/settings.astro, src/pages/api/whatsapp-bot/settings.ts, src/components/admin/chatbot/insights/BotSettings.tsx, src/components/admin/chatbot/insights/BotModels.tsx, src/components/admin/chatbot/BotOverview.tsx, src/components/admin/chatbot/insights/BotInsights.tsx, src/components/admin/chatbot/insights/Conversations.tsx, src/components/admin/chatbot/insights/FlagInbox.tsx, src/components/admin/chatbot/insights/Business.tsx, src/components/admin/chatbot/insights/record.ts, src/lib/vps-proxy.ts, src/lib/posthog/bot.ts, src/lib/posthog/bot-parts.ts, src/pages/api/whatsapp-bot/insights.ts, src/pages/api/whatsapp-bot/part.ts, src/layouts/ChatbotLayout.astro, src/lib/ai-knowledge.ts, src/lib/auth/routes.ts]
related_docs: [AI-HEALTH.md, WHATSAPP-LAB.md, ../security/SECURITY.md, ../architecture/PERMISSIONS-SYSTEM.md, ../records/reports/2026-08-31-ai-system-overhaul.md]
tags: [chatbot, whatsapp, n8n, ai, analytics]
---

# The Chatbot section: the WhatsApp bot on n8n — CF-Admin

> **TL;DR (non-technical):** Since 2026-11-05 the Chatbot section shows the hotel's one chatbot, the WhatsApp bot that runs on n8n on the server: whether it runs, what its AI costs against the month's allowance, how well it answers, and its test lab. The old website chatbot (charlar, `cf-chatbot`) is retired: its pages, its connection and its health check left the portal on 2026-11-05.

> **Status:** ✅ Deployed
> **Last Updated:** 2026-11-06 — the weekly report by email, built and switched off (§0.6). The Overview's server parts are one line that opens System, and a lab reply on Chats shows PostHog's AI summary (§0.3). The Chats page reads every conversation from the bot's record, with a search, and customers' words need the Chats page even with server access; the Flags page is an inbox marked right, wrong or done (§0.3). Urgent flags by email, built and switched off (§0.2). 2026-11-05 — the section moved to the n8n WhatsApp bot (§0); charlar left the portal (§1, §2); seven analytics tabs and a new Overview (§0.1); Money, Models and steps, and System read the server's record first (§0.1); the Overview, Quality, Flags, Trends and a chat's checks too, once the lab copies PostHog's AI checks (lab 1.7.0, §0.1). §3 to §10 are history (below).
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
| On the server | the server console's `apps` read through its gateway (`lab-api.ts` `serverApps`), the same read as the Server page's Apps screen, read again each minute while the page is in view | Since 2026-11-06 the strip's first tile only (the plan's "becomes a one-line live strip; detail moves to System"): how many members of the groups `whatsapp` (the live bot: WAHA, n8n, Redis, Whisper, the model door) and `whatsapp-lab` (the lab) are running, and by name which are not; the tile opens System for who may open it, where each part's state, restarts and memory are listed. It needs the person's Server page access too; without it the tile says why and the rest of the page still shows |
| Spend this month | PostHog, every `$ai_generation`'s `$ai_total_cost_usd` since the 1st, the hotel's time; the allowance from D1 | A meter against the month's AI allowance, coloured by the owner's brake as shares of it: emails at 60% and 80%, the free model from 90% (US$30, US$40 and US$45 of US$50) |
| Live and lab | PostHog `$ai_generation` and `$ai_trace` in the window | Replies, chats, AI calls, failed calls, average call time and cost, split by source: an event with a `lab_chat` property is the lab's test, any other is the live bot's |
| AI checks | PostHog `$ai_evaluation` | The five weakest checks, each with passed of answered, its rate and its 95% likely range (§0.1) |
| Needs a look | `GET /api/whatsapp-bot/part?part=flags`, read only when the person may open Flags | The latest five things flagged, each linking to its chat |
| By step, By model | `$ai_generation` | Calls, failures, average time and cost per step and per model |
| By day, Busiest hours | `$ai_trace` | Replies per day and per hour of day, the hotel's time (America/Mexico_City) |
| Errors | failed `$ai_generation` | The five most frequent error texts, with their count and when last seen |

**The monthly AI allowance** (the owner, 2026-11-05): one limit in US dollars for everything that uses AI in a month (the bot, PostHog AI and the portal's AI), which the client sets each month. It is the `admin_portal_settings` row `ai_monthly_allowance_usd` (migration `0094`); with no row it is 5, and Vendor support set it at 50 on 2026-11-05. The page compares it with the AI spend PostHog was told about, which today is the bot's (lab) calls only. Since 2026-11-06 the Chatbot Settings page changes it (§0.5).

The numbers come from `GET /api/whatsapp-bot/insights?days=7|30|90` (`src/lib/posthog/bot.ts`:
nine fixed HogQL questions through the PostHog page's client, kept 10 minutes; the page's
Refresh asks again). Numbers only, the owner's choice of 2026-11-05: no message text and no
phone number is asked of PostHog or reaches the page. Until the live bot answers customers
from the server (after move night) only the lab sends these events, so the live figures are 0
and the page says every figure is from the lab's tests.

Since lab 1.7.0 the Overview and its *Needs a look* panel ask the server's record first
(`record/overview` and `record/flags`, §0.1) and read these PostHog questions only when no
record answers; the allowance is then read by the page itself (`dashboard.astro`), since the
record does not carry it.

### 0.1 The seven tabs (since 2026-11-05 evening)

*The owner's ask of 2026-11-05: "multiple sections from header like posthog, our pricing
analytics from collected data, trends, any flags by ai, confidence rate"; phase 1 of the
[analytics design](../specs/2026-11-05-chatbot-analytics.md), which owns what each tab shows and
why.* The section's tab row now runs Overview, Chats, Quality, Flags, Money, Trends, Models and
steps, System, Settings (since 2026-11-06, §0.5), then the WhatsApp lab. Each tab is a page of
its own (`[part].astro`, migration `0096`), read through `GET /api/whatsapp-bot/part?part=…&days=7|30|90` (`src/lib/posthog/bot-parts.ts`),
and all of them, with the Overview, are drawn with the PostHog page's kit in the bot's teal
(`ChatbotLayout scene`, `src/styles/pages/chatbot-insights.css`).

| Tab | Path | Default holders |
|---|---|---|
| Chats | `/dashboard/chatbot/chats` | Owner and Vendor support (it shows customers' words, §0.3) |
| Quality | `/dashboard/chatbot/quality` | Admin |
| Flags | `/dashboard/chatbot/flags` | Admin |
| Money | `/dashboard/chatbot/money` | Admin |
| Trends | `/dashboard/chatbot/trends` | Admin |
| Models and steps | `/dashboard/chatbot/steps` | Admin |
| System | `/dashboard/chatbot/system` | Admin |
| Settings | `/dashboard/chatbot/settings` | Owner and Vendor support (since 2026-11-06, §0.5; its own page, `settings.astro`) |

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
Money's allowance comes from the page (`[part].astro`), since the record does not carry it
(change record (private)).

**Models takes over the lab's Usage page (since 2026-11-06).** The plan's "one way to read cost
and models, for lab and real bot alike": the table **Each step of the bot** has a row for each
step on each model, so one step on two models compares side by side, with its tokens per call
(read, then written, over every call) and its cost per call (over the answered calls), and each
model's card adds the same two figures (`perCallOf`, `tokensSay`). PostHog's question groups the
same way. The record sends the tokens and the step-by-model rows from cf-vps lab 1.14.0; an
older record's rows show a step with its most used model and "—" for the tokens. The lab's
Usage page stays until that package is installed and the owner has seen Models show the same
comparison; then its tab comes off.

**The AI checks from the record (lab 1.7.0, since 2026-11-05 night).** The owner asked on
2026-11-05 to stop waiting on PostHog for every page. The lab now copies PostHog's AI checks
(each verdict, graded by the check's own pass rule) and every reply into its record
(change record (private)). So
the Overview, Quality, Flags and Trends ask `record/overview|quality|flags|trends?days=` first,
and a lab chat's checks on Chats ask `record/chats?traces=`, all the same way as Money. Both
records' answers become one page (`mergeOverview`, `mergeQuality`, `mergeFlags`, `mergeTrends`):
each source's totals and checks apart, days, hours, moods and errors added, a typical time
weighted by calls and the whole-chat score by chats, failures newest first. A record whose
checks are not copied yet (no PostHog read key, or before its first read) refuses these pages
with `checks_off`, so they keep reading PostHog rather than show no checks while PostHog has
them; the line under the page's choices then says "its AI checks are not copied yet". The real
bot's checks join with phase 3.

### 0.2 Urgent flags by email (since 2026-11-06, switched off)

*Phase 3 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "Urgent flags by
email: built, switch off until you turn it on."* The bot's record raises a flag for what a person
should handle (cf-vps lab 1.10.0), and the urgent ones are a customer who says they paid, a reply
that promised a person would follow up, a customer who waited 10 minutes in opening hours, and the
bot failing three times in a row. The `bot-flags` job (`src/workers/scheduled-bot-flags.ts`, on
the five-minute tick, [CRON-CONTROL](CRON-CONTROL.md) §3g) emails them as they come:

- **It reads** the record's `record/urgent` (cf-vps lab 1.12.0): the open urgent flags of the last
  24 hours, each one's kind, name and time, and the chat's last 4 digits; never a message's words.
  It reads as its own scheduled job through the server console (`vpsSystemRead`), and the server
  allows that job this one read and nothing else.
- **It emails** the flags it has not emailed before, all in one email (subject "A customer says
  they paid", or "3 things in WhatsApp need a person"), each with what happened, what to do, the
  time in Mexico City and the chat's last 4 digits, and a button to the Flags tab. It goes
  through the hotel's email service as a `custom_email` (source `chatbot-flags`, in the Email Log),
  from the portal's security address. At most 30 emails a day; past that, the job logs the flags
  it did not send.
- **Once each.** Its state row remembers each flag it emailed for 25 hours (an hour past the
  record's 24, so a clock difference with the server cannot send one twice), so a flag marked
  done and opened again is not sent twice. When it is switched on, or switched to the
  other record, what is already open is remembered without an email: it emails from the next new
  flag.
- **The switch** is the `admin_portal_settings` row `chatbot-urgent-email`, JSON
  `{ "mode": "off" | "on" | "lab", "to": [addresses] }`. Without the row it is off, and the
  dispatcher's gate skips the job without a query. `on` reads the real bot's recorder; `lab`
  reads the lab's record instead, for a test on the testing number, and marks the email as a
  test. `to` takes up to five addresses; with none, the email goes to the alert inbox
  (`ADMIN_EMAIL`). Since 2026-11-06 the Chatbot Settings page writes the row (§0.5).

Before move night the real bot's recorder is not installed, so with the switch on the job finds
no record and looks again every half hour. Its D1 cost is its budget's: nothing while off or with
nothing new, one row written when it emails (change record (private)).

### 0.3 Conversations and the flag inbox (since 2026-11-06)

*Phase 3 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "Conversations:
every chat, newest first … search by word; open one to see it as a WhatsApp thread", "Flags: one
inbox of what needs a person … mark each as right, wrong or done", and "Chat text in the portal:
behind its own permission, Owner and Vendor support by default."*

- **Chats** (`insights/Conversations.tsx`) asks both records for `record/conversations?days=&q=`
  (cf-vps lab 1.8.0): each chat with its messages by side, the typical wait for an answer, the
  customer's questions left unanswered and its last message, newest first, Real customers and Lab
  tests apart. The search box takes a word (Spanish or English, the record's full-text search),
  the last 4 digits of a phone, or a whole number (matched through the record's keyed hash; no
  phone number is kept or shown). A WhatsApp chat opens from `record/conversation?chat=` as a
  thread: every message, staff's from the hotel phone marked, and WhatsApp's ticks under what the
  hotel sent (sent, delivered, read, played, not delivered). A lab test chat opens as before, each
  reply with its model, time, cost and AI checks, and since 2026-11-06 PostHog's own AI summary
  of the reply behind a tap (`$ai_trace_summary`: a title and up to eight points, `RunSummary`).
  The summaries live only in PostHog, so a lab chat now always asks PostHog's `chats` part too
  (two questions, kept a minute); the record's copy of the checks still comes first. Before lab 1.8.0 neither record answers, so the
  list is the lab's own chats, as before, and the line under the head says why.
- **Customers' words have their own permission.** The record's reads that carry them
  (`record/conversations`, `record/conversation`, `record/questions`: `CHAT_WORDS_PATHS` in
  `src/lib/vps-proxy.ts`) pass the console gateway only for who holds the Chats page as well as the
  Server page (`denyBotPart`, the gateway's `chat_words` refusal), so server access alone does not
  open them. The Chats page is Owner and Vendor support by default (migration `0096`), and anyone
  else needs it given on the Access page.
- **Flags** (`insights/FlagInbox.tsx`): once a record keeps its flags (`items`, lab 1.10.0), the
  page is an inbox, open ones first, with what each is and what to do. **Right** and **Wrong** say
  whether the flag was correct (a check's marks measure its AI judge on Quality), **Done** says it
  was handled, and **Open again** undoes a tap; a wrong flag is done too. Each mark is a change on
  the server, `record/flag` through the console bridge at the operate level (`memberChange` in
  `lab-api.ts`), so the gateway records it and cf-vps and the record check it. A flag carries no
  customer's words; **Open the chat** shows only for who may open Chats (`chatsOpen` from
  `[part].astro`). Before lab 1.10.0 the page lists the failed checks and AI errors as before.

Nothing new on this side: no route, table, setting or key; the pages read and change the record
through the console gateway the lab's pages already use.

### 0.4 What the chats were about and how they ended (since 2026-11-06)

*Phase 3 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "The booking
path", "Demand ahead", "Cost per booking", "Questions the bot could not answer" and "Busy hours
against staff hours".* The record's chat insight step (cf-vps lab 1.11.0) reads each conversation
once, after 30 quiet minutes, and keeps a fixed form: the services asked for, the pets, the dates
and nights, the price quoted, a deposit asked, the outcome, the lost reason and a question left
unanswered. `insights/Business.tsx` draws the record's counts of those forms
(`record/insights?days=`, numbers only; `readInsights` and `useInsights` in `insights/record.ts`),
one source at a time, so lab tests are never added to real customers.

- **Money: What the chats became.** Its own Real customers or Lab tests choice. The
  conversations, the bookings (the hotel confirmed) as a share of those about a stay or a service,
  the **cost per booking** (all of that record's AI in the window over its bookings) and the
  middle price quoted in pesos; **the booking path** (asked, got a price, asked for a deposit,
  said they paid, booked), each step a share of the conversations about a booking; and **why the
  others did not book** (the price, the dates, a Sunday, the distance, a missing service, nobody
  answered, not clear).
- **Trends**, for the page's source: **stays asked about, by check-in day** from today on (asked,
  not booked), with the nights and how many days ahead customers typically ask; **what customers
  ask for**; **what customers raise** (since 2026-11-06, phase 4's topic groups: the insight
  step's topics from cf-vps lab 1.15.0, a fixed list of 11 such as prices, room on their dates,
  vaccines and papers, or bringing and collecting the pet; a conversation counts in each of its
  topics, at most four; a record before 1.15.0 says it counts none); **their pets** by kind and
  size; **languages**; and under the week's heat map, the
  share of replies outside opening hours (Monday to Saturday, 9:00 to 14:00 and 15:00 to 18:00,
  the live bot's own hours).
- **Questions the hotel did not answer** (`record/questions`, in the insight step's few English
  words, newest first, each with a link to its chat) are the customers' own, so the page asks for
  them only for who may open Chats, and the console gateway refuses them to anyone else (§0.3).
  Everyone else sees how many conversations left one.

Before lab 1.11.0 the panels say the lab needs its 1.11.0 update; until move night, that the real
bot sends nothing yet. There is no PostHog fallback: PostHog never had these forms. Not built yet
(cf-vps): the price check against the price list and returning customers
(`MAINTENANCE.md` (private) BI-1).

### 0.5 Settings (since 2026-11-06)

*Phase 3 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "A screen to change
the monthly AI allowance and the judge share" ("today the allowance is only a database row").* The
section's Settings tab (`/dashboard/chatbot/settings`, `settings.astro` and
`insights/BotSettings.tsx`, migration `0097`) is Owner and Vendor support by default; anyone else
needs it given on the Access page. Since the owner's ask of 6 November ("REAL CONFIG for
production", a default model and one per feature) it has three sections in a row that scrolls
sideways on a phone, **Models**, **AI checks** and **Emails** (a link with `#models`, `#checks` or
`#emails` opens one), and six panels:

| Panel | What it changes | Where it is kept | Saved through |
|---|---|---|---|
| Models (Models) | For the real bot or the lab: the door on or passing everything, a default model, each step's model (as the bot asks, the default, or a Claude model with a price on file) with its switches (the reply's thinking effort and checked dates, the cache, the payment check's short instructions, the extracts' low effort), and a monthly brake that moves every step to one model from a spend; each model's price per million tokens beside it | Each record on the server, with its last 20 versions and who saved each (cf-vps lab 1.17.0 `bot_settings`) | The console bridge, `record/settings/save` at the operate level |
| Monthly AI allowance | The month's one limit for all AI, from US$1 to US$1,000 to the cent | `admin_portal_settings` `ai_monthly_allowance_usd` (§0) | `POST /api/whatsapp-bot/settings` |
| Urgent flags by email | Off, Test with the lab, or On, and up to five addresses (none: the alert inbox) | `admin_portal_settings` `chatbot-urgent-email`, as the job reads it (§0.2) | `POST /api/whatsapp-bot/settings` |
| AI checks for real customers | The share of replies every AI judge reads beyond those always judged (None, 1 in 10, 1 in 5, Half, All), and the month's cap of the judges and the chat insight step together (US$0 stops them) | The real bot's recorder's own record on the server (cf-vps lab 1.13.0 `judge_share`, `judge_month_usd`) | The console bridge, `record/ai` at the operate level |
| The lab's own AI | The month's cap of the lab's chat insight step (PostHog checks the lab's replies, so the lab runs no judges) | The lab's record | The same as above |
| Weekly report by email | Off, Test with the lab, or On, and up to five addresses (none: the alert inbox) | `admin_portal_settings` `chatbot-weekly-email`, as the job reads it (§0.6) | `POST /api/whatsapp-bot/settings` |

- **The route** (`src/pages/api/whatsapp-bot/settings.ts`) asks for the section's key and the
  page's (`denyBotPart`), checks each value, and writes one audit row per changed row with the old
  and the new value ([SECURITY](../security/SECURITY.md) §6a).
- **The record's own AI** is read from each record's `record/status` (`ai`: the share, the cap and
  this month's spend of the record's own AI; `readRecordAi` in `insights/record.ts`) and changed
  with `changeRecordAi`. The console gateway lets `record/ai` through only for who also holds this
  page (`changesBotAi` in `src/lib/vps-proxy.ts`, the `bot_settings` refusal,
  [VPS-CONSOLE](VPS-CONSOLE.md) §2), and cf-vps records each change as `app.bridge`. The real
  bot's panel also says whether its AI judges are on: they stay off until the recorder has its own
  Anthropic key, added on move night.
- **Before lab 1.13.0** a record answers without `ai`, and its panel says it needs its 1.13.0
  update; until move night, the real bot's panel says it sends nothing yet. The three portal rows
  can be changed at any time.
- **Models** (`insights/BotModels.tsx`) reads one record's `record/settings` (`readBotSettings`
  in `insights/record.ts`): the settings in force, the versions, the built-in settings, the models
  with their prices, this month's spend, whether the brake is on, and how the model door applies
  them. It saves them whole as a new version with `saveBotSettings` (`record/settings/save`),
  which the gateway holds the same way as `record/ai` (`BOT_AI_CHANGES`, the `bot_settings`
  refusal). A save for the real bot asks first, in the portal's dialog; the door uses it within
  30 seconds, from the next customer message, and the lab's test chats set up with the door at
  once. **Undo changes** goes back to the settings in force, **Built-in settings** fills in the
  model door's own (the reply and the payment check on Claude Haiku 5.5), **Copy the lab's** fills
  in the lab's, and **Use this version** an earlier one; each still needs a save. A step left as
  the bot asks is sent unchanged, on the model the live workflow names. Until lab 1.17.0 is
  installed the panel says the record needs its 1.17.0 update; until move night the real bot's
  says it sends nothing yet. How the door reads and applies them is cf-vps's
  `documentation/features/WHATSAPP-LAB.md`, "The bot's settings".

The Configuration page lists this page among the settings kept elsewhere
(`SETTINGS_ELSEWHERE` in `src/lib/configuration.ts`).

### 0.6 The weekly report by email (since 2026-11-06, switched off)

*Phase 4 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "a weekly report".*
PostHog's own email reports still cover the lab's numbers; this one is the bot's record's week,
so it covers real customers too, whose replies PostHog never sees. The
`bot-weekly` job (`src/workers/scheduled-bot-weekly.ts`, on the five-minute tick,
[CRON-CONTROL](CRON-CONTROL.md) §3h) sends it:

- **It reads** the record's `record/week` (cf-vps lab 1.16.0): the last 7 days in numbers only,
  the chats, the bot's replies and how many failed, the week's and the month's AI cost, the AI
  checks passed and failed, what the conversations became (booked, say they paid, asked only,
  went quiet, not about a booking), how many got a price and the middle price, the cost per
  booking, how many left a question, the top five topics and services asked for, the top three
  reasons for not booking, and the flags still open. Never a customer's words, a question or a
  phone. It reads as its own scheduled job through the server console (`vpsSystemRead`), and the
  server allows that job this one read and nothing else.
- **It emails** them once a week, on Monday at 9:00 in Mexico City (15:00 UTC; Mexico keeps no
  summer time), subject "The WhatsApp bot's week: 63 chats, 12 booked", with the insight step's
  fixed names in the portal's words (`src/lib/posthog/bot-words.ts`, the same words as Money and
  Trends) and a button to the Overview. It goes through the hotel's email service as a
  `custom_email` (source `chatbot-weekly`, in the Email Log), from the portal's security address.
- **Once each week.** Its state row (`chatbot-weekly-email-sent`) keeps the week sent, as the
  record and that Monday's date. Switched on mid-week, it sends the last 7 days at once, so the
  switch shows it works, then waits for Monday. Switched from the lab to the real bot in the same
  week, the real bot's week is sent too.
- **The switch** is the `admin_portal_settings` row `chatbot-weekly-email`, the same shape as the
  urgent email's (§0.2): `off` (also without the row: the dispatcher's gate skips the job without
  a query), `on` for the real bot's recorder, or `lab` for the lab's record, its email marked as a
  test. `to` takes up to five addresses; with none, it goes to the alert inbox. The Settings page
  writes it (§0.5).

Before move night the real bot's recorder is not installed, so with the switch on the job finds no
record and looks again every six hours. Its D1 cost is its budget's: nothing while off or between
Mondays, one row written when it emails
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
| **BotSettings** | `insights/BotSettings.tsx` | The Settings tab of §0.5 (since 2026-11-06): the allowance, the urgent flags email and each record's own AI, each panel saved on its own |
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
| 2026-11-06 | §0.5's sections and Models row against `insights/BotSettings.tsx` (`SECTIONS`, `sectionOf`), `insights/BotModels.tsx` (`ModelsForm`, `ModelsPanel`, `doorSay`, `priceSay`), `insights/record.ts` (`readBotSettings`, `saveBotSettings`), `BOT_AI_CHANGES` in `src/lib/vps-proxy.ts`, and cf-vps `apps/whatsapp-lab/src/settings.ts` and `admin.ts` at `a8ab434` (lab 1.17.0); `test/whatsapp-bot-models.test.ts`, `test/whatsapp-bot-settings.test.ts` and `test/vps-gateway.test.ts` pass | The panel against lab 1.17.0 (not installed) and on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.6 (new) and §0.5's fifth row against `src/workers/scheduled-bot-weekly.ts`, `src/lib/jobs/registry.ts` (`bot-weekly`, its gate), `src/pages/api/whatsapp-bot/settings.ts` (`weeklyEmail`), `insights/BotSettings.tsx` (`EmailSwitch`, `WEEKLY_SAY`), `src/lib/posthog/bot-words.ts`, and cf-vps `apps/whatsapp-lab/src/record.ts` (`week`), `admin.ts` (`SYSTEM_PATHS`) and `contract/capabilities.ts` (`SYSTEM_JOB_BRIDGE`) at `88717cf` (lab 1.16.0); `test/bot-weekly-email.test.ts`, `test/whatsapp-bot-settings.test.ts` and `test/jobs-budget.test.ts` pass | Nothing live: the job is off and lab 1.16.0 is not installed; an email in a real mailbox; the page on a phone; `last_verified` left as it was |
| 2026-11-06 | §0's On the server row against `BotOverview.tsx` (`downLine`, the minute's read, the tile's link to System); `test/whatsapp-bot-overview.test.ts` passes | The page on a phone; `last_verified` left as it was |
| 2026-11-06 | §0.5 (new), §0's allowance line, §0.1's Settings row and §0.2's switch line against `src/pages/dashboard/chatbot/settings.astro`, `src/pages/api/whatsapp-bot/settings.ts`, `insights/BotSettings.tsx`, `insights/record.ts` (`readRecordAi`, `changeRecordAi`), `changesBotAi` in `src/lib/vps-proxy.ts`, `migrations/0097_chatbot_settings_page.sql`, and cf-vps `apps/whatsapp-lab/src/judges.ts` (`ownAiOf`, `setOwnAi`, the share's use) and `admin.ts` (`record/status`, `record/ai`); `test/whatsapp-bot-settings.test.ts` and `test/vps-gateway.test.ts` pass | Nothing live: the page on a phone, and lab 1.13.0 is not installed, so no record answers its settings yet; `last_verified` left as it was |
| 2026-11-06 | §0.4 (new) against `insights/Business.tsx` (`bookingPath`, `outsideHours`, `aheadDays`, `noForms`, `Bookings`, `Demand`), `insights/record.ts` (`readInsights`, `readQuestions`, `useInsights`), `insights/BotInsights.tsx` (Money and Trends), and cf-vps `apps/whatsapp-lab/src/record.ts` (`insights`, `questions`), `insights.ts` (the form's fields) and `flags.ts` (`OPEN_HOURS`); `test/whatsapp-bot-business.test.ts` passes | The pages against the installed lab 1.11.0 (not on the server yet); the pages on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.4's topic groups against `insights/Business.tsx` (`Demand`, `TOPIC_WORD`), `InsightsData.topics` in `insights/record.ts` and cf-vps `apps/whatsapp-lab/src/insights.ts` and `record.ts` at `c6f4e8b` (lab 1.15.0); `test/whatsapp-bot-business.test.ts` passes | The panel against lab 1.15.0 (not installed); on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.1's Models paragraph against `BotInsights.tsx` (`ModelsPart`, `perCallOf`, `tokensSay`), `src/lib/posthog/bot-parts.ts` (the `models` part's `byStep`, `StepRow`) and cf-vps `apps/whatsapp-lab/src/record.ts` at `84fac8a` (lab 1.14.0's `record/models`); `test/whatsapp-bot-sections.test.ts` passes | The page against lab 1.14.0 (not installed); on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.3's lab chat line against `insights/Conversations.tsx` (`RunSummary`), `insights/record.ts` (`useChatChecks`) and `src/lib/posthog/bot-parts.ts` (the `chats` part's `summaries` question, `pointsOf`); `test/whatsapp-bot-sections.test.ts` passes | The summaries against PostHog's live events and on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.3 (new) and §0.1's Chats row against `insights/Conversations.tsx`, `insights/FlagInbox.tsx`, `insights/record.ts` (`readConversations`, `readThread`, `mergeConversations`, `mergeFlags`, `reviewFlag`), `lab-api.ts` (`memberChange`), `src/lib/vps-proxy.ts` (`CHAT_WORDS_PATHS`), the console gateway and `[part].astro`, and cf-vps `apps/whatsapp-lab/src/messages.ts` (`list`, `chat`), `flags.ts` (`reviewFlag`) and `record.ts` (`flagOf`); `test/whatsapp-bot-conversations.test.ts` and `test/vps-gateway.test.ts` pass | The pages against the installed lab 1.8.0 to 1.12.0 (not on the server yet); the pages on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.2 (new) against `src/workers/scheduled-bot-flags.ts`, `src/lib/jobs/registry.ts` (`bot-flags`, its gate), `src/lib/vps-proxy.ts` (`vpsSystemRead` with a query), and cf-vps `apps/whatsapp-lab/src/record.ts` (`urgent`), `admin.ts` (`SYSTEM_PATHS`) and `contract/capabilities.ts` (`SYSTEM_JOB_BRIDGE`); `test/bot-flags-email.test.ts` and `test/jobs-budget.test.ts` pass | Nothing live: the job is off, and the record is not installed on the server; an email in a real mailbox; `last_verified` left as it was |
| 2026-11-05 | §0's record sentence and §0.1's AI-checks paragraph against `insights/record.ts` (`CHECK_PARTS`, `whyOf`, `fromLine`, the four merges, `useBotPart`, `useChatChecks`), `insights/BotInsights.tsx`, `BotOverview.tsx`, `dashboard.astro` and cf-vps `apps/whatsapp-lab/src/record.ts`, `admin.ts` (`checks_off`) and `agent/src/server.ts` (the bridge passes a member's answer through unchanged); `test/whatsapp-bot-record.test.ts` and `test/chatbot-look.test.ts` pass | The pages against the installed lab 1.7.0 (not on the server yet, and it needs the owner's read key); §1 and §3 to §10; `last_verified` left as it was; the pages on the owner's phone |
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
