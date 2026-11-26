# @oltrem/campaigns

Bulk email: a message written in the portal, sent to a list read from a CSV file, in chunks within a
daily limit the email provider's plan allows. Every message carries the one-click unsubscribe Gmail
and Yahoo ask bulk senders for (RFC 8058), and the addresses that unsubscribe, complain or bounce
are kept on the company's do-not-mail list (the email module's, since 2026-10-28) and never sent a
campaign again. A campaign sits at a place of the company, and the roles held there decide who may
read it, write it and send it, as for every other capability. It goes out from one of the email
module's sender addresses, on a domain that passes its check (since 2026-10-28).

Since 2026-10-28 (stage 5 of the bulk sending plan) a campaign is written in a saved template or
as plain text, goes to a CSV file or a saved list, and is sent by an engine that never loses a
message in silence: every five minutes it hands each due campaign's next people to the email
module's bulk pipe in batch calls, as many as the client's Cloudflare plan, the day's limit and
the campaign's own pace allow; a call without an answer is sent again under the same key, or left
to a person to decide; the provider's stops hold the campaign, and three refusals in a row pause
it with an alert. A send to more people than one person may send to alone waits for a second
person's yes. People may be added and taken off while it runs, and its page refreshes its figures
every ten seconds.

Since the same day (stage 6) a sending campaign watches itself: above 0.3% spam reports or 5%
bounces over its latest messages it pauses itself to protect the sender's name; a run that fails
is said on its page and tried again, and the third failure in a row pauses it; Status
says when the timer stops running the campaigns or the provider's reports stop arriving. Once it
is done, the person who started it is emailed how it went, and its page shows the results by
mailbox provider with a download of every person and what became of their message.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; Who may do what |
| [a-campaign-step-by-step](docs/a-campaign-step-by-step.md) | A campaign, step by step: Draft, The list, From, Merge fields, The message, A test, Template, Saved list and more |
| [a-campaign-step-by-step-2](docs/a-campaign-step-by-step-2.md) | A campaign, step by step: Sending, While it runs, Waits and stops, Unclear, Pause, resume, cancel, Run now, Run log, Fields in the message and more |
| [cloudflare-plan](docs/cloudflare-plan.md) | The Cloudflare plan; Leaving the list; The pages; Search; Reports; Personal data |
| [routes](docs/routes.md) | The routes; Health; The warm-up; Tables; Settings |
| [errors](docs/errors.md) | Errors; Not here yet; Tests |
