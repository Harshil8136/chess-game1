# cf-backup — Rules

The plan of record is cf-admin `documentation/program/cf-backup/` (also on the public docs
mirror; local copies in `docs/reference/plan-of-record/`). Where this file and the plan
disagree, the plan wins and this file is the bug. Plan doc 12 §7 describes key 4 as built
(the `VAULT_DB` Hyperdrive binding, rule 3) since 2026-09-24.

1. **No public surface, ever.** No route, custom domain, `workers.dev` or preview URL.
   `test/public-surface.test.ts` and `test/build-output.test.ts` enforce it in the Worker's
   configuration; the dashboard side (preview builds off; no Version, Preview or Deployment
   URLs) is checked at deploy time (plan Task B6). The only way in is cf-admin's `BACKUP`
   service binding to this Worker (plan doc 01 §4; doc 02 §4 explains why the binding is
   the trust).
2. **No actor, nothing.** The Worker answers two path families and 404s everything else:
   - `/dashboard/backup/app/` — the console and its API (`…/app/api/`). Every request needs
     a valid `x-backup-actor` header (`v: 1`) from cf-admin's gateway. A bad header is 400
     `bad_actor` and an unknown version 409; cf-backup never answers 401.
   - `/internal/*` — accepts only cf-admin's `backup-tick` system actor.

   The address bar shows `/dashboard/backup/<section>`; cf-admin frames
   `/dashboard/backup/app/<section>`, and the `/app` path is never shown. The local dev
   Owner exists only in `vite dev` on `localhost`.
3. **Keys:** four, none in cf-admin (plan doc 12):
   - `CLOUDFLARE_API_TOKEN` and `SUPABASE_DB_URL`: GitHub secrets, for the runner;
   - `GITHUB_APP_PRIVATE_KEY`: a Worker secret;
   - the Vault login: it lives in the Hyperdrive config `cf-backup-vault`, which the Worker
     reads through its `VAULT_DB` binding with `pg`. Since 2026-09-24 there is no
     `SUPABASE_KEYS_URL` secret and no postgres.js.

   Backups are encrypted with `age` (X25519). The runner holds only the public recipient
   (`BACKUP_AGE_RECIPIENT`, a repository variable); the private keys live in Supabase Vault
   and are revealed only to the Owner or Vendor. Never commit a secret, a `.pem` or
   `.dev.vars`. Enter secrets only at the `gh secret set` / `wrangler secret put` prompts or
   through `scripts/setup/owner-secrets.mjs`. `PERSONAL_PAT` (rule 9) is not a backup key
   and is not one of the four.
4. **Dependencies are a whitelist.** `package.json` is the approved list, with exact pins.
   A new package needs the owner's approval first (plan doc 01 §6).
5. **`npm run verify` before every push.** Workers Builds runs the same command as its
   build step, before it deploys; a red verify is a blocked deploy. In the workspace
   checkout, also run `python .agents/scripts/checklist.py cf-backup --skip-runtime` from
   the workspace root.
6. **Deploy order:** cf-backup first, cf-admin second; roll back in reverse.
7. **Shared infrastructure rules still apply:** cf-backup runs no migrations and registers
   no Cloudflare cron triggers. Its one table, `backup_runs`, is created by cf-admin
   migration `0057` (design D-1). Its settings are `admin_portal_settings` rows with the
   `backup:` prefix (cf-admin RULESAd RULE #0.6–#0.9). The schedule rides cf-admin's
   `backup-tick` job, with one fallback `schedule:` line in `db-backup.yml` (D-4, D-5). A
   daily `tick-deadman.yml` fails when the tick has stopped, so GitHub's own
   failed-workflow email warns through a path the tick does not own. cf-backup sends no mail
   itself: its alerts leave through that job and cf-admin's `EMAIL_QUEUE` (D-11).
8. **Standalone repo.** Do not add cf-backup to the workspace root's npm `workspaces`;
   it must build from a clean clone.
9. **The public docs mirror publishes an allow-list, nothing else.**
   `.github/workflows/sync-docs.yml` copies to `Harshil8136/chess-game1`
   (`synced-docs/cf-backup/`) only the files named in `PUBLISHED_DOCS`
   (`scripts/backup/lib/docs-mirror.ts`): `README.md`, this file, `main.md` and
   `docs/RESTORE.md`.
   - Every other file is private until it is added to that list in a reviewed commit. The
     list says why the rest stays private: `docs/OWNER-SETUP.md` names live account
     identifiers.
   - In a published file, write secret names only. Never a value, an account, project,
     database or certificate id, or a personal email address.
   - `npm run verify` and the workflow both refuse the whole sync when a published file
     holds one of those shapes. Nothing is redacted.
   - Publishing cannot be undone: the mirror's history keeps every copy, so a leak means
     rotating the credential, not editing the file.
   - The workflow's one secret, `PERSONAL_PAT`, must be a fine-grained token with Contents
     read and write on the mirror repository only. It reaches one step of our own shell,
     on `main`, and never an action.
10. **Real data only.** A production build shows only what a real source returns, with its
    provenance:
    - the `backup_runs` row;
    - R2 run evidence;
    - a settings row;
    - GitHub's API (the run report reads the job log);
    - a live read (Usage shows cf-backup's own readings, each with its scope and age).

    Otherwise it shows "not available" with the server's reason. Simulated data exists
    only in `vite dev` on `localhost`, and the build tests prove it absent.
11. **Every response** carries `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options:
    nosniff`, `Referrer-Policy: same-origin`, `no-transform` in `Cache-Control` and, outside
    dev, the CSP. API answers are `no-store`, and `Set-Cookie` is always stripped.
