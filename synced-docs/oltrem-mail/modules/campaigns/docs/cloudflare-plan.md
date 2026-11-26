---
title: "@oltrem/campaigns: The Cloudflare plan; Leaving the list; The pages; Search; Reports; Personal data"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src; split from modules/campaigns/README.md]
---

# @oltrem/campaigns: The Cloudflare plan; Leaving the list; The pages; Search; Reports; Personal data

> Part of [the @oltrem/campaigns README](../README.md).

## The Cloudflare plan

The client's plan is the setting `health.cloudflare_plan` of Status (free or Workers
Paid), and the run follows it: on the free plan a run hands out 50 messages at most and makes at
most 40 calls to the provider (50 outside calls a run, 10 kept for the rest), and it stops before
the database writes left today run out (about ten rows written a message, measured by System
health when the operations token is set); on Workers Paid a run hands out up to 1,000 messages
and makes up to 9,990 calls, and writes past the plan's monthly allowance are billed, not
refused. `GET /room` and the **Room today** panel show what is left today: the messages under the
daily limit, the database writes and the messages they leave room for, the run size, and the
events queue's backlog.

A run never hands the provider more than it says is left (`left` from the email module's
`bulk.route`): past its allowance some providers drop the mail. When it says none are left, the
campaign waits with words such as "Resend says no emails are left today; it goes on at 2026-10-29
00:00 UTC", until the time the provider gave, or tomorrow when it gave none.

## Leaving the list

Every message carries `List-Unsubscribe` and `List-Unsubscribe-Post: List-Unsubscribe=One-Click`
headers, and a link in its footer, to `/hooks/campaigns/u/<token>`, outside the door. The token is
the person's row and an HMAC of it under the campaign's own random secret, so a link cannot be made
up and nothing secret is sent. Opening the link shows a page that asks, because mail scanners open
links; nothing changes until a button is pressed. The page offers three scopes (mail law M-4), each
one press:

| Button                             | What it does                                                                                                                                                                                          |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Only “the list's name”**         | Shown when the campaign came from a saved list. A mark in `email_list_left`: the person stays on the list, is skipped by any campaign still sending from it, and is not added from it again.           |
| **All campaigns** (the main button) | The do-not-mail list as `unsubscribed`, for bulk mail only. A mail app's one-click `POST` (RFC 8058) does this one.                                                                                     |
| **Every email**                    | The do-not-mail list as `unsubscribed` for every message; a later "all campaigns" never narrows it.                                                                                                     |

Each says what it did and offers **Mail me again**, which takes back the person's own choices (the
`unsubscribed` row and their list marks) with no one at the company needed; a bounce, a spam report
or an address added by hand is not the person's to undo, and the page says the address stays off.
Each press is audited as the system's `campaigns.unsubscribe` with its scope, or
`campaigns.resubscribe`. A test message's link only says it was a test.

The list is the email module's `email_donotmail` (its README says who is put there and what each
reason stops): the delivery reports add bounces for good, three temporary bounces in 30 days,
refusals by the provider and spam reports the moment they arrive, for every message the portal
sends, so the hourly `campaigns.listen` job of before is gone. Messages a campaign hands out are
marked as bulk mail. On the page an Owner may add addresses by hand (bulk mail only) and take off
one that was added by hand, bounced or refused; an unsubscribe or a complaint stays for good
(`KIT-E-2505`): that person signs up again through a form of the company's.

## The pages

