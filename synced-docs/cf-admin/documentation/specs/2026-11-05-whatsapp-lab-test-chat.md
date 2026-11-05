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
- src/components/admin/chatbot/whatsapp/LabUsage.tsx
- src/components/admin/chatbot/whatsapp/LabSetup.tsx
- src/components/admin/chatbot/whatsapp/ReplyDetails.tsx
- src/components/admin/chatbot/whatsapp/useChat.ts
- src/components/admin/chatbot/whatsapp/format.ts
- src/layouts/ChatbotLayout.astro
- src/styles/pages/chatbot.css
related_docs:
- ../features/WHATSAPP-LAB.md
- ../records/reports/2026-11-05-whatsapp-lab-test-chat.md
- ../records/reports/2026-11-05-whatsapp-lab-makeover.md
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

Later the same day the header decision (the first row above) was replaced by the section's new
frame ([design](2026-11-05-chatbot-section-frame.md)): the lab's three pages are a segmented row
in the page's own bar, and the second tab row is gone.

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

## 6. The second pass (2026-11-05, afternoon)

The owner looked again and asked for more ("make EVERYTHING modern, smart, amazing looking …
especially /whatsapp … review each-and-every part"), with their yes to local screenshots before the
push. Each part was drawn at 390 and 1,440 pixels, dark and light, on sample data in a preview
kept out of the repository, and changed until it read well at both sizes. The decisions:

| Decision | Why | Rejected |
|---|---|---|
| The lab's window takes its columns from the frame's width (`@container ch-frame`: two columns from 42rem, the info as a third from 62rem), not the screen's | The sidebar and a tablet change the room the page has; a screen width guessed it wrong | The 84rem screen breakpoint of the first pass |
| The list as WhatsApp's: a round badge per chat in one of six steady colours (`tint`), a search box, **New chat** in the lab's green, the counts on Chats and Archived, the ticks on the customer's last message, the totals in the list's foot | Each chat is found by colour and name at a glance; the totals stop crowding the list's head | Initials on one grey; the totals in the head |
| The chat as WhatsApp's: the day over its first message, the hour (not the seconds) in each bubble with the full time on hover, a run of bubbles squared toward its sender, a reaction shown on the bubble it answers, a dotted background | What a phone user expects of a chat; the seconds and a sticky day label only got in the way | A sticky day label (it covered the first line of a bubble) |
| A turn's figures as small icons and numbers (models, time, tokens, cost, failures), hidden while the turn is still open | One line a tester scans; nothing floats under an answer the bot is still writing | Words for each figure (two lines on a phone) |
| **Models** in the chat's top bar, beside **Reset** | The tester changes models often; the info column is not always there | Models only in the info |
| The composer's sender as a two-way switch, the quick messages as short English names under **Try** that put the Spanish text in the box, the photo inside the rounded field, a round Send | Short names fit a phone's row and say what each message tests; the box still takes an edit before sending | The Spanish texts as the chips (long, and cut off) |
| The chat's info as WhatsApp's contact page: a large badge, the number in groups, its tools as a grid of buttons, its figures as small cards | Every tool in reach with one press; a grid wraps on a narrow column where a row of buttons did not | A row of text buttons |
| Usage's bars and Details' run waterfall are SVG, their length an attribute (`width`, `x`) | The portal's CSP allows no inline style; an attribute is drawn the same | A `style` width |
| Set-up's readiness is a checklist: each line a mark and its state in words (screen readers hear "Ready", "Stops the tests", "Needs a look" or "Optional, not set"), and the changes a timeline | Colour alone cannot carry a state; a list reads in one pass | Badges in a table |
| Lab 1.3.0's **Lean side steps** shows only when the lab sends `lean`, and Workers AI chips come after Claude's and Gemini's with a note on their keys | The page works on every lab version; the lab does not say whether those keys are set | A Workers AI key flag the lab does not send |

The look of §4 changed with it: the chat's dots are the hue at 5% over the page; the customer's
bubbles the hue at 30% over the surface in the dark theme and 15% in the light, where the bot's
bubbles are white with a soft shadow; the hotel's phone's the info colour at 10% in the light
theme. The bar's name is cut with an ellipsis before it pushes the buttons off a phone, and on a
phone the segmented row shows the icon of the page on screen only ([frame](2026-11-05-chatbot-section-frame.md), §5).

Later the same day the owner asked for an "extreme makeover" of the models drawer, whose rows of
chips (one row per step, each running off the screen, with the chosen chip often out of view)
the second pass had kept, and for "testing number" in place of "fake number":

| Decision | Why | Rejected |
|---|---|---|
| Change models is a list, one line per step: its model here (a changed one in green, with a dot), the live model under its name, and **≈ a call**; a press opens its choices as cards in a wrapping grid, grouped by maker, and a pick closes the line | Every step's model is readable at once on a phone, and every choice is in view when choosing, never off the screen; one press to open, one to pick | Rows of chips (the owner's screenshot: nine rows running off the screen, the picked chip hidden); a drop-down per step (hides the choices) |
| **≈ a call** is the step's average tokens read and written in the lab so far (the `usage` read, by step, answered calls on any model) at each model's list price, before any cache discount, and only once the step has answered | Price per million tokens says little about a step; a real call's size does. It is said to be an estimate, and a step with no call yet shows only prices | A per-turn total (not every step runs every turn); a guessed token count |
| The lab's numbers are "testing numbers" on every page and in the text export | The owner's wording: "we cant say FAKE NUMBER" | — |
