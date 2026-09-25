# 05: Options

Constraints: **$0** (Workers Free, Supabase Free, GitHub Actions' 2,000 free Linux minutes a month
shared by 3 repositories), no staging environment by owner decision, and the owner wants speed.

## A. Patch and run again

Fix the three folders, the D1 5-part limit and the CLI role problem, then dispatch another real
backup.

- **Fixes:** the known defects.
- **Cost:** $0. **Effort:** half a day.
- **Risk: high.** This is the loop that has failed five times. The next layer (the drill image
  shim, the drill itself, seal's real upload, the schedule) is found in production, one run at a
  time. **Rejected as the whole answer.** Its fixes are still needed, inside option D.

## B. A rehearsal job ("staging in a box"), keeping the current design

A second workflow runs the **real** `scripts/backup/cli.ts` commands, in order, with the real
programs (wrangler, docker, psql/pg_dump, age), on a GitHub runner, against test resources:

- **D1:** a dedicated test database in the account (the 4th of 10 free), seeded by the job
  with more than 5 tables, a full-text table and a few hundred rows.
- **Postgres:** a local `supabase/postgres` container at the pinned version, seeded from a
  schema-only copy of the live `public` schema (kept in the repository and refreshed by a
  task), including the `auth.jwt()` policy and foreign keys into `auth`.
- **R2:** a separate test bucket with no object locks (or an unlocked prefix), so the rehearsal
  can never touch real backups.
- **age:** a test key pair created by the job itself. The job then **decrypts** what it uploaded
  and compares row counts. This is the restore path that has never been exercised.

It runs when runner paths change, once a week, and by hand.

- **Fixes:** P1, P2 and P4 in [02](02-root-causes.md). Every defect in [04](04-latent-defects.md),
  L1 to L12, is found here and not in production.
- **Cost:** $0 in money. About 4 to 6 minutes a run. Estimate: 30 runs a month is 120 to 180
  minutes.
- **Effort:** 1 to 2 days.
- **Risk:** low. The rehearsal and production share code and differ only in their targets, so the
  target settings (secrets, variables) remain the one untested part. The doctor's new real checks
  (L8) cover that.

## C. Simplify the core (redesign)

1. **Postgres without the Supabase CLI.** `pg_dump` and `pg_dumpall --roles-only` run directly in
   the pinned image, with explicit schemas and no `--role`. This removes one program, one image
   pull and the hidden `SET ROLE`.
2. **Separate backup from drill.** The daily run only exports, compresses, encrypts, uploads and
   writes the manifest: the smallest possible path, which fails only for real reasons. The restore
   drill becomes its own weekly run. It **downloads the latest backup from the bucket and
   decrypts it** with a key held for drills, and so tests what a real restore will do. Today the
   drill restores the plain files before encryption, so it has never proved that a backup in the
   bucket can be restored.
3. **Fail loudly and truthfully:** any step that exits with an error fails the run (L5); no
   empty passes (L6); errors are logged as they happen (L7).
4. **Freeze the add-ons:** the heartbeat, live logs, meters and console views stay as they are, and
   nothing new is added until "done".

- **Fixes:** T5, L1, L3 (with the shim), L4, L5 to L7. It also shrinks the surface for future
  defects.
- **Cost:** $0. Minutes go down: the daily run no longer starts a Postgres container.
- **Effort:** 1 to 2 days on top of B.
- **Risk:** medium, because it changes code paths. It stays low if every change lands only with a
  green rehearsal (option B).

### Drill key for the weekly drill from the bucket

Decrypting in CI needs a private key in CI, and the design keeps the backup key offline. Two
sound ways:

- **(i)** Every backup is encrypted to **two** recipients: the owner's offline key and a drill key
  whose private half is a GitHub secret. The drill uses the drill key. Risk: anyone who can read
  that secret can decrypt backups, so the secret and the bucket must never be reachable together
  with the same credential.
- **(ii)** The drill decrypts nothing in CI. It checks the ciphertext (headers, sizes, checksums
  against the manifest) and restores the plain files as it does today. A person proves decryption
  monthly with the recovery kit.

Default: **(ii)** now (it keeps the key design unchanged), with (i) as an owner decision
([07](07-decisions-for-owner.md), decision 3).

## D. Recommended: B, then C, in small verified steps, then soak

B first (so every change is proven), then C's fixes one at a time, each landing with a green
rehearsal, then one real full backup, then the soak and a real restore by hand. The phases,
acceptance criteria and checkpoints are in [06](06-plan.md).

## E. Considered and rejected

| Option | Why not |
|---|---|
| Supabase Pro ($25/month) for platform backups | Breaks the $0 rule. Its backups also stay inside Supabase (not off-site). |
| Back up as the `postgres` role | Simplest way to include `auth.users`. But the runner's secret could then read the Vault, which holds the key machinery. That is refused by design (doc 12 §5, T25). |
| A second free Supabase project as a restore target | Free projects pause after a week without use, and the 2 active free projects are a scarce slot. A local container gives the same proof at no cost. Kept as a later option for a yearly full rehearsal. |
| `supabase start` (the full local stack) as the drill target | It pulls about ten images and takes minutes on every run. The shim approach gives the same proof for this database. Reconsider only if sign-in accounts must be restored with their sessions and MFA state. |
| Drop Postgres drills entirely | A backup never restored is a hope, not a backup. Weekly is enough. Never is not. |
| Rewrite everything from scratch | The pieces that ran for real mostly worked (doctor, R2, age, D1 export, D1 drill). The failures are specific and fixable. A rewrite would bring back the same untested-path risk. |
