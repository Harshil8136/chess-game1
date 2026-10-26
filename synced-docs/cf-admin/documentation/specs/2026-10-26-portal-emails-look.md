---
title: "The portal's emails — one layout for every email written in code"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-26
verified_against: [code]
owner: harshil
related_code: [src/lib/email/layout.ts, src/lib/auth/security-logging.ts, src/lib/access-requests/mail.ts, src/lib/email/templates/invite-template.ts, src/lib/storage/notify.ts, src/lib/storage/share-email.ts, src/lib/retention-email.ts, src/lib/gsc/ops-alert.ts, src/lib/alert-gate.ts, src/lib/health/heavy.ts, src/workers/scheduled-backup-tick.ts, src/pages/api/inquiries/reply.ts, test/email-layout.test.ts]
related_docs: [../features/USER-MANAGEMENT.md, ../security/login-forensics.md, ../features/STAFF-MANAGED-STORAGE.md, ../reference/DESIGN-SYSTEM.md, ../records/reports/2026-10-26-portal-emails.md]
tags: [email, design, accessibility, dark-mode, phone]
---

# The portal's emails — one layout for every email written in code

> **TL;DR (non-technical):** Every email the admin portal writes itself (sign-in alerts, access
> requests and changes, the confirmation code, invitations, file notices, share links, the purge,
> Search Console, platform and backup alerts, the System health test and the reply to a website
> inquiry) now has one look: a white card on a soft grey page, a coloured strip and a small label
> that say what kind of email it is, a clear heading, the details as a list, one button, a box
> that says what to do if something is wrong, and a footer that says why it came. It fits a
> phone, keeps its colours in mail apps set to dark mode, and needs no pictures to look right.

Asked for by Harshil on 2026-10-26: "All email templates that are hard coded like invite new user
and all. Can you review and make it better visually, informative wise and all aspects!"

## 1. What every email has, top to bottom

