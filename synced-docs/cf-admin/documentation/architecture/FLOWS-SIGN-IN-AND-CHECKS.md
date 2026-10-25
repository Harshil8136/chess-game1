---
title: "Flows: how a request is signed in and checked"
status: active
audience: [owner, ai, technical, operator]
last_verified: 2026-10-25
verified_against: [code]
owner: harshil
related_code: [src/middleware.ts, src/lib/auth/pipeline.ts, src/lib/auth/stages/classify.ts, src/lib/auth/stages/session-stage.ts, src/lib/auth/stages/refresh-role.ts, src/lib/auth/stages/assertion.ts, src/lib/auth/stages/bootstrap.ts, src/lib/auth/stages/access-map.ts, src/lib/auth/stages/decide.ts, src/lib/auth/decide-access.ts, src/lib/auth/plac.ts, src/lib/auth/guard.ts, src/lib/auth/surface-guards.ts, src/lib/auth/fresh-sign-in.ts, src/lib/fresh-sign-in-client.ts, src/pages/api/settings/confirm-code.ts, src/lib/approvals/ask.ts]
related_docs: [PERMISSIONS-SYSTEM.md, ARCHITECTURE.md, FLOWS-SERVICES-AND-JOBS.md, plac-and-audit.md, ../security/SECURITY.md]
tags: [architecture, flows, mermaid, auth, permissions, plac]
---

# Flows: how a request is signed in and checked

