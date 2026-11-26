---
title: "Standard admin terms on every screen (2026-10-31)"
status: record
owner: vendor
last_verified: 2026-10-31
sources: [packages/screens/src; packages/core-ui/src; packages/core-config/src/parts.ts; packages/cli/src; modules]
---

# Standard admin terms on every screen

> **In plain words.** The owner asked that the portal use the words people know from other
> professional admin consoles. Only the words people read changed: no address, permission id,
> setting key, table or API field changed, so every role keeps exactly the access it had.

| Before | Now |
|---|---|
| Parts | Modules |
| People (staff accounts), switched on or off | Users, Active or Deactivated; the sidebar group is Users & access |
| Places | Locations |
| Extra access, Allow or Block | Permission overrides, Allow or Deny |
| Requests, Reviews | Access requests, Access reviews |
| See, Do, Manage (and Look only, Everyday work, Run every part) | View, Edit, Admin (and View only, Standard user, Full admin) |
| Providers, Deploys, System health | Integrations, Deployments, System status |
| Danger area, Make a role | Danger zone, Create role |

Kept: Roles, Groups, Owner, Vendor, Audit log, Settings, Alerts, the module names, and "people"
where it means recipients or humans in general. Permission labels follow the same words.

Checked by the screens, CLI, IAM and module tests, updated to the new words, and `pnpm verify`.
