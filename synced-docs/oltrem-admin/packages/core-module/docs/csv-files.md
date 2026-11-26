---
title: "@oltrem/core-module: CSV files and more"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-module/src; split from packages/core-module/README.md]
---

# @oltrem/core-module: CSV files and more

> Part of [the @oltrem/core-module README](../README.md).

## CSV files

`parseCsv(text)` reads a CSV file as a spreadsheet saves it, row by row (RFC 4180: quoted fields,
doubled quotes, line breaks inside quotes; a comma or a semicolon between fields, whichever the
first line uses most; a byte order mark ignored; empty lines left out). `decodeText(bytes)` reads an
upload as UTF-8 when it is, otherwise as Windows-1252. The campaigns' list and the records' import
use both. `readCapped(request, max)` reads a request's body only as far as `max` bytes and answers
`null` past it: the declared length is checked first, and a body sent in pieces, which declares
none, is counted while it is read, so a long one is never held whole. The public hooks, the records'
import, the customers' door and Oltrem Mail's uploads read through it. `csvFile(head, rows)` writes
one, every cell through `csvCell`: quoted with its quotes doubled, a yes or no as `Yes` or `No`, and
text a spreadsheet would run as a formula (starting with `=`, `+`, `-`, `@`, a tab or a carriage
return) given a leading apostrophe, so what someone typed never runs on the computer of whoever
opens the download. Every download of the kit writes through them: the audit log's, the forms'
answers, the records' lists, the expenses' month the time clock's hours and the connected data's
answers. `csvResponse(csv, fileName)` sends one as a download that no cache keeps, and
`fileNameOf(name, fallback, suffix?)` names it from what a person typed, kept to letters, digits,
dashes and 60 characters. A module's pages, type-checked against the DOM, take them from their own
entry, `@oltrem/core-module/csv`, which holds no Workers type (the connected data's answers,
2026-11-24).

## Calendar items

`CalendarEntry` (`{ id, title, place, allDay, starts, ends }`) is one item of a person's calendar:
a timed one with `starts` and `ends` as ISO times, an all-day one with both as days (`YYYY-MM-DD`,
`ends` the last day). A module that keeps dated work gives its store a `calendar(env, session,
from, to)` that answers the person's own items, each one they may still see; `@oltrem/connect`
reads them into the person's calendar link (bookings, shifts, time off and tasks today).

## Pages to print

`paperHtml(paper)` writes a document a module hands someone as one plain page to print, or to save
as a PDF from a phone's Share or Print: the company's name and the issuer's lines at the top, what
it is and its number, label and value pairs, a table whose first column reads left, a total, a
stamp (Paid, Void) and headed texts. It has no script and no image, and escapes everything it is
given. `paperResponse(html)` answers it as `text/html` with its own `default-src 'none'` policy and
`no-store`. The invoices and the quotes use them, on a staff route and as their customer part's
`open`.

## Amounts

An amount is kept in its currency's smallest unit. `parseAmount(text, currency)` reads what a person
typed (`12.50` or `12,50`, no thousands separator) or answers null; `money(units, currency)` writes
it for people with the code (`USD 1,234.50`), `plain(units, currency)` for a spreadsheet;
`decimals(currency)` and `isCurrency(code)` answer what they say. They name no Workers or DOM type,
so a store imports them from `@oltrem/core-module` and its pages from `@oltrem/core-module/pages`.
Expenses, invoices and quotes use them (one copy; each had its own) and still export them under the
same names.

## Where a request came from

`deviceName(userAgent)` names a browser and system in plain words (`Chrome on Android`), and a
program or robot for what it is (`curl`, `A Python script`, `Headless Chrome (automated)`,
2026-11-25), for the
sign-in alerts and lists (`@oltrem/iam/device` passes it on) and the audit log; its own entry, `@oltrem/core-module/device`, holds no Workers type. The pipeline (`@oltrem/core-http`) calls `noteRequest(requestId,
{ ip, country, region, city, asn, network, browser, agent, via, key, session })` for each call its
routes run (`RequestWhere`; notes for one request add up), and the audit writer
reads it back with `requestWhere(requestId)`, so every row of the request says from where. The
isolate keeps the newest 512 requests; nothing is stored.

## Migrations, settings and errors

The manifest also names what the module owns elsewhere, so one file says everything a reviewer
or a generator needs: `migrations`, the SQL files it ships, named `NNNN_name.sql`; `settings`,
the definitions it made with `defineSetting` (`@oltrem/core-config`), whose keys start with the
module's id; `errors`, the codes it made with `defineErrors` (`@oltrem/core-errors`). The contract
checks that each belongs to this module and refuses one defined for another, so a module cannot
claim another's setting or code; the generator and the references of phase 3 read these lists.

## Key recipes

`secrets` lists the Worker secrets the module needs, one key recipe each (plan 15.3): the name
`wrangler secret put` takes, what it is for, how to make and set it (`create`, with `createAt`
when an outside service issues it, and its `scopes`), how to see that it works, how and how
often to rotate it, and what the portal does without it. The recipes of every module the Worker
mounts are its generated Key recipes page (`oltrem docs`), and its `secrets.required` must name
exactly them (`oltrem doctor`, CF-SEC-02), so wrangler refuses a deploy with one missing. A
provider's own key is not a Worker secret: it is pasted on the portal, stored sealed, and its
recipe is on the provider's definition.

## Schemas

A route's schema is any object that implements the
[Standard Schema](https://standardschema.dev) interface, so a module may use zod, valibot or
arktype and the pipeline needs none of them. `validate(schema, value)` runs one and returns the
output or its issues.

## The event envelope

Every queue message is one shape, `{ type, v, payload, idempotencyKey }` (plan 9.1). A new
event is a new `type`, never a new queue. The consumer dispatches on `type` to the module that
declares it; the outbox keeps the row until it is handled.
