---
title: "Settings and Configuration"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-28
verified_against: [code, local-test]
owner: harshil
related_code: [src/pages/dashboard/settings/index.astro, src/pages/dashboard/configuration.astro, src/lib/configuration.ts, src/pages/api/configuration.ts, src/pages/api/settings/user.ts, src/components/admin/configuration/ConfigurationPanel.tsx, src/components/admin/configuration/WebsiteLimits.tsx, src/components/admin/configuration/CloudflareSection.tsx, src/lib/control-plane/website-limits.ts, src/pages/api/configuration/limits.ts, src/pages/api/configuration/cloudflare.ts, src/components/admin/settings/UserSettingsPanel.tsx, src/components/admin/settings/OtherProfilesPanel.tsx, src/components/admin/settings/SettingsHeader.tsx, src/components/admin/settings/AccessPanel.tsx, src/components/admin/settings/AskForPermission.tsx, src/components/admin/settings/TestingPassPanel.tsx, src/pages/api/settings/testing-pass.ts, src/components/admin/settings/settingsView.ts, src/styles/pages/settings.css, src/styles/components/console.css, src/lib/access-center/your-access.ts, src/lib/access-center/your-consoles.ts, public/scripts/theme-init.js, migrations/0068_configuration_page.sql, migrations/0069_settings_cleanup.sql, migrations/0083_configuration_cloudflare.sql]
related_docs: [../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, CONTROL-PLANE.md, EMAIL-PORTAL.md, USER-MANAGEMENT.md, ../architecture/GLOBAL-CONFIG.md, ../MAINTENANCE.md]
tags: [settings, configuration, plac, theme, profile]
---

# Settings and Configuration

