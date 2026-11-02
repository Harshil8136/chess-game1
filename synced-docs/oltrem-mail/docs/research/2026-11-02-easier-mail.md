---
title: "Making mail easier: familiar, automatic and checked (2026-11-02)"
status: proposal
owner: vendor
last_verified: 2026-11-02
sources: [the owner's ask of 2026-11-02 13:33; Google's Gmail and Workspace announcements; Microsoft's Outlook support pages; Yahoo Mail's app notes; Cloudflare's Email Routing, Email Workers and DMARC Management documentation; Resend's SMTP documentation; the bulk-sender rules of Gmail, Yahoo and Microsoft; this repository's modules and docs as built on 2026-11-02]
---

# Making mail easier: familiar, automatic and checked

> **In plain words.** People already know how Gmail, Outlook and Yahoo work. The portal's mail
> should feel the same: swipe to archive, a tab for newsletters, snooze, an out-of-office reply,
> search that understands `from:`. Setup should finish by itself: the portal keeps checking until
> each step works, tells you when it does, and switches to a backup before anything fails. This
> page lists what to copy, what to automate and what to skip, each with what it costs on
> Cloudflare's free plan. Section 7 is a short order to build it in, for the owner's pick.

## 1. The ask, and how this page reads it

The owner asked (2026-11-02): make the process, the use and the workflow easier, with automatic
confirmation, fallbacks and verification, and with the standard ways of working everyone knows
from Gmail, Outlook and Yahoo. Read as three questions:

1. **Familiar.** Which habits from Gmail, Outlook and Yahoo should the portal's inbox, Write and
   campaigns copy, so staff need no training?
2. **Automatic.** Where does a person still press, wait or come back today, and how can the
   portal confirm, retry, fall back and check by itself?
3. **Use what people have.** Can staff keep using the Gmail or Outlook app they already have,
   alongside the portal?

Every proposal keeps the mail laws (ai.md section 3): never sent twice, Cloudflare's sending for
transactional mail only, never past a limit (10 ms of CPU, no KV writes), consent checked again
before each send.

## 2. What already runs by itself

So nothing is built twice: these are done and stay as they are.

| Already automatic | Where |
|---|---|
| Records written on Cloudflare, delivery reports registered by API, a backup provider, the SPF count, the placement test | the setup page (docs/setup.md) |
| A message goes once: a journal row first, the failover to the backup, a message with no clear answer kept on its route | the email module |
| Bounces, refusals and spam reports put on the do-not-mail list the moment they arrive | the email module |
| A campaign pauses itself on 0.3% complaints or 5% bounces, warms up a new domain, never passes a provider's allowance | the campaigns module |
| Unsubscribe in one press, three scopes, Mail me again | the campaigns module (phase 5) |
| Routing rules made again by the hourly job when a key was missing, health checks in words | the mail add-on |
| Undo on every sent email (ten seconds), send later, drafts, signatures, saved replies (letters) | Write, in the email module |

## 3. Familiar: what Gmail, Outlook and Yahoo taught everyone

What people know, where from, what the portal has today, and the proposal. "Cost" is on the free
plan: D1 rows written, CPU, and anything new.

### 3.1 The inbox

| Habit | Known from | Today | Proposal | Cost |
|---|---|---|---|---|
| **Swipe** a conversation left to archive, right to mark read | Gmail and Outlook on phones | tick boxes and a row of buttons | swipe on each row, with the same two actions and an Undo bar; ticks stay for many at once | page script only |
| **Undo bar** instead of "Are you sure?" | Gmail ("Conversation archived. Undo") | archive and spam are immediate; going back means opening Archived or Spam | every quick action shows "Archived. Undo" for ten seconds; only deleting a mailbox keeps its dialog | none |
| **A tab for newsletters and notifications** | Gmail's Promotions and Updates tabs, Outlook's Focused and Other | one Inbox | mail with `List-Unsubscribe`, `List-Id` or `Precedence: bulk` arrives under **Updates**; people's mail stays in **Inbox**; a sender can be moved either way once, and the portal remembers | one column on the conversation, read at arrival |
| **Unsubscribe** from a newsletter that arrived | Gmail's Unsubscribe beside the sender, and its Manage subscriptions view (July 2025) | not offered | an **Unsubscribe** button on any message with one-click headers (RFC 8058: the portal sends the POST for you), and a **Subscriptions** view: senders by how often they write, one press each | one outside call per press |
| **Snooze** until a time | Gmail, Outlook | not offered | **Snooze**: later today, tomorrow morning, next week, a date; it comes back to the top, unread | one row; the hourly job wakes them |
| **Mute** a conversation | Gmail's Mute, Outlook's Ignore | not offered | **Mute**: new replies in it skip the inbox | one column |
| **Sweep** a sender | Outlook's Sweep | block a sender (drops all their mail) | **Sweep**: archive all from this sender, keep only the latest, or archive what is older than 10 days, now and from then on (a rule made for you) | rules already exist |
| **Search words** | Gmail's `from:`, `to:`, `subject:`, `has:attachment`, `is:unread`, `before:`, `after:`, `in:` | words only | the same words, with chips under the search box that write them for you on a phone | none: the index already holds the fields |
| **Contacts suggested** as you type | every mail app | type the address | addresses already mailed or received from are suggested in To, Cc and the reply | read only |

### 3.2 Answering

| Habit | Known from | Today | Proposal | Cost |
|---|---|---|---|---|
| **Out of office** and "we got your message" | Gmail's Vacation responder, Outlook's Automatic replies | not offered | an **Automatic reply** per mailbox, on or between two dates, sent once per sender every four days, never to lists or no-reply senders | free: Cloudflare's `message.reply()` in the same delivery (below) |
| **Saved replies** in the reply box | Gmail templates, Outlook Quick Parts | letters exist in Write only | a **Saved replies** chip row above the reply box, from the same letters | none |
| **Follow-up nudge** | Gmail's nudges | not offered | a conversation where the portal answered and heard nothing for three days rises with "No answer yet", once | the hourly job |
| **Undo send** for longer | Gmail lets you pick 5 to 30 seconds | ten seconds, fixed | an Owner setting, 5 to 30 seconds | one setting |

Automatic replies through Cloudflare (read 2026-11-02 in Cloudflare's Email Workers reference):
`message.reply()` answers inside the same delivery, threaded with the original. Cloudflare allows
it only when the incoming mail has a valid DMARC result, once per message, to the sender only,
from the domain that received it, and not past 100 `References` entries. That is exactly an
out-of-office's shape, and it needs no provider and no send allowance. Whether it works on the
Workers Free plan is to be confirmed in a live test before it is promised.

### 3.3 Campaigns and lists

| Habit | Known from | Today | Proposal | Cost |
|---|---|---|---|---|
| **"Did you mean gmail.com?"** | sign-up forms everywhere | an import refuses bad syntax only | an import lists likely typos (`gmial.com`, `hotmial.com`, `yaho.com`) with one press to fix them all, before anyone is mailed | none |
| **Addresses that cannot receive mail** | list cleaners | found only when they bounce | each new domain of an import is looked up once over DNS for its mail servers; a domain with none is flagged before sending | one DNS question per new domain, kept a month in D1 |
| **Role addresses** (`info@`, `noreply@`) | list cleaners | mailed like anyone | flagged on import; a no-reply address is left out of campaigns | none |

## 4. Automatic: confirm, fall back, verify

### 4.1 Confirming by itself

| Where a person waits today | Proposal |
|---|---|
| A domain's records: "check now, then daily" | checked again after 1, 2, 5, 15 and 30 minutes, then hourly for a day, then daily; the moment they pass, the provider's verify is called and the person is told on the Home page and by email, so nobody comes back to press **Check** |
| A forwarding address at Cloudflare must be confirmed from its own inbox | the page says so once, then watches the address's state; it offers **Send again** only if it is still waiting after ten minutes, and turns the forward on by itself when it is confirmed |
| A provider's sender address (Brevo asks some to be confirmed) | read from the provider until confirmed, then used by itself; until then the route says why in words |
| Email Routing turned on, but a mailbox's rule could not be made | already retried hourly; the proposal adds the same short backoff as the records, so a fixed key works within minutes |

### 4.2 Falling back

| Risk | Today | Proposal |
|---|---|---|
| A provider's allowance runs out mid-day | sending waits until it resets | at 90% of the main provider's known daily allowance, everyday mail moves to the backup by itself; campaigns still wait, so a backup's free allowance is not spent on bulk mail |
| The inbox cannot store a message | the message is refused for now, so the sender's server tries again later | the forwarding copy goes first, when one is set, so a person still has the message; then the temporary refusal (Cloudflare turns an unhandled error into a temporary failure, per third-party reports; to be confirmed in a live test) |
| A domain has no DMARC record | the page says it is needed | **Add it**: the portal writes `p=none` with reports to Cloudflare's DMARC Management, in the same press as the other records |

### 4.3 Verifying by itself

| Check | Proposal |
|---|---|
| **Ready for Gmail, Yahoo and Outlook** | one line per sending domain that says whether it meets the three big mailbox providers' rules, from what the portal already knows: SPF and DKIM pass, DMARC exists and aligns, one-click unsubscribe on bulk mail, complaints under 0.3%. Gmail and Yahoo set these rules for bulk senders in February 2024; Microsoft did the same for Outlook.com, Hotmail and Live from May 2025 above 5,000 messages a day. The line links to Gmail's own Postmaster Tools compliance page for the owner to compare |
| **DMARC reports** | Cloudflare's DMARC Management (in beta, read 2026-11-02) collects the reports when its address is in the record; the portal links there. No public API was found, so the portal does not read them yet |
| **Placement test** | already built; the proposal runs it again by itself after any change of provider or records, and the result lands on Home |
| **Errors, flags and logs** | every new check reports to the kit's health checks and issue log in one line with its fix, as the rest of mail does |

## 5. Using the apps people already have

| Wish | Possible? | Proposal |
|---|---|---|
| Read the portal's mailbox in the Gmail or Outlook app | **Partly.** A Worker cannot listen for IMAP connections, so the portal can never be a mail server an app signs in to | the forwarding copy already sends each message to a staff address; keep it as the way to read in another app |
| Reply from Gmail or Outlook **as** `hello@` the business | **Yes**, with the provider the portal already uses: Gmail's "Send mail as" and Outlook's "send from another address" accept an SMTP server, and Brevo and Resend both offer one (Resend: `smtp.resend.com`, user `resend`, the key as the password) | a **Use in Gmail or Outlook** card per mailbox: the exact settings with Copy buttons, the steps in words, and a test once it is set up. A key just for this, with sending rights only, is made at the provider by the owner (R-05: by name only) |
| Sign in with a Google or Microsoft account | **Yes**, in the kit: Cloudflare Access already accepts both | the kit's thread, not mail |

## 6. What this page recommends not doing

| Idea | Why not |
|---|---|
| An IMAP or POP server | Workers cannot accept those connections; the forwarding copy and "Send mail as" cover the need |
| AI replies and summaries | Workers AI has a free daily allowance, but every reply would need a person's check anyway; later, as an option, once the rest is in |
| BIMI, the brand logo beside the sender | needs a paid mark certificate (VMC or CMC) and a trademark; a client can add it by hand |
| Reading Gmail's Postmaster Tools by API | its API was being replaced in 2025 and no stable successor was confirmed; linking to the page is enough |
| A "Focused" inbox decided by a guess | Gmail and Outlook use their own learning; headers (`List-Id`, `List-Unsubscribe`) are certain and cost nothing, and a person can move a sender once |

## 7. A short order to build it in

Each bundle is one push, tested and documented, in the order that saves the most repeated work
first.

| Bundle | What | Why first or later |
|---|---|---|
| **C. Sets itself up and checks itself** | the short backoff checks with a message when done, the forwarding address watched, the DMARC record in one press, "Ready for Gmail, Yahoo and Outlook", the placement test run again by itself, the allowance fallback, the safety copy first | removes the owner's and the client's repeated presses during setup, and protects every message that follows |
| **A. A familiar inbox** | swipe, the Undo bar, Updates, Unsubscribe and Subscriptions, Snooze, Mute, Sweep, search words and their chips, suggested contacts | the staff's daily use; no training |
| **B. Answers by itself** | automatic replies, saved replies in the reply box, follow-up nudges, the Undo send setting | saves the most typing once mail flows |
| **L. Cleaner lists** | typo fixes, mail-server checks and role addresses on import | fewer bounces, so fewer pauses |
| **G. Gmail and Outlook as well** | the "Use in Gmail or Outlook" card with its test | for staff who live in another app |

Not checked yet: a live Cloudflare account for `message.reply()` on the free plan and for how
Email Routing treats a Worker's error, and live Brevo and Resend accounts for their SMTP settings
in Gmail's form. Each bundle's first push checks its own on a live account before it is promised.

Built so far (the owner chose all five, in this order, on 2026-11-02): bundle C, as
[its record](../records/2026-11-02-sets-itself-up.md) says. Two parts changed in the building:
"a message when done" is the domain's line and System health's warning when it is stuck, rather
than an email of its own; and the placement test is not re-run by itself, since a person has to
look where the message landed.

Bundle A followed, as [its record](../records/2026-11-02-familiar-inbox.md) says. Suggested
contacts were already on Write (its To field offers recent recipients), so nothing was added
there; a search looks in every box, so its chips narrow rather than widen.

Bundle B followed, as [its record](../records/2026-11-02-answers-by-itself.md) says. The automatic
reply goes through the provider route (email's send), not Cloudflare's `message.reply()`, whose
free-plan behaviour is not confirmed; so it carries the journal, consent and the allowance, and
its loops are stopped by the skip rules and the four days rather than by a header.
