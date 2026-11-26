---
title: "@oltrem/data: tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/data/test]
---

# @oltrem/data: tests

> Part of [the @oltrem/data README](../README.md).

## Tests

In the Workers runtime, every service answered from a script so nothing leaves the machine.

| File | What it holds |
| --- | --- |
| `dialects.test.ts` | Each dialect's address, headers and parameterised query, how it reads answers and cursors, `complete` when cut, probes, refusals with the key blanked |
| `supabase.test.ts` | The Management API (only the token sent, logs, advisors, backups, functions, questions cut to 100 rows, the overview, usage) and a project's users, buckets, files and health; the routes' permissions and audit marks |
| `warnings.test.ts` | What each service's answer needs a look for (unhealthy services, read-only mode, a 90% disk, Turso blocks and 80% allowance, Upstash state and limits) |
| `usage.test.ts` | Neon, Turso and Upstash usage found from the host, only GETs and the API key sent, refusals in words; `data.services` through the routes |
| `supabase-sign-in.test.ts`, `airtable-sign-in.test.ts` | When a token is due, renewal through the relay or Airtable, kept only over the credential it was opened from (`registry.renew`), refusals said, pasted tokens never renewed |
| `edits.test.ts` | Editing on a fake libSQL server running each statement on D1: keys, locked columns, the switch, only changed columns, stale forms, Undo, Owner-only delete, 30-day copies, audit without values |
| `editors.test.ts` | Neon's and Supabase's editors: the key from `pg_index`, read-only batches, UPDATE or PATCH by key, put-back with `OVERRIDING SYSTEM VALUE`, views and locked columns refused |
| `call.test.ts` | Timeouts, redirects, non-JSON or over-2 MB answers, IP addresses and `localhost` never called, the key never in the address |
| `detect.test.ts` | Each service told from a paste, with refusals that say what to paste instead |
| `overview.test.ts` | A Supabase project at a glance: the verdict and what needs a person, worst first |
| `module.test.ts` | The routes beside IAM and providers: permissions at the company, connecting, tables and rows, Check now's cooldown, key rules, the timed check, Home's line, renames, removal |
| `pages.test.ts` | Every page against the API's answers, a reader's view, failures staying on their page |
