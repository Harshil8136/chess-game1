# @oltrem/core-errors

Every error the kit can raise, defined once with a stable code, and the one shape every error
takes on the wire: an RFC 9457 problem document whose `type` is the error's page in the docs.
Plan section 4.2 ("errors are data, with a stable code and a docs link") and section 15.4
(degraded modes name their error).

## What an error is

```ts
import { defineErrors, KitError } from '@oltrem/core-errors';

export const BOOKING_ERRORS = defineErrors('booking', {
  FULL: {
    code: 'KIT-E-3001',
    status: 409,
    title: 'No room on those dates',
    meaning: 'Every place of that size is taken for part of the stay.',
    action: 'Offer other dates or a larger place.',
  },
});

throw new KitError(BOOKING_ERRORS.FULL, { detail: '12 to 14 June: no medium place' });
```

| Field | What it is for |
|---|---|
| `code` | `KIT-E-` and four digits, unique across the whole kit; the anchor of the docs page and the word support asks for |
| `status` | the HTTP status, 400 to 599 |
| `title` | a few words a person reads on the screen |
| `meaning` | one sentence on what happened, written for the person, not the engineer |
| `action` | what to do next |

`defineErrors` checks each definition when the module loads, so a duplicate code, a status
outside the range or a missing sentence fails the build, never a request. `lookupError(code)`
and `listErrors()` read the registry; the docs generator will render the error reference from
it.

## Code blocks

| Range | Owner |
|---|---|
| `0400` to `0599` | `core`: the HTTP shapes (`0401` unauthenticated, `0403` forbidden, `0404` not found, `0422` invalid input, `0429` rate limited, `0440` cross-site request refused, `0500` internal, `0503` unavailable) |
| `1001` to `1099` | `core`: module definition faults, found at build time |
| `1100` to `1199` | the audit log |
| `1200` to `1299` | the outbox |
| `2000` and up | the modules, one block each, claimed in the module's README |

## The problem document

`problemResponse(error, { requestId, docsBase })` turns anything thrown into one response:

```json
{
  "type": "/docs/errors#kit-e-0422",
  "title": "Invalid input",
  "status": 422,
  "detail": "name: too short",
  "code": "KIT-E-0422",
  "action": "Fix the fields named and send again.",
  "requestId": "1f3a…",
  "errors": [{ "path": "name", "message": "too short" }]
}
```

Content type `application/problem+json`, `Cache-Control: no-store`. An error that is not a
`KitError` becomes `KIT-E-0500` with the generic sentence: its message never reaches the client,
since it may hold what a database said. `asKitError` does that conversion for a caller that
needs the code before responding.
