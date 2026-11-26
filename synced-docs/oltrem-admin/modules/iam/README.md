# @oltrem/iam

Permissions for a client Worker (plan sections 6, 7 and 10): who may do what, where, as data a
client's Owners manage themselves. So far: the tables, the capability registry the modules fill
when the Worker starts, the compiler that turns a person's grants into one small map, the check that reads it,
the sessions that carry the map from one request to the next with the pipeline's hook and
authorizer, the governance: every write that changes who may do what, each refused unless the
actor could stand behind it, and the handover: the Vendor creates the one company and invites its
first Owner, who takes it over, and the routes: the JSON side of all of it under `/api/iam`, with
one call, `createIam`, that builds the sessions, the governance, the handover and the module the
pipeline mounts. The phone screens follow.

## Contents

This README is split by section, so each part can be read whole.

| Part | Sections |
|---|---|
| [model-in-one-paragraph](docs/model-in-one-paragraph.md) | The model in one paragraph; Declaring capabilities; Compiling and checking |
| [sessions-and-the-authorizer](docs/sessions-and-the-authorizer.md) | Sessions and the authorizer |
| [governance](docs/governance.md) | Governance; The Vendor and the handover |
| [care-on-the-tick](docs/care-on-the-tick.md) | Care on the tick; The door, and who gets in; API keys |
| [routes](docs/routes.md) | The routes; Permission names; Tables |
| [errors](docs/errors.md) | Errors; Tests |
