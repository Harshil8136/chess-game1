# @oltrem/privacy

Privacy requests: someone asks to see, correct or delete the data the company holds on them, or to
stop a use of it. The request is logged with its due day; the portal finds their data in every part
in one search, gives a copy once their identity is checked, reminds as the day nears, and keeps what
the person was told.

## Using it

```ts
const privacy = createPrivacy<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor,
  modules: () => modules, // read when a search runs
});
const modules = [iam.module, /* ... */ withPages(privacy.module, privacyPages)];
```

It returns `store` and the manifest, stands on IAM and the audit log, and adds no binding, secret or
variable. Two capabilities on bit plane 17, read at the company (a request is about the whole
company's data): `privacy.read` and `privacy.manage` (log, search, record the identity check,
download, close).

| Setting | Default | Meaning |
|---|---|---|
| `privacy.answer_days` | `30` (1–90) | Days after it came in that a request is due. GDPR gives a month, the CCPA 45 days, Mexico's LFPDPPP 20 business days (read 2026-10-27, not legal advice; the 2025 Mexican law not checked): [GDPR](https://gdprlocal.com/dsar-rules-and-deadlines/), [US states](https://www.bdemerson.com/article/dsar), [LFPDPPP](https://kyc-systems.com/blog/lfpdppp) |

## How a request is answered

Limits are `LIMITS` in `src/privacy.ts`.

1. **Log it**: the kind (`KINDS`: access, correct, delete, object), the address (lower case), what
   was asked (`details` 2,000), the day it came in (today by default, never ahead); the due day
   follows the setting.
2. **Find their data**: every mounted module that declares `personal` answers up to `PERSONAL_ROWS`
   (200) rows for the address, and the audit log what the address did in its last 90 days (older
   rows are in the bucket, read by the audit export). Each part shows its count and a link to its
   page (quotes and invoices filtered by `?email=`, the customer's own page). Audited with the parts
   found.
3. **Check who asks** (`verification` 500): until written down the copy is refused (`KIT-E-2801`);
   checked after a search, the search runs again.
4. **Download a copy**: one JSON file, not cached, each download audited.
5. **Correct or delete** in the module that holds the data, by its link and rules; nothing is deleted
   from here. For a delete, the page says plainly that no module erases a person's rows yet, what
   can be stopped (a quote withdrawn, a customer switched off, an unpublished shift removed) and what
   is kept for the record (sent quotes and invoices, answered requests, the audit log).
6. **Close it**: `STATUSES` answered or refused, with what they were told (`answer` 2,000). A closed
   request stays as it was (`KIT-E-2802`); a new ask is a new request.

Parts that declare `personal`: users, forms, records, connect, customers, quotes,
invoices, expenses, timeoff, timeclock, shifts, assets, Oltrem Mail's email and campaigns, and the
audit log. Each package's README says what it answers.

## Pages and routes

| Path | Shows |
|---|---|
| `/privacy` | Chips Open, Closed; how many past due; **Log a request** in a dialog; open requests by due day |
| `/privacy/:id` | State; **Find their data**, **Download a copy** (once checked), **Close it**; the identity check or its form; where their data is; what they were told |
| `/privacy/:id/copy` | The copy as a file |

| Route | Needs | What it does |
|---|---|---|
| `GET /requests` (`status`) | `privacy.read` | `listed` (100), with open and past-due counts |
| `POST /requests` | `privacy.manage` | Logs one |
| `GET /requests/:id` | `privacy.read` | One |
| `POST /requests/:id/verify`, `/find`, `/close` | `privacy.manage` | Record the identity check; search; close |
| `GET /requests/:id/copy` | `privacy.manage` | The copy, once checked |

Module part: Needs you (due within `soonDays` 7 or past due). Health: `privacy.due` warns while one is
past due, with how many and since when.

## Table and errors

Migration `0025`: `privacy_requests` (kind, address, what was asked, came in, due, state, the identity
check and by whom, what they were told and by whom).

Block `28xx`: `KIT-E-2801` identity not checked yet, `2802` already closed. Bad input is `KIT-E-0422`.

Not built: erasing rows (a hook beside `find` in `personal`, a change across modules); a public form
for people to ask themselves; business days for the due day.

## Tests

| File | Covers |
|---|---|
| `test/privacy.test.ts` | The manifest and the contract refusing an untitled `personal`; logged at the company only, address lower-cased, due day, refusals audited; the search across modules (capped parts, outside addresses dropped) and the audit log; the copy refused then given, audited; Needs you and the check; a closed request kept |
| `test/pages.test.ts` | A delete request says what cannot be erased and links each part; an access request offers the copy; a check after a search keeps the results |

Each module's `personal` is tested in its own package. The client template's screens test logs a
request for an address a campaign was sent to, finds it, checks who asks, downloads and closes.
