# cf-backup

The backup system for the Madagascar Pet Hotel platform: weekly full and daily Supabase
backups to R2, restore drills, key custody, run evidence and a live operations console.
Nothing here is reachable from the internet: cf-admin embeds the console at
`/dashboard/backup` and forwards requests over its `BACKUP` service binding.

## Develop

```bash
npm ci
npm run dev        # http://localhost:5173/dashboard/backup/app/ (local dev Owner)
npm run verify     # typecheck, types, tests, build, build tests, audit
```

## Deploy

Workers Builds is connected: a push to `main` installs dependencies, runs
`npm run verify`, then `npx wrangler deploy`. A red verify blocks the deploy.

## Who can use it

It has no sign-in of its own. A person signs in to cf-admin, and cf-admin's gateway checks that
they may open the Backups page. It then forwards each request over the `BACKUP` binding with an
`x-backup-actor` header naming them, signed with `x-backup-signature` once the optional
`CONSOLE_SIGNING_KEY` is set (`RULES.md` rules 1 and 2).

Inside, every API route needs one capability from a closed catalog. Owner and Vendor support hold
all of them, Admin a read-mostly set, and the other roles none until someone gives them one. The
floors (the backup key, downloading backup data, deleting old runs, changing access, running
or configuring restore tests) can never be given to anyone else (`RULES.md` rule 12). The full model is the plan of
record's `13-access-control.md`; on the docs mirror it is under
`synced-docs/cf-admin/documentation/program/cf-backup/`.

## Design

Start with `main.md`, the contract every contributor and AI agent follows; `docs/README.md`
(private) indexes every document.

`docs/DIAGNOSTICS-PREFLIGHT-STORAGE.md` covers the Health page (until 2026-10-10 the Diagnostics
page) that tests every step of the flow (built 2026-09-24), pre-flight checks that stop a run
before it starts, and a simpler storage layout; its Build log says which stages have shipped. Part A is written for everyone;
Part B for engineers.

To take a complete copy of a Supabase project by hand (every table, settings, Edge Functions
and files, in one encrypted file): `node scripts/full-export/supabase-full-export.ts`, described
in `docs/SUPABASE-FULL-EXPORT.md`.
