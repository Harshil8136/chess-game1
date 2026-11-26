---
title: "@oltrem/files: uploads, safety, limits, links, file requests, customer shares"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src/drive.ts, kinds.ts, safety.ts, module.ts, pages.tsx]
---

# @oltrem/files: uploads, safety, limits, links, file requests, customer shares

> Part of [the @oltrem/files README](../README.md).

## Folders, names and uploads

- **Names.** One line, at most 120 characters, no slashes or control characters, unique in a
  folder whatever the case (trash aside). A name with direction marks, or ending with a dot, is
  refused (it can hide its real ending). Folders go 8 deep; nothing moves into itself. A taken
  upload name is numbered (`report (2).pdf`); a taken folder name is refused.
- **Upload.** `POST /uploads` takes the file as the body, its type from the content type and its
  name, place and folder from the query. A known length streams to the bucket; otherwise it is
  read up to the limit `files.max_upload_mb` (25, at most 100). Content is stored at `files/<id>`
  before the row; if the row then fails, the content is deleted, so neither is ever left alone.
- **Serving.** A download under its own name, an image in place with `inline=1`, always `nosniff`
  and a sandboxing policy: a file never runs as a portal page.

## What a file is, and room

**Kinds** (`src/kinds.ts`): the first 16 bytes and the name. A program dressed as something else
(`photo.jpg`) is always refused (`KIT-E-2406`). `files.allowed_types` is `any` by default; set to
`documents and pictures` or `documents`, both bytes and name must fit (`KIT-E-2407`). Plain text
and CSV are judged by name.

**Held for review** (`src/safety.ts`): a program; a zip or Office file with a program, macros
(`vbaProject.bin`) or a password; a PDF naming JavaScript, a launch action, an embedded file or
rich media. Only small parts are read (a zip's directory up to 512 KB, a PDF's first and last 64
KB), so it costs a millisecond or two; an unreadable part holds too. A held file shows "Held for
review" and cannot be downloaded, previewed, copied or shared (`KIT-E-2412`) until someone with
Manage access releases it (`POST /items/:id/release`, audited `files.release`) or it is trashed.
**Held for review** under More (`/files?show=held`, `GET /held`) lists them for the locations a
person manages. This is not a virus scan: nested zips, macros in old `.doc` files and JavaScript
in a PDF's compressed parts pass unseen.

**Keep and legal hold.** A folder's **Keep** section sets how long each file is kept (30 days to 7
years; up to 3,650 days by API, `KEEP_DAYS_MAX`), and a folder or file can carry a legal hold with
a reason (`PUT /items/:id/keep`, audited `files.keep`). What a rule or hold covers cannot be
trashed, deleted or moved (`KIT-E-2413`, saying why and until when); renaming works, and no version
is pruned under a hold.

**Versions, Starred, Recent.** **Upload a new version** keeps the name, place and links; the new
content is judged as an upload and stored under its own key (`files_items.content_key`), the old
becoming a version (`files_versions`). The newest 10 are kept (`VERSIONS_KEPT`). **Restore** swaps
back. Both need Change and are audited (`files.version`, `files.version-restore`); versions count
toward room. **Download** on a version: `GET /items/:id/content?version=<id>`. **Star** is per
person (`files_stars`); **Recent** lists the 50 latest-changed files the person may see.

**Limits** (`/files?show=limits`, for whoever holds `files.access`; set by an Owner), kept in
`files.room_rules` in MB, 0 for none:

| Limit | Rule |
|---|---|
| A person | Their own limit, else the largest of their roles' (one role without a limit lifts it), else `files.person_room_mb` (0 by default). Counts what they uploaded, trash included (`KIT-E-2408`). Two uploads at once may pass it by one file. |
| A location | Every file kept there by anyone (`KIT-E-2409`) |
| All files | `files.total_room_mb` (10 GB, the free R2 allowance), the portal's own bucket only (`KIT-E-2414`) |
| One person at most | `files.person_room_max_mb` caps every person's and role's limit |
| Warning | `files.room_warn_percent` (80) turns a bar amber |

Uploads are refused before storing when the length is known, removed after when not. Each sum is
read only when its limit is set. A **People** card lists each person's share used. Changes are
audited `files.room-set` (`files.limits.manage`). Files, Storage shows core-health's Cloudflare use.

## Links that end

A link hands one file to anyone holding it for 1 to 30 days, optionally for a number of downloads;
shown once, kept only as a SHA-256. It opens at `/hooks/files/s/<token>` past the door and ends at
its day, at its downloads (counted by one statement only while good), by hand, or when the file is
trashed: then `410` with a plain page. Public pages are one card, light or dark, with no script.
Downloads are audited `files.share-download`.

- **Passcode** (4 to 64 characters): kept as a SHA-256 with the link's id, compared in constant
  time, on a never-cached, never-indexed page. A wrong one shows the page again (`403`); the 10th
  over the link's life locks it (`410`, audited `files.share-locked`). Guesses at once do no better
  than ten in turn.
- **Emailed** (`to`) as it is made, from the company's sending address: the name and link, saying
  a passcode is needed but never what. `sent` says whether it went; the address is in the audit
  row.

## File requests

A link on a folder through which people outside send files in, without signing in. Made on the
folder's page by someone who may share and add there: 1 to 30 days, how many files (20, at most
100), an optional passcode and address; shown once (`files_shares` with `request`). It opens at
`/hooks/files/r/<token>`: the folder's name, files left, largest size, a name field, up to ten files
at once. Each holds its place first, is judged as an upload, counts toward the location's room,
keeps its name (numbered on a clash) and shows "name (file request)"; audited
`files.request-upload`. It ends at its day, when full, by hand, after ten wrong passcodes, or when
the folder is trashed (`410`). A sending is read only within the largest upload. The maker is
emailed once per sending; a failed email never fails it.

## Shared with a customer

With `@oltrem/customers`, a person who may share can share a file with a customer's address for 30
days, 90 days or a year. No link: the customer downloads it signed in, under "Files shared with
you" (the newest 20), through `/account/open/files/<share>`, audited `files.share-download` by
`customers.door` without the address. It ends by hand ("Stop sharing"), at its day, or when the
file or a folder above is trashed (back if restored in time). "Email them that it is there" goes
through the `send` option (queued by the client template); without it the share stands and the
page says nobody was emailed. The page first checks the address against `GET
/api/customers/people` as the person and refuses one not there; the share route itself does not
check it.
