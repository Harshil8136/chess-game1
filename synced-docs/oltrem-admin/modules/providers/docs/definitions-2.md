---
title: "@oltrem/providers: The definitions, continued (2)"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/providers/src; split from modules/providers/README.md]
---

# @oltrem/providers: The definitions, continued (2)

> Part of [the @oltrem/providers README](../README.md).

## The definitions, continued

A definition may name its provider's public status page (`status`, 2026-11-21): `https://` and a
host alone, a page that answers at `/api/v2/status.json` in the common format, read by System
status's Service status check (`@oltrem/core-health`) for the email services set to send. The
kit's name it for Resend, Brevo, Mailgun, Mailjet and SMTP2GO, each page read on the day. It is
left out for SendGrid, whose page is Twilio's as a whole, and for Postmark and Mailtrap, whose
pages did not answer in that shape; the others are left out until a page of theirs is read in it.