> **TL;DR (for everyone):** these are pictures of the path every request takes through the
> admin portal: who you are (Cloudflare Access, then the portal's own directory), what you may
> open (your role plus any personal grants or denies), and the extra checks a dangerous button
> adds (a recent sign-in or an emailed code, and sometimes a second person). Each picture is
> followed by a few plain sentences. The rules and their numbers are owned by
> [PERMISSIONS-SYSTEM](PERMISSIONS-SYSTEM.md); this page shows how they connect. Its companion,
> [FLOWS-SERVICES-AND-JOBS](FLOWS-SERVICES-AND-JOBS.md), shows the consoles, the scheduled jobs,
> email and every switch.

How to read the diagrams: a rectangle is a step, a diamond is a question, a rounded box is
where the request ends. Red ends refuse, green ends let the request through. Every name in
`code` is a real file, function, key or code you can search for.

## 1. The whole request, end to end

```mermaid
flowchart TD
    REQ(["A request reaches the portal Worker"]) --> CFA["Cloudflare Access at the edge:<br/>the person signs in here"]
    CFA --> SEB["sentryErrorBoundary<br/>catches anything thrown below"]
    SEB --> SEC["securityHeaders<br/>CSP with a fresh nonce per request"]
    SEC --> AUTH["authMiddleware<br/>the auth pipeline, section 2"]
    AUTH -->|"refused"| STOP(["Redirect, rewrite or JSON refusal"])
    AUTH -->|"allowed, locals.user set"| ROUTE{"Page or API route?"}
    ROUTE -->|"page"| PAGE["Astro page renders with the data layer,<br/>islands load in the browser"]
    ROUTE -->|"API"| API["API handler: its own checks, section 7"]
    API --> DONE(["JSON answer"])
    PAGE --> HTML(["HTML answer"])
    DONE -.->|"after the answer, waitUntil"| AUD["Audit rows, emails, Sentry"]
    HTML -.-> AUD

    classDef stop fill:#fde2e1,stroke:#c0392b,color:#000
    classDef ok fill:#e3f6e8,stroke:#1e8449,color:#000
    class STOP stop
    class DONE,HTML ok
```

`src/middleware.ts` chains three handlers in this order. Anything a route throws becomes a
JSON 500 for `/api/*` and is reported to Sentry; pages re-throw to Astro. Audit rows and emails
are written after the answer is sent, so they never slow a page.

## 2. The auth pipeline, stage by stage

```mermaid
flowchart TD
    IN(["Request"]) --> CL{"classify:<br/>asset, webhook, public page<br/>or public API?"}
    CL -->|"yes, right method"| NEXT1(["Let through, no session read"])
    CL -->|"yes, wrong method"| R405(["405 Method Not Allowed"])
    CL -->|"no"| CSRF{"csrfGate: a change<br/>from another site?"}
    CSRF -->|"yes"| R403C(["403 Forbidden"])
    CSRF -->|"no"| SES{"resolveSession:<br/>a session cookie with<br/>a live KV record?"}
    SES -->|"revoked-session or revoked flag set"| RREV(["Session ended:<br/>API 403 Session revoked,<br/>page /?error=session_revoked"])
    SES -->|"no session"| BOOT["bootstrap from Cloudflare Access,<br/>section 3"]
    SES -->|"yes"| RR["refreshRole:<br/>re-check against the directory,<br/>section 4"]
    BOOT -->|"refused"| RB(["Refusal with an error code"])
    RR -->|"refused"| RR2(["Session ended with an error code"])
    BOOT -->|"new session"| MAP
    RR -->|"session kept"| MAP["ensureAccessMap:<br/>a usable page map, section 5"]
    MAP -->|"no map and D1 down"| RSYS(["/?error=system_error"])
    MAP --> DEC["decide: page or API,<br/>read-only role, deny mode,<br/>section 6"]
    DEC --> REC["recordEvents:<br/>audit rows after the answer"]
    REC --> LOC["locals.user filled from the session"]
    LOC --> OUT{"Decision"}
    OUT -->|"next"| GO(["Route runs"])
    OUT -->|"rewrite"| DEN(["/dashboard/access-denied"])
    OUT -->|"json 403"| F403(["403 Forbidden"])

    classDef stop fill:#fde2e1,stroke:#c0392b,color:#000
    classDef ok fill:#e3f6e8,stroke:#1e8449,color:#000
    class R405,R403C,RREV,RB,RR2,RSYS,DEN,F403 stop
    class NEXT1,GO ok
```

`src/lib/auth/pipeline.ts` is a short list of stages in `src/lib/auth/stages/`. Each stage
either hands facts to the next one or returns a decision. Only `decision.ts` turns a decision
into a response, and only `record.ts` writes audit rows, which is why every branch above has
its own test (`test/pipeline-*.test.ts`).

The session lookup reads the session record plus three flags in one KV call: the session's
own revocation, the person's revocation, and the person's `authz-changed:` mark (section 8).
A session older than its maximum lifetime (`SESSION_MAX_LIFETIME_MS`, 24 hours) is gone, so the
request starts again from Cloudflare Access. An open tab watches the same limit
(`SessionWatchdog`, counting down from the server's figure) and then goes back through the
landing to the page it was on, which starts that new session; the landing shows no card for it.

## 3. The first request after signing in (cold sign-in)

```mermaid
sequenceDiagram
    autonumber
    participant B as Browser
    participant P as Portal Worker
    participant J as Access keys (JWKS)
    participant S as Supabase directory
    participant D as D1
    participant K as KV
    B->>P: Request with the Access cookie and headers
    P->>P: verifyAssertion: email header and JWT present?
    P->>J: Check the JWT (RS256, audience, issuer, expiry)
    J-->>P: Claims, or invalid
    Note over P: Missing email 401 missing_identity,<br/>missing token 401 missing_token,<br/>bad token 401 expired_token
    P->>P: Bot score under 30? Header email equals claim email?
    P->>S: admin_authorized_users row for this email
    S-->>P: Row, no row, or the directory is down
    Note over P: Down 503 directory_unavailable,<br/>no row access_denied, inactive account_inactive
    par Page map while the revocation flag is read
        P->>D: computeAccessMap (admin_pages joined with overrides)
        P->>K: revoked:userId flag
    end
    Note over P: Flag set 403 access_revoked,<br/>unknown role role_unrecognised
    P->>K: createSession (session record, signedInAt from the JWT iat)
    P-->>B: Set the session cookie, continue to the page
    P-)S: First sign-in only: save the Access subject id
    P-)D: Login event, sign-in alert rules
```

The sign-in time the session keeps is the Access token's own issue time, never later than now.
A token without one records 0, which no recent-sign-in rule accepts. The login event and the
sign-in alert decision run after the answer
([login-forensics](../security/login-forensics.md)).

## 4. A signed-in request: the role re-check

```mermaid
flowchart TD
    S(["Warm session"]) --> Q1{"authz-changed mark new,<br/>or 30 minutes since<br/>the last check?"}
    Q1 -->|"no"| KEEP(["Keep the session as it is"])
    Q1 -->|"yes"| DIR["Read the person's row<br/>from the Supabase directory"]
    DIR --> Q2{"Directory answered?"}
    Q2 -->|"no, outage"| Q3{"Last good check under<br/>two intervals old, and<br/>no admin change forcing it?"}
    Q3 -->|"yes"| KEEP2(["Keep the session, retry next request"])
    Q3 -->|"no"| E503(["End: 503, /?error=recheck_failed"])
    Q2 -->|"yes"| Q4{"Row found, active,<br/>role recognised?"}
    Q4 -->|"no row"| EAD(["End: access_denied"])
    Q4 -->|"inactive"| EIN(["End: account_inactive"])
    Q4 -->|"unknown role"| ERO(["End: role_unrecognised"])
    Q4 -->|"yes"| Q5{"Role changed or<br/>admin change forced?"}
    Q5 -->|"yes"| RECOMP["Recompute the page map from D1,<br/>save role, map and mark"]
    Q5 -->|"no"| STAMP["Save the check time"]
    RECOMP --> OK(["Continue"])
    STAMP --> OK

    classDef stop fill:#fde2e1,stroke:#c0392b,color:#000
    classDef ok fill:#e3f6e8,stroke:#1e8449,color:#000
    class E503,EAD,EIN,ERO stop
    class KEEP,KEEP2,OK ok
```

The interval is `SESSION_REFRESH_INTERVAL_MS` (30 minutes). An administrator's change sets the
person's `authz-changed:` mark, so the next request re-checks at once instead of waiting. No
outcome here writes a sign-in block: the directory row is the authority
(`src/lib/auth/stages/refresh-role.ts`).

## 5. The page map (PLAC): how it is built and read

```mermaid
flowchart LR
    subgraph BUILD["Built: computeAccessMap, one D1 query"]
        direction TB
        P1["Each active admin_pages row,<br/>joined with this person's<br/>admin_page_overrides row"] --> Q0{"Home page<br/>/dashboard?"}
        Q0 -->|"yes"| T0["true for every role"]
        Q0 -->|"no"| QE{"Override ended<br/>(expires_at passed)?"}
        QE -->|"yes"| ROLEP
        QE -->|"no"| QD{"Override says?"}
        QD -->|"deny"| F1["false: a deny always wins"]
        QD -->|"grant"| T1["true"]
        QD -->|"none"| ROLEP{"Grant-only page?"}
        ROLEP -->|"yes"| T2["true only for Vendor support"]
        ROLEP -->|"no"| T3["true when the role is at or<br/>above the page's required role"]
    end
    subgraph READ["Read: resolveAccess, every request"]
        direction TB
        R1{"Owner or<br/>Vendor support?"} -->|"yes"| A1["allow"]
        R1 -->|"no"| R2{"Exact key<br/>in the map?"}
        R2 -->|"yes"| A2["its value"]
        R2 -->|"no"| R3{"Longest ancestor<br/>across a slash?"}
        R3 -->|"yes"| A3["the ancestor's value"]
        R3 -->|"no"| A4["unknown"]
    end
    BUILD -->|"stored on the session,<br/>refreshed hourly or at<br/>an override's end"| READ
```

The map is computed at sign-in, on a role change, when an administrator's change forces it,
when it is older than an hour, and when a personal grant or deny it used reaches its end date
(`refreshAt`). If D1 is down and the session already has a map, the old one is kept; with no
map at all the session ends (`src/lib/auth/stages/access-map.ts`).

Reading has two questions with different defaults. The middleware gate and the sidebar ask
`decideAccess`: only an allow opens, so unknown means no. A page key the registry never defined
answers unknown. Handlers ask `isExplicitlyDenied`: only a deny closes. A hash key such as
`/dashboard/users#delete` never inherits from its page, because the ancestor rule needs a slash
([PERMISSIONS-SYSTEM](PERMISSIONS-SYSTEM.md) §6).

## 6. The decision: pages, APIs and read-only roles

```mermaid
flowchart TD
    D0(["decide(facts)"]) --> D1{"API path?"}
    D1 -->|"yes"| D2{"resolveApiAuthz:<br/>which page owns this API?"}
    D2 -->|"none: unmapped"| NOACC["no access"]
    D2 -->|"public or webhook"| ACC["access"]
    D2 -->|"mapped to a page"| D3{"decideAccess on that page"}
    D1 -->|"no, a page"| D4{"Home, access-denied,<br/>or decideAccess allows?"}
    D3 -->|"allow"| ACC
    D3 -->|"no"| NOACC
    D4 -->|"yes"| ACC
    D4 -->|"no"| NOACC
    ACC --> W{"A change<br/>(not GET, HEAD, OPTIONS)?"}
    NOACC --> W
    W -->|"yes"| LOG["Audit: api_mutation_attempt<br/>or page_mutation_attempt"]
    W -->|"no"| RO
    LOG --> RO{"Read-only role making a change<br/>other than asking for access?"}
    RO -->|"yes"| VB(["viewer_write_blocked:<br/>API 403 read-only, page access-denied"])
    RO -->|"no"| PG{"Page without access?"}
    PG -->|"yes"| RW(["Rewrite to /dashboard/access-denied"])
    PG -->|"no"| AP{"API without access?"}
    AP -->|"no"| NX(["next: the route runs"])
    AP -->|"yes"| MODE{"API_DENY_MODE"}
    MODE -->|"enforce"| DENY(["api_authz_deny, 403 Forbidden"])
    MODE -->|"shadow"| SH(["api_authz_shadow_deny,<br/>recorded and let through"])

    classDef stop fill:#fde2e1,stroke:#c0392b,color:#000
    classDef ok fill:#e3f6e8,stroke:#1e8449,color:#000
    class VB,RW,DENY stop
    class NX,SH ok
```

`src/lib/auth/stages/decide.ts` is pure: the same facts always give the same answer. Every API
route has to be listed in `API_PAGE_MAPPING` (`src/lib/auth/routes.ts`) or the public
allow-list, or it is refused: the API surface fails closed. `API_DENY_MODE` is `enforce` in
production; `shadow` exists only to stage a rollout over old routes. The read-only refusal does
not depend on it.

## 7. Inside an API handler: the checks a button adds

```mermaid
flowchart TD
    H0(["Handler starts"]) --> H1{"locals.user present?<br/>(requireAuth)"}
    H1 -->|"no"| X401(["401 Unauthorized"])
    H1 -->|"yes"| H2{"Minimum role met?"}
    H2 -->|"no"| X403(["403 Forbidden"])
    H2 -->|"yes"| H3{"Page denied for this person?<br/>(placDenyResponse)"}
    H3 -->|"yes"| X403P(["403 page-level policy"])
    H3 -->|"no"| H4{"Action key needed?<br/>e.g. #delete, #configure"}
    H4 -->|"yes"| H5{"Action key granted?<br/>(surface guards, placRequireGrant)"}
    H5 -->|"no"| X403A(["403 page-level policy"])
    H5 -->|"yes"| H6
    H4 -->|"no"| H6{"Body valid? (zod)"}
    H6 -->|"no"| X400(["400 with the reason"])
    H6 -->|"yes"| H7{"Dangerous action?<br/>needs a recent sign-in"}
    H7 -->|"yes, and stale"| XFR(["403 with x-fresh-sign-in: required,<br/>section 9"])
    H7 -->|"no, or fresh"| H8{"Needs a second person?"}
    H8 -->|"yes, someone could approve"| X202(["202: waits for approval,<br/>section 10"])
    H8 -->|"no"| DO["Make the change in D1, KV or Supabase"]
    DO --> AU["auditLog after the answer"]
    AU --> OK(["200 with the result"])

    classDef stop fill:#fde2e1,stroke:#c0392b,color:#000
    classDef ok fill:#e3f6e8,stroke:#1e8449,color:#000
    classDef wait fill:#fff4d6,stroke:#b9770e,color:#000
    class X401,X403,X403P,X403A,X400,XFR stop
    class OK ok
    class X202 wait
```

Not every route needs every box: each route uses the guards its feature defines
(`src/lib/auth/guard.ts`, `src/lib/auth/surface-guards.ts`). The order matters for hash keys:
the page is checked first, then the action, because a deny on the page must stop the action and
a deny on the action alone must stop it too. Owner and Vendor support pass every page and
action check by design (ADR-0002); the recent sign-in and second person still apply to them.

## 8. How a permission change reaches someone already signed in

```mermaid
flowchart LR
    A["An administrator changes a role,<br/>a page grant, or approves a request"] --> M["New random authz-changed:userId<br/>mark in KV"]
    M --> N["The person's next request reads<br/>the mark with the session flags"]
    N --> C{"Mark differs from<br/>the one on the session?"}
    C -->|"yes"| R["Re-read the role from Supabase<br/>and the page map from D1"]
    C -->|"no"| S["Nothing to do"]
    R --> E(["New rights on this request,<br/>nobody is signed out"])
    K["Force-kick, deactivate, delete,<br/>lock out"] --> F["revoked:userId flag (24 h),<br/>delete every session,<br/>end the Access session"]
    F --> G(["Signed out everywhere"])
```

Changing what someone may do never signs them out; only the force-kick family does
([PERMISSIONS-SYSTEM](PERMISSIONS-SYSTEM.md) §11). KV can take about a minute to agree
everywhere, so "next request" means within about a minute.

## 9. A recent sign-in, or an emailed code

```mermaid
sequenceDiagram
    autonumber
    participant U as Person
    participant UI as Portal page or console frame
    participant P as Portal Worker
    participant K as KV session
    participant Q as Email queue
    U->>UI: Taps a dangerous button
    UI->>P: POST the action
    P->>P: freshSignInRefusal: confirmedAt within 10 minutes?
    P-->>UI: 403 with x-fresh-sign-in: required
    Note over UI: A console frame posts<br/>cf-admin:confirm-it-is-you to the portal page
    UI->>U: Confirm it's you: Email me a code, or Sign in again
    U->>UI: Email me a code
    UI->>P: POST /api/settings/confirm-code (send)
    P->>K: confirmCode: hash, expiry, tries, sent time
    P->>Q: 6-digit code to the person's own address
    U->>UI: Types the code
    UI->>P: POST /api/settings/confirm-code (check)
    P->>K: codeConfirmedAt = now, code cleared
    P-->>UI: Confirmed for 10 minutes
    Note over UI: The portal posts cf-admin:confirmed to every frame
    U->>UI: Taps the button again
    UI->>P: POST the action
    P->>P: confirmedAt = later of signedInAt and codeConfirmedAt
    P-->>UI: The action runs
```

`confirmedAt` (`src/lib/auth/fresh-sign-in.ts`) is the one time every recent-sign-in rule
reads: the portal's own routes and the actor header sent to the Backups, Server and Email API
consoles. The code works only in the session that asked for it, lasts 10 minutes, allows 5
tries, is used once, and a new one needs a minute's wait. A Vendor support testing pass
makes `confirmedAt` now, but only from a real sign-in. The design:
2026-10-25 email code (private).

## 10. A second person for a few changes

```mermaid
stateDiagram-v2
    [*] --> Checked: route makes all its usual checks
    Checked --> Done: nobody else could approve,<br/>made alone and recorded
    Checked --> Waiting: 202, stored in the pending list,<br/>approvers emailed
    Waiting --> Rechecked: another Owner or Vendor support approves
    Waiting --> Declined: declined, or the asker cancels
    Waiting --> Expired: 3 days pass
    Rechecked --> Done: still valid as of now,<br/>made as the approver
    Rechecked --> NotDone: something changed since
    Done --> [*]
    Declined --> [*]
    Expired --> [*]
    NotDone --> [*]
```

Four changes wait like this: making someone Owner or Vendor support, removing a person,
removing the last active Owner, and changing how long the server keeps a log. The waiting list
is one `admin_portal_settings` row; an approval takes the change off it with a
compare-and-swap, checks it again as the asker, then makes it as the approver
(`src/lib/approvals/`, [PERMISSIONS-SYSTEM](PERMISSIONS-SYSTEM.md) §10.7).

## Verification log

| Date | Who | What was checked | Result |
|---|---|---|---|
| 2026-10-25 | claude | Section 2's lifetime paragraph, after the 24-hour re-sign-in fix, against `SessionWatchdog.tsx` and `landing.ts` (`RENEW_CODES`, `renewSignInPath`). Not checked: the diagrams again | pass |
| 2026-10-25 | claude | Every diagram against the code named in it: `src/middleware.ts`; `src/lib/auth/pipeline.ts` and all nine stage files (each branch, status, redirect code and audit action); `decide-access.ts`, `plac.ts` `computeAccessMap`, `guard.ts`, `surface-guards.ts`, `routes.ts`, `session.ts` (lifetime), `fresh-sign-in.ts`, `confirm-code.ts`, `fresh-sign-in-client.ts`, `src/lib/approvals/`; the two-person and revocation rules against PERMISSIONS-SYSTEM §10.7 and §11. Every mermaid block parsed with mermaid 11.4.1. Not checked: GitHub's own renderer, and live traffic | pass |
