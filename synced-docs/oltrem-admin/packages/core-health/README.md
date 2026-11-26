# @oltrem/core-health

Status of a client Worker: every module declares its checks on its manifest, one job on the tick
runs them, each at its own pace, and one table keeps the last result per check. A problem opens
only after `FAILS_TO_OPEN` (2) failures in a row, so one bad minute never pages anyone; the alerts
come through `onOpen` and `onClose`. Given `budgets`, it also measures the Cloudflare plan's
allowances and pauses the jobs before one runs out.

## Contents

| Part | Sections |
|---|---|
| [declaring-a-check](docs/declaring-a-check.md) | Declaring a check; running the checks; service status; web addresses to watch; tables; tests |
| [cloudflare-plans-budgets](docs/cloudflare-plans-budgets.md) | The plan and what one run may do; the free plan's budgets; Workers Paid; the events queue; request figures |
