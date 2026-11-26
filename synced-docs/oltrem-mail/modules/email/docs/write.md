---
title: "@oltrem/email: Write"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Write

> Part of [the @oltrem/email README](../README.md).

## Write

The page Email, Write (`/email/write`, stage 2 of the Mail plan, 2026-10-29) sends one email a
person writes, the way a mail app does, without a list, a template or a campaign. With no address to
send from, the page is the setup, in two steps: connect the email service (Email, Providers;
connecting checks the key, makes it the one that sends when none does and reads its addresses, then
comes back here), and read the addresses from it (`?intent=discover`, the route `POST
/domains/discover`) or add one by hand. [Ready to send](bulk-mails-pipe.md#ready-to-send) sits in the Send bar: a
quiet green check mark while every check passes, amber or red words while one is worth a look or
stops mail; it opens upward to every check with Check again (`?intent=recheck`). When a check stops
every email, a problem card above the Compose window says so first, with a button to the page that
fixes the first one, and lists what to do. Compose is one window as tall as the screen: the fields
flush inside it, the message growing down to the Send bar, edge to edge on a phone.

Since 2026-10-31 (the kit's record `archive/records/2026-10-31-email-console-remake.md` in
oltrem-admin) the email pages are drawn with the console pieces of `@oltrem/core-ui`. Write is a
mail app's compose card: From, To, Cc and Bcc (folded), Subject as lines, the message under them,
Send, Save draft and Send later in a bar at its foot, and how the marks look beside it on a wide
page. Drafts and Scheduled are one page with a row to pick, each email a row with its avatar, its
subject, to whom and when, and its own Delete or Take back. Sent is cut into days (Today, Yesterday,
then the date, on the company's clock), filtered from a row (all, opened, on the way, problems) with
the counts, each email a row with what became of it as a coloured tag when it says something. An
email sent opens as the inbox opens a conversation: **Forward** and **Send again** over its subject
and the word for what became of it, its people and its words as the email shows them, and **What
became of it** as a timeline, the list and its filters beside it. Since 2026-11-08 (the client's
point 7) Email is drawn as Gmail draws mail, with core-ui's `MailShell`, `ConversationRow` and
`ComposeSheet`: Drafts, Sent and one sent email sit in the mail screen, the folders on the left with
Compose on top (the mail add-on's Inbox and boxes first when it is in the Worker, then Drafts, Sent,
and set apart the Delivery log and Templates; `mailFolders` and `addMailFolders` from
`@oltrem/email/pages`), the list, and an open sent email beside its list; on a phone the folders are
a row of chips and Compose a round button. These pages draw their own folders, so the frame draws no
tabs row over them. Drafts and Sent rows are mail rows: whom, a short time, the subject, then what
became of it (Sent) or the first words. Drafts' Delete and Scheduled's Take back act on the ticked
rows. Write is named Compose (its tab and its title) and is a compose card (`ComposeSheet` in the
page) beside the folders (`MailShell wide`: no list, no tabs row; on a phone the whole screen, with
Back to the first folder). Addresses are cards (an avatar, the domain's state, what each is for, the
signature) and each domain a pane with every check and every record, each value with its own Copy
button.

Every Email page draws the same folders: Compose, the inbox's boxes, Drafts, Sent, the delivery log
and the templates, then what an add-on keeps last (`last: true`; the mail add-on's Mailboxes and
rules). A page of the set that is not a list (the templates, the mailboxes, the kit's delivery log)
sits beside the folders in place of the list and the conversation (`MailShell`'s `page`;
`besideFolders` from `@oltrem/email/pages`). The delivery log is the kit's own page, so the client
hands `emailFrame` to its screens (`createScreens({ frames: { '/email': emailFrame } })`). An
add-on's counts show beside its folders on every page (`addMailFolderCounts`; the inbox's unread),
each asked once a page, and one that fails shows none. The page's head is one slim row there, and
moving between Email pages keeps the folders and the list still while the marked folder glides and
an opened email slides in (core-ui's mail rules, the kit's record of 2026-11-10).

The left pane is grouped as Gmail's (archive/records/2026-11-11-gmail-style-email.md): the add-on's
everyday folders with Sent and Drafts, those it marks `group: 'more'` under More (open by itself
when one of them is the current page), the labels, then the pages that manage mail (Delivery log,
Templates, what an add-on keeps last, **Usage and limits** at `/email/usage`). At its foot are
gauges, each a link to Usage and limits: Email's own **Sending**, every provider's tightest
allowance as last kept, added up, with no provider asked (`GET /usage/brief`), and an add-on's own
(the mail add-on's Mail storage). An add-on gives its labels, the + to make one and its gauges with
`addMailPane`; `paneExtras` asks every source together, Email's first, and one that fails adds
nothing; `shellPane(api, current)` is one page's whole pane for `MailShell`. **Usage and limits**
(`src/usage-page.tsx`) says in plain words, for a client who is not technical: each provider's
emails used and left today, this month or on the plan, when that resets and what the portal sent
itself (`GET /usage`), the gauges of the add-ons, how the allowance is protected, and the Cloudflare
plan's figures from the kit's budgets (`GET /api/health/budgets`, for those who may read System
health) under plain names such as Database reads and Time per request: a meter for each figure
measured, and the ones not measured yet named in one line under the reason, instead of a row of
empty bars each.

Since 2026-11-01 (the kit's record `archive/records/2026-11-01-email-remake.md` in oltrem-admin)
Write is a compact compose card in the manner of Gmail and Resend, and every part still works
without the script. From, To, Cc and Bcc are short lines, each address in To a chip as it is typed,
with the browser's suggestions; empty Cc and Bcc fold behind one **Cc/Bcc** button on the To line
(since 2026-11-12; a line of chips keeps room above and below, its label and buttons level with the
first row of chips, and no arrow shows beside a box with suggestions). The message sits right under
Subject and everything else is at its foot. Compose is one calm card with a plain head (no coloured
band or pen), the formatting bar sits under the message by Send, and the bar holds: **Send** with
its **Schedule send** arrow (one split button; the arrow opens the day, the time on the company's
clock and Schedule), a paper clip to attach (its tip says how much may go; a file dropped on the
email or pasted into it is attached too, the kit's `data-drop-file`), the template picker as its
icon (the kit's `Dropdown`: a card of templates, each with its kind, posted with its Use button,
which the script presses for it), Preview as an icon, Ready to send, and at its end a **More** menu
(⋮, a card that opens over the message) with Save draft, Save as template, the Words or HTML choice
(only for `email.write.code`; it is no longer on the page itself, as code pasted anywhere is found
by itself) and the marks. Beside the card on a wide page, under it on a phone, a preview draws the
words with their marks as they are typed. Readiness folds to one line when every check passes. Send
goes with Ctrl or Cmd with Enter; on a phone the bar is one row that fits : Send and its arrow take
the room left, the rest are icons, and each card rises from the foot of the screen; and the portal's
own bar is hidden while an email is written, so the compose head is the screen's only bar. **Another
address** in the From line opens a dialog to send from an address not added yet (see
[Senders](senders-and-sending-domains.md#senders-and-sending-domains)), for someone who holds `email.senders.add` or
`email.senders.manage`: the address is checked and saved and picked in From, the words typed kept.

Since 2026-11-08 (the client's feedback) the message is written in a **composer**, as in Gmail: a
toolbar with text size (the kit's `Dropdown`, its card spanning the toolbar, since 2026-11-12), text
colour, bold, italic, underline, strikethrough, bulleted and numbered lists, quote, alignment, link
(Ctrl or Cmd K opens a line for the address), remove formatting, undo and redo, over a box that
shows the email as it will look. A paste from Word, Google Docs or a web page keeps only the
composer's tags. The frame's script (`data-rich` in the kit's `frame.js`) shows it and hides the
plain box, which it fills with the composer's HTML, posted with `editor=rich` and cleaned again by
`cleanRich` (see [The composer's HTML](#write) below); words already in the box come in with their
marks made HTML, and a draft written in the composer opens in it again. Preview shows the email
exactly as it will be sent. Without the script the plain box and its marks still work. For someone
allowed to use code, the Words or HTML choice still hands the box over as code; pasted code (a whole
email, a table or a style block) opens as code. HTML code pasted into the composer turns the message
to HTML with the code exactly as pasted, for someone allowed to use code, and says so; anyone else
gets it as words and is told why. Code sent with Words chosen (the plain box, without the script)
goes as HTML too for someone allowed to use code: words that open with a tag, end with one and close
one (`isHtmlCode`). The server reads the composer's lines the same way (`composedCode`): code that
reached it as words, its tags written `&lt;…&gt;`, goes as HTML for someone allowed to use code, so
a paste the page did not turn still goes as the email. The code is found wherever it comes from and
whatever was chosen: in a chat's answer (words, a fenced html block, words again: the code alone,
`codeIn`), with a byte-order mark or zero-width spaces, put in by a phone keyboard's clipboard
without a paste (a long run that came in at once), and when HTML is chosen after the code went into
the composer (the box gets the code itself, not the composer's lines of it; and the server reads
lines and nothing else whose text is code back into that code, so a draft saved that way mends
itself on its next save or preview). Going back to Words with code in the box shows the code as the
composer's lines, which go as the code again. The composer is shared (`RichBox`, `rich-box.tsx`)
with an address's signature.

Since 2026-10-31 (the kit's record `archive/records/2026-10-31-write-templates-and-code.md` in oltrem-admin) Write
starts from the company's saved templates for Write (see [Saved templates](saved-templates.md#saved-templates)):
