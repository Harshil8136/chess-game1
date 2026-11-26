---
title: "@oltrem/email: Routes: Confirm it's you"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Routes: Confirm it's you

> Part of [the @oltrem/email README](../README.md).

## Routes

Under `/api/email`, through the IAM module's sessions and check. Only `email.lists.export` asks for
a fresh sign-in (a download of people's data), and `GET /instances/:id/hook` asks for one itself (it
reveals a secret token), of everyone but the Vendor, who is never asked; sending, the readiness
check, releasing held mail and address work do not. A page that needs a fresh sign-in shows
**Confirm it's you** in place, never a smaller view: the list page asks `GET
/lists/:id/download/ready` first. The templates' capabilities are held at the company itself:
`email.templates.read` to see and preview, `email.templates.write` to build from blocks and send
oneself a test, `email.templates.html` as well to paste HTML or change a pasted body or a code
block. So are the lists': `email.lists.read`, `email.lists.write`, and `email.lists.export` to
download one, and `email.write.code`, to write in HTML on Write and send with a template that holds
code. Since 2026-11-12 `email.write.code` is an `operate` capability, migration
`1017_email_code_for_senders.sql` gives it to every role that holds `email.senders.use`, and it
counts wherever the person holds it, a branch too (`holdsAnywhere`): code is how an email looks, not
whose data it reaches.
