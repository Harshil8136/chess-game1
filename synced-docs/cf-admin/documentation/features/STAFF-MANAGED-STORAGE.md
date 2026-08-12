---

title: "Staff Managed Storage"
status: active
audience: [non-technical, ai, technical, operator]
last_verified: 2026-08-12
verified_against: [code, infra]
owner: harshil
related_code:
- src/pages/dashboard/storage/
- src/components/admin/storage/
- src/pages/api/storage/
- src/pages/api/storage/request/
- src/pages/api/storage/requests/
- src/lib/storage/
- src/lib/dal/StorageFileRepository.ts
- src/lib/dal/StorageFileRequestRepository.ts
- src/lib/dal/PortalSettingsRepository.ts
- src/workers/scheduled-asset-cleanup.ts
related_docs:
- ../architecture/ARCHITECTURE.md
- ../architecture/plac-and-audit.md
- USER-MANAGEMENT.md
- ../operations/OPERATIONS.md
- ../security/SECURITY.md
- ../runbooks/public-share-links-domain-isolation.md
- ../reference/coding-standards.md
- ../2026-08-06-data-infrastructure-audit-and-reuse-policy.md
tags: [feature, storage, r2, presigned-urls, plac, rbac, sharing, file-requests]

---

# Staff Managed Storage

> **TL;DR (non-technical):** A private file drive at `/dashboard/storage`, built into the admin portal, where staff keep documents, medical records, contracts, and media that don't belong on the public website. Everyone gets their own storage allowance sized to their role. Files stay private by default; a staff member can generate a time-limited, optionally passcode-protected link to share one file with an outside party (a vet clinic, a vendor) and can email that link directly from the app. The reverse direction also exists: a staff member can send a locked upload link asking an outside party to submit files *into* the drive (see [File Request Links](#6a-file-request-links-inbound)). Nothing here costs anything extra — it runs entirely on Cloudflare's free tier.

