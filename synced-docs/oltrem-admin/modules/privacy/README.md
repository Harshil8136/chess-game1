# @oltrem/privacy

Privacy requests: when someone asks to see, correct or delete the data the company holds on them,
or to stop a use of it, the request is logged here with the day it is due. The portal finds their
data in every part of it in one search, gives a copy as one file once their identity is checked,
reminds whoever answers as the due day nears, and keeps what the person was told. Every step is in
the audit log.

## Using it

```ts
import { createPrivacy } from '@oltrem/privacy';
import { pages as privacyPages } from '@oltrem/privacy/pages';
import { withPages } from '@oltrem/core-module';

const privacy = createPrivacy<Env>({
  bindings: (env) => ({ db: env.DB }),
  config: settingsFor,
  modules: () => modules,
});
const modules = [iam.module, /* ... */ withPages(privacy.module, privacyPages)];
```

`createPrivacy` returns the `store` and the module manifest. `modules` is read when a search runs,
so the list can name the privacy module itself. It stands on the IAM module (sessions, the
authorizer) and the audit log, and adds no binding, secret or variable.

## Who may do what

Two capabilities on bit plane `17`, both read at the company itself, since a request is about the
whole company's data: someone who holds them only at a place is refused.

| Capability | Lets them |
|---|---|
| `privacy.read` | see the requests and how each was answered |
| `privacy.manage` | log a request, search for the person's data, write down how their identity was checked, download the copy, close it; Needs you shows them the requests due |

## The setting

| Key | Default | Meaning |
|---|---|---|
| `privacy.answer_days` | `30` (1 to 90) | a request is due this many days after the day it came in |

Thirty days matches the GDPR's one month. Other laws differ, and the client sets the number its
own law gives: the CCPA gives 45 days, and Mexico's 2010 data protection law (LFPDPPP) gives 20
business days. These are a starting point read on 2026-10-27, not legal advice; the 2025 Mexican
law was not checked. Sources: [GDPR deadlines](https://gdprlocal.com/dsar-rules-and-deadlines/),
[US state laws](https://www.bdemerson.com/article/dsar),
[the LFPDPPP](https://kyc-systems.com/blog/lfpdppp).

## How a request is answered

1. **Log it**: the kind (see, correct, delete, stop a use), the person's address (kept in lower
   case), what they asked, and the day it came in (today when left out; never a future day). Its
   due day is set from the setting.
2. **Find their data**: every mounted module that declares `personal` (core-module, "Personal
   data") is asked for its rows under the address, at most `PERSONAL_ROWS` (200) each, and the
   audit log for what the address did in the portal. The page shows each part with its row count
   and a link to its page. The search is audited with the parts it found.
3. **Check who asks**: their data goes only to them. Whoever answers writes down how the identity
   was checked; until then the copy is refused (`KIT-E-2801`).
4. **Download a copy**: one JSON file with the request and every part's rows. It is not cached,
   and each download is audited.
5. **Correct or delete** in the module that holds the data, through the link: that module's own
   rules, checks and audit apply. Nothing is deleted from here, by design.
6. **Close it**: answered or refused, with what the person was told. A closed request is kept as
   it was; a new request is logged if they ask again (`KIT-E-2802`).

The modules that declare `personal` in the kit:

| Module | Title | What it finds |
|---|---|---|
| users | Their account and roles | the account (address, name, language, on or off) and every role given to it |
| forms | Form answers | every answer sent from the address or naming it, with the notes on it |
| records | Records in lists | every record whose text names the address, its values by field label |
| campaigns | Campaigns they were sent | whether they are never mailed, and each campaign sent to them |
| email | Emails sent to them | each message sent to the address and what became of it (the text is not kept) |
| (the audit log) | What they did in the portal | the actions they made: when, what, on what, the outcome |

## The pages

| Path | Shows |
|---|---|
| `/privacy` | Open or Closed in a row; how many are past due; "Log a request" in a dialog; the requests, open ones by due day |
| `/privacy/:id` | the request and its state; a row with "Find their data", "Download a copy" (once checked), "Close it" and "All requests"; how the identity was checked, or the form to write it down; where their data is, after a search; what they were told, once closed |
| `/privacy/:id/copy` | the copy as a file |

## The routes

| Route | Capability | What it does |
|---|---|---|
| `GET /requests` (`status` open or closed) | `privacy.read` | the requests, at most 100, with how many are open and past due |
| `POST /requests` | `privacy.manage` | logs a request |
| `GET /requests/:id` | `privacy.read` | one request |
| `POST /requests/:id/verify` | `privacy.manage` | writes down how the identity was checked |
| `POST /requests/:id/find` | `privacy.manage` | searches every module and the audit log |
| `GET /requests/:id/copy` | `privacy.manage` | the copy, once the identity is checked |
| `POST /requests/:id/close` | `privacy.manage` | closes it, answered or refused, with what they were told |
| `GET /todo` | `privacy.manage` | Needs you: the requests due within seven days or past due |

## Health

The check `privacy.due` warns while a request is open past its due day, naming how many and since
when.

## Table

Migration `0025_privacy.sql`, additive and idempotent: `privacy_requests` (the kind, the address,
what was asked, when it came in and is due, the state, how the identity was checked and by whom,
what the person was told and by whom). It holds the address the person gave, which is what
answering them needs.

## Errors

The `28xx` block: `KIT-E-2801` the identity is not checked yet, `KIT-E-2802` the request is
already closed. An address, a day or a text out of bounds is the core's `KIT-E-0422`.

## Not here yet

- Deleting or correcting from the request page across modules at once: each module keeps that.
- A public form for people to make a request themselves: logged by staff for now, from email or
  a website form answer.
- Business days for the due day.

## Tests

Inside the Workers runtime, through the pipeline beside the IAM module: the manifest and the
contract's refusal of a `personal` without a title; a request logged at the company only, its
address in lower case, its due day, and the refusals audited; the search across modules (a part
with more rows than a search answers, an address outside the portal dropped) and the audit log;
the copy refused before the check, then given as one file, audited; Needs you and the health check
for a request past due; a closed request kept as it was. Each kit module's `personal` is tested in
its own package. The client template's screens test logs a request for an address a campaign was
sent to, finds it, checks who asks, downloads the copy and closes it.
