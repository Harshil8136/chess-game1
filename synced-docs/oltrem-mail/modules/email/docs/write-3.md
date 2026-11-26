---
title: "@oltrem/email: Write, continued (3)"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Write, continued (3)

> Part of [the @oltrem/email README](../README.md).

## Write, continued

Each email written is a row of `email_written` (migration `0052`) that belongs to its writer: only
they read it, and only through these routes. Its state is `draft`, `scheduled`, `queued` (in the
queue, its words still taken back) or `sent` (handed over; its `email_messages` row with the same
key says what became of it). The queue's copy carries the row's id, and the delivery first moves
the row from `queued` to `sent` in one guarded update: an email taken back is a draft by then, so
the copy is dropped without a send, and two moves that race cannot both win. When the queue
refuses an email at once, a draft stays a draft and says why (`problem`), and a new email is not
kept, since the page still shows what was typed.
