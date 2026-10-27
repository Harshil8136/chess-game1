# @oltrem/records

The company's own records (the owner's choice of 2026-10-22): lists it designs for itself, with
no code. A list has a name, a line on what it is for, the fields its records hold, and the place
of the company it belongs to. Contacts, tasks, stock, orders, equipment, or anything else a
business keeps track of, are all lists; nothing in the module knows one kind of business from
another.

## Using it

```ts
import { createApp } from '@oltrem/core-http';
import { createIam } from '@oltrem/iam';
import { createRecords } from '@oltrem/records';

const bindings = (env: Env) => ({ kv: env.CACHE, db: env.DB });
const iam = createIam<Env>({ bindings, audience: (env) => env.ACCESS_AUD });
const records = createRecords<Env>({ bindings });
const app = createApp<Env>({
  modules: [iam.module, records.module],
  startup: iam.startup,
  session: iam.sessions.hook,
  authorize: iam.sessions.authorize,
});
```

`createRecords` returns the `store` functions and the module manifest. It stands on the IAM
module: the same sessions and authorizer, the same audit wrapper. The client template mounts it
after the users module, and the screens give it a **Records** section (`@oltrem/screens`).

## Who may do what: the place of a list

Four capabilities, on bit plane `10`: `records.read` sees a list and its records;
`records.write` adds and changes records; `records.remove` removes them; `records.design` makes
lists, adds, moves and removes fields, renames a list, moves it to another place, and removes it.
They join every Owner role when the Worker starts, like every capability.

A list sits at one place (an IAM scope). A role held at that place, or at a place above it,
decides what a person may do with the list; a role held only at another place gives nothing.
So a keeper at North makes and runs North's lists, a clerk at North adds North's records, and
neither sees the company's lists unless a role reaches the company. The route checks that the
person holds the capability somewhere; the store then checks it at the list's own place. A list
the person may not see answers as one that is not there (`KIT-E-0404`), so its name never leaks.
A list whose place was removed belongs to the company.

## Fields

Nine kinds: short text (200 characters), long text (4000), number, date (year-month-day), yes or
no, choice (two to twenty choices), email, phone, and web link (http or https only, since it
becomes a link on the page). A field may be needed; a yes or no never is, since it is always one
of the two. A list has at most 30 fields and a company at most 100 lists, which keeps the free
plan's database small. Removing a field takes its value out of every record. Moving a field
changes the order the form and the table show.

## Records

A record's values are one JSON object keyed by field id, checked against the fields on every
save; a change replaces the values as a whole, and a field left out is emptied. Each record keeps
who added it and when, and who changed it last. The records of a list are searched across their
text, narrowed by one choice or yes or no field, sorted by when they changed, when they were
added, or any field, and paged (50 by default, 200 at most).

The download (`GET /lists/:id/export`) is a CSV file of up to 5000 records, oldest first, for a
spreadsheet. Every cell is quoted, and a cell that starts with `=`, `+`, `-`, `@`, a tab or a
carriage return gets a leading `'`, so a spreadsheet never runs a value as a formula.

The upload (`POST /lists/:id/import`, `records.write`, the CSV file as the body of a `bytes`
route, 128 KB and 1000 rows at most) adds a record for each row, all or none. The first row
names the fields by their labels, in any order and any case; a column no field has (an export's
Added and Changed among them) is left out and named back in `ignored`. A comma or a semicolon
separates the fields, and a file not in UTF-8 is read as Windows-1252, as older spreadsheets save
it (`parseCsv` and `decodeText` of `@oltrem/core-module`). Each row is checked as a record added
by hand; one that does not fit refuses the whole file with its spreadsheet row number (the names
are row 1), the first five named. The rows go in one statement, in the file's order, and a
defused formula comes back as it was typed, so a download can be added back. One audit row
(`records.item-import`) records the count, never the values.

## Search

The portal's search (`GET /api/records/search?q=`, `records.read`) finds the lists the person may
see by name or description, then their records by any text value, newest change first, each titled
by its first field.

## Personal data

For a privacy request (`personal`, read by the privacy module) the module answers every record
whose text names the address, newest change first, with its list and its values by field label.
The Records page is linked; a record is corrected or removed from its list.

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /lists` | `records.read` | the lists the person may see, and the places where they may make one |
| `POST /lists`, `PATCH /lists/:id`, `DELETE /lists/:id` | `records.design` | make a list with its starting fields; rename or move it; remove it once empty |
| `POST /lists/:id/fields`, `DELETE /lists/:id/fields/:field`, `POST /lists/:id/fields/:field/move` | `records.design` | add a field at the end; remove one with its values; move one up or down |
| `GET /lists/:id`, `GET /lists/:id/items`, `GET /lists/:id/items/:item`, `GET /lists/:id/export` | `records.read` | a list with its fields and what the person may do; its records (`q`, `field` and `value`, `sort` and `dir`, `limit`, `offset`); one record; the CSV file |
| `POST /lists/:id/items`, `PATCH /lists/:id/items/:item`, `POST /lists/:id/import` | `records.write` | add a record; change one; add one for each row of a CSV file |
| `DELETE /lists/:id/items/:item` | `records.remove` | remove a record |

Every change is audited (`records.list-create`, `-update`, `-remove`; `records.field-add`,
`-remove`, `-move`; `records.item-create`, `-update`, `-remove`, `-import`), the refusals as much as the
successes, with ids and names only: never the values a record holds.

The module has no card on Home: Home reads a card without the person, and a count of every list
would tell someone about lists their places do not show them.

## Tables

Migration `0017_records.sql`, additive and idempotent, in the one ledger `oltrem_migrations`:
`records_lists` (the list, its tenant, its place, name and description; one name per company),
`records_fields` (each field's label, kind, whether it is needed, its choices and position) and
`records_items` (each record's values as JSON, its search text, who added and changed it, when).

## Errors

The module owns the `2200` to `2299` block: `KIT-E-2201` a value does not fit its field,
`KIT-E-2202` the list still has records, `KIT-E-2203` the limit of lists or fields is reached,
`KIT-E-2204` another list has that name. A list that is not there or not visible is the core's
`KIT-E-0404`; a change the person may not make at the list's place is the core's `KIT-E-0403`.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, on a company with two
places under it, four roles and five people: the manifest; a list made with seven kinds of field,
a name taken in another case and a one-choice field refused; lists seen only where a role reaches
their place, and a list at another place not found; values checked per kind, a clerk adding but
not removing; search, a choice and a yes or no narrowing, sorting by a field, paging; a change
replacing the values; fields added, moved and removed with their values; a list moved to another
place; the CSV with a formula defused; a download added back whole with its defused formula restored, a
file refused with its rows named and nothing added, a file naming no field, an empty one and a
person without the place refused; a list with records kept; every change audited without a value.

The search test finds lists and records only where a person's roles reach, and takes `%` as a letter.
