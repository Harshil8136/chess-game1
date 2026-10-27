# Sample notes (the `sample-notes` module)

A short list of notes, written by `oltrem new module` as the start of a real feature: one of each
part the kit's manifest knows, small enough to replace. Keep the shape, change the feature, and
keep its test green.

## What it does

The page `/sample-notes`, in the portal's sidebar under Work, lists the notes and adds one in a
dialog. Behind it, `GET /api/sample-notes` lists them and `POST /api/sample-notes` adds one with a
unique title, each behind a capability of its own; a daily job removes the notes older than the
keep time; a health check says the table answers.

## The parts

| Part | Where | What to change |
|---|---|---|
| The manifest | [`src/module.ts`](./src/module.ts) | the id stays; everything the module has is declared here, and the kit refuses a manifest that breaks a rule when the module loads |
| The capabilities `sample-notes.read` and `sample-notes.write`, on bit plane `100` | `src/module.ts` | their labels and class (`read`, `operate` or `admin`); a new one is another entry, starting with `sample-notes.`. The Owner holds them from the next start; other roles get them on the Access page. The plane is the module's own, from 100, and never changes |
| The routes `GET /` and `POST /` | `src/module.ts` | their schema (zod), capability and handler; a route that changes something names its `action`, the verb of its audit row |
| The page `/sample-notes` | [`src/pages.tsx`](./src/pages.tsx) | what it shows and its forms; it reads and changes only through the module's routes, so the capabilities decide. `nav` puts it in the sidebar. A second page is another entry in `pages` |
| The page's type check | `src/pages.public.d.ts`, `tsconfig.pages.json` | nothing, usually: the page is checked against the browser's types in a program of its own, and the Worker sees only `pages.public.d.ts`, which the client's `test/pages-types.ts` holds to the page |
| The shared types | [`src/types.ts`](./src/types.ts) | what the routes answer; the page imports them from here, never from `module.ts` |
| The job `sample-notes.tidy`, daily | `src/module.ts` | its interval (`15m`, `6h`, `1d`) and its work; the tick runs it and records each run |
| The check `sample-notes.store`, lane `storage` | `src/module.ts` | what it looks at, answering `ok`, `warn` or `fail` with a few words; two failures in a row open a problem |
| The table `sample_notes_items` | the file the manifest lists, in the repository's `migrations/` folder | a change is a new file at the next client number (5000 and up), never an edit of an applied one; list it on the manifest |
| The setting `sample-notes.keep_days` | [`src/settings.ts`](./src/settings.ts) | its schema and default; a key always starts with `sample-notes.`; list a new one on the manifest |
| The error `KIT-E-5001` | [`src/errors.ts`](./src/errors.ts) | its text; a new code takes the next number in this module's hundred, and a code is never reused |
| The test | [`test/sample-notes.test.ts`](./test/sample-notes.test.ts) | one test per behaviour; `pnpm test` runs it inside the Workers runtime, through the kit's pipeline |

## Not here yet

- **A live setting.** The job reads the setting's default until the Worker hands modules the live
  settings.

## How it was made

`oltrem new module sample-notes` copied the kit's module template and wrote `sample-notes`,
`sample_notes` and `Sample notes` wherever the name goes, took the next client migration number
the next free hundred of error codes and the next free bit plane from 100, listed the module and
its pages in `src/modules.ts` and `test/pages-types.ts`, and refreshed the generated reference. Nothing here is special to the generator: it is ordinary code the client owns.
