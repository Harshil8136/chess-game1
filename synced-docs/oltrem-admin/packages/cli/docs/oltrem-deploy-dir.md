---
title: "@oltrem/cli: `oltrem deploy [dir]`"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src; split from packages/cli/README.md]
---

# @oltrem/cli: `oltrem deploy [dir]`

> Part of [the @oltrem/cli README](../README.md).

## `oltrem deploy [dir]`

The first deploy and every later one from a person's computer, as one command (`npm run deploy`
in a client repository), for someone who has never used Cloudflare. Each step looks first and
only adds, so a run that stopped carries on the next time. The terminal shows seven titled steps
in [the kit's look](look-in-a-terminal.md#the-look-in-a-terminal) as they happen, each question after what it is and why
it is needed (the door, the ops token); wrangler's sign-in, database and deploy run behind a spinner,
their output in `.oltrem/deploy.log`, and the last line names the `workers.dev` address the deploy
printed. The configuration it deploys never has static assets (`withoutAssets`): the kit's own
`assets` line of 2026-11-03 is taken out, and any other stops the deploy, because Cloudflare does
not hand a Worker with static assets the Access sign-in:

1. **Sign in.** `wrangler whoami`; when it is not signed in, `wrangler login` opens the browser.
   (cf's own sign-in, for the door, comes in step 6.)
   Then the account (`src/cloudflare.ts` reads it from `wrangler whoami --json`): the one the
   sign-in reaches, or, when it reaches several, the one picked from their names. The pick goes to
   wrangler as `CLOUDFLARE_ACCOUNT_ID` for the rest of the run, never into a file, so wrangler has
   no account to ask about later.
2. **The client's name**, on the first deploy only: while `wrangler.jsonc` still names the template
   (`oltrem-client`) and neither that Worker nor its database is on the account (`wrangler
   deployments list`, `wrangler d1 info`; a network error counts as "there", so the name is kept),
   "What is this client called?" (a short name, like Acme Ltd). The Worker's name is made from it
   (`acme-ltd-portal`: lower case, a-z, 0-9 and dashes, at most 52 characters so the longest
   resource name, `<name>-events-dlq`, stays within Cloudflare's 63), and a name already on the
   account is asked again. In step 5 it replaces the template's name everywhere it is a name: the
   Worker, `CLIENT_ID`, the database, the bucket, the queues and the Workflow in `wrangler.jsonc`,
   the queues in `oltrem.manifest.json` (and the generated reference that lists them), and
   `client.id` and `client.name` in `oltrem.config.ts`; the person commits them. A Worker already on
   Cloudflare keeps its name, whatever it is, and nothing is asked: a new name would make a second
   Worker and lose the address. **The sign-in email.** The Vendor's address, read from the database
   when it has one ("you sign in as …"), asked first while it has none or before the first deploy
   has made it. It is written in step 6. Once it is set, "Is that the right Vendor?" offers
   **Keep**, **Add another Vendor** and **Change the Vendor**. **Who else will use the portal**:
   addresses, each as Owner, Staff, Your team or Another Vendor, written in step 6 to
   `iam.setup_people`. In the terminal a role's word follows its address (`name@example.com owner`);
   a row with no role keeps the role the person has, and someone new is Staff, the least power. A
   whole domain (`@example.com`) is refused: the door lets anyone ask for a code, and the portal
   lets in only its own people. Once the Vendor has made the company, each one gets in the first
   time they sign in at the door, with that role (Owner as Owner, Staff as Member, Your team as
   Admin, Another Vendor as a Vendor account holding everything the Vendor holds; `@oltrem/iam`,
   "The people named at setup"). The run's last lines say who signs in first.
3. **The address.** Asked once, while `vars.PUBLIC_HOST` is empty and `workers_dev` is off. When
   the sign-in can read the account's active domains (`wrangler auth token`, then Cloudflare's
   zones list), they are offered as choices beside the free address, and a domain is followed by
   the name before it (Enter for `portal`); otherwise the address is typed. An
   empty answer serves the portal on its free `workers.dev` address (`workers_dev` turned on);
   an address on a domain of the same Cloudflare account becomes `PUBLIC_HOST` and a `routes`
   entry making it the Worker's custom domain. `wrangler.jsonc` is written only once every answer
   is good, just before the database and the deploy; the person commits it.
4. **The secrets** `secrets.required` names, only those `wrangler secret list` does not show. The
   KEK and the backup's age key pair are made here and kept in `oltrem-keys.txt` (git ignores it),
   which the Vendor moves into a password manager: the KEK because a rotation needs it again and
   Cloudflare never shows a secret back, the private key because no copy opens without it. The
   file is an age identity, so `oltrem backup drill --key oltrem-keys.txt` reads it. A run that
   stopped before the deploy uses the keys it kept. `ACCESS_AUD` is set to `worker` with nothing
   asked (step 6 says why). **Oltrem Mail** comes first, on the first deploy only, when kit/ (or
   the kit itself) carries it and the portal does not have it yet: what it adds in a few lines,
   then "Should this portal have Oltrem Mail?", **Not now: today's email** listed first or **Yes:
   add Oltrem Mail**. It is asked here because Mail adds three rights to the key. A yes is
   written in step 5, as [`oltrem mail add`](oltrem-mail.md#oltrem-mail) does it with its `pnpm install`,
   before the migrations, so the deploy carries Mail and its migration. A deploy finds Mail half
   in before it signs in, and stops with the command that finishes it or takes it out.
   The ops token comes after the steps that make it, and without echo: the first step is a link
   to Cloudflare's token form with the name and its two permissions filled in (D1 Edit and Account
   Analytics Read; it has no Access permission, since step 6 sets the door without it). With Oltrem
   Mail the form also chooses DNS Edit, and
   the steps name the two rights Cloudflare's form has no short key for (Zone, Email Routing
   Rules, Edit; Account, Email Routing Addresses, Edit). The pasted key is checked with Cloudflare
   at once (active, on the account or as a person's key, and allowed D1 on the account) and asked
   again, up to three times, with what is wrong; when Cloudflare cannot be reached it is used as
   pasted. With Mail, a key that may not list the account's verified addresses is said in one
   line: the portal goes up all the same, and its Mail setup page checks the domain's rights.
   When the Worker exists but its secrets cannot be listed, the command stops rather than send a
   new KEK, which would leave every stored provider key unreadable.
5. **The database, the migrations** (as `migrations apply` does) **and `wrangler deploy`**,
   carrying the new secrets in a file (`--secrets-file`) that is removed right after. The
   migrations and the deploy are tried once more, five seconds later, when what failed reads as a
   passing network or Cloudflare error (a reset connection, a timeout, a 502). Then the release's
   health check (`watchHealth` in `src/release.ts`, the same reads as `oltrem release`): `/healthz`
   on the portal's address, up to six times five seconds apart. A new version that does not answer
   is stepped back at once to the version that ran before the deploy (`wrangler rollback`, the
   release's `stepBack`), said in plain words, and the run stops there; the database is left as it
   is, which is safe because the migrations only add. On the first deploy there is no earlier
   version: the failed check is said, with a new address's few minutes to start, and the run goes
   on. When something in front of the Worker answers in its place, the new version stays.
6. **The Vendor's address** from step 2, written while the database has none, as `vendor set` does;
   then, while `alerts.recipients` (@oltrem/alerts) is empty, alerts are sent to the Vendor and to
   the client's Owner from `oltrem.config.ts` when that is a real address (not one at `example.com`,
   `.org` or `.net`), written as the portal's Settings would and said in one line; a list someone
   wrote is never changed. Then `backup setup`: a problem there is a line to do (fix it, then `npm
   run deploy` again) and the run carries on, so the door and the modules are still set; then the
   people from step 2, written to `iam.setup_people`; then **the door**, once the deploy has made
   the Worker (an empty account has nothing to protect). It is set with Cloudflare's own command
   line, `cf` (pinned in the template), because wrangler's sign-in cannot reach Zero Trust and a key
   kept for it would be upkeep on every client: `cf auth whoami`, and when cf is not signed in, `cf
   auth login`, cf's device flow: it prints a short link and a code, shown as printed (the look's
   `QUESTION` lets them through, and the setup page shows the link as a button), and opens the
   browser on them; the link works on any device, a phone too, and nothing listens on this computer.
   One try waits at most `CF_SIGN_IN_MS` (5.5 minutes; cf's code lasts 5); a try that fails or runs
   out starts again by itself 10 seconds later with a new link and code, three tries in a row, then
   the person chooses **Try the sign-in again** or **Skip it** (the steps by hand). cf is told the
   account (`CLOUDFLARE_ACCOUNT_ID`). Then `setDoor` reads each part and writes only what differs:
   Zero Trust set up, the One-time PIN login, one policy that lets everyone ask for a code, and the
   Access application on the Worker with the open paths (`/hooks/*`, `/healthz`, `/account`,
   `/account/*`, and the screens' public files `/ui/app.css`, `/ui/app.js`, `/ui/inter.woff2` and
   `/ui/mark/*`). Until 2026-11-11 it opened all of `/ui/*`, which let the screens' own actions
   (`/ui/look`, `/ui/theme`, `/ui/side`) reach the Worker with no one signed in, refused with
   KIT-E-0401; the next deploy closes `/ui/*` again (`DOOR_CLOSED_PATHS`). The fleet cannot change
   Access, so a portal it updates keeps the door it had; the actions sit under `/do/`, which no door
   opens, and work behind either. Zero Trust not set up yet shows its one step (a team name and the
   Free plan) and waits for Enter, checking by itself; a sign-in Cloudflare refuses (403) or one
   that lapsed is asked again (`cf auth login --force`), as someone who may change Access. Another
   Access application on the portal's address, which Cloudflare runs first, is named. Last the door
   is checked from outside: the address sends people to the sign-in (`*.cloudflareaccess.com`) and
   `/healthz` answers without one. When cf cannot set it (not installed, the Worker's id unreadable,
   a refusal after the tries), the reason is said with the steps by hand, and the run goes on.
   Nothing is copied back: `ACCESS_AUD` `worker` makes the portal trust the sign-in the runtime
   vouches for (`ctx.access`), and until the door is on no request carries it, so the portal refuses
   everyone. Who gets in past the door is the portal's own list (`@oltrem/iam`, "The door, and who
   gets in"). A client with a hostname Access application instead sets its tag with `wrangler secret
   put ACCESS_AUD`; the runtime names that application in `ctx.access.aud` too, and no request
   header is ever trusted.
7. **The modules of the portal**: which modules are on, written to `settings.parts_off` as
   `parts set` does. The question (`parts` on the asker, `partsQuestion(off)` in `src/parts.ts`)
   carries every part with its one line, whether it is always on and what it needs, its group as
   the portal's sidebar puts it (Customers, Work, Team, Email, Admin), the parts off now, and
   three presets: Everything, Email only (Email, Integrations and Deployments on) and Only what's
   always on. Backups is always on, since 2026-11-01: no switch or preset pauses the nightly copy,
   and a list stored before that names it leaves it on. The answer is the parts
   switched off, one per line; a list `partsRefusal` refuses is asked again with the reason under
   the question. The setup page shows it as a dashboard (below); the terminal lists the parts
   numbered under their groups, on, off or always on, and takes numbers or names to switch (on
   with what a part needs, off with what needs it), a preset's name, and Enter to use them. The
   portal's Features page switches them later, with no deploy. New keys leave
   `.oltrem/keys-reminder` (git ignores the folder), and while it is there each run, even after
   one that stopped, ends with "Have you put a copy of oltrem-keys.txt somewhere safe?": **I saved
   a copy** removes it, **Remind me next time** keeps it for the next run. Last, when the
   repository is a git repository with changes (`git status`, which leaves out the ignored keys
   file), a line to do names the changed files and the git commands that keep them (`git add -A`,
   `git commit`, `git push` once the repository has its Cloudflare secrets).

Exit `0` when it is deployed and set up, `1` when a step failed or an answer was refused, `3`
when it could not start (not signed in, no `wrangler.jsonc`, an unreadable secrets list).
