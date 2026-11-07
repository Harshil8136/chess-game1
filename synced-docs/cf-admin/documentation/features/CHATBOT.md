---

title: "The Chatbot section: the WhatsApp bot on n8n — CF-Admin"
status: active
audience: [ai, technical]
last_verified: 2026-10-17
verified_against: [code]
owner: harshil
related_code: [src/workers/scheduled-bot-flags.ts, src/workers/scheduled-bot-weekly.ts, src/lib/posthog/bot-words.ts, src/pages/dashboard/chatbot/settings.astro, src/pages/api/whatsapp-bot/settings.ts, src/components/admin/chatbot/insights/BotSettings.tsx, src/components/admin/chatbot/insights/BotModels.tsx, src/components/admin/chatbot/insights/BotRules.tsx, src/components/admin/chatbot/insights/BotHotel.tsx, src/components/admin/chatbot/insights/BotData.tsx, src/components/admin/chatbot/insights/BotN8n.tsx, src/components/admin/chatbot/insights/record-data.ts, src/components/admin/chatbot/insights/DayChart.tsx, src/components/admin/chatbot/BotOverview.tsx, src/components/dashboard/posthog/frame.tsx, src/components/dashboard/posthog/charts.tsx, src/components/admin/chatbot/insights/BotInsights.tsx, src/components/admin/chatbot/insights/ModelStats.tsx, src/components/admin/chatbot/insights/Conversations.tsx, src/components/admin/chatbot/insights/FlagInbox.tsx, src/components/admin/chatbot/insights/Business.tsx, src/components/admin/chatbot/insights/record.ts, src/components/admin/chatbot/insights/compare.ts, src/components/admin/chatbot/insights/BotCompare.tsx, src/lib/vps-proxy.ts, src/lib/posthog/bot.ts, src/lib/posthog/bot-parts.ts, src/pages/api/whatsapp-bot/insights.ts, src/pages/api/whatsapp-bot/part.ts, src/layouts/ChatbotLayout.astro, src/lib/ai-knowledge.ts, src/lib/auth/routes.ts]
related_docs: [AI-HEALTH.md, WHATSAPP-LAB.md, ../security/SECURITY.md, ../architecture/PERMISSIONS-SYSTEM.md, ../records/reports/2026-08-31-ai-system-overhaul.md]
tags: [chatbot, whatsapp, n8n, ai, analytics]
---

# The Chatbot section: the WhatsApp bot on n8n — CF-Admin

> **TL;DR (non-technical):** Since 2026-11-05 the Chatbot section shows the hotel's one chatbot, the WhatsApp bot that runs on n8n on the server: whether it runs, what its AI costs against the monthly AI budget, how well it answers, and its test bot. The old website chatbot (charlar, `cf-chatbot`) is retired: its pages, its connection and its health check left the portal on 2026-11-05.

