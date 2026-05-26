# New Files Created During Refactoring

All net-new files introduced during this refactoring session.

---

## src/lib/bookings/constants.ts
**Purpose:** Single source of truth for booking service badge styles.

**Exports:**
- `getServiceBadgeStyle(service: string): { background, color, borderColor }` — returns inline style object for a service type. Used in `BookingDashboard.tsx` and `BookingSlideDrawer.tsx`.

**Service colors:**
- `relocation` → blue (#60a5fa)
- `hotel` → purple (#c084fc)
- `daycare` → emerald (#34d399)
- other → slate (#94a3b8)

---

## src/lib/formatters.ts
**Purpose:** Shared date/time formatting utilities.

**Exports:**
- `formatDateTime(s: string | null | undefined): string` — formats to "Apr 28, 02:15 AM" (en-US locale, date + time)
- `formatDateShort(s: string | null | undefined): string` — formats to "Apr 28" (en-US locale, date only)

**Who uses them:**
- `src/components/dashboard/privacy/FeedItem.tsx` — imports `formatDateTime as formatDate`
- `src/components/admin/chatbot/hooks/useChatbotApi.ts` — re-exports as `formatDate` for chatbot island components

---

---

## src/components/admin/logs/shared.tsx
**Purpose:** Shared types, utilities, and micro-components for the ActivityCenter log tabs.

**Exports (types):** `AuditLog`, `EmailLog`, `ConsentRecord`, `LoginLog`, `Stats`, `TabId`, `TABS`

**Exports (utilities):** `formatTimestamp(ts: string): string`, `tryParseJSON(s: string): unknown`, `buildQueryString(params: Record<string, string>): string`

**Exports (components):** `JSONViewer`, `DetailPanel`, `TableFooter`

**Who uses it:** `ActivityCenter.tsx` (the orchestrator imports all types and micro-components from here)

---

## src/components/admin/bookings/types.ts
**Purpose:** Canonical type definitions for the bookings admin module.

**Exports:** `BookingPet`, `AdminState`, `BookingRow`, `ConsentRecord`, `EmailLog`, `BookingDetails`, `SERVICE_LABELS` (record), `PET_TYPE_ICONS` (record)

**Who uses it:** `BookingSlideDrawer.tsx` and all BookingXxxSection components.

---

## src/components/admin/bookings/BookingCustomerSection.tsx
**Purpose:** Displays customer name, email, and phone for a booking in the slide drawer.

**Props:** `{ booking: BookingRow }`

---

## src/components/admin/bookings/BookingPetSection.tsx
**Purpose:** Displays pet profiles, weights, and breeds for a booking.

**Props:** `{ pets: BookingPet[] }`

---

## src/components/admin/bookings/BookingOperationsSection.tsx
**Purpose:** Displays service type, check-in/out dates, and status badge.

**Props:** `{ booking: BookingRow; details: BookingDetails }`

---

## src/components/admin/bookings/BookingAuditSection.tsx
**Purpose:** Displays the email audit log for a specific booking.

**Props:** `{ bookingId: string; emailLogs: EmailLog[] }`

---

## src/components/admin/bookings/BookingDangerZoneSection.tsx
**Purpose:** Force cancel and delete action buttons for a booking.

**Props:** `{ booking: BookingRow; onAction: (action: string) => void }`

---

## src/components/admin/chatbot/BotConfigShared.tsx
**Purpose:** Shared primitive UI components used across BotConfig sections.

**Exports:** `ConfigSection` (wrapper with heading), `Field` (label + control row), `InfoIcon` (tooltip icon)

---

## src/components/admin/chatbot/BotConfigThinkingSection.tsx
**Purpose:** Extended thinking configuration UI for the chatbot.

**Exports:** `ThinkingConfig` (interface), `BotConfigThinkingSection` (component)

**Props:** `{ config: ThinkingConfig; onChange: (c: ThinkingConfig) => void }`

---

## src/components/admin/users/roleColors.ts
**Purpose:** Pure utility functions for RBAC role visual styling and user display helpers.

**Exports:**
- `getRoleBorderHex(role: number): string` — border hex for a role number
- `getRoleBgGrad(role: number): string` — gradient background for a role avatar
- `getRoleBorderColor(role: number): string` — CSS border color string
- `getRelativeTime(ts: string): string` — "2 hours ago" style relative timestamp
- `getInitials(name: string, email: string): string` — first two initials from display name, falls back to email prefix

---

## src/components/admin/users/UserTableRow.tsx
**Purpose:** Desktop table row for a single user entry, with expansion panel.

**Exports:** `SortIcon`, `UserAvatar`, `UserTableRow`

**Accessibility:** `aria-sort` on sortable header cells; `role="button"`, `tabIndex={0}`, `onKeyDown` on expandable rows.

---

## src/components/admin/users/UserCardStack.tsx
**Purpose:** Mobile card layout for a single user entry.

**Props:** `{ user: AdminUser; onAction: (action: string, userId: string) => void }`

**Accessibility:** Full keyboard interaction; `role="button"` on action triggers.

---

## src/components/admin/debug/PageRegistryConfirmModal.tsx
**Purpose:** Extracted 150-line confirmation modal from PageRegistryManager for page registry mutation confirmations.

**Props:** `{ page: PageEntry | null; onConfirm: () => void; onCancel: () => void }`

---

## src/components/admin/users/sessions/SessionForensicsDrawer.tsx

**Purpose:** Premium HUD slide-in panel showing live session forensics for a target user.

**Features:**
- Device identity (browser/OS parsed via zero-dependency RegExp UA parser)
- Connection telemetry (IP address, geolocation, CF Ray ID)
- Live 24h session expiration countdown with progress bar
- Per-session revocation (disabled for self-session protection)

**Access:** `super_admin+` (accessible via 'Check Active Sessions' button in ExpandedRow)
**Lines:** 345

---

## Files Deleted

| File | Lines | Reason |
|------|-------|--------|
| `src/components/admin/BookingList.tsx` | 327 | Dead code — superseded by BookingDashboard + BookingSlideDrawer |
| `src/components/dashboard/widgets/WidgetSharedV2.tsx` | 152 | Merged into WidgetShared.tsx (renamed) |

---

## Files Renamed

| Old Name | New Name | Reason |
|----------|----------|--------|
| `src/components/dashboard/widgets/WidgetSharedV2.tsx` | `src/components/dashboard/widgets/WidgetShared.tsx` | Canonical merge — WidgetSharedV2 became the single source after WidgetShared exports were folded in |

---

## Canonical File Locations After Refactoring

| Concern | Canonical File |
|---------|---------------|
| API response helpers | `src/lib/api.ts` — `jsonOk`, `jsonError`, `withETag`, `jsonFresh` |
| Widget shared utilities | `src/components/dashboard/widgets/WidgetShared.tsx` |
| Booking badge styles | `src/lib/bookings/constants.ts` |
| Date formatters | `src/lib/formatters.ts` |
| CmsBlock interface | `src/lib/shared-schema.ts` |
| RBAC roles/guards | `src/lib/auth/rbac.ts` |
| Rate limiting | `src/lib/ratelimit.ts` → `getRateLimiter()` |
| Audit logging | `src/lib/audit.ts` → `auditLog()` |
| Supabase client | `src/lib/supabase.ts` → `createAdminClient()` |
| Booking admin types | `src/components/admin/bookings/types.ts` |
| Log tab shared types/utils | `src/components/admin/logs/shared.tsx` |
| User role visual utilities | `src/components/admin/users/roleColors.ts` |
| BotConfig UI primitives | `src/components/admin/chatbot/BotConfigShared.tsx` |
| Badge CSS variables | `src/styles/themes/dark.css` — `--color-badge-*` |
