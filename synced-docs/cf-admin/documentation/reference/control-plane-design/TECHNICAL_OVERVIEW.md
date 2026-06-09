---
title: "Service Control Plane — Technical Overview"
status: active
audience: [ai, technical]
last_verified: 2026-06-06
verified_against: [code]
owner: harshil
tags: []
---

# Service Control Plane — Technical Overview

> **TL;DR (non-technical):** A technical overview of the Service Control Plane system: its architecture, data flow, and access-control model.

> **Status:** Implementation Complete  
> **Version:** 2.1  
> **Last Updated:** June 2026  
> **Audience:** Technical and Non-Technical Teams

## Executive Summary

The Service Control Plane is a unified admin interface that enables real-time management of observability, analytics, rate-limiting, and infrastructure settings across the Madagascar Hotel ecosystem—without requiring application redeployment.

**Key Benefits:**
- Single dashboard for all service metrics and configuration
- Runtime tuning of sampling rates, analytics capture, and rate limits
- Audit trail for all configuration changes
- Role-based access control with granular permission management
- Fail-safe architecture that never breaks production

---

## 1. System Architecture Overview

### 1.1 The Application Stack

| Component | Type | Purpose | Auth |
|-----------|------|---------|------|
| **cf-astro** | Public web application | Marketing & booking site | None (bearer secrets) |
| **cf-admin** | Admin dashboard | Management & control plane | Cloudflare Zero Trust + RBAC |
| **cf-chatbot** | AI assistant | Conversational support | API keys |
| **Shared Infrastructure** | Databases & messaging | Data persistence & async work | Role-based |

### 1.2 Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│         cf-admin Control Plane Dashboard                │
│  (RBAC + Permission-based Access Control)              │
└──────────────┬──────────────────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
  ┌─────────┐      ┌──────────────┐
  │ LAYER A │      │  LAYER B     │
  │ Remote  │      │  Provider    │
  │ Config  │      │  Control     │
  └────┬────┘      └────┬─────────┘
       │                │
       ├─ D1 Config DB  ├─ Sentry API
       ├─ KV Cache      ├─ PostHog API
       └─ Audit Log     ├─ Cloudflare API
                        └─ Supabase API

       ▼
  ┌──────────────┐
  │  cf-astro    │
  │  cf-admin    │
  └──────────────┘
```

**Layer A (Remote Config):** Settings owned and managed by the application
- Sampling rates (Sentry traces, PostHog sessions)
- Error rate limits
- Feature toggles
- Rate-limiting thresholds
- Stored in shared database, cached locally

**Layer B (Provider Control):** Settings owned by external providers
- Sentry dynamic sampling rules, client-key rate limits, spike protection
- PostHog project settings, session recording configuration
- Cloudflare cache policies and worker observability
- Supabase database advisories

---

## 2. Data Flow Architecture

### 2.1 Configuration Propagation

```
Admin edits config in control plane
           ↓
D1 database updated + version bumped
           ↓
    ┌──────┴──────┐
    ▼             ▼
cf-admin cache   cf-astro notified
invalidated      via webhook
    │             │
    │      [async cache flush]
    ▼             ▼
Each app independently caches configuration:
  • Isolate memory (10s TTL)
  • Edge cache (60s TTL)
  • Database (source of truth)
  • Hardcoded defaults (fail-safe)
    │
    ▼
Configuration available to:
  • Server-side (initialization)
  • Client-side (fetch on page load)
