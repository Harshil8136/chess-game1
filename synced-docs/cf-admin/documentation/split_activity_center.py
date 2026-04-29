"""Split ActivityCenter.tsx (1436 lines) into focused subcomponents."""
import os

BASE = "e:/1/Madagascar Project/cf-admin/src/components/admin/logs"

# ─── shared.ts ───────────────────────────────────────────────────────────────
shared_ts = '''// Shared types, utilities, and micro-components for ActivityCenter
import { h } from 'preact';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Stats {
  d1: { totalAuditEntries: number; loginsToday: number } | null;
  emails: { emailsSent: number; emailsFailed: number } | null;
  consent: { activeConsents: number } | null;
  sessions: { totalSessions: number } | null;
  loginLogs: { totalLoginLogs: number; failedLoginsToday: number } | null;
}

export type TabId = 'activity' | 'emails' | 'consent' | 'security';

export const TABS: { id: TabId; label: string; icon: string; restricted?: boolean }[] = [
  { id: 'activity', label: 'Activity Stream', icon: '⚡' },
  { id: 'emails', label: 'Email Logs', icon: '📧' },
  { id: 'consent', label: 'Consent Trail', icon: '🔒' },
  { id: 'security', label: 'Login Forensics', icon: '🛡️', restricted: true },
];

export interface AuditLog {
  id: string;
  user_id: string;
  user_email: string;
  user_role: string;
  action: string;
  module: string;
  target_id: string | null;
  target_type: string | null;
  details: string | null;
  created_at: string;
}

export interface EmailLog {
  id: string;
  project_source: string;
  booking_id: string | null;
  purpose: string;
  status: string;
  recipient_email: string;
  resend_id: string | null;
  email_error: string | null;
  delivery_events: unknown;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecord {
  id: string;
  email: string;
  booking_ref: string | null;
  consent_type: string;
  granted: boolean;
  privacy_notice_version: string | null;
  consent_mechanism: string | null;
  ip_country: string | null;
  ip_region: string | null;
  ip_city: string | null;
  interaction_proof: unknown;
  fingerprint_data: unknown;
  revoked_at: string | null;
  revocation_reason: string | null;
  created_at: string;
}

export interface LoginLog {
  id: string;
  email: string;
  event_type: string;
  success: number;
  is_authorized_email: number;
  failure_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  geo_location: string | null;
  login_method: string | null;
  created_at: string;
  latitude: string | null;
  longitude: string | null;
  postal_code: string | null;
  timezone: string | null;
  continent: string | null;
  asn: number | null;
  asn_org: string | null;
  colo: string | null;
  tls_version: string | null;
  http_protocol: string | null;
  client_rtt_ms: number | null;
  cf_ray_id: string | null;
  cf_access_method: string | null;
  cf_identity_provider: string | null;
  cf_jwt_tail: string | null;
  cf_bot_score: number | null;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function formatTimestamp(dateStr: string, isUtcSqlite = false): string {
  const d = new Date(isUtcSqlite ? dateStr + 'Z' : dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(d);
}

export function tryParseJSON(str: string): unknown {
  try { return JSON.parse(str); } catch { return str; }
}

export function buildQueryString(filters: Record<string, string>, limit: number, offset: number): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  for (const [k, v] of Object.entries(filters)) {
    if (v && v !== 'all' && v !== '') params.set(k, v);
  }
  return params.toString();
}

// ─── JSON Viewer ──────────────────────────────────────────────────────────────

export function JSONViewer({ data }: { data: unknown }) {
  const jsonString = JSON.stringify(data, null, 2);

  const syntaxHighlighted = jsonString.replace(
    /("(\\\\u[a-zA-Z0-9]{4}|\\\\[^u]|[^\\\\"])*"(\\s*:)?|\\b(true|false|null)\\b|-?\\d+(?:\\.\\d*)?(?:[eE][+\\-]?\\d+)?)/g,
    (match) => {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          return `<span class="json-key">${match.slice(0, -1)}</span>:`;
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );

  return (
    <div class="audit-json-wrap">
      <pre class="audit-json-code" dangerouslySetInnerHTML={{ __html: syntaxHighlighted }} />
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

export function DetailPanel({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data).filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (entries.length === 0) return null;

  const scalars = entries.filter(([, v]) => typeof v !== 'object');
  const objects = entries.filter(([, v]) => typeof v === 'object');

  return (
    <div class="audit-detail-panel">
      {scalars.length > 0 && (
        <div class="audit-metadata-grid">
          {scalars.map(([key, val]) => (
            <div key={key} class="audit-metadata-item">
              <span class="audit-metadata-key">{key.replace(/_/g, ' ')}</span>
              <span class="audit-metadata-value">{String(val)}</span>
            </div>
          ))}
        </div>
      )}

      {objects.length > 0 && (
        <div class="audit-json-blocks">
          {objects.map(([key, val]) => (
            <div key={key} class="audit-json-section">
              <span class="audit-metadata-key audit-json-title">{key.replace(/_/g, ' ')} payload</span>
              <JSONViewer data={val} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Table Footer ─────────────────────────────────────────────────────────────

export function TableFooter({ loading, hasMore, onLoadMore }: { loading: boolean; hasMore: boolean; onLoadMore: () => void }) {
  return (
    <div class="audit-table-footer">
      {loading ? (
        <span class="audit-loading">
          <span class="audit-spinner"></span>
          SYNCING...
        </span>
      ) : hasMore ? (
        <button onClick={onLoadMore} class="audit-load-more">
          Load More
        </button>
      ) : (
        <span class="audit-end">— END OF RECORDS —</span>
      )}
    </div>
  );
}
'''

