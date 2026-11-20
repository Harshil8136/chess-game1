---
title: "Inquiries page: statuses, read and unread"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-11-20
verified_against: [code, infra]
owner: harshil
related_code: [src/pages/dashboard/inquiries/index.astro, src/pages/dashboard/inquiries/_components/InquiriesDashboard.tsx, src/pages/dashboard/inquiries/_components/InquiryTable.tsx, src/pages/dashboard/inquiries/_components/InquiryDetailModal.tsx, src/pages/dashboard/inquiries/_components/InquiryStatsBar.tsx, src/pages/dashboard/inquiries/_components/InquiryFilterBar.tsx, src/pages/dashboard/inquiries/_components/read-state.ts, src/pages/api/inquiries/update-status.ts, src/pages/api/inquiries/reply.ts, src/lib/dal/InquiryRepository.ts]
related_docs: [../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, ../security/RoPA.md, DASHBOARD.md]
tags: [feature, inquiries, customers, supabase, plac]
---

# Inquiries page: statuses, read and unread

> **TL;DR (non-technical):** the Inquiries page lists the messages people send through the
> website's contact form. Opening a new one marks it read, and each one can be marked read or
> unread by hand, as in an email inbox.

**Where:** `/dashboard/inquiries`. The messages are Supabase `contact_messages` rows, read and
written through `InquiryRepository` ([SECURITY.md](../security/SECURITY.md) lists the table and
its policies).

This document covers the statuses and how an inquiry moves between them. The page's other tools
(the reply, comments, tags, priority, the customer view, export and delete) are not described
here yet.

## The four statuses

| Status | Shown as | Means |
|---|---|---|
| `new` | New | Nobody has opened it yet |
| `read` | Read | Someone opened it or replied to it. Shown as "In Progress" until 2026-11-20, which did not say what the status means |
| `resolved` | Resolved | Dealt with |
| `archived` | Archived | Put away |

The counts at the top and the status filter read the same list, so they change at once when a
status does.

## Read and unread (since 2026-11-20)

Before this, nothing on the page marked an inquiry read: only sending a reply did
(`src/pages/api/inquiries/reply.ts`), so almost every inquiry stayed New.

- **Opening a new inquiry marks it read.** Its window opens showing Read, and the list changes
  at the same moment.
- **Mark as read / Mark as unread.** Each row has a button for it beside the reply button (an
  open envelope for "Mark as read", a closed one for "Mark as unread"). The inquiry's window has
  "Mark as unread" in its footer, which marks it and closes the window, as an inbox does.
- **Resolved and archived inquiries** have no read or unread button. Their status is changed in
  the window's Status field, as before.
- **When the save fails**, the inquiry goes back to its earlier status and a message says so.

All of it goes through `POST /api/inquiries/update-status`, which needs the page's `#edit`
permission and writes an audit row for each change. Without `#edit` the buttons are not shown
and opening an inquiry changes nothing. The rules live in `read-state.ts`, tested by
`test/inquiries-read.test.ts`.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-11-20 | Written with the read and unread change, against the files in `related_code`; `POST /api/inquiries/update-status` needs `/dashboard/inquiries#edit` and accepts `new` and `read`; `test/inquiries-read.test.ts` passes. Live `contact_messages` read through the Supabase connector: 4 new and 2 read (the two that were replied to) | The page's other tools; the page in a phone browser (the owner's test) |
