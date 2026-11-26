---
title: "Files: Versions, Starred and Recent, batch 5 (2026-11-23)"
status: record
owner: vendor
last_verified: 2026-11-23
sources: [modules/files/src/drive.ts; modules/files/src/module.ts; modules/files/src/pages.tsx; modules/files/migrations/0082_files_versions_and_stars.sql; modules/files/test/files.test.ts; modules/files/test/pages.test.ts]
---

# Files: Versions, Starred and Recent, batch 5

> **In plain words.** The owner asked for a file manager as good as the modern ones (23 November).
> A file can now get a new version without losing its name, location or links, and the last ten
> earlier versions can be brought back with one press. Each person can star files and folders to
> find them under **Files, Starred**, and **Files, Recent** shows what changed most lately.

## What changed

| Part | Before | Now |
|---|---|---|
| Replacing a file | upload again: a second file, numbered | Upload a new version: same file, the one before kept |
| Earlier content | gone | the newest ten earlier versions, each with Restore |
| Finding files | by folder or search | also Starred (per person) and Recent (newest at the person's locations) |
| Data | | migration `0082`: `files_items.content_key`, `files_versions`, `files_stars` |

```mermaid
flowchart LR
  N[New version uploaded] --> J{Judged and checked as an upload}
  J -->|refused| X[Nothing changes]
  J -->|kept, maybe held| K[Stored under its own key]
  K --> F[File row points at the new key]
  F --> V[The old content becomes a version row]
  V --> P{More than ten versions?}
  P -->|yes| D[Oldest version's content and row deleted]
```

Before, a file's content always sat at `files/<id>`, so a new upload had to be a new file. Now
each file row says which key holds its current content, so a new version is a new key and the old
key is kept as a version until ten newer ones push it out.

## Left for later

- Downloading an earlier version without restoring it (Restore can be undone by restoring again).
- Counting earlier versions in the rooms and the storage check.
- File requests (people outside the portal uploading into a folder by link): the next batch.

## How it was checked

The module through the pipeline beside IAM on real D1 and the test bucket (a new version under the
same name, refused without Change and as a disguised program, restored with the one it replaced
kept, ten kept with the older content gone from the bucket, every version's content gone with the
file, a held version and the clean one restored, a star for the person alone, Starred, Recent
leaving out another location's files); the pages (Star, Versions with Restore and the upload, the
two lists); then `pnpm verify` (its summary in the commit). Not run on a deployed portal, against
an outside S3 bucket or on a phone: P488-P491 in [their own list](../../docs/phone-tests-files.md).