> **Status:** ✅ Deployed
> **Last Updated:** 2026-11-07 night — plain words across the section and Settings redesigned (§0.5, the owner: "change terms ... Lab, door, monthly break" and "completely change visual settings"): the lab is the **Test bot**, the real bot the **Live bot**, the model door the **AI gateway**, the brake the **spending limit**, the allowance the **monthly AI budget**, a judge an **AI check**; Settings has a menu of twelve sections in four groups, At a glance, one Test bot / Live bot switch, one row per setting with switches and tags, and a save bar that stays in sight ([spec](../specs/2026-11-07-chatbot-plain-words-and-settings.md), change record (private)). Earlier that day Settings gained Safety, Hours and Prices (§0.5, with cf-vps lab 1.25.0 and 1.26.0): the replies' hand-over to a person, after-hours rule, longest reply and backup model; the hotel's opening days and hours, holidays and days closed or open besides, which the flags now follow; and the prices the bot's calculator quotes, read only, with any typo named. The Flags inbox and the urgent email name a hand-over. Earlier that day: the numbers say what they count (§0.8): failed AI calls with why they failed, apart from the replies a customer never got; the typical AI step beside the average; the allowance meter's marks called marks, with what each record's brake really does; the weekly email names failed calls as calls. Settings → PostHog gains one switch, "PostHog, all of it", that stops the lab sending and the pages reading (§0.5). 2026-11-06 — Models and steps remade (one table of models, a map of speed against cost, each step's models together) and every other Chatbot page checked for blank gaps: Money's rows paired and one row per model, long lists in two columns, the Flags figures across the page, the Chats reading side listing the chats waiting for an answer, Settings' allowance above the models and Data's panels three across, and the tables no longer cut short in production (§0.1, §0.3, §0.5). Earlier, the Overview laid out again: figures with their days, a Worth knowing panel, rows of panels of a like height, the models as one table (§0, §0.1). Models shows two models or two lab test setups side by side in every measure, printable for a client, with the lab's test run in one press under it (§0.7). The daily charts draw every day of the window, the whole-chat score as a dot a day with its pass mark, the Overview's models dearest first, panel heads wrap on a phone, and Settings' line says what the open section is for (§0.1, §0.5). Settings gains Timings, n8n and Data (§0.5): the lab's workflow timings, written into its copy of the bot at once, beside the real bot's (read only); each bot's n8n workflows, runs and failures, with a switch; what each record keeps, its download by days, removing a range of days and the months kept, behind a typed count and a recent sign-in. Chats downloads one real customer's chat, and erases it for who has Settings (§0.3). Earlier that day Settings gained AI checks, Flags and PostHog: each record's AI judges, chat insight step and their model, the flags' wait, opening hours and kinds, the lab's PostHog sending, and the pages' own PostHog reads (§0.5). The weekly report by email, built and switched off (§0.6). The Overview's server parts are one line that opens System, and a lab reply on Chats shows PostHog's AI summary (§0.3). The Chats page reads every conversation from the bot's record, with a search, and customers' words need the Chats page even with server access; the Flags page is an inbox marked right, wrong or done (§0.3). Urgent flags by email, built and switched off (§0.2). 2026-11-05 — the section moved to the n8n WhatsApp bot (§0); charlar left the portal (§1, §2); seven analytics tabs and a new Overview (§0.1); Money, Models and steps, and System read the server's record first (§0.1); the Overview, Quality, Flags, Trends and a chat's checks too, once the lab copies PostHog's AI checks (lab 1.7.0, §0.1). §3 to §10 are history (below).
> **RLS Policy:** RLS is enabled on every chatbot table in the shared Supabase project — `chat_analytics`, `contacts`, `conversations`, `messages`, plus `intent_events`, `kb_gaps`, `conversation_metrics`, `feedback_events` and `tool_call_events`, which this note used to omit. Policy *content* has not been re-read; only that RLS is on. See [SECURITY.md](../security/SECURITY.md). *Corrected 2026-09-19.*
>
> **Scope note.** This document is cf-admin's view of the Chatbot section. The WhatsApp bot itself lives on the server (cf-vps, the `whatsapp` app group); its test lab is [WHATSAPP-LAB.md](WHATSAPP-LAB.md).
>
> **The Test bot** (since 2026-11-05; called the WhatsApp lab until 2026-11-07) is the section's other tab group: it tests the hotel's n8n WhatsApp bot on the server, and [WHATSAPP-LAB.md](WHATSAPP-LAB.md) owns it.
>
> **The words on screen** (since 2026-11-07): the pages say *Test bot* for the lab, *Live bot* for the real bot, *server* or *database* for a bot's record, *AI gateway* for the model door, *spending limit* for the brake, *monthly AI budget* for the allowance and *AI check* for a judge. The code, the routes, the stored keys and the server's names keep the old ones (`lab`, `live`, `record/*`, `door`, `brake`, `judges`, `ai_monthly_allowance_usd`), and so do the sections of this document written before that day. The [plain words and settings spec](../specs/2026-11-07-chatbot-plain-words-and-settings.md) owns the full glossary.
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
| Status strip and figures | both below | Since the remake of 2026-11-05 evening (§0.1): four tiles (parts running on the server, x of y; live or not yet; this month's AI spend against the allowance; urgent flags), then six figures (replies, checks passed with their likely range, AI calls, average AI step, cost per reply, this month; since 2026-11-07 the typical AI step, the median, in place of the average when one record gives it, with the average under it); since 2026-11-06 replies, AI calls and cost per reply each carry their days as a small line |
| Worth knowing | the same numbers | Since 2026-11-06: up to four sentences on what the window's numbers mean (the busiest day and how many days had none, the weakest check and what it checks, which model made the most calls and which cost the most, the failed calls and their most common error; since 2026-11-07 also why they failed and whether any reply was lost, §0.8), each opening its section (`notesOf`) |
| On the server | the server console's `apps` read through its gateway (`lab-api.ts` `serverApps`), the same read as the Server page's Apps screen, read again each minute while the page is in view | Since 2026-11-06 the strip's first tile only (the plan's "becomes a one-line live strip; detail moves to System"): how many members of the groups `whatsapp` (the live bot: WAHA, n8n, Redis, Whisper, the model door) and `whatsapp-lab` (the lab) are running, and by name which are not; the tile opens System for who may open it, where each part's state, restarts and memory are listed. It needs the person's Server page access too; without it the tile says why and the rest of the page still shows |
| AI spend | PostHog, every `$ai_generation`'s `$ai_total_cost_usd` since the 1st, the hotel's time; the allowance from D1 | A meter against the month's AI allowance with three marks at 60%, 80% and 90% of it (US$30, US$40 and US$45 of US$50). Since 2026-11-07 the meter says they are guides only, since nothing emails or switches a model at them (MAINTENANCE.md HN-1), and says what each record's own brake does, read from its settings (`useBrakes`, `brakeSay`); since 2026-11-06 under it the window's cost by step, dearest first, with each step's cost per call |
| Live and lab | PostHog `$ai_generation` and `$ai_trace` in the window | Replies, chats, AI calls, failed calls, average call time and cost, split by source: an event with a `lab_chat` property is the lab's test, any other is the live bot's |
| AI checks | PostHog `$ai_evaluation` | The whole-chat review's average of 5 over its chats and the share that scored 4 or more (since 2026-11-06), then the five weakest yes/no checks, each with passed of answered, its rate and its 95% likely range (§0.1) |
| Needs a look | `GET /api/whatsapp-bot/part?part=flags`, read only when the person may open Flags | The latest five things flagged, each linking to its chat |
| Models | `$ai_generation` | Since 2026-11-06 one table, dearest first: each model's calls, cost (with a bar against the dearest), cost per call, average time and failed share; the ids of one model are one row (`modelLines`: Haiku 4.5's dated and plain ids) |
| Replies each day and hour | `$ai_trace` | Replies per day and, under it since 2026-11-06, per hour of day on a clock axis with the busiest hour read out, the hotel's time (America/Mexico_City); then four facts: days with replies, the busiest hour, replies a chat and AI calls a reply |
| Errors | failed `$ai_generation` | The four most frequent error texts, with their count and when last seen; since 2026-11-06 under them the models whose calls failed, with how many |

