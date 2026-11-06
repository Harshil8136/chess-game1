---
title: "The WhatsApp bot's analytics in the Chatbot section — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-05
verified_against: [code, infra]
owner: harshil
related_code:
- src/lib/posthog/bot-parts.ts
- src/lib/posthog/bot.ts
- src/pages/api/whatsapp-bot/part.ts
- src/pages/api/whatsapp-bot/insights.ts
- src/pages/dashboard/chatbot/[part].astro
- src/pages/dashboard/chatbot/dashboard.astro
- src/components/admin/chatbot/BotOverview.tsx
- src/components/admin/chatbot/insights/BotInsights.tsx
- src/components/admin/chatbot/insights/kit.tsx
- src/components/admin/chatbot/insights/record.ts
- src/layouts/ChatbotLayout.astro
- src/styles/pages/chatbot-insights.css
- migrations/0096_chatbot_bot_sections.sql
related_docs:
- ../features/CHATBOT.md
- ../features/WHATSAPP-LAB.md
- ../features/POSTHOG.md
- 2026-11-05-chatbot-section-frame.md
- ../records/reports/2026-11-05-chatbot-analytics-sections.md
- ../records/reports/2026-11-05-chatbot-server-record.md
- ../records/reports/2026-11-05-chatbot-checks-from-record.md
tags: [design, chatbot, whatsapp, posthog, analytics, ui]
---

# The WhatsApp bot's analytics in the Chatbot section — design

> **TL;DR (non-technical):** The owner asked for the Chatbot section to become a real analytics
> section like the PostHog page, "but unique and better": several sections across the top, the
> AI's cost from the data we collect, trends, what the AI checks flagged, and how sure each number
> is. Phase 1 (this design, built on 2026-11-05) gives the section an Overview and seven tabs,
> Chats, Quality, Flags, Money, Trends, Models and steps, and System, all from data the bot already
> sends today. Phase 2 (built the same night) has Money, Models and steps, and System read the
> bot's own record on the server first, and once the lab copies PostHog's AI checks (lab 1.7.0)
> the Overview, Quality, Flags, Trends and a chat's checks do too; phase 3 adds the real
> customers' chats after move night.

## 1. The ask

Harshil, 2026-11-05 18:49 UTC, about `/dashboard/chatbot/dashboard`: "I was expecting multiple
sections from header like posthog, our pricing analytics from collected data, trends, any flags
by ai, confidence rate … isn't it possible to store logs and data of it accurately! then use it
for all analytics, metrics, graphs and much more in all sections? … its ui/ux is extremely
horrible! it needs complete makeover … like our PostHog page have but unique and better."

The research and the plan of four phases were written up for him the same evening ("WhatsApp
bot analytics: research and rebuild plan", a Claude Doc in the project). This document is the
design of phase 1, which needs no server change and so could start at once.

## 2. The four phases

| Phase | What | Gate before it |
|---|---|---|
| 1 | The section's Overview and seven tabs from today's data: PostHog's `$ai_*` events from the bot's AI steps, and the lab's own chats through the server console's gateway | none |
| 2 | A recorder on the server and the bot's own database (Postgres beside n8n): the lab's calls and n8n's runs written as they happen; the pages switch to its totals | the owner's yes to install it |
| 3 | The real bot: WhatsApp messages and read ticks, a chat insight step, urgent flags by email when switched on | move night, the privacy record (RoPA) and the owner's yes |
| 4 | Similar chats, topic groups in our own database, a weekly report | the owner's yes to a new server package |

## 3. Phase 1: what each tab shows

Every tab reads one fixed set of HogQL questions (`partQueries` in `src/lib/posthog/bot-parts.ts`)
through `GET /api/whatsapp-bot/part?part=…&days=7|30|90`, with the PostHog key the portal
already holds. The questions have two inputs only, the window (7, 30 or 90 days) and, for Chats,
trace ids that match `wl-<8 hex>-turn-<n>`; nothing a person types reaches a question.

| Tab | Path | Shows |
|---|---|---|
| Overview | `/dashboard/chatbot/dashboard` | A status strip (server parts running, live or not, AI this month against the allowance, urgent flags), six figures, and panels that each open the tab behind them: replies each day, the weakest AI checks with their likely range, the latest flags, the allowance, cost by step and by model, busiest hours, the bot's parts on the server, the most frequent errors |
| Chats | `/dashboard/chatbot/chats` | The lab's chats (the lab's `chats` and `chat` views through the console gateway) and, for the chat opened, each reply with the AI checks it passed or failed and the judge's reason. A flag's "Open the chat" lands here on its chat |
| Quality | `/dashboard/chatbot/quality` | Each AI check, weakest first: passed of answered, the rate, its 95% likely range as a bar, a daily line, and the latest failures with the judge's reason |
| Flags | `/dashboard/chatbot/flags` | What the checks flagged and the AI calls that failed, newest first, filtered All, Urgent, Checks, Errors. Urgent, because staff must act: a payment claim not handed to the owner, and a person promised when nothing alerts anyone |
| Money | `/dashboard/chatbot/money` | This month against the AI allowance with the month's end at this pace, per reply and per chat, cost each day, by step and by model, the tokens read fresh, read from the cache, written to the cache and written as replies, and lab against real customers |
| Trends | `/dashboard/chatbot/trends` | Replies and chats each day, a weekday by hour heat map in the hotel's time, the customer's mood each day and the whole-chat score each day |
| Models and steps | `/dashboard/chatbot/steps` | Each model and each step: calls, the typical and the slow time (median and 95th percentile), failures, tokens, cache use and cost, why answers stopped, and the HTTP answers |
| System | `/dashboard/chatbot/system` | The bot's parts on the server (the console's Apps read), n8n's runs each day, when each source was last heard from, and the most frequent errors of runs and of AI calls |

