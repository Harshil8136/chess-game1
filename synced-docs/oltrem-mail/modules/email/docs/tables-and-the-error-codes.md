---
title: "@oltrem/email: the tables and the error codes"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/migrations, modules/email/src/errors.ts]
---

# @oltrem/email: the tables and the error codes

> Part of [the @oltrem/email README](../README.md).

## The tables

| Migration | What it makes or adds |
| --- | --- |
| `0011` | `email_messages`: key, tenant, template, addresses, status (`leased`, `sent`, `retrying`, `waiting`, `failed`), attempts, lease, instance, provider id, last error, last event |
| `0043` | The outcome, its time, `permanent`, the provider's words and the first times on `email_messages`; `email_donotmail` (address, what it stops, reason, message, who, when); `email_softbounces` |
| `0045` | `email_domains` (instance, provider id, records and check lines as JSON, state `new`, `failing` or `passing`, confirmer, check times, two defaults); `email_senders` (address, name, reply-to, place, purpose, domain) |
| `0047` | `email_templates` (name, kind, the current subject, preview line, accent, blocks or cleaned HTML, what cleaning took out, last tested version, archived) and `email_template_versions` |
| `0048` | `email_lists` (name, description, merge fields, kept counts, last import's reason, note, person, time, source, archived) and `email_list_members` (address, name, fields, reason, who, when) |
| `0052` | `email_written` (writer, sender, addresses, subject, words, state, send time, message key, why last not queued) |
| `0053` | Each sender's `signature` |
| `0054` | Templates' `uses`, `style`, `used_count`, `used_at`; Write's `template_id`, `template_version`, `fields`, `format` |
| `1000` | `email_messages.pinned_route` |
| `1003` | `email_list_left` (who left which list, the message, when); `email_domains.bulk_since`, the warm-up's start |
| `1006` | `email_mail_servers` (per domain, no tenant: has a server, why not, when); `email_lists.unreachable` |
| `1009` | `email_kind_senders` (a kind and its sender; no row, the main address) |
| `1010` | `email_files` (email, name, type, size, link origin, who, when) and `email_file_links` (a link's SHA-256 and end) |
| `1011` | `email_files.owner` (`written` or `campaign`) and `.person` |
| `1013` | `email_domains.send_proof` |
| `1017` | `email.write.code` for every role that may send; access versions bumped |
| `1018` | `email_messages_created`, for Home's card |
| `1021` | `email_messages_moving` in place of the status index: only `leased`, `retrying`, `waiting` rows, read with the same words (`MOVING`) so SQLite uses it |

Forgetting an address removes its marks; deleting a list removes the list's.

## The error codes

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
