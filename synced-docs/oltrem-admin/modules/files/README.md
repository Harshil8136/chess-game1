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
taken is kept beside the other, numbered (`report (2).pdf`); the numbers it could take are asked
about in one query (2026-11-13; before, one query a number, up to 50). A folder whose name is
taken is refused.

`POST /uploads` takes the file itself as the body (a `bytes` route), its type from the request's
content type and its name, place and folder from the query. A body of known length streams
straight to the bucket; one without is read up to the limit. The largest upload is the setting
`files.max_upload_mb` (25 by default, 100 at most, the free plan's request limit). The content is
stored under `files/<id>` before the row is written, so a row never points at nothing.

A file is served as a download under its own name, an image in place with `inline=1`, always with
`nosniff` and a sandboxing content security policy: a file never runs as a page of the portal.

### What kind of file it is, and the room each person has (2026-11-21)

An upload's first 16 bytes are read before it is stored, as well as its name (`src/kinds.ts`): the
common shapes of a program, a document, a picture, sound or video, and an archive are known by
their bytes. A program dressed as something else (a Windows, Linux or Mac program, or a script
that names what runs it, saved as `photo.jpg` or `notes.txt`) is refused whatever the settings say
(`KIT-E-2406`); under a program's own name it is kept, unless the setting narrows the kinds. The
setting `files.allowed_types` is `any` by default, so a portal keeps taking what it took; set to
`documents and pictures` or `documents`, a file is kept only when its bytes show one of those kinds
and its name fits that kind (`KIT-E-2407`). A file of no shape the bytes show (plain text, CSV) is
judged by its name alone.

The setting `files.person_room_mb` gives each person that much room, counted over the files they
uploaded, the trash included, in every place (0, the default, is no limit). An upload that would
pass it is refused before it is stored when its length is known, and removed again when it is not
(`KIT-E-2408`). One indexed sum answers it, and only when the setting is on. Two uploads by the
same person at the same moment are each judged against the room before either is counted, so
together they may pass it once by up to one file.

## Links that end

A link hands one file to anyone who has it, for one to thirty days, and optionally for a number
of downloads; it is shown once, with a Copy button, and the database keeps only its SHA-256. It opens at
`/hooks/files/s/<token>`, past the door, and ends when its day passes, its downloads are used
(one statement counts a download only while the link is good), someone ends it by hand, or its
file goes to the trash. An ended link answers `410` with a line of text. Each download is
audited as `files.share-download`, and the file's page shows when each link was last downloaded.

A link may ask for a passcode (2026-11-21), 4 to 64 characters, kept only as a SHA-256 of the link's
id and the passcode, and compared in constant time. Its address then shows a page of its own with one field and no script, never
cached and never indexed; the right passcode gives the file, a wrong one the page again (`403`),
and the tenth wrong one over the link's life ends it (`410`, shown as Locked), audited as the
system's `files.share-locked` on the file. Each wrong guess is counted by one statement and a right
one downloads only while the link is not locked, so guesses sent at once do no better than ten in
turn. A share with a customer has no passcode: they sign in.

A link may be emailed as it is made (`to`), through the portal's email service: the email carries
the file's name and the link, and says a passcode is asked for, never what it is. The link stands
whether the email goes or not, and the answer's `sent` says which; the address is kept in the
share's audit row (`to`), so the file's history says where the link went. It goes from the
company's sending address through the email service, within that service's own daily limits.
Since only the link's hash is kept, a link is emailed only when it is made.

## Shared with a customer

When the portal has customers (`@oltrem/customers`), a person who may share a file can also share
it with a customer by their address, for 30 days, 90 days or a year. No link is made: the
customer finds the file under "Files shared with you" on their account page and downloads it
there, signed in, at `/account/open/files/<share>`. The page lists the newest 20 still good;
each download is counted and audited as `files.share-download` by `customers.door`, without the
address. It ends like a link: by hand ("Stop sharing"), at its day, or when the file or a folder
above it goes to the trash (it is back if they are restored before the day). "Email them that it
is there", ticked at first, emails the customer the file's name, where to sign in and until when,
through the `send` option (the client template queues it with email, so the page says it is
queued, not sent); without `send`, or when the email fails, the share stands and the page says
nobody was emailed. The page shares only with a customer of the company: before it shares, it
reads the customers' own list as the person (`GET /api/customers/people`) and refuses an address
that is not there, with a link to Customers, and says so in a portal without Customers. A person
who may not see the customers is left to the share's own checks. The share route itself does not
check the address against the customers (that needs the customers module's own check passed in by
the client: not here yet).

## The trash

Moving an item to the trash hides it and everything inside it, and ends its links. A restore
brings it back to its folder, or to the top of its place when that folder is gone, numbered on a
clash. Only an item in the trash is deleted for good (`KIT-E-2404` otherwise), with everything
inside it, their content and their links. The job `files.empty-trash` runs daily and deletes what
has stayed longer than the setting `files.trash_days` (30 by default), 100 items a run at most,
then removes link rows that ended a month ago. Its check (the jobs page's **Check for work**,
2026-11-21) counts what the next run would delete, and deletes nothing.

## The pages

| Path | Shows |
|---|---|
| `/files` | a row of the places the person may see (when more than one, each with its count of files), a row for Files and Trash, the folder's path, its folders and files, and for a writer the **Upload a file** and **New folder** sheets; after a move to the trash, a notice with **Undo** and the days it stays there; the trash says those days |
| `/files/:id` | one item: download or open, its details, an image's preview, rename, move to another folder of its place, its links with their downloads and end, make a link, the customers it is shared with and "Share with the customer" (an address and 30 days, 90 days or a year), trash, restore, and delete for good behind a confirmation |

## Search

The portal's search (`GET /api/files/search?q=`, `files.read`) finds files and folders by name,
folders first, in the places the person's roles reach and never in the trash; it never reads what a
file holds.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /places` | `files.read` | the places the person may see, with each one's files and bytes |
| `GET /items` (`scope`, `folder`, `trash=1`) | `files.read` | a folder or the trash of a place, with what the person may do there and the days the trash keeps an item |
| `GET /items/:id`, `GET /items/:id/content` (`inline=1`) | `files.read` | one item with its path, links, the folders it may move to and the days the trash keeps it; the file itself |
| `POST /folders`, `POST /uploads`, `PATCH /items/:id`, `POST /items/:id/trash`, `POST /items/:id/restore` | `files.write` | make a folder; upload; rename or move; trash; restore |
| `POST /items/:id/shares`, `DELETE /shares/:id` | `files.share` | make a link (`days` up to 30, `maxDownloads`, `passcode`, `to` to email it, with `sent` saying whether it went), or with `email` share it with that customer (`days` up to 365, no link; `tell: true` emails them, and `told` says whether it went); end one |
| `DELETE /items/:id` | `files.purge` | delete from the trash for good |

The hook `GET /hooks/files/s/:token` opens a link, and `POST /hooks/files/s/:token` takes its
passcode from the page. Every change is audited by the module
(`files.folder-create`, `files.upload`, `files.update`, `files.trash`, `files.restore`,
`files.purge`, `files.share`, `files.share-revoke`; the system's `files.share-download`,
`files.share-locked` and `files.trash-empty`), with names and sizes, never content.

The module has no card on Home: Home reads a card without the person, and a count of every file
would tell someone about places their roles do not reach. Its check `files.storage` counts the
files and bytes kept and warns past 8 GB of the free plan's 10 GB bucket, which the backups share.
It runs every six hours (`every: '6h'`, 2026-11-20), since each run counts every file row and the
bucket fills slowly; a first failure is checked again at the next health run, as for every check.

## Tables

Migration `0019_files.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`files_items` (each file and folder: its tenant, place, folder, kind, name, size, type, who
changed it and when, when it went to the trash) and `files_shares` (each link: its item, the
hash of its token, who made it, when it ends, its download limit and count, when it was ended).
Migration `0040_files_customers.sql` adds the address a share is for (`email`, empty for a link)
and an index on it in lower case, which a customer's account page reads by. Migration
`0068_files_passcodes_and_room.sql` (2026-11-21) adds a link's passcode hash and its count of wrong
passcodes, and an index on the files by who uploaded them with their sizes, which Room per person
sums from the index alone.

## Settings

| Key | Default | Who changes it |
|---|---|---|
| `files.max_upload_mb` | 25 (1 to 100) | an Owner |
| `files.trash_days` | 30 (1 to 365) | an Owner |
| `files.allowed_types` | `any` (or `documents and pictures`, `documents`) | an Owner |
| `files.person_room_mb` | 0, no limit (0 to 10240) | an Owner |

## Errors

The module owns the `2400` to `2499` block: `KIT-E-2401` the name is taken in that folder,
`KIT-E-2402` the file is larger than the setting allows, `KIT-E-2403` that folder cannot hold it,
`KIT-E-2404` only the trash is emptied, `KIT-E-2405` only a file is shared by a link, `KIT-E-2406`
a program dressed as another kind of file, `KIT-E-2407` a kind of file the setting does not allow,
`KIT-E-2408` the person's room is used up. An item that
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
the newest twenty with more, the download audited without the address; the email only when asked,
and the share kept when the email fails; the trash's days answered with a folder; a program
dressed as a picture or a text refused whatever the settings, Allowed types narrowing the rest,
Room per person counted for each one, a link's passcode page, a wrong passcode and the right one,
the tenth wrong one locking the link with its audit row, a link emailed without its passcode and
its address in the share's audit row, and the room's sum read from its index alone. The pages,
against answers of the API (`test/pages.test.ts`): a share refused for an address that is not a
customer and in a portal without Customers, the email said to be queued, the Copy button, Undo
after the trash and the trash's days, one file and many files, a link's passcode and email sent
on, and a link's passcode, last download and Locked shown. The client template's
screens test runs the pages: an upload from the form, a folder, a move, a link opened and ended by
the trash, and a file shared with a customer, who is emailed and downloads it from their account
page.

The search test finds names only in the places a person's roles reach, folders first, and takes `_` as a letter.
