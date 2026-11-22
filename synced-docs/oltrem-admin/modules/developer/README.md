# @oltrem/developer

Developer tools (the owner's request of 2026-10-27): the automatic work of the portal made
visible and steerable, the portal's changes sent out to the company's other services as they
happen, and the portal's API described from the code that runs it. Three parts behind one
section of the sidebar, **Developer**:

- **Jobs**: every job the mounted modules declare, with its schedule, its last run, how long it
  took, how many database queries it made, what it did in each of the last 24 hours (a strip of
  bars, 2026-11-21) and what went wrong; **Run soon** makes one due now (the next tick, within a minute or two) and **Pause** keeps it off its
  schedule until it is resumed. **Check for work** asks a job that declares a check what waits
  for it, and runs nothing. While a budget of the free plan holds the jobs back, the page says
  why, above them. A job whose part is switched off in Settings, Modules shows
  **Switched off** with no Run soon, and the API refuses to run it (`KIT-E-2605`). The flows of the client's one Workflow are listed beside them.
- **Webhooks**: an https address of the company's is sent each change it asks for, signed as
  [Standard Webhooks](https://www.standardwebhooks.com/) sign them, tried again on a ladder when
  it fails, with a log of every delivery.
- **API reference**: every route, public hook, job, check, setting and error code of the mounted
  modules, read from their manifests when the page is opened.

## Using it

```ts
import { createDeveloper } from '@oltrem/developer';
import { pages as developerPages } from '@oltrem/developer/pages';
import { withPages } from '@oltrem/core-module';

const developer = createDeveloper<Env>({
  bindings: (env) => ({ db: env.DB }),
  kek: (env) => env.KEK, // seals each webhook's signing secret
  scheduler: () => scheduler, // made after the modules it reads
  modules: () => modules, // this module is one of them
});
const modules = [iam.module, /* ... */ withPages(developer.module, developerPages)];
const scheduler = createScheduler<Env>({ bindings: (env) => ({ db: env.DB }), modules });
```

`createDeveloper` returns `jobs` and `webhooks` (every function the routes and jobs call) and the
module manifest. It stands on the IAM module (sessions, the authorizer, the audit wrapper), the
scheduler of `@oltrem/core-jobs` (its `list`, `runSoon` and `setPaused`) and the KEK secret the
providers module already uses; it adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `14`: `developer.read` sees the jobs, the webhooks with their
deliveries and the reference; `developer.manage` runs and pauses jobs and adds, changes, tests and
removes webhooks, and asks for a fresh sign-in. Both are read at the company itself: a role held
at a place below it is not enough, because a webhook is sent the changes of every place and a job
works for the whole company.

## Webhooks

| Part | What it does |
|---|---|
| The address | https, a public name (not an IP address, not `localhost`, `.local`, `.internal` or another private name), no user or password in it, 500 characters at most. Ten webhooks a company. The same address with the same events made again within a minute is refused (`KIT-E-2604`): a double tap or a refresh of the page that showed the secret makes one webhook, not two. |
| Events | Separated by spaces: `*` for every change, `forms.*` for one module's, or one action such as `forms.answer`; twenty at most. An event is an audited action that went through; a refused or failed one is not sent. |
| Where events come from | The audit log. Every change through the API is a row of it (the module's own or the pipeline's automatic one), and so is every system action a module records, so a new module's changes can be sent with no code of its own. The job `developer.webhooks` reads the rows written since its last run, 200 at most a run, from where it stopped (`oltrem_meta` key `developer.webhooks_seq`); its first run starts from that moment, so the past is not sent to a new address. A webhook is sent only what was audited after it was made. While no webhook is on the job reads no audit row: it moves its place to the end of the log in one write, answers `'idle'` and sleeps (it looks again every six hours); making a webhook, or switching one on, moves the place to the end of the log first when it is the only one on, and wakes the job, in one batch. |
| The body | `{"type": "<action>", "timestamp": "<when it was audited>", "data": {"seq", "actor", "actorKind", "target", "details"}}`: the audit row as it is, so it carries who made the change; the company sends it to its own services. |
| Signing | `webhook-id` (`msg_<delivery>`, the same on every attempt, so a receiver drops a repeat), `webhook-timestamp` (seconds) and `webhook-signature: v1,<base64 HMAC-SHA256 of id.timestamp.body>`, keyed with the base64 after `whsec_`. The Standard Webhooks libraries check it as they are. |
| The secret | 24 random bytes as `whsec_…`, answered once when the webhook is made or given a new secret, and stored sealed under a data key of its own wrapped by the KEK secret (`@oltrem/core-crypto`), so the database never holds a usable secret. A new secret signs from that moment. Without the KEK secret no webhook is made (`KIT-E-2603`). |
| Sending | Every five minutes, ten deliveries at most a run, five at a time (the free plan allows six connections), each with ten seconds to answer and no redirect followed. A 2xx delivers it; of any other answer only the start of its body is read and kept (200 characters), never the whole. |
| Retries | After 5 minutes, 30 minutes, 2, 8 and 24 hours; after the sixth attempt it has failed for good. **Try again** on the page sends one now, its attempts counted afresh. |
| Switched off | Ten deliveries in a row that failed for good switch the webhook off, audited as the system's `developer.webhook-off`; switching it on starts the count again. A switched-off webhook is sent nothing. |
| Kept | Deliveries thirty days, removed daily by `developer.prune`; one still waiting is kept. |
| Chat alerts | A `format` of `slack`, `teams`, `discord` or `google-chat` (2026-11-22, for the Connect apps page) instead of `standard`. The address must be the service's own (Slack's `hooks.slack.com/services/`, a Teams workflow on `logic.azure.com` or `powerplatform.com`, Discord's `/api/webhooks/`, Google Chat's `chat.googleapis.com/v1/spaces/`), and may change only to the same service's. Each event is sent as one plain line in the service's own body, made from the envelope just before the request, so the delivery log and a retry read the same: named events in words ("A website form was answered: Contact (by ann@example.com)"), others as the module and action. Unsigned, so the signing secret never reaches the chat service. Nothing typed may ping a channel: Slack's and Google Chat's angle brackets are replaced, Discord is told to parse no mention, and Discord's and Teams' Markdown links are kept apart so no address hides behind words. The test button posts one line saying alerts reach the channel. |

## The pages

| Path | Shows |
|---|---|
| `/developer` | a row of **Jobs**, **Webhooks** and **API reference**; why the jobs wait, while a budget holds them; the jobs with their state (went through, failed last, running, paused, not run yet), schedule, last run with the last day's strip under it, and next run, and for a manager **Run soon**, **Check for work** where the job has a check, and **Pause** or **Resume**; what the last failures said; the flows and when they start |
| `/developer?show=webhooks` | the webhooks with their state and last delivery, **Add a webhook** for a manager, and how a receiver checks a delivery |
| `/developer?show=reference` | each mounted module, folded, with its routes (method, full path, summary, capability), hooks, jobs, checks and error codes |
| `/developer/webhooks/:id` | the webhook's state; the secret, once, after it is made or renewed; **Send a test**, **Switch off** or **on**, **New secret**, **Remove**; its address, events and description; the newest fifty deliveries with **Try again** |

## The routes

| Routes | Capability | What they do |
|---|---|---|
| `GET /jobs` | `developer.read` | the jobs (each with its last day and whether it has a check) and flows, why the jobs wait (`standDown`, null while they run), and whether the person may manage them |
| `GET /jobs/:id/check` | `developer.read` | what waits for a job that declares a check, as `waiting`; nothing is run; `KIT-E-0404` for a job with none |
| `POST /jobs/:id/run`, `/pause`, `/resume` | `developer.manage` | made due now, paused, resumed |
| `GET /webhooks`, `GET /webhooks/:id` | `developer.read` | the webhooks; one with its newest fifty deliveries |
| `POST /webhooks` (`url`, `events`, `description`, `format`), `PATCH /webhooks/:id` (those and `on`), `DELETE /webhooks/:id`, `POST /webhooks/:id/rotate`, `POST /webhooks/:id/test`, `POST /deliveries/:id/retry` | `developer.manage` | the webhooks and their deliveries |
| `GET /reference` | `developer.read` | the API as the mounted modules declare it |

Every change is audited by the module: `developer.job-run`, `.job-pause`, `.job-resume`,
`.webhook-create` (with its address's host only: a path or query often carries the receiver's own
secret, 2026-11-20), `.webhook-update` (what changed, from what to what), `.webhook-delete`,
`.webhook-rotate`, `.webhook-test` (what came back) and `.delivery-retry`; the system's
`developer.webhook-off`. Each row names the webhook by its description, or the host it calls; the
address is kept by its host alone, never its path, which can carry the receiving service's key.

## Health

In the `jobs` lane: `developer.jobs` **warns** naming the jobs whose last run failed and the ones
paused by hand, passing by a job the Modules page switched off (the `off` option, since
2026-11-12), which does not run anyway; `developer.webhooks` **warns** while a webhook fails or
was switched off by its failures.

## Tables

Migration `0022_developer.sql`, additive and idempotent: `developer_webhooks` (the address,
description and events, on or off, the sealed secret and its wrapped data key, the failures in a
row, the last delivery and its answer, who and when) and `developer_deliveries` (one event for
one webhook: the audit row it came from, the body, the state, attempts, the next attempt, the last
answer, its error and time). Migration `0072_developer_chat.sql` adds `developer_webhooks.format`
(`standard` unless a chat format). The jobs' pause is two columns of `@oltrem/core-jobs`'s table,
migration `0021_jobs_pause.sql`.

## Errors

The module owns the `2600` to `2699` block: `KIT-E-2601` the address cannot take webhooks,
`KIT-E-2602` the company has ten webhooks, `KIT-E-2603` the KEK secret is missing, `KIT-E-2604`
the same webhook was just added (within a minute), `KIT-E-2605` the job is switched off.

## Not here yet

- API keys for machines. The portal is behind the Access door, which lets in people only: the
  door `npm run deploy` makes has no rule for a service token, and the pipeline refuses an
  identity with no email, so no other system can call the API today. Keys made on this page are
  planned ([the roadmap](../../docs/roadmap.md)).
- Events from a module's own domain (a booking confirmed, say) beyond what is audited; a module
  that wants one records it as a system action.
- A webhook per place: every webhook is the company's.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module, with the scheduler of
`@oltrem/core-jobs` real and the network stood in for by a receiver that checks each signature:
the manifest; addresses and event patterns; the signature against the Standard Webhooks published
example; both capabilities read at the company; jobs listed, paused (the tick skips them),
resumed and made due now, each audited; each job's last day, nothing holding them, and Check for
work for a job with a check, refused for one without and for a place below; a webhook's secret answered once and stored sealed; a
test; audit rows turned into deliveries for the webhooks that asked, from the first run on, a
refused change not sent; the retry ladder with one message id, a failure for good, a retry by
hand; ten failures switching a webhook off; a new secret; changes checked; pruning; no KEK; chat
alerts (the service's own address only, one plain line an event in each service's body, unsigned,
mentioning nobody, no hidden links); the reference. The client template's screens test opens the pages.
