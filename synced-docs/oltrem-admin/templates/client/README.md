# A client portal, from the Oltrem kit

This repository is one client's admin portal: one Cloudflare Worker with one database, one
key-value namespace, one bucket and one queue, built from the kit's core packages and this
client's own configuration. Everything an agent or a person needs to know is in
[ai.md](./ai.md).

| | |
|---|---|
| Who this client is | `oltrem.config.ts` |
| What the Worker may have | `oltrem.manifest.json`, checked against `wrangler.jsonc` and the code on every verify |
| Who may sign in | the IAM module: the Vendor, then the people the company invites; `ACCESS_AUD` names the client's Access application |
| What runs on its own | the five-minute tick (jobs and System health, with the free plan's budgets) and the one Workflow, `KitJobs` on the `JOBS` binding, whose schedules start the nightly backup |
| This client's own modules | `modules/`, each made by `oltrem new module` and listed in `src/modules.ts`, which the Worker mounts |
| How it deploys | a push to `main` runs `pnpm verify`, then applies the migrations and deploys (`.github/workflows/deploy.yml`) |
| Setting it up | `pnpm setup`, then `pnpm doctor` until green; the Worker secrets `docs/_generated/secrets.md` names, which wrangler requires before it deploys; after the first deploy, `pnpm exec oltrem vendor set <the Vendor's address>` once |
| The reference, never written by hand | `docs/_generated/`, written by `oltrem docs` from the files above and checked on every verify |
