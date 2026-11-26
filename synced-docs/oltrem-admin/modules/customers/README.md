# @oltrem/customers

Customers: the people outside the company who sign in to the portal to see what is theirs. Staff
add them by address and name; a customer signs in at `/account` with a six-digit code emailed to
them, with no password, and never through the staff door. Staff see when each customer last signed
in, switch a customer off, end their sign-ins when a device is lost, and email them the link to
sign in. Beside the code, a company can offer "Continue with" a sign-in service it already uses,
through OpenID Connect. Every step is in the audit log.

Once signed in, a customer's account page shows their own things: each module of the portal that
declares a customer part adds a section, read for the address the customer proved. The forms
module is the first: the messages they sent and the replies staff sent them. The files module
adds the files shared with them, which they download there, signed in.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; Signing in; Sign-in services; Who may do what; The pages |
| [routes](docs/routes.md) | The routes; Tables; Errors; Not here yet; Tests |
