# @oltrem/records

The company's own lists, designed with no code: a name, a line on what it is for, its fields, and
the place it belongs to. Contacts, stock, orders or anything else are lists; nothing knows one kind
of business from another. The screens give it a **Lists** section.

## Using it

```ts
const records = createRecords<Env>({ bindings });
const modules = [iam.module, users.module, records.module /* , ... */];
```

It returns `store` and the manifest and stands on IAM (sessions, authorizer, audit).

Four capabilities on bit plane 10, read at the list's place (an IAM scope; a role there or above
decides, a role at another place gives nothing): `records.read`, `records.write` (add, change),
`records.remove` and `records.design` (make, rename, move, remove lists; add, move, remove fields).
The route checks the capability somewhere, the store at the list's place. A list the person may not
see is `KIT-E-0404`, so its name never leaks; one whose place was removed belongs to the company.

## Fields and records

Limits are `LIMITS` in `src/records.ts`.

| Part | What it is |
|---|---|
| Kinds | `FIELD_KINDS`: short text (`text` 200), long text (`longText` 4,000), number, date (year-month-day), yes or no (never needed), choice (2 to `options` 20), email, phone, web link (http or https, `link` 2,000) |
| Size | `fields` (30) a list, `lists` (100) a company (`KIT-E-2203`); names unique in any case (`KIT-E-2204`). Removing a field empties it everywhere; moving one changes the form and table order |
| Values | One JSON object keyed by field id, checked on every save (`KIT-E-2201`); a change replaces it whole. Who added it and when, who changed it last |
| Listing | Search across text, narrowed by one choice or yes-or-no field, sorted by changed, added or any field, 50 a page (200 at most) |
| Download | `GET /lists/:id/export`: CSV of up to `export` (5,000), oldest first, every cell quoted, `=`, `+`, `-`, `@`, tab or carriage return defused with `'`; a cut file is named `-first-5000` |
| Upload | `POST /lists/:id/import` (`records.write`, a `bytes` route, `importBytes` 128 KB, `import` 1,000 rows), all or none: headings match labels in any order or case, unknown columns named back in `ignored`; comma or semicolon; non-UTF-8 read as Windows-1252 (`parseCsv`, `decodeText`); a bad row refuses the file with its row number (the first five named); defused formulas come back as typed, so a download goes back in whole. One audit row with the count |
| Removing | A removed record waits in `records_trash` for `TRASH_HOURS` (24) for its Undo; `records.trash-prune` (daily, one query) deletes it after. A list is removed only once empty (`KIT-E-2202`) |

## The routes

| Route | Needs | What it does |
|---|---|---|
| `GET /lists` | `records.read` | Visible lists, and the places where one may be made |
| `POST /lists`, `PATCH /lists/:id`, `DELETE /lists/:id` | `records.design` | Make with starting fields; rename or move; remove once empty |
| `POST /lists/:id/fields`, `DELETE …/fields/:field`, `POST …/fields/:field/move` | `records.design` | Add at the end; remove with its values; move up or down |
| `GET /lists/:id`, `/items` (`q`, `field` and `value`, `sort` and `dir`, `limit`, `offset`), `/items/:item`, `/export` | `records.read` | The list and what the person may do; its records; one; the CSV |
| `POST /lists/:id/items`, `PATCH …/items/:item`, `POST …/import` | `records.write` | Add, change, upload |
| `DELETE /lists/:id/items/:item`, `POST …/items/:item/restore` | `records.remove` | Remove to the trash; Undo within the day, with the fields the list has now |

Module parts: search (lists by name or description, then records by text, titled by the first
field; `%` is a letter) and the privacy answer (records naming the address, values by label). No
Home card: it would count lists a person's places do not show. Audited with ids and names only,
refusals too: `records.list-create`, `-update`, `-remove`, `records.field-add`, `-remove`, `-move`,
`records.item-create`, `-update`, `-remove`, `-restore`, `-import`.

## Tables and errors

| Migration | Adds |
|---|---|
| `0017` | `records_lists` (place, name, description; one name per company), `records_fields` (label, kind, needed, choices, position), `records_items` (values as JSON, search text, who and when) |
| `0057` | `records_trash`: a removed record with who and when; removing a list empties its rows |

Block `2200`–`2299`: `KIT-E-2201` a value does not fit, `2202` the list still has records, `2203`
the limit of lists or fields, `2204` the name is taken. Not visible is `KIT-E-0404`, not allowed at
the place `KIT-E-0403`.

## Tests

`test/records.test.ts`, on a company with two places, four roles and five people: the manifest
(17 routes with search, import and undo); lists made at a place, names unique; lists seen by place;
values checked per kind; search, narrowing, sorting, paging; search by place; changes replacing
values, fields added, moved, removed; the CSV defused and a list with records kept; privacy; uploads
all or none and an export back whole; the trash, Undo and the daily delete; the audit without values.