**The monthly AI allowance** (the owner, 2026-11-05): one limit in US dollars for everything that uses AI in a month (the bot, PostHog AI and the portal's AI), which the client sets each month. It is the `admin_portal_settings` row `ai_monthly_allowance_usd` (migration `0094`); with no row it is 5, and Vendor support set it at 50 on 2026-11-05. The page compares it with the AI spend PostHog was told about, which today is the bot's (lab) calls only. Since 2026-11-06 the Chatbot Settings page changes it (§0.5). What the meter counts is what the records see, the bot and the lab's own checks, so its words say so since 2026-11-07: PostHog's own AI evaluations were paid from the same AI account and never counted, which is why the owner's bill read US$5.80 while the pages read under US$2 (§0.8).

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

**Each day drawn, and the pages on a phone (since 2026-11-06).** The owner asked on 6 November
for every Chatbot page to be better designed. The daily charts (the Overview's and Trends'
replies, Money's AI cost, System's n8n runs) used to draw a smooth line through only the days that
had data, so two days of lab tests looked like a slope across the week. They now draw every day of
the window in the hotel's time (`insights/DayChart.tsx`: `windowDays`, `perDay`), a column from
zero for a day with some and a thin stub for a day with none, on one axis with a readout on touch
and the arrow keys; 90 days, too many columns for a phone, keep the line over the same filled
days. Trends' whole-chat score is a dot on each day chats were reviewed with the pass mark of 4
dashed (`ScoreDays`), since a line or a column would show scores on days nobody reviewed. Money's
axis writes $1.50 as $1.50 (`dollarTick`; it was rounded to $2). The Overview's Models are sorted
dearest first, as their heading says. A panel head with a choice in it wraps on a phone, the
title on its line and the choice under it (change record (private)).

**The Overview laid out again (since 2026-11-06).** The owner asked the same night for the
Overview to be easier to read at a glance: its panels left large blanks beside longer ones. Each
row of the grid now pairs panels of a like height: the days with the hours and their facts beside
the checks, *Needs a look* beside *AI spend* (the allowance with the window's cost by step), and
the models' table beside the errors with where they failed. A new *Worth knowing* panel says what
the numbers mean (§0). The figures carry their days as a small line, as a stat panel does; the
models are one table instead of a bar each; the chat insight step is named in words. It borrows
the patterns of widely used open-source dashboards (Grafana's stat panels and its rate, errors
and duration signals; Langfuse's cost and latency by model; Tremor's bar lists), written fresh on
the page's own kit with no new dependency (change record (private)).

**Models and steps remade, and every page checked for gaps (since 2026-11-06 night).** The owner
sent a screenshot of Models and steps ("can you do something about this page?"), then asked for
all the other pages to be checked. Models (`insights/ModelStats.tsx`) now opens with *Worth
knowing* (who did the work; the fastest and the cheapest of the models that rarely fail, 5
answered calls or more and under 1 in 10 failed, as a failed call comes back fast and cheap;
which fail often; answers cut off at the length limit) beside **Speed against cost**, a map of
each model's typical time against its cost per answered call on scales that step by ten times, a
dot's size its calls and hollow when it fails often. **Each model** is one table (calls, typical
and slow time, errors, the share read from the cache, tokens per call, cost per answered call,
cost), a model's alias and dated id one row (`modelRows`), and **Each step of the bot** groups
each step's models together under the step's name (`stepGroups`). Money's models are the same one
row per model, dearest first, as a table beside the tokens (`costRows`, `CostTable`), its cost by
step beside the day chart with lab tests against real customers. Trends puts the languages and
the pets in one panel (*Who writes*); System puts the runs with when each bot was last heard from.
A list across a whole row (Quality's failures, the flags, Trends' unanswered questions, System's
errors) takes two columns where they fit (`bt-cols`), each card's link or buttons at its foot.
Quality's check names keep 20rem on a wide screen so their bars start near them, and the flag
inbox's figures sit across the page above its grid. The tables were cut to a box four rows high
in production, where `posthog.css` loads after `chatbot-insights.css`; the rule now outweighs it
(`.ph-table-box.bt-table-box`). The patterns are those of widely used open-source LLM dashboards
(Langfuse's cost and latency by model as one table, the price against speed charts of model
leaderboards), written fresh on the page's kit with no new dependency
(change record (private)).

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
model's row adds the same two figures (`perCallOf`, `tokensSay`, `insights/ModelStats.tsx`). PostHog's question groups the
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
  (two questions, kept a minute); the record's copy of the checks still comes first. Until a chat is picked, the reading side lists the chats with a question still unanswered (the newest five, from the list already read) above the hint, as tall as the list (since 2026-11-06 night). Before lab 1.8.0 neither record answers, so the
  list is the lab's own chats, as before, and the line under the head says why.
- **Customers' words have their own permission.** The record's reads that carry them
  (`record/conversations`, `record/conversation`, `record/questions`, and since cf-vps lab 1.19.0
  one chat's download `record/data/chat`: `CHAT_WORDS_PATHS` in `src/lib/vps-proxy.ts`; and an
  export of messages, chats or chat insights, `record/data/export` with one of `CHAT_WORDS_TABLES`)
  pass the console gateway only for who holds the Chats page as well as the
  Server page (`denyBotPart`, the gateway's `chat_words` refusal), so server access alone does not
  open them. The Chats page is Owner and Vendor support by default (migration `0096`), and anyone
  else needs it given on the Access page.
- **One chat downloaded or erased** (since 2026-11-06, cf-vps lab 1.19.0; `ChatActions` in
  `insights/Conversations.tsx`). A real customer's chat has **Download this chat**: the chat, its
  insight forms, flags and AI checks and every message, as one JSON file (`chatAll`, the record's
  `record/data/chat` a page at a time), for a customer who asks what the hotel keeps. Who also holds
  the Settings page (`settingsOpen` from `[part].astro`) has **Erase this chat**: the record counts
  what it would remove (`record/data/forget-count`), the person types that number in the portal's
  dialog, and `record/data/forget` removes its messages, the chat, its insight forms, AI checks and
  flags only while the count is still that one (else `count_changed`, nothing removed). Its AI
  calls and replies stay in the totals without the chat. It is an admin call: the gateway holds it
  for the Settings page (`BOT_AI_CHANGES`), and cf-vps asks for `apps.bridge.admin` and a sign-in
  from the last 10 minutes, which the "Confirm it's you" dialog's emailed code gives. The record's
  log names the chat by its last 4 digits only.
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

### 0.5 Settings (since 2026-11-06; redesigned 2026-11-07)

*Phase 3 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "A screen to change
the monthly AI allowance and the judge share".* The section's Settings tab
(`/dashboard/chatbot/settings`, `settings.astro` and `insights/BotSettings.tsx`, migration `0097`)
is Owner and Vendor support by default; anyone else needs it given on the Access page.

**How the page is laid out** (since 2026-11-07, the owner: "completely change visual settings ...
as each page inside is difficult to use and understand"; the design rules and the glossary of the
words on screen are the [plain words and settings spec](../specs/2026-11-07-chatbot-plain-words-and-settings.md)):

- **A menu of twelve sections in four groups**, beside the page on a wide screen and one row that
  scrolls sideways on a phone, the open one kept in sight (`GROUPS` and `SECTIONS` in
  `insights/BotGlance.tsx`, `Menu`): *Start here*: **At a glance**; *How the bot answers*: **AI models**, **Reply safety**,
  **Opening hours**, **Prices**; *Watching the chats*: **AI checks**, **Flags**, **Emails**;
  *Behind the scenes*: **Timing**, **Workflows (n8n)**, **Stored data**, **Analytics (PostHog)**.
  A link with `#glance`, `#models`, `#safety`, `#hours`, `#prices`, `#checks`, `#flags`,
  `#emails`, `#timings`, `#n8n`, `#data` or `#posthog` opens one; any other opens At a glance
  (`sectionOf`). The line under the page's title says what the open section is for (`SECTION_SAY`).
- **One switch for the bot**, above every section that has a setting for each bot: **Test bot**
  (test chats only) or **Live bot** (real customers, in amber), with what a save does to it
  (`BotSwitch` in `insights/SettingsKit.tsx`). The test bot is picked first. Prices, Emails,
  Timing and Analytics have no switch: they are for both bots, or the test bot only.
- **At a glance** draws one tile per section from the picked bot's settings (`glanceOf` in
  `BotGlance.tsx`): the reply's model and the spending limit, the transfer to staff and the
  fallback model, the opening hours and holidays, how many AI checks are on, the flags' wait and kinds; then a "For both bots"
  row (the monthly AI budget, the emails, the pages' PostHog reads, the prices). A tile opens its
  section.
- **One setting is one row** (`Row`): its name and a plain line on what it does on the left, its
  control on the right (under them on a phone), and a tag where it helps decide: *Recommended* on
  the advised value, *Saves money* or *Costs more* where the bill changes. Yes-or-no settings are
  switches that say On or Off (`Switch`); a few choices are a row of buttons that scrolls sideways,
  each with its price where it has one, and the one in force kept in sight (`Choices`). Each
  model card names the model and its price in and out per million tokens; the dearer models sit
  behind "More models".
- **Each box ends in a save bar** (`SaveBar`) that stays at the bottom of the screen while the box
  has changes not saved: *Changes not saved yet*, *Fix the line in amber to save* or *Saved*, then
  **Reset to recommended**, **Discard changes** and **Save to test bot** or **Save to live bot**.
  Each still needs the save; a save to the live bot asks first in the portal's dialog.
- **Colours** (`.bs-*` in `chatbot-insights.css`): neutrals carry the page; blue marks what is
  chosen and the main button; green is a switch that is on; amber is the live bot, a cost or a line
  to look at; red is kept for removing data. Each colour has a word beside it.

| Section, box | What it changes | Where it is kept | Saved through |
|---|---|---|---|
| AI models: **AI models** | For the test bot or the live bot: **Use these settings** (off: every call goes to the model the workflow asks for, unchanged); each step (Customer replies, Payment check, Booking details, Photos, Other AI calls) on the workflow's model, the default model or a Claude model with a price on file, with its options (the reply's **Reasoning level** and **Date and price checks**, **Prompt caching**, the payment check's **Short prompt**, the booking details' **Low reasoning**); the **Spending limit**, which moves every step to one model once the month's AI cost of the bot's own steps reaches a figure; under *Advanced*, the default model | Each bot's server, with its last 20 versions and who saved each (cf-vps lab 1.17.0 `bot_settings`), under **Change history** | The console bridge, `record/settings/save` at the operate level, `part: models` |
| AI models: **Monthly AI budget** | The month's one figure for all AI, from US$1 to US$1,000 to the cent; it is compared with the month's AI cost and stops nothing | `admin_portal_settings` `ai_monthly_allowance_usd` (§0) | `POST /api/whatsapp-bot/settings` |
| Reply safety: **Reply safety** (since 2026-11-07) | For either bot: **Transfer to staff** on or off and its trigger words (up to 40, letters only, compared whole without accents or capitals), which make the reply apologise, say a person of the team will write soon and raise an urgent `handover` flag; **Outside opening hours** (the bot quotes but confirms no booking as final); **Maximum reply length** (off, or 30 to 400 words); the **Fallback model** tried once when a step's model fails, or none, with its price | Each bot's settings, the `safety` part (cf-vps lab 1.26.0) | `record/settings/save` with `part: safety` |
| Opening hours: **The hotel's opening hours and holidays** (since 2026-11-07) | For either bot: the open days and up to four spans of hours (Mexico City); **Closed on Mexican holidays**, and the coming holidays it opens anyway; up to 60 extra closed days, each with the reason the customer is told (Spanish, no quotes, up to 60 characters); up to 60 extra open days. The AI gateway's date and price checks, the flags and the test bot's workflow follow it; the test bot's save says when it could not write its workflow | Each bot's settings, the `hours` part (cf-vps lab 1.26.0) | `record/settings/save` with `part: hours` |
| Prices: **Prices the test bot quotes**, **Prices the live bot quotes** (since 2026-11-07) | Nothing: the price per day of each pet in Básico, Todo Incluido and daycare, the extras, what looks like a typo (a price of $0 or over $20,000 a day, Todo Incluido under Básico, a bigger dog under a smaller one) and the other steps with their own copy, read from each bot's instructions | The bot's n8n workflow (the reply step's instructions) | Read only (`record/workflow` `prices`, cf-vps lab 1.25.0) |
| AI checks: **AI checks on the replies** | For either bot: each of the five AI checks on or off (one off is never asked; the four code checks always run), the **Chat summary** on or off, and their Claude model with its price; for the test bot also **Who checks the test replies**: PostHog (its evaluations, copied as before), **Our AI checks** on the test bot's key from the moment it is saved, or nobody | Each bot's settings, the `checks` part (cf-vps lab 1.18.0) | `record/settings/save` with `part: checks` |
| AI checks: **How much the AI checks read, live chats** or **test chats** | The share of replies every AI check reads beyond those always checked (None, 1 in 10, 1 in 5, Half, All), and the month's cap of the AI checks and chat summaries together (US$0 stops them) | Each bot's server (cf-vps lab 1.13.0 `judge_share`, `judge_month_usd`) | The console bridge, `record/ai` at the operate level |
| Flags: **When staff are alerted** | For either bot: how many whole minutes (1 to 120) a customer may wait in opening hours before the chat is flagged; which kinds are raised (Failed checks, Payments, Waiting customers, Bot errors). The opening hours are shown, set under Opening hours since lab 1.26.0 (the flags follow them); a bot before it still takes them here | Each bot's settings, the `flags` part | `record/settings/save` with `part: flags` |
| Emails: **Urgent flags by email**, **Weekly report by email** | Off, **Test only** (the test bot's, each email marked as a test) or On (the live bot's), and up to five addresses (none: the alert inbox) | `admin_portal_settings` `chatbot-urgent-email` (§0.2) and `chatbot-weekly-email` (§0.6), as the jobs read them | `POST /api/whatsapp-bot/settings` |
| Timing: **Test bot timing** | The six numbers in the bot's n8n workflow that decide how it feels: the wait for more messages, the typing pause (shortest and longest), the wait before checking for a person, the hours quiet after a person writes, the messages the payment check reads, the longest photo description; each within the server's limits, with the test bot's value now, the recommended one (the live bot's export of 2 November) and the live bot's beside it | The test bot's settings, the `workflow` part (cf-vps lab 1.19.0), written into its workflow at once | `record/settings/save` with `part: workflow`, the test bot only |
| Timing: **Live bot timing** | Nothing: the same six numbers read from the live n8n's bot workflow | | Read only (`record/workflow`) |
| Workflows (n8n): **n8n workflows** | For either bot: switch a workflow off or on (the live one asks for the word typed); its runs and failures this week, n8n's latest runs and the week's failed ones are shown | n8n itself; each switch in the bot's log (`n8n_log`) | The console bridge, `record/n8n/switch` at the admin level |
| Stored data: **What is stored**, **Download**, **Remove a range of days**, **How long it keeps** | For either bot: nothing, a download of one table for a range of days (CSV or JSON), the removal of a group (conversations, activity, AI checks, everything) for a range of days, and the months kept (1 to 12) | Each bot's database on the server; each removal in its log (`data_log`) | Reads at the view level; `record/data/remove` and `record/data/keep` at the admin level |
| Analytics (PostHog): **PostHog for the chatbot** (since 2026-11-07) | One switch above the two below. Off saves the test bot's `posthog` part as not sending and no English copies (so no Claude call for them), moves a test bot whose test replies PostHog checked to our own AI checks (the `checks` part; PostHog has nothing to check once nothing is sent), and turns the pages' PostHog reads off. On sends and reads again and leaves the checker and the English copies as they were. *Partly on* when the two below disagree (`postHogAllOf`, `postHogAllPlan`) | The two places below | The two routes below, in that order |
| Analytics (PostHog): **Test bot's PostHog** | Whether the test bot sends its test turns to PostHog (off: what it makes meanwhile is marked as not sent, so on again sends only what comes after), and the English copy with them (one Claude Haiku 4.5 call per turn). The live bot sends nothing to PostHog from the server | The test bot's settings, the `posthog` part | `record/settings/save` with `part: posthog` |
| Analytics (PostHog): **Chatbot pages read PostHog** | On or off: off, `GET /api/whatsapp-bot/insights` and `/part` ask PostHog nothing and answer that the reads are off here, so the pages read only the bots' servers and a test chat shows no PostHog summaries | `admin_portal_settings` `chatbot-posthog-reads` (on with no row; `POSTHOG_READS_KEY` in `src/lib/posthog/bot.ts`) | `POST /api/whatsapp-bot/settings` |

On a wide screen the AI models section puts the models first and the monthly AI budget across the
row under them, and the Stored data section's download, removal and months kept stand three across.

- **The route** (`src/pages/api/whatsapp-bot/settings.ts`) asks for the section's key and the
  page's (`denyBotPart`), checks each value, and writes one audit row per changed row with the old
  and the new value ([SECURITY](../security/SECURITY.md) §6a).
- **Each bot's own AI checks** are read from its `record/status` (`ai`: the share, the cap and
  this month's spend; `readRecordAi` in `insights/record.ts`) and changed with `changeRecordAi`.
  The console gateway lets `record/ai` through only for who also holds this page (`changesBotAi`
  in `src/lib/vps-proxy.ts`, the `bot_settings` refusal, [VPS-CONSOLE](VPS-CONSOLE.md) §2), and
  cf-vps records each change as `app.bridge`. The live bot's box also says whether its AI checks
  are on: they stay off until its server has its own Anthropic key, added on move night.
- **A bot before an update** answers without the part a box needs, and the box says which update
  it needs (1.13.0 for the share and cap, 1.17.0 for the models, 1.18.0 for the checks, flags and
  PostHog, 1.26.0 for safety and hours); until move night the live bot's boxes say it sends nothing
  yet. The three portal rows can be changed at any time.
- **AI models** (`insights/BotModels.tsx`) reads one bot's `record/settings` (`readBotSettings` in
  `insights/record.ts`): the settings in force, the versions, the recommended settings, the models
  with their prices, this month's spend, whether the spending limit is reached, and how the AI
  gateway applies them. A save to the live bot asks first; the AI gateway uses it within 30
  seconds, from the next customer message, and the test bot's chats that use the bot settings at
  once. **Reset to recommended** fills in the gateway's own (the reply and the payment check on
  Claude Haiku 5.5), **Copy from test bot** the test bot's, and **Restore this version** an earlier
  one, models only. A step on the workflow's model is sent unchanged. How the gateway reads and
  applies them is cf-vps's `documentation/features/WHATSAPP-LAB.md`, "The bot's settings".
