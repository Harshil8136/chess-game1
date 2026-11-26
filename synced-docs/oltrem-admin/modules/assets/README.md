# @oltrem/assets

The company's equipment (laptops, phones, keys, tools, badges) at each place, and who holds which
since when. An item is handed to a person with a note, straight on to the next, or taken back; it is
retired once nobody holds it, saying why. Every move is kept and the recipient emailed. What people
whose account is off still hold shows in Needs you.

## Using it

```ts
const assets = createAssets<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: ASSET_MESSAGE.id,
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(assets.module, assetsPages)];
```

It returns `store` and the manifest and stands on IAM and the audit log; without `send` nobody is
emailed. No binding, secret, variable or setting.

Two capabilities on bit plane 24, read at the item's place: `assets.view` and `assets.manage` (add,
hand over, take back, retire). Whoever holds an item always sees it (`assets.self`, every account);
anyone else cannot open it.

## An item

Limits are `LIMITS` in `src/assets.ts`.

| Part | What it is |
|---|---|
| Name, tag, notes | `name` (200, as Laptop 14"); `tag` (100), one item per tag in the company or none (`KIT-E-3401`); `notes` (2,000) |
| Holder | A person of the company and since when; none when available |
| Retired | When, with the reason in its moves; it no longer moves |
| Moves | `MOVES`: added, given (to whom, `note` 500), returned, retired (why), with who and when; the newest `moves` (50) shown |

Handed only to a person of the company who is on, or the person signed in, the Vendor included
(`KIT-E-3402`, linking People to invite). Handing it on records returned and given. It changes hands
only from the holder the page showed, so two moves at once give one (`KIT-E-3403`). Retired only when
nobody holds it.

## Pages and routes

| Path | Shows |
|---|---|
| `/assets` | Chips In service, Yours, Retired with counts; **Add equipment** in a dialog (place as chips, name, tag, notes); a used tag links the item that has it; items with state (Available, In use, To collect when the holder is off, Retired), holder and since when, tag and place |
| `/assets/:id` | The holder; **Hand it over** or **Hand it to someone else** (addresses offered, the reader first, a note), **Take it back** (confirmed), **Retire it** (with reason); notes; moves |

| Route | Needs | What it does |
|---|---|---|
| `GET /items` (`view` `VIEWS`: all, mine, retired) | `assets.self` | `listed` (200) from `scanned` (1,000), with places, whether the person manages each, counts |
| `POST /items` | `assets.manage` at the place | Adds an item |
| `GET /items/:id` | `assets.self`, holder or viewer | One with its moves and whether the reader manages it |
| `POST /items/:id/give` | `assets.manage` at its place | Hands it to an address with a note; they are emailed |
| `GET /people` | `assets.manage` somewhere | People who are on, the reader first, `people` (200) |
| `POST /items/:id/return`, `/retire` | `assets.manage` at its place | Take back with a note; retire with a reason |

Module parts: search (name or tag, where visible or held), Needs you (items held by people whose
account is off, where the person manages, and from whom), and the privacy answer (every move to and
from a person). Audited, refusals too: `assets.add`, `.give`, `.return`, `.retire`.

## Tables and errors

Migration `0034`: `assets_items` (place, name, tag, notes, holder and since, retired) and
`assets_moves` (item, move, person, who, when, note), a table of their own since each item's page
reads them and the audit log is not read by item.

Block `34xx`: `KIT-E-3401` the tag names another item, `3402` not a person of the company who is on,
`3403` it can no longer change that way. Bad input or retiring without a reason is `KIT-E-0422`, no
capability `KIT-E-0403`.

Not built: photos and signatures at hand-over; kinds, value, purchase date and a spreadsheet; booking
equipment for a day (`@oltrem/bookings` books by the hour); reminders to give back.

## Tests

| File | Covers |
|---|---|
| `test/assets.test.ts` | The manifest; added only where allowed, one item per tag, refusals audited; who sees what; handed only to a person who is on, emailed with note and link; handed on with both moves, taken back, retired only when free and never moved after; search; Needs you by place; privacy; the people offered; an item handed to the person signed in |
| `test/pages.test.ts` | A non-company address with Invite; a used tag linking its item; other refusals shown as they came |

The client template's screens journey adds an item as the Owner, hands it to themselves, finds it
under Yours, takes it back and retires it.