```

### 2.2 Three-Layer Cache Strategy

Every configuration read uses three tiers for optimal performance and resilience:

1. **Isolate Memory (10 seconds)**
   - Fastest: in-process cache
   - Zero I/O latency
   - Refreshed automatically on timeout

2. **Edge Cache (60 seconds)**
   - Regional caching via Cloudflare
   - Reduced database load
   - Synchronized across deployments

3. **Database (Source of Truth)**
   - Shared D1 database
   - Version-tracked for change detection: each `service_config` row has a
     monotonic integer `version` bumped on every write (migration 0034). The
     global change token is `SUM(version)`, which increments by exactly 1 per
     update — immune to the same-second collisions a timestamp would have.
   - Optimistic concurrency: `PATCH /api/control-plane/config` accepts the
     expected version via the `If-Match` header (or `expected_version` in the
     body) and returns `409` if another writer changed the row first, so two
     admins editing the same key can't silently clobber each other.
   - Fallback: hardcoded defaults on failure

---

## 3. Access Control Model

### 3.1 Role Hierarchy

The system uses a 5-tier role hierarchy with escalating permissions:

| Tier | Role | Capabilities |
|------|------|---|
| 0 | `dev` | All permissions (debug/admin bypass) |
| 1 | `owner` | Approve Layer B (external API) changes |
| 2 | `super_admin` | View & manage all systems |
| 3 | `admin` | Edit Layer A (app configuration) |
| 4 | `staff` | Limited read-only access |

### 3.2 Permission Matrix

| Action | Required Role | Permission Flag |
|--------|---------------|-----------------|
| View control plane | `super_admin` | `/dashboard/control-plane` |
| Edit sampling/rates | `admin` | `/dashboard/control-plane#edit-sampling` |
| Write to providers | `owner` | `/dashboard/control-plane#provider-write` |
| Purge cache | `admin` | `/dashboard/control-plane#purge-config` |

### 3.3 Sidebar Navigation

The control plane appears in the **MANAGEMENT** section alongside Settings and Users management.

Sub-pages are accessible through in-page tabs (not sidebar):
- Sentry — observability and error tracking
- Cloudflare — edge infrastructure and caching
- PostHog — analytics and user tracking
- Supabase — database health and advisories

---

## 4. Configuration Management

### 4.1 Configuration Types

| Category | Examples | Layer | Scope |
|----------|----------|-------|-------|
| **Sampling** | Trace rates, error sample rate, session recording | A | Application |
| **Features** | Kill switches, capture toggles, PII sending | A | Application |
| **Limits** | Rate-limit thresholds, timeouts | A | Application |
| **Operations** | Worker observability, cache behavior | B | Infrastructure |

### 4.2 Configuration Schema

Each configuration item includes:
- **Key**: Unique identifier (e.g., `sentry.cf_astro.traces.booking`)
- **Value**: Current setting
- **Type**: `number`, `boolean`, `string`, or `json`
- **Service**: Which provider manages it (`sentry`, `posthog`, `cloudflare`)
- **Scope**: Which app(s) it affects (`cf-astro`, `cf-admin`, `global`)
- **Bounds**: Min/max values (for numeric types)
- **Description**: Human-readable purpose

Example:
```
key: sentry.cf_astro.traces.booking
value: 0.5
type: number
service: sentry
scope: cf-astro
bounds: [0, 1]
description: "Trace sample rate for booking pages (50%)"
```

### 4.3 Current Configuration Values

**Sentry Observability (cf-astro)**
- `/booking` pages: 50% trace sampling
- `/api/*` routes: 10% trace sampling
- All other routes: 0% trace sampling
- Error events: 100% sampling
- Session replay: Disabled
- Server-side: 10% trace sampling

**Sentry Observability (cf-admin)**
- Server-side: 10% trace sampling
- Error events: 100% sampling
- Replay: Disabled

**PostHog Analytics (cf-astro)**
- Enabled: Yes
- Page views: Auto-captured
- Session recording: Disabled (0% sample)
- Form interactions: Auto-captured

**Rate Limits (cf-astro)**
- Booking endpoint: 20 requests / 60 seconds
- Consent endpoint: 20 requests / 60 seconds
- Contact form: 10 requests / 60 seconds
- ARCO upload: 3 requests / 60 seconds
- Analytics: 60 requests / 60 seconds

---

## 5. Observability Integration

### 5.1 Sentry Error Tracking

**Metrics Available:**
- Total events received in 24 hours
- Error rate (events per minute)
- Top unresolved issues
- Transaction performance
- Browser/device breakdown

**Tunable Settings:**
- Trace sampling rate (0-100%)
- Error event sampling (0-100%)
- Client-key rate limits
- Inbound data filters
- Spike protection toggle

