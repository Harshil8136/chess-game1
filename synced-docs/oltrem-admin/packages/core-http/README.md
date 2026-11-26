# @oltrem/core-http

The one request pipeline of a client Worker (plan section 4.2 and 11), built on Hono: request
ids, security headers, the identity the Access door asserted, the startup hook once per isolate,
the session hook, the module routes with their capability and schema checks, one problem shape for
every error, and the three Worker handlers (`fetch`, `scheduled`, `queue`) from one place.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [pipeline](docs/pipeline.md) | The pipeline |
| [using-it](docs/using-it.md) | Using it; The local door; The three handlers |
