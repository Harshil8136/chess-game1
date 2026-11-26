---
title: "@oltrem/email: saved templates and saved lists"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src/templates.ts, design.ts, sanitize.ts, lists.ts, people.ts, clean.ts]
---

# @oltrem/email: saved templates and saved lists

> Part of [the @oltrem/email README](../README.md).

## Saved templates

Letters and designs the company builds on Email, Templates (`/email/templates`), kept in D1 (unlike
the typed templates, which are code). A row filters them (all, for Write, for campaigns, with code,
archived); one opens to Edit, Preview (phone, desktop, dark) and Versions.

- **Where used** (`uses`, migration `0054`): `everyday` (Write), `bulk` (campaigns) or `both`; a
  campaign refuses a Write-only one. A **letter** is a saved reply: subject and words with Write's
  marks. A **design** for Write has a **message** block (or `{{message}}` in pasted HTML) where
  Write's words go; the checks warn when a campaign design has one, and Write-only designs carry no
  campaign footer. Write counts uses (`used_count`, `used_at`) and lists the most used first.
- **Code.** A code block (HTML, cleaned like pasted HTML) is added or changed only with
  `email.templates.html`; others see it locked (they may move or remove it, never change it, and
  may not copy the template). On Write, a template with code needs `email.write.code`.

| Part | What it does |
| --- | --- |
| Blocks | Heading, text, button, image (with description and optional link), divider, space; 40 at most. `renderDesign` builds table HTML that suits phones and dark mode (`color-scheme`), a hidden preview line, the bulk footer, and plain text. Every value escaped; links https, mailto or tel; images https |
| Pasted HTML | With `email.templates.html`. `sanitizeEmailHtml` (HTMLRewriter) drops scripts, frames, forms, SVG and their content, unknown tags (keeping words), unlisted attributes and `on...` handlers; links must be http(s), mailto, tel, `#` or a merge field, images https or small inline. In CSS only the declaration that loads something unsafe or could run goes (`cleanCss`); Google Fonts and Bunny Fonts `@import`s, safe Outlook conditional comments, ids and `xmlns` stay. What was removed is listed on the template |
| Merge fields | `{{first_name}}` or `{{first_name\|there}}` in the subject, preview line and every block; other tools' spellings name the same field (Mailchimp `*\|FNAME\|*`, Brevo `{{ contact.FIRSTNAME }}`, Liquid with `default`, `{first_name}`, `${first_name}`, `%first_name%`: `fieldSpellings`). Values are escaped into HTML. `readList` and `merge` live in `src/people.ts` (re-exported by `@oltrem/campaigns`) |
| The checks | On every view, with sample values: a subject not all capitals, a preview line, words, under Gmail's 100 KB cut, no http links, whole https button and image addresses, every image described, no link that goes nowhere. Each `pass`, `warn` or `fail` (fix before sending to many) |
| Versions | Each changing save is a version (30 kept, `VERSIONS_KEPT`); the same person's saves within ten minutes of an untested version change it. An old one previews and comes back as new. A save over a newer version is `KIT-E-1509` |
| The preview | `GET /templates/:id/preview`, a page that runs nothing and loads only https images, framed with `sandbox` |
| The test | Sent at once to the signed-in person, from their default bulk sender, through the active instance then failovers; kept as `email.template-test` with its reports. It marks the version tested |
| Archive | Never deleted, so old sends still show it; it can come back |

`createEmail(...).templates.design` hands a send a template's current or named version. Audited:
`email.template-add`, `-save`, `-copy`, `-archive`, `-restore`, `-revert`, `-test`.

## Saved lists

The people bulk mail goes to, on Campaigns, Lists (`/email/lists`).

| Part | What it does |
| --- | --- |
| Filling a list | A CSV (1 MB, `readCapped`; `readList` finds the address column by heading or by values; other columns are merge fields; past 30 columns the needed ones first, the rest named back) or typed or pasted addresses (`typedCsv`: lines, commas, semicolons, tabs, `Name <address>`). Keep and add, update repeats, or replace all. 50,000 people a list (`LIST_PEOPLE_MAX`) |
| Adding, on the page | **Contacts** and **Add contacts**, three ways as cards: **Upload a file** (the browser previews it, `data-file-peek`; a sample at `GET /lists/sample`), **Paste addresses**, and **From your email** (people the person emailed, not on the list yet, `GET /lists/:id/suggestions`, source `people you emailed`). Each ends with **Permission to email them**, **Fix common typos** and the confirmation. The head has **Send email** (`/campaigns?list=<id>`) and More (Download CSV, Edit, Archive or Restore, Delete) |
| The reason | Asked at every import: `asked`, `customers` or `other` with a note, and confirmed. Each person keeps it with who added them and when |
| What an import says | Added, updated, repeated and refused, the first 20 refused (rows for a file, addresses for a paste), how many are on the do-not-mail list, the merge fields. Nothing dropped in silence |
| The do-not-mail list | Read at every send; such a person stays, shown as never mailed with why. Counts are kept on the list and recounted at most every 15 minutes |
| Cleaner lists | A likely typo of a big service (`gmial.com`) or a fake ending (`.con`) is corrected and named (`likelyDomain`, `src/clean.ts`; `fix=0` keeps all as written); real near-names (`ymail.com`) are never touched. Shared inboxes (`info@`) are marked and mailed; no-reply ones marked and left out. The job `email.servers` looks up each new domain's mail servers, 5 a run, again after 30 days (`SERVERS_FRESH_MS`), sleeping when done; a domain with none or a null MX (RFC 7505) marks its people `unreachable`. An unanswered domain leaves nobody out |
| Finding and tidying | By address start or name, 50 a page; **Remove** asks first; forget an address on every list; archive, restore or delete a list |
| A refused paste | Keeps what was typed: no address, none mailable (`KIT-E-1514`), or over 1 MB |
| Downloading | A CSV with merge fields, reason and do-not-mail flag, with `email.lists.export` and a fresh sign-in; audited |

`createEmail(...).lists.people` hands a send its people a page at a time. Audited:
`email.list-add`, `-update` (with `changes`), `-import`, `-remove-person`, `-forget`, `-archive`,
`-restore`, `-remove`, `-export`.
