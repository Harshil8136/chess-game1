---
title: "Server access notice — design"
status: active
audience: [owner, ai, technical, operator, non-technical]
last_verified: 2026-10-12
verified_against: [code]
owner: harshil
related_code: [src/lib/vps-notice.ts, src/lib/vps-notice-record.ts, src/components/admin/vps/ServerNotice.tsx, src/pages/api/vps/notice.ts, src/pages/dashboard/vps/[...section].astro, src/pages/dashboard/vps/app/[...path].ts, src/lib/auth/session.ts, src/lib/audit.ts, test/vps-notice.test.ts, test/vps-gateway.test.ts, test/vps-page.test.ts]
related_docs: [../features/VPS-CONSOLE.md, ../security/SECURITY.md, ../security/RoPA.md, ../architecture/plac-and-audit.md]
tags: [vps, cf-vps, notice, consent, audit, legal]
---

# Server access notice — design

> **In one minute:** the first time a person opens the Server page after signing in, a pop-up
> says that the server is privately owned and paid for by the platform's vendor, that only
> people he authorized may use it, that activity there is monitored and recorded, and that
> unauthorized use may lead to legal action. The person chooses **I agree** or **Leave**. The
> console stays shut until they agree, and either answer is saved in the Audit Log with their
> name, their session, the time, their approximate location and their device.

## 1. What the owner asked for (2026-10-11)

A notice of acknowledgement every time someone signs in to the admin portal and opens the
Server (VPS) area. It should say, in professional words, that the server is owned and paid for
by the vendor and developer, that any use needs his authorization, that unauthorized use,
access or changes are logged and may lead to legal or other action, and that anyone who is not
sure, or not authorized, should leave the page or ask an administrator or the vendor for help.
Every acknowledgement goes in the Audit Log with the user, the session, the location and the
device.

## 2. What the research says

| Source | What it asks of such a notice | How the notice follows it |
|---|---|---|
| NIST SP 800-53 control AC-8, "System use notification" | Show the notice **before** access. Say that the system is private (there: a government one), that use may be monitored, recorded and audited, that unauthorized use is prohibited and may bring criminal and civil penalties, and that using the system means consent to monitoring. Keep it on screen until the person acknowledges it and takes an explicit action to go on | The console does not load until the person chooses **I agree**; the four statements are the notice's three points and its last line |
| The US Department of Defense's standard notice and consent banner | Adds that people should have **no expectation of privacy**, and that records may be used and disclosed for authorized purposes | "You should have no expectation of privacy on this system" and "Records may be shared with the authorities" |
| Clickwrap practice (vendor and law-firm guidance on enforceable online agreements) | An **affirmative act** that clearly means yes (a button that says what it does, never a pre-ticked box or "by continuing to use"), conspicuous terms, and a record of **who** accepted, **when**, and **which version** of the text; a changed text is accepted again | An "I agree" button named in the consent line; the Audit Log row holds the person, the time, the session, the version and a fingerprint of the exact words; a new version is shown again to everyone |
| US court rulings on "I agree" screens: *Meyer v. Uber* (2nd Cir. 2017) and *Berman v. Freedom Financial Network* (9th Cir. 2022), read through law-firm and law-blog summaries on 2026-10-12 | Two tests: **reasonably conspicuous notice** of the terms, and an action that **unambiguously** shows assent. In *Berman* the terms sat in small grey text away from a green "continue" button, and the court held that clicking it was not assent | Since 2026-10-12 the consent line sits in the pop-up's foot, directly above the buttons, in the body's own colour and size rather than grey fine print, and names the button ("By choosing "I agree"") |
| Plain-language and scannability guidance for interfaces (NN/g findings as reported by design-system and UX-writing sources) | Key point first; short sentences; few list items, each starting differently; no long scrolling inside a pop-up; text lines of about 50 to 75 characters | Since 2026-10-12: shorter sentences, each rule a three-to-five-word heading with one or two sentences under it, three rules only, and the pop-up at the standard width (30rem) instead of the wide one (42rem), which gave lines of about 95 characters |
| Mexico's Federal Criminal Code, article 211 bis 1 | Punishes knowing, copying, changing or destroying information in a computer system protected by a security mechanism, **without authorization** | The notice and the sign-in in front of it make the authorization boundary explicit and recorded. The notice names no law, because who uses the server and from where can change; "under applicable law" covers that |