| Part | What it is for | Field in `renderEmail` |
|---|---|---|
| Coloured strip | The kind of email at a glance: green for the portal, blue for information, darker green for good news, amber for "needs you", red for urgent | `tone` |
| Brand | A green "M" mark and "Madagascar / Pet Hotel · Admin portal" (for guests: "Hotel para Mascotas"), drawn with text, not an image | `frame` |
| Label | A few words in a pill above the heading ("Sign-in alert", "Invitation", "Urgent"), so the colour is never the only signal | `label` |
| Heading | One line that says what happened | `title` |
| Intro | One or two short paragraphs | `intro` |
| Why | A quieter line saying why this one was sent ("Every sign-in to this account is emailed.") | `why` |
| Code, meter or text | A code to type, shown large; how full something is; a block kept as written (a reply, an alert's text) | `code`, `meter`, `message` |
| Details | Label above value, one per row, so a long address wraps on a phone instead of squeezing a column | `rows` |
| Steps | Numbered steps when the reader has something to do (how to sign in, how to make room) | `steps` |
| Button | One action, a filled cell that shows with images and styles off; red only when the email is urgent | `button` |
| Link | The address written out, or a second way | `link` |
| Box | What to do if this was not expected | `note` |
| Footer | Why the reader gets this email, where to change it, who sent it | `footer`, `footerLinks` |

The inbox preview line (`preheader`) is set on every email, so the line after the subject in the
inbox says something useful instead of "Madagascar Pet Hotel · Admin portal".

## 2. How it is built for mail apps

Mail apps read a small, old part of HTML, and each drops a different part of it. So:

- **Tables and inline styles.** Every colour and size is on the element itself. Nothing depends
  on a class to look right, so a mail app that strips `<style>` (several do) still shows the
  design. Every layout table is `role="presentation"`, so a screen reader does not read it as data.
- **Fluid up to 600 px.** The card is `width:100%` with `max-width:600px`; Outlook on Windows,
  which ignores `max-width`, gets a 600 px table of its own inside a conditional comment. Nothing
  else has a fixed width, so on a phone the card is the phone's width.
- **Two style blocks.** The first narrows the padding and widens the button below 620 px. The
  second holds the dark-mode colours (`prefers-color-scheme: dark` for Apple Mail and others,
  `[data-ogsc]` for Outlook.com). A mail app that throws away a block it does not understand keeps
  the other one. Gmail reads neither dark rule and may invert the light design itself, which the
  colours were picked to survive.
- **No images, flex, grid or gradients.** The brand mark is a coloured cell with a letter, the
  button a filled cell, the meter two cells. A mail app that blocks images by default (Outlook,
  many work accounts) shows the email as designed. The hotel's logo was left out on purpose: the
  portal's own address sits behind Cloudflare Access, and the public website's bot rule already
  refuses some automated clients (it answers the CI probe with a 403), so a hosted logo could show
  as a broken picture.
- **Reader settings.** `viewport`, `x-apple-disable-message-reformatting`, `format-detection`
  (so iOS does not turn times into links) and `color-scheme` / `supported-color-schemes`.
- **Small.** A full email is about 8 to 12 KB; Gmail cuts an email at 102 KB.

## 3. Colours and contrast

Each pair measured with the WCAG contrast formula on 2026-10-26; normal text needs 4.5:

| Pair | Light | Ratio | Dark (mail apps in dark mode) | Ratio |
|---|---|---|---|---|
| Heading and values | `#0F172A` on `#FFFFFF` | 17.9 | `#F1F5F9` on `#111827` | 16.2 |
| Paragraphs | `#334155` on white | 10.4 | `#CBD5E1` on `#111827` | 12.0 |
| Row labels | `#475569` on white | 7.6 | `#A3B1C6` on `#111827` | 8.2 |
| Footer | `#64748B` on white | 4.8 | `#A3B1C6` on `#111827` | 8.2 |
| Links | `#3D7300` on white | 5.8 | `#A3E635` on `#111827` | 11.8 |
| A failure reason | `#991B1B` on white | 8.3 | `#FCA5A5` on `#111827` | 9.4 |
| Button, portal green | white on `#4A8000` | 4.8 | (unchanged) | 4.8 |
| Button, urgent red | white on `#B91C1C` | 6.5 | (unchanged) | 6.5 |
| Labels (pills) | `#365314` on `#ECFCCB`, `#075985` on `#E0F2FE`, `#166534` on `#DCFCE7`, `#92400E` on `#FEF3C7`, `#991B1B` on `#FEE2E2` | 6.4 to 8.1 | (unchanged) | 6.4 to 8.1 |

The green is the website's own primary (`--color-primary: #4a8000` in cf-astro), so the portal's
emails and the hotel's site read as one business. Text is 16 px with 24 px lines, row labels and
the footer 13 px, the label pills 12 px bold capitals; nothing is smaller. The button is 48 px
tall, above the 44 px a thumb needs.

## 4. Each email's tone and label

| Email | Tone | Label | Button |
|---|---|---|---|
| New sign-in, your own sign-in, test alert | success | New sign-in, Your sign-in, Test | Review sessions |
| A refused sign-in | danger | Sign-in refused | Review sessions |
| A sign-in that moved, a sign-in without Google | danger | Urgent | Review sessions (red) |
| Sign-in alerts turned down | warning | Alert settings | Review sessions |
| Access request | info | Access request | Review the request |
| Access approved, declined | success, brand | Approved, Declined | Open the page (approved only) |
| Access change, daily summary | info | Access change, Daily summary | Open the activity log |
| A change needs a second person | warning | Needs your approval | Review it on Users |
| The asker's outcome | success, brand or warning | Approved, Declined, Not made | Open Users |
| Audit log sealed, a sealed day changed | success, danger | Audit log, Audit log warning | Check the seals |
| Unused accounts, access review due | warning | Unused accounts, Access review | Open Users, Start the access review |
| Confirmation code | brand | Confirmation code | none: the code is the point |
| Invitation | brand | Invitation | Open the admin portal |
| Files space nearly full | warning | Files | Open Files |
| A share link ends soon, a file request complete | info, success | Files | Open Files |
| A file shared with a vendor | brand | Shared file | Download the file |
| Data purged, a purge refused | warning, danger | Data purged, Purge refused | Open Data Retention, Open the activity log |
| Search Console alert | danger | Search Console sync | Open Search and SEO |
| Platform alert | by severity | Platform alert: critical, Test alert | Open System health |
| System health test | success | Test | Open System health |
| Backup alert (fallback design) | brand | Backups | Open Backups |
| Reply to a website inquiry | brand, in Spanish, as the hotel | none | none: the reader replies |

## 5. The words

- **Plain sentences, the page names the sidebar uses.** Files, not "Staff Storage"; Data
  Retention; Search and SEO; System health; Sessions.
- **Say why it came.** Every footer says why this address got this email: the alert list, a copy
  the holder asked for, a request the reader made, a button they pressed.
- **Times say their zone.** A sign-in prints in its own zone, everything else in UTC, named
  (`alertTime`). The share-link email used to print a time with no zone.
- **The invitation tells the truth about signing in.** It says to choose Google and pick the
  invited address, and that no other address is let in. It no longer suggests a one-time passcode:
  that is the emergency way in, and using it emails the owner as urgent
  ([sign-in without Google](../features/CFZT-EDGE-AUTHENTICATION.md)). It names the inviter as
  "Name (address)" instead of the start of their address, and the role by its label and what it
  is for.
- **Subjects of the alerts stay as they were.** The sign-in, platform and Search Console alert
  subjects keep their wording, emoji included, because inbox filters may match them. Only two
  subjects changed: the invitation ("Madagascar Pet Hotel admin portal") and the purge alert,
  which said "0 row(s) from SECURITY ALERT: Unauthorized Purge Attempt" for a refused attempt and
  now says "Refused data purge by …".

## 6. Escaping and links

Every string is passed as plain text and escaped once, in `escapeHtml` (`& < > " '`). No caller
passes HTML any more: the storage notice took a `bodyHtml` its callers escaped themselves, and the
guest reply wrapped the name in `<strong>`. A link is kept only when it starts with `http://` or
`https://`; anything else (`javascript:`, `data:`) drops the button.

## 7. Decided against

- **A hosted logo image** (§2): a broken picture is worse than a text mark.
- **A dark-only design**, as the invitation had: unreadable where a mail app forces light, and
  heavy where it does not. Light first, with dark colours where the mail app asks for them.
- **Emoji as icons in the body** (🏨, 📍, ✓ in a circle): they render differently on every
  phone, and screen readers read their names aloud.
- **A templating library or web fonts**: no new dependency (RULESAd §7.3) for what a hundred
  lines of string building does; system fonts load instantly everywhere.
- **Moving these emails into the email service's stored templates** (cf-email-consumer): their
  content is built from live values in cf-admin, and a stored template would split one email
  across two repositories.

## 8. Not covered

- The email service's own templates (the booking emails, the backup `notice` template) live in
  cf-email-consumer and its database, not in this repository's code.
- The review invitation (`src/lib/seo/review-loop.ts`) is dropped by the email service by design
  while guest review mail is off, so it was left as it is.
- The Email Portal's composer sends what staff write.