**Read-Only Settings:**
- Dynamic sampling rules (managed by Sentry)
- Alert rules (view and link to Sentry for edits)

### 5.2 PostHog Analytics

**Metrics Available:**
- Pageview counts by day
- Unique visitor counts
- Session duration trends
- Event volume vs quota usage
- Quota remaining (% used)

**Tunable Settings:**
- Global enable/disable
- Page view capture
- Form interaction capture
- Session recording enabled
- Session recording sample rate (0-100%)

### 5.3 Cloudflare Infrastructure

**Metrics Available:**
- Total requests (24h)
- Error rate (5xx, 4xx)
- Cache hit ratio
- Bandwidth (GB)
- Average response time

**Tunable Settings:**
- Cache purge (single URL or all)
- Worker observability (read-only, requires redeploy)
- KV storage operations

---

## 6. File Structure and Components

### 6.1 Core Services

```
src/lib/
├── dal/
│   └── ServiceConfigRepository.ts      # Configuration CRUD
├── control-plane/
│   ├── config-schema.ts                # Configuration registry
│   ├── config-publisher.ts             # D1 → KV propagation
│   ├── sentry-admin.ts                 # Sentry REST client
│   ├── posthog-admin.ts                # PostHog client
│   ├── cloudflare-admin.ts             # Cloudflare client
│   └── supabase-admin.ts               # Supabase client
└── audit.ts                            # Audit logging
```

### 6.2 API Routes

```
src/pages/api/control-plane/
├── config.ts                           # GET/PATCH configurations
├── sentry.ts                           # Sentry operations
├── posthog.ts                          # PostHog operations
├── cloudflare.ts                       # Cloudflare operations
├── supabase.ts                         # Supabase operations
└── purge-cache.ts                      # Cache invalidation
```

### 6.3 Admin Interface

```
src/pages/dashboard/control-plane/
├── index.astro                         # Main overview
├── sentry.astro                        # Sentry dashboard
├── cloudflare.astro                    # Cloudflare dashboard
├── posthog.astro                       # PostHog dashboard
└── supabase.astro                      # Supabase dashboard

src/components/admin/control-plane/
├── SamplingSlider.tsx                  # Rate sliders
├── ProviderMetricsCard.tsx             # Metrics display
├── ConfigDiffModal.tsx                 # Change history
└── ServiceToggle.tsx                   # On/off switches
```

---

## 7. API Reference

### 7.1 Configuration Endpoints

**GET /api/control-plane/config**
- List all configurations
- Response: Array of configuration items
- Authentication: `super_admin`
- Caching: 60 seconds

**PATCH /api/control-plane/config**
- Update single configuration
- Body: `{ key, value, reason }`
- Authentication: `admin` + `#edit-sampling`
- Response: Updated item with new version
- Audited: Yes

**POST /api/control-plane/purge-cache**
- Invalidate configuration caches
- Effect: Both cf-astro and cf-admin re-pull immediately
- Authentication: `admin` + `#purge-config`
- Latency: < 100ms

### 7.2 Metrics Endpoints

**GET /api/control-plane/sentry**
- Sentry metrics and statistics
- Response: Last 24h event volume, error rate, top issues
- Authentication: `super_admin`
- No caching (fresh data)

**GET /api/control-plane/posthog**
- PostHog analytics summary
- Response: Pageviews, unique users, session count
- Authentication: `super_admin`
- Cached: 5 minutes

**GET /api/control-plane/cloudflare**
- Cloudflare edge metrics
- Response: Requests, errors, cache ratio, bandwidth
- Authentication: `super_admin`
- Cached: 5 minutes

**GET /api/control-plane/supabase**
- Database health and metrics
- Response: Row counts, query performance, storage usage
- Authentication: `super_admin`
- Cached: 5 minutes

### 7.3 Provider Operations

**POST /api/control-plane/sentry** (Layer B)
- Apply changes directly to Sentry organization
- Examples: Update client-key rate limits, toggle spike protection
- Authentication: `owner` + `#provider-write`
- Audited: Yes

