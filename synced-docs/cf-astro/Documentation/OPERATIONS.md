{% raw %}
# cf-astro Operations Reference
**Date:** 2026-06-18

This document outlines the core infrastructure bindings and the CLI commands used to manage and verify the Cloudflare resources attached to `cf-astro`.

## 1. Authentication
All Cloudflare commands are authenticated via an OAuth Token for `mascotasmadagascar@gmail.com` (Account ID: `320d1ebab5143958d2acd481ea465f52`).

**Verify access:**
```bash
npx wrangler whoami
```

## 2. D1 Database (`madagascar-db`)
Serves as the authoritative source for non-PII configurations and queues.

- **Binding ID:** `7fca2a07-d7b4-449d-b446-408f9187d3ca`
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
- **Verify status:**
*(Note: `npx wrangler kv:namespace list` is deprecated; use the exact syntax below)*
```bash
npx wrangler kv namespace list
```

## 5. Queues
Decouples email delivery and syncing from user API requests.

- `madagascar-emails` (Email sending via Resend)
- `madagascar-emails-dlq` (Dead-letter queue)
- `madagascar-sync-revalidate` (Sync events)
- `madagascar-sync-revalidate-dlq` (Dead-letter queue)
- **Verify status:**
```bash
npx wrangler queues list
```

---
*For further architectural guidelines on how these interact with Astro, see `SYSTEM-ARCHITECTURE.md`.*

{% endraw %}
