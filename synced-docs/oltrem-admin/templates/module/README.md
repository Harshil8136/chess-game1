# Sample notes (the `sample-notes` module)

A short list of notes, written by `oltrem new module` as the start of a real feature: one of each
part the kit's manifest knows, small enough to replace. Keep the shape, change the feature, and
keep its test green.

## What it does

`POST /api/sample-notes` adds a note with a unique title; a daily job removes the notes older
than the keep time; a health check says the table answers. There is no page yet (below).

## The parts

| Part | Where | What to change |
|---|---|---|
| The manifest | [`src/module.ts`](./src/module.ts) | the id stays; everything the module has is declared here, and the kit refuses a manifest that breaks a rule when the module loads |
| The route `POST /`, capability `sample-notes.write` | `src/module.ts` | its schema (zod), its handler; a second route is another entry in `api` |
| The job `sample-notes.tidy`, daily | `src/module.ts` | its interval (`15m`, `6h`, `1d`) and its work; the tick runs it and records each run |
| The check `sample-notes.store`, lane `storage` | `src/module.ts` | what it looks at, answering `ok`, `warn` or `fail` with a few words; two failures in a row open a problem |
| The table `sample_notes_items` | the file the manifest lists, in the repository's `migrations/` folder | a change is a new file at the next client number (5000 and up), never an edit of an applied one; list it on the manifest |
| The setting `sample-notes.keep_days` | [`src/settings.ts`](./src/settings.ts) | its schema and default; a key always starts with `sample-notes.`; list a new one on the manifest |
| The error `KIT-E-5001` | [`src/errors.ts`](./src/errors.ts) | its text; a new code takes the next number in this module's hundred, and a code is never reused |
| The test | [`test/sample-notes.test.ts`](./test/sample-notes.test.ts) | one test per behaviour; `pnpm test` runs it inside the Workers runtime, through the kit's pipeline |

## Not here yet

- **A page.** The kit's screens come with the renderer the sandbox measurement decides; the
  manifest gains `pages` then, and this module its first page.
- **Capabilities.** In own-account mode the owner holds every capability by name. When the client
  runs the permission model, add `bitPlane` and declare `sample-notes.write` in `src/module.ts`.
- **A live setting.** The job reads the setting's default until the Worker hands modules the live
  settings.

## How it was made

`oltrem new module sample-notes` copied the kit's module template and wrote `sample-notes`,
`sample_notes` and `Sample notes` wherever the name goes, took the next client migration number
and the next free hundred of error codes, listed the module in `src/modules.ts` and refreshed the
generated reference. Nothing here is special to the generator: it is ordinary code the client owns.