**POST /api/control-plane/cloudflare** (Layer B)
- Purge cache, update settings
- Authentication: `owner` + `#provider-write`
- Audited: Yes

---

## 8. Audit and Compliance

### 8.1 Change Tracking

Every configuration change is logged with:
- **Who**: User ID, email, and role
- **What**: Configuration key, old value, new value
- **When**: Exact timestamp
- **Why**: Reason provided by user
- **Scope**: Audit module and target type

### 8.2 Audit Log Queries

Find all changes to error sampling:
```sql
SELECT * FROM admin_audit_log
WHERE action = 'config_change'
  AND details LIKE '%error_sample_rate%'
ORDER BY created_at DESC
```

Find all Layer B operations:
```sql
SELECT * FROM admin_audit_log
WHERE action = 'provider_write'
  AND module = 'control_plane'
ORDER BY created_at DESC
```

### 8.3 History and Rollback

The system maintains a complete history of all configuration values. Admins can:
- View the before/after for any change
- See who made the change and when
- Revert to a previous value (which creates a new audit entry)
- Reset all values to application defaults

---

## 9. Consumer-Side Implementation

### 9.1 How cf-astro Reads Configuration

```
Request arrives at cf-astro
     ↓
Check isolate memory cache (10s TTL)
     ├─ HIT: Use cached values
     └─ MISS: Check edge cache
          ├─ HIT: Update isolate memory
          └─ MISS: Query D1 database
               ├─ SUCCESS: Cache and use
               └─ FAIL: Use hardcoded defaults (fail-safe)
```

### 9.2 Client-Side Configuration

Browser scripts need configuration before initializing observability tools:

1. **Static Pages**: Fetch from `GET /api/runtime-config` endpoint
   - Returns client-safe values only (never secrets)
   - Cached at edge for 60 seconds
   - Falls back to hardcoded defaults on failure

2. **Server-Rendered Pages**: Receive JSON from server
   - Injected as `<script type="application/json">`
   - Available immediately to JavaScript
   - No execution security risk (CSP safe)

### 9.3 Sentry Integration

**Server-Side:**
- Trace sampling reads from config at startup
- Automatically refreshes every 10 seconds
- First request may use hardcoded default

**Client-Side:**
- Trace sampling configured via callback function
- Different rates for different routes
- Error sampling applied in `beforeSend` hook

Example trace sampling:
```
/booking → 50% of traces captured
/api/* → 10% of traces captured
others → 0% of traces captured
```

### 9.4 PostHog Integration

**Initialization:**
- Check config for enabled status
- If disabled, skip loading PostHog entirely
- No network requests, no analytics captured

**Configuration:**
- Page view capture: Controlled by config
- Form capture: Controlled by config
- Session recording: Disabled by default

### 9.5 Rate Limiting

Rate limits are applied per endpoint based on configuration:
- Booking: 20 requests per minute per IP
- Contact form: 10 requests per minute per IP
- Analytics: 60 requests per minute per IP

Limits can be adjusted without redeployment.

---

## 10. Deployment and Rollout

### 10.1 Implementation Phases

| Phase | Component | Status | Duration |
|-------|-----------|--------|----------|
| **0** | Core infrastructure (database, pages, RBAC) | ✅ Complete | 2 weeks |
| **1** | Read-only metrics dashboards | ✅ Complete | 1 week |
| **2** | Layer A writes (app configuration) | ✅ Complete | 1 week |
| **3** | cf-astro consumer integration | ✅ Complete | 2 weeks |
| **4** | Layer B writes (provider control) | ✅ Complete | 2 weeks |
| **5** | Polish and advanced features | ✅ Complete | 1 week |

### 10.2 Deployment Checklist

Before going live:
- [ ] Run defaults-parity test (verify config matches hardcoded values)
- [ ] Test fail-safe: Disable database access and verify startup succeeds
- [ ] Verify cache propagation: Edit config and observe updates in both apps
- [ ] Test rollback: Revert a change and confirm it propagates
- [ ] Smoke test: Hit `/api/runtime-config` and verify response
- [ ] Audit trail test: Verify all changes are logged
- [ ] Permission test: Verify RBAC gates work correctly

