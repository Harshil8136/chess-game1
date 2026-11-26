---
title: "Continue with PostHog fixed: projects read the way PostHog allows"
status: record
owner: vendor
last_verified: 2026-11-26
sources: [this commit]
---

# Continue with PostHog fixed: projects read the way PostHog allows

**Changed.** After PostHog said yes, the portal asked for the list of all projects
(`/api/projects/`) to find their names. PostHog refuses that list (403) to a sign-in for chosen
projects: such a token may read only those projects' own addresses. The portal took the 403 for
"wrong region", asked the EU (401) and gave up with "The connection did not finish". Now it reads
each chosen project by its own address, a whole organization by that organization's list, and
everything by the list. It asks only the region PostHog names in its answer (`posthog_region`),
which the relay now passes on with the organizations allowed. Only a 401 means another region.
**Also.** The relay told any PostHog error apart from a cancel only by "error": a refused request
read as "You cancelled". Now only `access_denied` is a cancel; any other error is a failure, logged
by the relay (always kept) with PostHog's reason. A failure notice is said once: the frame drops
`?trip=` from the address, so a reload or Back no longer shows an old failure.
**Why.** The owner's second "Continue with PostHog" still failed. The relay logged nothing (its
exchange worked); the portal keeps one log in ten, so the reason was not there. PostHog's own
permission code (`APIScopePermission`) and OAuth docs showed the rule above.
**Before → after.** A sign-in for chosen projects (PostHog's default) always failed → it lists
them. Region guessed → named by PostHog.
**Checked.** `pnpm verify` green. The tests' PostHog now answers as PostHog does (403 on the list for
chosen projects) and fail on the old code. Phone test P1009. Not checked: a live sign-in.
