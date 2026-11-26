# @oltrem/data

Connected data: a client's own databases and data services, read from the portal and, where a
manager turns editing on, changed from it. The client
keeps their data where it is; the portal adds the screens, the permissions, the audit trail and
the checks their database lacks. The plan is the owner's of 2026-11-22 (phases 2 and 3 of the
database review, "Connected data").

Built 2026-11-22 in two parts: the **dialects** that read each service over its own web API and
the **detector** that tells which service a pasted value belongs to; then the module itself, its
permissions (two then, four since editing), its routes under `/api/data` and the **Data** pages, mounted in the client
template beside the providers module. The providers routes, held by whoever runs email, refuse a
connection of the kind `data`: they neither make, list nor touch one, and the Data routes treat
any other kind as not there.

Editing came on 2026-11-23 (phase 3, batch 7): once a manager presses **Turn on editing** for a
database, a row of Supabase, Neon or Turso opens on its own page to be changed, deleted (an
Owner alone) and undone for 30 days; see [Editing](docs/timed-check-and-home.md#editing).

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [permissions](docs/permissions.md) | Permissions |
| [pages](docs/pages.md) | The pages: `/data` |
| [pages-2](docs/pages-2.md) | The pages: `/data` |
| [routes](docs/routes.md) | The routes |
| [timed-check-and-home](docs/timed-check-and-home.md) | The timed check and Home; The services; Sign in with Airtable; Editing; Hidden and masked columns |
| [a-supabase-project-beyond-its-tables](docs/a-supabase-project-beyond-its-tables.md) | A Supabase project beyond its tables; A database's usage (Neon, Turso and Upstash); Questions in SQL |
| [what-a-dialect-does](docs/what-a-dialect-does.md) | What a dialect does; Finding the service from what was pasted; Using it; Errors; Not here yet |
| [tests](docs/tests.md) | Tests |
