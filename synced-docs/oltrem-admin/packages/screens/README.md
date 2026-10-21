# @oltrem/screens

The screens of a client portal: a home page with a card per mounted module, a page per module,
the two first-run forms (the Vendor creates the company, the first Owner accepts), and the forms
for people and access. They are rendered on the server with Preact inside the client's Worker,
behind the same door as the API, and carry no script, so a page works on a phone before anything
loads.

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
| `/people` | everyone in the directory, the invitations waiting, and the invitation form | `/api/users/people`, `/api/iam/roles`, `scopes`, `invitations` |
| `/people/:id` | one person: the roles they hold, the form to give one, switching the account off or on | `/api/users/people/:id`, `/api/iam/bindings`, `roles`, `scopes` |
| `/access` | the company, its roles, groups and places, and the form to add a place | `/api/iam/tenant`, `roles`, `groups`, `scopes` |
| `/access/roles/new`, `/access/roles/:id` | a role's name and its capabilities as a checklist grouped by module | `/api/iam/roles/:id`, `/api/iam/capabilities` |
| `/providers` | the connected providers in failover order, and the definitions on offer | `/api/providers/instances`, `definitions` |
| `/email` | the latest messages and their state | `/api/email/messages` |
| `/backup` | the backup runs | `/api/backup/runs` |
| `/github` | the kit version, a newer release, the deploy runs | `/api/github/status`, `runs` |
| `/health` | each health check with its state, and the free plan's budgets | `/api/health/checks`, `budgets` |

The forms, each posting to the screen's own route, which calls the API as the signed-in person:

| Form | Calls | Comes back with |
|---|---|---|
| Invite someone (`/people/invite`): an address, a role, a place | `POST /api/iam/invitations` | the link to send, shown once |
| Withdraw an invitation | `DELETE /api/iam/invitations/:id` | `?done=withdrawn` |
| Give a role (`/people/:id/grant`), end one | `POST /api/iam/bindings`, `DELETE /api/iam/bindings/:id` | `?done=granted`, `ended` |
| Switch the account off, with a reason, or on | `POST /api/users/people/:id/deactivate`, `reactivate` | `?done=off`, `on` |
| Make a role, save one | `POST /api/iam/roles` (placed below every existing role), `PATCH /api/iam/roles/:id` | `?done=role-made`, `role-saved` |
| Add a place (`/access/places`) | `POST /api/iam/scopes` | `?done=place-added` |

A change that worked redirects to its page with a `done` key, which the page turns into a fixed
sentence: no address or name travels in the address bar. A change the API refused shows the page
again with the API's reason and its status. Choices of one (a role, a place, a kind) are
`ChoiceChips` from `@oltrem/core-ui`: every option visible in a sideways row.

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

- **The other forms.** Groups, overrides with their three states, reviews, requests, approvals,
  the Vendor's access, profiles, providers, settings: still the API until their forms come.
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
stranger is told there is no account; behind Access the local door does not exist. A second test
makes a role and a place, invites someone who accepts, ends and gives their role, switches the
account off and on, withdraws an invitation, and sees a refusal and a cross-site form refused.
