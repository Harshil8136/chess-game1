---
title: "@oltrem/campaigns: using it, who may do what"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src/module.ts, campaigns.ts]
---

# @oltrem/campaigns: using it, who may do what

> Part of [the @oltrem/campaigns README](../README.md).

## Using it

```ts
import { CAMPAIGN_TEMPLATE, createCampaigns } from '@oltrem/campaigns';
import { pages as campaignsPages } from '@oltrem/campaigns/pages';
import { withPages } from '@oltrem/core-module';

const email = createEmail<Env>({ /* ... */ templates: [CAMPAIGN_TEMPLATE /* , ... */] });
const campaigns = createCampaigns<Env>({
  bindings: (env) => ({ db: env.DB }),
  // The email module's `send`, `senders`, `bulk`, `templates` and `lists`. Its `senders.list`
  // (optional) lets the From step name the addresses that wait for their domain's check.
  email,
  config: settingsFor, // where the five settings below are read
  // What the Cloudflare plan allows now, from Status (optional: the free plan's run without).
  capacity: async (env) => ({ plan, external, writesLeft, queue }),
  alerts: { raise, resolve }, // the alerts module's, for waits, pauses and approvals (optional)
  timeZone: async (env) => 'Europe/Madrid', // sending hours are read in it (optional: UTC)
});
const modules = [iam.module, email.module, withPages(campaigns.module, campaignsPages)];
```

`createCampaigns` returns the `store` and the module manifest. It stands on IAM and sends through
the email module, to whose templates the client adds `CAMPAIGN_TEMPLATE`. Each audit row names the
campaign (`name`). Its pages (`@oltrem/campaigns/pages`) give **Campaigns** in the sidebar's Email
group, with Mailing lists as its tab.

## Who may do what

Five capabilities on bit plane `13`, each read at the campaign's place or above (a campaign the
person may not read is not found):

| Capability | Class | What it allows |
| --- | --- | --- |
| `campaigns.read` | read | See campaigns and figures |
| `campaigns.write` | operate | Drafts, message, template, people, files, a test to oneself |
| `campaigns.send` | admin, fresh sign-in | Start, pause, resume, cancel, pace, unclear people; the do-not-mail list when held at the company |
| `campaigns.approve` | admin, fresh sign-in | Answer someone else's large send |
| `campaigns.run` | operate | **Run now** |

The sender must be one the person may use for bulk mail (`email.senders.use` at its place, on a
passing domain), for the writer and the starter alike.