**How sure a rate is.** Every pass rate carries its 95% Wilson interval ("likely 85% to 94%") and
how many answers it rests on. Under 20 answers it is marked as resting on few answers and drawn
in a quieter tone, so a rate from three answers never reads as firm. A check's answer counts as
skipped, not passed, when the check says it does not apply.

**What passes.** A yes/no check passes on yes, except Promises a person, which fails on yes. The
whole-chat review passes at 4 or more of 5; a WhatsApp-sized reply at 700 characters or fewer; the
customer's mood when it is neutral or positive (`CHECK_RULES`, `verdictOf`).

**Lab and real customers.** An AI call with a `lab_chat` property, or a check whose name starts
with "WhatsApp lab", is the lab's; anything else is the live bot's. Quality, Flags and Trends offer
the choice as a sideways row (Real customers, Lab tests); Money shows the two side by side. Until move night the live bot sends nothing,
and each tab says so in words rather than showing zeros as if they were real.

**Privacy.** Numbers only for real customers (the owner's choice of 2026-11-05): a judge's
reason is asked of PostHog only for the lab's tests, never for a real customer's reply, and no
message text or phone number is asked of PostHog at all. The chats' words on the Chats tab are
the lab's fake test chats, read from the lab, and the tab is Owner by default.

**Freshness and cost.** Answers are kept in the edge cache (never KV): one minute for Chats and
Flags, ten minutes for the others; Refresh asks again. Each tab is at most four questions,
asked three at a time so PostHog's limit on queries running at once is never reached.

### Phase 2: the server's record (built 2026-11-05)

The lab (1.6.0) and a recorder beside the real bot write every AI call and n8n run, one row
each, to their own databases in the server's Postgres (cf-vps
`documentation/records/2026-11-05-bot-record.md`). Each answers `record/money`,
`record/models` and `record/system` for 7, 30 or 90 days in the shapes of `bot-parts.ts`, through
the console bridge the lab's pages already read (`apps/bridge/view`, any member).

| Tab | On the record |
|---|---|
| Money | Both records added: each source's month, days and tokens kept apart, steps and models summed by name |
| Models and steps | One source at a time (Real customers, Lab tests): a median cannot be added across two |
| System | One source at a time, each source's last call or run side by side, and each n8n workflow's runs, failures, typical time and usually slowest step |

**Which it reads.** Both records are asked at once (`insights/record.ts`). If at least one
answers, the page draws the record; if neither does (not installed, an older lab, no database),
it reads PostHog as in phase 1. One line under the page's choices says which, and why a record
is missing. Money's allowance is read by the page (`[part].astro`), since the record does not
carry it.