- **Each box saves its own part** (cf-vps lab 1.18.0), so the server takes only that part and
  keeps the rest as in force; two boxes opened at different times never undo each other. Each
  new version still holds the whole set. **Reset to recommended** is every AI check on, the chat
  summary on, Claude Haiku 5.5; a 10-minute wait, Monday to Saturday 9:00 to 14:00 and 15:00 to
  18:00, every kind; the test bot sending with English; Monday to Saturday hours with the holidays
  closed; the transfer to staff and the outside-hours rule on, no maximum length, Claude Sonnet 5.5
  as the fallback. The live bot's server follows a save within 30 seconds, the test bot at once.
- **Timing** (`TimingsSection` in `insights/BotN8n.tsx`, cf-vps lab 1.19.0) reads both bots'
  `record/workflow` at once. **Save to test bot** saves the `workflow` part (`saveTimings`); the
  test bot writes it into its workflow through n8n's API at once and answers how that went, which
  the box says (written, nothing to change, or why not). The live bot's server only reads its
  workflow and refuses the part: its timing changes on the server, with the owner, after trying it
  on the test bot.
- **Workflows (n8n)** (`N8nSection` in `insights/BotN8n.tsx`) reads one bot's `record/n8n`: n8n's
  workflows (names, on or off, size and when they changed, never a node's settings or a
  credential), n8n's 20 latest runs, and the week's runs and failures per workflow. **Switch off**
  and **Switch on** name the workflow as shown (`switchN8n`), so a list that changed meanwhile
  switches nothing; for the live bot the dialog asks for "off" or "on" typed, since a second
  workflow on would answer customers twice.
