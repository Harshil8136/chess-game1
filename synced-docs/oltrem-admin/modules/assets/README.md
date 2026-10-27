# @oltrem/assets

Equipment: the laptops, phones, keys, tools and badges of the company, at each place, and who holds
which since when. An item is handed to a person with a note, straight on to the next person, or taken
back; it is retired once nobody holds it, saying why. Every move is kept with the item, the person it
is handed to is told by email, and every step is in the audit log. When someone's account is switched
off, what they still hold shows in Needs you for the people who manage the equipment at its place.

## Using it

```ts
import { createAssets } from '@oltrem/assets';
import { pages as assetsPages } from '@oltrem/assets/pages';
import { withPages } from '@oltrem/core-module';

const assets = createAssets<Env>({
  bindings: (env) => ({ db: env.DB }),
  send: async (env, m) => {
    await email.send(env, {
      tenantId: m.tenantId,
      template: ASSET_MESSAGE.id, // a template with a subject and a text
      to: [{ email: m.to }],
      data: { subject: m.subject, text: m.text },
      messageKey: m.key,
    });
  },
});
const modules = [iam.module, /* ... */ withPages(assets.module, assetsPages)];
```

`createAssets` returns the `store` and the module manifest. It stands on the IAM module (sessions,
the authorizer, the people of the company) and the audit log. `send` is optional: without it nobody
is emailed. It adds no binding, secret, variable or setting.

## Who may do what

Two capabilities on bit plane `24`, both read at the item's place, so a role at a place (or at a
place above it) decides:

| Capability | Lets them |
|---|---|
| `assets.view` | see the equipment at the place and who holds it |
| `assets.manage` | add equipment at the place, hand it over, take it back and retire it |

Whoever holds an item always sees it, whatever else they hold (`assets.self`, which every account
holds). Someone who neither holds it nor sees its place cannot open it.

## An item

| Part | What it is |
|---|---|
| Place | where it belongs; the people who manage the equipment there move it |
| Name | 200 characters at most, as Laptop 14" |
| Tag | an asset tag or serial number, 100 characters at most; one tag names one item in the company, and an item may have none |
| Notes | 2000 characters at most |
| Holder | the person of the company who holds it, and since when; none when it is available |
| Retired | when, with the reason in its moves; a retired item no longer moves |
| Moves | added, given (to whom, with a note), returned (from whom), retired (why), each with who did it and when; the last 50 shown, the newest first |

An item is only handed to a person of the company whose account is on (`KIT-E-3402`). Handing it to
someone while another person holds it records both moves: returned from the first, given to the
second. Two people moving the same item at once move it once: it changes hands only from the holder
the page showed (`KIT-E-3403`). An item is retired only when nobody holds it, so nothing in someone's
hands goes missing from the list.

## The pages

| Path | Shows |
|---|---|
| `/assets` | a row of In service, Yours and Retired, with their counts; "Add equipment" in a dialog (the place as a row of choices, the name, the tag, the notes) to whoever manages somewhere; the items, each with its state (Available, In use, To collect when the holder's account is off, Retired), who holds it since when, its tag and place |
| `/assets/:id` | the item and who holds it; a row with "Hand it over" or "Hand it to someone else" (the address and a note, in a dialog), "Take it back" (after a confirmation) and "Retire it" (with the reason, in a dialog) to whoever manages it, and "All equipment"; the notes; the moves |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /items` (`view` all, mine or retired) | `assets.self` | the list, at most 200, with the places the person sees, whether they manage each, and the counts |
| `POST /items` | `assets.manage` at the place | adds an item; a tag already used is `KIT-E-3401` |
| `GET /items/:id` | `assets.self`, and holds it or sees its place | one item with its moves and whether the reader manages it |
| `POST /items/:id/give` | `assets.manage` at its place | hands it to a person of the company by their address, with a note; they are emailed |
| `POST /items/:id/return` | `assets.manage` at its place | takes it back from whoever holds it, with a note |
| `POST /items/:id/retire` | `assets.manage` at its place | retires an item nobody holds, with the reason |
| `GET /search?q=` | `assets.self` | items by name or tag, where the person sees or what they hold |
| `GET /todo` | `assets.manage` | Needs you: how many items people whose account is off still hold, at the places the person manages, and from whom to collect them |

Every step is audited: `assets.add`, `assets.give`, `assets.return` and `assets.retire`, refusals
included. One that went through can set off an automation: one on `assets.give` can make a task to
sign for the item.

A privacy request (`@oltrem/privacy`) finds every move to and from a person: the item, its tag and
place, the move, who made it, when and the note, and whether they hold it now.

## Tables

Migration `0034_assets.sql`, additive and idempotent: `assets_items` (the place, the name, tag and
notes, who holds it since when, when it was retired) and `assets_moves` (the item, the move, the
person, who made it, when and the note). The moves are a table of their own because the item's page
reads them every time, and the audit log is written after the answer and is not read by item.

## Errors

The `34xx` block: `KIT-E-3401` that tag names another item, `KIT-E-3402` that address is not a
person of the company whose account is on, `KIT-E-3403` the item can no longer change that way. A
name, a tag or a text out of bounds, and retiring without a reason, are the core's `KIT-E-0422`; a
person without the capability at the place is `KIT-E-0403`.

## Not here yet

- A photo of the item, and a signature when it is handed over.
- Kinds of equipment, their value and when they were bought, and a spreadsheet of the list.
- Booking equipment for a day: `@oltrem/bookings` books rooms and things by the hour.
- Reminders to give back what was lent for a while.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest; items added
only where the person manages, a tag naming one item, every refusal audited; what each person sees,
the holder always and nobody else; handed only to a person of the company whose account is on, who
is emailed with the note and the link; handed straight on with both moves kept, taken back, retired
only when nobody holds it and never moved after; the search by name or tag; Needs you with what a
person whose account is off still holds, only where the reader manages; the privacy answer. The
client template's screens journey adds an item as the Owner, hands it to themselves, finds it under
Yours, takes it back and retires it.
