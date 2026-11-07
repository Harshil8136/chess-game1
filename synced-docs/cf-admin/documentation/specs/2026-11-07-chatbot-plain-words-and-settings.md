---
title: "The Chatbot section in plain words, and the Settings page remade — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-07
verified_against: [code]
owner: harshil
related_code:
- src/components/admin/chatbot/insights/SettingsKit.tsx
- src/components/admin/chatbot/insights/BotSettings.tsx
- src/components/admin/chatbot/insights/BotGlance.tsx
- src/components/admin/chatbot/insights/BotModels.tsx
- src/components/admin/chatbot/insights/BotRules.tsx
- src/components/admin/chatbot/insights/BotHotel.tsx
- src/components/admin/chatbot/insights/BotN8n.tsx
- src/components/admin/chatbot/insights/BotData.tsx
- src/components/admin/chatbot/insights/kit.tsx
- src/components/admin/chatbot/whatsapp/ChatModels.tsx
- src/components/admin/chatbot/whatsapp/ChatInfo.tsx
- src/components/admin/chatbot/whatsapp/format.ts
- src/styles/pages/chatbot-insights.css
- migrations/0098_chatbot_plain_words.sql
- test/chatbot-settings-kit.test.ts
related_docs:
- ../features/CHATBOT.md
- ../features/WHATSAPP-LAB.md
- ../reference/DESIGN-SYSTEM.md
- 2026-11-05-chatbot-section-frame.md
- ../records/reports/2026-11-07-chatbot-plain-words-and-settings.md
tags: [chatbot, whatsapp, settings, design, glossary, ux-copy]
---

# The Chatbot section in plain words, and the Settings page remade — design

> **In short:** the Chatbot pages now use words a person outside the project knows at once
> (*Test bot*, *AI gateway*, *Spending limit*, *Prompt caching*, *Transfer to staff*), and the
> Settings page is rebuilt from a few shared pieces so every section reads the same way: a menu,
> a Test bot or Live bot switch, one row per setting with a plain line, switches that say On or
> Off, choices as buttons with their price, and a save bar that says what is not saved yet.

**Asked by the owner, 2026-11-07:** "Can you change terms in entire codebase to be more standard
and easy to use cuz its difficult for me to understand: Lab, door, monthly break etc. This are a
little confusing so review others too. Plus completely change visual settings and use better
color, design, visual approaches for … /dashboard/chatbot/settings as each page inside is
difficult to use and understand!"

## 1. The rule: words on screen change, names in the code stay

The words a person reads changed. The names the code, the server and the stored data use did
**not**, because they are shared with cf-vps, stored in D1, PostHog and the bots' databases, and a
rename there would break saved data and links for no gain the owner can see:

- The sources `lab` and `live`, the app `whatsapp-lab`, the console paths `record/*`, the settings
  parts `door`, `brake`, `judges`, `safety`, `hours`, the `#models`-style links.
- The `admin_portal_settings` keys (`ai_monthly_allowance_usd`, `chatbot-urgent-email` …).
- PostHog's stored evaluation names (`WhatsApp lab · …`), which the pages query by name.
- Download file names and audit actions already written.

So a reader of the code still meets "lab" and "door"; a reader of the screen never does. This
document is the one place that maps the two.

## 2. The glossary