The sources are secondary summaries of the controls and laws, read on 2026-10-11 and
2026-10-12. The wording
follows common practice; it is not legal advice, and a lawyer in the relevant country should
review it before anyone relies on it in a dispute.

## 3. The words, and why each one is there

The text lives in one place, `src/lib/vps-notice.ts`, and the pop-up renders it from there. The
owner found the first version (2026-10-11) neither good looking nor well written; the second
(version `2026-10-12`) keeps every statement the research asks for and changes how they read and
look:

- **Shorter and plainer.** Shorter sentences and a tenth fewer words (183, from 202). Each rule is
  a short heading plus one or two sentences, and the three rules start differently, so a skim
  catches all three.
- **The owner on a card**, with his initials, his name, what he is to the server and his email
  address, instead of a long first sentence. Who owns the server is the first thing read.
- **An icon for each rule** (an eye, a gavel, a fingerprint) in a tile of the pop-up's warning
  colour, so the three rules read as three separate things.
- **Where to ask** in its own box, in the information colour.
- **The consent line beside the buttons**, in the foot, so the words and the act that accepts
  them are seen together (the *Berman* lesson in §2). The version is printed under it.
- **The standard width** (30rem): shorter lines, and the same look on a phone and a computer.

| Part | What it says | Why |
|---|---|---|
| Title | **Authorized access only** | The standard heading for such notices; the whole message in three words |
| Subtitle | You are about to open the server console. Please read this first. | Says why the pop-up is there and what to do with it |
| Owner card | The owner's name; "Developer and vendor. Owns, manages and pays for this server."; his email address as a link | Who owns it and pays for it, as the owner asked, and how to reach him |
| Opening | The server supports the hotel's platform; only people the owner has authorized may use it, and only for the work they were authorized to do | Who decides. "Only for the work they were authorized to do" covers going beyond a grant, not only having none |
| Rule 1 | **Activity is monitored and recorded.** It may be logged, reviewed and audited at any time; no expectation of privacy | AC-8 and the DoD banner. "May" is accurate: changes and terminals are recorded, reads are not |
| Rule 2 | **Unauthorized use is prohibited.** Access or changes without authorization, or beyond it, may lead to the loss of access and to civil or criminal action under applicable law; records may be shared with the authorities | The consequences the owner asked for, in the usual legal form |
| Rule 3 | **This answer is recorded.** The Audit Log keeps it with name, session, time, approximate location and device | Telling people what is recorded about them is both fair and what privacy law expects; it also makes the record harder to dispute |
| Help | Not sure you should be here? Choose Leave, then ask a portal administrator or the owner | The owner's "leave the page or request assistance" |
| Consent (in the foot) | By choosing "I agree" you confirm you are authorized to use this server and accept these terms, including the monitoring and recording of your activity | The explicit consent AC-8 and clickwrap practice ask for, tied to the button's own label and placed beside it |
| Buttons | **Leave** and **I agree** | Plain verbs. Leave has the focus when the pop-up opens, so a stray Enter never agrees |

Version `2026-10-11` is the first text: the same statements, as one long paragraph, three
bulleted points, a help line and a bold consent line inside the body. Its acceptances stay valid
for their sessions' answers in the Audit Log (each row names its version and fingerprint), but a
session that accepted it is asked again for `2026-10-12`.

## 4. How it works

```mermaid
flowchart TD
  A[Opens the Server page] --> B{Accepted this notice<br/>in this sign-in?}
  B -- yes --> C[Console loads in the page]
  B -- no --> D[Pop-up: Authorized access only]
  D -- I agree --> E[POST /api/vps/notice: accept]
  E --> F[Session remembers the version<br/>Audit Log: vps_notice_accept]
  F --> G[Page reloads] --> C
  D -- Leave --> H[POST /api/vps/notice: leave<br/>Audit Log: vps_notice_leave] --> I[Overview]
  D -- Escape or a press outside --> J[Pop-up closes, console stays shut<br/>Read the notice opens it again]
```

