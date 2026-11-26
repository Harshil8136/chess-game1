# @oltrem/email

Email as the kit sends it (plan sections 8.1 and 8.2). A message is asked for once, rendered
from a typed template and checked at once, so a mistake is the caller's answer and never a
failed send later. The outbox and the queue carry it to `deliver`, which sends it through the
tenant's active email instance from `@oltrem/providers` and, when that one refuses, through each
failover in order. The kit keeps its own lease per message key in D1, so a message the queue
brings twice is sent once whatever the provider promises. The company's sending domains and the
sender addresses on them live here too: who may send from which address, and whether a domain
is set up well enough for bulk mail; and the company's saved templates and lists, the designs
bulk mail is written with and the people it goes to.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; Settings; Templates; Sending, the lease and failover |
| [write](docs/write.md) | Write |
| [write-2](docs/write-2.md) | Write: The template picker, A letter, A design, Fields, Write in HTML, The composer's HTML, Preview, Address suggestions and more |
| [write-3](docs/write-3.md) | Write, continued (3) |
| [senders-and-sending-domains](docs/senders-and-sending-domains.md) | Senders and sending domains: Which address each kind of mail comes from, A sending domain, The check, Passing, Ready for Gmail, Yahoo and Outlook, Read from the provider, Another address, from Write, A sender address and more |
| [senders-and-sending-domains-2](docs/senders-and-sending-domains-2.md) | Senders and sending domains: Delivery reports, registered by themselves, Add an address, **Addresses** (the first), **Domains**, **Kinds of mail**, Cancel |
| [saved-templates](docs/saved-templates.md) | Saved templates; Saved lists |
| [bulk-mails-pipe](docs/bulk-mails-pipe.md) | Bulk mail's pipe; Allowance; Ready to send |
| [routes](docs/routes.md) | Routes: Confirm it's you |
| [routes-2](docs/routes-2.md) | Routes, continued (2) |
| [delivery-reports](docs/delivery-reports.md) | Delivery reports; The do-not-mail list; Health; Personal data; Not here yet |
| [tables-and-the-error-codes](docs/tables-and-the-error-codes.md) | The tables and the error codes |