> **TL;DR (non-technical):** **Settings** is each person's own page: their name, their theme
> (light, dark, or the phone's own), and a list of what their access lets them open and do.
> Someone allowed to may also change the names of people below them there. **Configuration**
> is where the few portal-wide settings live that belong to no single feature, each with a plain
> name, an allowed range and a default; the website's request limits; the Cloudflare tools
> (the site's security level, emptying the website's cache, what the account holds); and a list
> of the pages that hold every other setting.

Both were rebuilt on 2026-10-10 at Harshil's request. Until then Settings held the portal-wide
settings as free text, a Feature Flags tab whose flags nothing read, and a Modules list that
repeated the Page Registry; all three are gone.

## Settings (`/dashboard/settings`)

Every role may open it (stored role `staff` since migration `0069`).

**How it looks** (rebuilt the same day on the console kit, `src/styles/components/console.css`,
in violet, with the page's own rules in `src/styles/pages/settings.css`; the story is in the
change record (private)). A
header with the page's name and description from the page registry, then up to three tiles,
each a link to the section it counts: **Pages you can open**, **Extra actions** and, with
`#others`, **People you can rename**. Every number comes from what the page already read
(`accessTotals` and `editablePeople` in `src/components/admin/settings/settingsView.ts`); a
count that could not be read shows a dash and "Could not be read just now", never a zero. The
sections follow one under another on a phone, and in two columns from 1024 px wide, with Your
access on the right. The header and Your access render on the server with no script; only Your
profile, Testing pass, Other people and Your access's **Ask for a permission** button are islands.

- **Your profile.** Who you are (initials, name, email, role), your name with its own **Save
  name** button, and your theme as three choices side by side: Light, Dark and System. A name
  that is too short or too long says why before you save. A theme goes on screen as soon as it
  is picked; if the save fails, the previous one comes back with the reason. *System* follows the
  device's light or dark mode, read by `public/scripts/theme-init.js` before the page paints, so
  there is no flash. Your theme is a row in D1 `admin_user_settings`, copied to the
  `cf_admin_theme` cookie; your name is `display_name` in Supabase `admin_authorized_users`, and
  your session shows the new name at once.
- **Testing pass**, Vendor support only (since 2026-10-17, the owner's choice). Dangerous
  changes ask for a sign-in from the last 10 minutes ("Confirm it's you",
  [PERMISSIONS-SYSTEM §10.5](../architecture/PERMISSIONS-SYSTEM.md)), which stops someone testing
  all day every few minutes. In the first 10 minutes after signing in, three choices side by side
  start a pass for **1 hour**, **4 hours** or **8 hours**; later, a **Sign in again** button
  signs out and comes back to Settings. While a pass is on, the panel shows "On until" a time of
  day and the time left, with **End pass**. It covers that browser only, in the portal and the
  Backups, Server and Email API consoles, and ends with a sign-out or the session's end. The page
  sends times left rather than clock times, so a phone whose clock is off still counts down
  correctly (`TestingPassPanel.tsx`, `testingPassState` in `settingsView.ts`). Both go to
  `POST` and `DELETE /api/settings/testing-pass`, and each is in the Audit Log.
- **Your access.** The pages and actions your role and your grants allow, grouped as the
  sidebar groups them and in the sidebar's colours (`src/lib/access-center/your-access.ts`, from
  the page registry and your access map). Each page is a link chip; the extra actions are listed
  under "You may also". The owner and vendor support see one line: everything. When the page
  registry cannot be read, this section says so and the rest of the page still opens.
  Since 2026-10-16 (permissions item #25) it also says where each comes from: a page or action
  given to you personally carries a "given" or "until" note with its end date, and anything
  without a note comes from your role. What your role gives but a personal setting closes is
  listed as closed. A page whose role floor keeps your role out is never listed, as the sidebar
  does not offer it. Below that, **Your access requests** lists the ones waiting and those
  decided in the last 14 days, with the decider's note, and **Backups and Server** lists what you
  may do in each console you can open, from that console's own answer, marking what was given to
  you there and what is closed for you (`src/lib/access-center/your-consoles.ts`). Each console
  is asked once per page view, beside the page's other reads, and has 3 seconds to answer; a slow
  or unreachable console says so in its own part and the rest of the page still opens. The
  consoles do not share a grant's end date, and the section says so.
  Since 2026-10-16 (permissions item #22), under the consoles, **Ask for a permission**
  (`src/components/admin/settings/AskForPermission.tsx`) opens a pop-up: the console (when you
  can open both), every permission you may ask for there as chips, how long you need it (2 hours,
  1 day, 1 week or 30 days; 1 day to start) and why. The list comes from the same console answer:
  nothing you hold, nothing a personal setting closes, no Owner and Vendor support permission. A
  permission already asked for and still waiting shows "(asked)" and cannot be picked twice. The
  request is decided on Users ([USER-MANAGEMENT §6.1](USER-MANAGEMENT.md)), and an approved one
  ends by itself; it shows in Your access requests with its end.
- **Other people**, only with `/dashboard/settings#others` (default: Admin and above). Every
  person below your own role as a chip, all on view (vendor support: everyone; hidden accounts
  only to vendor support), and a card with the name field for the one you pick. Only the name changes;
  their theme stays theirs. Their sessions show the new name on their next click, because the
  change writes an `authz-changed` mark ([PERMISSIONS-SYSTEM §11](../architecture/PERMISSIONS-SYSTEM.md)).

Your name, your theme and other people's names go to `POST /api/settings/user`. A change to someone else is checked twice: the
`#others` key by exact match (`placRequireGrant`), and the target's role below the caller's. It
is audited with the old and new name.

## Configuration (`/dashboard/configuration`)

In the sidebar's System group, right after Settings.

| Key | Default role | What it allows |
|---|---|---|
| `/dashboard/configuration` | Admin (`super_admin`) | Open the page and see the settings |
| `/dashboard/configuration#edit` | Admin (`super_admin`) | Change the settings marked with it |
| `/dashboard/configuration#email-limit` | Owner | Change the email recipient limit |
| `/dashboard/configuration#cloudflare` | Owner | Change Cloudflare settings: the site's security level and emptying the website's cache (migration `0083`) |

The owner and vendor support pass every check. Every key is checked by exact match, in the page
and in its routes (`POST /api/configuration`, `/api/configuration/limits` and
`/api/configuration/cloudflare`), so a session whose access map predates migration `0068` is
refused rather than let through by the `/dashboard` row
([PERMISSIONS-SYSTEM §5](../architecture/PERMISSIONS-SYSTEM.md)).

**The settings** are the catalog in `src/lib/configuration.ts`, one entry per D1
`admin_portal_settings` row:

| Setting (key) | Range, default | Permission | Read by |
|---|---|---|---|
| Most people in one email (`custom_email_max_recipients`) | 1 to 500, 10 | `#email-limit` | `POST /api/emails/send`; the Email page shows it read-only |
| AI suggested edits (`blog-suggestions-enabled`) | on or off, on | `#edit` | `POST /api/content/blog/suggest` |
| Suggestions kept waiting per post (`blog-suggestions-max-pending`) | 1 to 20, 5 | `#edit` | `POST /api/content/blog/suggest` |

The page, the API and the code that reads each setting take its name, range and default from
that one entry. A stored value outside the range, or missing, reads as the default. An on/off
setting saves when switched; a number saves with its own button. Each change is audited with the
old and new value.

**The website's request limits** (since 2026-10-28, moved from Control Plane on Harshil's choice
"each to the page that owns it"; the story is in the
change record (private)). How many
times one visitor may use each of the website's forms and services in a minute: the booking form,
the contact form, cookie choices, visit counting, questions from AI assistants and privacy
requests. They are the `ratelimit` rows of D1 `service_config`, read and changed through
`/api/configuration/limits` (`src/lib/control-plane/settings-routes.ts`, as the Sentry and
PostHog pages' settings), and the website reads a change within a minute
(`cf-astro/src/lib/rate-limit.ts`).

- Each limit is a row of numbers side by side, and a tap saves. The numbers are the ones the
  website has a Cloudflare rate-limit binding for (`LADDER` in
  `src/lib/control-plane/website-limits.ts`, cf-astro's `RATE_LIMIT_BINDING_LIMITS`), within the
  row's own range. A stored number between two of them works as the next one up, and the row
  says so; it also names the default when the limit differs from it.
- Changing a limit needs `#edit`. Each change can carry a reason, is kept in
  `service_config_history` and the Audit Log (`config_change`), is refused when someone changed the
  same limit since the page was read (409, and the page reads the limits again), and asks the
  website to read its settings again at once.
- **Put them back to the defaults** asks first, then resets the `ratelimit` rows and no others.
  **Ask the website to read its settings now** asks the website to reread every one of its
  settings (Control Plane's Refresh service settings), audited as `cache_purge`; when the website
  cannot be reached it says so, and the website rereads them within a minute anyway.
- The privacy request limit (`ratelimit.arco.max_requests`) is shown locked: the website's
  privacy request form uses its own limit of 3 a minute, built into its code, so the row changes
  nothing (MAINTENANCE (private) SE-6).
- The last 20 changes of the limits are listed under them.

**Cloudflare** (since 2026-10-28, from Control Plane's Cloudflare tab; its old address forwards
to `/dashboard/configuration#cloudflare`). Read from Cloudflare through
`GET /api/configuration/cloudflare` when it comes into view, each part on its own, so one that
Cloudflare refuses says so in its place:

- **The site's security:** its security level, SSL mode, Always HTTPS and the oldest TLS version
  allowed. With `#cloudflare`, the level is a row of two choices, **Normal** and **Under
  attack**, the two Cloudflare's own dashboard offers today; an older level set before shows as
  a third. A change asks first.
- **Empty the website's cache,** with `#cloudflare`: all of it, after a confirmation, or one
  page by its address (`/es/blog/` or the whole link), which the section turns into the cache
  tag the website serves that page with (`pageTagFor`, the same as cf-astro's `pageCacheTag`).
- **What the account holds:** the Workers, key-value stores, databases, file storage, the email
  queue and the people signed in through Cloudflare Access, each a list that opens on a tap.

Both changes go to `POST /api/configuration/cloudflare`, limited to 10 a minute per person and
audited as `provider_write` (target `cloudflare:purge` or `cloudflare:set-security-level`). The
two read-only Cloudflare rows Control Plane showed are not offered: nothing reads them, and
migration `0084` switched them off with Control Plane's rows
([CONTROL-PLANE.md](CONTROL-PLANE.md) §4.5).

**Settings kept with their feature.** Below them, the page lists the pages that own every
other setting (`SETTINGS_ELSEWHERE`): Email, SEO, the Blog's AI writing instructions, Scheduled
Jobs, Staff Storage limits, sign-in alerts, Backups, and since 2026-10-28 the Sentry and PostHog
pages' Settings. Each shows only to someone who may open it, and use its permission where one
is named.

### Adding a setting

1. Find its feature page first: a setting that belongs to one feature is changed there.
2. Otherwise add an entry to `CONFIG_SETTINGS` (key, group, label, help, type, range, default,
   permission), read it with `configNumber` or `configFlag`, and add a case to
   `test/api-configuration.test.ts`. No migration is needed unless it needs a new permission key.
3. Never add an environment variable for it (RULESAd RULE #0.8).

## What was removed on 2026-10-10

- The generic settings route `POST /api/settings/portal` and its editor, which took any of
  thirty-odd keys as free text.
- Feature Flags: the tab, `POST /api/features/toggle`, its repository and the
  `admin_feature_flags` table (migration `0069`, on Harshil's decision). Nothing read a flag.
- The Modules list and `POST /api/pages/toggle`: Page Registry (`/dashboard/debug/pages`) does
  the same, under vendor support.
- Five `admin_portal_settings` rows nothing read: `portal_name`, `maintenance_mode`,
  `default_theme`, `session_max_lifetime`, `session_recheck_interval` (migration `0069`).
- The Email page's own recipient-limit field: the limit moved to Configuration, under its own
  permission.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-28 | The Cloudflare section's sentence on Control Plane's two Cloudflare rows, against migration `0084` and the rows read back | The rest of the document; `last_verified` left as it was |
| 2026-10-28 | **Scope-limited to the Configuration section** (the keys, the request limits, Cloudflare, the list of settings kept elsewhere) against `configuration.astro`, `WebsiteLimits.tsx`, `CloudflareSection.tsx`, `website-limits.ts`, `settings-routes.ts`, the two routes and `0083`; `cf-astro/src/lib/rate-limit.ts` (`RATE_LIMIT_BINDING_LIMITS`) and `cf-astro/src/lib/isr-cache-key.ts` (`pageCacheTag`) read on its main (53b1bd7); the `0083` row read back live (D1 connector); `test/configuration-limits-cloudflare.test.ts`, `test/overview.test.ts` and `test/action-keys-enforced.test.ts` pass | The Settings section; the Cloudflare reads against the live account; the page in a phone browser, which Harshil tests after the deploy |
| 2026-10-17 | **Scope-limited to the Testing pass bullet.** Against `TestingPassPanel.tsx`, `settingsView.ts` (`testingPassState`, `durationWords`), `index.astro`, `src/pages/api/settings/testing-pass.ts` and `src/lib/auth/fresh-sign-in.ts` (`testingPassInfo`); `test/testing-pass.test.ts` passes | The other bullets and the Configuration section; the panel on a phone, which Harshil tests after the deploy |
| 2026-10-16 | **Scope-limited to Ask for a permission (#22).** The new paragraph of the Your access bullet against `AskForPermission.tsx`, `AccessPanel.tsx` (its children), `your-consoles.ts` (`readCatalogFor`, `askable`, `labels`) and `index.astro`; `test/access-console-requests.test.ts` and `test/access-why.test.ts` pass | The pop-up in a phone browser, which Harshil tests after the deploy |
| 2026-10-16 | The Your access bullet against `AccessPanel.tsx`, `your-access.ts`, `your-consoles.ts` and `index.astro`; `test/access-why.test.ts` (given and closed pages, a floored page never listed, the console powers read from a catalog answer) and `test/settings-page.test.ts` pass | The rest of the page; the console parts against live consoles, and the page in a phone browser, which Harshil tests after the deploy |
| 2026-10-10 | The Settings section against the rebuilt page (`index.astro`, `SettingsHeader.tsx`, `AccessPanel.tsx`, `UserSettingsPanel.tsx`, `OtherProfilesPanel.tsx`, `settingsView.ts`); `test/settings-page.test.ts` (who may be renamed, the tile counts, the name limits, the theme shown) and `test/api-settings-user.test.ts` pass | The Configuration section; the page in a phone browser, which Harshil tests after the deploy |
| 2026-10-10 | Written from the code named in `related_code`; `test/api-configuration.test.ts` (the catalog, the API's exact-key checks, and migrations `0068` and `0069`) and `test/api-settings-user.test.ts` (your own theme and name, another person's name, the role and permission checks) pass | The pages in a phone browser, which Harshil tests after the deploy |