- **Once per sign-in.** An acceptance is kept in the session (`vpsNoticeVersion`), so it lasts
  until the session ends: signing out, the 24-hour limit, or a new sign-in. Everyone sees it,
  the owner and vendor support included.
- **The server decides, not the pop-up.** The Server page renders the console's frame only for
  a session that accepted the current version, and the gateway refuses to open the console
  without it too: a frame gets a short "accept the notice first" page and a tab opened straight
  at the console is sent to the Server page. The console's own calls are not held, because they
  come from a console that is already open.
- **A new text, a new acceptance.** Changing any word means a new `version`. An answer sent for
  an older version is refused, and everyone is asked again on their next visit.
- **A moment's lag is covered.** The session copy the portal keeps in memory can be up to five
  seconds old; when it says "not yet", the page and the gateway read the stored session itself
  before deciding.

## 5. What the Audit Log keeps

One row per answer: action `vps_notice_accept` or `vps_notice_leave`, module `vps`, target type
`vps_notice`, target id the version. Besides the person, role, time, request path and Ray ID
every row has:

| Field | What it holds |
|---|---|
| `session_id` column | The session's handle: the same one the Sessions page shows, never the session cookie |
| `ip_hash` column | The keyed hash of the sign-in address, as on every row |
| `notice` | The version and a SHA-256 fingerprint of the exact words |
| `page` | The Server page address they were opening |
| `person` | Their display name and how they signed in |
| `session` | When the session started and when they signed in |
| `location` | City, region, country, time zone, network provider and its number, and Cloudflare's data centre, all from Cloudflare's reading of the connection |
| `address` | A keyed hash of the address used for this answer, and whether it is the sign-in address |
| `device` | Phone or computer, browser, system, the browser's own platform and mobile hints, and the full user agent |
| `browserReported` | What the browser says about itself: its time zone, language and screen size. A value that fails its check is left out; it never blocks the answer |

The raw address is never stored in the Audit Log ([RoPA](../security/RoPA.md) §2.1); the sign-in
record of the same session holds it.

## 6. Limits and open points

- **A read-only role cannot accept.** The portal refuses every change from a read-only role
  before a route runs, and an answer is a change. Such a person sees the notice and cannot open
  the console. Today the Server page is for admins and above, so this needs a grant to a
  read-only person to matter.
- **Someone skilled can still call the console's API by hand** without accepting, since only
  pages are held. Every change made that way is still in the Audit Log, and going round the
  notice on purpose is itself evidence.
- **Browsers older than 2023** do not say whether a request opens a page, so the gateway does
  not hold them; the Server page still shows them the notice first.
- **English only**, like the rest of the portal. A Spanish version is a new version of the text,
  if the owner wants one.

## 7. Verification log

| Date | Checked by | Method | Result |
|---|---|---|---|
| 2026-10-11 | claude | Written with the code. `test/vps-notice.test.ts` (the route, the record, the acceptance check, which requests are held, the text), `test/vps-gateway.test.ts` (frames and tabs held until acceptance, console calls not held), `test/vps-page.test.ts` (one frame, in the accepted branch; the pop-up's choices) | Matches the code. Not yet seen on a phone (owner step); the research in §2 is from secondary sources |
| 2026-10-12 | claude | Rewritten and redesigned with the code (version `2026-10-12`): `src/lib/vps-notice.ts`, `src/components/admin/vps/ServerNotice.tsx`, `src/styles/pages/vps.css`; `test/vps-notice.test.ts` (the words, the owner, the rule icons) and `test/vps-page.test.ts` (the consent line in the foot above both buttons, an icon for every rule) pass. §2's two new rows from secondary sources read the same day | §1, §2 and §3 match the code. Not seen in a browser: the owner checks it on his phone. Not re-checked: §5 and §6, whose code did not change |
