---
title: "@oltrem/files: the trash, the pages, search"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src/drive.ts, pages.tsx, module.ts]
---

# @oltrem/files: the trash, the pages, search

> Part of [the @oltrem/files README](../README.md).

## The trash

The trash hides an item and everything in it, and ends its links. Restore puts it back in its
folder (or the top of its place when the folder is gone), numbered on a clash. Only a trashed item
is deleted for good (`KIT-E-2404`), with its contents, content and links. The daily job
`files.empty-trash` deletes what has stayed past `files.trash_days` (30), 100 a run, then removes
link rows ended a month ago; its check counts and deletes nothing.

## The pages

Every page of Files has one title, "Files"; the marked chip says where you are. Each list or part
is a card headed by a coloured tile, its name and a count.

| Path | Shows |
|---|---|
| `/files` | The page's own menu row under the head (never the sidebar): the places, Starred, Recent, Shared with me, Shared links, Trash; under More, Access review, Held for review, Limits and Storage for whoever manages access; the storage meter. The folder panel: the path (each folder a drop target), its counts and size, a search box, Type chips (`?type=`, with two kinds or more), Sort (`?sort=`, `-` for largest or newest), List or Grid (`?view=grid`) and **New** (Upload files, Upload a folder, New folder). Rows: a kind-coloured tile, name, short date, size; ticks on hover or touch; the bulk bar (trash, **Move**) only while ticked; a row menu (also right click); held files marked. A name opens the details panel (`?item=`): preview, type in words, size, who changed it when in the viewer's zone (`oltrem_tz`), Download, **Who has access** and Activity for those who may. With the script: drop or paste to upload with a bar each and Stop, drag rows into folders, F2 opens, Delete trashes; without it the form works. After a trash, **Undo** with the days left |
| `/files?show=held` | Held files at the person's locations, with why, Release and Move to the trash |
| `/files?show=shared`, `starred`, `recent` | Shared with me; Starred; Recent |
| `/files?show=access` (`ends=soon`, `ends=ended`) | The access review (below), with ticks and **End access** |
| `/files?show=links` | Open links and customer shares the person made or may end, with **End it** |
| `/files/:id` | One item: Star, a More menu (rename, move, copy, new version, trash, restore, delete for good behind a confirm) and one filled button (Download; Open when View only; none when held; Open the folder). Its preview, **Who has access** (general access with Restrict, a row per person, group or role with its level, inherited entries with Change it there, Add people in a dialog: who as a sideways row, a level, View only, Ends on) and Activity; cards for details, links, customers, file requests, versions and Keep, each form in a dialog |

In the trash, rows can be ticked and deleted for good, and **Empty the trash** deletes up to 100 a
press after a confirm. **Move** names every folder of the place by its path (`Accounts / 2026`).
Ending a link, request or customer share asks first. A folder's search offers **Search all of
Files**. A kept file is not offered Move or the trash. A missing file offers Back to Files.

## Search

The portal's search (`GET /api/files/search?q=`, `files.read`) finds files and folders by name,
folders first, in the places the person's roles reach, never in the trash or inside a file.
