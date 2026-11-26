---
title: "@oltrem/users: Tables; Errors; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/users/src; split from modules/users/README.md]
---

# @oltrem/users: Tables; Errors; Tests

> Part of [the @oltrem/users README](../README.md).

## Tables

Migration `0007_users.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`users_profiles` (`principal_id`, `display_name`, `locale`, `updated_at`). The account itself is
`iam_principals` (`@oltrem/iam`, migration `0004`).

Migration `0070_users_seen.sql`: `users_profiles.seen_at`, when the person last pressed Mark as seen
on Home's What changed card; the card counts the others' changes since then (`GET /api/audit/since`,
`@oltrem/core-audit`). Written only on that press, never when a page is shown, so a page the frame
fetched ahead of a tap marks nothing. A person with no profile row gets one on the first press.

Migration `0055_users_views.sql`: `users_views` (`id`, `principal_id`, `path`, `name`, `query`,
`created_at`, one name per person and page). A saved view keeps a page's address and its filters,
never rows, so opening it runs the page's own permission check. At most `VIEWS_PER_PAGE` (12) per
person and page, checked in the same statement as the write. Personal preferences, like the theme:
not audited.

Migration `0056_users_notifications.sql`: `users_notifications` (`id`, `principal_id`, `module`,
`subject`, `body`, `link`, `key`, `created_at`, `read_at`; one key per person) with indexes for the
newest first, the unread and the age; `users_notify_choices` (`principal_id`, `module`, `channel`:
`both`, `portal`, `email` or `off`; no row is both).

## Errors

The module owns the `2100` to `2199` block: `KIT-E-2101` nothing to change (the account is in
that state already), `KIT-E-2102` an Owner cannot be deactivated or blocked, `KIT-E-2103` too many saved
views on one page, `KIT-E-2104` only an Owner or the Vendor may sign everyone else out. What the permission model names
keeps its codes: `KIT-E-2007` beyond your standing, `KIT-E-2008` your own account, `KIT-E-2010`
a bad profile or a missing reason, and the core's `KIT-E-0404` for a person who does not exist.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company of two
scopes, three roles, six people and a group: the manifest; the directory with its filters, the
Vendor left out, a person without `users.read` refused; profiles edited by oneself and by
`users.manage`, searched by name, a bad locale and an empty change refused, the audit row; the
switch refused to a clerk, done by a manager over a clerk at her scope and refused over a group
grant at the root, refused for oneself and for an Owner, needing a reason, done once and nothing
to change the second time, the sessions following each switch, and the Vendor standing above a
manager; blocking for an hour and for good, refused to a clerk, for oneself, for an Owner and for
a time past, the door's refusal with the time, unblocking with the ended sign-in staying ended,
and a session's end time set, refused below standing or past, and cleared; the audit rows with their actors, reasons and refusals; Signed in today by person with the flags, the refused addresses and nothing older than a day, refused to a clerk; Sign everyone else out refused to a manager, done by an Owner, their own sign-in kept and a new sign-in let in, and the What changed mark, empty before the first press, kept for each person apart, a profile row made on the first press; the sign-in history paged and narrowed, refused to a clerk and a manager of one location; the two CSV downloads, their columns, the days limit and their audit rows (`test/signed-in.test.ts`); saved views; notifications kept
and emailed as each person chose (an inactive account and an address of nobody emailed only, a
key kept once, off keeps and sends nothing), the link taken from the text and never another
site's, opened by its owner only, all read, the privacy rows, pages of thirty by a cursor that
never skips a row of the same moment, and the 90-day job.
