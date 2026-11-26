---
title: "@oltrem/files: Folders, names and uploads; Links that end; File requests; Shared with a customer"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src; split from modules/files/README.md]
---

# @oltrem/files: Folders, names and uploads; Links that end; File requests; Shared with a customer

> Part of [the @oltrem/files README](../README.md).

## Folders, names and uploads

A name is trimmed to one line of at most 120 characters, with no slashes or control characters;
names are unique in a folder whatever their case, among the items not in the trash. Folders go eight
deep at most, and nothing moves into itself or out of its place. An upload whose name is taken is
kept beside the other, numbered (`report (2).pdf`); the numbers it could take are asked about in one
query. A folder whose name is taken is refused.

`POST /uploads` takes the file itself as the body (a `bytes` route), its type from the request's
content type and its name, place and folder from the query. A body of known length streams
straight to the bucket; one without is read up to the limit. The largest upload is the setting
`files.max_upload_mb` (25 by default, 100 at most, the free plan's request limit). The content is
stored under `files/<id>` before the row is written, so a row never points at nothing.

A file is served as a download under its own name, an image in place with `inline=1`, always with
`nosniff` and a sandboxing content security policy: a file never runs as a page of the portal.

### What kind of file it is, and the room each person has

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

### Held for review

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

### Keep for and legal hold

Whoever manages access on a folder sets, in its **Keep** section, how long it keeps each file in it
(30 days to 7 years from when the file was added; up to 3,650 days through the API), and on a
folder or a file a **legal hold** with its reason (`PUT /items/:id/keep`, audited as `files.keep`).
What a rule or a hold covers, on the item, a folder above it or anything inside it, does not go to
the trash (one by one or ticked), is not deleted for good by hand or by the trash's job, and does
not move to another folder, with `KIT-E-2413` saying why and until when; a rename still works.
Under a hold no earlier version is pruned. The item's page says what keeps it. A company with no
rule pays one small indexed read on those changes; otherwise one statement walks up and down
from the items.

### Content never left without its row

When the content is stored but the row that records it cannot be written (an upload, a copy, a new
version, a file request), the stored content is deleted again, so no bucket keeps a file the
portal cannot see or count.

### Versions, Starred and Recent

**Upload a new version** on a file's page keeps its name, place and links: the new content is judged
and checked as an upload is, under the file's own name (a program dressed as it is refused, one that
can run is held), and stored under a key of its own (`files_items.content_key`); the content it had
becomes an earlier version (`files_versions`, with its key, store, size, type and held reason). The
newest ten are kept; an older one's content and row are deleted as the next is made. **Restore** on
a version brings it back, and the content it replaces becomes a version in its turn. Both need
Change on the file and are audited (`files.version`, `files.version-restore`). Earlier versions
count toward their location's room and in the storage check. **Download** on a version gives that
version (`GET /items/:id/content?version=<id>`, audited with the version), unless it is held or the
file is View only. Deleting a file for good deletes its versions' content too.

**Star** on an item's page keeps it under **Files, Starred**, for that person alone
(`files_stars`, not audited). **Files, Recent** lists the 50 files changed most lately at the
locations the person sees, of the newest 200, leaving out what they may not see.

### Limits per person, role and location

**Files, Limits** (`/files?show=limits`, shown to whoever holds `files.access` somewhere) lists
the limits set, with what each person and location keeps, and lets an Owner set or remove one.
They are kept in the company setting `files.room_rules`, in MB, 0 for no limit. A person's room
is their own limit when one is set; otherwise the largest of the limits of the roles they hold
(directly or through a group; one role without a limit lifts it); otherwise `files.person_room_mb`.
A location's limit counts every file kept there, by anyone, the trash included: an upload or a
copy past it is refused (`KIT-E-2409`), before it is stored when its length is known. The roles
are read only when a role limit is set, and the location's sum only when it has one.

The page also sets, for whoever holds `files.limits.manage` (an Owner or the Vendor always): the
**room for all files** (`files.total_room_mb`, 10 GB by default, the free R2 allowance), counted
over what is kept in the portal's own bucket, so an upload past it is refused (`KIT-E-2414`) while a
location kept in a storage connection is not counted; the **room per person** for everyone
(`files.person_room_mb`); the **most room for one person** (`files.person_room_max_mb`), which caps
every person's and role's limit, 0 for no cap; and the **warning share** (`files.room_warn_percent`,
80 by default) at which a bar turns amber. A **People** card lists each person by the share of their
room used, with a Change link that opens their own limit. A change is one audited row,
`files.room-set`. Files, Storage shows the **Cloudflare use** core-health measures (R2 storage,
Class A and Class B operations this month, and the other budgets), linking to the status page.

## Links that end

A link hands one file to anyone who has it, for one to thirty days, and optionally for a number of
downloads; it is shown once, with a Copy button, and the database keeps only its SHA-256. It opens
at `/hooks/files/s/<token>`, past the door, and ends when its day passes, its downloads are used
(one statement counts a download only while the link is good), someone ends it by hand, or its file
goes to the trash. An ended link answers `410` with a page that says so in plain words. The public
pages (the passcode, a file request, an ended link) are one card in the reader's light or dark, with
no script and nothing loaded but the page itself. Each download is audited as
`files.share-download`, and the file's page shows when each link was last downloaded.

A link may ask for a passcode, 4 to 64 characters, kept only as a SHA-256 of the link's id and the
passcode, and compared in constant time. Its address then shows a page of its own with one field and
no script, never cached and never indexed; the right passcode gives the file, a wrong one the page
again (`403`), and the tenth wrong one over the link's life ends it (`410`, shown as Locked),
audited as the system's `files.share-locked` on the file. Each wrong guess is counted by one
statement and a right one downloads only while the link is not locked, so guesses sent at once do no
better than ten in turn. A share with a customer has no passcode: they sign in.

A link may be emailed as it is made (`to`), through the portal's email service: the email carries
the file's name and the link, and says a passcode is asked for, never what it is. The link stands
whether the email goes or not, and the answer's `sent` says which; the address is kept in the
share's audit row (`to`), so the file's history says where the link went. It goes from the
company's sending address through the email service, within that service's own daily limits.
Since only the link's hash is kept, a link is emailed only when it is made.

## File requests

A file request is a link on a folder through which people outside the portal send files into it,
without signing in. Someone who may share and add files there makes one on the folder's page (**File
requests**: one to thirty days, the files it takes, 20 unless told and 100 at most, an optional
passcode, an optional address to email it to); it is shown once, like a link, and is a row of
`files_shares` with `request` set. It opens at `/hooks/files/r/<token>`: a page with the folder's
name, the files it still takes and the largest size, a name field, the passcode when it asks for
one, and the files (ten at most at once). Each file holds a place among the files the request takes
before it is read, is judged and checked as an upload is (a disguised program refused, one that can
run held for review), counts against the location's room, keeps the name it came with (numbered on a
clash) and shows "name (file request)" as who added it. Each is audited as `files.request-upload`,
with the name given, the file's name and size. The request ends at its day, when it has taken its
files, by hand (End on the folder's page or on Shared links), after ten wrong passcodes, or when its
folder goes to the trash; an ended one answers `410`. A sending is read only when its declared
length is within the largest upload, so one sending holds at most that much in all. When a sending
brings files, the person who made the request is emailed who sent them and their names, once per
sending; a failed email never fails the sending.

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
