---
title: "@oltrem/files: Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/files/src; split from modules/files/README.md]
---

# @oltrem/files: Tests

> Part of [the @oltrem/files README](../README.md).

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company with two
places under it, four roles and five people: the manifest; names; the places each person sees;
a folder and two uploads with the same name numbered; another place's files not found and not
writable; a role given at the place opening its files at once; the download's headers and an
image in place; an upload over the limit refused; a rename and a move, never into itself; links
counted, ended at their limit, by hand, at their day and by the trash; the trash, a restore, and
a delete for good of a folder with its content; the job; every change audited without content;
the storage check; a file shared with a customer for a year without a link, a link over 30 days
and a bad address refused, listed and opened for that address only and in that company only, hidden
while its folder is in the trash and back when restored, gone when ended by hand or at its day,
the newest twenty with more, the download audited without the address; the email only when asked,
and the share kept when the email fails; the trash's days answered with a folder; a program
dressed as a picture or a text refused whatever the settings, Allowed types narrowing the rest,
Room per person counted for each one, a link's passcode page, a wrong passcode and the right one,
the tenth wrong one locking the link with its audit row, a link emailed without its passcode and
its address in the share's audit row, and the room's sum read from its index alone; folders made from an upload's path once and refused past
the depth, a copy numbered with its content, many trashed at once with one refused, a download
and a text preview audited but a picture's preview not, a range answered with 206, and the
Activity refused to a clerk; Manage access: a restricted folder hidden from a clerk and a keeper
and back once listed, by name or through a group, its audit rows; None hiding one file from one
person, bulk trash refusing it, and back once removed; View only for someone from another place,
under Shared with me, no download but a preview, gone the day it ends; giving access refused
without `files.access`, to someone unknown, and Restrict on a file (`test/access.test.ts` decides
the rules on their own); a zip with a program held, refused to download, link and copy, released
only by Manage and opened after, a plain zip not held, a name with a direction mark refused, and
Shared links listing a link for whoever may share and dropping it once ended (`test/safety.test.ts`
reads zips, PDFs and names on their own); a new version kept under the name, refused to someone
without Change and as a disguised program, restored with the one it replaced kept, ten kept with
the older content gone from the bucket and every version's content gone with the file, an earlier
version downloaded on its own and an unknown one not found; a new version that can run held, the
clean one downloaded and restored; earlier versions counted in a location's room; a star for the person alone, Starred,
Recent leaving out another location's files; a file request made on a folder only and by someone
who may share there, its token never opening as a link, its page, a passcode asked and a wrong one
refused, a name needed, two files received with one held and the name escaped, a disguised
program refused, the files past its count refused and the request then gone, one ended by hand,
its maker emailed once with what came; the access review for whoever manages access only, the
soonest end first, End access in bulk with an unknown entry refused alone and an audit row each;
a folder's activity as CSV with a formula cell made plain; a folder's days refusing the trash,
a move and bulk trash until lifted, set only on a folder and by whoever manages access; a legal
hold refusing delete for good and the trash's job, holding its folder through what is inside and
keeping all twelve versions. The pages,
against answers of the API (`test/pages.test.ts`): a share refused for an address that is not a
customer and in a portal without Customers, the email said to be queued, the Copy button, Undo
after the trash and the trash's days, one file and many files, a link's passcode and email sent
on, a link's passcode, last download and Locked shown, and the file manager: folders first in the
order picked, the tree, the upload boxes, the bulk bar, the grid and the details pane with its
Activity and its Export (CSV) link, the access review with its filters and ticks, the Keep
notice and form, and a copy made in the same folder. The client template's
screens test runs the pages: an upload from the form, a folder, a move, a link opened and ended by
the trash, and a file shared with a customer, who is emailed and downloads it from their account
page.

The storage tests, against an S3 bucket in memory that answers only signed calls: the address built
from the definition, put, get, a part and a delete each signed with a checksum on the delete, the
six checks passing and versioning noted, a public bucket failing the private check and a key that
may not list stopping at the first; through the pipeline, a location's upload kept in the bucket and
not in the portal's, opened whole and in part, copied there, still opened after the choice changed,
and deleted there for good; a service down refusing the upload with `KIT-E-2410` and no row; the
Storage view for an Owner and refused to a clerk, a bucket joined and checked, a data service
refused, a connection in use refused with `KIT-E-2411` and removed once free; the page offering only
checked connections and saving the choice as the setting. Move and Bring in: a location's files
moved ten a press until none is left, then opening from the bucket and gone from the portal's; a
bucket's files brought in once, a program held, a second press skipping them; both refused to a
clerk; the page's Move and Bring in forms and their words.

The limits tests: a person's own room winning over a role's, a role's over everyone's and a role
without a limit lifting it; a location's room refusing an upload and a copy while another location
takes it; `GET /limits` with what each keeps for an Owner and refused without `files.access`; the
Limits page listing by name, saving one more as the setting, and no form for someone who is not an
Owner.

The search test finds names only in the places a person's roles reach, folders first, and takes `_` as a letter.
