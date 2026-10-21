---
title: "The Vendor's address: oltrem vendor set (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, section 7.4; this repository]
---

# The Vendor's address: `oltrem vendor set`

> **In plain words.** The Vendor is the one account that exists before the client's company
> does, and the first one that can sign in. Its database row is made with no address, so until
> now nobody could sign in to a freshly deployed portal. One command, run once after the first
> deploy, writes the Vendor's address into that row. The address goes in no file.

## What changed

- **`oltrem vendor set <email> [dir]`** (`packages/cli/src/vendor.ts`) reads the Vendor's row with
  `wrangler d1 execute <binding> --remote --json` and writes the address only when the row has
  none. The same address again changes nothing; another one is refused.
- The CLI README and the client template's README say when to run it.

## Decisions

- **After the first deploy, not in `oltrem setup`.** Setup runs before the client's database
  exists; the IAM migrations make the row on the first deploy.
- **In the database, not in a file.** The client file is committed; the Vendor's address is the
  same for every client and is nobody's to read from a repository (R-04).
- **Set once.** Changing the Vendor's address on a live portal moves who holds the Vendor's
  powers, so it belongs to an audited path with the Owners told, not to a setup command.

## How it was verified

- The twelve gates pass locally.
- `packages/cli/test/vendor.test.ts`, four tests on Node with wrangler's D1 command run against
  the IAM module's real migration in SQLite: the empty row written once, on the remote database,
  the address trimmed and lower-cased; the same address again changing nothing; another address
  refused and the first kept; an address with a quote or a space refused before any call; a
  database that cannot answer and one with no Vendor row; the exit codes.
- Not verified here: a run against a real account. The sandbox's first deploy is that run.
