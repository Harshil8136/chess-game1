---
title: "The Chatbot section's frame, remade — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-11-05
verified_against: [code]
owner: harshil
related_code:
- src/layouts/ChatbotLayout.astro
- src/components/navigation/RegistryTabs.astro
- src/lib/auth/registry-tabs.ts
- src/components/admin/chatbot/PageBar.tsx
- src/styles/pages/chatbot.css
- src/pages/dashboard/chatbot/whatsapp/index.astro
related_docs:
- ../features/CHATBOT.md
- ../features/WHATSAPP-LAB.md
- ../reference/DESIGN-SYSTEM.md
- 2026-11-05-whatsapp-lab-test-chat.md
- ../records/reports/2026-10-24-sessions-page-redesign.md
- ../records/reports/2026-11-05-whatsapp-lab-makeover.md
tags: [design, chatbot, whatsapp, navigation, ui]
---

# The Chatbot section's frame, remade — design

> **TL;DR (non-technical):** The owner asked for a complete makeover of the Chatbot section,
> starting with its row of tabs ("it needs complete makeover … especially /whatsapp"). The tabs
> are now one clean underlined row across the page, split in two: the website's chatbot on the
> left and the WhatsApp bot's lab on the right. Each page then opens on one slim bar (its name,
> a line on what it shows, its buttons, and a row of small figures) instead of a large heading.
> The WhatsApp lab pages are in WhatsApp's own green. This page is the design both threads
> working on the section build on.

## 1. The problem

The section's tabs were a pill row floating in the middle of the page: nine tabs in one
rounded track, with a wide empty band above it. Two different bots shared it without a sign
of which was which (the website's assistant, "charlar", and the hotel's WhatsApp bot's test
lab). Each page then opened on a large head (a 2.75rem icon, a title in a gradient, a
subtitle), and the WhatsApp lab added a second row of tabs under the first. On a phone the
header took about a quarter of the screen before the page began, the problem the owner
already had fixed on the Sessions page (2026-10-24).

## 2. What we looked at

