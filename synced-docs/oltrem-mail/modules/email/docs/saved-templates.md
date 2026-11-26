---
title: "@oltrem/email: Saved templates; Saved lists"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/email/src; split from modules/email/README.md]
---

# @oltrem/email: Saved templates; Saved lists

> Part of [the @oltrem/email README](../README.md).

## Saved templates

The letters and designs the company writes with, kept in D1 as the company's (stage 3 of the bulk
sending plan, `archive/records/2026-10-28-saved-templates.md`; Write, the kit's record
`archive/records/2026-10-31-write-templates-and-code.md` in oltrem-admin). They are not the typed
templates above, which are code; a saved template is data a person builds on the page Email,
Templates (`/email/templates`): a row filters them (all, for Write, for campaigns, with code,
archived), and one opens to Edit, Preview (as a phone, a desktop or in dark mode) and Versions.

Each template says where it is used (`uses`, migration `0054`): `everyday` on the Write page,
`bulk` in campaigns, or `both`; a campaign refuses one for Write alone, and its picker lists only
the others. A **letter** (`style` `letter`) is a saved reply for Write: a subject and words with
the marks Write reads, kept as one text block; its words open in the message box to be changed. A
**design** for Write starts with a heading and a **message** block, where the words written on
Write go; pasted HTML takes them where it says `{{message}}`. The checks warn when a design for
campaigns has a message place, since a campaign leaves it empty, and campaigns' footer and
unsubscribe line are left out of a template for Write alone. Each send from Write counts on the
template (`used_count`, `used_at`), and the row offers the most used first.

A **code** block holds HTML inside a design, cleaned like pasted HTML. Code is added or changed
only by someone who holds `email.templates.html`; someone who builds from blocks sees it locked,
and may move it or take it out (the HTML they send back must match what is kept), never change it,
and may not copy a template that holds code. On Write, a template with code (a code block or
pasted HTML) is used only by someone who holds `email.write.code`.

| Part | What it does |
|---|---|
| Blocks | A heading, text (a blank line starts a paragraph, an https address becomes a link), a button, an image with its description and an optional link, a divider, a space; at most 40. `renderDesign` puts them together as table HTML a mail app shows well on a phone and in dark mode (`color-scheme`, a dark palette by media query), with a hidden preview line and the footer bulk mail carries, and the same message as plain text. Every value is escaped; links are https, mailto or tel, images https |
| Pasted HTML | Only for someone who also holds `email.templates.html`. `sanitizeEmailHtml` cleans it with HTMLRewriter before it is saved: a script, frame, form, SVG and the like go with their content, an unknown tag goes and keeps its words, an attribute not on the list and every `on...` handler go, a link must be http(s), mailto, tel, `#` or a merge field, an image https or a small inline picture. In the style sheet and each `style` attribute only the declaration or statement that loads something other than https or a small inline picture, or could run, goes (`cleanCss`), so the rest of the design stays; a web font's `@import` from Google Fonts or Bunny Fonts stays; Outlook's conditional comments (`<!--[if mso]>`) stay when nothing inside them can run, other comments go; ids and Outlook's `xmlns` stay. Until 2026-11-11 one font `@import` or one such `url()` threw out the whole `<style>` block, which broke coded emails. What was taken out is kept on the template, in words, and shown on its page |
| Merge fields | `{{first_name}}`, or `{{first_name|there}}` with words for an empty value, in the subject, the preview line and every block; the spellings of other tools work as they are and name the same field: Mailchimp's `*|FNAME|*`, Brevo's `{{ contact.FIRSTNAME }}` and `{{ params.x }}`, Liquid's `{{ first_name | default: "there" }}`, `{first_name}`, `${first_name}` and `%first_name%` (`fieldSpellings` lists each field with how it is written; styles, percentages, encoded links, `{{#if}}` blocks and Mailchimp's own tags such as `*|UNSUB|*` are left as written); a person's value is escaped before it goes into pasted HTML. The lists and merge fields are read by `readList` and `merge` (`src/people.ts`, moved here from `@oltrem/campaigns`, which re-exports them) |
| The checks | Every view of a template carries them, filled with sample values: the subject is set and not all capitals, a preview line, words in the message, its size under the 100 KB Gmail cuts at, no http links, every button and image address whole and https, every image described, no link that goes nowhere (`#`, a template's yourwebsite.com; since 2026-11-12). A line is `pass`, `warn` (worth a look) or `fail` (must be fixed before it goes to many people) |
| Versions | Each save that changes the content is a version (the newest 30 are kept). Saves by the same person within ten minutes of a version not yet tested change that version, so moving a block does not bury the history. An older version can be previewed and brought back, as a new version. A save carries the version it was made to; one over a newer version is refused (`KIT-E-1509`) rather than undoing someone's work |
| The preview | `GET /templates/:id/preview` answers the message as a page of its own, under a policy that runs nothing and loads only https images (`default-src 'none'; ...; sandbox`); the page frames it with `sandbox` as a phone, a desktop or a mail app in dark mode shows it |
| The test | Sent at once, not through the queue, to the signed-in person's own address, from their default bulk sender when they have one, through the active instance and then each failover. It is kept as a message (`email.template-test`), so its delivery reports arrive like any other; a refusal is the answer and the message's row says `failed` with what each provider said. The version is then marked as tested; the next change makes a new, untested version |
| Archive | A template is archived, never deleted, so a send that used it can still show it; it can be brought back |

`createEmail(...).templates.design` hands a template's current or named version to
a send. Every change is audited: `email.template-add`, `email.template-save`,
`email.template-copy`, `email.template-archive`, `email.template-restore`,
`email.template-revert`, `email.template-test`.

## Saved lists

The people bulk mail goes to, kept in D1 as the company's (stage 4 of the bulk sending plan,
`archive/records/2026-10-28-saved-lists.md`), on the page Campaigns, Lists (`/email/lists`).

