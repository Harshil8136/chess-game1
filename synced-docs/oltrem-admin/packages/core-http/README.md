# @oltrem/core-http

The one request pipeline of a client Worker, on Hono: request ids, security headers, the identity
the Access door asserted, the startup hook once per isolate, the session hook, module routes with
their capability and schema checks, one problem shape for every error, public hooks, API keys, and
the three Worker handlers (`fetch`, `scheduled`, `queue`) from one place.

## Contents

| Part | Sections |
|---|---|
| [pipeline](docs/pipeline.md) | The pipeline; what is told; Idempotency-Key; the inner call; the router |
| [using-it](docs/using-it.md) | Using it; hooks and API keys; startup, session and identity; the local door; the three handlers; tests |
