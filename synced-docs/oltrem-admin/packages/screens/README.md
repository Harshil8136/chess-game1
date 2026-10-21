# @oltrem/screens

The screens of a client portal: a home page with a card per mounted module, a page per module,
and the two first-run forms (the Vendor creates the company, the first Owner accepts). They are
rendered on the server with Preact inside the client's Worker, behind the same door as the API,
and carry no script, so a page works on a phone before anything loads.

Every page reads and writes only through the portal's own API, called inside the same request
with the caller's identity headers (`src/api.ts`). The session hook, the permission check, the
schema and the audit run exactly as they do for any other caller, so a screen never shows or
changes more than the API allows. A refusal is shown as a notice in plain words, with what to do.

## Using it

```ts
import { createScreens } from '@oltrem/screens';

const screens = createScreens({ portal: client.name, owner: client.owner, modules });
const app = createApp<Env>({
  modules,
  publicRoutes: screens.publicRoutes, // the stylesheet, before the door
  localDoor: { enabled: (env) => !env.ACCESS_AUD, page: screens.signInPage },
  // ...the session hook, the authorizer and the rest, as in @oltrem/core-http
});
screens.mount(app); // every page, behind the door
```

A module the portal does not mount has no chip in the row, no card and no page. `localVendor`,
the Vendor's address that the client's dev script writes on the owner's computer, is named on
the local sign-in page and filled in there, and named again to anyone signed in on that computer
with no account: on a new portal it is the only account.

## The pages

| Path | Shows | Reads |
|---|---|---|
| `/` | a Vendor with no company yet: the company form; anyone else: a card per module with one line of its state | `/api/iam/me`, then each card's own read |
| `/setup/company` | the invitation link for the first Owner, after the form is sent | `POST /api/iam/tenant` |
| `/accept?token=` | the invitation and its Accept button; accepting returns to `/` | `POST /api/iam/invitations/accept` |
| `/people` | everyone in the directory | `/api/users/people` |
| `/access` | the company, its roles, groups, scopes and invitations | `/api/iam/tenant`, `roles`, `groups`, `scopes`, `invitations` |
| `/providers` | the connected providers in failover order, and the definitions on offer | `/api/providers/instances`, `definitions` |
| `/email` | the latest messages and their state | `/api/email/messages` |
| `/backup` | the backup runs | `/api/backup/runs` |
| `/github` | the kit version, a newer release, the deploy runs | `/api/github/status`, `runs` |
| `/health` | each health check with its state, and the free plan's budgets | `/api/health/checks`, `budgets` |

Every page sits in the same frame: the portal's name and who is signed in, then the sideways row
of every section with the current one marked (no dropdown), then the page. A form posted from
another site is refused.

## The stylesheet

`src/generated/app-css.ts` holds the one stylesheet, compiled by Tailwind from `@oltrem/core-ui`'s
theme and the classes the pages and primitives use, about 22 KiB. It is served at `/ui/app.css`,
cached for good under its version and `no-cache` without it. After changing a class in a page or a
primitive, run `pnpm ui:build`; a test fails while the committed file differs from what the build
writes. The file is generated: never edit it by hand (R-06).

## Not here yet

- **Changing things from a page.** Apart from the two first-run forms, the pages only show. Adding a
  person, a provider or a grant is still a call to the API until the forms are built.
- **Pages from the manifest.** The row and the pages are a fixed list in `src/layout.tsx`. The
  plan's page fields on the module manifest (pages, i18n) come with the renderer.
- **Astro.** The plan names Astro for the screens. These are Preact components rendered by the
  Worker itself, so the kit's two commands run them with no second build; the same components
  move under Astro when its renderer is built, if the sandbox measurement favours it.
- **Spanish.** Every word is English until the i18n fields exist.

## Tests

`test/css.test.ts` holds the committed stylesheet to its build. The client template's
`test/screens.test.ts` runs the whole first run inside the Workers runtime: the Vendor signs in on
this computer, creates the company, the Owner accepts, and every page answers with its words; a
stranger is told there is no account; behind Access the local door does not exist.
