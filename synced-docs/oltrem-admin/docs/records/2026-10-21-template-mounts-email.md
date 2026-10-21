---
title: "Phase 4 in the client template: providers and email (2026-10-21)"
status: record
owner: vendor
last_verified: 2026-10-21
sources: [the plan, sections 5, 8 and 9.2; this repository]
---

# Phase 4 in the client template: providers and email

> **In plain words.** The provider list and the email sender were built and tested on their own.
> Now the client template's Worker runs them too, so all six kit modules built so far run there.
> The address a portal's messages come from is now a setting. It is written into the client's
> file at onboarding, and an Owner can change it later. Until it is set, no message leaves.

## What changed

- **`templates/client/src/index.ts`** mounts `@oltrem/providers` and `@oltrem/email` after IAM
  and users, so the mount order is iam, users, providers, email, backup, github, then health.
  - The providers module seals each credential under the `KEK` secret.
  - The email module sends through it. The queue's `email.send` events reach it through the
    Worker's queue handler.
  - The outbox the Worker builds is shared by the email module and the queue's completion hook.
- **`KEK` is a required Worker secret.** It is the providers module's key recipe. It is in
  `secrets.required`, the manifest, `src/env.d.ts`, the template's token registry and its
  generated reference.
- **Two email settings**, `email.from_address` and `email.from_name`, are declared on the email
  module's manifest.
  - Both are in the system layer, editable by an Owner, and empty by default.
  - The address follows the same rule as the message check. The name is one line.
  - The template's `from` reads them, and uses the client's name while the name is empty.
- **Migrations `0010` and `0011`** are copied into the template.
- **`erasableSyntaxOnly`** is on in `tsconfig.base.json` for every package and module.
  - Mounting email showed that `SafeHtml` used a constructor parameter property. Node's type
    stripping cannot erase that syntax, so `oltrem docs` could not load the client's Worker file.
  - The class now assigns its field. The compiler refuses such syntax anywhere in the kit, so a
    client's Worker file always loads in Node.

## Decisions

- **The sending address is a setting now, not with the screens.** The template needs an address
  to give `from`. A hard-coded one would be a placeholder (R-10). A setting is the kit's own
  mechanism: the client file sets it at onboarding, the live layer overrides it later, and no
  variable is added (R-09).
- **An empty address stops the message, not the Worker.** While the address is empty, a message
  fails the message check with `from: not an email address` and is never sent. A Worker without
  a provider holds its messages anyway, so a fresh portal loses nothing that could have gone out.
- **A compiler rule, not a lint rule.** `erasableSyntaxOnly` is exactly what Node's type stripping
  accepts: no parameter properties, enums or namespaces. It is checked in the same typecheck
  gate.

## Not done here

- No message has gone out through a real provider. The phase's acceptance on the sandbox is that
  run.
- The Settings page that lets an Owner change the address comes with the screens.

## How it was verified

- The twelve gates pass locally.
- The template's eight tests, inside the Workers runtime:
  - the health route lists the seven modules;
  - the Vendor gets the kit's seven email definitions, no instance and no message;
  - the backup refusal, the GitHub status and the Workflow, as before;
  - the providers and email tables exist;
  - one tick runs `email.release`, `health.measure`, `health.run` and `providers.refingerprint`.
    It records six checks, the email and DNS ones `ok` with nothing to do.
- The email module's sixteen tests:
  - the manifest test now holds the two settings and their defaults;
  - an empty address and a real one pass, three malformed ones are refused;
  - a name with a line break is refused.
- `@oltrem/cli`: 86 tests. The Key recipes test lists the four secrets.
- `oltrem doctor` in the template passes CF-SEC-02 with `ACCESS_AUD`, `BACKUP_PUBLIC_KEY`, `KEK`
  and `KIT_OPS_TOKEN`.
- `erasableSyntaxOnly` refuses a parameter property: a one-file check gave `TS1294`.
- Not verified here: a send through a real provider. The sandbox is that run.
