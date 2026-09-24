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

See `main.md`.
