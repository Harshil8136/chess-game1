# @oltrem/relay

The connect relay: one Cloudflare Worker in the Vendor's own account, for every portal, that makes
one-click sign-in possible without any portal holding an app's secret. It holds the sign-in apps'
ids and secrets, sends the person to the service's own approval page, exchanges the code that comes
back, keeps only the fields the portal needs and seals them to the portal's one-time key with its
own seal key. It stores nothing: no table and no key-value store, and its logs keep errors only, not
the addresses of requests (a trip's state rides in them).

```text
portal  --302-->  /start/<service>?state=...        the portal must be listed in RELAY_PORTALS
relay   --302-->  the service's sign-in and approval page
service --302-->  /back/<service>?code=...&state=...
relay   exchanges the code with the app's secret (Airtable: its id alone), keeps only the fields its entry names,
        seals them to the portal's one-time key with RELAY_SEAL_KEY, and
        --302-->  <portal>/connect/back?p=<service>&n=<nonce>&r=<sealed>
```

How the portal starts and finishes a trip, and why each check is there, is in
[the connect module's README](../../modules/connect/docs/using-it.md#one-click-sign-in).

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [services](docs/services.md) | The services; Its secrets; The seal key; Setting it up (once, by the Vendor) |
| [tests](docs/tests.md) | Tests |