# ─── Badges.tsx ──────────────────────────────────────────────────────────────
badges_tsx = '''import { h } from 'preact';

export function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    dev: 'var(--theme-red)',
    owner: 'var(--theme-emerald, #10b981)',
    super_admin: 'var(--theme-amber, #f59e0b)',
    admin: 'var(--theme-violet, #8b5cf6)',
    staff: 'var(--theme-blue, #3b82f6)',
  };
  const c = colors[role] || colors.staff;
  return (
    <span class="audit-badge" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      {role.replace('_', ' ').toUpperCase()}
    </span>
  );
}

export function ActionBadge({ action }: { action: string }) {
  let color = 'var(--theme-text-secondary, #94a3b8)';
  if (action.includes('grant') || action === 'create') color = 'var(--theme-emerald, #10b981)';
  else if (action.includes('revoke') || action.includes('delete') || action.includes('prune')) color = 'var(--theme-rose, #f43f5e)';
  else if (action.includes('update') || action.includes('reset') || action === 'role_change') color = 'var(--theme-amber, #f59e0b)';
  else if (action === 'login' || action === 'logout') color = 'var(--theme-cyan, #22d3ee)';
  else if (action === 'view') color = 'var(--theme-blue, #3b82f6)';
  else if (action === 'export') color = 'var(--theme-violet, #8b5cf6)';

  return (
    <span class="audit-badge audit-badge-mono" style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}>
      {action}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    sent: 'var(--theme-emerald, #10b981)',
    delivered: 'var(--theme-emerald, #10b981)',
    queued: 'var(--theme-amber, #f59e0b)',
    failed: 'var(--theme-rose, #f43f5e)',
    bounced: 'var(--theme-rose, #f43f5e)',
  };
  const c = map[status] || 'var(--theme-text-secondary, #94a3b8)';
  return (
    <span class="audit-badge" style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}>
      {status.toUpperCase()}
    </span>
  );
}
'''

# ─── MicroStatsRibbon.tsx ────────────────────────────────────────────────────
micro_stats_tsx = '''import { h } from 'preact';
import type { Stats } from './shared';

export function MicroStatsRibbon({ stats }: { stats: Stats | null }) {
  return (
    <div class="flex items-center bg-white/5 dark:bg-slate-900/40 backdrop-blur-xl border border-white/10 dark:border-white/5 rounded-full px-3 shadow-sm overflow-hidden h-8 w-fit shrink-0">
      <div class="flex items-center gap-2 group cursor-default">
        <span class="text-indigo-400 group-hover:scale-110 transition-transform text-sm">📋</span>
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-bold text-slate-800 dark:text-white leading-none">
            {stats?.d1?.totalAuditEntries?.toLocaleString() ?? '—'}
          </span>
          <span class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Entries</span>
        </div>
      </div>

      <div class="w-px h-4 bg-slate-200 dark:bg-white/10 mx-3"></div>

      <div class="flex items-center gap-2 group cursor-default">
        <span class="text-rose-400 group-hover:scale-110 transition-transform text-sm">🛡️</span>
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-bold text-slate-800 dark:text-white leading-none">
            {stats?.loginLogs?.totalLoginLogs.toLocaleString() ?? '—'}
          </span>
          <span class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Logins</span>
        </div>
        {(stats?.loginLogs?.failedLoginsToday ?? 0) > 0 && (
          <span class="ml-1 text-[0.65rem] font-bold text-rose-500 bg-rose-500/10 px-1.5 py-0.5 rounded-md leading-none">
            {stats?.loginLogs?.failedLoginsToday} FAIL
          </span>
        )}
      </div>

      <div class="w-px h-4 bg-slate-200 dark:bg-white/10 mx-3"></div>

      <div class="flex items-center gap-2 group cursor-default">
        <span class="text-emerald-400 group-hover:scale-110 transition-transform text-sm">✉️</span>
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-bold text-slate-800 dark:text-white leading-none">
            {stats?.emails?.emailsSent?.toLocaleString() ?? '—'}
          </span>
          <span class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Emails</span>
        </div>
        {(stats?.emails?.emailsFailed ?? 0) > 0 && (
          <span class="ml-1 text-[0.65rem] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-md leading-none">
            {stats?.emails?.emailsFailed} FAIL
          </span>
        )}
      </div>

      <div class="w-px h-4 bg-slate-200 dark:bg-white/10 mx-3"></div>

      <div class="flex items-center gap-2 group cursor-default">
        <span class="text-cyan-400 group-hover:scale-110 transition-transform text-sm">👥</span>
        <div class="flex items-baseline gap-1.5">
          <span class="text-sm font-bold text-slate-800 dark:text-white leading-none">
            {stats?.consent?.activeConsents?.toLocaleString() ?? '—'}
          </span>
          <span class="text-[0.65rem] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Consents</span>
        </div>
      </div>
    </div>
  );
}
'''

