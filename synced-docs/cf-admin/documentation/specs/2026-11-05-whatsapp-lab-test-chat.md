---
title: "The WhatsApp lab's Test chat page, remade — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-05
verified_against: [code]
owner: harshil
related_code:
- src/components/admin/chatbot/whatsapp/LabChat.tsx
- src/components/admin/chatbot/whatsapp/ChatList.tsx
- src/components/admin/chatbot/whatsapp/ChatThread.tsx
- src/components/admin/chatbot/whatsapp/ChatInfo.tsx
- src/components/admin/chatbot/whatsapp/ChatModels.tsx
- src/components/admin/chatbot/whatsapp/Composer.tsx
- src/components/admin/chatbot/whatsapp/useChat.ts
- src/components/admin/chatbot/whatsapp/format.ts
- src/layouts/ChatbotLayout.astro
- src/styles/pages/chatbot.css
related_docs:
- ../features/WHATSAPP-LAB.md
- ../records/reports/2026-11-05-whatsapp-lab-test-chat.md
- ../records/reports/2026-11-05-whatsapp-lab-pages.md
- ../reference/DESIGN-SYSTEM.md
tags: [design, chatbot, whatsapp, lab, testing]
---

# The WhatsApp lab's Test chat page, remade — design

> **TL;DR (non-technical):** The owner asked for a top-to-bottom remake of the WhatsApp lab's
> Test chat page, with more tools such as resetting a chat, and a much smaller header: the old
> one took a quarter of a phone screen. The new page looks and works like WhatsApp (a list of
> chats, then the chat), with the testing tools a model comparison needs: a verdict on each
> answer, a reset that makes the bot meet a new customer, copies of a chat to change one thing,
> and up to three chats side by side answering the same message.

## 1. The problem

The first Test chat page (2026-11-05, record (private))
worked, but on a phone it stacked four bands before the first message: the Chatbot section's
tabs, the lab's own tabs as a second pill bar, a page head (icon, title, a line of text,
Refresh), and the chats as a row of chips. Under them, the models panel was open with a row of
chips for each of the bot's eight AI steps, so the chat itself sat below the fold. A tester could
not start again with a clean customer, keep a verdict on an answer, or see two models answer the
same question.

## 2. What we looked at

- **WhatsApp itself** (the thing the bot lives in): a list of chats with the latest activity
  first, each with its last message; the chat as bubbles, the sender's corner flattened, ticks
  that change shape when read (not only colour), a typing indicator; the contact's page behind a
  press on the name. Phone users know it without being taught.
- **Chatbot test tools** (Botpress's emulator): two kinds of new start
  (the same person again, or a new person; the lab can only offer the second, because the bot
  remembers a customer by number), a side panel for what the bot did, and a verdict per answer.
- **Model playgrounds that compare** (LiteLLM's, PostHog's LLM playground): one column per setup,
  each with its own line of figures (time to answer, tokens, cost), at most three columns before
  they become unreadable, one prompt sent to all of them.

## 3. Decisions

| Decision | Why | Rejected |
|---|---|---|
| No page head on the Test chat; the lab's tabs become a slim underlined row under the section's pill row (`.ck-subtabs`) | Two light rows read as one header; the head's title repeated the tab and its line of text is in the documentation | A status bar beside the tabs (needs a second island sharing state; the list's head carries the totals instead) |
| The list and the chat are two screens on a phone, side by side on a computer, with the chat's info as a third column from 84rem | WhatsApp's own pattern; on a phone the chat gets the whole screen | Chips for the chats (they took a band and did not scale past a few chats) |
| The models are a drawer opened from the chat's info, with the Every step row first | The models are set once per chat and read often: a one-line summary in the top bar and the info, the full chips only when changing | An always-open panel (it pushed the chat below the fold) |
| Reset gives the chat the next unused fake number (lab 1.1.0) and keeps every turn | The bot's memory of a customer is keyed by number inside n8n and Redis, which the lab cannot clear; a new number is a true new customer, and the record and Usage stay whole | Deleting the chat's messages (the bot would still remember the number) |
| A verdict is 👍 or 👎 with an optional note, stored on the turn in the lab | One press per answer is the most a tester keeps doing; the note says why; Usage counts both | A score from 1 to 5 (slower, and no clearer); a judge model (step 3, not built) |
| Compare: up to three chats side by side, one composer sending to all, swiped sideways on a phone | Three setups is where columns stay readable; Copy plus a model change makes the second setup in two presses | A separate compare page (another place to learn) |
| Quick messages are a sideways row of chips that fill the box, not send | The tester can still edit; the most common first questions in the customers' Spanish, never a payment claim | Sending on press (one slip sends) |
| Export as text or JSON is made in the browser | No route and no storage in the portal; the JSON is exactly the lab's answer | A server export (a new route for a one-off) |

Kept as they were: the reply details drawer, the photo shrinking, the reactions of the hotel's
phone, the 3-second reading while a turn is open, and every call through the server console's
gateway (`lab-api.ts`, no route of the portal's own).

## 4. The look

Theme tokens only (the Chatbot section's hue, `--ck-hue`), so the light and dark themes both
work; `test/whatsapp-lab-look.test.ts` and `test/chatbot-look.test.ts` hold it there. The chat's
background is the hue at 4% over the page; the customer's bubbles the hue at 20%; the hotel's
phone's the info colour at 12%, with its name. Touch targets are at least 2.5rem on a touch
screen. The typing dots stop for people who ask for less motion. Every choice is a chip in view,
never a drop-down.

## 5. Not in this design

A judge's score and a simulated customer (MAINTENANCE WL-2), voice notes (WL-4), and access for
the client's staff (WL-3).
