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

## Design

Start with `main.md`, the contract every contributor and AI agent follows; `docs/README.md`
indexes every document.

`docs/DIAGNOSTICS-PREFLIGHT-STORAGE.md` covers the Diagnostics page that tests every step of
the flow (built 2026-09-24), pre-flight checks that stop a run before it starts, and a simpler
storage layout; its Build log says which stages have shipped. Part A is written for everyone;
Part B for engineers.

To take a complete copy of a Supabase project by hand (every table, settings, Edge Functions
and files, in one encrypted file): `node scripts/full-export/supabase-full-export.ts`, described
in `docs/SUPABASE-FULL-EXPORT.md`.
