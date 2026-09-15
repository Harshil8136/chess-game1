{% raw %}
# cf-astro Operations Reference

**Date:** 2026-06-18 — §4 and §5 corrected 2026-09-15 against `wrangler.toml`, the account KV list (Cloudflare API) and `SYSTEM-ARCHITECTURE.md` §4

This document outlines the core infrastructure bindings and the CLI commands used to manage and verify the Cloudflare resources attached to `cf-astro`.

## 1. Authentication

All Cloudflare commands are authenticated via an OAuth Token for `[CF_ACCOUNT_EMAIL]` (Account ID: `REDACTED_VIA_OAUTH`).

**Verify access:**

```bash
npx wrangler whoami
```

## 2. D1 Database (`madagascar-db`)

Serves as the authoritative source for non-PII configurations and queues.

- **Binding ID:** `[D1_MADAGASCAR_DB_ID]`
- **Region:** ENAM
- **Verify status:**

```bash
npx wrangler d1 info madagascar-db
```

## 3. R2 Buckets

Used for secure identity document storage and public CMS images.

- `arco-documents` (ARCO legal documents)
- `madagascar-images` (Public CMS gallery)
- **Verify status:**

```bash
npx wrangler r2 bucket list
```

## 4. KV Namespaces

Used for SSR rendering caches and session state.

- `SESSION`
- `ISR_CACHE`
- `CHATBOT_CACHE`
- `CHATBOT_KV`
- `ADMIN_SESSION`
- `EMAIL_IDEMPOTENCY` (the email consumer's dedupe namespace; 6 namespaces on the account as of 2026-09-15)
- **Verify status:**
  _(Note: `npx wrangler kv:namespace list` is deprecated; use the exact syntax below)_

```bash
npx wrangler kv namespace list
```

## 5. Queues

Decouples email delivery and syncing from user API requests.

- `madagascar-emails` (email sending by the shared `cf-astro-email-consumer` Worker — Brevo primary, Resend as same-request failover; see `SYSTEM-ARCHITECTURE.md` §4)
- `madagascar-emails-dlq` (Dead-letter queue)
- `madagascar-sync-revalidate` (Sync events)
- `madagascar-sync-revalidate-dlq` (Dead-letter queue)
- **Verify status:**

```bash
npx wrangler queues list
```

---

_For further architectural guidelines on how these interact with Astro, see `SYSTEM-ARCHITECTURE.md`._

{% endraw %}
