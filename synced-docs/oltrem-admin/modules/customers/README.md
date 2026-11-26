# @oltrem/customers

Customers: people outside the company who sign in at `/account` to see what is theirs. Staff add
them by address and name; a customer signs in with a six-digit emailed code, no password, never
through the staff door, or by "Continue with" a sign-in service the company uses (OpenID Connect).
Staff see each last sign-in, switch a customer off, end their sign-ins and email them the link.
Every step is audited.

The account page shows a section for each module that declares a customer part, read for the
address the customer proved: forms (their messages and replies), files shared with them, quotes
(accepted there) and invoices.

## Contents

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; the door and Cloudflare Access; signing in; sign-in services; who may do what; the pages |
| [routes](docs/routes.md) | The routes; tables; errors; not built yet; tests |
