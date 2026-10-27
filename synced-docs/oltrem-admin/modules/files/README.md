# @oltrem/files

The company's files (the owner's request of 2026-10-27): a drive for each place of the company,
with folders, kept in the client's one bucket. Who may open, change or share a file is never a
list kept on the file: it is the roles held at the file's place, the same roles that decide
everything else in the portal. Give someone a role at a place and its files open to them at once;
end the role and they close. There is no second permission system to keep in step.

## Using it

```ts
import { withPages } from '@oltrem/core-module';
import { createFiles } from '@oltrem/files';
import { pages as filesPages } from '@oltrem/files/pages';

const files = createFiles<Env>({
  bindings: (env) => ({ db: env.DB, bucket: env.FILES }),
  config: settingsFor, // where the two settings below are read
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

Four capabilities, on bit plane `12`: `files.read` sees the places' files and opens them;
`files.write` uploads, makes folders, renames, moves within the place, puts in the trash and
restores; `files.share` makes and ends links; `files.purge` deletes from the trash for good, and
asks for a fresh sign-in. They join every Owner role when the Worker starts.

An item sits at one place (an IAM scope), at its top or in one of its folders. A role held at
that place, or at a place above it, decides what a person may do with it; a role held only at
another place gives nothing. The route checks that the person holds the capability somewhere;
the drive then checks it at the item's own place. An item the person may not see answers as one
that is not there (`KIT-E-0404`), so its name never leaks. An item whose place was removed
belongs to the company.

## Folders, names and uploads

A name is trimmed to one line of at most 120 characters, with no slashes or control characters;
names are unique in a folder whatever their case, among the items not in the trash. Folders go
eight deep at most, and nothing moves into itself or out of its place. An upload whose name is
taken is kept beside the other, numbered (`report (2).pdf`); a folder whose name is taken is
refused.

`POST /uploads` takes the file itself as the body (a `bytes` route), its type from the request's
content type and its name, place and folder from the query. A body of known length streams
straight to the bucket; one without is read up to the limit. The largest upload is the setting
`files.max_upload_mb` (25 by default, 100 at most, the free plan's request limit). The content is
stored under `files/<id>` before the row is written, so a row never points at nothing.

A file is served as a download under its own name, an image in place with `inline=1`, always with
`nosniff` and a sandboxing content security policy: a file never runs as a page of the portal.

## Links that end

A link hands one file to anyone who has it, for one to thirty days, and optionally for a number
of downloads; it is shown once, and the database keeps only its SHA-256. It opens at
`/hooks/files/s/<token>`, past the door, and ends when its day passes, its downloads are used
(one statement counts a download only while the link is good), someone ends it by hand, or its
file goes to the trash. An ended link answers `410` with a line of text. Each download is
audited as `files.share-download`.

## Shared with a customer

When the portal has customers (`@oltrem/customers`), a person who may share a file can also share
it with a customer by their address, for 30 days, 90 days or a year. No link is made: the
customer finds the file under "Files shared with you" on their account page and downloads it
there, signed in, at `/account/open/files/<share>`. The page lists the newest 20 still good;
each download is counted and audited as `files.share-download` by `customers.door`, without the
address. It ends like a link: by hand ("Stop sharing"), at its day, or when the file or a folder
above it goes to the trash (it is back if they are restored before the day). The customer is not
emailed; tell them it is there.

## The trash

Moving an item to the trash hides it and everything inside it, and ends its links. A restore
brings it back to its folder, or to the top of its place when that folder is gone, numbered on a
clash. Only an item in the trash is deleted for good (`KIT-E-2404` otherwise), with everything
inside it, their content and their links. The job `files.empty-trash` runs daily and deletes what
has stayed longer than the setting `files.trash_days` (30 by default), then removes link rows
that ended a month ago.

## The pages

| Path | Shows |
|---|---|
| `/files` | a row of the places the person may see (when more than one), a row for Files and Trash, the folder's path, its folders and files, and for a writer the **Upload a file** and **New folder** sheets |
| `/files/:id` | one item: download or open, its details, an image's preview, rename, move to another folder of its place, its links with their downloads and end, make a link, the customers it is shared with and "Share with the customer" (an address and 30 days, 90 days or a year), trash, restore, and delete for good behind a confirmation |

## Search

The portal's search (`GET /api/files/search?q=`, `files.read`) finds files and folders by name,
folders first, in the places the person's roles reach and never in the trash; it never reads what a
file holds.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /places` | `files.read` | the places the person may see, with each one's files and bytes |
| `GET /items` (`scope`, `folder`, `trash=1`) | `files.read` | a folder or the trash of a place, with what the person may do there |
| `GET /items/:id`, `GET /items/:id/content` (`inline=1`) | `files.read` | one item with its path, links and the folders it may move to; the file itself |
| `POST /folders`, `POST /uploads`, `PATCH /items/:id`, `POST /items/:id/trash`, `POST /items/:id/restore` | `files.write` | make a folder; upload; rename or move; trash; restore |
| `POST /items/:id/shares`, `DELETE /shares/:id` | `files.share` | make a link (`days` up to 30, `maxDownloads`), or with `email` share it with that customer (`days` up to 365, no link); end one |
| `DELETE /items/:id` | `files.purge` | delete from the trash for good |

