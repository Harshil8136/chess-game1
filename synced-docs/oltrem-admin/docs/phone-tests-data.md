---
title: "Phone tests owed: Connected data"
status: living
owner: vendor
last_verified: 2026-11-22
sources: [docs/records/2026-11-22-supabase-one-click.md; docs/records/2026-11-22-database-checks-and-rename.md; docs/records/2026-11-22-airtable-sign-in.md; modules/data/README.md; the records each line links]
---

# Phone tests owed: Connected data

> **In plain words.** The phone tests still owed on the Data pages from 22 November on, split
> from [the flows' phone tests](phone-tests-flows.md), which was full, so each list stays small
> enough to read whole (P386 to P393 stay there). They run the same way, and a passed or failed
> line moves to [Phone tests owed](phone-tests.md)'s "Passed" or "Failed, to fix" with the date.

## Owed

| # | Open | You should see | From |
|---|---|---|---|
| P394 | As the Vendor: Settings, System, "Sign-in service for Slack, Discord, Google and Supabase" (now "…, Supabase and Airtable") set to the relay; then as an Owner: Work, Data, Connect a database, the Supabase card | "Sign in with Supabase" above the steps and the key form | [record](records/2026-11-22-supabase-one-click.md) |
| P395 | Sign in with Supabase; on Supabase's page, Cancel | Back on Connect Supabase with "Nothing was connected" and "You cancelled on Supabase's page" | [record](records/2026-11-22-supabase-one-click.md) |
| P396 | Sign in with Supabase with an account that has two or more projects; Authorize | "Pick a Supabase project", one row a project with its address; Connect on one goes to Supabase again and comes back to the next step | [record](records/2026-11-22-supabase-one-click.md) |
| P397 | Sign in with Supabase and Authorize (one project, or after picking); then Cancel; then sign in again and press Connect | "Connect <project>?" with its address and no key shown; Cancel saves nothing (Data lists nothing new); Connect opens the database's page with "Connected" and its tables | [record](records/2026-11-22-supabase-one-click.md) |
| P398 | As a person with View access only: open Connect Supabase | No "Sign in with Supabase", only the steps and "Ask an Owner" | [record](records/2026-11-22-supabase-one-click.md) |
| P423 | Admin, Integrations, Apps, the Data chip | Each database card with its own logo (Airtable, Neon, Supabase, Turso, Upstash) and a line saying how it connects, such as "Paste the connection string of a read-only role"; with the sign-in service set, Supabase's says "Sign in with Supabase" and its button word is Sign in | [the data README](../modules/data/README.md) |
| P424 | Work, Data, Connect a database | The same logos on the service cards, each with its line; a database under Data shows its service's logo | [the data README](../modules/data/README.md) |
| P425 | Home, At a glance, with one database connected | A Databases line: "1 of 1" and OK; with nothing connected it says "None" and Off, at the bottom of the list | [the data README](../modules/data/README.md) |
| P426 | Admin, Features, Data: switch Database checks on; an hour later open Status | Database checks is off until switched on; Status lists the database check with "Shop cache: answers" (your connection's name), or the service's words when it stopped answering | [the data README](../modules/data/README.md) |
| P427 | Work, Data, a database, Rename: type a new name, Save name | "Renamed.", the new name at the top and on the Data list; its tables open as before | [the data README](../modules/data/README.md) |
| P428 | Sign in with Supabase and Connect a project already on the Data page (or press Connect twice) | That database's page opens with "This database was already connected, so nothing new was added."; the Data list still shows it once | [the data README](../modules/data/README.md) |
| P429 | A database with more than 500 tables (or an Airtable account with more than 10 bases): its page | Under "Only part of the list is shown", Open a table by its name; a name not in the list opens its rows | [the data README](../modules/data/README.md) |
| P430 | After the Airtable integration is registered on the relay (its README, step 6): Work, Data, Connect a database, the Airtable card | The card says "Sign in with Airtable, then pick the bases to read."; its page has "Sign in with Airtable" above the steps and the token form | [record](records/2026-11-22-airtable-sign-in.md) |
| P431 | Press Sign in with Airtable, pick a base on Airtable's page and allow it | "Connect Airtable?" with Connect and Cancel; Connect opens the new connection with the picked base's tables; the phone's Back then shows that connection again, "already connected", not a second one | [record](records/2026-11-22-airtable-sign-in.md) |
| P432 | Sign in with Airtable again and press Cancel on Airtable's page | Back on Connect Airtable: "You cancelled on Airtable’s page, so nothing was connected." | [record](records/2026-11-22-airtable-sign-in.md) |
| P433 | Two hours after P431, open that Airtable connection and a table | The tables and rows load as before: the portal renewed the sign-in by itself | [record](records/2026-11-22-airtable-sign-in.md) |
| P434 | Sign in with Airtable again, allow it, then press Cancel on "Connect Airtable?" | Back on Connect Airtable: "You pressed Cancel, so nothing was connected."; no new connection on the Data page | [record](records/2026-11-22-airtable-sign-in.md) |
