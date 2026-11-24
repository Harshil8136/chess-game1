---
title: "Phone tests owed: Files"
status: living
owner: vendor
last_verified: 2026-11-24
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
| P484 | As a clerk: upload a zip that has a program (.exe) inside | It uploads, and the list shows it with "· Held for review"; its page says why, with no Download and no links | [record](records/2026-11-23-files-safety.md) |
| P485 | As the Owner: open that file's page | The same notice, and Release in the buttons; Release says "The file was released" and Download works | [record](records/2026-11-23-files-safety.md) |
| P486 | Upload a PDF made with a form button or JavaScript (or a zip with a password) | Held for review, with the reason in words | [record](records/2026-11-23-files-safety.md) |
| P487 | Files, Shared links (left on a computer, the chip row on the phone) | Every open link with its file, location, who made it, downloads and end date; End it removes it from the list | [record](records/2026-11-23-files-safety.md) |
| P488 | A file's page: Upload a new version, pick another file | "The new version was uploaded"; Download gives the new content under the same name; Versions lists the one before with who and when | [record](records/2026-11-23-files-versions.md) |
| P489 | Restore on that earlier version | "That version is back"; Download gives the old content; Versions now lists the one it replaced | [record](records/2026-11-23-files-versions.md) |
| P490 | Star on a file, then Files, Starred (left on a computer, the chip row on the phone) | The file is listed with its location; signed in as someone else, their Starred does not show it | [record](records/2026-11-23-files-versions.md) |
| P491 | Files, Recent | The files changed most lately at your locations, newest first, with the one you just changed near the top | [record](records/2026-11-23-files-versions.md) |
| P492 | A folder's page: File requests, 7 days, Files it takes 3, a passcode, Make a file request | "The file request was made" with the link and Copy; the request listed with 0 of 3 files received | [record](records/2026-11-23-files-requests.md) |
| P493 | Open that link in a private window on the phone | A plain page "Send files to" the folder, with Your name, Passcode and Files; no sign-in | [record](records/2026-11-23-files-requests.md) |
| P494 | Fill in your name and the passcode, pick two files, Send | "Received, thank you" with both names; in the folder they show "your name (file request)"; the request shows 2 of 3 | [record](records/2026-11-23-files-requests.md) |
| P495 | End the request (on the folder's page or Files, Shared links), then open the link again | "This link has ended" | [record](records/2026-11-23-files-requests.md) |
| P496 | A file with an earlier version: on its page, Download on that version | The earlier content downloads; the file itself still gives the newest | [record](records/2026-11-24-files-tidy.md) |
| P497 | Files, Limits: a location's room just above its files; upload a new version of a big file there, then another file | The new version is taken; the next upload is refused with "This location's room for files is full" | [record](records/2026-11-24-files-tidy.md) |
| P498 | As the Owner: give two people access to a folder, one ending in 3 days; then Files, Access review | Both listed with the folder, location, level and "given by" you, the one ending soonest first; Ends within 14 days shows only that one | [record](records/2026-11-24-files-access-review.md) |
| P499 | Tick both, End access, confirm | "End access" done for 2; the list is empty of them; signed in as them, the folder is gone again | [record](records/2026-11-24-files-access-review.md) |
| P500 | Make a file request on a folder, then send a file through it from a private window | You get an email "Files were sent to" the folder, with the sender's name and the file's name | [record](records/2026-11-24-files-access-review.md) |
| P501 | Open a folder's details (the pane), Activity, Export (CSV) | A file activity.csv downloads and opens in a spreadsheet: When, Who, What, Outcome, Name | [record](records/2026-11-24-files-access-review.md) |
| P502 | As the Owner: a folder's page, Keep, Keep each file for 30 days, Save; then Move to the trash on a file in it | "Saved"; the file's page says "Kept until" a date; the trash is refused with "This is kept and cannot be deleted yet" | [record](records/2026-11-24-files-keep.md) |
| P503 | On another folder: Legal hold reason "Audit", Save; try to trash it, and move a file out of it | "On legal hold" on its page and its files' pages; both refused | [record](records/2026-11-24-files-keep.md) |
| P504 | Empty the reason and set No rule on both, Save; trash them again | Both go to the trash | [record](records/2026-11-24-files-keep.md) |
| P523 | Files on a computer, then More, Access review, Limits and Storage in the sidebar | The Files menu sits in the portal's sidebar under Files, with no second sidebar and no row of chips across the top; the page takes the full width and the page you are on is marked | [record](records/2026-11-24-files-makeover.md) |
| P524 | Files on the phone, inside a folder with files | Each file is one short row: a coloured icon, the name, and the size and date under it; the row of chips at the top scrolls sideways | [record](records/2026-11-24-files-makeover.md) |
| P525 | Press New, then New folder; then New, Upload files | A menu with Upload files, Upload a folder (computer) and New folder; the folder is made; the files upload with a bar each | [record](records/2026-11-24-files-makeover.md) |
| P526 | Tick one file (on a computer, hover a row to see its tick) | The bar with Move to the trash appears only then; untick it and the bar goes | [record](records/2026-11-24-files-makeover.md) |
| P527 | Press a file's name | Its details open over the right side with the rest dimmed; the X or a press outside closes them | [record](records/2026-11-24-files-makeover.md) |
| P528 | Files, Settings tab | One plain list: each setting's name and a short line on the left, its box on the right (stacked on the phone), no card or repeated heading; the last two rows have "Change it on its own page", which opens Limits and Storage | [record](records/2026-11-24-files-makeover.md) |
