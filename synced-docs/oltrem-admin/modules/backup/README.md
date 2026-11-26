# @oltrem/backup

Backups as the kit makes them. A flow in the client's one Workflow asks Cloudflare to export the
database, encrypts the dump to the vendor's age key on its way through the Worker, keeps it under
`backups/d1/` in the files bucket and checks it. The Worker holds only the public key, so it can
make a copy and never open one. A run copies the **database**, the **files** of the bucket, or both,
says where it is while it runs, and is a row the Backups page lists; Status says how old the newest
copy is. D1's Time Travel (any minute of the last seven days) stays the first answer; the copies
cover a deleted database, a lost account or a mistake found too late.

## Contents

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it; what a run does; the files; a second copy outside; the nightly extra; routes; health; the drill |
| [settings-and-secrets](docs/settings-and-secrets.md) | Settings and secrets; the table and the error codes; not built yet; tests |