# ─── ActivityFilterBar.tsx ───────────────────────────────────────────────────
filter_bar_tsx = '''import { h } from 'preact';
import type { TabId } from './shared';

export function ActivityFilterBar({
  tab, filters, onChange
}: {
  tab: TabId;
  filters: Record<string, string>;
  onChange: (key: string, val: string) => void;
}) {
  const selectClass = "h-8 text-[0.7rem] sm:text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-md px-2 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 min-w-[120px] transition-all cursor-pointer shadow-sm";
  const inputClass = "h-8 text-[0.7rem] sm:text-xs font-medium bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-md px-2.5 text-slate-700 dark:text-slate-300 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all shadow-sm";
  const divider = <div class="w-px h-5 bg-slate-200 dark:bg-white/10 shrink-0 mx-1 hidden sm:block"></div>;

  return (
    <div class="flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0 py-1">
      {tab === 'activity' && (
        <>
          <div class="flex items-center gap-2">
            <select value={filters.action || 'all'} onChange={e => onChange('action', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Actions</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="delete">Delete</option>
              <option value="grant_access">Grant Access</option>
              <option value="revoke_access">Revoke Access</option>
              <option value="role_change">Role Change</option>
              <option value="view">View</option>
              <option value="export">Export</option>
              <option value="prune">Prune</option>
            </select>
            <select value={filters.module || 'all'} onChange={e => onChange('module', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Modules</option>
              <option value="auth">Auth</option>
              <option value="plac">PLAC</option>
              <option value="users">Users</option>
              <option value="content">Content</option>
              <option value="bookings">Bookings</option>
              <option value="system">System</option>
              <option value="logs">Logs</option>
              <option value="media">Media</option>
            </select>
          </div>
          {divider}
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by actor email..."
              value={filters.actor || ''}
              onInput={e => onChange('actor', e.currentTarget.value)}
              class={inputClass}
            />
          </div>
        </>
      )}
      {tab === 'emails' && (
        <>
          <div class="flex items-center gap-2">
            <select value={filters.status || 'all'} onChange={e => onChange('status', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Statuses</option>
              <option value="queued">Queued</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="bounced">Bounced</option>
            </select>
          </div>
          {divider}
          <div class="flex items-center gap-2">
            <select value={filters.purpose || 'all'} onChange={e => onChange('purpose', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Purposes</option>
              <option value="booking_confirmation_customer">Customer Confirmation</option>
              <option value="booking_notification_admin">Admin Notification</option>
            </select>
          </div>
        </>
      )}
      {tab === 'consent' && (
        <>
          <div class="flex items-center gap-2">
            <select value={filters.consentType || 'all'} onChange={e => onChange('consentType', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Types</option>
              <option value="booking">Booking</option>
              <option value="marketing">Marketing</option>
            </select>
          </div>
          {divider}
          <div class="flex items-center gap-2">
            <select value={filters.granted || ''} onChange={e => onChange('granted', e.currentTarget.value)} class={selectClass}>
              <option value="">All</option>
              <option value="true">Granted</option>
              <option value="false">Denied</option>
            </select>
          </div>
        </>
      )}
      {tab === 'security' && (
        <>
          <div class="flex items-center gap-2">
            <input
              type="text"
              placeholder="Filter by email..."
              value={filters.email || ''}
              onInput={e => onChange('email', e.currentTarget.value)}
              class={inputClass}
            />
          </div>
          {divider}
          <div class="flex items-center gap-2">
            <select value={filters.eventType || 'all'} onChange={e => onChange('eventType', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Events</option>
              <option value="LOGIN_SUCCESS">Login Success</option>
              <option value="LOGIN_FAILED">Login Failed</option>
              <option value="LOGIN_BLOCKED">Login Blocked</option>
            </select>
            <select value={filters.success || ''} onChange={e => onChange('success', e.currentTarget.value)} class={selectClass}>
              <option value="">All Outcomes</option>
              <option value="true">Success</option>
              <option value="false">Failed</option>
            </select>
            <select value={filters.method || 'all'} onChange={e => onChange('method', e.currentTarget.value)} class={selectClass}>
              <option value="all">All Methods</option>
              <option value="google">Google OAuth</option>
              <option value="github">GitHub OAuth</option>
              <option value="otp">One-Time PIN</option>
            </select>
          </div>
        </>
      )}
      <div class="flex items-center gap-1.5 shrink-0 ml-auto pl-2 sm:pl-4 border-l border-slate-200 dark:border-white/10">
        <input
          type="date"
          value={filters.dateFrom || ''}
          onChange={e => onChange('dateFrom', e.currentTarget.value)}
          class={`${inputClass} w-[110px] sm:w-[130px]`}
          title="From date"
        />
        <span class="text-slate-400 text-xs font-bold">→</span>
        <input
          type="date"
          value={filters.dateTo || ''}
          onChange={e => onChange('dateTo', e.currentTarget.value)}
          class={`${inputClass} w-[110px] sm:w-[130px]`}
          title="To date"
        />
      </div>
    </div>
  );
}
'''

# ─── ActivityLogTab.tsx ──────────────────────────────────────────────────────
activity_log_tsx = '''import { h } from 'preact';
import type { AuditLog } from './shared';
import { formatTimestamp, tryParseJSON, DetailPanel, TableFooter } from './shared';
import { RoleBadge, ActionBadge } from './Badges';

export function ActivityStream({
  logs, loading, hasMore, onLoadMore, expandedId, onToggle,
  selectedIds, onToggleSelect, onSelectAll, canDelete
}: {
  logs: AuditLog[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], isAll: boolean) => void;
  canDelete?: boolean;
}) {
  const allIds = logs.map(l => l.id);
  const allSelected = logs.length > 0 && allIds.every(id => selectedIds?.has(id));
  return (
    <div class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            {canDelete && (
              <th class="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => onSelectAll?.(allIds, e.currentTarget.checked)}
                />
              </th>
            )}
            <th class="w-[160px]">Timestamp</th>
            <th>Actor</th>
            <th>Event</th>
            <th>Module</th>
            <th class="hidden lg:table-cell">Target</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && !loading ? (
            <tr><td colSpan={canDelete ? 7 : 6} class="audit-empty">No audit entries found.</td></tr>
          ) : (
            logs.map(log => (
              <>
                <tr key={log.id} class="audit-row" onClick={() => onToggle(log.id)}>
                  {canDelete && (
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(log.id) || false}
                        onChange={() => onToggleSelect?.(log.id)}
                      />
                    </td>
                  )}
                  <td>
                    <span class="audit-ts">{formatTimestamp(log.created_at, true)}</span>
                  </td>
                  <td>
                    <div class="audit-actor">
                      <span class="audit-email">{log.user_email}</span>
                      <RoleBadge role={log.user_role} />
                    </div>
                  </td>
                  <td><ActionBadge action={log.action} /></td>
                  <td><span class="audit-module">{log.module}</span></td>
                  <td class="hidden lg:table-cell">
                    {log.target_id && (
                      <span class="audit-target">{log.target_id}</span>
                    )}
                  </td>
                  <td>
                    <span class={`audit-chevron ${expandedId === log.id ? 'audit-chevron-open' : ''}`}>▸</span>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-detail`} class="audit-detail-tr">
                    <td colSpan={canDelete ? 7 : 6}>
                      <DetailPanel data={{
                        'Entry ID': log.id,
                        'User ID': log.user_id,
                        Target: log.target_id,
                        'Target Type': log.target_type,
                        Details: log.details ? tryParseJSON(log.details) : null,
                      }} />
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
      <TableFooter loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
'''

