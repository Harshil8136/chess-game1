---
title: "@oltrem/users: tables, errors, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/users/src/errors.ts, views.ts, notifications.ts, migrations, test]
---

# @oltrem/users: tables, errors, tests

> Part of [the @oltrem/users README](../README.md).

## Tables

| Migration | Adds |
|---|---|
| `0007_users.sql` | `users_profiles` (`principal_id`, `display_name`, `locale`, `updated_at`); the account is IAM's `iam_principals` |
| `0055_users_views.sql` | `users_views` (`id`, `principal_id`, `path`, `name`, `query`, `created_at`; one name per person and page): an address and its filters, never rows, so opening runs the page's own check; `VIEWS_PER_PAGE` (12) checked in the write; not audited |
| `0056_users_notifications.sql` | `users_notifications` (`id`, `principal_id`, `module`, `subject`, `body`, `link`, `key`, `created_at`, `read_at`; one key per person, indexed newest, unread, age) and `users_notify_choices` (no row is both) |
| `0070_users_seen.sql` | `users_profiles.seen_at`, written only on Mark as seen (a profile row made on the first press), so a prefetched page marks nothing |

## Errors

The module owns the `2100` to `2199` block: `KIT-E-2101` nothing to change (the account is in
that state already), `KIT-E-2102` an Owner cannot be deactivated or blocked, `KIT-E-2103` too many saved
views on one page, `KIT-E-2104` only an Owner or the Vendor may sign everyone else out. What the permission model names
keeps its codes: `KIT-E-2007` beyond your standing, `KIT-E-2008` your own account, `KIT-E-2010`
a bad profile or a missing reason, and the core's `KIT-E-0404` for a person who does not exist.

## Not built yet

The door's groups are not synced from Access (`iam_groups.source` has no reader).

## Tests

| File | What it proves |
|---|---|
| `test/users.test.ts` | On two scopes, three roles, six people and a group: the manifest; the directory and its filters, the Vendor left out; profiles, a bad locale and an empty change refused; the switch by standing, refused for oneself, an Owner or a group grant at the root; blocks for an hour and for good, the door's refusal, unblocking; session end times; audit rows with actors, reasons and refusals; saved views; notifications kept and emailed as chosen, a key once, links never another site's, owner only, the privacy rows, pages by cursor, the 90-day job |
| `test/signed-in.test.ts` | Signed in today with its flags and refusals, older than a day left out; Sign everyone else out by an Owner only, their own sign-in kept; the What changed mark; the sign-in history paged and narrowed; the two downloads, their columns, days limit and audit rows |
| `test/get-started.test.ts` | The Invite a second person step around the handover |
