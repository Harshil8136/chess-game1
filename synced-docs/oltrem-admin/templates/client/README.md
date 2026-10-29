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
| Who its messages come from | `email.from_address` and `email.from_name` in the `settings` of `oltrem.config.ts`, set at onboarding, or by an Owner on the Settings page; the email providers are connected, checked and switched on the Providers page |
| What runs on its own | the five-minute tick (jobs and System health, with the free plan's budgets) and the one Workflow, `KitJobs` on the `JOBS` binding, which the tick starts for the nightly backup |
| Who hears of a problem | a System health problem that lasts is an alert, emailed to the people `alerts.recipients` names, held in `alerts.quiet_hours`; an Owner sets both on the Settings page |
| This client's own modules | `modules/`, each made by `oltrem new module` and listed in `src/modules.ts`, which the Worker mounts; `oltrem check modules` keeps each within its walls and its migrations adding only |
| The kit's own files | the two workflows, `src/index.ts`, the kit's tests and configuration, `ai.md`: never edited here, which `oltrem check files` checks on every verify and deploy |
| What else every verify and deploy checks | only the kit's packages (`oltrem check packages`), no key or id written down (`oltrem check secrets`); verify also measures the Worker's size and startup (`oltrem check budgets`) |
| How it deploys | a push to `main` runs the checks and `pnpm verify`, then `oltrem release`: a restore point, the migrations, the deploy, a health check, and a step back to the version before if the new one does not answer (`.github/workflows/deploy.yml`) |
| A job on the live portal | the operations menu (GitHub, Actions, operations, Run workflow, from `main`): check the setup, apply waiting migrations, replace a Worker secret (its new value first added as a repository secret of the same name, deleted after), step back the code, restore the database; the last two replace what runs, so they ask for their name typed again (`.github/workflows/operations.yml`) |
| Trying it on your computer | `npm run dev`, with no Cloudflare account: [below](#on-your-own-computer) |
| Setting it up | `npm run deploy` from this computer (`npm run deploy -- --page` for the same steps in a page in the browser): it signs in to Cloudflare in the browser, asks which account when the sign-in reaches several, asks the portal's address (the account's domains offered to pick from, or the free workers.dev one), makes the KEK and the backup key (kept in `oltrem-keys.txt` for the Vendor to move offline), asks for the ops token with a link to a filled-in Cloudflare form and checks it on paste, creates the database, applies the migrations, deploys, shows the steps for the door and notices by itself when it is on, then writes the Vendor's address and the backup's settings; run it again any time, it only adds what is missing. `pnpm setup` and `pnpm doctor` check the repository |
| Taking a new kit version | `pnpm install`, then `pnpm exec oltrem upgrade`: it checks first, then copies the kit's new migrations and prints the release notes; then `pnpm verify` and push |
| The reference, never written by hand | `docs/_generated/`, written by `oltrem docs` from the files above and checked on every verify |

## On your own computer

`npm run dev` (`scripts/dev.mjs`) starts this Worker on your computer with local stand-ins for
the database, the key-value namespace and the bucket, and no Cloudflare account. It applies the
migrations to the local database and gives the Vendor the address `vendor@example.com` there,
both without asking anything, then serves the portal at <http://localhost:8787> (the next free
port, said out loud, when another program already holds 8787). The migrations
run in one database session (a few seconds for all of them, where wrangler's own command takes
one session each), and wrangler's own commands run instead should that fail. It shows a line per
step in [the kit's look](../../packages/cli/README.md#the-look-in-a-terminal), keeps wrangler's
output in `.oltrem/dev.log` until the portal answers, then shows only wrangler's errors; Ctrl+C
stops it. While the portal starts, the line under the spinner is wrangler's own latest line (its
routine notices left out); the portal is found at the address wrangler says it is ready on, on
either loopback address. wrangler gets no keyboard, so a question it would ask stops it instead
of waiting unseen. When it stops, the start names the cause it recognises (the port taken, a
sign-in asked for, the Visual C++ runtime missing on Windows, packages missing, an old Node, a
full disk, a file held by another program) and tries once more on the next port when a second
try can get past it; after two minutes without an answer it stops and shows wrangler's last
lines. A provider's key pasted there is sealed with a key of this computer's own, which the
first `npm run dev` makes into `.dev.vars` (git ignores it; delete it and the keys pasted before
no longer open). In the kit's own repository, run `npm install` once, then `npm run dev` from its
root; `npm run update` there gets the newest kit, installs what changed and says what is new.

`ACCESS_AUD` is not set on your computer, so the portal shows its own sign-in page instead of
Cloudflare Access, and only on `localhost`: type an address and you are signed in as that
person. Once deployed, `ACCESS_AUD` is set, that page does not exist, and Access is the only door.

### Sharing it with other devices

`npm run dev -- --share network` also opens the portal to the phones and computers on the same
Wi-Fi, and `npm run dev -- --share tunnel` to anywhere, through a Cloudflare
[quick tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/): a temporary
`trycloudflare.com` address, with no Cloudflare account, which needs
[`cloudflared`](https://developers.cloudflare.com/tunnel/downloads/) installed. The start page
offers both as **Share it on this Wi-Fi** and **Share it anywhere**.

wrangler stays on this computer's own address either way; what is shared is a gate in front of it
(`scripts/share.mjs`), on the next free port after the portal's. Each start makes a new code, shown
where it was started. The browser asks for it once: any name, and the code as the password. The
gate counts wrong codes and refuses an address after ten in ten minutes, takes the code out of the
request and passes it on as if it came from this computer, so the sign-in page above works there
and the forms' checks hold. Whoever has the code can sign in as anyone in this copy of the portal,
as you can here, so share it only with people you trust. Stopping the portal ends the sharing,
the tunnel too. On the network the code travels unencrypted (plain http), and on Windows the first
start asks whether Node.js may use the network: allow private networks only. Without
`cloudflared`, the tunnel choice says where to get it and the portal keeps running here.

The first run:

1. Sign in as `vendor@example.com` and create the company: its name, and the first Owner's
   address (`owner@example.com`, from `oltrem.config.ts`).
2. Copy the invitation link the page shows, then sign out (top right).
3. Sign in as the Owner's address, open the link and accept.
4. Home shows a card per module; the row at the top opens each page.

The local data is kept in `.wrangler/` in this folder: stop the server and delete that folder to
start again. The five-minute tick does not run under `wrangler dev`, so System health says no
check has run yet.
