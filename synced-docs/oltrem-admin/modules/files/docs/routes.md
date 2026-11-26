---
title: "@oltrem/files: The routes; Tables; Settings; Errors"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src; split from modules/files/README.md]
---

# @oltrem/files: The routes; Tables; Settings; Errors

> Part of [the @oltrem/files README](../README.md).

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /places` | `files.read` | the places the person may see, with each one's files and bytes |
| `GET /items` (`scope`, `folder`, `trash=1`) | `files.read` | a folder or the trash of a place, with what the person may do there and the days the trash keeps an item |
| `GET /items/:id`, `GET /items/:id/content` (`inline=1`) | `files.read` | one item with its path, links, the folders it may move to and the days the trash keeps it; the file itself, with a `Range` answered as 206 so a video seeks; in place (`inline=1`) a picture, PDF, sound or video, and any text (a text type, JSON, or a `.md`, `.csv`, `.log` and the like with no type) served as `text/plain` so it never runs, sandboxed (a PDF without the sandbox, which stops the browser's viewer, but with `default-src 'none'`) |
| `GET /items/:id/activity` | `files.read`, and Manage on the item (`files.purge` or `files.access` at its place, or a Manage entry) | the last 30 audit rows of the item, of a folder with what it holds (up to 200 items), each with `who`, the name the actor gave under Users (`users_profiles`, read once), and `level` on access given; with `format=csv` up to 1,000 as a CSV download (**Export (CSV)** under Activity), a cell that could run as a spreadsheet formula started with a quote mark |
| `PUT /items/:id/keep` (`keepDays`, `hold`) | `files.access`, and Manage on the item | a folder's days to keep its files; a legal hold on a folder or a file, or none |
| `GET /access`, bulk `end-access` (`POST /bulk/end-access`, up to 100 ids) | `files.access` | the access review; many entries ended in one batch with an audit row each, each refused alone when out of reach |
| `GET /held` | `files.access` | the files held for review at the locations the person manages, newest first |
| `GET /shared` | `files.read` | what Manage access gives the person, that they may see |
| `GET /starred`, `GET /recent`, `PUT /items/:id/star` (`on`) | `files.read` | what the person starred; the newest files at their locations; star an item they see, or take the star off |
| `POST /items/:id/versions` (the content as the body), `POST /items/:id/versions/:version/restore` | `files.write`, and Change on the file | a new version of a file; an earlier version back |
| `GET /links` | `files.share` | the open links and customer shares at the locations the person may see, those they made or may end, newest first (up to 200) |
| `POST /items/:id/release` | `files.access` at the item's location | release a file held for review |
| `GET /stores` | `files.access` | the storage connections (their bucket and where, last check, files and bytes kept), the S3 services one may join with their fields and steps, each location's choice, and whether the person may change them |
| `POST /stores` (`service`, `label`, `fields`), `POST /stores/:id/check`, `POST /stores/:id/key` (`fields`), `DELETE /stores/:id` | `files.access` at the company, and an Owner or the Vendor | join a bucket and check it; check again; paste the key again and check; remove a connection no location uses and no file is kept in |
| `POST /stores/move` (`scope`), `POST /stores/:id/bring-in` (`prefix`, `scope`, `parent`) | `files.access` at the company, and an Owner or the Vendor | move up to ten of a location's files and earlier versions to the storage it uses now (what moved, was missing and is left); bring up to a hundred of a bucket's files under a prefix into a folder (what came in, what was left out and why) |
| `GET /limits` | `files.access` | the limits set, the company's people (with what each uploaded), roles and the locations where the person holds `files.access` (with what each keeps), the room for all files and what the portal's bucket keeps, the most per person, the warning share, each person's room, and whether the person may change them (`files.limits.manage`) |
| `PUT /limits` | `files.limits.manage` | sets any of `totalMb`, `everyoneMb`, `personMaxMb`, `warnPercent` and `rules` at once, audited as `files.room-set`; 204 |
| `GET /items/:id/access` | `files.read`, and Manage on the item | its entries and those of the folders above it, whether it is restricted, and the company's people, groups and roles |
| `POST /items/:id/access` (`whoKind`, `whoId`, `level`, `viewOnly`, `endsAt`), `DELETE /access/:id`, `POST /items/:id/restrict` (`on`) | `files.access`, and Manage on the item | give an entry (a second for the same one replaces the first), end one, restrict a folder or open it again |
| `POST /items/:id/copy` (`parentId`), bulk `trash` (`POST /bulk/trash`, up to 100 ids) | `files.write` | a copy of a file, numbered like an upload, counted against the person's room; many items to the trash in one batch with an audit row each, each refused alone when out of reach |
| `POST /folders`, `POST /uploads` (`path` makes its folders, up to the depth), `PATCH /items/:id`, `POST /items/:id/trash`, `POST /items/:id/restore` | `files.write` | make a folder; upload; rename or move; trash; restore |
| `POST /items/:id/shares`, `DELETE /shares/:id` | `files.share` | make a link (`days` up to 30, `maxDownloads`, `passcode`, `to` to email it, with `sent` saying whether it went), or with `email` share it with that customer (`days` up to 365, no link; `tell: true` emails them, and `told` says whether it went); end one |
| `DELETE /items/:id`, bulk `purge` (`POST /bulk/purge`, up to 100 ids, 2026-11-25) | `files.purge` | delete from the trash for good; many at once in one read of their trees and one batch, an audit row each, each refused alone when not in the trash, kept, or out of reach |

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
`files_items` (each file and folder: its tenant, place, folder, kind, name, size, type, who changed
it and when, when it went to the trash) and `files_shares` (each link: its item, the hash of its
token, who made it, when it ends, its download limit and count, when it was ended). Migration
`0040_files_customers.sql` adds the address a share is for (`email`, empty for a link) and an index
on it in lower case, which a customer's account page reads by. Migration
`0068_files_passcodes_and_room.sql` adds a link's passcode hash and its count of wrong passcodes,
and an index on the files by who uploaded them with their sizes, which Room per person sums from the
index alone. Migration `0079_files_access.sql` adds `files_access` (each entry of Manage access: its
tenant, place, item, a person, group or role, the level, view only, the day it ends, who gave it and
when; one entry per item and who; indexed by place and by who) and `files_items.restricted`.
Migration `0080_files_stores.sql` adds `files_items.store_id`, the storage connection a file's
content is kept in (empty for the portal's bucket). Migration `0081_files_held.sql` adds
`files_items.held`, why a file is held for review (empty when it is not). Migration
`0082_files_versions_and_stars.sql` adds `files_items.content_key` (where a file's content is kept
since a new version; empty is `files/<id>`), `files_versions` (each earlier version: its file, key,
store, size, type, held reason, who changed the file before and when; indexed by file and time) and
`files_stars` (one row a person and item). Migration `0083_files_requests.sql` adds
`files_shares.request`, set for a file request. Migration `0084_files_keep.sql` adds
`files_items.keep_days` (the days a folder keeps its files, 0 for none) and `files_items.hold` (a
legal hold's reason, empty for none), with an index of the company's items that have either.

## Settings

| Key | Default | Who changes it |
|---|---|---|
| `files.max_upload_mb` | 25 (1 to 100) | an Owner |
| `files.trash_days` | 30 (1 to 365) | an Owner |
| `files.allowed_types` | `any` (or `documents and pictures`, `documents`) | an Owner |
| `files.person_room_mb` | 0, no limit (0 to 10240) | an Owner, or on Files, Limits |
| `files.person_room_max_mb` | 0, no cap (0 to 10240) | an Owner, on Files, Limits |
| `files.total_room_mb` | 10240 (0 to 1048576, 0 for no limit) | an Owner, on Files, Limits |
| `files.room_warn_percent` | 80 (50 to 100) | an Owner, on Files, Limits |
| `files.location_stores` | every location in the portal's bucket (location id to a storage connection's id) | an Owner, on Files, Storage (the Settings tab links there: `setOn`) |
| `files.room_rules` | no limits (`people`, `roles`, `places`, each id to MB, 0 to 10240) | an Owner, on Files, Limits (the Settings tab links there: `setOn`) |

## Errors

The module owns the `2400` to `2499` block: `KIT-E-2401` the name is taken in that folder,
`KIT-E-2402` the file is larger than the setting allows, `KIT-E-2403` that folder cannot hold it,
`KIT-E-2404` only the trash is emptied, `KIT-E-2405` only a file is shared by a link, `KIT-E-2406`
a program dressed as another kind of file, `KIT-E-2407` a kind of file the setting does not allow,
`KIT-E-2408` the person's room is used up, `KIT-E-2409` the location's room is used up, `KIT-E-2410` the storage where a file is kept refused
or failed, `KIT-E-2411` a storage connection still in use, `KIT-E-2412` a file held for review,
`KIT-E-2413` kept by a legal hold or a folder's days (409), `KIT-E-2414` the room for all files
is used up (413). An item that
is not there or not visible is the core's `KIT-E-0404`; a change the person may not make at the
item's place is the core's `KIT-E-0403`.
