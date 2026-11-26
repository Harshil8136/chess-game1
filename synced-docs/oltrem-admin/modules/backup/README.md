# @oltrem/backup

Backups as the kit makes them (plan sections 4.4 and 9.3). Every night a flow in the client's one
Workflow asks Cloudflare to export the database, waits for the dump, encrypts it to the vendor's
age key on its way through the Worker and keeps it under `backups/d1/` in the files bucket. The
Worker holds only the public half of that key, so it can make a copy and can never open one. Each
run is a row the backup page lists, and a check on Status says how old the newest copy is.
Time Travel, D1's own restore to any minute of the last seven days, stays the first answer; the
copies cover what it does not: a deleted database, an account lost, a mistake found too late.

A run copies what was chosen: the **database**, the **files** of the files bucket, or both. Each run
says where it is while it runs, and checks every copy it stored before it calls itself done. The
Backups page (`@oltrem/screens`) is where the choice is ticked and Back up now pressed.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; What a run does; Routes; Health; The restore drill |
| [settings-and-secrets](docs/settings-and-secrets.md) | Settings and secrets; Not here yet; The table and the error codes; Tests |
