# Oltrem

A kit for building a client's admin platform on Cloudflare's free plan: one Worker per client
with one of each resource, permissions that are fully dynamic, providers defined as data, and
repositories an AI agent can work in safely. This repository is the kit itself.

- **Working here?** Start with [ai.md](./ai.md), the contract every agent and person reads
  first; [rules.md](./rules.md) holds the rules in full.
- **Following along?** [docs/README.md](./docs/README.md) says where things stand and indexes
  every document; the plan behind the work is linked from there.
- **Checking a change?** `pnpm verify` is the one gate; [what it runs](./docs/reference/verify.md)
  is generated from the gate list.
- **On your own computer?** With Node 22 or newer, two commands from this folder: `npm install`,
  then `npm run dev`, and open <http://localhost:8787>. npm is all you need: the install fetches
  the pnpm version `package.json` names and installs the workspace with it. The portal opens on
  a sign-in page that exists only on your computer;
  [the client template's README](./templates/client/README.md#on-your-own-computer) walks
  through the first run. `npm run update` gets the newest kit and says what is new;
  `npm run deploy` puts the portal on Cloudflare. `npm run verify` runs the gate. It works the
  same on Windows, macOS and Linux.

Where the kit stands, phase by phase, is in [docs/README.md](./docs/README.md). Nothing is
deployed anywhere yet.

Licensed under the [Oltrem Licence 1.0](./LICENSE), a source-available licence: free for personal
use and for organisations under one million US dollars a year, a commercial licence above that,
and no change to the code without the licensor's permission. [docs/licence.md](./docs/licence.md)
says what that means in plain words. The kit is not open source.
