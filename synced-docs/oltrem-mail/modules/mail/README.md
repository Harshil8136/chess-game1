# @oltrem/mail

Oltrem Mail, the add-on a client gets when Mail is ticked at setup (docs/plan.md, docs/setup.md
section 2). It adds a way out for the portal's mail besides the email providers: Cloudflare's own
`send_email` binding, tried first for the messages it may carry. On Workers Free it reaches only
the account's verified addresses, so staff mail and alerts go out through Cloudflare for free
while customers' mail keeps its provider; on Workers Paid it may carry customers' transactional
mail too. Bulk mail never takes it (Cloudflare's rule, mail law M-2). A client without the add-on
sends exactly as before. It also brings the inbox (docs/inbox.md): mail to the business's own
addresses kept in the portal, read safely on a phone and answered from the mailbox's address; and
forwarding the way ImprovMX does it (docs/setup.md section 5): aliases to one or several people,
the catch-all, an import of ImprovMX's aliases and a guided move of each domain from ImprovMX,
with Move back.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; The Cloudflare route; Records on Cloudflare; Routes |
| [capabilities-settings-jobs-health](docs/capabilities-settings-jobs-health.md) | Capabilities, settings, jobs, health |
| [inbox](docs/inbox.md) | The inbox |
| [pages](docs/pages.md) | Pages; The tables |
