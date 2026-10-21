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
| Who its messages come from | `email.from_address` and `email.from_name` in the `settings` of `oltrem.config.ts`, set at onboarding; the email providers are listed on the Providers page and added through `/api/providers` until its form exists |
| What runs on its own | the five-minute tick (jobs and System health, with the free plan's budgets) and the one Workflow, `KitJobs` on the `JOBS` binding, whose schedules start the nightly backup |
| This client's own modules | `modules/`, each made by `oltrem new module` and listed in `src/modules.ts`, which the Worker mounts |
| How it deploys | a push to `main` runs `pnpm verify`, then applies the migrations and deploys (`.github/workflows/deploy.yml`) |
| Trying it on your computer | `npm run dev`, with no Cloudflare account: [below](#on-your-own-computer) |
| Setting it up | `pnpm setup`, then `pnpm doctor` until green; the Worker secrets `docs/_generated/secrets.md` names, which wrangler requires before it deploys; after the first deploy, once, `pnpm exec oltrem vendor set <the Vendor's address>` and `pnpm exec oltrem backup setup` |
| Taking a new kit version | `pnpm install`, then `pnpm exec oltrem upgrade`: it checks first, then copies the kit's new migrations and prints the release notes; then `pnpm verify` and push |
| The reference, never written by hand | `docs/_generated/`, written by `oltrem docs` from the files above and checked on every verify |

## On your own computer

`npm run dev` (`scripts/dev.mjs`) starts this Worker on your computer with local stand-ins for
the database, the key-value namespace and the bucket, and no Cloudflare account. It applies the
migrations to the local database and gives the Vendor the address `vendor@example.com` there,
both without asking anything, then serves the portal at <http://localhost:8787>. In the kit's
own repository, run `npm install` once, then `npm run dev` from its root.

`ACCESS_AUD` is not set on your computer, so the portal shows its own sign-in page instead of
Cloudflare Access, and only on `localhost`: type an address and you are signed in as that
person. Once deployed, `ACCESS_AUD` is set, that page does not exist, and Access is the only door.

The first run:

1. Sign in as `vendor@example.com` and create the company: its name, and the first Owner's
   address (`owner@example.com`, from `oltrem.config.ts`).
2. Copy the invitation link the page shows, then sign out (top right).
3. Sign in as the Owner's address, open the link and accept.
4. Home shows a card per module; the row at the top opens each page.

The local data is kept in `.wrangler/` in this folder: stop the server and delete that folder to
start again. The five-minute tick does not run under `wrangler dev`, so System health says no
check has run yet.
