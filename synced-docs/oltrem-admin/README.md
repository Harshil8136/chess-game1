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

## Getting started

You need a computer with Windows, macOS or Linux and an internet connection. Everything else is
installed for you.

1. **Get the kit.** Clone this repository with git (the easiest way to get updates later), or
   download it as a ZIP from GitHub's **Code** button and unzip it.
2. **Double-click the start file** for your system, in the kit's folder:

   | System | File | The first time |
   |---|---|---|
   | Windows | `start-windows.cmd` | If Windows warns about it, choose **More info**, then **Run anyway** |
   | macOS | `start-mac.command` | Right-click it and choose **Open** |
   | Linux | `start-linux.sh` | Choose **Run** when asked, or run `./start-linux.sh` in a terminal |

3. **Node.js.** The file checks for Node.js 22 or newer. When it is missing, it offers to install
   it (with winget on Windows, Homebrew on a Mac); otherwise it opens the Node.js download page:
   install it, then double-click the file again.
4. **The first install.** The first time, it installs the kit (a few minutes). Its window says
   first what it does: the packages listed in `pnpm-lock.yaml`, downloaded from the public npm
   registry and checked against that file, saved in this folder, with nothing installed for the
   whole computer. Later starts skip this.
5. **Every start checks first.** In a git clone, it looks for a newer kit on GitHub and brings it
   in when this copy has no changes of its own (a copy with its own changes, or with no internet,
   starts as it is and says why). It then installs what the new kit needs, and runs the template's
   checks (`oltrem doctor`, a few seconds), naming any that fail with its fix.
6. **The start page** opens in your browser, with five choices:
   - **Try it on this computer:** the portal at a local address such as <http://localhost:8787>,
     with no Cloudflare account; it opens on a sign-in page that exists only on your computer.
     **Stop it** on the page stops it.
   - **Share it on this Wi-Fi** and **Share it anywhere:** the same, also open on other devices
     behind a code shown when it starts: on your network, or at a temporary Cloudflare address
     (this needs `cloudflared` installed, and no account). See
     [sharing it](./templates/client/README.md#sharing-it-with-other-devices).
   - **Get the newest kit:** fetches what is new (this needs a git clone), installs it and says
     what changed.
   - **Put it on Cloudflare:** signs you in to Cloudflare in the same browser, lets you pick the
     account and the domain, opens Cloudflare's key form already filled in, checks the key when
     you paste it, and notices by itself when the door (Cloudflare Access) is on. Running it again
     only does what is missing.

Keep the window the file opened while you use the page: closing it stops everything. If the page
does not open, the window shows its address, and if no browser opens it within two minutes, the
window asks the same five choices by number. Each step keeps its full output in `.oltrem/`.

Each step says what it is doing while it runs, including what the tool it waits on says right now.
The start page repairs the kit's packages by itself when they are missing or older than the kit;
the portal on this computer moves to a free port when its own is taken, and tries once more when
it stops for a reason a second try can get past. When something still stops, the page says what
and why, and a **Need a hand?** box has **Copy the details**: what ran, on what computer, every
line the page showed and the last lines of each log, with keys hidden, ready to paste to Claude.
The same details are saved in `.oltrem/report.txt`.

### The same in a terminal

With Node 22 or newer, from this folder:

| Command | What it does |
|---|---|
| `npm install` | installs the kit (npm is all you need: it fetches the pnpm version `package.json` names) |
| `npm start` | the start page above |
| `npm run dev` | the portal on this computer; [the client template's README](./templates/client/README.md#on-your-own-computer) walks through the first run |
| `npm run update` | gets the newest kit and says what is new |
| `npm run setup` | puts the portal on Cloudflare with the questions and progress in a page |
| `npm run deploy` | the same, with the questions in the terminal |
| `npm run verify` | the gate every change passes before it is pushed |

## Status and licence

Where the kit stands, phase by phase, is in [docs/README.md](./docs/README.md).

Licensed under the [Oltrem Licence 1.0](./LICENSE), a source-available licence: free for personal
use and for organisations under one million US dollars a year, a commercial licence above that,
and no change to the code without the licensor's permission. [docs/licence.md](./docs/licence.md)
says what that means in plain words. The kit is not open source.
