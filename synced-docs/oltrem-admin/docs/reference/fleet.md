---
title: "The fleet: every push to the kit updates every client's portal"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/cli/src/fleet.ts; packages/cli/src/choices.ts; packages/cli/src/release.ts; Cloudflare Workers Builds documentation, read 2026-11-11; the owner's choice of 2026-11-11]
---

# The fleet

> **In plain words.** Every push to the kit's `main` updates every client's portal by itself.
> Cloudflare's builder runs once, in the Vendor's own account: the Vendor's test portal first, then,
> when it is healthy, each client in turn from the choices it made at its first deploy. Each update
> saves a restore point, applies migrations, deploys, checks the portal answers, and steps back when
> it does not. A portal that did not update gets a GitHub issue, closed by a later good run.

No client repository and no GitHub Actions minutes are needed. The kit repository is connected once,
to the Vendor's account (a GitHub account should point at one Cloudflare account), and reaches the
clients' accounts with a key. It uses the Vendor's free build minutes (3,000 a month, one build at a
time, 20 minutes each); a portal takes one to two minutes, and an unchanged one is skipped.

## What one run does

1. **Finds the portals**: in every account the key opens, a database `<worker>-db` whose Worker has
   `CLIENT_ID` `<worker>`. Anything else is left alone.
2. **Reads each portal's choices**: the `build_choices` row of its `oltrem_meta`, written by every
   `npm run deploy`; for an older portal, its running Worker's `PUBLIC_HOST` and whether it has
   Mail's sending binding (its name from the Worker's until a deploy records the real one).
3. **Test portals first**: the Workers in `OLTREM_FLEET_FIRST`. If one fails or is not found, no
   client is touched.
4. **Skips what is current**: a fingerprint of `packages`, `modules`, `vendor`, `templates/client`
   and the choices is kept after a good update; a docs-only push updates nobody.
5. **Updates the rest**: copies the client template to `.fleet/`, writes the choices, and runs
   `oltrem release` (restore point, migrations, deploy, health check, step back). The database is
   never stepped back: kit migrations only add (`scripts/migrations.test.mjs`). On a portal's own
   address it then makes sure the zone has the rate-limit rule `oltrem_hooks` (30 calls to `/hooks/`
   in 10 s from one address at one location, refused 10 s at the edge); a zone with a rule of the
   client's own is left as it is (the free plan allows one), and a key without Zone WAF Edit is
   named with the fix.
6. **Links the sign-in service**: finds `oltrem-relay` (workers.dev on) in the accounts the key
   reaches; each portal with its own address and an empty "Sign-in service" setting gets the relay's
   address (history `oltrem fleet`, cached settings cleared); a set value is never replaced. The
   relay's `RELAY_PORTALS` is rewritten only when the portal list changes (`relay_mark`). No relay
   is only said; a relay in two accounts links nothing and turns the build red.
7. **Says how it went**: the accounts reached and any portal-like database passed over, then a line
   per portal (`updated`, `unchanged`, `off`, `held`, `failed`) with its steps, and wrangler's error
   lines on a failed deploy. Red when any portal failed or was held, or none was found. With the
   GitHub token, an issue `Fleet: <worker> did not update` per portal (a comment when open), closed
   by the first run that updates it.

**Kept out**: `autoUpdate` false in `build_choices` (a later `npm run deploy` keeps it); set it true
to return. A repository with modules of its own records them as `ownModules` with `autoUpdate` false,
since the fleet does not build them; it stays on `npm run deploy` from its repository.

## The one-time setup

Nothing is written in a repository; the key lives only in Cloudflare's build secrets.

1. **Be a member of every client's account**: Manage Account, Members, Administrator. An account the
   Vendor cannot open stays on `npm run deploy` by hand.
2. **Have a test portal**: `npm run deploy` from `templates/client` in the Vendor's own account.
3. **Make the fleet key** under My Profile, API Tokens, Custom token (not an account's own API Tokens
   page, which reaches one account only):
   - Account: Workers Scripts Edit, D1 Edit, Workers KV Storage Edit, Workers R2 Storage Edit,
     Queues Edit, Account Settings Read.
   - Zone: Workers Routes Edit, Zone WAF Edit.
   - User: Memberships Read, User Details Read.
   - Account Resources: the accounts with portals, or All (the fleet acts only on portals and
     `oltrem-relay`). Zone Resources: All zones. TTL: at least a year.
4. **Connect the kit once**: Workers and Pages, Create, Import a repository, the kit, project
   `oltrem-fleet`:
   - Branch `main`, root `/`; build `npm install && npm run build`; deploy `npm run oltrem -- fleet`;
     watch paths `packages/*`, `modules/*`, `vendor/*`, `templates/*`.
   - `OLTREM_FLEET_TOKEN` (secret, the key); `OLTREM_FLEET_FIRST` (the test portal's Worker, commas
     for several); optional `OLTREM_FLEET_GITHUB_TOKEN` (fine-grained, Issues read and write on the
     kit only) and `OLTREM_FLEET_REPO` (`owner/name`).
5. **Try it**: Deployments, Retry; the log lists every portal. `npm run oltrem -- fleet --check` with
   the key set says the same from a computer, changing nothing.

**The key** can deploy Workers, change their databases, storage and queues and a zone's rate-limit
rule, and nothing else (not members, billing, DNS or Access). Rotate it yearly, or at once if seen:
a new key with the same permissions, replace the secret, delete the old one. Its row is in the
[token registry](tokens.md).

## Not done yet

- **The door**: an update keeps the portal's Access (the key cannot change it); a door change needs
  `npm run deploy`, so nothing the screens need signed in may sit on a path an older door opened.
- **Client modules**: built only by the client's own `npm run deploy` (above).

Tested with stand-ins in `packages/cli/test/fleet.test.ts`.