# ─── EmailLogTab.tsx ─────────────────────────────────────────────────────────
email_log_tsx = '''import { h } from 'preact';
import type { EmailLog } from './shared';
import { formatTimestamp, DetailPanel, TableFooter } from './shared';
import { StatusBadge } from './Badges';

export function EmailLogsTable({
  logs, loading, hasMore, onLoadMore, expandedId, onToggle,
  selectedIds, onToggleSelect, onSelectAll, canDelete
}: {
  logs: EmailLog[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], isAll: boolean) => void;
  canDelete?: boolean;
}) {
  const allIds = logs.map(l => l.id);
  const allSelected = logs.length > 0 && allIds.every(id => selectedIds?.has(id));
  return (
    <div class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            {canDelete && (
              <th class="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => onSelectAll?.(allIds, e.currentTarget.checked)}
                />
              </th>
            )}
            <th class="w-[160px]">Timestamp</th>
            <th>Recipient</th>
            <th>Purpose</th>
            <th>Status</th>
            <th class="hidden lg:table-cell">Source</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && !loading ? (
            <tr><td colSpan={canDelete ? 7 : 6} class="audit-empty">No email logs found.</td></tr>
          ) : (
            logs.map(log => (
              <>
                <tr key={log.id} class="audit-row" onClick={() => onToggle(log.id)}>
                  {canDelete && (
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(log.id) || false}
                        onChange={() => onToggleSelect?.(log.id)}
                      />
                    </td>
                  )}
                  <td><span class="audit-ts">{formatTimestamp(log.created_at)}</span></td>
                  <td><span class="audit-email">{log.recipient_email}</span></td>
                  <td><span class="audit-module">{log.purpose.replace(/_/g, ' ')}</span></td>
                  <td><StatusBadge status={log.status} /></td>
                  <td class="hidden lg:table-cell">
                    <span class="audit-target">{log.project_source}</span>
                  </td>
                  <td>
                    <span class={`audit-chevron ${expandedId === log.id ? 'audit-chevron-open' : ''}`}>▸</span>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-detail`} class="audit-detail-tr">
                    <td colSpan={canDelete ? 7 : 6}>
                      <DetailPanel data={{
                        'Entry ID': log.id,
                        'Resend ID': log.resend_id,
                        'Booking ID': log.booking_id,
                        Error: log.email_error,
                        'Delivery Events': log.delivery_events,
                        'Last Updated': formatTimestamp(log.updated_at),
                      }} />
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
      <TableFooter loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
'''

# ─── ConsentTrailTab.tsx ─────────────────────────────────────────────────────
consent_trail_tsx = '''import { h } from 'preact';
import type { ConsentRecord } from './shared';
import { formatTimestamp, DetailPanel, TableFooter } from './shared';

export function ConsentTrailTable({
  logs, loading, hasMore, onLoadMore, expandedId, onToggle,
  selectedIds, onToggleSelect, onSelectAll, canDelete
}: {
  logs: ConsentRecord[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (ids: string[], isAll: boolean) => void;
  canDelete?: boolean;
}) {
  const allIds = logs.map(l => l.id);
  const allSelected = logs.length > 0 && allIds.every(id => selectedIds?.has(id));
  return (
    <div class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            {canDelete && (
              <th class="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => onSelectAll?.(allIds, e.currentTarget.checked)}
                />
              </th>
            )}
            <th class="w-[160px]">Timestamp</th>
            <th>Email</th>
            <th>Type</th>
            <th>Status</th>
            <th class="hidden lg:table-cell">Region</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && !loading ? (
            <tr><td colSpan={canDelete ? 7 : 6} class="audit-empty">No consent records found.</td></tr>
          ) : (
            logs.map(rec => (
              <>
                <tr key={rec.id} class="audit-row" onClick={() => onToggle(rec.id)}>
                  {canDelete && (
                    <td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds?.has(rec.id) || false}
                        onChange={() => onToggleSelect?.(rec.id)}
                      />
                    </td>
                  )}
                  <td><span class="audit-ts">{formatTimestamp(rec.created_at)}</span></td>
                  <td><span class="audit-email">{rec.email}</span></td>
                  <td><span class="audit-module">{rec.consent_type}</span></td>
                  <td>
                    <span class="audit-badge" style={{
                      color: rec.granted
                        ? (rec.revoked_at ? 'var(--theme-amber, #f59e0b)' : 'var(--theme-emerald, #10b981)')
                        : 'var(--theme-rose, #f43f5e)',
                      background: rec.granted
                        ? (rec.revoked_at ? 'color-mix(in srgb, var(--theme-amber, #f59e0b) 14%, transparent)' : 'color-mix(in srgb, var(--theme-emerald, #10b981) 14%, transparent)')
                        : 'color-mix(in srgb, var(--theme-rose, #f43f5e) 14%, transparent)',
                    }}>
                      {rec.revoked_at ? 'REVOKED' : rec.granted ? 'GRANTED' : 'DENIED'}
                    </span>
                  </td>
                  <td class="hidden lg:table-cell">
                    {rec.ip_country ? (
                      <span class="audit-target">
                        {[rec.ip_country, rec.ip_region, rec.ip_city].filter(Boolean).join(', ')}
                      </span>
                    ) : (
                      <span class="audit-target">Unknown</span>
                    )}
                  </td>
                  <td>
                    <span class={`audit-chevron ${expandedId === rec.id ? 'audit-chevron-open' : ''}`}>▸</span>
                  </td>
                </tr>
                {expandedId === rec.id && (
                  <tr key={`${rec.id}-detail`} class="audit-detail-tr">
                    <td colSpan={canDelete ? 7 : 6}>
                      <DetailPanel data={{
                        'Record ID': rec.id,
                        'Booking Ref': rec.booking_ref,
                        'Privacy Version': rec.privacy_notice_version,
                        Mechanism: rec.consent_mechanism,
                        'Interaction Proof': rec.interaction_proof,
                        Fingerprint: rec.fingerprint_data,
                        'Revoked At': rec.revoked_at ? formatTimestamp(rec.revoked_at) : null,
                        'Revocation Reason': rec.revocation_reason,
                      }} />
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
      <TableFooter loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
'''