### 10.3 Kill Switches

Each service has a master kill-switch to disable it immediately:
- `sentry.cf_astro.enabled` = false → No Sentry in public site
- `sentry.cf_admin.enabled` = false → No Sentry in admin panel
- `posthog.enabled` = false → No analytics captured
- Rate limiters have per-endpoint disable flags

Toggling any kill-switch propagates within 60 seconds.

---

## 11. Maintenance and Operations

### 11.1 Monitoring and Alerts

Monitor these metrics to detect issues:
- Configuration version change rate (should be stable)
- Cache hit rate (target > 95%)
- Config propagation latency (target < 5s)
- Audit log growth (should be steady)

### 11.2 Common Operations

**Reduce sampling to save quota:**
```
Edit: sentry.cf_astro.traces.* 
From: 0.5 / 0.1 / 0
To:   0.25 / 0.05 / 0
Reason: "Reducing to 50% to stay within Sentry free tier"
```

**Disable observability during performance issues:**
```
Edit: sentry.cf_astro.enabled
From: true
To:   false
Reason: "Temporary disable during incident investigation"
```

**Enable session recording for debugging:**
```
Edit: posthog.session_recording.sample_rate
From: 0
To:   0.1
Reason: "Enabling 10% session recording to debug user flows"
```

### 11.3 Troubleshooting

**Config not propagating:**
1. Check `/api/control-plane/config` on cf-admin (should show new value)
2. Check `/api/runtime-config` on cf-astro
3. Verify cache version is incrementing
4. Manually trigger purge: `POST /api/control-plane/purge-cache`

**Configuration reverted unexpectedly:**
1. Check audit log for who changed it and when
2. Review `service_config_history` table for complete timeline
3. Verify user has `#edit-sampling` permission
4. Check for conflicting automated processes

**Metrics not updating:**
1. Verify provider tokens are configured
2. Check provider connectivity (test endpoint)
3. Verify auth scopes (e.g., Sentry token has `org:read`)
4. Check rate limits on provider APIs

---

## 12. Security Considerations

### 12.1 Secrets Management

Sensitive credentials are stored securely:
- Never displayed in logs
- Never visible in UI
- Only shown as "configured" or "missing" status
- Encrypted at rest by Cloudflare
- Rotated regularly as part of security policy

### 12.2 Validation and Bounds

All configuration values are validated:
- **Numeric ranges**: Rates clamped to [0, 1], counts to [1, 1000]
- **Type checking**: Wrong types rejected
- **Proto-pollution protection**: `__proto__` and `constructor` rejected
- **Size limits**: Strings limited to reasonable lengths

### 12.3 Audit Security

Audit logs cannot be modified or deleted:
- Append-only data structure
- Cryptographic checksums on entries
- Regular export for external archival
- Compliance with regulatory requirements

### 12.4 Configuration Safety

The fail-safe invariant ensures production stability:
- **Missing config**: Uses hardcoded default (no crash)
- **Corrupt config**: Detected and rejected
- **Bad values**: Clamped to valid range
- **Provider API failure**: Continues with last-known-good values

---

## 13. Non-Technical Overview

### For Product & Business Teams

The Service Control Plane allows the team to:
1. **Monitor system health** — See error rates, performance metrics, and user analytics in one place
2. **Respond to incidents** — Turn off data collection or disable features without redeployment
3. **Optimize costs** — Reduce trace sampling to control observability spend
4. **Track changes** — Complete audit trail shows who changed what and when
5. **Manage access** — Team members see only what their role permits

**Key Benefits:**
- **Faster incident response**: 60-second propagation instead of 30-minute redeploy
- **Cost control**: Tune observability spending without engineering effort
- **Team transparency**: All changes logged and traceable
- **Safety**: Kill switches prevent runaway costs

### For Operators and SREs

