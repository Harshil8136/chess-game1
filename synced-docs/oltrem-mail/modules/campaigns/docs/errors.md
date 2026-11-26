---
title: "@oltrem/campaigns: Errors; Not here yet; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src; split from modules/campaigns/README.md]
---

# @oltrem/campaigns: Errors; Not here yet; Tests

> Part of [the @oltrem/campaigns README](../README.md).

## Errors

The module owns the `2500` to `2599` block: `KIT-E-2501` not possible at this stage, `KIT-E-2502`
not ready to send (the detail names what is missing), `KIT-E-2503` the list could not be read,
`KIT-E-2504` the list is longer than the settings allow, `KIT-E-2505` an address that
unsubscribed or complained stays on the list.

## Not here yet

- The unsubscribe page speaks English only; its words come from the client later.
- Opens and clicks are the first of each message, not a count of every open; an open by Apple's
  privacy proxy is not counted as a reader's.
- No segments: a campaign brings a file or a saved list. Lists from the records module come with
  automations.
- The mailbox provider is read from the address's domain only; a company domain hosted by Google
  or Microsoft counts under the others.
- A sent campaign keeps its files; nothing removes them yet after a time.
- The watch reads its figures at the start of a run, so it pauses at most one run (50 messages
  on the free plan) after the limit is crossed.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the email module stood
in for (a bulk pipe that records each call and answers as the test scripts it, saved templates and
lists) and its tables real: the manifest; the list (headings as merge fields, bad and repeated
rows); merge fields and fallbacks; the HTML escaped with its links and the one-click headers; a
draft at a place seen and written by the roles there; the list with a suppressed address; what keeps
it from starting; the sender picked, refused to one who may not use it, and a campaign waiting while
its domain fails; a test to oneself; runs within the day's limit, one batch call under a key written
first, and the rest the next day; the stages; the unsubscribe page and its POST, a forged link
refused; the three scopes, Mail me again and a bounce it may not undo; who left a saved list skipped
while a campaign sends and not added from it again; the warm-up's first day, its hold and the next
day's step; the figures from the outcomes and the do-not-mail list; the do-not-mail list's rules;
the audit. The engine: approval asked, refused with a note, withdrawn by a change, never by the one
who asked, given by someone else; a call without an answer sent again under its key; unclear people
and the decision; a run that died half way settled by what the email module wrote; the provider's
stops and the pause after three refusals, resolved on resume; pace, daily cap and sending hours,
overnight and in a time zone; people added from a file and a saved list and taken off while it runs;
addresses typed into a draft and the people you emailed offered without the ones on it; a scheduled
campaign back to a draft, by a sender only, and not once it sends; the room today; the plan's run
size and database writes; a template's version fixed at the start and a new wording version while
paused. Files: one for everyone and each person's own by the address in its name or the list's file
column, the page's count of who has none, each person sent only theirs and who has none skipped,
none added once it is sent, a file over 10 MB sent as a link to download, one taken off and all
removed with the draft. The watch: a run that fails said on its page, tried again and paused at the
third, then resumed and sent; a campaign pausing itself above 0.3% spam reports over 220 reported
messages, its alert and audit, and resumed without reading them again; the summary sent once to the
person who started it; the results by mailbox provider; the download refused to a writer, its file
and its audit; the reports check ok and then warning, and the timer check failing while nothing ran
and ok after a run. `steps.test.ts` holds a draft's four steps: a ready draft, what is missing
sorted into its step with its link, and people without their own file. The client template's screens
test runs the pages: a campaign written, its list uploaded, a sender address added and picked, a
test, the run waiting with no provider and saying so, then a provider connected and the run sending
in one batch call, the live figures, the results by mailbox provider and the download, the summary
waiting in the outbox, **Campaigns today** on the Email home, and an unsubscribe.
