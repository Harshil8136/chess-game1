# @oltrem/screens

The screens of a client portal: a home page with a card per mounted module, a page per module,
the two first-run forms (the Vendor creates the company, the first Owner accepts), and the forms
for people and access. They are rendered on the server with Preact inside the client's Worker,
behind the same door as the API, and work with no script, so a page works on a phone before
anything loads. One small script (`/ui/app.js`) then moves from page to page without a reload.

Every page reads and writes only through the portal's own API, called inside the same request
with the caller's identity headers (`src/api.ts`). The session hook, the permission check, the
schema and the audit run exactly as they do for any other caller, so a screen never shows or
changes more than the API allows. A refusal is shown as a notice in plain words, with what to do.
When the app has core-http's inner call (`INNER_CALL`), `api` answers in process with the page's
own identity instead of sending each call through the whole pipeline again: the same checks run,
and a page is one pass through the pipeline however many calls it makes (core-http's README).

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it |
| [pages](docs/pages.md) | The pages: `/`, `/search`, `/look`, `/notifications`, `/settings`, `/start`, `/setup`, `/accept` and more |
| [pages-2](docs/pages-2.md) | The pages: `/people`, `/access` |
| [pages-3](docs/pages-3.md) | The pages: `/access`, `/providers`, `/email`, `/backup`, `/github`, `/health` |
| [pages-4](docs/pages-4.md) | The pages: `/settings`, `/alerts`, `/audit` |
| [pages-5](docs/pages-5.md) | The pages: Withdraw an invitation (asked first), Send an invitation again, Give the group a role, end one, Paste the key again |
| [pages-6](docs/pages-6.md) | The pages, continued (6) |
| [frame](docs/frame.md) | The frame: A page's reads go together |
| [frame-2](docs/frame-2.md) | The frame: No reloads, The page alone, Live blocks |
| [frame-3](docs/frame-3.md) | The frame: Compose boxes, The composer |
| [stylesheet-and-the-script](docs/stylesheet-and-the-script.md) | The stylesheet and the script; Not here yet; Tests |
