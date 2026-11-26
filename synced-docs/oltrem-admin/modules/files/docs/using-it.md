---
title: "@oltrem/files: using it, who may do what, storage locations"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src/module.ts, drive.ts, stores.ts]
---

# @oltrem/files: using it, who may do what, storage locations

> Part of [the @oltrem/files README](../README.md).

## Using it

```ts
import { withPages } from '@oltrem/core-module';
import { createFiles } from '@oltrem/files';
import { pages as filesPages } from '@oltrem/files/pages';

const files = createFiles<Env>({
  bindings: (env) => ({ db: env.DB, bucket: env.FILES }),
  config: settingsFor,
  send: async (env, message) => { /* optional: tells a customer a file waits; the template queues it with email */ },
});
const modules = [iam.module, withPages(files.module, filesPages) /* , ... */];
```

`createFiles` returns the `drive` functions and the manifest, on the IAM module's sessions,
authorizer and audit wrapper. Its pages come from `@oltrem/files/pages` (JSX checked against the
DOM, `tsconfig.pages.json`), joined with `withPages`; the screens give it **Files** in the Work
group. `src/pages.public.d.ts` is what a Worker-typed client sees, held to the code by
`test/pages-types.ts`.

## Who may do what: the place of a file

Six capabilities on plane `12`, joining every Owner role at start:

| Capability | Lets a person |
|---|---|
| `files.read` | See and open the place's files |
| `files.write` | Upload, make folders, rename, move within the place, trash, restore |
| `files.share` | Make and end links |
| `files.access` (alias `files.access.manage`) | Change who has access, and see everything at the place |
| `files.purge` | Delete from the trash for good (fresh sign-in) |
| `files.limits.manage` | Set room on Files, Limits, for the company (fresh sign-in) |

An item sits at one place (an IAM scope). A role there or above decides; a role elsewhere gives
nothing. The route checks the capability somewhere; the drive checks it at the item's place. An
item the person may not see answers as missing (`KIT-E-0404`). An item whose place was removed
belongs to the company.

**Manage access.** An entry on a folder or file adds to the roles, for a person, group or role, on
the item and all inside it: **None** hides, **View** opens, **Edit** adds upload, folders, rename,
move, trash and links, **Manage** adds Activity, delete for good and access. An entry may be **View
only** (no download through the portal; a screenshot still can) and may end on a day. A
**restricted** folder hides from everyone not listed. A person's level: `files.access` at the place
sees all; else None on the item or above hides; else a restricted folder above not listing them
hides; else the highest of their roles and the entries on the way. Entries widen only within the
route gates (View from another place still needs `files.read` somewhere). A place with no entries
costs two small reads a request. Ended entries go after a month; a purged item's entries go with it.

**Access review** (`files.access`): every entry at the person's locations, soonest to end first,
then no end (500); **Ends within 14 days** and **Ended** filter; **End access** ends the ticked in
one write, each audited `files.access-remove` with `bulk: true`. There is no "Ask for access": on
a hidden item it would reveal that the item exists.

## Storage locations

Each location keeps new files in the portal's bucket (`FILES`, 10 GB free, shared with backups) or
the company's own S3-compatible bucket: Amazon S3, R2 in another account, Backblaze B2, Wasabi,
DigitalOcean Spaces, Supabase Storage (projects joined under Data offered by name), or any endpoint.
**Files, Storage** (`/files?show=storage`; changes are an Owner's): pick the service in a sideways
row, follow its steps, paste bucket, region and key. The key is a storage connection of
[`@oltrem/providers`](../../providers/README.md), sealed and sent only to its saved address.

- **Check.** On Join and each **Check**: list, write a test file, read it back, ask for it without
  the key (must be refused), delete it, read versioning. Six calls, each said in words. Only
  passing connections are offered; choices live in `files.location_stores`.
- **Where a file is.** Its row names its store (`files_items.store_id`), so changing a location's
  choice moves nothing. A copy goes where the location sends files now.
- **Move.** Each press copies up to 10 of a location's files and versions to its current store,
  updates the rows and deletes the old copies (an undeletable one is reported; missing content is
  counted).
- **Bring in.** Up to 100 objects under a prefix become files of a location, read in place: each
  key once, names numbered, empty or folder keys skipped, a program held, room checked first.
  Deleting one for good deletes it from the bucket. Audited `files.store-move`, `files.bring-in`
  and `files.upload` with `broughtIn`.
- **Through the Worker** (`src/stores.ts`): every byte both ways, signed with AWS Signature V4
  (`signV4` from providers), uploads held to their length, `Range` passed on, deletes in thousands.
  The outside bucket's address is never shown and needs no CORS. A refusal is `KIT-E-2410` with
  what the service said; a connection in use is `KIT-E-2411`; the bucket itself is never touched.
