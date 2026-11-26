---
title: "@oltrem/email: The tables and the error codes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: The tables and the error codes

> Part of [the @oltrem/email README](../README.md).

## The tables and the error codes

`email_messages` (migration `0011_email.sql`): the message key, the tenant, the template, the
addresses, the status (`leased`, `sent`, `retrying`, `waiting`, `failed`), the attempts, the lease,
the instance, the provider's id, the last error and the last delivery event; migration
`0043_email_outcomes.sql` adds the outcome, its time, whether it is for good and the provider's
words, and the first open by a person and by a machine, click, spam report and unsubscribe. The same
migration makes `email_donotmail` (the address, what it stops, the reason, the message that put it
there, who and when) and `email_softbounces` (temporary bounces per address and their window).
Migration `0045_email_senders.sql` makes `email_domains` (the domain, its instance and the
provider's id for it, the records and check lines as JSON, the state `new`, `failing` or `passing`,
who confirmed it, when it was checked and first passed, and its two default addresses; migration
`1013_email_send_proof.sql` adds `send_proof`, what the last email through its provider showed) and
`email_senders` (the address, its name and reply-to, its place, its purpose and its domain).
Migration `0047_email_templates.sql` makes `email_templates` (the name, the kind, the current
version's subject, preview line, accent and body, the blocks as JSON or the cleaned HTML, what the
last cleaning took out, the version last tested, by whom and when, and when it was archived) and
`email_template_versions` (each version's content, by whom and when). Migration
`0048_email_lists.sql` makes `email_lists` (the name, description, merge fields, the kept counts of
people and of those on the do-not-mail list, the last import's reason, note, person, time and
source, and when it was archived) and `email_list_members` (the address, name, merge fields as JSON,
the reason, who added them and when). Migration `0052_email_written.sql` makes `email_written` (the
writer, the sender, the addresses as JSON, the subject and the words, the state, the time it goes
for one scheduled, the message key once queued and why it was last not queued; see Write). Migration
`0053_email_signatures.sql` adds each sender address's `signature`. Migration
`1017_email_code_for_senders.sql` gives `email.write.code` to every role that may send and bumps
each company's access version. Migration `1018_email_messages_recent.sql` indexes `email_messages`
by `created_at` and `status`, for Home's card. Migration `1021_email_lighter.sql` puts
`email_messages_moving` in place of the index by status: only the messages still on their way
(`leased`, `retrying`, `waiting`), which the two readers that look for them read (`MOVING`, the same
words in the index and in each query, so SQLite uses it), so a message that went out writes its row
and four index entries, not five. Migration `1000_email_pinned_route.sql` adds
`email_messages.pinned_route`, the route a message with no clear answer stays on. Migration
`1003_email_consent.sql` makes `email_list_left` (who left which saved list from an unsubscribe
link, the message and when) and adds `email_domains.bulk_since`, the first day a domain sent bulk
mail, which `@oltrem/campaigns` warms up from. Migration `1006_email_clean_lists.sql` makes
`email_mail_servers` (a domain, whether it has a mail server, why not, when it was asked and noted;
no tenant, since a DNS answer is the same for every company), adds `email_lists.unreachable`, and
notes the domains already on the lists. Migration `1009_email_kind_senders.sql` makes
`email_kind_senders` (a kind of mail and the sender it comes from; no row, the main address).
Migration `1010_email_files.sql` makes `email_files` (a file attached to an email written on Write:
its email, name, type, size, the portal's address its links start with, who and when) and
`email_file_links` (the SHA-256 of a provider's link to one file and when it ends). Migration
`1011_email_files_owner.sql` adds `email_files.owner` (`written`, or `campaign` for a campaign's
file, whose id is then the campaign's) and `email_files.person` (whom a campaign's file goes to).
Forgetting an address removes its marks; deleting a list removes the list's.

| Code | Name | Status | When |
|---|---|---|---|
| `KIT-E-1501` | `NO_PROVIDER` | 503 | the tenant has no active or failover email instance: a queued message waits, a test sent at once is not sent |
| `KIT-E-1502` | `LEASED` | 409 | another delivery of the message holds its lease |
| `KIT-E-1503` | `UNKNOWN_TEMPLATE` | 422 | no template the Worker was built with has that id |
| `KIT-E-1504` | `ALL_FAILED` | 502 | your email service and any backup service refused the message; a queued one is tried again unless the key or the message was refused, a test sent at once is not |
| `KIT-E-1505` | `BAD_TEMPLATE_DATA` | 422 | the data does not match the template's schema |
| `KIT-E-1506` | `IN_USE` | 409 | a domain with addresses, or a default address while others remain, is removed or narrowed |
| `KIT-E-1507` | `ALREADY_ADDED` | 409 | the domain or the address is there already |
| `KIT-E-1508` | `SENDER_NOT_READY` | 422 | the sender was removed, is for the other kind of mail, or its domain does not pass for bulk mail |
| `KIT-E-1509` | `CHANGED_SINCE` | 409 | a template was saved again after the version the change was made to |
| `KIT-E-1510` | `BAD_LIST` | 422 | a list's file has no column of email addresses or no one to mail, is over 1 MB, or would make the list longer than 50,000 |
| `KIT-E-1511` | `TOO_LATE` | 409 | Undo or Take back after the queue handed the email over, or for one not waiting to be sent |
| `KIT-E-1512` | `FILE_REFUSED` | 422 | a file of a kind an email may not carry, empty, or past ten files or 10 MB together; or no email service here can send files |
| `KIT-E-1513` | `KEY_REFUSED` | 422 | the provider answered 401 or 403 to the key Connect was given: nothing was set up or changed |
| `KIT-E-1514` | `BAD_TYPED` | 422 | typed or pasted addresses: none can be mailed, none was typed, over 1 MB, or the list would grow past 50,000 |