- **The Sessions page** (the owner's approved pattern, record (private)):
  one slim bar with a small hue icon, the name, an icon-only Refresh, and a sideways row of
  small figures that each open their list.
- **Product navigation in tools people use daily** (GitHub's repository tabs, Vercel's
  project tabs, Linear): a full-width row of underlined tabs over one hairline, left-aligned,
  the current tab marked by a short bar and stronger text, never a floating track.
- **Segmented controls** (iOS, macOS): two or three choices of the same thing side by side, the
  chosen one raised; the right shape for a page's own two or three sub-pages.

## 3. Decisions

| Decision | Why | Rejected |
|---|---|---|
| The section's tabs are one underlined row (`RegistryTabs variant="line"`), full width and left-aligned, the tab on screen marked by a 2px bar in the page's hue | Reads as the section's navigation, not a toolbar; takes no more height than the pill row | The pill row (floats, reads as a toolbar); a drop-down (hides the choices) |
| A short divider before WhatsApp lab (`groupStart`) | Two bots in one section: the website's chatbot, then the WhatsApp bot | A second row for the WhatsApp bot (another band); a group label (more text than the divider says) |
| Each page opens on `PageBar`: a small hue icon, the name, one line cut to fit (hidden on a phone), the actions on the right, an optional row of `Figure` pills under it | The Sessions bar, which the owner approved; one h1 per page is kept | The old head (`parts.tsx` `Head`), which with chips and tiles took a quarter of a phone screen |
| On a wide screen with no line of text, the figures sit between the name and the actions | One row instead of two where there is room | Always two rows |
| ~~A page with sub-pages of its own (the WhatsApp lab) puts them in its bar as a segmented row (`SubNav`), the name kept for screen readers~~ Replaced the same evening (§7) | The lab's three pages and its buttons share one line; the second tab row is gone | The underlined second row (2026-11-05 morning): a third band |
| The sub-pages come from the server (`src/lib/auth/registry-tabs.ts`), the same rule `RegistryTabs` uses | One rule for which tabs a person sees | A list kept in the island (it would show a page the person may not open) |
| The lab's hue is WhatsApp's green (`data-hue="whatsapp"`: the emerald leaning to cyan), the website's chatbot keeps cyan | The lab is the WhatsApp bot; green bubbles and buttons say so at a glance, and it is not the plain green of a good state | One hue for both bots |
| A page that is one app window (`ChatbotLayout fill`) grows to the screen's height; that frame is a size container | The Test chat fills the screen on any device without a height worked out by hand | `100dvh` minus a guessed number of rem (wrong as soon as a band changes) |
| The empty band above the tabs is gone (`.ch-frame` has no top padding of its own) | The page's own padding is enough; the band was the frame's padding on top of it | — |

## 4. The pieces

| Piece | Where | Use |
|---|---|---|
| `ChatbotLayout` | `src/layouts/ChatbotLayout.astro` | `hue` (`chat`, `whatsapp`), `fill` |
| Section tabs | `RegistryTabs.astro`, `variant="line"`, `groupStart` | Drawn by the layout; nothing for a page to do |
| `PageBar` | `src/components/admin/chatbot/PageBar.tsx` | `title` (always), `icon`, `sub`, `actions`, `figures` |
| `Figure` | the same file | `icon`, `value` (null reads as a dash), `label`, `tone`, `onClick` to open what it counts |
| Lab tabs in the row | `RegistryTabs.astro`, `expand` | Drawn by the layout (§7); `SubNav` and its `.ch-seg` styles were removed |
| Styles | `src/styles/pages/chatbot.css`, top block | `.ch-frame` (with `--tab-group`), `.ch-bar*`, `.ch-figs`, `.ch-fig`, `.ch-icon-btn`, the hues and `--ck-on-hue` |

Tones on a figure: `hue` for what the page is about, `good`, `warn`, `bad`, `info` for a state
(always with its icon and word), `muted` for a count with no judgement.

## 5. The look

Theme tokens only, so the light and the dark theme both work (`test/chatbot-look.test.ts`).
Touch targets are at least 2.5rem on a touch screen. The tab row and the figures scroll sideways
on a phone, every option in view, never a drop-down; the tab on screen is brought into view when
a page opens (`NativeNavigationState.astro`).

The bar's name gives way first: it is cut with an ellipsis before it pushes the actions off a
narrow screen, and its line of text takes what room is left. ~~On a phone (under 40rem) the
segmented row keeps the icon of the page on screen only, so three sub-pages and a page's buttons
share one line.~~ Replaced (§7): the segmented row is gone, so every bar has room for the
page's name.

## 6. Who builds what

The frame, the bar and the WhatsApp lab's pages: the "Build and test the WhatsApp bot lab"
thread. The eight pages of the website's chatbot move onto `PageBar` in the "Redesign the
Chatbot section" thread, which retires `parts.tsx` `Head` once no page uses it.

## 7. One row of tabs (2026-11-05 evening)

The owner, on the segmented row: "2 layer tabs are bad looking". The section row and the lab's
row under it still read as two layers of tabs. So the lab's three pages now sit in the section's
own row: after the divider, a small caption **WhatsApp lab** in the lab's green, then **Test
chat**, **Usage** and **Set-up**, their icons and underline in that green on every page
(`--tab-group` on `.ch-frame`), so the group reads as the WhatsApp bot's even from a website
chatbot page.

| Decision | Why | Rejected |
|---|---|---|
| `RegistryTabs` `expand={{ path, overview }}` replaces one tab by its page's own sub-pages, in the same row, after a caption with its name | One row of tabs for the whole section; the person sees every page of both bots at once | The segmented row in the bar (two layers); a drop-down on the lab tab (hides the choices) |
| The group follows the open-only rule; with fewer than two sub-pages the plain tab stays | A caption over one tab says nothing | Always expanding |
| The caption is hidden from screen readers; the group is a `role="group"` named after the page and each tab is read as "WhatsApp lab: Usage" | Heard once and in full, without the caption read twice | The caption as a link (a second way to the Test chat) |
| Each lab page's bar is a plain `PageBar`: the page's icon, name and line, its buttons | The name returns to sight, and Set-up keeps its **Ready** pill | — |

The lab's islands no longer take `tabs`; their `.astro` pages no longer call `registryTabs`.