> **Status:** Production Active (shipped 2026-08-05; File Request Links sub-feature added 2026-08-09)
> **Surface:** `/dashboard/storage` (drive — includes both outbound share links and inbound file requests), `/dashboard/storage/inspect` (cross-user view), `/dashboard/storage/config` (defaults & overrides)
> **Role floor:** Staff or higher can use their own drive; higher tiers unlock cross-user and admin capability — see [Roles & Quotas](#3-roles--quotas) below.

---

## 1. What This Is, In Plain Language

Before this existed, staff had no sanctioned place to keep working documents — waivers, vaccination records, grooming photo sets, internal SOPs, vendor invoices — other than email attachments or personal devices. That's a compliance and security risk with no audit trail.

Staff Managed Storage gives every staff member a private drive inside the admin portal they already use. Upload a file, it's yours — nobody else can see it unless you explicitly share it or a manager/admin uses their cross-user inspection right to look. Storage space is capped per role so nobody can accidentally fill the account's free-tier allowance; an owner or admin can raise an individual's limit with a documented reason if they have a real need for more.

When a file needs to leave the building — a vet needs a pet's records, a vendor needs a signed contract — a staff member with the right permission generates a link. That link works without the recipient ever logging into the portal, expires automatically, can require a passcode, and can be emailed directly from the same screen. Every time someone uses that link, it's logged, so staff can see whether the vet actually opened the file yet.

## 2. How It Works, Step By Step

1. A staff member opens `/dashboard/storage` and drags a file in (or clicks to browse).
2. The system checks the file's extension against an allowed list and confirms the staff member still has room in their storage allowance.
3. The file is uploaded **directly from the browser to Cloudflare's storage** — it does not pass through the admin portal's own servers first. This matters for large files: video and big PDFs can be uploaded without hitting server-side size limits that would otherwise apply.
4. Once the upload lands, the system double-checks that the file's actual content matches what was claimed (so a renamed `.exe` pretending to be a `.pdf` gets rejected, not silently accepted), then records it in the drive.
5. The file now shows up in the staff member's "My Files" list with its size, and their quota gauge updates.
6. To share externally: open the file's share panel, pick how long the link should stay valid, optionally set a passcode, and either copy the link or type in an email address to have it sent automatically.
7. Once a week, a background job quietly checks that everything the drive thinks exists in storage actually does (and vice versa), and reports anything unusual to an admin — see [Weekly Reconciliation](#7-weekly-reconciliation).

## 3. Roles & Quotas

Every staff member gets a default storage allowance based on their role. These are the shipped defaults (an Admin or higher can change them portal-wide from the Configuration screen, or grant one specific person more room):

| Role | Storage allowance | File count | Can share files externally? | Max link lifetime |
|---|---|---|---|---|
| **Staff** | 1 GB | 500 files | No | — |
| **Manager** | 5 GB | 2,000 files | Yes | 24 hours |
| **Admin** | 25 GB | 5,000 files | Yes | 7 days |
| **Owner** | Unlimited | Unlimited | Yes | 30 days |
| **Vendor Support** (platform engineers) | Unlimited | Unlimited | Yes | 30 days |
| **Viewer** (read-only tier) | 0 (no drive) | — | No | — |

These numbers, plus the list of file types allowed to be uploaded, live in one shared settings record that an Admin+ can edit from `/dashboard/storage/config` — nobody needs a code change to raise a limit or add a new allowed file type.

**Individual exceptions.** If one person genuinely needs more room, or needs to upload a file type that's normally blocked (say, a `.svg` for a print vendor), an Admin+ can grant that specific person an override from the same Configuration screen. Every override requires a written reason and records who granted it — visible to any other Admin+ reviewing the list.

## 4. Where Files Live & Why That's Safe

Files are stored in their own dedicated Cloudflare storage bucket, completely separate from the bucket that serves the public website's images. This is a deliberate security decision: the public-facing bucket is wired up to a public web address so marketing images load fast for website visitors — but that same wiring means *anything* placed in that bucket becomes reachable by anyone who guesses or finds its address, forever. Staff documents include payroll records and pet medical files, so they live in a bucket with **no public web address at all**. The only way in or out is through the admin portal's own access checks, or a deliberately time-limited share link.

## 5. Keeping Bad Files Out

Two independent checks run on every upload:

- **Is this file type allowed?** The portal keeps an allow-list of extensions (documents, images, common video/audio, spreadsheets, zip archives). If Admin+ has granted a specific person an exception for something outside that list, that check runs too. If a file's extension isn't on either list, the upload is refused before anything is stored.
- **Does the file's content actually match what it claims to be?** A file's declared type (what the browser or the uploader says it is) can be spoofed — someone could rename a script to look like an image. The system reads the first few bytes of every uploaded file and checks them against the real, known byte signature for that file type (this is the same technique already used for years for the website's image uploads, just extended to cover documents, video, and audio too). A mismatch gets the upload rejected and the file deleted, not stored "just in case."

## 6. External Sharing

This is the feature most likely to touch someone outside the company, so it's worth walking through in full.

**Creating a link.** From a file's share panel, pick a lifetime (options are capped by the sharer's role — see the table in [§3](#3-roles--quotas)) and, optionally, a passcode the recipient will need to type in before they can download. Generating a link — or regenerating one — always replaces any previous link for that file; a file has at most one active share link at a time, so there's never ambiguity about which link is "the real one."

**Sending it.** Instead of copying the link and pasting it into a separate email, the share panel has a "email the link" box: type in the recipient's address and the portal sends a short, branded email with a download button, directly from the hotel's own email sending service. If a link is already active, this **resends the same link** rather than generating a new one — so a staff member can nudge a vendor who missed the first email without invalidating a link the vendor may have already bookmarked.

**Revoking.** A link can be killed immediately, before its natural expiry, from the same panel — useful if it was sent to the wrong address or the sharing need has passed.

**Seeing who's used it.** The share panel shows how many times the link has been opened and when it was last accessed, so staff aren't left wondering whether the recipient has actually seen the file.

**Who can do this.** Sharing (create/recreate/resend/revoke) requires Manager or higher — Staff can use their own drive but cannot generate external links, matching the judgment that link creation is a slightly more sensitive action than simply storing a file. Manager and Admin get shorter maximum link lifetimes than Owner by default, on the theory that longer-lived links sitting in someone's inbox are a bigger risk the higher they go unreviewed. An Owner can also grant one specific person permission to create longer-lived links than their role would normally allow, the same way any other individual permission is granted in this portal — without changing that person's role.

**Resolved 2026-08-06.** The admin portal requires staff to authenticate via Cloudflare Zero Trust Access for administrative areas (`/dashboard/*`). Public vendor share links (`/api/storage/share/[token]`) and RFC 8058 unsubscribe links are made accessible to external recipients on the single primary domain `secure.madagascarhotelags.com` via a dedicated Cloudflare Access Path-Based Bypass Policy. See [`runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md) for full configuration details.

## 6a. File Request Links (Inbound)

> Added 2026-08-09. This is the mirror image of §6: instead of a staff member sending a file *out*, this lets a staff member ask someone *outside* the company to send a file *in* — a vendor's signed W-9, a client's vaccination record, a contractor's invoice — without ever creating that person a portal account.

**Creating a request.** A Manager or higher (PLAC `#request-create`) opens the "File Requests" panel on their drive and fills in: who it's for (name + email), a title/note explaining what's needed, how many files are allowed (default 1), a per-file size ceiling, which file extensions are accepted, an expiry, and optionally a passcode. The system generates a locked upload link and can email it directly, the same way a share link can.

**What the recipient sees.** The link opens an unauthenticated upload page — no CF Access login, no portal account. They see the title/note, drag in a file (or files, up to the allowed count), and submit. Every upload is checked against the request's own extension allowlist and size ceiling (not the requester's personal drive settings), and the file's actual bytes are verified against its claimed extension exactly like a normal upload (§5) — a mismatch is rejected and nothing is stored.

**Where received files land.** Confirmed uploads are written straight into the *requesting staff member's* drive, in the folder the request specified (`/Requests` by default), tagged internally as coming from that request. They count against the staff member's own quota, not a separate pool.

**Fulfillment & limits.** A request tracks how many files it has received against its cap; once the cap is hit it flips to `fulfilled` and the link stops accepting uploads. Requests also expire on a schedule the creator sets, and can be revoked early the same way a share link can.

**Who can see what.** A Manager+ sees and manages the requests *they* created. Admin or higher (PLAC `#request-manage`) can view and revoke every file request link created across the organization — the same oversight pattern as `#admin-inspect` for the drive itself.

**Security model.** Deliberately built on the exact same primitives as vendor share links (§6), not a parallel mechanism: the same HMAC-signed, self-expiring token format (`src/lib/storage/share-token.ts`), the same magic-byte content verification on confirm, the same `storage_share_access_logs` telemetry table, and the same Worker-level `isPublicApiRoute()` treatment. See [`runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md) for the one open item on this: whether the Cloudflare Access edge bypass policy has actually been extended to `/api/storage/request/*` the way it was for `/api/storage/share/*` — unverified as of 2026-08-12.

**What this added, infrastructure-wise (RULE #0.6/#0.8/#0.9 compliance):** zero new environment variables (reuses the existing `R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`IP_HASH_SECRET` secrets already provisioned for §6's share links), and exactly **one** new D1 table (`storage_file_requests`, migration `0042`) — everything else (quota checks, extension allowlists, audit logging) reuses tables and repositories this feature already had. Two new PLAC rows (`#request-create`, `#request-manage`) were added to the existing `admin_pages` registry, not a new permission system.

## 7. Weekly Reconciliation

Every Sunday at 2 AM, alongside a cleanup job that already existed for the website's image library, a companion check runs over the staff storage bucket. It compares what's actually sitting in storage against what the drive's records say should be there, and looks for two kinds of drift:

- **A file exists in storage but the drive doesn't know about it** — usually because an upload started but was never confirmed (the browser closed, the connection dropped).
- **The drive has a record for a file that no longer actually exists in storage** — usually because someone deleted it directly through Cloudflare's own dashboard, bypassing the portal.

An Owner decides, from the Configuration screen, how the system should react when it finds either of these:

| Policy | What happens |
|---|---|
| **Log only** (default) | Nothing is deleted or changed. A report is generated for an Admin+ to review. |
| **Require review** | Same as log only today — the report is generated and flagged for manual attention; there is not yet a one-click "approve this cleanup" button, so acting on the report is still a manual step via the cross-user Inspect screen. |
| **Auto-delete** | The system cleans up both kinds of drift automatically, no human involved. |

Whichever policy is active, one thing always happens regardless: if a file's recorded size doesn't match its actual size in storage, that's corrected automatically every week — that correction is harmless (it only ever fixes a display number) and never deletes anything.

The latest run's results — how many issues of each kind were found, and what (if anything) was done about them — are visible to Admin+ on the Configuration screen.

## 8. Admin Capabilities

Beyond their own drive, higher roles get three additional screens:

- **Inspect** (`/dashboard/storage/inspect`, Manager+) — look up any staff member's files by their user ID, read-only. Used for oversight, not day-to-day file management.
- **Configuration** (`/dashboard/storage/config`, Admin+) — edit the portal-wide storage defaults (allowances, allowed file types, link lifetimes), grant or remove individual overrides, and (Owner only) set the weekly reconciliation policy.
- **Reconciliation report** — the weekly run's results, described above.

Every one of these is gated by the portal's existing permission system, the same one used everywhere else in the admin portal — nothing here invented a separate set of rules.

## 9. What Changed From the Original Plan

This feature was originally scoped as a much heavier build. During implementation, a deep review against the live codebase found the original plan didn't actually fit this project — it assumed a database and upload architecture the portal doesn't use, and one piece of it (a dedicated weekly cleanup schedule) literally could not be added because Cloudflare's free plan only allows three scheduled jobs per project and all three were already spoken for. The team's own standing instruction was also to stop creating new database tables for every feature and reuse what already exists wherever possible. The version that shipped reflects all of that:

| | Originally planned | What actually shipped |
|---|---|---|
| New database tables | 6 | **1** — everything else reuses tables the portal already had |
| Upload method | A general-purpose cloud toolkit, unused anywhere else in this codebase | A 6-kilobyte library built specifically for this exact job, matching what Cloudflare's own documentation recommends |
| Weekly cleanup | A brand-new scheduled job | Folded into the cleanup job that already runs every Sunday |
| Storage location | Unspecified | A brand-new, private storage bucket, kept deliberately separate from the bucket that serves the public website |

None of this changed what staff actually experience — the feature works exactly as originally envisioned. It changed how much new infrastructure had to exist to deliver it.

## 10. Known Limitations (as of 2026-08-12)

Written down honestly rather than left to be discovered:

- **One active share link per file at a time.** Creating a new link replaces the old one. If a file genuinely needs to go to multiple external recipients with independent, individually-revocable links, that's not supported yet.
- **No resumable/chunked upload.** A single file upload is a single continuous transfer, capped at 5 GB. This comfortably covers documents, photos, and most video, but there's no support for pausing and resuming a very large transfer.
- **Folders are lightweight.** Creating an empty folder with nothing in it yet won't survive a page refresh — folders exist as a property of the files inside them, not as their own stored thing.
- **"Require review" doesn't yet have a one-click action.** As described in §7, it currently behaves the same as "log only" — an Admin+ has to act on the weekly report manually via Inspect rather than clicking an "approve cleanup" button.
- ~~**External sharing needs one more manual setup step.**~~ Resolved 2026-08-05 — see [`runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md).
- **File Request Links' Cloudflare Access bypass status is unverified (flagged 2026-08-12).** The Worker code has treated `/api/storage/request/*` as public since launch, but it's unconfirmed whether the Zero Trust Access dashboard policy was actually extended to that path the way it was for `/api/storage/share/*`. If it wasn't, external recipients get a CF Access SSO wall instead of the upload page — see [`runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md) for how to check and fix.
- **File Request Links have no passcode option.** Unlike outbound share links, an inbound request link isn't passcode-protectable — the token itself is the only gate, since the recipient is fixed at creation time by email rather than by a shareable public link.

## 11. Where Things Live (for engineers / AI agents)

No database schema here by design — see the migration files themselves (`migrations/0037`–`0039`, `0041`–`0042`) for exact table structure. This section is a map, not a reference.

- **Pages:** `src/pages/dashboard/storage/` (drive, inspect, config — File Request Links have no dedicated page, they're a panel inside the drive page itself)
- **UI components:** `src/components/admin/storage/` — File Request Links: `CreateFileRequestModal.tsx`, `FileRequestsTable.tsx`, `RequestDetailsModal.tsx`
- **API routes:** `src/pages/api/storage/` (presign/confirm/list/quota/download/rename/delete, `[id]/share/*`, `share/[token]` for the public share link, `admin/*` for inspect/config/overrides/reconciliation) — File Request Links: `request/[token]/{index,presign,confirm}.ts` (public, recipient-facing) and `requests/{index,[id]}.ts` (authenticated, staff-facing create/list/revoke)
- **Shared logic:** `src/lib/storage/` (config resolution, magic-byte signatures, share-token signing — reused as-is for request tokens, share email)
- **Data access:** `src/lib/dal/StorageFileRepository.ts`, `src/lib/dal/StorageFileRequestRepository.ts` (the one new table this sub-feature needed), and the scoped-config methods added to `src/lib/dal/PortalSettingsRepository.ts`
- **Weekly job:** `src/workers/scheduled-asset-cleanup.ts` (`reconcileStaffStorage`), wired into the Sunday branch of `src/workers/cf-entry.ts`
- **Permissions:** standard PLAC rows under `/dashboard/storage` and its `#` sub-features, including `#request-create`/`#request-manage` — see [plac-and-audit.md](../architecture/plac-and-audit.md) for how the permission system itself works.

## 12. Related

- [`runbooks/public-share-links-domain-isolation.md`](../runbooks/public-share-links-domain-isolation.md) — how external sharing and unsubscribe links are made reachable without Cloudflare Access
- [`architecture/plac-and-audit.md`](../architecture/plac-and-audit.md) — how roles and per-user permission grants work portal-wide
- [`reference/coding-standards.md`](../reference/coding-standards.md) — the universal scoped-config pattern this feature established for future features to reuse
- [`operations/OPERATIONS.md`](../operations/OPERATIONS.md) — bucket and secret registry
- [`2026-08-06-data-infrastructure-audit-and-reuse-policy.md`](../2026-08-06-data-infrastructure-audit-and-reuse-policy.md) — the live D1/Supabase table inventory and RULE #0.6/#0.8/#0.9 reuse policy this feature (and File Request Links) were built to follow