- **Stored data** (`DataSection` in `insights/BotData.tsx`) reads one bot's `record/data`: each
  table's rows, size, oldest and newest, the database's size, the months kept, the last nightly
  tidy and the log of removals. **Download** joins `record/data/export` pages (1,000 rows, about
  1.4 MB each) in the browser into one file; messages, chats and chat summaries are offered only
  with the Chats page (`chatsOpen` from `settings.astro`), which the gateway checks again.
  **Remove a range of days** counts first (`record/data/count`), then removes only those rows after
  the person types the total (`record/data/remove` with `asOf` and `expect`; a count that moved is
  refused with `count_changed` and counted again). **How long it keeps** counts what a shorter time
  removes at once (`record/data/keep-count`) and saves with the same typed count. The removals and
  the months are admin calls, held by the gateway for this page (`BOT_AI_CHANGES`) and by cf-vps for
  `apps.bridge.admin` and a sign-in from the last 10 minutes. What each group takes is cf-vps's
  `documentation/features/WHATSAPP-LAB.md`, "The record's data, n8n and the workflow's timings".
- **Reply safety, Opening hours and Prices** (`insights/BotHotel.tsx`, cf-vps lab 1.25.0 and 1.26.0)
  read and save like the boxes above (`PartLoader`, `usePartSave` in `insights/BotRules.tsx`). The
  forms check each line as the server does (`calendarOf`, `wordsOf`) and name the one that is wrong
  before a save. Prices reads both bots' `record/workflow` and never saves: a price changes in the
  bot's instructions. What the server does with each is cf-vps's
  `documentation/features/WHATSAPP-LAB.md`, "Hours, holidays and safety (1.26.0)" and "The prices
  (1.25.0)" (change record (private)).