| Path                         | Shows                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/campaigns`                 | a row of stages (all, drafts, scheduled, sending, sent, archived) and **Never mailed**; **New campaign** for a writer, with a row of places when there is more than one; **Archive finished** and **Delete blank drafts** with their counts, each asking first; the campaigns of the places the person may see; then (since 2026-11-11, the list first on a phone) **Blank CSV template** and **Room today** (messages left, database writes, the events queue, the run size) |
| `/campaigns?show=suppressed` | the do-not-mail list, found by part of an address, with **Add addresses** and **Take off**                                                                                                                                                                                                                                                |
| `/campaigns/:id`             | the stage and the address it goes out from; the approval it waits for, with **Yes, send it** and **No, send it back** and a note for whoever may approve; under the title a row of chips (the stage, the location, who started it and when, the address it goes from, the wording version and who approved it, each with its icon); on a draft, **Four steps to send it** (since 2026-11-15 two by two on a phone, and the last says which step it waits for ("Waiting for step 2.") with that step's link, **Choose a sender** for a sender; since 2026-11-08; four cards, each with its icon, its state in colour (done in green, the first one open marked **Next** in the primary colour, one that needs something with **Needs you**, the last **Later**) and a bar of how many are done, a press opening that step): who gets it, what it says and from whom, check it, when it goes, each done or what it still needs with a link to where it is done; the steps are also a row of tabs and a draft shows one step at a time (`?step=who`, `what`, `check`, `send`), opening on the first that still needs something, with **Next** at its foot; a missing campaign footer is written in step 3 itself (**Save the footer**, saved to the `campaigns.footer` setting by whoever may change it), not looked for in Settings; the commands (send me a test, send it or ask to send it, **Back to draft to change it** while it waits for its start time, pause, resume, cancel, delete the draft, **Archive** or **Take out of the archive** once sent or cancelled); **Run now** for whoever holds `campaigns.run`; the progress (people, sent, unclear, failed, today against the limit, the next run's size, the **Run log**, why it waits, when it should be done), refreshed every ten seconds while it sends; the unclear people and the three decisions; delivered, clicked, problems and who left the list; **From**; **Message** (a template or plain text, while a draft or paused); over the preview, which of Gmail's tabs it will most likely reach and why (**Gmail will most likely put this under Promotions**, or **It reads like a letter**); the preview; **Pace** with the sending hours as a row of days; the list from a file or a saved list, or **Add people** and **Take people off** while it runs; **Files**, with whom each goes to and how many people have none of their own; the first hundred people with a row of their states, unclear among them. Since 2026-11-15: a refused **Save** of the message draws the name, subject and words that were typed; **Send me a test** says it is on its way only when `/api/email/ready` answers ready, otherwise that it is queued for the person's own address, with the Delivery log and Email settings; a large send whose starter is an Owner or the Vendor nobody else here may approve is **Send it** (the dialog says their yes is recorded as the approval), and one already asked shows **Waiting for your yes**; the last step with no Send for this person says why (what is missing, or that someone who may send campaigns at this location sends it); with no address to pick, **From** names each address and the domain whose check it waits for, linked to that domain; the sending hours name the time zone they are read in; deleting a draft says the saved list it came from stays under Lists |
| `/campaigns/:id` (sent)      | after the figures, **By mailbox provider**: Gmail, Microsoft, Yahoo and AOL, Apple and the others, with the people, sent, delivered, opened, clicked, bounced, spam reports and who left, read from each address's domain (on a phone card: sent, bounced and spam); **Download the results** for whoever may send; ten minutes after the last run with no delivery, open, click, bounce or spam report back for any of its messages, a notice above the figures says the email service took them but the portal has not heard what became of them, with **Register delivery reports** (`/email/connect#reports`, one press there) and where to look meanwhile (the service's own list, the Spam and Promotions folders) |
| `/campaigns/:id/live`        | the progress alone: what an open campaign page fetches every ten seconds (one row read) and swaps in place, through the frame script's `data-live` blocks |

## Search

The portal's search (`GET /api/campaigns/search?q=`, `campaigns.read`) finds campaigns by name, at
the places the person may see, with their state.

## Reports

The section on the Reports page's Email tab (`GET /api/campaigns/report?days=&to=`,
`campaigns.read`, 2026-11-26): the people campaigns were handed to in the period against the period
before, one line a day, the share that opened and clicked once a provider has reported an open, the
unsubscribes, and each campaign with its own shares, at the places the person may read.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers each campaign
the address was on, with the name and merge fields it
was sent with, its state and when it was sent; the email module answers the address's row on the
do-not-mail list. The Campaigns page is linked. A campaign's files (an invoice, a statement) are
personal data too: they stay with the campaign in the client's bucket, reached only by a link
that lasts a day, and go when the draft is deleted.
