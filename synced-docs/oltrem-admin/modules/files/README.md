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

Five capabilities, on bit plane `12`: `files.read` sees the places' files and opens them;
`files.write` uploads, makes folders, renames, moves within the place, puts in the trash and
restores; `files.share` makes and ends links; `files.access` (2026-11-23, "Change who has access
to folders and files", alias `files.access.manage`) changes who has access and sees everything at
the place; `files.purge` deletes from the trash for good, and asks for a fresh sign-in. They join
every Owner role when the Worker starts.

An item sits at one place (an IAM scope), at its top or in one of its folders. A role held at
that place, or at a place above it, decides what a person may do with it; a role held only at
another place gives nothing. The route checks that the person holds the capability somewhere;
the drive then checks it at the item's own place. An item the person may not see answers as one
that is not there (`KIT-E-0404`), so its name never leaks. An item whose place was removed
belongs to the company.

### Manage access (2026-11-23)

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

**Access review** (2026-11-24, **Files, Access review**, for whoever holds `files.access`) lists
every entry at the locations where the person holds it, the soonest to end first, then those with
no end (up to 500), each with its item, location, level, end and who gave it; **Ends within 14
days** and **Ended** pick them out. Tick entries and **End access** ends them in one write, with an
audit row each (`files.access-remove`, `bulk: true`); one out of reach is refused alone.

There is no "Ask for access" button: offering it on a hidden item would tell the person the item
exists, which None and restricted folders are there to prevent. Someone who needs a hidden file
asks the person who manages the location.

## Storage locations (2026-11-23)

Each location keeps its new files in the portal's own bucket (`FILES`, 10 GB on the free plan,
shared with the backups) or in a bucket of the company's own at a service that speaks Amazon S3's
API: Amazon S3, Cloudflare R2 in another account, Backblaze B2, Wasabi, DigitalOcean Spaces, or any
other by its endpoint (MinIO, Storj, Scaleway and the like). **Files, Storage**
(`/files?show=storage`, shown to whoever holds `files.access`; changes are an Owner's) joins one:
pick the service in a sideways row, follow its steps, paste the bucket, where it is and the key.
The key is a storage connection of the providers module ([`@oltrem/providers`](../providers/README.md)):
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

**Move** (2026-11-24) brings a location's old files after its choice: the Storage page says how
many files and earlier versions it keeps elsewhere, and each press of Move copies up to ten to the
storage it uses now, changes their rows, then deletes the old copies (a copy that cannot be
deleted is reported, never lost; content already gone is counted as missing and its row follows).
**Bring in** reads up to a hundred objects under a folder of a joined bucket and makes each a file
of a location, read where it is with no copy: each key once, a name numbered on a clash, an empty
or folder key skipped, a program by its name held for review, and the room checked first. Deleting
a brought-in file for good deletes it from the bucket. Both are an Owner's, and audited
(`files.store-move`, `files.bring-in`, and `files.upload` with `broughtIn` per file).

The Worker passes every byte through itself both ways (`src/stores.ts`): a request signed with
AWS Signature Version 4 (the providers module's `signV4`, handed in by the client), the upload held
to its told length, a `Range` passed on for a video's seek, deletes a thousand at a time with
DeleteObjects. So the rights of this module decide every open, the outside bucket's address is
never shown, and it needs no CORS rule. A service that refuses or fails answers `KIT-E-2410` with
what it said, and an upload it refused leaves no row. A connection is removed only once no location
sends files to it and no file is kept there (`KIT-E-2411`); the bucket itself is never touched.

Not here yet: bringing in the files already in a bucket, and moving a location's existing files
from one store to another.

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

### Held for review (2026-11-23)

Some files are kept but held, so nobody opens them unawares (`src/safety.ts`): a program; a zip
(or a Word, Excel or PowerPoint file, which are zips) with a program inside, macros
(`vbaProject.bin`) or a password; a PDF that names JavaScript, a launch action, an embedded file or
rich media. The checks read only small parts of the stored file (a zip's list of contents from its
end, up to 512 KB; a PDF's first and last 64 KB), so they cost a millisecond or two whatever the
size. A part that cannot be read holds the file too. A held file (`files_items.held`, the reason
in words) is listed with "Held for review", and nobody downloads, previews, copies or shares it
(`KIT-E-2412`) until someone with Manage access at its location releases it
(`POST /items/:id/release`, audited `files.release` with the reason) or it is deleted. Since
2026-11-24 the notice on a held file (its page and its details panel) carries **Release**, for
whoever manages access at its location, and **Move to the trash**, for whoever may change it; the
row's menu has Release too; and **Held for review** under More (`/files?show=held`,
`GET /held`) lists every held file at the locations the person manages, newest first, with its
reason and both buttons, so the uploader's manager finds them without looking folder by folder. This is not
a virus scan: a program inside a zip inside a zip, macros in an old `.doc`, or JavaScript inside a
PDF's compressed parts pass unseen. A name with marks that change the direction of the text, or
ending with a dot, is refused, since it can hide its real ending.

### Keep for and legal hold (2026-11-24)

Whoever manages access on a folder sets, in its **Keep** section, how long it keeps each file in it
(30 days to 7 years from when the file was added; up to 3,650 days through the API), and on a
folder or a file a **legal hold** with its reason (`PUT /items/:id/keep`, audited as `files.keep`).
What a rule or a hold covers, on the item, a folder above it or anything inside it, does not go to
the trash (one by one or ticked), is not deleted for good by hand or by the trash's job, and does
not move to another folder, with `KIT-E-2413` saying why and until when; a rename still works.
Under a hold no earlier version is pruned. The item's page says what keeps it. A company with no
rule pays one small indexed read on those changes; otherwise one statement walks up and down
from the items.

### Content never left without its row (2026-11-24)

When the content is stored but the row that records it cannot be written (an upload, a copy, a new
version, a file request), the stored content is deleted again, so no bucket keeps a file the
portal cannot see or count.

### Versions, Starred and Recent (2026-11-23)

**Upload a new version** on a file's page keeps its name, place and links: the new content is
judged and checked as an upload is, under the file's own name (a program dressed as it is
refused, one that can run is held), and stored under a key of its own
(`files_items.content_key`); the content it had becomes an earlier version (`files_versions`, with
its key, store, size, type and held reason). The newest ten are kept; an older one's content and
row are deleted as the next is made. **Restore** on a version brings it back, and the content it
replaces becomes a version in its turn. Both need Change on the file and are audited
(`files.version`, `files.version-restore`). Earlier versions count toward their location's room
and in the storage check (since 2026-11-24). **Download** on a version gives that version
(`GET /items/:id/content?version=<id>`, audited with the version), unless it is held or the file is
View only. Deleting a file for good deletes its versions' content too.

**Star** on an item's page keeps it under **Files, Starred**, for that person alone
(`files_stars`, not audited). **Files, Recent** lists the 50 files changed most lately at the
locations the person sees, of the newest 200, leaving out what they may not see.

### Limits per person, role and location (2026-11-23)

**Files, Limits** (`/files?show=limits`, shown to whoever holds `files.access` somewhere) lists
the limits set, with what each person and location keeps, and lets an Owner set or remove one.
They are kept in the company setting `files.room_rules`, in MB, 0 for no limit. A person's room
is their own limit when one is set; otherwise the largest of the limits of the roles they hold
(directly or through a group; one role without a limit lifts it); otherwise `files.person_room_mb`.
A location's limit counts every file kept there, by anyone, the trash included: an upload or a
copy past it is refused (`KIT-E-2409`), before it is stored when its length is known. The roles
are read only when a role limit is set, and the location's sum only when it has one.

## Links that end

A link hands one file to anyone who has it, for one to thirty days, and optionally for a number
of downloads; it is shown once, with a Copy button, and the database keeps only its SHA-256. It opens at
`/hooks/files/s/<token>`, past the door, and ends when its day passes, its downloads are used
(one statement counts a download only while the link is good), someone ends it by hand, or its
file goes to the trash. An ended link answers `410` with a page that says so in plain words. The public pages (the passcode, a file request, an ended link) are one card in the reader's light or dark, with no script and nothing loaded but the page itself (2026-11-24). Each download is
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

## File requests (2026-11-23)

A file request is a link on a folder through which people outside the portal send files into it,
without signing in. Someone who may share and add files there makes one on the folder's page
(**File requests**: one to thirty days, the files it takes, 20 unless told and 100 at most, an
optional passcode, an optional address to email it to); it is shown once, like a link, and is a
row of `files_shares` with `request` set. It opens at `/hooks/files/r/<token>`: a page with the
folder's name, the files it still takes and the largest size, a name field, the passcode when it
asks for one, and the files (ten at most at once). Each file holds a place among the files the
request takes before it is read, is judged and checked as an upload is (a disguised program
refused, one that can run held for review), counts against the location's room, keeps the name
it came with (numbered on a clash) and shows "name (file request)" as who added it. Each is
audited as `files.request-upload`, with the name given, the file's name and size. The request
ends at its day, when it has taken its files, by hand (End on the folder's page or on Shared
links), after ten wrong passcodes, or when its folder goes to the trash; an ended one answers
`410`. A sending is read only when its declared length is within the largest upload, so one
sending holds at most that much in all. When a sending brings files, the person who made the
request is emailed (2026-11-24) who sent them and their names, once per sending; a failed email
never fails the sending.

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
| `/files` | a file manager (2026-11-23, made over 2026-11-24): on a computer the Files menu sits in the portal's one sidebar under the Files row, as Email's folders do (the places, Starred, Recent, Shared with me, Shared links, Trash, then under More Access review, Held for review, Limits and Storage for whoever manages access at a location, and the Storage meter: the visible places' bytes against the bucket's 10 GB), so the page keeps its full width; on a phone the same rows as a sideways row of chips. The folder is one panel: its head holds the path (earlier folders muted, the current one bold, each a place to drop dragged rows) with the folder's own folders, files and size under it, then a search box (names in this folder), a Sort menu (`?sort=`, `-` for the largest or newest first; the list's headings sort too), List or Grid (`?view=grid`, pictures as thumbnails) and **New** (Upload files, Upload a folder, New folder), the page's one filled button (beside the path on a phone). Compact rows: a tile coloured by the file's kind, the name, a short date (`24 Nov`, the full time on hover) and the size; on a phone the size and date under the name. Ticks show on hover, once one is ticked, or always on a touch screen; the bar with **Move to the trash** shows only while something is ticked. A menu on each row (also a right click: Download, Details, Make a copy, Restore, Move to the trash); a held file shows an amber dot and Held. A file's name opens a details panel over the right of the page, the rest dimmed (`?item=`, a press outside closes it) with a preview of a picture, video, sound, PDF or text, its facts, Download and, for a person who may delete for good, its Activity (the last 30 of its audit rows). An empty folder says to drop files or press New. With the browser script, files dropped or pasted on the page upload one at a time with a bar each and Stop; dragged rows move into a folder row or a folder of the path; F2 opens an item, Delete trashes it. Without it the upload form still works. After a move to the trash, a notice with **Undo** and the days it stays there |
| `/files?show=held` | Held for review (2026-11-24), for whoever manages access at a location: each held file there with its place, why it is held, Release and Move to the trash, each leading back to the list |
| `/files?show=shared` | Shared with me: the folders and files given to the person by Manage access, with their places |
| `/files?show=starred`, `/files?show=recent` | Starred and Recent (2026-11-23): what the person starred, and the files changed most lately at their locations, with their places |
| `/files?show=access` (`ends=soon`, `ends=ended`) | Access review (2026-11-24; its row is under More in the Files menu since the makeover the same day): every entry of Manage access at the locations the person manages, with ticks and **End access** |
| `/files?show=links` | Shared links (2026-11-23): every open link and customer share the person made or may end, with its file, location, who made it, its downloads and its end, and **End it** |
| `/files/:id` | one item (2026-11-24, made over): beside its title Star, a More menu (rename, move, make a copy, upload a new version, trash, restore, delete for good behind a confirmation) and its one filled button (Download, Open when it is View only, none when held (Release and Move to the trash are in its notice), Open the folder for a folder), under it the kind, size and date, then where it is; on the left its preview, **Who has access** for a person who may change it (the folder's general access with Restrict, one row per person, group or role with its level and a remove button, entries from the folders above with Change it there, and Add people in a dialog: who, a level, View only and Ends on) and its activity; on the right cards for its details, links (New link), the customers it is shared with (Share: an address and 30 days, 90 days or a year), a folder's file requests, versions and Keep, each form in a dialog; on a phone the cards follow the access and the activity comes last |

## Search

The portal's search (`GET /api/files/search?q=`, `files.read`) finds files and folders by name,
folders first, in the places the person's roles reach and never in the trash; it never reads what a
file holds.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /places` | `files.read` | the places the person may see, with each one's files and bytes |
| `GET /items` (`scope`, `folder`, `trash=1`) | `files.read` | a folder or the trash of a place, with what the person may do there and the days the trash keeps an item |
| `GET /items/:id`, `GET /items/:id/content` (`inline=1`) | `files.read` | one item with its path, links, the folders it may move to and the days the trash keeps it; the file itself, with a `Range` answered as 206 so a video seeks; in place (`inline=1`) a picture, PDF, sound, video, plain text or JSON, sandboxed (a PDF without the sandbox, which stops the browser's viewer, but with `default-src 'none'`) |
| `GET /items/:id/activity` | `files.read`, and Manage on the item (`files.purge` or `files.access` at its place, or a Manage entry) | the last 30 audit rows of the item, of a folder with what it holds (up to 200 items); with `format=csv` (2026-11-24) up to 1,000 as a CSV download (**Export (CSV)** under Activity), a cell that could run as a spreadsheet formula started with a quote mark |
| `PUT /items/:id/keep` (`keepDays`, `hold`) | `files.access`, and Manage on the item | a folder's days to keep its files; a legal hold on a folder or a file, or none |
| `GET /access`, bulk `end-access` (`POST /bulk/end-access`, up to 100 ids) | `files.access` | the access review; many entries ended in one batch with an audit row each, each refused alone when out of reach |
| `GET /held` | `files.access` | the files held for review at the locations the person manages, newest first (2026-11-24) |
| `GET /shared` | `files.read` | what Manage access gives the person, that they may see |
| `GET /starred`, `GET /recent`, `PUT /items/:id/star` (`on`) | `files.read` | what the person starred; the newest files at their locations; star an item they see, or take the star off |
| `POST /items/:id/versions` (the content as the body), `POST /items/:id/versions/:version/restore` | `files.write`, and Change on the file | a new version of a file; an earlier version back |
| `GET /links` | `files.share` | the open links and customer shares at the locations the person may see, those they made or may end, newest first (up to 200) |
| `POST /items/:id/release` | `files.access` at the item's location | release a file held for review |
| `GET /stores` | `files.access` | the storage connections (their bucket and where, last check, files and bytes kept), the S3 services one may join with their fields and steps, each location's choice, and whether the person may change them |
| `POST /stores` (`service`, `label`, `fields`), `POST /stores/:id/check`, `POST /stores/:id/key` (`fields`), `DELETE /stores/:id` | `files.access` at the company, and an Owner or the Vendor | join a bucket and check it; check again; paste the key again and check; remove a connection no location uses and no file is kept in |
| `POST /stores/move` (`scope`), `POST /stores/:id/bring-in` (`prefix`, `scope`, `parent`) | `files.access` at the company, and an Owner or the Vendor | move up to ten of a location's files and earlier versions to the storage it uses now (what moved, was missing and is left); bring up to a hundred of a bucket's files under a prefix into a folder (what came in, what was left out and why) |
| `GET /limits` | `files.access` | the limits set, the company's people (with what each uploaded), roles and the locations where the person holds `files.access` (with what each keeps), and whether the person may change them (an Owner or the Vendor, through `PUT /api/settings/values/files.room_rules`) |
| `GET /items/:id/access` | `files.read`, and Manage on the item | its entries and those of the folders above it, whether it is restricted, and the company's people, groups and roles |
| `POST /items/:id/access` (`whoKind`, `whoId`, `level`, `viewOnly`, `endsAt`), `DELETE /access/:id`, `POST /items/:id/restrict` (`on`) | `files.access`, and Manage on the item | give an entry (a second for the same one replaces the first), end one, restrict a folder or open it again |
| `POST /items/:id/copy` (`parentId`), bulk `trash` (`POST /bulk/trash`, up to 100 ids) | `files.write` | a copy of a file, numbered like an upload, counted against the person's room; many items to the trash in one batch with an audit row each, each refused alone when out of reach |
| `POST /folders`, `POST /uploads` (`path` makes its folders, up to the depth), `PATCH /items/:id`, `POST /items/:id/trash`, `POST /items/:id/restore` | `files.write` | make a folder; upload; rename or move; trash; restore |
| `POST /items/:id/shares`, `DELETE /shares/:id` | `files.share` | make a link (`days` up to 30, `maxDownloads`, `passcode`, `to` to email it, with `sent` saying whether it went), or with `email` share it with that customer (`days` up to 365, no link; `tell: true` emails them, and `told` says whether it went); end one |
| `DELETE /items/:id` | `files.purge` | delete from the trash for good |

The hook `GET /hooks/files/s/:token` opens a link, and `POST /hooks/files/s/:token` takes its
passcode from the page; `GET /hooks/files/r/:token` shows a file request's page, and
`POST /hooks/files/r/:token` takes what is sent from it (a hook that reads its own body).
`POST /items/:id/shares` with `request: true` on a folder makes a file request. Every change is audited by the module
(`files.folder-create`, `files.upload`, `files.copy`, `files.update`, `files.access-grant`,
`files.access-remove`, `files.restrict`, `files.trash`, `files.restore`,
`files.purge`, `files.share`, `files.share-revoke`, `files.release`, `files.version`,
`files.version-restore`; the system's `files.share-download`,
`files.share-locked`, `files.request-upload` and `files.trash-empty`), with names and sizes, never content. A staff download or a preview in place is audited too (`files.download`, `files.preview`, 2026-11-23), except a picture's preview, which the grid shows by the dozen, and a later part of a video.

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
sums from the index alone. Migration `0079_files_access.sql` (2026-11-23) adds `files_access`
(each entry of Manage access: its tenant, place, item, a person, group or role, the level, view
only, the day it ends, who gave it and when; one entry per item and who; indexed by place and by
who) and `files_items.restricted`. Migration `0080_files_stores.sql` (2026-11-23) adds
`files_items.store_id`, the storage connection a file's content is kept in (empty for the portal's
bucket). Migration `0081_files_held.sql` (2026-11-23) adds `files_items.held`, why a file is held
for review (empty when it is not). Migration `0082_files_versions_and_stars.sql` (2026-11-23) adds
`files_items.content_key` (where a file's content is kept since a new version; empty is
`files/<id>`), `files_versions` (each earlier version: its file, key, store, size, type, held
reason, who changed the file before and when; indexed by file and time) and `files_stars` (one row
a person and item). Migration `0083_files_requests.sql` (2026-11-23) adds `files_shares.request`, set
for a file request. Migration `0084_files_keep.sql` (2026-11-24) adds `files_items.keep_days` (the
days a folder keeps its files, 0 for none) and `files_items.hold` (a legal hold's reason, empty for
none), with an index of the company's items that have either.

## Settings

| Key | Default | Who changes it |
|---|---|---|
| `files.max_upload_mb` | 25 (1 to 100) | an Owner |
| `files.trash_days` | 30 (1 to 365) | an Owner |
| `files.allowed_types` | `any` (or `documents and pictures`, `documents`) | an Owner |
| `files.person_room_mb` | 0, no limit (0 to 10240) | an Owner |
| `files.location_stores` | every location in the portal's bucket (location id to a storage connection's id) | an Owner, on Files, Storage (the Settings tab links there: `setOn`) |
| `files.room_rules` | no limits (`people`, `roles`, `places`, each id to MB, 0 to 10240) | an Owner, on Files, Limits (the Settings tab links there: `setOn`) |

## Errors

The module owns the `2400` to `2499` block: `KIT-E-2401` the name is taken in that folder,
`KIT-E-2402` the file is larger than the setting allows, `KIT-E-2403` that folder cannot hold it,
`KIT-E-2404` only the trash is emptied, `KIT-E-2405` only a file is shared by a link, `KIT-E-2406`
a program dressed as another kind of file, `KIT-E-2407` a kind of file the setting does not allow,
`KIT-E-2408` the person's room is used up, `KIT-E-2409` the location's room is used up, `KIT-E-2410` the storage where a file is kept refused
or failed, `KIT-E-2411` a storage connection still in use, `KIT-E-2412` a file held for review,
`KIT-E-2413` kept by a legal hold or a folder's days (409). An item that
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
its address in the share's audit row, and the room's sum read from its index alone; folders made from an upload's path once and refused past
the depth, a copy numbered with its content, many trashed at once with one refused, a download
and a text preview audited but a picture's preview not, a range answered with 206, and the
Activity refused to a clerk; Manage access: a restricted folder hidden from a clerk and a keeper
and back once listed, by name or through a group, its audit rows; None hiding one file from one
person, bulk trash refusing it, and back once removed; View only for someone from another place,
under Shared with me, no download but a preview, gone the day it ends; giving access refused
without `files.access`, to someone unknown, and Restrict on a file (`test/access.test.ts` decides
the rules on their own); a zip with a program held, refused to download, link and copy, released
only by Manage and opened after, a plain zip not held, a name with a direction mark refused, and
Shared links listing a link for whoever may share and dropping it once ended (`test/safety.test.ts`
reads zips, PDFs and names on their own); a new version kept under the name, refused to someone
without Change and as a disguised program, restored with the one it replaced kept, ten kept with
the older content gone from the bucket and every version's content gone with the file, an earlier
version downloaded on its own and an unknown one not found; a new version that can run held, the
clean one downloaded and restored; earlier versions counted in a location's room; a star for the person alone, Starred,
Recent leaving out another location's files; a file request made on a folder only and by someone
who may share there, its token never opening as a link, its page, a passcode asked and a wrong one
refused, a name needed, two files received with one held and the name escaped, a disguised
program refused, the files past its count refused and the request then gone, one ended by hand,
its maker emailed once with what came; the access review for whoever manages access only, the
soonest end first, End access in bulk with an unknown entry refused alone and an audit row each;
a folder's activity as CSV with a formula cell made plain; a folder's days refusing the trash,
a move and bulk trash until lifted, set only on a folder and by whoever manages access; a legal
hold refusing delete for good and the trash's job, holding its folder through what is inside and
keeping all twelve versions. The pages,
against answers of the API (`test/pages.test.ts`): a share refused for an address that is not a
customer and in a portal without Customers, the email said to be queued, the Copy button, Undo
after the trash and the trash's days, one file and many files, a link's passcode and email sent
on, a link's passcode, last download and Locked shown, and the file manager: folders first in the
order picked, the tree, the upload boxes, the bulk bar, the grid and the details pane with its
Activity and its Export (CSV) link, the access review with its filters and ticks, the Keep
notice and form, and a copy made in the same folder. The client template's
screens test runs the pages: an upload from the form, a folder, a move, a link opened and ended by
the trash, and a file shared with a customer, who is emailed and downloads it from their account
page.

The storage tests (2026-11-23), against an S3 bucket in memory that answers only signed calls:
the address built from the definition, put, get, a part and a delete each signed with a checksum on
the delete, the six checks passing and versioning noted, a public bucket failing the private check
and a key that may not list stopping at the first; through the pipeline, a location's upload kept
in the bucket and not in the portal's, opened whole and in part, copied there, still opened after
the choice changed, and deleted there for good; a service down refusing the upload with
`KIT-E-2410` and no row; the Storage view for an Owner and refused to a clerk, a bucket joined and
checked, a data service refused, a connection in use refused with `KIT-E-2411` and removed once
free; the page offering only checked connections and saving the choice as the setting. Move and
Bring in (2026-11-24): a location's files moved ten a press until none is left, then opening from
the bucket and gone from the portal's; a bucket's files brought in once, a program held, a second
press skipping them; both refused to a clerk; the page's Move and Bring in forms and their words.

The limits tests (2026-11-23): a person's own room winning over a role's, a role's over
everyone's and a role without a limit lifting it; a location's room refusing an upload and a copy
while another location takes it; `GET /limits` with what each keeps for an Owner and refused
without `files.access`; the Limits page listing by name, saving one more as the setting, and no
form for someone who is not an Owner.

The search test finds names only in the places a person's roles reach, folders first, and takes `_` as a letter.
