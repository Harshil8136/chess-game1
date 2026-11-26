---
title: 'Oltrem Mail: the inbox'
status: approved
owner: vendor
last_verified: 2026-11-26
sources: [modules/mail/src/arrival.ts, inbox.ts, reader/reader.js, Cloudflare docs read 2026-11-02 (email handler, Email Routing, limits; D1 limits), postal-mime and DOMPurify documentation]
---

# Oltrem Mail: the inbox

Why the optional inbox on the business's own domain is built the way it is: arrival inside the
Worker's 10 ms, where each part is kept so the portal's one database never fills, and how a
message is read safely on a phone. Part of [the plan](plan.md), built in phase 4
([the record](../archive/records/2026-11-02-phase-4-inbox.md)). What it does today, its routes,
settings and jobs: [`modules/mail/docs/inbox.md`](../modules/mail/docs/inbox.md) and its README.

## 1. How mail arrives

Cloudflare Email Routing (free, unlimited) hands each message to the Worker's `email` handler.
Cloudflare has already refused mail failing its sender's DMARC policy and mail from blocklisted
servers. **Send a test** on Mailboxes hands a message in the same way on the builder's computer.

1. The mailbox is looked up (one query); an unknown one gets `setReject("Unknown recipient")`.
2. The stream is split with `tee()`: one side goes whole to R2 as `mail/inbox/<id>.eml` through a
   `FixedLengthStream` (R2 needs the length); the other keeps the first 128 KB (`PARSE_BYTES`) for
   postal-mime and is cancelled. A larger message is marked `has_unparsed_attachments`.
3. A blocked sender is dropped and counted; rules and the spam threshold apply; a Message-ID seen
   before is kept once. One `db.batch()` writes the message, its thread and its search words.
4. Kept whole or not at all: a failed batch takes the stored copy back and rethrows, so the
   sender's server tries again (or the mailbox's forwarding address takes it).

The parse took 0.7 ms for 128 KB of HTML on a warm engine (Node 22, 2026-11-02), so arrival stays
inside 10 ms of CPU at any size up to Cloudflare's 25 MiB. Production's figure is still to be read
once a client has mailboxes.

## 2. Where each part is kept

| Kept in | What |
|---|---|
| D1 | Headers, the 200-character snippet, attachment names and sizes, thread links, flags, and an FTS5 index without content over the first 8 KB of text (`SEARCH_BYTES`) |
| R2 | The whole message as received |

Bodies stay out of D1: a free database stops at 500 MB and the inbox shares the portal's one. At
30 KB of HTML and 50 messages a day, bodies would pass 500 MB within a year and stop every write
in the portal. Retention (`mail.inbox.keep_days`) and the health check (past 250 MB of rows or
8 GB of copies) keep both inside the free plan.

## 3. Reading a message

1. The phone fetches the first 256 KB of the stored copy (`READ_BYTES`, an R2 range read), or all
   of it when smaller, so a large HTML invoice shows in full. The Worker checks the person's right
   to the mailbox and passes the bytes along without parsing them.
2. The phone parses them with postal-mime and cleans the HTML with DOMPurify (both load only on the
   Inbox) into the reading frame (section 4).
3. Past 256 KB, or with unread attachments, **Load full message & attachments (X.X MB)** fetches
   the whole copy, so a person sees attachments are there before spending mobile data. An
   attachment cannot be cut out by byte range: its place is known only by reading up to it.
4. Search covers the first 8 KB of each message's text, and the page says so.

## 4. The reading frame

- **Sandbox:** `allow-popups allow-popups-to-escape-sandbox allow-same-origin`, so the portal can
  read the frame's height. Never `allow-scripts` (with same-origin a message could lift its own
  sandbox; a test fails the build), `allow-forms` or `allow-top-navigation`.
- **Its own policy in `srcdoc`:** `default-src 'none'; style-src 'unsafe-inline'; img-src data:
  blob:; font-src data:; media-src 'none'; form-action 'none'; frame-ancestors 'self'`, with
  `https: http:` added to `img-src` only after **Show images**. Browsers ignore `frame-ancestors`
  in a meta tag; the portal's own header sends it.
- **Links never move the frame:** `<base target="_blank">` is injected and the message's own base
  removed; DOMPurify sets `target="_blank" rel="noopener noreferrer"` on every `<a>`, SVG `<a>` and
  `<area>`, and strips `<form>` and every control. `<meta name="referrer" content="no-referrer">`
  hides the portal's address from senders.
- **Images:** remote ones are blocked by the policy and by DOMPurify moving their addresses aside;
  Show images brings back only those on another site (a relative or portal address would be fetched
  with the reader's cookies). Inline `cid:` pictures show from the parsed message, flat types only
  (PNG, JPEG, GIF, WebP, AVIF, BMP): an SVG opened from the portal's address would run as the portal.
- **Height:** a `ResizeObserver` sizes the frame, one scrollbar on a phone; images and tables get
  `max-width: 100%`.
- **Trust:** SPF, DKIM and DMARC only from Cloudflare's own header; a link whose words show one
  address and whose target is another is marked.

## 5. Threads

- Arriving mail is filed by `References` and `In-Reply-To` (the last 20 ids), else by the same
  subject (Re: and Fwd: off) and correspondent within 30 days (`SUBJECT_DAYS`).
- Replies carry both headers on every route: References are the answered message's References and
  its Message-ID, so the customer's answer names an id the portal holds.
- Cloudflare and some providers refuse a Message-ID we set, so the portal sets one only where the
  route allows and stores the id the route returns.
- No plus addresses (`sales+t4k9@`): Email Routing passes them on only with subaddressing on, so
  answers would bounce, and the stored ids already thread them. An arriving `+tag` is taken off to
  find the mailbox.

## 6. Mailboxes

A mailbox is a row with its own literal routing rule (at most 200 a domain, `MAILBOXES_MAX`), on
the root as on a subdomain: a catch-all would take mail the business still receives elsewhere. A
rule the key may not make shows its dashboard step and is retried every few minutes in the
mailbox's first hour, hourly after. Who reads and who sends from each mailbox are capabilities.
IMAP is not included: the portal is the mail app.

The familiar parts (Updates, one-press unsubscribe, snooze, mute, sweep, search words, swipe,
automatic reply, saved replies, No answer yet, stars, labels, quick settings, keys, the storage
gauge) came from [the research on easier mail](../archive/records/2026-11-02-easier-mail.md) and
[on Gmail's style](../archive/records/2026-11-11-gmail-style.md); the module's inbox page says how
each works.