- **A hand-over flag** (`handover`, urgent) is named in the Flags inbox ("A customer asked for a
  person or has a complaint", with the word that matched) and in the urgent email, whose subject
  for one is "A customer asked for a person"; the email never carries the word or the message.
- **The wait is a setting**, so the Flags inbox, the urgent flags email and its job's description
  say a customer waited without an answer, not "10 minutes".

The Configuration page lists this page among the settings kept elsewhere
(`SETTINGS_ELSEWHERE` in `src/lib/configuration.ts`).

### 0.6 The weekly report by email (since 2026-11-06, switched off)

*Phase 4 of the [analytics design](../specs/2026-11-05-chatbot-analytics.md): "a weekly report".*
PostHog's own email reports still cover the lab's numbers; this one is the bot's record's week,
so it covers real customers too, whose replies PostHog never sees. The
`bot-weekly` job (`src/workers/scheduled-bot-weekly.ts`, on the five-minute tick,
[CRON-CONTROL](CRON-CONTROL.md) §3h) sends it:

- **It reads** the record's `record/week` (cf-vps lab 1.16.0): the last 7 days in numbers only,
  the chats, the bot's replies and how many failed (since lab 1.22.0, the replies a customer never
  got, with the failed AI calls and why apart; the email names an older record's count as failed
  AI calls, which is what it was, §0.8), the week's and the month's AI cost, the AI
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

### 0.7 Two models side by side, and a test run in one press (since 2026-11-06)

*The owner's ask of 2026-11-06: a Sonnet 4.6 and Haiku 5.5 comparison "in all metrics" to show
the client, made automatically; his pick "Compare page, then test runs".* The Models page
(`/dashboard/chatbot/steps`) gains a **Show** choice in its toolbar: *Each model* is the page of
§0.1, *Side by side* is the new view (`insights/BotCompare.tsx`, its words and sums in
`insights/compare.ts`). `?view=compare` opens it, so a link can point at it. It needs nothing
beyond the Models tab's own key.

- **It reads** `record/compare?days=` of both records (`readCompare` in `insights/record.ts`,
  cf-vps lab 1.20.0): for each model that wrote the bot's replies, and each lab test setup (the
  last part of a test chat's name), the replies, failed replies, the typical and slowest-1-in-10
  AI time, the cost of the reply step and of each whole customer message, the reply length, the
  words written, the fallbacks and how each automatic check went. Numbers only, never a
  customer's words. A record older than 1.20.0 says so in the line under the choices.
- **Which two.** Two rows of choices, *First* and *Second*, each model and setup with its count of
  replies. It starts on today's bot against the busiest named test on another model
  (`defaultPair`). A sentence at the top says how the second differs (`headline`): "costs 12×
  less per customer message, takes 1.2 s longer typically, passed 97% of the checks against 88%".
- **Every measure** is one row each: both figures, the difference in words (`timesSay`,
  `secsSay`, `pointsSay`) and "✓ better" on the side that did better, where better has a
  meaning (reply length has none). A cost under ten cents shows four decimals, so US$0.0107 is
  not rounded to US$0.01. **Each automatic check** pairs every check either side ran, with its
  pass rate and 95% range, or "Not checked".
- **Print.** The Print button prints only the comparison, with a heading that names both sides,
  the days and the date; the choices, the tabs and the test run are left off, so the page goes
  straight into a client deck as a PDF. It prints in the light theme whatever the screen's
  (`lightForPrint`: the theme changes for the print alone, the saved choice is not touched).