| On screen before 2026-11-07 | On screen now | What it is |
|---|---|---|
| WhatsApp lab, Lab, the lab | **Test bot** | The private copy of the WhatsApp bot on the server, reached only by testing numbers |
| The real bot | **Live bot** | The bot real customers write to |
| Set-up (the lab's page) | **Setup** | The test bot's readiness, price list and change log |
| Lab tests | **Test chats** | Chats with the test bot |
| The record, the recorder | **The server**, **the database**, **Data recorder** | Where each bot keeps its chats, settings and figures |
| The model door | **AI gateway** | The part that sends each AI call to the model the settings name |
| Run as the real bot's door | **Use bot settings** | A test chat that follows the saved AI models settings |
| Models (the settings box) | **AI models** | Which model each step uses |
| Run the door / pass everything | **Use these settings** On or Off | Off sends every call to the model the workflow asks for |
| The monthly brake | **Spending limit** | Moves every step to one model once the month's AI cost reaches a figure |
| The monthly AI allowance | **Monthly AI budget** | One figure compared with the month's AI cost; it stops nothing |
| Judges | **AI checks** | The AI that reviews replies |
| Chat insight | **Chat summary** | The AI's one-line reading of a whole chat |
| What checks the replies | **Who checks the test replies** | PostHog, our AI checks, or nobody |
| Built-in settings | **Recommended** | The values the tests chose |
| Undo changes | **Discard changes** | Back to what is saved |
| Use this version | **Restore this version** | A past version filled in, to save again |
| Save for the lab / the real bot | **Save to test bot** / **Save to live bot** | |
| Copy the lab's / real bot's | **Copy from test bot** / **Copy from live bot** | |
| How hard the reply thinks, effort | **Reasoning level** | The reply's thinking effort |
| Checked dates | **Date and price checks** | Checked lines added for each date the customer writes |
| Lean side steps, short instructions, low effort | **Short prompt and low reasoning**, **Short prompt**, **Low reasoning** | Cheaper side steps |
| Cache the bot's instructions | **Prompt caching** | |
| Keep the cache for | **Cache length** | 5 minutes or 1 hour |
| Hand-over to a person | **Transfer to staff** (and its **Trigger words**) | |
| After hours | **Outside opening hours** | |
| Longest reply | **Maximum reply length** | |
| Backup model | **Fallback model** | |
| Days closed / open besides | **Extra closed days** / **Extra open days** | |
| Timings | **Timing** (**Test bot timing**, **Live bot timing**) | The workflow's waits and typing |
| What the record keeps | **What is stored** (section **Stored data**) | |
| n8n | **Workflows (n8n)** | |
| PostHog | **Analytics (PostHog)** | |
| Email subjects "WhatsApp lab: …" | "Test bot: …" | The urgent flags and weekly report sent as a test |

The page labels in the sidebar and the tab row come from `admin_pages`, so migration `0098`
renames those six rows (the Test bot pages and the descriptions of Money, Quality and Settings).

Two places still show the old word on purpose: the PostHog evaluation names (stored data, see §1),
and the test bot's own step names as cf-vps writes them, which the pages replace with their short
names (`STEP_WORDS`: Customer replies, Payment check, Booking details, Photos, Other AI calls).

## 3. The Settings page's design

The pieces live in `insights/SettingsKit.tsx`, so each section is built the same way:

- **Menu** (`GROUPS`, `SECTIONS` in `BotGlance.tsx`, drawn by `Menu` in `BotSettings.tsx`): twelve sections in four groups (*Start
  here*, *How the bot answers*, *Watching the chats*, *Behind the scenes*), each with an icon and a
  three-to-five word line. Beside the page on a wide screen; one row that scrolls sideways on a
  phone, never a menu that hides the choices.
- **At a glance** is the first section and the default: one tile per section with its state in a
  few words and a tap to open it, then the settings that are for both bots.
- **Bot switch** (`BotSwitch`): two large buttons, *Test bot · Test chats only* and *Live bot ·
  Real customers*, and one sentence on what a save does to the bot picked. The test bot is picked
  first. Shown only on sections that have a setting per bot.
- **Row** (`Row`): the setting's name, then one plain line on what it does, on the left; the
  control on the right, under them on a phone. A line that needs fixing turns amber.
- **Switch** (`Switch`): every yes-or-no setting is a switch that also says **On** or **Off** in
  words, never a pair of buttons or a checkbox alone.
- **Choices** (`Choices`): a few options are a row of buttons (`role="radiogroup"`), each with an
  optional second line (a model's price in and out) and tag; the one in force is marked and kept
  in sight. Never a drop-down.
- **Tags** (`Tag`): *Recommended* (green) on the advised value; *Saves money* (green) or *Costs
  more* (amber) where the bill changes.
- **Callout** (`Callout`): *Look:* (amber) for something to act on, *Note:* (blue) for context.
- **Save bar** (`SaveBar`): ends every box that saves. It says *Saved*, *Changes not saved yet* or
  *Fix the line in amber to save*, sticks to the bottom of the screen while there are changes,
  and holds **Reset to recommended**, **Discard changes** and **Save to test bot** or **Save to
  live bot**. A save to the live bot still asks first in the portal's dialog.

**Colours.** Neutrals carry the page. Blue marks what is chosen and the main button. Green is a
switch that is on and a recommended value. Amber is the live bot, a cost, or a line to look at.
Red is kept for removing data. A colour never carries meaning alone: a word sits beside it (On,
Off, Recommended, Costs more, Live bot). The colours are the page's own tokens (`--bs-blue`,
`--bs-amber` and the like in `chatbot-insights.css`), each with a dark and a light value.

**Alternatives rejected.** A wizard (the settings are changed one at a time, not set up once); a
drop-down per setting (the owner's standing rule: every option in view, in a sideways row); a
second page per bot (the settings of both bots are the same shape, so one switch on one page reads
better and keeps the save naming the bot).

## 4. Left out

- The test bot's own guide in cf-vps keeps the cf-vps names; its pages' words are cf-admin's.
- Records written before 2026-11-07 keep the old words: they are frozen.
