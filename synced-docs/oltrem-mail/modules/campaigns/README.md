# @oltrem/campaigns

Bulk email: a message written in the portal, sent to a list read from a CSV file, in chunks within a
daily limit the email provider's plan allows. Every message carries the one-click unsubscribe Gmail
and Yahoo ask bulk senders for (RFC 8058), and the addresses that unsubscribe, complain or bounce
are kept on the company's do-not-mail list (the email module's) and never sent a
campaign again. A campaign sits at a place of the company, and the roles held there decide who may
read it, write it and send it, as for every other capability. It goes out from one of the email
module's sender addresses, on a domain that passes its check.

A campaign is a saved template or plain text, sent to a CSV file or a saved list by an engine that
loses nothing in silence: every five minutes it hands each due campaign's next people to the email
module's bulk pipe, within the Cloudflare plan, the day's limit and the campaign's pace. An answer
that never came is resent under the same key or left to a person; three refusals in a row, or spam
and bounces past the providers' limits, pause it with an alert. A large send waits for an approver,
or the Owner's own yes when nobody else may. When done, the starter is emailed how it went.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; who may do what |
| [a-campaign-step-by-step](docs/a-campaign-step-by-step.md) | Writing a campaign; sending it |
| [cloudflare-plan](docs/cloudflare-plan.md) | The Cloudflare plan; leaving the list; the pages; search, reports, personal data |
| [routes](docs/routes.md) | Routes; health; the warm-up; tables; settings |
| [errors](docs/errors.md) | Errors; not built yet; tests |