# ─── LoginForensicsTab.tsx ───────────────────────────────────────────────────
login_forensics_tsx = '''import { h } from 'preact';
import type { LoginLog } from './shared';
import { formatTimestamp, TableFooter } from './shared';

function maskIP(ip: string | null): string {
  if (!ip) return '—';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***.***`;
  return ip.slice(0, Math.ceil(ip.length / 2)) + '••••';
}

function cfMethodIcon(method: string | null): string {
  if (method === 'google') return '🔵';
  if (method === 'github') return '⚫';
  if (method === 'otp') return '🔑';
  return '❓';
}

function EventTypeBadge({ eventType }: { eventType: string }) {
  const map: Record<string, { color: string; label: string }> = {
    'LOGIN_SUCCESS': { color: 'var(--theme-emerald, #10b981)', label: 'SUCCESS' },
    'LOGIN_FAILED': { color: 'var(--theme-rose, #f43f5e)', label: 'FAILED' },
    'LOGIN_BLOCKED': { color: 'var(--theme-amber, #f59e0b)', label: 'BLOCKED' },
  };
  const entry = map[eventType] || { color: 'var(--theme-text-secondary, #94a3b8)', label: eventType };
  return (
    <span class="audit-badge audit-badge-mono" style={{
      color: entry.color,
      background: `color-mix(in srgb, ${entry.color} 12%, transparent)`
    }}>
      {entry.label}
    </span>
  );
}

function OutcomeBadge({ success }: { success: number }) {
  const color = success ? 'var(--theme-emerald, #10b981)' : 'var(--theme-rose, #f43f5e)';
  return (
    <span class="audit-badge" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>
      {success ? '✓ OK' : '✗ FAIL'}
    </span>
  );
}

function ForensicDetail({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  if (value === null || value === undefined || value === '') {
    return (
      <div class="flex justify-between items-baseline gap-4">
        <span class="text-[11px] text-slate-500">{label}</span>
        <span class="text-xs text-slate-700 font-mono">—</span>
      </div>
    );
  }
  return (
    <div class="flex justify-between items-baseline gap-4">
      <span class="text-[11px] text-slate-500">{label}</span>
      <span class={`text-xs text-slate-300 text-right ${mono ? 'font-mono tracking-tight text-slate-400' : ''}`}>
        {String(value)}
      </span>
    </div>
  );
}

function ForensicPanel({ log }: { log: LoginLog }) {
  const coordsStr = log.latitude && log.longitude
    ? `${log.latitude}, ${log.longitude}`
    : null;

  const asnStr = log.asn && log.asn_org
    ? `AS${log.asn} (${log.asn_org})`
    : log.asn ? `AS${log.asn}` : log.asn_org ?? null;

  const methodDisplay = log.cf_access_method || log.login_method;
  const methodIcon = cfMethodIcon(methodDisplay);

  return (
    <div class="bg-slate-900/60 border border-slate-800/80 rounded-lg m-2 overflow-hidden flex flex-col text-sm shadow-xl">
      <div class="bg-slate-950/50 border-b border-slate-800/80 px-4 py-3 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <OutcomeBadge success={log.success} />
          <span class="text-slate-300 font-medium">{log.email}</span>
          {!log.is_authorized_email && (
            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
              UNAUTH EMAIL
            </span>
          )}
        </div>
        <div class="text-slate-500 font-mono text-xs">
          {new Date(log.created_at).toISOString()}
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/60">
        <div class="p-4 flex flex-col gap-3">
          <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            <span class="text-slate-400">🛡️</span> Identity & Auth
          </h4>
          <ForensicDetail label="Event Type" value={log.event_type} />
          <ForensicDetail label="Auth Method" value={methodDisplay ? `${methodIcon} ${methodDisplay}` : null} />
          <ForensicDetail label="Failure Reason" value={log.failure_reason} />
          <ForensicDetail label="CF Ray ID" value={log.cf_ray_id} mono />
          <ForensicDetail label="JWT Tail" value={log.cf_jwt_tail ? `…${log.cf_jwt_tail}` : null} mono />
          <ForensicDetail label="Record ID" value={log.id} mono />
        </div>

        <div class="p-4 flex flex-col gap-3">
          <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            <span class="text-slate-400">🌐</span> Network Origin
          </h4>
          <ForensicDetail label="IP Address" value={log.ip_address} mono />
          <ForensicDetail label="Location" value={log.geo_location} />
          <ForensicDetail label="Coordinates" value={coordsStr} mono />
          <ForensicDetail label="Postal Code" value={log.postal_code} mono />
          <ForensicDetail label="Timezone" value={log.timezone} />
          <ForensicDetail label="Continent" value={log.continent} />
          <ForensicDetail label="ASN" value={asnStr} mono />
          <ForensicDetail label="CF Colo" value={log.colo} mono />
          <ForensicDetail label="TLS Version" value={log.tls_version} mono />
          <ForensicDetail label="HTTP Protocol" value={log.http_protocol} mono />
          <ForensicDetail label="Client RTT" value={log.client_rtt_ms ? `${log.client_rtt_ms}ms` : null} />
          {log.user_agent && (
            <div class="flex flex-col gap-1 mt-1">
              <span class="text-[10px] text-slate-500 uppercase">User Agent</span>
              <span class="text-[11px] text-slate-400 font-mono break-words leading-relaxed bg-slate-950/50 p-2 rounded border border-slate-800/50">
                {log.user_agent}
              </span>
            </div>
          )}
        </div>

        <div class="p-4 flex flex-col gap-3">
          <h4 class="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
            <span class="text-slate-400">☁️</span> CF Zero Trust
          </h4>
          <ForensicDetail label="Access Method" value={log.cf_access_method} />
          <ForensicDetail label="Identity Provider" value={log.cf_identity_provider} />
          <ForensicDetail
            label="Bot Score"
            value={log.cf_bot_score != null
              ? `${log.cf_bot_score}${log.cf_bot_score < 30 ? ' ⚠ Likely Bot' : ''}`
              : null}
          />
          <div class="mt-auto pt-4">
            <div class="bg-slate-950/40 border border-slate-800/50 rounded p-2 flex items-start gap-2">
              <span class="text-slate-500 text-sm mt-0.5">ℹ️</span>
              <p class="text-[10px] text-slate-500 leading-tight">
                CF Zero Trust data is edge-injected. Bot score below 30 suggests automated traffic. Ray ID links to the Cloudflare dashboard trace.
              </p>
            </div>
          </div>
        </div>
      </div>

      <details class="group border-t border-slate-800/60 bg-slate-950/30">
        <summary class="px-4 py-2 text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-300 transition-colors list-none flex items-center gap-2">
          <span class="group-open:rotate-90 transition-transform text-[10px]">▶</span>
          View Raw Event Payload
        </summary>
        <div class="p-4 border-t border-slate-800/60 overflow-x-auto">
          <pre class="text-[11px] text-slate-400 font-mono leading-relaxed">
            {JSON.stringify(log, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

export function SecurityForensicsTable({
  logs, loading, hasMore, onLoadMore, expandedId, onToggle
}: {
  logs: LoginLog[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
  expandedId: string | null;
  onToggle: (id: string) => void;
}) {
  return (
    <div class="audit-table-wrap">
      <table class="audit-table">
        <thead>
          <tr>
            <th class="w-[160px]">Timestamp</th>
            <th>Email</th>
            <th>Event</th>
            <th>Outcome</th>
            <th>Method</th>
            <th class="hidden lg:table-cell">IP Address</th>
            <th class="hidden lg:table-cell">Location</th>
            <th class="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 && !loading ? (
            <tr><td colSpan={8} class="audit-empty">No login forensics found. Authentication attempts will appear here.</td></tr>
          ) : (
            logs.map(log => (
              <>
                <tr
                  key={log.id}
                  class={`audit-row ${log.event_type === 'LOGIN_BLOCKED' ? 'security-row-blocked' : (!log.success ? 'security-row-failed' : '')} ${!log.is_authorized_email ? 'security-row-unauth' : ''}`}
                  onClick={() => onToggle(log.id)}
                >
                  <td><span class="audit-ts">{formatTimestamp(log.created_at, true)}</span></td>
                  <td>
                    <div class="security-email-cell">
                      <span class="audit-email">{log.email}</span>
                      {!log.is_authorized_email && (
                        <span class="security-unauth-chip">⚠ UNAUTH</span>
                      )}
                    </div>
                  </td>
                  <td><EventTypeBadge eventType={log.event_type} /></td>
                  <td><OutcomeBadge success={log.success} /></td>
                  <td>
                    <span class="security-method-chip">
                      {cfMethodIcon(log.cf_access_method || log.login_method)}
                      {' '}{(log.cf_access_method || log.login_method || 'unknown')}
                    </span>
                  </td>
                  <td class="hidden lg:table-cell">
                    <span class="security-ip-mono">{maskIP(log.ip_address)}</span>
                  </td>
                  <td class="hidden lg:table-cell">
                    {log.geo_location ? (
                      <span class="security-geo-chip">📍 {log.geo_location}</span>
                    ) : (
                      <span class="audit-target">—</span>
                    )}
                  </td>
                  <td>
                    <span class={`audit-chevron ${expandedId === log.id ? 'audit-chevron-open' : ''}`}>▸</span>
                  </td>
                </tr>
                {expandedId === log.id && (
                  <tr key={`${log.id}-detail`} class="audit-detail-tr">
                    <td colSpan={8}>
                      <ForensicPanel log={log} />
                    </td>
                  </tr>
                )}
              </>
            ))
          )}
        </tbody>
      </table>
      <TableFooter loading={loading} hasMore={hasMore} onLoadMore={onLoadMore} />
    </div>
  );
}
'''

