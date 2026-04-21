{% raw %}
# Infrastructure Free Tier Limits

> **Component:** CF-Admin & CF-Astro Shared Infrastructure
> **Last Updated:** 2026-04-20

This project strictly adheres to a $0 operational cost philosophy. The following quotas dictate system constraints and caching strategies.

## 1. CLOUDFLARE FREE TIER — EXACT LIMITS & QUOTAS

All data verified against official Cloudflare documentation (March 2026).

### 1.1 Workers (Compute)

| Metric | Free Limit |
|--------|-----------|
| Requests | **100,000/day** |
| CPU time per request | **10 ms** |
| Memory | 128 MB |
| Subrequests per request | 50 |
| Worker script size | 3 MB |
| Number of Workers | 100 per account |

### 1.2 KV (Sessions & Cache)

| Metric | Free Limit |
|--------|-----------|
| Keys read | **100,000/day** |
| Keys written | **1,000/day** |
| Storage per account | **1 GB** |

### 1.3 D1 Database (SQLite)

| Metric | Free Limit |
|--------|-----------|
| Rows read | **5 million/day** |
| Rows written | **100,000/day** |
| Storage | **5 GB** |

### 1.4 R2 Object Storage

| Metric | Free Limit |
|--------|-----------|
| Storage | **10 GB/month** |
| Reads | **10 million/month** |
| Writes | **1 million/month** |
| Egress | **FREE (always $0)** |

---

## 2. SUPABASE FREE TIER

| Metric | Free Limit |
|--------|-----------|
| Projects | **2 active** (cf-astro + cf-admin share 1 project) |
| PostgreSQL size | **500 MB** |
| Auth MAUs | **50,000** |
| File storage | **1 GB** |
| Edge Functions | **500,000/month** |
| RLS policies | **Unlimited** |

---

## 3. UPSTASH FREE TIER

| Metric | Free Limit |
|--------|-----------|
| Commands per day | **10,000** |
| Max data size | **256 MB** |
| Concurrent connections | 10 |
| Databases | 1 |

{% endraw %}
