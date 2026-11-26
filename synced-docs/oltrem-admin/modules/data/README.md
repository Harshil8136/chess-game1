# @oltrem/data

Connected data: a client's own databases and data services, read from the portal and, where a
manager turns editing on, changed from it. The data stays where it is; the portal adds the
screens, the permissions, the audit trail and the checks the database lacks.

The **dialects** read each service over its own web API; the **detector** tells which service a
pasted value belongs to; the module adds the permissions, the routes under `/api/data` and the
**Data** pages, mounted beside the providers module. The providers routes refuse a connection of
kind `data`, and the Data routes treat any other kind as not there. With editing on, a row of
Supabase, Neon or Turso can be changed, deleted and undone for 30 days
([Editing](docs/timed-check-and-home.md#editing)).

## Contents

| Part | Sections |
|---|---|
| [permissions](docs/permissions.md) | Permissions |
| [pages](docs/pages.md) | Connecting and the tables; a Supabase project's sections; usage for Neon, Turso and Upstash |
| [routes](docs/routes.md) | The routes |
| [timed-check-and-home](docs/timed-check-and-home.md) | The timed checks and Home; the services; Sign in with Airtable; Editing; hidden and masked columns |
| [a-supabase-project-beyond-its-tables](docs/a-supabase-project-beyond-its-tables.md) | A Supabase project beyond its tables; a database's usage; questions in SQL |
| [what-a-dialect-does](docs/what-a-dialect-does.md) | What a dialect does; finding the service; using it; errors; not built yet |
| [tests](docs/tests.md) | Tests |
