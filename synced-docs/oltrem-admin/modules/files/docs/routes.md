---
title: "@oltrem/files: routes, tables, settings, errors"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src/module.ts, errors.ts, modules/files/migrations]
---

# @oltrem/files: routes, tables, settings, errors

> Part of [the @oltrem/files README](../README.md). "Manage on the item" means `files.purge` or
> `files.access` at its place, or a Manage entry. "Owner" means an Owner or the Vendor.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /places` | `files.read` | The places the person may see, with files and bytes |
| `GET /report?days=&to=` | `files.limits.manage` at the company | Reports' Services section: added against the period before, own storage against room, each connection |
| `GET /items` (`scope`, `folder`, `trash=1`) | `files.read` | A folder or the trash, with what the person may do and the trash's days |
| `GET /items/:id`, `GET /items/:id/content` (`inline=1`) | `files.read` | One item (path, links, move targets); the file, `Range` answered 206. In place: pictures, PDF, sound, video, and any text as `text/plain`, all sandboxed (a PDF with `default-src 'none'` instead, so the viewer works) |
| `GET /items/:id/activity` (`format=csv`) | `files.read`, Manage on the item | Last 30 audit rows of the item or a folder's contents (200 items), with `who` and `level`; CSV up to 1,000, formula cells quoted |
| `PUT /items/:id/keep` (`keepDays`, `hold`) | `files.access`, Manage on the item | A folder's keep days; a legal hold |
| `GET /access`, `POST /bulk/end-access` (100) | `files.access` | The access review; end many, each refused alone when out of reach |
| `GET /held`, `POST /items/:id/release` | `files.access` | Held files at the person's locations; release one |
| `GET /shared` | `files.read` | What Manage access gives the person |
| `GET /starred`, `GET /recent`, `PUT /items/:id/star` (`on`) | `files.read` | Starred, recent, star or unstar |
| `POST /items/:id/versions`, `POST /items/:id/versions/:version/restore` | `files.write`, Change on the file | A new version (content as body); an old one back |
| `GET /links` | `files.share` | Open links and customer shares the person made or may end (200) |
| `GET /stores` | `files.access` | Storage connections (bucket, last check, files and bytes), the S3 services to join with their steps, each location's choice |
| `POST /stores`, `/stores/:id/check`, `/stores/:id/key`, `DELETE /stores/:id` | `files.access` at the company, Owner | Join and check a bucket; check again; new key; remove an unused one |
| `POST /stores/move` (`scope`), `/stores/:id/bring-in` (`prefix`, `scope`, `parent`) | `files.access` at the company, Owner | Move 10 of a location's files to its storage now; bring 100 files under a prefix into a folder |
| `GET /limits`, `PUT /limits` | `files.access`; `files.limits.manage` | The limits page's data; set `totalMb`, `everyoneMb`, `personMaxMb`, `warnPercent`, `rules` (audited `files.room-set`, 204) |
| `GET /items/:id/access`, `POST /items/:id/access`, `DELETE /access/:id`, `POST /items/:id/restrict` | `files.read` / `files.access`, Manage on the item | Entries here and above; give one (`whoKind`, `whoId`, `level`, `viewOnly`, `endsAt`; a second replaces the first); end one; restrict a folder |
| `POST /items/:id/copy`, `POST /bulk/trash` (100) | `files.write` | Copy (numbered, counted to room); trash many |
| `POST /folders`, `POST /uploads` (`path` makes folders), `PATCH /items/:id`, `POST /items/:id/trash`, `/restore` | `files.write` | Folder, upload, rename or move, trash, restore |
| `POST /items/:id/shares`, `DELETE /shares/:id` | `files.share` | A link (`days` ≤ 30, `maxDownloads`, `passcode`, `to`, answered `sent`); with `email`, a customer share (`days` ≤ 365, `tell`, answered `told`); with `request: true` on a folder, a file request; end one |
| `DELETE /items/:id`, `POST /bulk/purge` (100) | `files.purge` | Delete from the trash for good; many in one read and one batch |

Hooks: `GET`/`POST /hooks/files/s/:token` open a link and take its passcode; `GET`/`POST
/hooks/files/r/:token` show a file request and take what is sent.

**Audit.** Every change, with names and sizes, never content: `files.folder-create`, `-upload`,
`-copy`, `-update`, `-access-grant`, `-access-remove`, `-restrict`, `-trash`, `-restore`,
`-purge`, `-share`, `-share-revoke`, `-release`, `-version`, `-version-restore`; the system's
`files.share-download`, `-share-locked`, `-request-upload`, `-trash-empty`. Staff downloads and
previews too (`files.download`, `files.preview`), except picture previews and later video parts.

No Home card (it would count files beyond a person's reach). The check `files.storage` counts
files and bytes every 6 hours and warns past 8 GB of the bucket's free 10 GB, which backups share.

## Tables

| Migration | Adds |
|---|---|
| `0019_files.sql` | `files_items` (files and folders), `files_shares` (links: token hash, end, download limit and count) |
| `0040_files_customers.sql` | `files_shares.email` for a customer share, indexed in lower case |
| `0068_files_passcodes_and_room.sql` | A link's passcode hash and wrong-passcode count; an index by uploader with sizes |
| `0079_files_access.sql` | `files_access` (Manage entries: who, level, view only, end), `files_items.restricted` |
| `0080_files_stores.sql` | `files_items.store_id` (empty for the portal's bucket) |
| `0081_files_held.sql` | `files_items.held` (the reason) |
| `0082_files_versions_and_stars.sql` | `files_items.content_key` (empty is `files/<id>`), `files_versions`, `files_stars` |
| `0083_files_requests.sql` | `files_shares.request` |
| `0084_files_keep.sql` | `files_items.keep_days`, `files_items.hold`, indexed |

## Settings

All an Owner's to change; the limits and storage ones on Files, Limits or Storage.

| Key | Default |
|---|---|
| `files.max_upload_mb` | 25 (1 to 100) |
| `files.trash_days` | 30 (1 to 365) |
| `files.allowed_types` | `any` (or `documents and pictures`, `documents`) |
| `files.person_room_mb`, `files.person_room_max_mb` | 0, none (0 to 10240) |
| `files.total_room_mb` | 10240 (0 for none, up to 1048576) |
| `files.room_warn_percent` | 80 (50 to 100) |
| `files.location_stores` | every location in the portal's bucket |
| `files.room_rules` | none (`people`, `roles`, `places`: id to MB) |

## Errors

The module owns `KIT-E-2400` to `2499`; a missing or hidden item is the core's `KIT-E-0404`, a
change not allowed at the place `KIT-E-0403`.

| Code | When | Code | When |
|---|---|---|---|
| `KIT-E-2401` | Name taken in that folder | `KIT-E-2408` | The person's room is used |
| `KIT-E-2402` | Larger than allowed | `KIT-E-2409` | The location's room is used |
| `KIT-E-2403` | That folder cannot hold it | `KIT-E-2410` | The storage refused or failed |
| `KIT-E-2404` | Only the trash is emptied | `KIT-E-2411` | A storage connection still in use |
| `KIT-E-2405` | Only a file gets a link | `KIT-E-2412` | Held for review |
| `KIT-E-2406` | A program dressed as another kind | `KIT-E-2413` | Kept by a hold or keep days (409) |
| `KIT-E-2407` | A kind the setting does not allow | `KIT-E-2414` | Room for all files used (413) |
