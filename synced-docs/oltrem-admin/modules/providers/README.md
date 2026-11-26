# @oltrem/providers

Providers as data (plan section 8): the outside services a client Worker uses are rows, not
adapters. A **definition** says how one kind of provider is spoken to: its transport, auth
scheme, send template, probe, webhook field map, DNS fingerprint, the fields a person pastes and
the key recipe. An **instance** is one provider a tenant has set up from a definition, with its
credential sealed to its own row (`@oltrem/core-crypto`), its place in the failover order and
what the probe last saw. The kit ships its definitions in code; a client's own, or its changes to
the kit's, are rows a screen can edit with no deploy.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [using-it](docs/using-it.md) | Using it |
| [definitions](docs/definitions.md) | What the kit ships; what a definition holds; providers with limits; the contract |
| [routes](docs/routes.md) | Routes; the adapters |
| [delivery-reports](docs/delivery-reports.md) | Delivery reports; detection; status and failover; the checks; credentials; tables and errors; tests |
