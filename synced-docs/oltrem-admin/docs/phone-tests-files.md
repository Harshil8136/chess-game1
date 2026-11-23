---
title: "Phone tests owed: Files"
status: living
owner: vendor
last_verified: 2026-11-23
sources: [docs/records/2026-11-23-files-explorer.md; modules/files/README.md; the records each line links]
---

# Phone tests owed: Files

> **In plain words.** The phone tests still owed on the Files page from its rebuild on 23 November
> on, kept in their own list so each list stays small enough to read whole. They run the same way,
> and a passed or failed line moves to [Phone tests owed](phone-tests.md)'s "Passed" or "Failed,
> to fix" with the date.

## Owed

| # | Open | You should see | From |
|---|---|---|---|
| P447 | Work, Files on a computer | The folders of the place on the left with a storage bar under them, the list in the middle with Name, Changed and Size to sort by, List and Grid at the top right | [record](records/2026-11-23-files-explorer.md) |
| P448 | Files on the phone: Upload, pick three files | A panel at the bottom with one bar per file filling up; when all are done the folder shows them | [record](records/2026-11-23-files-explorer.md) |
| P449 | On a computer: drag two files from your desktop onto the list; then drag a folder of files onto it | Both upload with their bars; the folder comes with its own folders inside, made once | [record](records/2026-11-23-files-explorer.md) |
| P450 | Tick two files and drag them onto a folder in the left tree | "Moved", and both are inside that folder | [record](records/2026-11-23-files-explorer.md) |
| P451 | A file's three dots, Make a copy | "Copied", and a copy named "name (2)" beside it | [record](records/2026-11-23-files-explorer.md) |
| P452 | Press a file's name (a PDF, a picture, a video) | A details pane with the preview (the video plays and seeks), its facts, Download and its Activity | [record](records/2026-11-23-files-explorer.md) |
| P453 | Tick three files, Move to the trash | "Moved to the trash" for all three; Trash lists them | [record](records/2026-11-23-files-explorer.md) |
| P454 | As a clerk without Delete for good: open a file's details | No Activity list; as the Owner the same file lists who downloaded or previewed it | [record](records/2026-11-23-files-explorer.md) |
| P463 | As the Owner: a folder's three dots, Rename, move or share; Manage access, Restrict this folder | "The folder is restricted…"; signed in as someone with only a role at that location, the folder is gone from the list, the tree and search | [record](records/2026-11-23-files-access.md) |
| P464 | As the Owner on that folder: Who, pick that person, Level View, Give access | "Access was given"; as them, the folder is back | [record](records/2026-11-23-files-access.md) |
| P465 | On one file: Who, a person, Level None (hide it), Give access | As them, the file is gone; Remove the entry and it is back | [record](records/2026-11-23-files-access.md) |
| P466 | On a folder: a person from another location, View, tick View only, Ends on tomorrow, Give access | As them, Files, Shared with me lists the folder; a file in it shows Open and no Download | [record](records/2026-11-23-files-access.md) |
| P467 | As someone without Change who has access: open a file's details page | No Manage access section | [record](records/2026-11-23-files-access.md) |
| P475 | As the Owner: Files, Limits (left on a computer, the chip row on the phone) | The limits set (none at first), with "everyone's" room from Settings; a form For and Room, in MB | [README](../modules/files/README.md#limits-per-person-role-and-location-2026-11-23) |
| P476 | For: a person, Room 1, Set the limit; as them upload a file over 1 MB | "The limit was set"; their upload is refused with "Your room for files is full" | [README](../modules/files/README.md#limits-per-person-role-and-location-2026-11-23) |
| P477 | For: a location, Room 1; upload a file over 1 MB there | Refused with "This location's room for files is full"; another location still takes it | [README](../modules/files/README.md#limits-per-person-role-and-location-2026-11-23) |
| P478 | Remove both limits; as someone with Manage access who is not an Owner, open Limits | Both gone; for them the list shows, with "Only an Owner changes the limits" and no form | [README](../modules/files/README.md#limits-per-person-role-and-location-2026-11-23) |
| P479 | As the Owner: Files, Storage | Where files are kept (every location on This portal's storage), Storage connections (none), and a sideways row of services | [record](records/2026-11-23-files-storage.md) |
| P480 | Pick Cloudflare R2 (or another you have), follow the steps, paste the fields, Join and check | "The storage was joined and checked", and six lines starting OK (or a Note for versioning) | [record](records/2026-11-23-files-storage.md) |
| P481 | Set one location to that bucket, Save; upload a file there and open it | "Saved"; the file uploads and opens; in the service's own dashboard it is in the bucket under files/ | [record](records/2026-11-23-files-storage.md) |
| P482 | Set the location back to This portal's storage; open that file again | It still opens: a file stays where it was stored | [record](records/2026-11-23-files-storage.md) |
| P483 | Remove the connection while that file is kept there | Refused with "This storage still keeps files"; delete it for good from the trash, then Remove works | [record](records/2026-11-23-files-storage.md) |
