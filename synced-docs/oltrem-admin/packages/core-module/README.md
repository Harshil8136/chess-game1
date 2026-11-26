# @oltrem/core-module

The module contract of the kit (plan section 4.3): one manifest per feature, checked when it is
defined so a bad one fails the build. So far: the id and the version, the capabilities on their
bit plane, the API routes with their capability and schema, the event types a module handles, its
jobs, its flows, its health checks, the migrations it ships, the settings and errors it owns, and
the scheduled hook, its pages, Home cards and public hooks (`pages`, `home`, `hooks`). Words
in other languages and per-module docs are not on the manifest.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [defining-a-module](docs/defining-a-module.md) | Defining a module; What the contract refuses; Capabilities; Public hooks; Jobs; Flows; Health; Home; Search |
| [reports](docs/reports.md) | Reports; Needs you; Get started; Bulk actions; Personal data; Customer parts; Pages |
| [csv-files](docs/csv-files.md) | CSV files; Calendar items; Pages to print; Amounts; Where a request came from; Migrations, settings and errors; Key recipes; Schemas; The event envelope |
