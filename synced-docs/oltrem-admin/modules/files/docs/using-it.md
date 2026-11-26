---
title: "@oltrem/files: Using it; Who may do what: the place of a file; Storage locations"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src; split from modules/files/README.md]
---

# @oltrem/files: Using it; Who may do what: the place of a file; Storage locations

> Part of [the @oltrem/files README](../README.md).

## Using it

```ts
import { withPages } from '@oltrem/core-module';
import { createFiles } from '@oltrem/files';
import { pages as filesPages } from '@oltrem/files/pages';

const files = createFiles<Env>({
  bindings: (env) => ({ db: env.DB, bucket: env.FILES }),
  config: settingsFor, // where the two settings below are read
  // Optional: tells a customer a file waits on their account page.
  send: async (env, message) => {
    await email.send(env, {
      tenantId: message.tenantId,
      template: 'customers.message',
      to: [{ email: message.to }],
      data: { subject: message.subject, text: message.text },
      messageKey: message.key,
    });
  },
});
const modules = [iam.module, withPages(files.module, filesPages) /* , ... */];
```

`createFiles` returns the `drive` functions and the module manifest. It stands on the IAM
module: the same sessions and authorizer, the same audit wrapper. Its pages come from a second
entry, `@oltrem/files/pages`, JSX type-checked against the DOM (`tsconfig.pages.json`), and are
joined to the manifest with `withPages` (`@oltrem/core-module`); the screens then give it a
**Files** section in the sidebar's Work group (`@oltrem/screens`). `src/pages.public.d.ts` is what
a Worker-typed client sees of them, held to the implementation by `test/pages-types.ts`.

## Who may do what: the place of a file

Six capabilities, on bit plane `12`: `files.read` sees the places' files and opens them;
`files.write` uploads, makes folders, renames, moves within the place, puts in the trash and
restores; `files.share` makes and ends links; `files.access` ("Change who has access to folders and
files", alias `files.access.manage`) changes who has access and sees everything at the place;
`files.purge` deletes from the trash for good, and asks for a fresh sign-in; `files.limits.manage`
(held for the company) sets the room for files on Files, Limits, and asks for a fresh sign-in. They
join every Owner role when the Worker starts.

An item sits at one place (an IAM scope), at its top or in one of its folders. A role held at
that place, or at a place above it, decides what a person may do with it; a role held only at
another place gives nothing. The route checks that the person holds the capability somewhere;
the drive then checks it at the item's own place. An item the person may not see answers as one
that is not there (`KIT-E-0404`), so its name never leaks. An item whose place was removed
belongs to the company.

### Manage access

The roles at the place stay the base. An entry on a folder or file adds to them for one person, a
group or a role, on that item and everything inside it, with a level: **None** hides it, **View**
opens it, **Edit** adds upload, folders, rename, move, trash and links, **Manage** adds Activity,
delete for good and changing access. An entry may be **View only** (open and preview, no download
through the portal; a screenshot or the browser's own PDF viewer can still keep a copy) and may
**end on** a day. A **restricted** folder is hidden from everyone not listed on it. The person's
level on an item, in order: whoever holds `files.access` at the place (an Owner among them) sees
everything there; None on the item or a folder above it hides it; a restricted folder above it
that lists the person nowhere hides it; otherwise the highest of their roles' level and the
entries on the way. A group entry reaches its members, a role entry everyone holding that role.

An entry widens only within what the route gates allow: the routes still ask for the capability
somewhere in the company, so View for someone from another place needs a role with `files.read`
somewhere, and Edit or Manage the matching capability somewhere. What was given shows under
**Shared with me**. A place without entries or restricted folders costs two small reads a request;
otherwise the place's folders are read once to walk up from an item. Entries that ended a month
ago are deleted by the trash job; deleting an item for good deletes its entries.

**Access review** (**Files, Access review**, for whoever holds `files.access`) lists every entry at
the locations where the person holds it, the soonest to end first, then those with no end (up to
500), each with its item, location, level, end and who gave it; **Ends within 14 days** and
**Ended** pick them out. Tick entries and **End access** ends them in one write, with an audit row
each (`files.access-remove`, `bulk: true`); one out of reach is refused alone.

There is no "Ask for access" button: offering it on a hidden item would tell the person the item
exists, which None and restricted folders are there to prevent. Someone who needs a hidden file
asks the person who manages the location.

## Storage locations

Each location keeps its new files in the portal's own bucket (`FILES`, 10 GB on the free plan,
shared with the backups) or in a bucket of the company's own at a service that speaks Amazon S3's
API: Amazon S3, Cloudflare R2 in another account, Backblaze B2, Wasabi, DigitalOcean Spaces,
Supabase Storage, or any other by its endpoint (MinIO, Storj, Scaleway and the like). For Supabase
Storage, each project joined under Data is offered by name, and pressing it fills in the project
ref; Bring in then makes the files already in its bucket files of a location. **Files, Storage**
(`/files?show=storage`, shown to whoever holds `files.access`; changes are an Owner's) joins one:
pick the service in a sideways row, follow its steps, paste the bucket, where it is and the key. The
key is a storage connection of the providers module ([`@oltrem/providers`](../../providers/README.md)):
sealed to its row and sent only to the address it was saved for. The email services page and the
providers routes neither list nor touch one.

On Join, and on each **Check**, the portal lists the bucket, writes a small test file, reads it
back, asks for it without the key (it must be refused, or the check says anyone can read the
files), deletes it and reads whether versioning is on (a note: deleted files then stay at the
service until its own rules remove them). Six calls, each said in words and kept on the
connection. A location is offered only connections whose last check passed, and the choice is kept
in the company setting `files.location_stores`. A file stays where it was stored: its row names its
store (`files_items.store_id`, empty for the portal's bucket), so changing a location's choice moves
nothing and old files open as before. A copy goes where its location sends new files now.

**Move** brings a location's old files after its choice: the Storage page says how many files and
earlier versions it keeps elsewhere, and each press of Move copies up to ten to the storage it uses
now, changes their rows, then deletes the old copies (a copy that cannot be deleted is reported,
never lost; content already gone is counted as missing and its row follows). **Bring in** reads up
to a hundred objects under a folder of a joined bucket and makes each a file of a location, read
where it is with no copy: each key once, a name numbered on a clash, an empty or folder key skipped,
a program by its name held for review, and the room checked first. Deleting a brought-in file for
good deletes it from the bucket. Both are an Owner's, and audited (`files.store-move`,
`files.bring-in`, and `files.upload` with `broughtIn` per file).

The Worker passes every byte through itself both ways (`src/stores.ts`): a request signed with
AWS Signature Version 4 (the providers module's `signV4`, handed in by the client), the upload held
to its told length, a `Range` passed on for a video's seek, deletes a thousand at a time with
DeleteObjects. So the rights of this module decide every open, the outside bucket's address is
never shown, and it needs no CORS rule. A service that refuses or fails answers `KIT-E-2410` with
what it said, and an upload it refused leaves no row. A connection is removed only once no location
sends files to it and no file is kept there (`KIT-E-2411`); the bucket itself is never touched.

Not here yet: bringing in the files already in a bucket, and moving a location's existing files
from one store to another.