The hook `GET /hooks/files/s/:token` opens a link. Every change is audited by the module
(`files.folder-create`, `files.upload`, `files.update`, `files.trash`, `files.restore`,
`files.purge`, `files.share`, `files.share-revoke`; the system's `files.share-download` and
`files.trash-empty`), with names and sizes, never content.

The module has no card on Home: Home reads a card without the person, and a count of every file
would tell someone about places their roles do not reach. Its check `files.storage` counts the
files and bytes kept and warns past 8 GB of the free plan's 10 GB bucket, which the backups share.

## Tables

Migration `0019_files.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`files_items` (each file and folder: its tenant, place, folder, kind, name, size, type, who
changed it and when, when it went to the trash) and `files_shares` (each link: its item, the
hash of its token, who made it, when it ends, its download limit and count, when it was ended).
Migration `0040_files_customers.sql` adds the address a share is for (`email`, empty for a link)
and an index on it in lower case, which a customer's account page reads by.

## Settings

| Key | Default | Who changes it |
|---|---|---|
| `files.max_upload_mb` | 25 (1 to 100) | an Owner |
| `files.trash_days` | 30 (1 to 365) | an Owner |

## Errors

The module owns the `2400` to `2499` block: `KIT-E-2401` the name is taken in that folder,
`KIT-E-2402` the file is larger than the setting allows, `KIT-E-2403` that folder cannot hold it,
`KIT-E-2404` only the trash is emptied, `KIT-E-2405` only a file is shared by a link. An item that
is not there or not visible is the core's `KIT-E-0404`; a change the person may not make at the
item's place is the core's `KIT-E-0403`.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company with two
places under it, four roles and five people: the manifest; names; the places each person sees;
a folder and two uploads with the same name numbered; another place's files not found and not
writable; a role given at the place opening its files at once; the download's headers and an
image in place; an upload over the limit refused; a rename and a move, never into itself; links
counted, ended at their limit, by hand, at their day and by the trash; the trash, a restore, and
a delete for good of a folder with its content; the job; every change audited without content;
the storage check; a file shared with a customer for a year without a link, a link over 30 days
and a bad address refused, listed and opened for that address only and in that company only, hidden
while its folder is in the trash and back when restored, gone when ended by hand or at its day,
the newest twenty with more, the download audited without the address. The client template's
screens test runs the pages: an upload from the form, a folder, a move, a link opened and ended by
the trash, and a file shared with a customer who downloads it from their account page.

The search test finds names only in the places a person's roles reach, folders first, and takes `_` as a letter.
