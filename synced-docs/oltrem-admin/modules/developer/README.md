# @oltrem/developer

The portal's changes sent to the company's other services as they happen (**Webhooks**), and the
portal's API described from the code that runs it (**API reference**), under **Developer** in the
sidebar. Scheduled jobs are their own part: [Scheduled jobs](../jobs/README.md).

## Using it

```ts
const developer = createDeveloper<Env>({
  bindings: (env) => ({ db: env.DB }),
  kek: (env) => env.KEK, // seals each webhook's signing secret
  modules: () => modules, // this module is one of them
});
const modules = [iam.module, /* ... */ withPages(developer.module, developerPages)];
```

It returns `webhooks` and the manifest, stands on IAM and the KEK secret, and adds no binding,
secret or variable. Two capabilities on bit plane 14, both read at the company (a webhook is sent
every place's changes): `developer.read` (webhooks, deliveries, the reference) and
`developer.manage` (add, change, test, remove; a fresh sign-in).

## Webhooks

Limits are `WEBHOOKS` in `src/webhooks.ts`.

| Part | What it does |
|---|---|
| The address | https, a public name (no IP address, `localhost`, `.local`, `.internal`), no user or password, 500 characters; `max` (10) a company. The same address and events again within a minute is `KIT-E-2604` |
| Events | Space separated: `*`, `forms.*` or `forms.answer`; `events` (20) at most. An event is an audited action that went through |
| Where they come from | The audit log, so any module's changes can be sent with no code of its own. `developer.webhooks` reads `readPerTick` (200) rows a run from `oltrem_meta` `developer.webhooks_seq`; a webhook gets only what was audited after it was made. With none on, the job moves its place to the log's end in one write and sleeps (`idle` 6 h); making or switching on the only webhook moves the place and wakes the job in one batch |
| The body | `{"id": "evt_<seq>", "v": 1, "type", "timestamp", "data": {"seq", "actor", "actorKind", "target", "details"}}`; `id` is the same when resent, so a receiver drops repeats. `v` (`EVENT_VERSION`) rises only for a change a receiver notices; fields are only added. A test's id is `evt_test_<delivery>` |
| Signing | [Standard Webhooks](https://www.standardwebhooks.com/): `webhook-id` (`msg_<delivery>`, the same each attempt), `webhook-timestamp`, `webhook-signature: v1,<base64 HMAC-SHA256 of id.timestamp.body>` keyed by the base64 after `whsec_`. While an old secret signs, both (`v1,<new> v1,<old>`) |
| The secret | 24 random bytes as `whsec_…`, answered once, sealed under its own data key wrapped by the KEK (`@oltrem/core-crypto`). **Rotate secret** keeps the old one signing for `overlapHours` (0 default, 1, 24, 168) and says until when. No KEK, no webhook (`KIT-E-2603`) |
| Sending | Every 5 minutes, `sendPerTick` (10) a run, `together` (5) at once, 10 s each, no redirect. A 2xx delivers; of another answer only 200 characters are read |
| Retries | `backoffMinutes`: 5, 30, 120, 480, 1440; after the sixth attempt, failed for good. **Try again** sends one now |
| Switched off | `offAfter` (10) failures for good in a row, audited as the system's `developer.webhook-off`; switching on restarts the count. `stopped_seq` and `delivered_seq` keep where it was |
| Resend missed events | `POST /webhooks/:id/replay` queues the events after `fromSeq` (default the newest it took) up to where the job read, never one it took or still waits on; `replayMax` (1,000) a press, made by one `INSERT ... SELECT` so the Worker spends no CPU; sent ten a run (1,000 take about eight hours). Switches it on and wakes the job. Offered with the count while it is off or failing |
| Kept | Deliveries `keptDays` (30), pruned daily by `developer.prune`; a waiting one stays |
| Chat alerts | `format` (`WEBHOOK_FORMATS`) `slack`, `teams`, `discord` or `google-chat` instead of `standard`: only the service's own address (and changed only to the same service's); each event one plain line (`LINE_MAX` 300) in the service's body, built just before the request; unsigned; no mentions (brackets replaced, Discord parses none) and no addresses hidden behind link words. The test posts one line |

## The pages

| Path | Shows |
|---|---|
| `/developer` | Chips: Webhooks, API reference, API keys. The webhooks with state and last delivery, **Add a webhook**, how a receiver checks one |
| `/developer?show=reference` | A note leading to API keys, then each module folded: routes (method, path, summary, capability), hooks, jobs, checks, error codes |
| `/developer/webhooks/:id` | State; the secret once; **Send a test**, **Switch off** or on, **Rotate secret**, **Resend missed events**, **Remove**; address, events, description; the newest `listed` (50) deliveries with **Try again**, above them a glance (`src/deliveries.ts`: share delivered, waiting, typical and slowest answer, the newest failure and what to do) |

## The routes

| Route | Needs | What it answers |
|---|---|---|
| `GET /webhooks`, `GET /webhooks/:id` | `developer.read` | The webhooks (with `oldSecretUntil`); one with its deliveries, and for a manager `missed` (`{count, more, fromSeq}`, null while nothing can be missed) |
| `POST /webhooks` (`url`, `events`, `description`, `format`), `PATCH /webhooks/:id` (those and `on`), `DELETE /webhooks/:id` | `developer.manage` | Add, change, remove |
| `POST /webhooks/:id/rotate` (`overlapHours`), `/test`, `/replay` (`fromSeq`; `{queued, fromSeq}`), `POST /deliveries/:id/retry` | `developer.manage` | Rotate, test, resend, retry |
| `GET /reference` | `developer.read` | The API as the modules declare it; `?schemas=all` or `?schemas=iam,files` adds route bodies as JSON Schema, once per isolate |

Module parts: Reports' Services section (deliveries through and failed, share on the first try,
each webhook) and Home's Needs you (up to five failing or switched-off webhooks, `developer.manage`).

Audited: `developer.webhook-create`, `-update` (from and to), `-delete`, `-rotate`, `-test`,
`-replay`, `.delivery-retry`, and the system's `developer.webhook-off`. A row names the webhook by
description or host; an address is kept by its host only, since a path can carry the receiver's key.

## Health, tables, errors

`developer.webhooks` (lane `jobs`) warns while a webhook fails or was switched off by failures.

| Migration | Adds |
|---|---|
| `0022` | `developer_webhooks` (address, events, on, sealed secret and wrapped key, failures, last delivery) and `developer_deliveries` (one event for one webhook: audit row, body, state, attempts, next attempt, last answer) |
| `0072` | `format` |
| `0102` | `old_data_key`, `old_secret`, `old_until`, `delivered_seq`, `stopped_seq`, and an index of deliveries by event |

Block `2600`–`2699`: `KIT-E-2601` the address cannot take webhooks, `2602` ten already, `2603` no
KEK, `2604` the same webhook just added.

Not built: events beyond what is audited (a module records a system action instead), and a webhook
per place.

## Tests

`test/developer.test.ts`, in the Workers runtime with the real scheduler and a receiver that checks
each signature: the manifest; addresses and patterns; the signature against the spec's example;
capabilities at the company; the secret once and sealed; a test; audit rows to deliveries, a
refused change not sent; the retry ladder, a failure for good, a retry by hand; ten failures
switching off; rotation with both signatures; the body's id and version; Resend missed events
(managers only, once each, the job's body, the cap, switched on); pruning; no KEK; chat alerts; the
reference. The client template's screens test opens the pages.
