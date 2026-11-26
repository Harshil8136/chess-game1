---
title: "@oltrem/email: Write, templates and HTML, addresses, sending, files, Sent"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/write-page.tsx, written.ts, files.ts, before-send.ts, clean.ts, rich.ts, sanitize.ts]
---

# @oltrem/email: Write, templates and HTML, addresses, sending, files, Sent

> Part of [the @oltrem/email README](../README.md).

## Write, continued

### Templates and HTML

| Part | What it does |
| --- | --- |
| The template picker | One select in the tools row (letters first, most used next, after **No template**); Use posts the form as it is (`?intent=template`), so nothing typed is lost. `?template=<id>` opens Write with one picked. A template with code is locked to someone without `email.write.code` |
| A letter | Its subject and words fill an empty box, or replace the last letter's unchanged words; typed words are kept above. **No template** takes unchanged letter words away |
| A design | The message goes in its message place with the signature; no message place, no box |
| Fields | `{{first_name}}`, `{{last_name}}`, `{{name}}`, `{{email}}` come from each recipient; other fields are lines to fill (`field.<name>`, 300 characters, 30 at most); unnamed fields drop; values are escaped |
| Write in HTML | With `email.write.code` at the company: Words or HTML. HTML is cleaned by `sanitizeEmailHtml` and its text copy read out of it. `<style>` rules are written onto each tag (`inlineStyles`: own style, then specificity, then order; `@media` stays; each declaration once, `oncePerDeclaration`, so cleaning twice changes nothing), since many mail apps read only a tag's own style. A whole pasted email (`isDocument`) goes as its own page, the signature at its foot |
| The composer's HTML | `POST /write` and `/written` take `editor: 'rich'` with `format: 'html'`, for anyone who may send everyday mail. `cleanRich` keeps only the composer's tags (lines, bold, italic, underline, strike, lists, quotes, three headings, links, pictures, a rule) and a few looks, written on each tag |
| Preview | Words: the composer shows them as they will look (without the script, `data-marks-of` under the form). A template or HTML: **Preview** saves the draft and shows `GET /written/:id/preview`, under a policy that runs nothing |
| Save as template | Subject and words become a new letter (words only, never HTML); the email stays a draft |

### Addresses, sending and Sent

| Part | What it does |
| --- | --- |
| From | Addresses the person may use (`email.senders.use` at the address's place), defaults first, in a dropdown (`ui-drop`) ending with **Another address…** (`?intent=add-from`, `POST /senders/own`). With none, the page sends them to Senders |
| To, Cc, Bcc | Commas, semicolons or lines, bare or `Name <address>` (`readAddresses`); chips with the script (red when not an address), pasted lists split, repeats folded, a known address takes its name; Cc and Bcc fold away while empty. 50 people at most (more: a campaign). Several in To each get their own email with their own fields; Cc and Bcc go with the first only. A reply stays one email. Suggestions come from the last 100 emails sent, most often first (`written.recent`) |
| The message | Plain words with `**bold**`, `_italic_` and `- ` lists; https addresses become links. Sent as HTML (`writtenHtml`, all escaped) and text under `email.written` |
| Sending | `POST /write` checks the address and queues as any message (lease, failover, reports). Audited `email.write` with the count, never the words. Each person's email is its own message: the first keeps the key, the others take `<key>.<n>` |
| Undo | It waits `UNDO_SECONDS` (10) or `email.undo_seconds` (5 to 30). The page offers Undo (`POST /written/:id/undo`, audited `email.unsend`), back into the form as a draft; Sent has it too (`/email/sent?intent=undo`). Once handed over: `KIT-E-1511` |
| Drafts | `POST /written` keeps what is typed; it saves itself 3 s after the last change and before leaving (`data-keep-draft`, `?intent=autosave`), the address becoming `?draft=<id>`; Send waits for a save under way. Email, Drafts lists them |
| Files | **Attach a file** saves the draft and attaches (`?intent=attach`; with the script, straight to the draft's route by `data-upload`); chips take one off (`?intent=detach`). 10 files and 10 MB together (`FILES_MAX`, `FILES_MAX_BYTES`); a file up to 95 MB (`DOWNLOAD_MAX_BYTES`) goes as a download link for 30 days (`DOWNLOAD_DAYS`, `withDownloads`). Kinds in `FILE_TYPES` (PDF, Office, OpenDocument, RTF, CSV, text, calendar, JPG, PNG, GIF, ZIP); others `KIT-E-1512`. Kept under `mail/attachments/`; each email gets a link per file for a day (`FILE_LINK_HOURS`) that the provider fetches (`GET /hooks/email/files/<token>`). Only Brevo and Resend fetch from a link (`attachmentBytes`), so files go only through them, never Cloudflare's route. `email.files` removes a deleted email's files within the hour |
| Before it goes | `before-send.ts` asks once about an address one slip from a big free service (`likelyAddress`), words about a file with none attached, an email that reads like a promotion (`promotionSigns`: offer words, a newsletter build, Unsubscribe or View in browser, six links, shouting) or a link that goes nowhere. **Correct and send** (`fix=1`) or **Send anyway** posts with `?sure=1`. No query, no provider call |
| Leaving | The form is `data-keep-typed`: once typed, leaving asks first; sending or saving does not |
| Sent | Email, Sent lists Write's emails from the moment Send is pressed, each with its outcome in a word (Undo window, Queued, Waiting, Retrying, Sending, Failed, Sent, Delivered, Opened, Clicked, Delayed, Bounced, Refused, Marked as spam). It refreshes itself (`data-live`) every 5 s while one is in its Undo window or being handed over, every 30 s while one waits. One opens with its people, words and timeline, **Forward** and **Send again** |
| Signature | One per sender address (migration `0053`): words with the same marks, the composer's HTML, or pasted HTML code, cleaned and kept behind `SIGNATURE_HTML` (`keptSignature`), 20,000 characters. It goes under the message (grey in HTML, after `-- ` in text); Forward and Send again leave it off |
| Send later | A day and time on the company's clock (UTC when none), a minute to a year ahead. `email.written` queues each within 15 minutes of its time (every 5 minutes while any is scheduled, else hourly). Drafts, Scheduled lists them; Take back makes a draft again |
