# @oltrem/core-health

Status of a client Worker (plan sections 4.3 and 10): every module declares its checks on
its manifest, one job on the tick runs them, each at its own pace, and one table keeps the last
result per check.
A problem opens only after two failures in a row (two-fails-open), so one bad minute never pages
anyone. The Status page, acknowledging and snoozing come with the health module of phase 5; the
alerts with the providers of phase 4, through `onOpen` and `onClose`.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [declaring-a-check](docs/declaring-a-check.md) | Declaring a check; Running the checks |
| [cloudflare-plans-budgets](docs/cloudflare-plans-budgets.md) | The Cloudflare plan's budgets; Service status; Web addresses to watch; Table |
| [tests](docs/tests.md) | Tests |
