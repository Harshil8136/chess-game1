{% raw %}
# Portal Settings Module Design Specification

## 1. Overview
The Portal Settings Module provides a robust, RBAC/PLAC-managed system for configuring both global portal behavior and individual user preferences within the `cf-admin` architecture. This module adheres to the "Defense-in-Depth" and "Lean Edge" infrastructure standards, utilizing Cloudflare D1 for ultra-fast localized storage and Supabase strictly for access control and core identity fields.

## 2. Goals & Success Criteria
- **Global Settings Management**: SuperAdmins can configure system-wide rules (e.g., Session Max Lifetime, Default Theme) via `/dashboard/settings`.
- **User Preferences Management**: Users can configure their personal UI preferences (e.g., Theme) and identity (Display Name).
- **Delegated Administration**: Higher-tier roles (e.g., Admin, SuperAdmin) can edit the settings of subordinate users directly from the User Registry.
- **SSR Compatibility**: Settings (like Theme) must be injected early during SSR to prevent client-side hydration flashes.
- **Strict Auditing**: Every modification to any setting must be logged in the `admin_audit_log` table.

## 3. Database Architecture

We will implement the "Unified D1 Settings" model to maximize edge performance and decouple non-security configurations from the Supabase whitelist.

### 3.1 D1 Tables (New)
1.  **`admin_portal_settings`**
    *   **Purpose:** Stores global, system-wide configurations.
    *   **Schema:** 
        *   `setting_key` (TEXT, PRIMARY KEY) - e.g., 'default_theme', 'session_max_lifetime'
        *   `setting_value` (TEXT) - JSON or stringified primitive.
        *   `setting_type` (TEXT) - e.g., 'string', 'boolean', 'number', 'json'
        *   `description` (TEXT)
        *   `updated_by` (TEXT) - Email of the user who last modified it.
        *   `updated_at` (DATETIME)

2.  **`admin_user_settings`**
    *   **Purpose:** Stores UI preferences and operational configurations for specific users.
    *   **Schema:**
        *   `user_id` (TEXT, PRIMARY KEY) - Foreign key referencing Supabase `admin_authorized_users.id`.
        *   `theme` (TEXT) - e.g., 'light', 'dark', 'system'
        *   `preferences` (TEXT) - JSON field for future extendability.
        *   `updated_at` (DATETIME)

### 3.2 Supabase Updates
*   **`admin_authorized_users`**: Continues to store `display_name`. We will expose a secure API mechanism to allow users to update this field without exposing raw Supabase keys to the client.

## 4. Backend APIs & Auditing

New API endpoints will be created in `src/pages/api/settings/`:

1.  **`POST /api/settings/portal`**
    *   **Auth Requirement:** Base role of `SUPER_ADMIN` or explicit PLAC access to the Settings page.
    *   **Action:** Updates keys in `admin_portal_settings`.
    *   **Audit:** Generates a `settings.portal.update` event.

2.  **`POST /api/settings/user`**
    *   **Auth Requirement:** Authenticated user (can update self) OR Admin/SuperAdmin (can update subordinates).
    *   **Action:** 
        *   Updates `theme` and `preferences` in D1 `admin_user_settings`.
        *   If `displayName` is provided, executes an authenticated server-side RPC or secure update query against Supabase `admin_authorized_users`.
    *   **Audit:** Generates a `settings.user.update` event.

## 5. SSR & Session Integration
To prevent UI flickering, the `AdminSession` (cached in KV) will be extended slightly, or the `AdminLayout.astro` will perform a fast D1 read to fetch the user's current `theme`. 
*   If `admin_user_settings.theme` is missing, it will fall back to `admin_portal_settings.default_theme`.
*   The resolved theme will be attached as a `data-theme` attribute to the root HTML tag during SSR.

## 6. Frontend UI Components (Preact)

Following the strict < 200 lines and atomic design standards:

1.  **`PortalSettingsManager.tsx`**: 
    *   Replaces the placeholder in `src/pages/dashboard/settings/index.astro`.
    *   Displays tabs or sections for "General", "Appearance", "Security".
    *   Fetches current global settings and uses debounced `POST` requests for saves.

2.  **`UserSettingsModal.tsx`**: 
    *   A new accessible dialog launched from the user's avatar menu.
    *   Allows editing of "My Theme" and "My Display Name".

3.  **User Registry Integration (`InviteUserModal.tsx` / `AdminUserEditor.tsx`)**:
    *   Extended to support editing a user's Theme and Display Name by authorized admins.

## 7. Security & Failure Modes
*   **Database Failure:** If D1 fails, the system falls back to default settings (Dark mode) without crashing.
*   **Permission Bypasses:** The API endpoints strictly check `ROLE_LEVEL` comparisons before permitting user B to edit user A's settings.
*   **Validation:** All settings values will be strictly validated via Zod schemas before database insertion to prevent injection or corruption of the JSON structures.

{% endraw %}