# ─── ActivityCenter.tsx (thin orchestrator) ──────────────────────────────────
activity_center_tsx = '''import { useState, useEffect } from 'preact/hooks';
import { ConfirmDialog } from '../../ui/ConfirmDialog';
import type { TabId, AuditLog, EmailLog, ConsentRecord, LoginLog, Stats } from './shared';
import { buildQueryString, TABS } from './shared';
import { MicroStatsRibbon } from './MicroStatsRibbon';
import { ActivityFilterBar } from './ActivityFilterBar';
import { ActivityStream } from './ActivityLogTab';
import { EmailLogsTable } from './EmailLogTab';
import { ConsentTrailTable } from './ConsentTrailTab';
import { SecurityForensicsTable } from './LoginForensicsTab';

interface Props {
  activeRole: string;
  featureFlags: {
    canExport: boolean;
    canPrune: boolean;
    canDelete?: boolean;
    canViewSecurity?: boolean;
  };
}

interface ApiResponse {
  success: boolean;
  error?: string;
  logs?: unknown[];
  total?: number | null;
  hasMore?: boolean;
}

interface StatsResponse extends Stats {
  success: boolean;
}

export function ActivityCenter({ activeRole, featureFlags }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('activity');
  const [stats, setStats] = useState<Stats | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPruning, setIsPruning] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeletingBulk, setIsDeletingBulk] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    variant?: 'default' | 'danger';
    requiredText?: string;
    confirmLabel?: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const closeDialog = () => setConfirmDialog(prev => ({ ...prev, open: false }));

  const [activityLogs, setActivityLogs] = useState<AuditLog[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [consentLogs, setConsentLogs] = useState<ConsentRecord[]>([]);
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});

  const LIMIT = 50;

  const apiMap: Record<TabId, string> = {
    activity: '/api/audit/logs',
    emails: '/api/audit/emails',
    consent: '/api/audit/consent',
    security: '/api/audit/login-logs',
  };

  const fetchStats = () => {
    fetch('/api/audit/stats', { cache: 'no-store' })
      .then(r => r.json())
      .then((d: StatsResponse) => d.success && setStats(d))
      .catch(() => {});
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setExpandedId(null);
    fetchData(0, true);
  }, [activeTab, JSON.stringify(filters)]);

  const fetchData = async (currentOffset: number, reset = false) => {
    setLoading(true);
    setError('');
    try {
      const qs = buildQueryString(filters, LIMIT, currentOffset);
      const res = await fetch(`${apiMap[activeTab]}?${qs}`, {
        cache: 'no-store',
        headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
      });
      const data = await res.json() as ApiResponse;

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load data');
        return;
      }

      const newLogs = (data.logs ?? []) as AuditLog[] & EmailLog[] & ConsentRecord[] & LoginLog[];
      if (data.total !== null && data.total !== undefined) setTotal(data.total);
      setHasMore(data.hasMore ?? false);
      setOffset(currentOffset + LIMIT);

      if (activeTab === 'activity') {
        setActivityLogs(reset ? newLogs as AuditLog[] : [...activityLogs, ...(newLogs as AuditLog[])]);
      } else if (activeTab === 'emails') {
        setEmailLogs(reset ? newLogs as EmailLog[] : [...emailLogs, ...(newLogs as EmailLog[])]);
      } else if (activeTab === 'security') {
        setLoginLogs(reset ? newLogs as LoginLog[] : [...loginLogs, ...(newLogs as LoginLog[])]);
      } else {
        setConsentLogs(reset ? newLogs as ConsentRecord[] : [...consentLogs, ...(newLogs as ConsentRecord[])]);
      }
    } catch (err: unknown) {
      setError((err as Error).message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => fetchData(offset);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    try {
      const res = await fetch('/api/audit/export?source=audit', { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Export failed' })) as { error?: string };
        alert(err.error || 'Export failed');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Export failed');
    }
  };

  const executePrune = async () => {
    setIsPruning(true);
    try {
      const res = await fetch('/api/audit/prune?days=30', { method: 'DELETE' });
      const data = await res.json() as ApiResponse;
      if (res.ok && data.success) {
        setFilters({ ...filters });
        fetchStats();
      } else {
        alert(data.error || 'Prune failed');
      }
    } catch {
      alert('Error pruning logs');
    } finally {
      setIsPruning(false);
    }
  };

  const handlePrune = () => {
    setConfirmDialog({
      open: true,
      title: 'Prune Old Logs',
      message: 'Permanently delete all audit logs older than 30 days? This action cannot be undone.',
      variant: 'danger',
      requiredText: 'PRUNE',
      confirmLabel: 'Prune Logs',
      onConfirm: () => { closeDialog(); executePrune(); }
    });
  };

  const handleTabSwitch = (id: TabId) => {
    setActiveTab(id);
    setFilters({});
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (ids: string[], isAll: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => { if (isAll) next.add(id); else next.delete(id); });
      return next;
    });
  };

  const executeBulkDelete = async () => {
    setIsDeletingBulk(true);
    try {
      const res = await fetch(apiMap[activeTab], {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) })
      });
      const data = await res.json() as ApiResponse;
      if (res.ok && data.success) {
        setSelectedIds(new Set());
        fetchStats();
        setTimeout(() => fetchData(0, true), 50);
      } else {
        alert(data.error || 'Deletion failed');
      }
    } catch {
      alert('Error updating database');
    } finally {
      setIsDeletingBulk(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setConfirmDialog({
      open: true,
      title: 'Delete Selected Entries',
      message: `Permanently delete ${selectedIds.size} selected entries? This will permanently erase the audit data and cannot be undone.`,
      variant: 'danger',
      confirmLabel: 'Delete All',
      onConfirm: () => { closeDialog(); executeBulkDelete(); }
    });
  };

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  return (
    <div class="audit-center">
      <div class="flex flex-col gap-3 mb-6 relative z-10">

        {/* Row 1: Title & Stats & Actions */}
        <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div class="flex items-center gap-4 shrink-0">
            <div class="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-indigo-500/30 text-indigo-400 shadow-inner">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            </div>
            <div>
              <h2 class="text-xl font-bold tracking-tight text-slate-800 dark:text-white leading-tight">
                System Audit <span class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Center</span>
              </h2>
              <p class="text-[0.7rem] text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Unified Visibility Hub</p>
            </div>
          </div>

          <div class="flex items-center gap-3 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <MicroStatsRibbon stats={stats} />

            <div class="flex items-center gap-2 shrink-0 border-l border-slate-200 dark:border-white/10 pl-3">
              {featureFlags.canExport && (
                <button onClick={handleExport} class="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors shadow-sm" title="Export CSV">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  <span class="hidden sm:inline ml-1.5">Export</span>
                </button>
              )}
              {featureFlags.canPrune && (
                <button onClick={handlePrune} disabled={isPruning} class="flex items-center gap-1.5 h-8 px-2.5 rounded-md text-xs font-medium bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 border border-slate-200 dark:border-white/10 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors shadow-sm disabled:opacity-50" title="Prune old logs">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span class="hidden sm:inline ml-1.5">{isPruning ? 'Pruning...' : 'Prune'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Tab Navigation */}
        <div class="flex items-center overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden shrink-0 border-b border-slate-200 dark:border-white/10 pb-2">
          <div class="flex bg-slate-100/50 dark:bg-white/5 p-1 rounded-lg backdrop-blur-md border border-slate-200/50 dark:border-white/5">
            {TABS.filter(t => !t.restricted || featureFlags.canViewSecurity).map(tab => (
              <button
                key={tab.id}
                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200 dark:ring-white/10'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/5'
                }`}
                onClick={() => handleTabSwitch(tab.id)}
              >
                <span class="text-sm opacity-70">{tab.icon}</span>
                {tab.label}
                {activeTab === tab.id && total !== null && (
                  <span class="ml-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-[0.65rem] text-slate-600 dark:text-slate-300 leading-none">
                    {total.toLocaleString()}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Row 3: Filters */}
        <div class="flex items-center justify-between gap-3 bg-transparent py-1">
          <ActivityFilterBar tab={activeTab} filters={filters} onChange={handleFilterChange} />
        </div>
      </div>

      {error && (
        <div class="audit-error">
          <strong>Error:</strong> {error}
        </div>
      )}

      {featureFlags.canDelete && selectedIds.size > 0 && (
        <div class="flex items-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 shadow-sm rounded-lg px-3 py-1.5 mb-3 w-fit animate-in fade-in slide-in-from-top-2">
          <span class="text-xs font-medium text-slate-600 dark:text-slate-300">
            <strong class="text-slate-900 dark:text-white">{selectedIds.size}</strong> items selected
          </span>
          <div class="w-px h-4 bg-slate-200 dark:bg-white/10"></div>
          <button
            onClick={handleBulkDelete}
            disabled={isDeletingBulk}
            class="flex items-center gap-1.5 h-7 px-2.5 rounded text-xs font-medium bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            {isDeletingBulk ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      )}

      {activeTab === 'activity' && (
        <ActivityStream
          logs={activityLogs}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          expandedId={expandedId}
          onToggle={toggleExpand}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={handleSelectAll}
          canDelete={featureFlags.canDelete}
        />
      )}
      {activeTab === 'emails' && (
        <EmailLogsTable
          logs={emailLogs}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          expandedId={expandedId}
          onToggle={toggleExpand}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={handleSelectAll}
          canDelete={featureFlags.canDelete}
        />
      )}
      {activeTab === 'consent' && (
        <ConsentTrailTable
          logs={consentLogs}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          expandedId={expandedId}
          onToggle={toggleExpand}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onSelectAll={handleSelectAll}
          canDelete={featureFlags.canDelete}
        />
      )}
      {activeTab === 'security' && featureFlags.canViewSecurity && (
        <SecurityForensicsTable
          logs={loginLogs}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          expandedId={expandedId}
          onToggle={toggleExpand}
        />
      )}
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        requiredText={confirmDialog.requiredText}
        confirmLabel={confirmDialog.confirmLabel}
        onConfirm={confirmDialog.onConfirm}
        onCancel={closeDialog}
      />
    </div>
  );
}
'''

files = {
    'shared.ts':              shared_ts,
    'Badges.tsx':             badges_tsx,
    'MicroStatsRibbon.tsx':   micro_stats_tsx,
    'ActivityFilterBar.tsx':  filter_bar_tsx,
    'ActivityLogTab.tsx':     activity_log_tsx,
    'EmailLogTab.tsx':        email_log_tsx,
    'ConsentTrailTab.tsx':    consent_trail_tsx,
    'LoginForensicsTab.tsx':  login_forensics_tsx,
    'ActivityCenter.tsx':     activity_center_tsx,
}

for fname, content in files.items():
    fpath = os.path.join(BASE, fname)
    with open(fpath, 'w', encoding='utf-8') as f:
        f.write(content)
    lines = content.count('\n')
    print(f"Written: {fname} ({lines} lines)")

print("\nDone. ActivityCenter.tsx replaced, 8 new files created.")
