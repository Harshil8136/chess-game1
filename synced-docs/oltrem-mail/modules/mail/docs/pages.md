---
title: "@oltrem/mail: Pages; The tables"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src; split from modules/mail/README.md]
---

# @oltrem/mail: Pages; The tables

> Part of [the @oltrem/mail README](../README.md).

## Pages

Inbox (`/email/inbox`), first in the module's pages and second in the Email tabs after Write (since
2026-11-08 Email in the sidebar opens Write, the client's ask), with its unread count. It is drawn
as Gmail draws mail (the kit's `MailShell` and `ConversationRow`, the client's point 7): on a
computer the folders with Compose on top (Inbox, Updates, Snoozed, Archived, Spam, All, then Email's
Drafts and Sent), the list, and the open conversation beside it; on a phone the folders are a
sideways row of chips, Compose is the round button in the corner, and an open conversation takes the
screen with a way back to the same list. Each row shows who, when (08:15 today, 2 Nov this year, on
the UTC clock), the subject, and its state and first words. The list has a row of mailboxes, a
search with chips for unread, attachments and archived, and the conversations with a box each to
tick and a row of commands for the ticked ones (archive, read, unread, three snoozes, Move to
Updates or Inbox, mute, archive all from sender, spam, block). Each change says what it did, with an
Undo that sends the same conversations back (but sweep and block, taken back on Mailboxes). On a
phone a conversation swiped left is archived and swiped right is marked read, through the same
commands. Updates lists the subscriptions with Unsubscribe. A conversation waiting three days for an
answer shows "No answer yet". A conversation (`/email/inbox/:id`) opens beside the list it came from
(its view rides on each row's link) and is marked read when opened; it has the same commands, says
when it is snoozed, muted or waiting for an answer, and offers Unsubscribe for list mail; above the
reply box, **Saved replies** are the person's letters from Write (no design, no code), each added
under what is already typed with the person's name filled in; older messages fold and are fetched
only when opened; the reply form sends from the mailbox, and Undo puts the words back in it. The
inbox with no mailbox yet, or with a setup step still to do, says so beside the same folders, and
the inbox's unread count shows beside Inbox on every Email page (`addMailFolderCounts`). Mailboxes
and rules (`/email/mailboxes`), the last of Email's folders and beside them: each mailbox with its
state and what stands in its way, add, change, switch off and delete, its automatic reply, the
rules, the blocked senders, and the room used against the free plan.

The inbox works as Gmail does (archive/records/2026-11-11-gmail-style-email.md): the folders in
Gmail's groups (Inbox, Starred, Snoozed with Email's Sent and Drafts; Updates, Archived, Spam and
All under More), the labels with their colours and a + to make one, and the Mail storage gauge under
them (`addMailPane`); a top bar with the search, the tick-all box, the commands once a row is ticked
and the Snooze, Label and More menus; on each row the star, the labels' chips, a paperclip for a
file and, on a computer, Archive, Mark read and Snooze on hover; Quick settings behind the cog
(Split or Full, Default or Compact, kept in cookies); Gmail's keyboard shortcuts
(`src/reader/keys.js`, the `?` sheet lists them); and Labels (`/email/inbox/labels`), to make,
rename, recolour and remove labels.

The list changes before the portal answers, as Gmail's does (the kit frame's `data-optimistic`):
Archive, Snooze, Spam, Not spam, Back to inbox and the moves between Inbox and Updates take the row
away at once in the box it leaves; Mark read and unread change its weight at once; the star fills at
once. The portal's answer then replaces the list, so a change it refused comes back as it was; with
no answer at all the row comes back and the page says so. Starred and All mail, which an archived
conversation does not leave, wait for the answer.

