# @oltrem/cli

The kit's command-line tool, `oltrem`, for a client repository. Its commands: the **resource
manifest check** that keeps a client's Worker at one of each resource (plan 9.1, R-09),
**`migrations sync`** and **`migrations apply`** for the kit's migrations (plan 10), **`setup`** for
the steps a new client repository needs (plan 15.3), **`docs`** for the generated reference (plan
15.5), **`check agents`** and **`check tokens`** for the instruction files and the token registry
(plan 15.1, 9.4), the **doctor** with its ten checks, and, since phase 3, **`new module`**, which
writes a complete module into a client repository from the kit's module template (plan 4.3 and 18),
and, since phase 5, **`backup setup`**, what the nightly backup needs on the account after the first
deploy, **`backup drill`**, the monthly restore drill (plan 9.3), **`github report`**, the deploy
workflow's report for the GitHub module (plan 4.4), and **`vendor set`**, which writes the Vendor's
address after the first deploy (plan 7.4), and, since phase 6, **`upgrade`**, the step after a new
kit version (plan 14.3), and **`check files`**, **`check modules`**, **`check packages`**, **`check
secrets`** and **`check budgets`**, which keep a client's code out of the kit's files, inside its
own modules, on the kit's packages, free of keys and within the Worker's limits (research 18), and
**`release`**, the deploy workflow's release on `main` with its health check and step back, and
**`operate`**, the jobs of the operations menu (research 18 §3.5), and **`fleet`**, which brings
every client's portal up to date after each push to the kit, and **`live`**, a real portal on the
Vendor's computer, on production. The tool runs on Node and has no runtime dependency.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [look-in-a-terminal](docs/look-in-a-terminal.md) | The look in a terminal; `oltrem manifest check`; `oltrem migrations sync`; `oltrem migrations apply` |
| [oltrem-deploy-dir](docs/oltrem-deploy-dir.md) | `oltrem deploy [dir]`: the seven steps |
| [oltrem-deploy-dir-2](docs/oltrem-deploy-dir-2.md) | `oltrem deploy --page`; the start page; reports and run logs |
| [oltrem-setup-dir](docs/oltrem-setup-dir.md) | `oltrem setup`; `oltrem new client`; `oltrem new module`; `oltrem docs`; `oltrem check agents`; `oltrem check tokens` |
| [oltrem-check-files-dir](docs/oltrem-check-files-dir.md) | The client checks (files, modules, packages, secrets, budgets); `oltrem release`; `oltrem fleet`; `oltrem live`; `oltrem operate` |
| [oltrem-backup-setup-dir](docs/oltrem-backup-setup-dir.md) | `oltrem backup setup`; `oltrem backup drill`; `oltrem github report`; `oltrem vendor set`; the door and settings; `oltrem parts` |
| [oltrem-mail](docs/oltrem-mail.md) | `oltrem mail`; `oltrem upgrade`; `oltrem doctor`; in the kit repository |
