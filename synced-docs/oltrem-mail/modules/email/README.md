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
| [using-it](docs/using-it.md) | Using it; settings; templates; sending, the lease and failover |
| [write](docs/write.md) | Write, the Email pages and the composer; what is kept |
| [write-2](docs/write-2.md) | Write's parts: templates and HTML; addresses, sending, files, Sent |
| [senders-and-sending-domains](docs/senders-and-sending-domains.md) | Senders and sending domains; the SPF limit; the simple provider card |
| [senders-and-sending-domains-2](docs/senders-and-sending-domains-2.md) | Delivery reports set up by API; the Addresses page |
| [saved-templates](docs/saved-templates.md) | Saved templates; Saved lists |
| [bulk-mails-pipe](docs/bulk-mails-pipe.md) | Bulk mail's pipe; the allowance; Ready to send |
| [routes](docs/routes.md) | Every route, by area |
| [delivery-reports](docs/delivery-reports.md) | Delivery reports; do-not-mail; health; personal data |
| [tables-and-the-error-codes](docs/tables-and-the-error-codes.md) | The tables and the error codes |