**Not taken.** Mixing a record's source with PostHog's other source on one page (PostHog's lab
numbers with the record's live ones): the two count differently, and a page from two systems
could not say where a figure came from. A new cf-admin route that queries Postgres: the
Worker cannot reach the server's database, and the bridge already carries signed reads.

### Phase 2, continued: the AI checks from the record (lab 1.7.0, built 2026-11-05)

*The owner, 21:15 UTC: "we kind of need to fetch or download PostHog data cuz it takes ton of
time to get all PostHog data to us".* The AI checks were the one thing only PostHog had. The lab
now reads them back from PostHog with two saved reads (PostHog Endpoints, a key that can run
only those) and keeps each verdict in its record, graded by the check's own pass rule as PostHog
grades it, with one row per reply beside it (cf-vps
`documentation/records/2026-11-05-ai-checks-copy.md`). Its record then answers four more reads,
`record/overview|quality|flags|trends?days=`, and `record/chats?traces=` for a lab chat's checks,
in the shapes of `bot.ts` and `bot-parts.ts`.

| Page | On the record |
|---|---|
| Overview | Both records as one: each source's totals and checks apart; the month, days, hours and errors added; a typical time weighted by calls. The allowance is read by the page (`dashboard.astro`). The *Needs a look* panel reads `record/flags` |
| Quality | Each source's checks, every failure newest first |
| Flags | Failed checks and failed calls of both, newest first |
| Trends | The week's heat and the moods added, days kept by source, the whole-chat score weighted by chats |
| Chats | A lab chat's checks from the lab's record, by the replies' PostHog trace ids |

**Never fewer checks than PostHog.** A record whose checks are not copied yet (no read key, or
before its first read) refuses these reads with `checks_off`, so the page reads PostHog and says
"its AI checks are not copied yet" rather than show no checks while PostHog has them. Money,
Models and System are not affected. The real bot's checks join in phase 3, when the recorder
copies them the same way.

**Not taken.** PostHog's destinations (a webhook per event) miss what comes while the server
cannot be reached and need an address into the server; a batch export writes to an outside
store the server would have to read in turn; asking PostHog's query API from the lab needs a
key that can run any question on the project (cf-vps change record, §5).

### Phase 4: topic groups, similar chats and a weekly report (started 2026-11-06)

**Topic groups (built, cf-vps lab 1.15.0).** The chat insight step, which already reads each
conversation once, also names the topics the customer raised, at most four, from a fixed list of
11 (prices, availability, booking and paying, vaccines and rules, food and care, health and
temperament, address and hours, transport, updates, a complaint, other), kept in the record and
counted by `record/insights`. Trends draws them as **What customers raise**. A fixed list counts
the same way every month and needs no new package; the same call, so no new cost.

**Similar chats: the owner's choice, pending.** Three ways were weighed (2026-11-06):

| Way | What it needs | Text leaves the server? | Cost at about 9 chats a day |
|---|---|---|---|
| The record's word search (Postgres full-text, Spanish and English, since lab 1.8.0) with the topics and services, ranked by shared words | nothing new | no | none |
| pgvector (`postgresql-18-pgvector` from the PostgreSQL apt repository the server already uses; `CREATE EXTENSION vector` by the database's owner) with Cloudflare Workers AI's `@cf/baai/bge-m3` embeddings (multilingual) | one server package; the recorder gets the Workers AI keys the lab already has (`WORKERS_AI_TOKEN`, `WORKERS_AI_ACCOUNT`) | to Cloudflare | about US$0: 1,075 neurons per million tokens against 10,000 free neurons a day |
| pgvector with an embedding model running on the server | one server package and a new library in the bot, a few hundred MB more memory | no | none |

The recommendation is the first: at this traffic, topics plus shared words find the same kind of
chat, and pgvector can be added when the real chats number in the thousands. Anthropic offers no
embeddings of its own.

**The weekly report (built, cf-vps lab 1.16.0 and the portal's `bot-weekly` job, switched off).**
Every way of finding similar chats leaves it the same, so it did not wait for the choice: the
record's last 7 days in numbers (`record/week`: chats, replies, AI cost and checks, what the
conversations became, prices, topics, services, lost reasons, open flags), emailed on Monday at
9:00 in Mexico City, off until the owner turns it on in Settings, as the urgent email is
([CHATBOT](../features/CHATBOT.md) §0.6). It reads the bot's own record rather than PostHog, so it
covers real customers too, whose replies PostHog never sees; PostHog's own email reports stay
available for the lab's numbers, as the approved plan keeps them.

## 4. Who may open what

Each tab is a page of its own in `admin_pages` (migration `0096`), so it can be given or kept
back alone on the Access page, like the PostHog and Sentry sections' tabs. Defaults: Chats is
Owner (it shows chat words, like the lab); the other six are Admin. The page and its route both
ask for the Chatbot section's key and then the tab's own (`denyBotPart`), by exact key, so
holding one tab opens no other. The Overview links a panel to its tab only when the person may
open that tab, and reads the Flags panel only then.

Since 2026-11-06 (phase 3) an eighth tab, Settings (migration `0097`), Owner by default: the
monthly AI allowance, the urgent flags email and each record's own AI, the AI checks' share and
cap ([CHATBOT](../features/CHATBOT.md) §0.5). The console gateway lets a change of a record's own
AI through only for its holders.

## 5. The look

The tabs sit in the section's one underlined tab row ([frame design](2026-11-05-chatbot-section-frame.md)),
between the Overview and the WhatsApp lab. Every tab is built from the PostHog page's kit
(`src/components/dashboard/posthog/frame.tsx` and `charts.tsx`): the same header, panels, figures,
charts and heat map, so the two sections read as one portal. What makes it the bot's own is a
teal accent tuned for both themes (`src/styles/pages/chatbot-insights.css`, contrast checked
against both backgrounds), the status strip, the likely-range bars and the flag cards. On a phone
every choice (window, source, filter) is a sideways-scrolling row above the panels, and every
panel stacks to one column.

The tabs were checked in local screenshots at phone width (390 px) and at 1,280 px, dark and
light, rendered from the real lab numbers read live from PostHog on 2026-11-05.

## 6. Alternatives not taken

- **A new table or a second store for the numbers.** PostHog already holds every AI call, check
  and trace the bot sends, with costs; phase 1 reads it. The bot's own records are phase 2, on the
  server's Postgres, not in D1 (RULE #0.9).
- **One long page.** The owner asked for sections across the top; separate pages also let a tab
  be given alone.
- **Showing a judge's reasoning for real customers.** Left out by the owner's numbers-only choice.

## 7. Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-11-06 | Phase 4's weekly report paragraph against `src/workers/scheduled-bot-weekly.ts` and cf-vps `apps/whatsapp-lab/src/record.ts` (`week`) at `88717cf`; `test/bot-weekly-email.test.ts` passes | The email in a real mailbox; lab 1.16.0 is not installed |
| 2026-11-06 | Phase 4's section: the topics against cf-vps `apps/whatsapp-lab/src/insights.ts` and `record.ts` at `c6f4e8b`; pgvector's package against cf-vps `host/57-postgres/apply.sh` (the PostgreSQL apt repository, PostgreSQL 18) and the lab's Workers AI key names against `apps/whatsapp-lab/whatsapp-lab.toml`; the bge-m3 price against Cloudflare's Workers AI pricing page, read 2026-11-06 | pgvector on the server (not installed); the embeddings' quality on the hotel's chats |
| 2026-11-06 | §4's Settings paragraph against `migrations/0097_chatbot_settings_page.sql`, `src/pages/dashboard/chatbot/settings.astro` and `changesBotAi` in `src/lib/vps-proxy.ts`; `test/whatsapp-bot-settings.test.ts` passes | The rest of the design |
| 2026-11-05 | Phase 2's AI-checks part: `insights/record.ts` (`CHECK_PARTS`, the four merges, `useBotPart`, `useChatChecks`), `insights/BotInsights.tsx`, `BotOverview.tsx` and `dashboard.astro` against cf-vps `apps/whatsapp-lab/src/record.ts` (`VIEWS`, `shapeView`), `checks.ts` and `admin.ts`; `test/whatsapp-bot-record.test.ts` passes; `cf-vps/test/lab/checks.test.ts` ran against a real Postgres 16 | The pages against the installed lab 1.7.0 (not on the server yet; it needs the owner's read key); the pages on the owner's phone |
| 2026-11-05 | Phase 2: `insights/record.ts`, `insights/BotInsights.tsx`, `lab-api.ts` and `[part].astro` against cf-vps `apps/whatsapp-lab/src/record.ts` (`shapeView`, `VIEWS`) and `recorder.ts`; `test/whatsapp-bot-record.test.ts` passes; `cf-vps/test/lab/record.test.ts` ran against a real Postgres 16 | The pages against the installed records (not on the server yet); the pages on the owner's phone |
| 2026-11-05 | Every question in `partQueries` run live against the PostHog project (lab events only); the parsers and the confidence math in `test/whatsapp-bot-sections.test.ts`; the route's 401, 400 and 403; the look in `test/chatbot-look.test.ts`; screenshots at 390 px and 1,280 px in both themes from those live numbers | The pages on the owner's phone; the live bot's events (it sends none until move night) |
