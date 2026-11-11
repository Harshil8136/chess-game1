---
title: "Making Email feel like Gmail, without copying Gmail (2026-11-11)"
status: active
owner: vendor
last_verified: 2026-11-11
sources: [Gmail Help and Google Workspace help pages, 9to5Google, TechCrunch, Material 3 tokens (Flutter gen_defaults), Cloudflare docs (Workers, D1, R2, KV, Queues, Email Routing, Email Service, GraphQL Analytics), the email providers' pricing pages, the open-source projects' LICENSE files and npm, all read 2026-11-11; links beside each fact]
---

# Making Email feel like Gmail, without copying Gmail

> **In plain words.** The owner asked (2026-11-11) for Email to work like Gmail for anyone coming
> from it: the same sections, features and look, with each resource's use shown in words a
> non-technical client understands. This page is what was found: Gmail's layout and shortcuts,
> the features a Gmail user expects, which open-source projects may be reused and how, how the big
> products show storage and quotas, and the free plans' limits today. What was built from it is in
> [the record](../records/2026-11-11-gmail-style-email.md).

Prepared 2026-11-11. Web research only. No personal data is included.

**How to read the confidence marks**

- **[doc]**: stated by an official page, linked next to the fact.
- **[press]**: reported by press or a third party, linked.
- **[obs]**: approximate values remembered from Gmail's rendered page, **not documented by Google and not
  re-checked in this session**. No browser was opened, per the repository rules. Treat each one as a
  starting value to tune, never as a specification.
- **not found**: searched for and not found.

Copying boundary: Gmail's layout ideas, interaction patterns and keyboard map are not protectable branding.
The Gmail name, the "M" logo, Google's product icons and the Google Sans font are. Use our own name, our own
icon set (Lucide, ISC) and a free font (for example Inter or Roboto Flex). The M3 tokens below are Google's
**public design system**, Apache-2.0 in its code form (`@material/web`), and they are safe to use as values.

---

## 1. Gmail's current web layout (Material 3 / "Gmail redesign", 2022 to today)

### 1.1 What is documented or reported

