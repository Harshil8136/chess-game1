# A client portal, from the Oltrem kit

One client's admin portal: one Cloudflare Worker with one database, one key-value namespace, one
bucket and one queue, built from the kit and this client's configuration. Everything an agent or a
person needs is in [ai.md](./ai.md).

| | |
|---|---|
| Who this client is | `oltrem.config.ts` |
| What the Worker may have | `oltrem.manifest.json`, checked against `wrangler.jsonc` and the code on every verify |
| Who may sign in | The IAM module: the Vendor, then the people the company invites; anyone else past the door reads "No account here". `ACCESS_AUD` names the Access application |
| Who messages come from | `email.from_address` and `email.from_name` (in `oltrem.config.ts` settings, or an Owner's Settings page); providers are connected on Integrations |
| Oltrem Mail | Also sends through Cloudflare and keeps mail sent to the portal's mailboxes (the Worker's `email` handler hands each to Mail, kept in the bucket under `mail/inbox/`); without it the portal sends through its providers and refuses every address. In when `src/mail.ts` wires it, written only by `pnpm exec oltrem mail add` or `mail remove --confirm remove`; `mail status` says where it stands |
| What runs on its own | The tick every minute, at most three jobs a run, and the one Workflow, `KitJobs` on `JOBS`, which the tick starts for the nightly backup |
| Who hears of a problem | A lasting Status problem is an alert to `alerts.recipients`, held in `alerts.quiet_hours` |
| This client's own modules | `modules/`, made by `oltrem new module`, listed in `src/modules.ts`; `oltrem check modules` keeps each within its walls and its migrations adding only |
| The kit's files | The two workflows, `src/index.ts`, the kit's tests and configuration, `ai.md`: never edited here (`oltrem check files`) |
| The kit itself | `kit/`: one packed file per package, named in `package.json` (`file:./kit/...`), so `pnpm install` needs no token; replaced only by `oltrem upgrade --from`. A new client repository comes from `oltrem new client` ([the tool's README](../../packages/cli/README.md)) |
| Every verify and deploy also checks | Only the kit's packages (`oltrem check packages`), no key or id written down (`check secrets`), the Worker's size and startup (`check budgets`), and every page an Owner can reach for names, labels, alt text, unique ids and zoom (`test/a11y.ts`). The Worker is minified with names kept, so errors still name themselves |
| How it deploys | The kit's fleet updates the portal on every kit push ([the fleet](../../docs/reference/fleet.md)). From this repository, a push to `main` runs `pnpm verify` and `oltrem release`: restore point, migrations, deploy, health check, step back on failure (`.github/workflows/deploy.yml`) |
| A job on the live portal | Actions, operations, Run workflow: check the setup, apply waiting migrations, replace a Worker secret, step back the code, restore the database (the last two ask for their name again; `.github/workflows/operations.yml`) |
| Setting it up | `npm run deploy` (`-- --page` for the same in the browser): signs in to Cloudflare, picks the account, asks the client's name (first deploy) and address (a domain of the account or workers.dev), makes the KEK and backup key (kept in `oltrem-keys.txt` for the Vendor to move offline), asks for the ops token through a filled-in form, creates the database, migrates, deploys, health-checks, sets the door (Access by an emailed code), writes the Vendor's address, alert recipients and backup settings, and asks for a yes that the keys file is kept safe. Run again any time; it only adds what is missing. `pnpm run setup` and `pnpm run doctor` check the repository |
| A new kit version | `pnpm exec oltrem upgrade --from <folder>` (the kit's `pnpm kit:pack`), `pnpm install`, `pnpm exec oltrem upgrade` (checks, copies new migrations, prints the notes), then `pnpm verify` and push |
| The reference | `docs/_generated/`, written by `oltrem docs` and checked on every verify |

## On your own computer

`npm run dev` (`scripts/dev.mjs`) runs the Worker with local stand-ins and no Cloudflare account:
it applies the migrations in one database session, gives the Vendor `vendor@example.com`, and serves
<http://localhost:8787> (or the next free port, said out loud). It shows a line per step in
[the kit's look](../../packages/cli/docs/look-in-a-terminal.md#the-look-in-a-terminal), keeps
wrangler's output in `.oltrem/dev.log` until the portal answers, then only its errors. wrangler gets
no keyboard, so a question stops it; the start names a cause it knows (port taken, a sign-in asked
for, the Visual C++ runtime on Windows, missing packages, old Node, full disk, a held file), tries
once more on the next port when that can help, and gives up after two minutes with wrangler's last
lines. A key pasted there is sealed by `.dev.vars`, made on the first run (git ignores it). The
tick runs every minute through wrangler's test route (`LOCAL_TICK_MS`), so sends and jobs go on
here too. `npm run dev -- --mail` or `--no-mail` puts Mail in or out first; what Mail would send
through Cloudflare is logged, never sent, and **Send a test** (or `oltrem mail try`) mails this
portal. In the kit's repository: `npm install`, then `npm run dev` from its root; `npm run update`
gets the newest kit.

Without `ACCESS_AUD` the portal shows its own sign-in page, on `localhost` only: type an address to be
that person. Deployed, that page does not exist and Access is the only door.

**Sharing.** `npm run dev -- --share network` opens it to the same Wi-Fi, `--share tunnel` to
anywhere through a Cloudflare [quick tunnel](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)
(a `trycloudflare.com` address; needs
[`cloudflared`](https://developers.cloudflare.com/tunnel/downloads/), which it offers to download
from Cloudflare's GitHub releases into `.oltrem/bin/`, kept only when it matches the stated SHA-256).
The start page offers both. A gate (`scripts/share.mjs`) on the next port asks once for a code made
at each start (any name, the code as password), refuses an address after ten wrong codes in ten
minutes, and passes requests on as from this computer, so whoever has the code can sign in as anyone
here: share it only with people you trust. On the network the code travels as plain http; on
Windows allow private networks only. Stopping the portal ends the sharing.

**The first run**: sign in as `vendor@example.com` and create the company (its name and the first
Owner's address from `oltrem.config.ts`, else `owner@example.com`); copy the invitation link, sign
out, sign in as the Owner, open the link and accept. Local data is in `.wrangler/`: delete it to
start again.
