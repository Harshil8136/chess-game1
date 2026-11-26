---
title: "@oltrem/email: Write, the Email pages and the composer"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/write-page.tsx, pages.tsx, folders.tsx, usage-page.tsx, rich-box.tsx, html-text.ts, written.ts]
---

# @oltrem/email: Write, the Email pages and the composer

> Part of [the @oltrem/email README](../README.md). The parts of Write in detail:
> [Write, continued](write-2.md).

## Write

Email, Compose (`/email/write`) sends one email a person writes, as a mail app does. With no
address to send from, the page is the setup: connect an email service (Email, Providers), then read
its addresses (`?intent=discover`, `POST /domains/discover`) or add one. [Ready to
send](bulk-mails-pipe.md#ready-to-send) sits in the Send bar: a green check while every check
passes, words when one needs a look; it opens to every check with Check again (`?intent=recheck`).
A check that stops all mail shows a card above Compose with the page that fixes it.

**The compose card** (`ComposeSheet`): From, To, Cc and Bcc (folded behind **Cc/Bcc** while
empty), Subject, the message, and a bar at its foot: **Send** with its **Schedule send** arrow, a
paper clip (a dropped or pasted file attaches too, `data-drop-file`), the template picker, Preview,
Ready to send, and **More** (Save draft, Save as template, Words or HTML for `email.write.code`, the
marks). Ctrl or Cmd with Enter sends. On a phone it fills the screen, the bar is one row and the
portal's own bar hides. **Another address** in From opens a dialog for `email.senders.add` or
`email.senders.manage` ([Senders](senders-and-sending-domains.md#senders-and-sending-domains)).
Every part works without the script.

**The composer** (`RichBox`, `rich-box.tsx`, shared with signatures): text size, colour, bold,
italic, underline, strike, lists, quote, alignment, link (Ctrl or Cmd K), remove formatting, undo
and redo, over a box that shows the email as it will look. The kit's frame script (`data-rich`)
fills the plain box with its HTML, posted with `editor=rich` and cleaned again by `cleanRich`. A
paste keeps only the composer's tags. HTML code pasted or typed (a whole email, a table, a chat's
fenced block: `codeIn`, `isHtmlCode`) becomes the email's HTML for someone allowed code, and words
for anyone else, with a notice. The server reads code that reached it as composer lines back into
code (`composedCode`). Switching back to Words shows code as the composer's lines.

## The Email pages

Email is drawn as Gmail draws mail, with core-ui's `MailShell`, `ConversationRow` and
`ComposeSheet`. The folders sit on the left with Compose on top (on a phone, chips and a round
Compose button); the frame draws no tabs row over them.

- **The pane** (`shellPane(api, current)`): the add-on's everyday folders with Sent and Drafts,
  those marked `group: 'more'` under More, the labels, then the managing pages (Delivery log,
  Templates, what an add-on keeps `last: true`, **Usage and limits**). Gauges at its foot link to
  Usage and limits: Email's **Sending** (each provider's tightest allowance as last kept, `GET
  /usage/brief`) and an add-on's own. Built from `mailFolders`, `addMailFolders`,
  `addMailFolderCounts` (each count asked once a page; a failure shows none), `addMailPane` and
  `paneExtras`.
- **Pages beside the folders** (`besideFolders`): templates, mailboxes and the kit's delivery log,
  which the client wires with `createScreens({ frames: { '/email': emailFrame } })`.
- **Drafts and Scheduled**: one page, mail rows, Delete or Take back on the ticked rows.
- **Sent**: cut into days on the company's clock, filtered (all, opened, on the way, problems)
  with counts; an email opens as a conversation with **Forward**, **Send again** and **What became
  of it** as a timeline.
- **Usage and limits** (`/email/usage`, `src/usage-page.tsx`), in plain words: each provider's
  emails used and left with when it resets (`GET /usage`), the add-ons' gauges, how the allowance
  is protected, and the Cloudflare plan's measured figures (`GET /api/health/budgets`, for those
  who may read System health), unmeasured ones named in a line.

## What is kept

Each email written is a row of `email_written` (migration `0052`) that only its writer reads,
through these routes. Its state is `draft`, `scheduled`, `queued` (still takeable back) or `sent`
(its `email_messages` row says what became of it). The delivery first moves the row from `queued`
to `sent` in one guarded update, so an email taken back (a draft by then) is dropped unsent and two
racing moves cannot both win. When the queue refuses at once, a draft stays a draft with its
`problem`, and a new email is not kept, since the page still shows what was typed.