The control plane provides:
1. **Centralized observability dashboard** — All metrics in one place
2. **Runtime configuration** — Change behavior without deployments
3. **Incident response tools** — Kill switches and rate limit adjustments
4. **Audit trails** — Track all operational changes
5. **Fail-safe architecture** — Production stability guaranteed

**Common Use Cases:**
- Emergency quota management during traffic spikes
- Debugging performance issues without redeployment
- A/B testing observability tuning
- Cost optimization during low-traffic periods
- Compliance and audit reporting

### For Developers

The control plane enables:
1. **Local development** — Test with production config values
2. **Gradual rollout** — Enable new features for percentage of users
3. **Feature flags** — Disable features without code changes
4. **Performance testing** — Tune sampling for realistic data
5. **Debugging** — Increase sampling rates to capture rare issues

**Integration Points:**
- Use `GET /api/runtime-config` in tests
- Check config version for cache invalidation
- Read config in middleware for request-level decisions
- Use kill switches for feature management

---

## 14. Migration Guide

### 14.1 From Manual Changes

**Before:** Editing `wrangler.toml` and redeploying
```
1. Change sampling rate in source code
2. Create git commit
3. Wait for CI
4. Deploy to production (5-10 minutes)
5. Verify change via Sentry
```

**After:** Using the control plane
```
1. Open control plane dashboard
2. Adjust sampling slider
3. Click save
4. Verify change via live metrics (5-60 seconds)
```

### 14.2 Configuration Migration

All existing hardcoded values are automatically migrated to the control plane:
- Sentry sampling rates from source files
- Rate limits from middleware
- Feature flags from code
- PostHog configuration from initialization

The control plane defaults match current production values exactly, so:
- **Zero functional change** on day one
- **Rollback is optional** — can always revert to hardcoded values
- **Gradual adoption** — use control plane for new changes only

---

## 15. Frequently Asked Questions

### Why did we build this?

**Before:** Changing any observability setting required:
- Code modification
- Git commit and review
- CI pipeline run
- Production deployment
- 5-10 minute wait
- Cross-team coordination

**After:** Changes happen instantly with full audit trail.

### What if something goes wrong?

Every change is reversible:
1. Immediately toggle a kill switch (disables system entirely)
2. Revert to previous value (full undo with audit trail)
3. Reset to application defaults (guaranteed safe state)
4. Fall back to hardcoded defaults (automatic, no action needed)

### How do I verify a change propagated?

Check the live metrics dashboard:
- **cf-astro**: Observe new trace/error counts in Sentry
- **cf-admin**: Observe new metrics in control plane
- **Latency**: 60 seconds maximum (usually 5-10 seconds)

### Can I test this in staging?

Yes, each environment has its own:
- Database configuration
- Audit logs
- Kill switches
- Provider credentials

Changes in staging don't affect production.

### What if a provider API is down?

Configuration falls back to last-known-good values:
1. App uses cached value from memory
2. If cache expired, uses edge-cached value
3. If edge cache expired, uses hardcoded default
4. Production never stops working

### How are secrets protected?

- Stored encrypted by Cloudflare
- Never logged or displayed
- Only shown as "configured" status
- Rotated regularly
- Scoped to minimum required permissions
- Audit trail when accessed

---

## 16. Contact and Support

### Technical Questions
- **Architecture**: See section on system design
- **API Reference**: See section on endpoints
- **Implementation**: Check source files in `src/lib/control-plane/`

### Operational Questions
- **How to make a change**: See maintenance and operations section
- **Troubleshooting**: See troubleshooting guide
- **Incident response**: Use kill switches or reduce sampling

### Access and Permissions
- **Requesting access**: Contact your manager and security team
- **Permission levels**: See role hierarchy section
- **Audit of changes**: Review audit log in admin panel

---

## 17. Further Reading

- **RBAC System**: `documentation/rbac-and-audit.md`
- **API Security**: `documentation/authentication.md`
- **Database Schema**: `migrations/0028_service_config.sql`
- **Audit Logging**: `documentation/audit-system.md`
- **Deployment Process**: `documentation/deployment.md`

---

**Document Version:** 2.1  
**Last Updated:** June 2026  
**Next Review:** December 2026
