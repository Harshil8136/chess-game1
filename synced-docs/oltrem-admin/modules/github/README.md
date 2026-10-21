# @oltrem/github

The client's repository as the portal sees it (plan 4.4): the kit version production runs,
whether a newer kit is published, the last run of the deploy workflow and its outcome, and a
check on System health that says when production is behind the code. There is no GitHub token
in the Worker or anywhere else (plan 9.2): the deploy workflow reports each run on main into
the portal's database with `oltrem github report` (`@oltrem/cli`), using the Cloudflare deploy
token it already holds, and the module reads those rows. What the page shows is as fresh as the
last run.

## Using it

```ts
import { createGithub } from '@oltrem/github';

const github = createGithub<Env>({ bindings: (env) => ({ db: env.DB }) });
```

Mount `github.module` beside the IAM module. The client's deploy workflow ends with the report,
on main, whatever happened before it:

```yaml
- name: Report this run to the portal (main only)
  if: always() && github.ref == 'refs/heads/main'
  continue-on-error: true
  run: pnpm exec oltrem github report --outcome ${{ job.status }}
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## What a report holds

One row per run attempt in `github_runs`: the repository, the commit, the branch, the outcome
(`success`, `failure` or `cancelled`), the kit version installed for the run (the version of
`@oltrem/core-http`; the core packages are released together), the newest kit version the
package registry published, the link to the run, and when it was reported. A version the run
could not learn is kept as unknown, never guessed. A run re-run with the same attempt replaces
its row.

## Routes

Under `/api/github`, through the IAM module's sessions and check.

| Route | Capability | What it does |
|---|---|---|
| `GET /status` | `github.read` | What production runs (the newest run that deployed: its kit version, commit and link), the newest run whatever its outcome, the newest published kit version, and whether it is newer |
| `GET /runs` | `github.read` | The newest thirty runs, with their outcome and link |
| `GET /home` | `github.read` | The Home card: the kit version production runs, and whether the last deploy went live or a newer kit is out |

## Health

`github.deploy`, in the `release` lane: **fail** when the newest run did not succeed, since
production may then be behind the code, with the run's link; **warn** when a newer kit is
published than production runs, and before any run is reported; **ok** otherwise, with the kit
version and the commit.

## Not here yet

- The docs mirror's status, for a client that keeps a mirror.
- The page comes with the screens.
- The newest published version needs the packages on GitHub Packages (phase 6); until then a
  run records it as unknown.

## The table

`github_runs` (migration `0013_github.sql`), as above, with an index on `reported_at`. The
module has no error codes of its own and no settings.

## Tests

Inside the Workers runtime against the real migration, with rows written as the report writes
them: nothing known before any run; a deploy on the newest kit, through the route, refused to
someone without the capability; a failed run that leaves production on the last deploy; a newer
kit published; a registry that did not answer; the runs in order; and how versions compare.
