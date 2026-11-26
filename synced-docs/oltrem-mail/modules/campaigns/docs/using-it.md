---
title: "@oltrem/campaigns: Using it; Who may do what"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [modules/campaigns/src; split from modules/campaigns/README.md]
---

# @oltrem/campaigns: Using it; Who may do what

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

`createCampaigns` returns the `store` (every function the routes and jobs call) and the module
manifest. It stands on the IAM module (sessions, the authorizer, the audit wrapper) and sends
through the email module: the client adds `CAMPAIGN_TEMPLATE` to the email module's templates. Each
of its audit rows names the campaign (`name`), so the Audit log's To what reads it after the
campaign is gone, and says from where (the kit's audit writer adds it). Its pages come from
`@oltrem/campaigns/pages`, type-checked against the DOM like the files module's, and give it a
**Campaigns** entry in the sidebar's Email group, after Email, with the email module's Mailing lists
as its tab.

## Who may do what

Five capabilities on bit plane `13`: `campaigns.read` sees the campaigns and their figures;
`campaigns.write` starts a draft, writes its message, picks its template, uploads its list or
picks a saved one, adds people and sends a test to oneself; `campaigns.send` starts, pauses,
resumes and cancels a campaign, sets its pace and decides about unclear people once it runs, and
asks for a fresh sign-in; `campaigns.approve` (class admin, fresh sign-in) answers a large send
someone else asked for, never one the person asked for themselves; `campaigns.run` (class operate,
since 2026-11-10) presses **Run now** on a sending campaign: its next run at once, instead of at the
next five minutes, then the Run log shows what it did. Each is read at the campaign's place, or a place above it; a campaign the person may
not read is not found. The sender address a campaign goes out from is one the person may use for
bulk mail: `email.senders.use` at the address's place, on a passing domain; the person who
starts it needs that too. The do-not-mail list is the company's, so reading it and changing it need
`campaigns.send` held at the company itself.
