---
title: "Phone tests owed: Connected data"
status: living
owner: vendor
last_verified: 2026-11-23
sources: [docs/records/2026-11-23-connected-data-edits.md; docs/records/2026-11-22-supabase-one-click.md; docs/records/2026-11-22-database-checks-and-rename.md; docs/records/2026-11-22-airtable-sign-in.md; modules/data/README.md; the records each line links]
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
| P435 | Work, Data, a Supabase, Neon or Turso database, as its manager: Editing (above the tables), Turn on editing | "Editing is on." at the top; the Editing section says On. Before that, Change key with a key that may write | [record](records/2026-11-23-connected-data-edits.md) |
| P436 | Open a table with a primary key and tap a row's first value | The row's own page with a box for each value; the key and any binary or JSON column show their value and why they cannot be changed; No value is ticked for an empty one | [record](records/2026-11-23-connected-data-edits.md) |
| P437 | Change one value and press Save changes; open the table again | "Saved. You can undo it under Recent changes…"; the table shows the new value | [record](records/2026-11-23-connected-data-edits.md) |
| P438 | Open the same row in two tabs; save a change in one, then another change in the other | The second says "The row changed after you opened it" and saves nothing; its box shows the value now, with what you typed under it | [record](records/2026-11-23-connected-data-edits.md) |
| P439 | The database's page, Recent changes: open the change, press Undo change | Before and after for each column, whole; then "Undone." and the row holds its old value; the change cannot be undone twice | [record](records/2026-11-23-connected-data-edits.md) |
| P440 | As the Owner, a row: Delete row, confirm; then open it under Recent changes and press Undo delete | "The row was deleted…"; after Undo the row is back with every value it had | [record](records/2026-11-23-connected-data-edits.md) |
| P441 | Change key back to a key that may only read, then Save changes on a row; then Turn off editing | "The key may only read this database", nothing changed; with editing off the row's page says Editing is off and shows no boxes | [record](records/2026-11-23-connected-data-edits.md) |
| P442 | An Airtable or Upstash database's page | No Editing switch; it says its rows can only be read here | [record](records/2026-11-23-connected-data-edits.md) |
| P443 | As an Owner, a Neon or Turso database's page, Ask a question in SQL, `SELECT * FROM <a table>` | Its rows | [record](records/2026-11-23-connected-data-questions.md) |
| P444 | Ask `DELETE FROM <a table>` | Refused in plain words; the table unchanged | [record](records/2026-11-23-connected-data-questions.md) |
| P445 | Ask a question with more than 100 rows | 100 rows and a line saying there are more | [record](records/2026-11-23-connected-data-questions.md) |
| P446 | Edit a task or invoice that has notes | The notes show in the box | [record](records/2026-11-23-connected-data-questions.md) |
| P460 | As an Owner, a table's Hide or mask columns: mask one, hide one, Save columns | Saved; the key column not offered | [record](records/2026-11-23-connected-data-hidden-columns.md) |
| P461 | As someone without hidden columns, open that table | The hidden one gone with a line saying so; the masked one shows its last 4 characters | [record](records/2026-11-23-connected-data-hidden-columns.md) |
| P462 | As that person, search for a value of the masked column | No row found by it | [record](records/2026-11-23-connected-data-hidden-columns.md) |
| P520 | A Neon or Turso database's Ask page, type a question, Download CSV | `answer.csv` downloads with the same rows Ask shows | [README](../modules/data/README.md#questions-in-sql) |
| P521 | Open that file in a spreadsheet where a value starts with `=` | The value shows as typed with an apostrophe before it, nothing runs | [README](../modules/data/README.md#questions-in-sql) |
| P522 | A database with more than 10 changes, its page, Older changes, then Newest changes | The next 10 older changes, then the newest again | [README](../modules/data/README.md#editing) |
| P570 | A Neon or Turso database's Ask page, type a question and a name, Save question | Saved as that name; a chip with the name above the box | [README](../modules/data/README.md#questions-in-sql) |
| P571 | Press the chip | The box filled with that question, and Remove saved question | [README](../modules/data/README.md#questions-in-sql) |
| P572 | Remove saved question | Removed; the chip gone | [README](../modules/data/README.md#questions-in-sql) |
| P573 | Home and a signed-in Airtable database whose sign-in ended | Home says signed out, sign in again; the database says Signed out, with Sign in with Airtable again | [README](../modules/data/README.md#the-pages) |
| P670 | On a computer, open a Supabase table with IDs, emails and times | Every row on one line; IDs as 8 characters with a copy button, times as 29 Apr 2026 16:49, Yes and No as dots; the first column stays put when scrolling sideways | [README](../modules/data/README.md#the-pages) |
| P671 | Press an ID's copy button and paste it somewhere | The whole ID | [README](../modules/data/README.md#the-pages) |
| P672 | As an Owner, open Hide or mask columns under a table's rows | A compact grid, each column's name and a Shown, Masked, Hidden switch on one line | [README](../modules/data/README.md#the-pages) |
| P680 | As an Owner, open a Supabase database | Chips under the head: Tables, Users, Storage, Health; a person without the permission sees none | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P681 | Press Users | The project's sign-ups, one line each with email, how they sign in, joined, last sign-in, Confirmed and Blocked; Next page when there are more than 25 | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P682 | Press Storage, then a bucket, then a folder | Buckets marked Public or Private; inside, the path as links at the top, folders first, each file's size and type | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P683 | Press Health | Memory, disk and connections as percentages with a coloured dot, database size and load; any figure Supabase does not give is a dash, or the page says why the metrics could not be read | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P700 | As an Owner, a Supabase database, Change key: paste an access token made at supabase.com/dashboard/account/tokens, leave the key empty, Save and check | Checked; the Access token field was not required | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P701 | Press Health | Under the figures, a Requests chart (Data API, Auth, Storage, Realtime) with Last hour, Last day, Last 7 days, and Backups; without a token, one note saying how to add one | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P702 | Press Logs, then Database, then Last day, and search a word | The newest lines with their level, the chips kept while searching | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P703 | Press Functions, then Advisors | Each Edge Function with its state; the advisors' findings counted by Fix now, Look at, Note, each with a link to Supabase's guide | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P704 | On the database's page, Ask: SELECT count(*) FROM public.<a table> | One row with the count | [README](../modules/data/README.md#questions-in-sql) |
| P755 | (Owner, once: redeploy the relay, and give the Supabase OAuth app Database, Edge Functions and Analytics Read where listed.) Remove a Supabase database, then on Data, Connect Supabase, press Sign in with Supabase and Connect | It connects with no access token pasted; its Logs, Functions, Advisors and Health's Requests and Backups open without "Add a Supabase access token" | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P756 | Come back to that database's Logs more than an hour later | The lines load (the token was renewed on the way); a sign-in Supabase ended instead says to paste a token or sign in again | [README](../modules/data/README.md#a-supabase-project-beyond-its-tables) |
| P757 | On a Neon database's page, Change key: paste the connection string again and a project-scoped Neon API key, Save, then press Usage | Compute time, storage and data written for this period, the compute's state and size, and each branch with its size | [README](../modules/data/README.md#a-databases-usage-neon-and-turso) |
| P758 | On a Turso database's page, Change key: paste a Turso API token (turso auth api-tokens mint) and leave the token empty, Save, then press Usage | Rows read and written this month, storage, the group and region | [README](../modules/data/README.md#a-databases-usage-neon-and-turso) |
| P759 | Press Usage on a Neon or Turso database without an API key | One notice saying to add the key with Change key, nothing else broken | [README](../modules/data/README.md#a-databases-usage-neon-and-turso) |
| P761 | Open a database on the phone | Under the tabs one row of buttons (Ask in SQL, Rename, Change key, Remove database), one line of figures, then the tables at once, each with a coloured tile (blue table, violet view); Editing and Recent changes below them | [README](../modules/data/README.md#the-pages) |
| P762 | Open a Supabase database's Health on the phone and swipe sideways | The page does not move sideways; the request chart fits the screen | [README](../modules/data/README.md#the-pages) |
| P817 | Open a Supabase database (with its access token) on a computer, then on the phone | The tables as cards filling the width, grouped by schema, each with coloured tags for rows, size, columns and RLS on or off; the figures give Healthy, the database size, row security and the Postgres version; with nine or more tables a Find a table box narrows them as you type | [README](../modules/data/README.md#the-pages) |
| P818 | Open a Supabase database without an access token | The cards still show with their column counts, and one line says to add an access token with Change key | [README](../modules/data/README.md#the-pages) |
| P819 | Open a Supabase database (with a personal access token) and press Usage, last in the row of tabs | The plan, compute and Takes changes in one line; a card each for Database, Disk, File storage, Monthly active users and Edge Functions with a coloured meter, percent used and what is left; the plan's limits in one line below; a link to Supabase's usage page for egress | [README](../modules/data/README.md#a-databases-usage-neon-and-turso) |
| P820 | The same Usage tab on the phone, light and dark | The cards stack one under another, nothing runs off the screen sideways, the meters fill each card | [README](../modules/data/README.md#a-databases-usage-neon-and-turso) |