- **Run a test.** The panel under it reads the lab's `compare/plan` every 5 seconds while a run
  goes. Choose one to three setups (*Today's bot*, *Saved settings*, or any Claude model in the
  setup Haiku 5.5 was tested with; today's bot and Haiku 5.5 are chosen first) and *Once*, *2
  times* or *3 times*; the panel counts the test messages that makes. The button asks once in
  the portal's dialog, then calls `compare/start` through the console bridge as an operate call
  (`labChange`), so the gateway checks the person and the server the bridge's operate capability,
  as for any lab test chat. The lab sends its six test conversations, one run at a time, and
  stops a run at US$1; the panel shows its progress, then each setup's totals, and the five
  latest runs. When a run ends the comparison reads again, and the new setups appear in it. A
  refusal (a run already going, the lab not set up) shows in the lab's own words.

What the lab does with a run (its six conversations, their dates, which move with the calendar,
and the cap) is cf-vps's, in its lab guide's "A test run in one press". No new table, setting,
key or route in the portal
(change record (private)).

### 0.8 What the numbers mean (since 2026-11-07)

*The owner, 7 November: the pages said "35 failed replies" after a night when no customer went
unanswered, and the AI bill read US$5.80 where the pages read under US$2.* Each number on the
Chatbot pages now counts one thing, and says which:

- **A failed AI call is not a failed reply.** A call the provider refused or that timed out is
  counted as a failed call, with why (cf-vps lab 1.22.0, its record's `CAUSE`): refused as set up
  (a key, a model name or a field), over a limit or a free allowance, the provider down or slow,
  or other. A reply a customer never got is a turn that ended in an error or in silence, its own
  number (`unanswered`). Overview's "Worth knowing" says both (`causesSay`, `notesOf`); it is
  red only when a reply was lost and 5% or more of the calls failed. The 35 of 5 November were 20
  set-up refusals, 13 free-allowance refusals and 2 provider failures while a new key was set up;
  at the owner's request they and their 35 flags were removed from the lab's record after a backup.
- **One error once.** The record groups an error's text with its ids, times and long numbers
  taken out, so one error that happened 13 times is one line of 13.
- **Typical and average.** The AI step's typical time is the median (half the calls were
  quicker); the average beside it is pulled up by a few slow calls. With both sources answering,
  two medians do not make one, so the tile shows the average (`bothOf`).
- **The slowest step is a real step.** The bot's own wait for more messages is left out of
  System's slowest step.
- **The month's AI cost is what the records count:** the bot's calls and the lab's own judges
  (which count against the lab's cap, §0.5). PostHog's AI evaluations were five AI judges run by
  PostHog on every lab reply with Haiku 4.5, paid from the same AI account and never in the
  record: about US$4.47 of the US$5.80 (US$4.20 on 5 November), found by PostHog's own
  evaluation events. They are off in PostHog since 7 November, each saying why; PostHog's
  four code checks, which cost nothing, still run. "PostHog, all of it" (§0.5) stops the rest.
- **The marks are not a brake.** The meter's 60%, 80% and 90% marks send nothing and switch
  nothing; what switches every step to one model is each record's own brake (Settings → Models),
  and the meter says whether one is set.

The pages read these from the record once lab 1.22.0 is installed; before that they show what
they did, the averages and the failed calls without their causes. No new table, setting, key or
route in the portal (change record (private)).

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
| **BotSettings** | `insights/BotSettings.tsx`, `insights/BotModels.tsx`, `insights/BotRules.tsx` | The Settings tab of §0.5 (since 2026-11-06): the models, the allowance, the emails, each record's own AI, its AI checks and flags, the lab's PostHog and the pages' PostHog reads, each panel saved on its own |
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
| 2026-11-07 | §0.5 rewritten for the redesign (the menu's groups and twelve sections, the bot switch, At a glance, the rows, tags, save bar and colours, every box's name and its words) against `insights/SettingsKit.tsx`, `insights/BotSettings.tsx` (`Menu`) and `insights/BotGlance.tsx` (`GROUPS`, `SECTIONS`, `SECTION_SAY`, `sectionOf`, `glanceOf`), `insights/BotModels.tsx`, `insights/BotRules.tsx`, `insights/BotHotel.tsx`, `insights/BotN8n.tsx`, `insights/BotData.tsx` and `chatbot-insights.css`; the header's words note and the Test bot line against migration `0098` and the live `admin_pages` rows read through the Cloudflare D1 connector | §0 to §0.4 and §0.6 to §0.8 keep the words of the day they were written (the words note says so); the pages were not opened in a browser, only rendered in tests |
| 2026-11-07 | §0.5's Safety, Hours and Prices rows, the Flags row and the hand-over line against `insights/BotHotel.tsx`, `insights/BotRules.tsx` (`PartLoader`, `usePartSave`, `WeekFields`, `FlagsForm`), `insights/BotSettings.tsx` (`SECTIONS`, `SECTION_SAY`), `insights/record.ts`, `insights/record-data.ts`, `insights/FlagInbox.tsx`, `src/workers/scheduled-bot-flags.ts` and cf-vps `apps/whatsapp-lab/src/settings.ts`, `rules.ts`, `flags.ts` and `workflows.ts` at `5a1ee1e` (lab 1.26.0); `test/whatsapp-bot-hotel.test.ts`, `test/whatsapp-bot-rules.test.ts` and `test/bot-flags-email.test.ts` pass | The boxes against the installed lab 1.26.0 and on the owner's phone; `last_verified` left as it was |
| 2026-11-07 | §0.8 (new), §0's figures, Worth knowing, AI spend and allowance lines, §0.5's "PostHog, all of it" row and §0.6's failed line against `BotOverview.tsx` (`bothOf`, `notesOf`), `src/lib/posthog/bot.ts` (`FAILED_CAUSES`, `causesSay`), `insights/kit.tsx` (`brakeSay`, `Meter`), `insights/record.ts` (`mergeOverview`), `insights/brakes.ts` (`useBrakes`), `insights/BotSettings.tsx` (`postHogAllOf`, `postHogAllPlan`, `PostHogAllPanel`), `src/workers/scheduled-bot-weekly.ts` and cf-vps `apps/whatsapp-lab/src/record.ts` at `49ab4c2` (lab 1.22.0); the owner's AI bill against PostHog's evaluation and generation events of 4 to 6 November; that no `$ai_generation` without `lab_chat` reached PostHog in the last 30 days; the five PostHog AI evaluations read back disabled; `test/whatsapp-bot-overview.test.ts`, `test/whatsapp-bot-sections.test.ts`, `test/whatsapp-bot-record.test.ts`, `test/whatsapp-bot-settings.test.ts` and `test/bot-weekly-email.test.ts` pass | The pages against lab 1.22.0 (not installed yet) and on the owner's phone; the switch saved against the live lab; `last_verified` left as it was |
| 2026-11-06 | §0.1's "Models and steps remade", §0.3's reading side and §0.5's layout line against `insights/ModelStats.tsx` (`modelRows`, `bestOf`, `stepGroups`, `modelNotes`, `costRows`, `ModelTable`, `StepTable`, `CostTable`, `ModelMap`, `logTicks`), `insights/BotInsights.tsx` (Models, Money, Trends, System, Quality, Flags), `insights/Business.tsx`, `insights/FlagInbox.tsx`, `insights/Conversations.tsx` (`ChatLine`, `ChatPick`, `waitingOf`), `insights/BotSettings.tsx` and `src/styles/pages/chatbot-insights.css`; `test/chatbot-pages-layout.test.ts`, `test/chatbot-look.test.ts` and `test/whatsapp-bot-sections.test.ts` pass; every Chatbot page drawn locally in production's stylesheet order at 1,440 px and 390 px (Models also light), from PostHog's numbers of 5 and 6 November and, for Flags, Chats and Settings, the record's shapes from lab 1.20.0's source with testing numbers | The pages on the owner's phone and against the live record; `last_verified` left as it was |
| 2026-11-06 | §0's table and §0.1's "Overview laid out again" against `BotOverview.tsx` (`notesOf`, `modelLines`, `weakChecks`, `reviewOf`, `daysOf`, `errorSay`, `Hours`, `Facts`, `Checks`, `Models`, `FailedBy`), `Figs` in `frame.tsx` (its spark), `Columns` in `charts.tsx` (`rest`), `STEP_NAME` in `insights/kit.tsx` and `src/styles/pages/chatbot-insights.css`; `test/whatsapp-bot-overview.test.ts` and `test/chatbot-look.test.ts` pass; the page drawn locally at 1,440 px (dark and light) and 390 px from the lab's numbers of 5 November | The page on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.7 (new) against `insights/BotCompare.tsx` (`SideBySide`, `TestRun`, `BotCompare`, `lightForPrint`), `insights/compare.ts` (`sidesOf`, `defaultPair`, `measures`, `headline`, `checkPairs`, `readTestPlan`, `startTestRun`, `defaultTestSetups`, `runSay`), `insights/record.ts` (`readCompare`), `insights/BotInsights.tsx` (`ModelsPart`, the Show choice, `?view=compare`), the print rules in `src/styles/pages/chatbot-insights.css`, and cf-vps `apps/whatsapp-lab/src/record.ts` (`compare`), `testrun.ts` and `admin.ts` (`compare/plan`, `compare/start`) at `26a9c40` (lab 1.20.0); `test/whatsapp-bot-compare.test.ts`, `test/whatsapp-bot-record.test.ts` and `test/whatsapp-bot-sections.test.ts` pass | The view against lab 1.20.0 (not installed), a real test run against the Anthropic API, a printed page, and the page on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.1's "Each day drawn" and §0.5's line per section against `insights/DayChart.tsx` (`windowDays`, `perDay`, `DayChart`, `ScoreDays`), `insights/BotInsights.tsx` (Money, Trends, System, `dollarTick`), `BotOverview.tsx` (replies each day, Models' order), `insights/BotSettings.tsx` (`SECTION_SAY`), `insights/BotData.tsx`, `insights/BotN8n.tsx` and `src/styles/pages/chatbot-insights.css`; `test/chatbot-day-chart.test.ts` and `test/whatsapp-bot-data.test.ts` pass; each page drawn at phone width, dark and light, from the lab's real numbers in a local build | The pages on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.5's eight sections and its new rows (Timings, n8n, Data) and §0.3's download and erasure against `insights/BotData.tsx`, `insights/BotN8n.tsx`, `insights/Conversations.tsx` (`ChatActions`), `insights/BotSettings.tsx` (`SECTIONS`), `insights/record-data.ts` (the data, n8n and timings calls), `lab-api.ts` (`memberAdmin`, the `fresh_sign_in` reading), `src/lib/vps-proxy.ts` (`CHAT_WORDS_PATHS`, `CHAT_WORDS_TABLES`, `BOT_AI_CHANGES`), `settings.astro` and `[part].astro`, and cf-vps `apps/whatsapp-lab/src/data.ts`, `workflows.ts`, `timings.ts` and `admin.ts` at `7c7c411` (lab 1.19.0); `test/whatsapp-bot-data.test.ts` and `test/vps-gateway.test.ts` pass | The panels against lab 1.19.0 (not installed) and on the owner's phone; `last_verified` left as it was |
| 2026-11-06 | §0.5's five sections and its four new panels against `insights/BotRules.tsx` (`ChecksForm`, `FlagsForm`, `LabPostHogForm`, `spansOf`, `minutesOf`), `insights/BotSettings.tsx` (`SECTIONS`, `PostHogReads`, the lab's share), `insights/record.ts` (`saveBotSettings` with `part`), `src/lib/posthog/bot.ts` (`POSTHOG_READS_KEY`, `READS_OFF`), `src/pages/api/whatsapp-bot/{settings,insights,part}.ts`, and cf-vps `apps/whatsapp-lab/src/settings.ts` (`SETTINGS_PARTS`, `withPart`, `settingsView`), `judges.ts`, `flags.ts` and `posthog.ts` at `bb01388` (lab 1.18.0); `test/whatsapp-bot-rules.test.ts`, `test/whatsapp-bot-settings.test.ts`, `test/whatsapp-bot-models.test.ts`, `test/bot-flags-email.test.ts`, `test/whatsapp-bot-sections.test.ts` and `test/whatsapp-bot-overview.test.ts` pass | The panels against lab 1.18.0 (not installed) and on the owner's phone; `last_verified` left as it was |
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
