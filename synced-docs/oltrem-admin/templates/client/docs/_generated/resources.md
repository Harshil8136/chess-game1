---
title: "Resources"
status: generated
source: `oltrem.manifest.json` and `wrangler.jsonc`
---

# Resources

> Written by `oltrem docs` from the files named above; never edited by hand. `oltrem docs --check` in verify refuses a stale copy.

One of each resource (R-09): every binding, queue, class, cron, var and secret the Worker may
have is listed in `oltrem.manifest.json`; `oltrem manifest check` refuses anything else.

| Binding | Kind |
|---|---|
| `CACHE` | kv |
| `DB` | d1 |
| `EVENTS` | queue |
| `FILES` | r2 |
| `JOBS` | workflow |
| `LIMITS` | ratelimit |
| `METRICS` | analytics_engine |

| What | Names |
|---|---|
| Queues | `oltrem-client-events`, `oltrem-client-events-dlq` |
| Durable Object classes | none |
| Crons | `* * * * *` |
| Vars | `CLIENT_ID`, `ENVIRONMENT`, `PUBLIC_HOST` |
| Secrets (by name) | `ACCESS_AUD`, `BACKUP_PUBLIC_KEY`, `KEK`, `KIT_OPS_TOKEN` |

No exception to the caps.