Forwarding (`/email/forwarding`), under Email's Settings tab, in two views: **ImprovMX** (first) and
**Cloudflare**. ImprovMX shows Connect ImprovMX with its one field until a key is kept, then the
account with Disconnect and Add a domain, and a pane for each domain with its state, its aliases
(Change, Delete), Add the alias, Check its records and Recent mail (`?view=improvmx&mail=<domain>`).
A visit opens on ImprovMX unless Cloudflare already forwards a domain and ImprovMX is not connected;
ImprovMX is asked only on its own view. Cloudflare, which rests while ImprovMX is connected (the
five-minute job, its asking Cloudflare about forwarding addresses included, and `mail.forwarding`
pass the company by): the domains, each with where its mail goes, what stands before its move, and
Move from ImprovMX, Move back and Check again; the aliases, each with its people and whether each
pressed Cloudflare's link, Change, Switch off and Delete; a form to add one; and Import from
ImprovMX, which reads the account with its API key in one press (the key is never kept) or takes a
pasted list. On the builder's own computer, Forwarding and Mailboxes also show **Send a test**
(`src/try-here.tsx`): a message to an alias or a mailbox, handed to the Worker as Email Routing
would, and what became of it. Someone who may only read sees it all and nothing to change.

Mail setup (`/email/mail`), under Email's Settings tab: the route's line, the steps as a checklist,
the form that turns Email Routing on, the sending domains with records missing and **Write them**,
the staff addresses with their state, the test, and Stop. A step that is not ready says whether Mail
is to be ticked at setup or only turned on, on the Features page. Someone who may only read sees the
steps and nothing to change.

## The tables

Migration `1001_mail_cloudflare.sql`: `mail_cloudflare`, one row a company (the domain, its zone,
what Cloudflare last said about Routing and sending, the mode, the address it sends from, what
stands in the way, when it was tested and checked), and `mail_cloudflare_addresses`, the staff
addresses asked of Cloudflare with the time each was verified. Migration `1002_mail_inbox.sql`:
`mail_mailboxes`, `mail_threads`, `mail_messages` (headers, snippet, attachment names, checks,
score; never the body), `mail_search` (FTS5, no content kept), `mail_blocked` and `mail_rules`.
Migration `1004_mail_familiar.sql`: `mail_threads` gains `updates`, `muted` and `snoozed_until`
(with a partial index on the snoozed ones and one on the correspondent), and `mail_senders`, a row
for a sender a person moved or whose list offers an unsubscribe (the choice, the unsubscribe
addresses, how many and when, when they were left). Migration `1005_mail_answers.sql`:
`mail_mailboxes` gains the automatic reply (`auto_on`, `auto_subject`, `auto_body`, `auto_from`,
`auto_until`, `auto_sender_id`, `auto_sent`), `mail_senders` gains `auto_replied_at`, and
`mail_threads` gains `waiting_since` (with a partial index) and `nudged`. Migration
`1007_mail_forwarding.sql`: `mail_forward_domains`, one row a company and domain (its zone, where
its mail goes, the service it went to, the records a move kept for Move back, whether the move added
Cloudflare to its SPF record), `mail_aliases` (the address, its people as a JSON list, its rule and
whether Cloudflare says what the row says, its counts), and `mail_cloudflare_addresses` gains
`asked_at`, NULL while an address waits its turn to be asked about. Migration
`1008_mail_test_again.sql`: `mail_cloudflare` gains `test_to` and `test_asked_at`, the address a
test refused for a domain not onboarded went to and when it was pressed, cleared when a test passes.
Migration `1016_mail_gmail.sql`: `mail_threads` gains `starred` (with a partial index),
`mail_labels` holds the team's labels and their colours, and `mail_mailboxes` gains `stored_bytes`,
the running total of its stored copies, started from what was stored. Migration
`1019_mail_unread_and_age.sql` adds two indexes: `mail_threads_unread`, only the unread
conversations of the inbox, which Home's Unread mail card counts, and `mail_messages_received`, the
messages by arrival, through which the hourly removal finds the oldest. Migration
`1022_mail_lighter.sql` drops `mail_messages_age`, an index on the same messages by company and
arrival that no query read since `1019`: one write fewer for every message that arrives. Never KV
(mail law M-3).