| Element | Fact | Source |
|---|---|---|
| Overall | The 2022 redesign put Mail, Chat, Spaces and Meet in one narrow **app rail** at the far left. Beside it is a collapsible **navigation panel** that you pin open with the hamburger or hide. With the panel hidden, hovering a rail icon opens the panel as a floating overlay. Users report opening it by accident when aiming at the checkboxes. | [press] [9to5Google hands-on](https://9to5google.com/2022/03/02/new-gmail-view-hands-on/) |
| Background | The white background became a faint light blue in several shades. The left navigation is slightly darker than the rest. **Read rows are tinted and unread rows stay white.** | [press] [9to5Google, Material You on web](https://9to5google.com/2022/06/28/gmail-web-material-you-classic/) |
| Compose button | Rounded rectangle, no longer a pill. It matches the Android Compose FAB. Font is Google Sans. | [press] same article; [9to5Google hands-on](https://9to5google.com/2022/07/02/gmail-material-you-hands-on/) |
| Search chips | Filter chips such as **Has attachment** and **Is unread** now appear right in the inbox, not only after a search. | [press] [TechCrunch 2022-07-28](https://techcrunch.com/2022/07/28/gmail-rolls-out-its-latest-material-you-redesign-and-search-improvements-to-all-users/) |
| Chips after a search | Chips below the search box filter by sender, date range, attachments, unread and more. | [doc] [Gmail Help: How to search](https://support.google.com/mail/answer/6593) |
| Advanced search panel | Opened from the options icon in the search box. Fields: **From, To, Subject, Has the words, Doesn't have, Size, Date within, Search** (a label, Spam or Trash), **Has attachment**, then buttons **Create filter** and **Search**. Spam and Trash are left out of a normal search. | [doc] [answer/6593](https://support.google.com/mail/answer/6593) |
| Quick settings | A right-hand sidebar holding Theme, Density, **Inbox type** (Default, Important first, Unread first, Starred first, Priority Inbox, Multiple inboxes) and **Reading pane** (No split, Right of inbox, Below inbox). Conversation view and Apps are also there; those two items are [obs]. | [doc] [answer/9259769](https://support.google.com/mail/answer/9259769?hl=en-GB) |
| Density | **Default, Comfortable, Compact.** Default also previews attachments (chips) in the list. | [doc] [Workspace user help 9696522](https://support.google.com/a/users/answer/9696522?hl=en) |
| Category tabs | Default inbox type, five tabs: **Primary, Promotions, Social, Updates, Forums**. You can hide them but cannot create new ones. | [doc] [answer/3055016](https://support.google.com/mail/answer/3055016) |
| Hover actions | Hovering the right end of a row shows **Archive, Delete, Mark as read, Snooze**. This can be turned off in Settings. | [doc] [answer/2473038](https://support.google.com/mail/answer/2473038?hl=en); [press] [9to5Google 2018](https://9to5google.com/2018/04/25/google-gmail-web-new-launch/) |
| Toolbar | Archive, Report spam, Delete, Mark as unread, Move to, plus **More**: Snooze, Add to Tasks, Label as, Forward as attachment, **Filter messages like these**, Mute. Right-clicking a row gives Reply, Reply all, Forward and "Find emails from". | [doc] [answer/2473038](https://support.google.com/mail/answer/2473038?hl=en) |
| Select all beyond one page | Tick the master checkbox and a banner offers **"Select all conversations in Inbox"**, or **"Select all conversations that match this search"** for a search. | [press] [Mailmeteor guide](https://mailmeteor.com/blog/how-to-select-all-in-gmail) |
| Storage indicator | One sits at the very bottom of the page. A second is a pill at the bottom of the account menu, worded like **"3% of 2 TB used"** with a cloud icon. Both open the storage page. | [press] [9to5Google 2024-09-27](https://9to5google.com/2024/09/27/gmail-storage-indicator/); footer wording "X GB of 15 GB used" from [Inbox Zero blog](https://www.getinboxzero.com/blog/post/gmail-running-out-of-space) |

### 1.2 Material 3 tokens that Gmail's look derives from [doc]

These are the M3 component tokens as published in Flutter's generated defaults
([navigation_drawer.json](https://flutter.googlesource.com/mirrors/flutter/+/HEAD/dev/tools/gen_defaults/data/navigation_drawer.json)):

- Navigation drawer: container width **360**, active indicator **56 high by 336 wide**, shape `corner.full` (a pill),
  colour `secondaryContainer`.
- Label colours: active is `onSecondaryContainer`; inactive is `onSurfaceVariant`, turning `onSurface` on hover or focus.
- Icon: **24**.

Gmail deliberately **departs** from these values on desktop: its rows are shorter and its active pill is
flat on the left (see 1.3). Our build should follow Gmail's proportions, not the generic M3 drawer.

### 1.3 Gmail's own proportions [obs, not documented]

Measure these against a real desktop Gmail before you freeze them.

| Part | Approximate value |
|---|---|
| Page background | `#f6f8fc`. The list sits in a white card with a radius of about 16 px. |
| Navigation panel | Expanded about **256 px**. Collapsed icon rail about **72 px**. In the integrated view a separate app rail of about 68 px sits further left. |
| Compose button | About 56 px high, radius about 16 px, fill `#c2e7ff`, text and icon `#001d35`, pencil icon plus "Compose", 14 px at weight 500. |
| Folder row | About **32 px** high, 14 px text, icon 20 px. **Active row: pill rounded only on the right** (`border-radius: 0 16px 16px 0`), running flush to the panel's left edge, with about 16 px of right margin. Active fill about `#d3e3fd`. The active row and unread labels are bold. The unread count is right-aligned and bold. Hover fill is a light grey overlay. |
| Collapsing | Below the core folders, a **"More"** row expands to the rest (Important, Chats, Scheduled, All Mail, Spam, Trash, Categories, Manage labels, Create new label) and then reads **"Less"**. The **"Labels"** heading has a **"+"** button to create a label. Each label shows a coloured tag or dot icon and a three-dot menu on hover (label colour, edit, remove, "show in label list", "show in message list"). |
| Search bar | A pill about 48 px high, fill about `#eaf1fb`, turning white with a shadow on focus. It holds a search icon on the left, a "Search mail" placeholder and a filter (options) icon on the right that opens the advanced panel. Maximum width is about 720 px. Status, help, settings and the apps grid are to its right. |
| List toolbar | Master checkbox with a ▾ menu (**All, None, Read, Unread, Starred, Unstarred**), then Refresh and the three-dot More menu. When rows are selected, these become the action icons. Pagination sits on the right: **"1–50 of 2,345"** with ‹ ›, or "1–50 of many" when the total is unknown. |
| Category tabs | About 56 px high and equal width, each with an icon and a name. The active tab has a coloured bottom bar about 3 px tall and coloured text. Inactive tabs can show a small coloured **"N new"** chip and a one-line preview of recent senders. Older designs gave each tab its own colour (Primary red, Social blue, Promotions green, Updates orange, Forums purple); the current M3 colours were not verified. |
| Row anatomy | Left to right: drag handle (on hover), checkbox, star, the important marker (a chevron, shown when the setting is on), sender (about 200 px wide, bold when unread, then "me", "2" for thread counts and so on), **subject bold when unread, then " – " and a grey snippet**, label chips (small rounded tags in the label's colour) before the subject, and the date on the right (bold when unread; time today, otherwise "Nov 3", then "3/11/24" in earlier years). In Default density a second line carries **attachment chips** (file icon and name pill, about 32 px high). |
| Row heights | Compact about 32 px, Comfortable and Default about 40 px (Default plus the chip line). Unread rows are white; read rows have a faint blue-grey tint (about `#f2f6fc`). Selected rows are about `#c2dbff`. Hover raises the row with a thin shadow and **swaps the date for the hover actions**. |
| Reading pane | Settings decide No split, Right of inbox or Below inbox; a split view adds a draggable divider. The conversation view shows the subject heading with label chips. Messages are stacked cards: older ones collapse to one line (sender, snippet, date), and "N older messages" folds the middle of a long thread. Each message has Reply, Forward and a ⋮ menu on its header; Reply, Reply all and Forward buttons sit at the bottom of the thread. |
| Colour family | Primary `#0b57d0`, `onSurface` `#1f1f1f`, `onSurfaceVariant` `#444746`, outline `#747775`, surface containers `#e9eef6` and `#f8fafd`. These are Google's own Workspace values, not M3's purple baseline. |

**Not found:** any official Google specification of Gmail's pixel sizes or hex colours. The press articles fetched
explicitly do not give them.

---

## 2. Keyboard shortcuts [doc]

Source: [Gmail Help, answer/6594](https://support.google.com/mail/answer/6594?hl=en).

**How to enable them:** Settings (gear) → **See all settings** → **General** → **Keyboard shortcuts on** → Save Changes.
Most single-key shortcuts need this setting; Ctrl/⌘+Enter (send) works without it. **Shift+/** (`?`) opens the
help sheet, and inside it Tab then Enter toggles the setting.

| Key | Action | Key | Action |
|---|---|---|---|
| `c` | Compose | `d` | Compose in a new tab |
| `/` | Search mail | `?` | Shortcut help |
| `j` / `k` | Older / newer conversation | `n` / `p` | Next / previous message inside a thread |
| `o` or `Enter` | Open | `u` | Back to the list |
| `e` | Archive | `#` | Delete |
| `!` | Report spam | `m` | Mute |
| `x` | Select conversation | `s` | Star (cycles through the star types) |
| `r` / `a` / `f` | Reply / reply all / forward | `Shift`+`r`/`a`/`f` | The same, in a new window |
| `Shift+i` / `Shift+u` | Mark read / unread | `_` | Mark unread from the selected message on |
| `+` or `=` / `-` | Mark important / not important | `b` | Snooze |
| `z` | Undo last action | `[` / `]` | Archive and go to the previous / next conversation |
| `;` / `:` | Expand / collapse the whole conversation | `Shift+n` | Update conversation |
| `l` | "Label as" menu | `v` | "Move to" menu |
| `.` | "More actions" menu | `,` | Focus the toolbar |
| `g i` / `g s` / `g b` | Go to Inbox / Starred / Snoozed | `g t` / `g d` / `g a` | Go to Sent / Drafts / All mail |
| `g l` | Go to a label | `g n` / `g p` | Next / previous page |
| `*` `a` / `*` `n` | Select all / none | `*` `r`/`u`/`s`/`t` | Select read / unread / starred / unstarred |
| `` ` `` / `~` | Next / previous inbox section | `Ctrl/⌘+Enter` | Send |
| `Esc` / `Shift+Esc` | Focus compose or chat / the main window | `Shift+t` | Add to Tasks |

`y` and `g c` are **not on the current page** (they are retired). For our build, a hidden `?` sheet plus a
"Keyboard shortcuts on/off" setting **off by default** matches Gmail. Two-key sequences (`g` then `i`, `*` then
`a`) need a sequence-capable handler; tinykeys supports them (section 4).

---

## 3. Features a Gmail user expects

| Feature | Gmail behaviour | Source |
|---|---|---|
| Labels | Labels are not folders: one message can carry many. They can be **nested** ("Nest label under"), given a colour (presets or custom) and shown or hidden in the label list. Limits: **5,000 labels, 100 custom colours**. Create with the "+" next to Labels. | [doc] [answer/118708](https://support.google.com/mail/answer/118708?hl=en) |
| Stars | Click the star repeatedly to cycle through the star types in use: yellow, orange, red, purple, blue and green stars, plus red bang, orange guillemet, yellow bang, green check, blue info and purple question. Presets are 1 star, 4 stars or all stars. Search with `is:starred` and `has:yellow-star` and so on. | [doc] [answer/5904](https://support.google.com/mail/answer/5904?hl=en) (full icon list [obs]) |
| Important markers | Yellow chevron, toggled with `+` and `-`; search `is:important`. | [doc] answer/6594, answer/7190 |
| Inbox types | Default (5 tabs); Important first, Unread first, Starred first (2 sections each, the second being "Everything else"); **Priority Inbox** (Important and unread, Starred, Everything else); **Multiple inboxes** (up to 5 label-based sections). | [doc] [Google blog: inbox types](https://blog.google/products/gmail/gmail-inbox-types/) |
| Filters | Created from the advanced search panel ("Create filter") or More → **"Filter messages like these"**. Actions include skip the inbox, mark read, star, apply label, forward, delete, never spam, always important, categorize and **Send template**. | [doc] answer/6593, answer/2473038, [answer/14864208](https://support.google.com/mail/answer/14864208?hl=en) |
| Templates | Enabled under Settings → **Advanced** → Templates. In compose, More options → Templates → "Save draft as template" or "Insert template". A template can be an automatic reply only through a filter. No count limit is stated. | [doc] [answer/14864208](https://support.google.com/mail/answer/14864208?hl=en) |
| Undo send | A toast at the bottom left reads **"Message sent"** with **Undo** and **View message**. The window can be 5, 10, 20 or 30 s (Settings → Undo Send). The default is not stated on that page. | [doc] [answer/2645922](https://support.google.com/mail/answer/2645922?hl=en) |
| Schedule send | Up to **100 scheduled emails**, kept in a "Scheduled" folder. "Cancel send" turns one back into a draft. Mail can go out a few minutes late and follows the time zone chosen. | [doc] [answer/9214606](https://support.google.com/mail/answer/9214606?hl=en) |
| Snooze | Presets (later today, tomorrow, this weekend, next week) or a custom date and time. Snoozed mail goes to "Snoozed" and returns to the top of the inbox. Shortcut `b`; search `in:snoozed`. | [press] 9to5Google 2018; [doc] answer/7190 |
| Nudges | "Received 3 days ago. Reply?" and "Sent 5 days ago. Follow up?" Each can be switched off in Settings. | [press] [9to5Google 2018](https://9to5google.com/2018/04/25/google-gmail-web-new-launch/) |
| Confidential mode | Lock icon in the compose bottom bar. It blocks forward, copy, download and print, and adds an expiry and an optional SMS passcode. It is enforced by Google's own viewer: other providers' recipients get a link, not the message. | [press] same article |
| Smart Reply / Smart Compose | Suggested short replies under a message, and grey inline completion while typing. | [press] same article (details not found) |
| Archive vs Delete | Archive removes the Inbox label; the mail stays in All Mail and searchable. Delete moves it to Trash. | [doc] answer/7401 |
| Trash | **30 days**, then gone for good. Actions: "Delete forever" and **"Empty Trash now"**. Deleted drafts cannot be recovered. | [doc] [answer/7401](https://support.google.com/mail/answer/7401) |
| Spam | "Report spam" (`!`), with Unsubscribe offered for senders you subscribed to, and "Delete all spam messages now". The 30-day auto-deletion is widely known, but the help page fetched (answer/6602) **does not state it**. | [doc] [answer/6602](https://support.google.com/mail/answer/6602) |
| Search operators | `from: to: cc: bcc: subject: after: before: older_than: newer_than: OR {} AND - AROUND label: category: has:attachment has:drive filename: "" in:anywhere in:snoozed is:muted is:important is:starred is:unread is:read list: size: larger: smaller: deliveredto: has:userlabels has:nouserlabels rfc822msgid: has:<star>` | [doc] [answer/7190](https://support.google.com/mail/answer/7190) |
| Mark as read in bulk | Master checkbox, then "Select all conversations in …", then Mark as read. | [press] Mailmeteor |
| Vacation responder, signatures, Send & Archive | Settings → General: vacation responder (dates, subject, message, "only send to people in my contacts"); several signatures with defaults for new mail and replies; "Show 'Send & Archive' button in reply". | Details [obs]; official pages not fetched in this session |
| Storage meter | See section 5. | — |

---

## 4. Open-source projects and libraries: licence and reuse

Licences were read directly from each repository's LICENSE file (raw.githubusercontent.com) or from the npm
registry `license` field, on 2026-11-11. "Code reuse in a proprietary product": **yes** means a permissive
licence, so keep the copyright notice; **ideas only** means a copyleft licence, so do not copy, adapt or translate
the code.

### 4.1 Webmail and mail-client UIs

| Project | Licence (SPDX) | What it is | Code reuse |
|---|---|---|---|
| Zero (`Mail-0/Zero`) | **MIT** | Next.js, React, Tailwind and shadcn "open-source Gmail alternative"; the closest modern Gmail-like UI | **Yes**, with notice. Its React/shadcn code does not fit server-rendered Preact as is; use it mostly for layout and interaction ideas. |
| Inbox Zero (`elie222/inbox-zero`) | **AGPL-3.0** | AI inbox triage | **Ideas only, no code** |
| Roundcube (Elastic skin) (`roundcube/roundcubemail`) | **GPL-3.0-or-later** with an exception for skins and plugins that only call Roundcube | Classic PHP webmail; Elastic is its responsive skin | **Ideas only, no code** (the exception covers Roundcube plugins, not reuse elsewhere) |
| SnappyMail (`the-djmaze/snappymail`) | **AGPL-3.0** | Lightweight RainLoop fork | **Ideas only, no code** |
| Cypht (`cypht-org/cypht`) | **LGPL-2.1** | PHP aggregating webmail | **Ideas only**. LGPL is weak copyleft; copying its PHP or CSS into our code would carry obligations. |
| Mailspring (`Foundry376/Mailspring`) | **GPL-3.0** | Electron desktop client | **Ideas only, no code** |
| Fastmail Overture (`fastmail/overture`) | **MIT** | Fastmail's JS UI library | Yes, with notice |
| JMAP demo webmail (`jmapio/jmap-demo-webmail`) | **MIT** | Fastmail's demo webmail | Yes, with notice |
| Thunderbird for Android (`thunderbird/thunderbird-android`) | **Apache-2.0** | Kotlin app (formerly K-9) | Yes, but it is a different stack; ideas such as swipe and unified inbox |
| Tuta (`tutao/tutanota`) | **GPL-3.0** | Encrypted mail | **Ideas only, no code** |
| Proton (`ProtonMail/WebClients`) | **GPL-3.0** | Proton Mail web | **Ideas only, no code** |
| Nextcloud Mail (`nextcloud/mail`) | **AGPL-3.0** | Vue webmail | **Ideas only, no code** |

### 4.2 Small libraries that suit Workers or server-rendered Preact

| Library | Licence | Latest version on npm (2026-11-11) | Note |
|---|---|---|---|
| `postal-mime` | **MIT-0** | 4.2.1 | MIME parser for browsers and Workers (no Node APIs), used in Cloudflare's Email Workers examples. MIT-0 needs no attribution. |
| `mimetext` | **MIT** | 3.0.28 | Builds RFC 5322 messages, attachments included. |
| `tinykeys` | **MIT** | 4.0.1 | About 1 KB; supports sequences such as `g i`. |
| `lucide` / `lucide-preact` | **ISC** | 1.72.0 | Icons with an outline style close to Material Symbols, without being Google's. |
| `@material/web` | **Apache-2.0** | 2.5.0 | Google's M3 web components; useful as a **token reference**. They are Lit web components, not suited to server-rendered Preact. |
| `mjml` | **MIT** | 5.4.1 | Responsive email markup. It is heavy, so not for runtime on Workers. |
| `mailparser` | **MIT** | 3.14.3 | Needs Node streams; **prefer postal-mime** on Workers. |
| `dompurify` | **MPL-2.0 OR Apache-2.0** | 3.4.17 | Needs a DOM; **on Workers use the built-in `HTMLRewriter`** to sanitize instead. |

Kit rule R-09 still applies: a new dependency needs a registered reason and the owner's yes.

---

## 5. Showing usage and quotas to non-technical people

### 5.1 What the big products do

- **Google, the shared quota.** "Up to 15 GB of storage, which is shared across Gmail, Google Drive, and Google
  Photos." **Spam and Trash count.** Over quota, Gmail sending and receiving "can be impacted"; after **2 years**
  over quota, content "may be removed", with at least 3 months' notice. [doc] [answer/9312312](https://support.google.com/mail/answer/9312312)
- **Google, the wording.** "X GB of 15 GB used" in the Gmail footer, and "3% of 2 TB used" on a pill in the account
  menu. [press] [9to5Google](https://9to5google.com/2024/09/27/gmail-storage-indicator/)
- **Google One, the storage page.** One stacked bar coloured by service. A banner, "Get your space back", has the
  button "Free up account storage". Clean-up groups: discarded items (deleted mail, spam), large items (emails with
  large attachments, large files, large photos) and so on. [press] [Chrome Unboxed](https://chromeunboxed.com/google-one-storage-manager-tutorial)
- **Google, the help text.** It suggests searches such as `has:attachment larger:10M` and `older_than:2y has:attachment`,
  and warns that usage can take **48 to 72 hours** to update. [doc] [answer/6374270](https://support.google.com/mail/answer/6374270?hl=en)
- **Google, the thresholds.** **80 %: yellow "Storage low"**; **100 %: red "Storage full"**; some shared-drive
  roles see red at 90 %. This is a university write-up of Google's banners. [press] [Stanford UIT](https://uit.stanford.edu/project/google-workspace-optimization/understanding-google-storage-limit-alerts)
- **Fastmail.** Usage sits **at the bottom of the sidebar**. An automatic email goes out "if you get close to your
  storage quota limit". Over quota, incoming mail is **soft-bounced (4xx)**, and after **a week** it is hard-bounced
  (5xx). [doc] [Fastmail account limits](https://www.fastmail.help/hc/en-us/articles/1500000277382-Account-limits)
- **Zoho Mail.** Storage is shown per account and per folder (Settings → Folders → Size). The admin columns read
  "Allotted" and "Used Storage". When full, "incoming emails to the accounts are blocked" until the user frees space
  and clicks UnblockMe. [doc] [Zoho mailbox quota](https://www.zoho.com/mail/help/mailbox-quota.html)
- **Resend.** A Usage page shows the current month's usage, the domain count and the inbox count. The daily quota
  resets at **midnight UTC**, and **every To, Cc and Bcc recipient counts**, as do received emails. Keep bounces
  under 4 % and complaints under 0.08 %. [doc] [Resend quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits)
- **Adobe Spectrum's meter, a design rule.** Variants are informative (blue), **positive (green: plenty left)**,
  **notice (orange: limited)** and **negative (red: urgent)**. Always show a label (top left) and a value label
  (top right, never truncated), and never rely on colour alone (WCAG 1.4.1). Use a meter when the user's actions
  drive the value. [doc] [Spectrum Meter](https://spectrum.adobe.com/page/meter)

### 5.2 Recommended pattern for Oltrem (derived, not sourced)

- **One sentence and one bar per resource**, Gmail-style: "**2.1 GB of 10 GB used**". Add a plain translation
  under it: "Room for about **4,000 more emails with photos**." Divide what is free by a measured average size;
  never use a guessed constant (R-10).
- **Daily allowances say when they reset**: "**37 of 100 emails sent today**. Resets at 6:00 pm your time", which is
  midnight UTC converted.
- **Colour steps**: neutral below 70 %, **amber from 70 to 80 %** ("Getting full"), **red from 90 %** ("Almost full;
  sending will pause at 100 %"). Google itself uses 80 % (yellow) and 100 % (red). Always pair the colour with words
  and an icon.
- **Every warning offers a fix**: "Empty Trash (310 MB)", "Find large emails" (pre-filled `larger:10M` search),
  "Delete mail older than 2 years".
- **Say what happens at 100 % in plain words**, as Fastmail and Zoho do: "New mail will be held, not lost, for up
  to N days" or "Sending stops until tomorrow".

---

## 6. Free-plan limits in effect now

### 6.1 Cloudflare [doc]

| Product | Workers Free | Source |
|---|---|---|
| Workers | **100,000 requests/day**, reset at midnight UTC (error 1027 after); **10 ms CPU** per HTTP invocation and per cron run; 50 subrequests (1,000 to Cloudflare services); 128 MB memory; 64 MiB Worker size; 5 cron triggers per account | [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) |
| D1 | **5 million rows read/day, 100,000 rows written/day**, reset 00:00 UTC; **500 MB per database**; **5 GB per account**; 10 databases; **50 queries per invocation**; 2 MB per row, string or BLOB; 100 KB per statement; 100 bound parameters | [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| R2 | **10 GB-month storage**, **1 M Class A/month**, **10 M Class B/month**, **free egress**. Standard storage only; Infrequent Access is not in the free tier. Class A covers PutObject, ListObjects, CopyObject and multipart uploads; Class B covers GetObject and HeadObject; DeleteObject is free. | [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| KV | 100,000 reads/day, **1,000 writes/day**, 1,000 deletes/day, 1,000 lists/day, 1 GB stored | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| Queues | **10,000 operations/day** (read, write and delete); 10,000 queues; **24-hour retention**, not configurable. On the free plan since 2026-02-04. | [changelog](https://developers.cloudflare.com/changelog/post/2026-02-04-queues-free-plan/) |
| Email Routing (inbound) | **Unlimited** on Free; **200 rules**, **200 destination addresses**; messages up to **25 MiB**; an Email Worker on Free "may exceed its CPU or memory allocation" | [Email Routing limits](https://developers.cloudflare.com/email-routing/limits/), [Email Service pricing](https://developers.cloudflare.com/email-service/platform/pricing/) |
| Email Service (sending) | **Not available on Workers Free** for arbitrary recipients, which needs Workers Paid: 3,000 emails/month included, then $0.35 per 1,000. Sends to **verified destination addresses are free on all plans** and do not count. 50 recipients per email; 25 MiB; new accounts start on a "conservative daily quota". The transactional-only rule (mail law M-2) is **not stated** on the pricing or limits page. | [pricing](https://developers.cloudflare.com/email-service/platform/pricing/), [limits](https://developers.cloudflare.com/email-service/platform/limits/) |

### 6.2 GraphQL Analytics API: usable for the usage meters [doc]

- **Endpoint:** `https://api.cloudflare.com/client/v4/graphql`, sent as `Authorization: Bearer <token>`.
- **Token permission:** **Account → Account Analytics → Read**. [doc](https://developers.cloudflare.com/analytics/graphql-api/getting-started/authentication/api-token-auth/)
- **Range:** at most 31 days per query.
- **Wrapper:** every query is wrapped in `viewer { accounts(filter: { accountTag: $accountTag }) { … } }`.

| Dataset | Fields | Doc |
|---|---|---|
| **`r2StorageAdaptiveGroups`** | `max { objectCount uploadCount payloadSize metadataSize }`; dimensions `datetime` (also `bucketName`); filters `datetime_geq`, `datetime_leq`, `bucketName` | [R2 metrics](https://developers.cloudflare.com/r2/platform/metrics-analytics/) |
| **`r2OperationsAdaptiveGroups`** | `sum { requests }`; dimensions `actionType`, `actionStatus` (`success`, `userError`, `internalError`), `bucketName`, `objectName`, `responseStatusCode`, `datetime` | same |
| `d1AnalyticsAdaptiveGroups` | `sum { readQueries writeQueries rowsRead rowsWritten queryBatchResponseBytes }`, `quantiles { queryBatchTimeMsP90 … }`; dimensions `date`, `databaseId` | [D1 metrics](https://developers.cloudflare.com/d1/observability/metrics-analytics/) |
| `d1StorageAdaptiveGroups` | `max { databaseSizeBytes }` (the doc names the field; confirm the dataset name by introspection) | same |
| `workersInvocationsAdaptive` | `sum { requests errors subrequests }`, `quantiles { cpuTimeP50 cpuTimeP99 }`; dimensions `scriptName`, `status`, `datetime` | [Workers GraphQL](https://developers.cloudflare.com/analytics/graphql-api/tutorials/querying-workers-metrics/) |

Calling this API needs a credential
(R-05: name only, a registry row, and the owner's yes). The alternative is to count bytes ourselves in D1 when
objects are written.

### 6.3 Email-provider free tiers (as published on 2026-11-11)

| Provider | Free allowance | Source |
|---|---|---|
| **Brevo** | **300 emails/day**, no rollover; 100,000 contacts; a "Sent with Brevo" sticker on every email. Whether transactional mail shares the 300 is **not stated**. Reset time not stated. | [Brevo help 208580669](https://help.brevo.com/hc/en-us/articles/208580669), [Brevo free SMTP](https://www.brevo.com/free-smtp-server/) |
| **Resend** | **100/day and 3,000/month**; daily reset at midnight UTC; 3 domains (pricing page; the 2023 blog said 1); 30-day data retention; each recipient counts; 10 requests/second per team | [pricing.md](https://resend.com/pricing.md), [quotas](https://resend.com/docs/knowledge-base/account-quotas-and-limits) |
| **Sender** | **15,000/month, 2,500 subscribers, "no" daily limit**; SMTP and API included; 1-day log retention | [Sender free plan](https://www.sender.net/pricing/free-plan/) |
| **Mailjet** | **6,000/month and 200/day**; 1,000 contacts; the Mailjet logo stays (removed from the Essential plan up) | [Mailjet pricing](https://www.mailjet.com/pricing/) |
| **SendGrid** | **No free plan for new accounts** since 2025-03-25: a **60-day trial**, 100/day on the Email API, then sending stops. Older free accounts keep their plan unless told otherwise. | [SendGrid trial](https://support.sendgrid.com/hc/en-us/articles/35270136965403) |
| **Postmark** | **100 emails/month**, developer plan, no overage, no expiry | [Postmark pricing.txt](https://postmarkapp.com/pricing.txt) |
| **Mailgun** | **100 emails/day** ("Send up to 100 emails/day free"); monthly cap and retention not stated on that page | [Mailgun email API](https://www.mailgun.com/features/email-api/) |
| Cloudflare Email Service | See 6.1: not on Workers Free except to verified addresses | — |

---

## 7. Gaps and things not found

- No official pixel or colour specification for Gmail; section 1.3 is approximate (**[obs]**).
- Gmail's default Undo Send period and its Spam retention are not stated on the pages fetched.
- The current colours of the category tabs, and the exact "N new" chip styling, could not be verified.
- Whether Brevo's 300/day covers transactional API mail is not stated on Brevo's page.
- Cloudflare's own "transactional only" rule for Email Service sending is not stated on its pricing or limits pages.
  Mail law M-2 cites it, so check where that rule comes from.
