---
title: "@oltrem/cli: `oltrem deploy [dir]`"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/deploy.ts, door.ts, release.ts, parts.ts, cloudflare.ts]
---

# @oltrem/cli: `oltrem deploy [dir]`

> Part of [the @oltrem/cli README](../README.md). The page form and the start page:
> [`oltrem deploy --page`](oltrem-deploy-dir-2.md).

## `oltrem deploy [dir]`

The first deploy and every later one from a computer (`npm run deploy` in a client repository),
for someone who has never used Cloudflare. Each step looks first and only adds, so a run that
stopped carries on next time. Seven titled steps in
[the kit's look](look-in-a-terminal.md#the-look-in-a-terminal); wrangler's output goes to
`.oltrem/deploy.log`; the last line names the `workers.dev` address. The deployed configuration
never has static assets (`withoutAssets`): Cloudflare does not hand such a Worker the Access
sign-in, so any `assets` entry stops the deploy.

| Step | What it does |
|---|---|
| 1. Sign in | `wrangler whoami`, else `wrangler login`. The account comes from `wrangler whoami --json` (`src/cloudflare.ts`), picked by name when there are several, and goes to wrangler as `CLOUDFLARE_ACCOUNT_ID` for the run, never into a file. |
| 2. Names and people | First deploy only, while `wrangler.jsonc` still names `oltrem-client` and neither that Worker nor its database exists (a network error counts as existing): "What is this client called?" gives the Worker's name (`acme-ltd-portal`: a-z, 0-9, dashes, at most 52 characters so `<name>-events-dlq` fits Cloudflare's 63). Step 5 writes it into the Worker, `CLIENT_ID`, database, bucket, queues and Workflow in `wrangler.jsonc`, the queues in `oltrem.manifest.json`, and `client.id`/`client.name` in `oltrem.config.ts`. A Worker already on Cloudflare keeps its name. Then the Vendor's sign-in email (read from the database when set; Keep, Add another Vendor, Change the Vendor) and who else uses the portal, each as Owner, Staff, Your team or Another Vendor (`name@example.com owner`; no role keeps the current one; new people are Staff). A whole domain is refused. Each gets in at their first sign-in once the company exists (`@oltrem/iam`, "The people named at setup"). |
| 3. The address | Asked once, while `vars.PUBLIC_HOST` is empty and `workers_dev` is off. The account's active domains are offered beside the free address (`portal` by default before a domain). Empty: `workers.dev` (`workers_dev` on). A domain on the account: `PUBLIC_HOST` and a custom-domain `routes` entry. `wrangler.jsonc` is written only once every answer is good. |
| 4. Secrets | Only the `secrets.required` that `wrangler secret list` lacks. The KEK and the backup's age key pair are made here and kept in `oltrem-keys.txt` (git-ignored; an age identity `oltrem backup drill --key` reads), for the Vendor's password manager. `ACCESS_AUD` is set to `worker`. First deploy, when kit/ carries Mail: "Should this portal have Oltrem Mail?" (Not now first; a yes runs [`oltrem mail add`](oltrem-mail.md#oltrem-mail) in step 5). The ops token: a link to Cloudflare's token form with D1 Edit and Account Analytics Read filled in (with Mail also DNS Edit, Email Routing Rules Edit and Email Routing Addresses Edit), pasted without echo, checked with Cloudflare (active, on the account, allowed D1), up to three tries. If the Worker exists but its secrets cannot be listed, the run stops rather than send a new KEK. |
| 5. Database, migrations, deploy | As `migrations apply`, then `wrangler deploy --secrets-file` (the file removed after). Both retried once after 5 s on a passing network or Cloudflare error. Then `watchHealth` (`src/release.ts`): `/healthz` up to six times, 5 s apart; a version that does not answer is stepped back (`stepBack`, `wrangler rollback`) and the run stops; the database stays (migrations only add). On a first deploy a failed check is said and the run goes on. |
| 6. Vendor, alerts, backup, door | The Vendor's address (as `vendor set`); `alerts.recipients`, while empty, to the Vendor and the client's Owner when that is a real address; `backup setup` (a problem is a line to do, the run goes on); the people to `iam.setup_people`. Then the door with Cloudflare's `cf` CLI (pinned in the template): `cf auth whoami`, else `cf auth login`'s device flow (a link and code, shown as printed; `CF_SIGN_IN_MS` 5.5 minutes a try; three tries by itself, then Try again or Skip). `setDoor` writes only what differs: Zero Trust, the One-time PIN login, one policy letting anyone ask for a code, and the Access application with the open paths `/hooks/*`, `/healthz`, `/account`, `/account/*`, `/ui/app.css`, `/ui/app.js`, `/ui/inter.woff2`, `/ui/mark/*` (`DOOR_CLOSED_PATHS` closes the rest of `/ui/*`). Zero Trust not set up shows its one step and waits. A 403 or lapsed sign-in asks again with `--force`. Another Access application on the address is named. Last, a check from outside: the address sends people to `*.cloudflareaccess.com` and `/healthz` answers. When cf cannot set it, the steps by hand are given and the run goes on. `ACCESS_AUD` `worker` trusts the runtime's `ctx.access`; no request header is ever trusted. |
| 7. Modules | Which modules are on, written to `settings.parts_off` as `parts set` does (`partsQuestion` in `src/parts.ts`): every part with its line, group and needs, the parts off now, and the presets Everything, Email only and Only what's always on. Backups is always on. A list `partsRefusal` refuses is asked again. The terminal numbers the parts by group; the setup page shows a dashboard. The portal's Features page changes them later with no deploy. |

After the steps: while `.oltrem/keys-reminder` exists, "Have you put a copy of oltrem-keys.txt
somewhere safe?" (I saved a copy removes it). With uncommitted changes, a line names them and the
git commands to keep them.

Exit `0` deployed and set up, `1` a step failed or an answer was refused, `3` could not start (not
signed in, no `wrangler.jsonc`, an unreadable secrets list).