| Part | What it does |
|---|---|
| Filling a list | From a CSV file (1 MB at most, read only that far even when its length is not declared (`readCapped`, 2026-11-20), read by `readList`: the address column is `email` or one of its usual headings, else one whose heading says email or correo, else the one whose values are mostly addresses; every other column a merge field, the first and last name joined when there is no name column; past 30 columns the address, the name, the first and last name, the files and the columns a message needs are kept first, and the rest are named back as left out) or from addresses typed one a line, with a name before or after (`typedCsv`; also several on a line parted by commas, semicolons or tabs, as a spreadsheet column or an email's To pastes them, `Name <address>` keeping its name). The people there are kept and these added, a repeat updated, or all of them replaced. A list holds 50,000 people at most; each person is one row written |
| Adding contacts, on the page | A list's page has two views, **Contacts** (with its count) and **Add contacts**, and three ways to add as cards in their own colours: **Upload a file** (a drop zone; the kit's frame script reads the chosen file in the browser and shows its name, size, how many contacts and its columns before anything is sent, and warns when no column of addresses is found: `data-file-peek`; **Download a sample CSV** is `GET /lists/sample`), **Paste addresses**, and **From your email**: the people the signed-in person emailed from Compose, most emailed first, who are not on the list yet (`GET /lists/:id/suggestions`: Write's own ranking of their last 100 sent emails, then one read that drops the ones already on it), each ticked, filtered and added with **Select all**; they are posted as typed addresses with the source `people you emailed`. Each way ends with one short block: **Permission to email them** as one pick, a line for another reason only when that is picked, **Fix common typos** as a switch, and the confirmation. A refused form is shown on its own card; a finished import shows the contacts and what it did. The head holds **Send email** (a new campaign to the list, `/campaigns?list=<id>`) and a More menu: Download CSV, Edit name and description, Archive or Restore, Delete |
| The reason they may be mailed | Asked at every import, never assumed: `asked` (they signed up or ticked a box), `customers` (they bought, were told and may leave at any time) or `other` with a note; the page also asks the person to confirm. Each person keeps the reason, who added them and when; the list shows its last import's |
| What an import says | How many were added, updated, repeated in the file and refused, the first twenty refused rows by number (for a file; a paste or typed addresses name the addresses skipped, with no row numbers or CSV words, since 2026-11-15), how many are on the do-not-mail list and the merge fields. Nothing is dropped in silence |
| The do-not-mail list | Read at every send, so a person on it stays on the list, is shown as never mailed with the reason, and the list counts them. The counts are kept on the list and counted again at most every fifteen minutes, so the page of lists reads one row a list |
| Cleaner lists | An import puts a likely misspelling right before anyone is mailed: a domain one key away from Gmail, Yahoo, Hotmail or Outlook (`gmial.com`, `yaho.com`, `hotmial.es`), or an ending that is no top-level domain (`.con`, `.cmo`), becomes the domain meant; a real service one key apart (`ymail.com`, `email.com`) is never touched, and **Keep the addresses exactly as written** (`fix=0`) keeps them all (`likelyDomain`, `src/clean.ts`). The import names each one put right. A shared inbox (`info@`, `sales@`) is counted and marked, and mailed; a no-reply address (`noreply@`, `mailer-daemon@`) is counted, marked and left out of campaigns. Each domain of an import is noted, and the job `email.servers` looks up its mail servers over public DNS, five a run (about 1,400 domains a day; their fetches share a run's fifty outbound calls with every other job), each again after thirty days; once every domain was looked up it sleeps (six hours a run), and a list taken in wakes it; a domain with none, or one that says it takes no mail (RFC 7505), marks its people as never mailed, and the list counts them in `unreachable` beside `barred`. A domain DNS did not answer for is asked again and leaves nobody out meanwhile. A domain with no MX record but an address record is counted as having none, as list cleaners do |
| Finding and tidying | A person is found by the start of their address or part of their name, fifty to a page; one is taken off a list (since 2026-11-15 the row's **Remove** asks first, in a dialog naming the address), or an address off every list for a person who asks to be forgotten. A list is archived and brought back, or deleted with its people |
| A paste that is refused | The box keeps what was typed and the page stays on **Paste addresses**; the words fit a paste: no address was typed, or none of it can be mailed (`KIT-E-1514`, with the first few), or the paste is over 1 MB |
| Downloading | A CSV of the people, their merge fields, their reason and whether they are on the do-not-mail list, for one who holds `email.lists.export` (with a fresh sign-in); every download is audited |

`createEmail(...).lists.people` hands a send its people a page at a time, in address order. Every
change is audited: `email.list-add`, `email.list-update`, `email.list-import`,
`email.list-remove-person`, `email.list-forget`, `email.list-archive`, `email.list-restore`,
`email.list-remove`, `email.list-export`. Each row of one list names it (`name`), and
`email.list-update` says what changed, from what to what (`changes`).
