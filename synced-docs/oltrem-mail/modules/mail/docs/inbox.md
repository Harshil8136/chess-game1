---
title: "@oltrem/mail: The inbox"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src/arrival.ts, inbox.ts, module.ts, reader]
---

# @oltrem/mail: The inbox

> Part of [the @oltrem/mail README](../README.md).

## The inbox

| Part | How |
|---|---|
| A mailbox | a row (`hello` on the Email Routing domain), at a location, with its own literal routing rule in Cloudflare that sends its mail to this Worker; switching it off disables the rule and refuses its mail; a rule the key may not make is retried by `mail.soon` and its dashboard step shown meanwhile |
| Arrival | `receive`: an address that is not a live mailbox is refused (`setReject`); a blocked sender (or domain, subdomains too) is dropped and counted; the stream is split: the whole message to the bucket at `mail/inbox/<id>.eml`, the first 128 KB read by postal-mime; one batch writes the message, its search words, its conversation and the mailbox's counts; a failure takes the stored copy back and, when the mailbox has a forwarding address, sends the message there instead and takes it (the safety copy: nothing lost, the problem recorded), else tells the sender's server so it tries again; a copy goes to the mailbox's forwarding address when it has one, and a problem with that copy clears itself once one goes |
| Forwarding | setting a mailbox's forwarding address asks Cloudflare to email that address its verify link (Email Routing forwards only to verified addresses), so no one opens the dashboard; the mailbox shows `forward`: `waiting` until the link is pressed, read back every five minutes for a day, then `verified`; `unknown` when Cloudflare could not be asked, with why |
| Conversations | joined by In-Reply-To and References (the last 20 ids), else by subject and correspondent within 30 days; a Message-ID seen before is kept once |
| Checks | SPF, DKIM and DMARC believed only from Cloudflare's own first Authentication-Results header; a score of 0 to 10 from them and a sender's name that is an address on another domain |
| Rules | when the sender, the subject or a recipient contains words: archive, mark read, label, or spam; per mailbox or every one, with how often each matched |
| Updates | mail from a list or a machine (List-Id, List-Unsubscribe, Precedence bulk or list, Auto-Submitted other than `no`) goes to Updates, out of the inbox and its unread count; Move to Inbox or Move to Updates on a conversation moves all of its sender's conversations and is remembered for their next mail (`mail_senders`) |
| Unsubscribe | a list's List-Unsubscribe is believed only when Cloudflare's DMARC check passed, and its https address only on a named host on the usual port; with List-Unsubscribe-Post (RFC 8058) the portal POSTs `List-Unsubscribe=One-Click` to its https address for the person (10 s, no redirects followed), records when, and moves the sender to Updates; without it the sender's own https page or mailto address is offered |
| Automatic reply | per mailbox (`PUT .../mailboxes/:id/auto-reply`, `mail.inbox.manage`): on or off, a subject (empty answers `Re:` and theirs, in their conversation), its words, and a first and last day on the company's clock; turning it on makes the mailbox's address a sender, as the first reply does. Sent through email (`email.send`, message key `mail.auto.<tenant>.<message>`, so a message delivered twice is answered once) once the message is kept, at most once a sender in four days (`mail_senders.auto_replied_at`), never to a list or machine, a no-reply, mailer-daemon or notifications address, the mailbox itself, spam, or a sender whose From is not proven: DMARC passing, or SPF passing for an envelope sender of the From's own domain; a reply that does not go is recorded on the mailbox (and System health) and never fails the delivery. It goes through the provider's route and its daily allowance, not Cloudflare's `message.reply()` (unconfirmed on the free plan), and carries no `Auto-Submitted` header (email has no header option yet) |
| No answer yet | a reply from the portal starts a wait (`waiting_since`); their answer ends it; three days without one, the hourly `mail.inbox` job brings the conversation back to the top of its box once (`nudged`), marked "No answer yet"; never spam, muted or snoozed ones |
| Snooze, mute, sweep | snooze: in three hours, tomorrow at 8 or Monday at 8 on the company's clock (`email.timeZone`), then back at the top of its box, unread; new mail wakes it early. Mute: archived, and new replies stay archived until Unmute. Archive all from sender: every conversation of that sender archived, and, where the person manages the mailbox, an archive rule for their next mail (once, within the 50 rules, `RULES_MAX`) |
| Search | an FTS5 index without content over the first 8 KB of each message's text, accents folded; each word matched as a prefix; Gmail's words read first, across every box: `from:`, `to:`, `subject:` (a quoted phrase too), `has:attachment`, `is:unread`, `is:read`, `before:` and `after:` a day (`2026-10-31`), `in:` a box (`inbox`, `updates`, `snoozed`, `archived`, `spam`, `starred`, `anywhere`), and `label:` a label and `is:starred` |
| Reading | the Worker passes the stored copy along without reading it (the first 256 KB, all of it with `whole=1`, always as a download); the phone reads it with the reader script, served by the hook `GET /hooks/mail/reader/<version>/<file>` (postal-mime, DOMPurify, `src/reader/reader.js`, and the list's `src/reader/swipe.js` and `src/reader/keys.js`, built into `src/generated/reader.ts` by `pnpm docs:build`) into a frame that never runs a script (docs/inbox.md section 4) |
| Replying | `POST .../reply` writes through email's Write (its checks, its Undo, the Sent page) from the mailbox's own address, added as a sender by itself the first time at the mailbox's own location, so the people who may reply there are the ones who may send from it, with In-Reply-To and References so the reply and the customer's answer stay in the conversation; a reply taken back with Undo leaves the conversation |
| Stars and labels | a star (migration `1016`) on a conversation for the whole team (`mail_threads.starred`); labels put on by a person as well as by a rule, kept on the conversation space-separated, lower-case with spaces as dashes (`labelName`), each with a colour from core-ui's `LABEL_COLORS` in `mail_labels`; a rename follows onto every conversation and rule, a removal takes it off them all |
| Room | `GET /api/mail/inbox/usage`: messages, stored bytes, an estimate of the rows; the retention setting keeps both inside the free plan. `GET /api/mail/inbox/room` reads each mailbox's running total (`stored_bytes`, added to on arrival, taken from by retention) for the left pane's Mail storage gauge, without reading a message |

| Route | Capability | What it does |
|---|---|---|
| `GET /api/mail/inbox/mailboxes` | `mail.inbox.read` | the mailboxes the person may read or manage, the domain, the locations a new one may go at, and whether the inbox is offered |
| `POST /api/mail/inbox/mailboxes` | `mail.inbox.manage` | add one (`local`, `name`, `scopeId`, `forwardTo`) and its routing rule |
| `PATCH /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | its name, location, forwarding address, or `live` |
| `PUT /api/mail/inbox/mailboxes/:id/auto-reply` | `mail.inbox.manage` | its automatic reply (`on`, `subject`, `body`, `from`, `until` as `2026-12-24`) |
| `DELETE /api/mail/inbox/mailboxes/:id` | `mail.inbox.manage` | delete an empty one and its rule |
| `GET /api/mail/inbox` | `mail.inbox.read` | conversations, 50 a page (`mailbox`, `box` of inbox, updates, snoozed, archived, spam, all or starred, `label`, `q`, `before`) |
| `GET /api/mail/inbox/threads/:id` | `mail.inbox.read` | one conversation, its messages, and how its sender lets a person leave their list (`sender.unsubscribe`: one-click, page, email or none) |
| `GET /api/mail/inbox/messages/:id/raw` | `mail.inbox.read` | the stored copy (`whole=1` for all of it) |
| `POST /api/mail/inbox/actions` | `mail.inbox.read` | read, unread, archive, inbox, spam, not spam, snooze (`until`: later, tomorrow, week) and unsnooze, mute and unmute, updates and people (their senders, remembered), sweep, star and unstar, label and unlabel (`label`, made when new), or block (manage) for up to 100 conversations |
| `GET /api/mail/inbox/subscriptions` | `mail.inbox.read` | the senders whose list mail is here, busiest first (100), each with whether one press unsubscribes |
| `POST /api/mail/inbox/unsubscribe` | `mail.inbox.read` | unsubscribe from a sender's list (`email`): `done`, or the sender's own `https` or `mailto` way with why |
| `POST /api/mail/inbox/threads/:id/reply` | `mail.inbox.reply` | answer the latest message (`body`, `all`) |
| `GET`, `POST /api/mail/inbox/rules`, `DELETE .../rules/:id` | read; manage | the rules and blocked senders; add and remove a rule |
| `POST`, `DELETE /api/mail/inbox/blocked` | `mail.inbox.manage` | block or unblock an address or `@domain` |
| `GET /api/mail/inbox/usage` | `mail.inbox.read` | the inbox's room |
| `GET /api/mail/inbox/room` | `mail.inbox.read` | `{ bytes }`: what the stored copies take, from the mailboxes' running totals |
| `GET /api/mail/inbox/labels` | `mail.inbox.read` | the team's labels with their colours: those made, then those only a rule puts on |
| `POST /api/mail/inbox/labels` | `mail.inbox.read` | make a label (`name`, `color`), or rename and recolour one (`was`) |
| `DELETE /api/mail/inbox/labels/:name` | `mail.inbox.manage` | remove a label from every conversation and rule |

Home shows the unread conversations, search finds mail by its words, and a privacy search lists
the messages from an address.
