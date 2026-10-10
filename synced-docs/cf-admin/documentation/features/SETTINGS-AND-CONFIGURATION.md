---
title: "Settings and Configuration"
status: active
audience: [owner, operator, ai, technical]
last_verified: 2026-10-10
verified_against: [code, local-test]
owner: harshil
related_code: [src/pages/dashboard/settings/index.astro, src/pages/dashboard/configuration.astro, src/lib/configuration.ts, src/pages/api/configuration.ts, src/pages/api/settings/user.ts, src/components/admin/configuration/ConfigurationPanel.tsx, src/components/admin/settings/UserSettingsPanel.tsx, src/components/admin/settings/OtherProfilesPanel.tsx, src/lib/access-center/your-access.ts, public/scripts/theme-init.js, migrations/0068_configuration_page.sql, migrations/0069_settings_cleanup.sql]
related_docs: [../architecture/PERMISSIONS-SYSTEM.md, ../security/SECURITY.md, EMAIL-PORTAL.md, USER-MANAGEMENT.md, ../architecture/GLOBAL-CONFIG.md, ../MAINTENANCE.md]
tags: [settings, configuration, plac, theme, profile]
---

# Settings and Configuration

> **TL;DR (non-technical):** **Settings** is each person's own page: their name, their theme
> (light, dark, or the phone's own), and a list of what their access lets them open and do.
> Someone allowed to may also change the names of people below them there. **Configuration**
> is where the few portal-wide settings live that belong to no single feature, each with a plain
> name, an allowed range and a default, and a list of the pages that hold every other setting.

Both were rebuilt on 2026-10-10 at Harshil's request. Until then Settings held the portal-wide
settings as free text, a Feature Flags tab whose flags nothing read, and a Modules list that
repeated the Page Registry; all three are gone.

## Settings (`/dashboard/settings`)

Every role may open it (stored role `staff` since migration `0069`).

- **Your profile.** Your name (2 to 120 characters) and your theme. *System* follows the
  device's light or dark mode, read by `public/scripts/theme-init.js` before the page paints, so
  there is no flash. Your theme is a row in D1 `admin_user_settings`, copied to the
  `cf_admin_theme` cookie; your name is `display_name` in Supabase `admin_authorized_users`, and
  your session shows the new name at once.
- **Your access.** The pages and actions your role and your grants allow, grouped as the
  sidebar groups them (`src/lib/access-center/your-access.ts`, from the page registry and your
  access map). The owner and vendor support see one line: everything.
- **Other people**, only with `/dashboard/settings#others` (default: Admin and above). A
  sideways-scrolling row of the people below your own role (vendor support: everyone; hidden
  accounts only to vendor support), and a name field for the one you pick. Only the name changes;
  their theme stays theirs. Their sessions show the new name on their next click, because the
  change writes an `authz-changed` mark ([PERMISSIONS-SYSTEM §11](../architecture/PERMISSIONS-SYSTEM.md)).

Both writes go to `POST /api/settings/user`. A change to someone else is checked twice: the
`#others` key by exact match (`placRequireGrant`), and the target's role below the caller's. It
is audited with the old and new name.

## Configuration (`/dashboard/configuration`)

In the sidebar's System group, right after Settings.

| Key | Default role | What it allows |
|---|---|---|
| `/dashboard/configuration` | Admin (`super_admin`) | Open the page and see the settings |
| `/dashboard/configuration#edit` | Admin (`super_admin`) | Change the settings marked with it |
| `/dashboard/configuration#email-limit` | Owner | Change the email recipient limit |

The owner and vendor support pass every check. Every key is checked by exact match, in the page
and in `POST /api/configuration`, so a session whose access map predates migration `0068` is
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

**Settings kept with their feature.** Below the catalog, the page lists the pages that own every
other setting (`SETTINGS_ELSEWHERE`): Email, SEO, the Blog's AI writing instructions, Scheduled
Jobs, Staff Storage limits, sign-in alerts and Backups. Each shows only to someone who may open
it, and use its permission where one is named.

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
| 2026-10-10 | Written from the code named in `related_code`; `test/api-configuration.test.ts` (the catalog, the API's exact-key checks, and migrations `0068` and `0069`) and `test/api-settings-user.test.ts` (your own theme and name, another person's name, the role and permission checks) pass | The pages in a phone browser, which Harshil tests after the deploy |
