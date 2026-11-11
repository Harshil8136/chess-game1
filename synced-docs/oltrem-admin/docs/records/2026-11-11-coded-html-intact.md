---
title: "A coded HTML email sent as designed, and noticed when pasted (2026-11-11)"
status: record
owner: vendor
last_verified: 2026-11-11
sources: [vendor/mail/published/modules/email/README.md; packages/screens/src/client/frame.js]
---

# A coded HTML email sent as designed, and noticed when pasted

> **In plain words.** On 2026-11-11 the owner said HTML emails were "one of the biggest problems":
> a coded email he sent was cleaned until the whole design broke, and the portal should notice
> code by itself. Two things caused it. When the email was sent as HTML, one line in its style
> sheet that loads a web font (an `@import` from Google Fonts, in almost every designed email) made
> the cleaner throw out the whole style sheet, so every colour, width, button and font went at
> once. When the code was pasted into the message box with Words chosen, the box kept only what
> its toolbar makes, so the tables, pictures and styles went. Now the cleaner takes out only the
> one line that could load or run something and keeps the rest; the web font stays. And code pasted
> into the message box turns the message to HTML with the code as it is, and says so.

Oltrem Mail 823f84c holds the email module's part, with two follow-ups the same morning: a7cc72d
(code pasted into the composer is read back and sent as code; a second clean no longer doubles the
inlined styles) and c4b6205 (that second clean keeps the author's fallbacks, `data:` pictures and
`&quot;` fonts). The kit keeps the c4b6205 pack (its `oltrem-mail.json`); the kit holds the message
box's part.

## What changed

| Part | Before | After |
| --- | --- | --- |
| A style sheet with a web font `@import` | the whole `<style>` block emptied | kept; a Google Fonts or Bunny Fonts import stays, another site's import goes alone |
| A style that loads something not on https (`url(http://...)`) | the whole block, or the whole `style` attribute, gone | only that declaration goes |
| Outlook's `<!--[if mso]>` comments | gone, so Outlook's ghost tables went | kept when nothing inside them can run; other comments still go |
| `id`, Outlook's `xmlns`, `nowrap`, `type` and a few more layout attributes | removed | kept |
| A plain `http://` link | its address removed, the button did nothing | kept |
| Style rules written onto each tag | the later rule won, so `p { color }` repainted `#footer p` | the more specific rule wins, then the later, as in a browser |
| The same email cleaned again (a draft save, then the send) | every inlined style written twice, longer each time | the same email; only an exact repeat goes, so a fallback pair (`background:#123456;background:linear-gradient(...)`) stays |
| HTML code pasted into the message box (Words) | stripped to the box's own tags | the message turns to HTML with the code as pasted, for someone allowed to use code; anyone else gets it as words, and is told why |
| Code sent with Words chosen, without the page script | sent as words, the code showing | sent as HTML for someone allowed to use code |
| Code typed or pasted after choosing HTML on the page | Send and Preview wrote the message box's old copy over it, so the code was lost (an empty email when the box was empty) | the code is what goes |

## Before and after

```mermaid
flowchart TB
  subgraph Before
    B1[Coded email] --> B2{pasted where?}
    B2 -- message box, Words --> B3[kept only bold, lists, links: tables, pictures, styles gone]
    B2 -- HTML --> B4[one font import found] --> B5[whole style sheet emptied] --> B6[design broken]
  end
  subgraph After
    A1[Coded email] --> A2{pasted where?}
    A2 -- message box --> A3[seen as code: message turns to HTML]
    A2 -- HTML --> A4[cleaned piece by piece]
    A3 --> A4
    A4 --> A5[only the risky line goes; font, Outlook comments, ids, links stay]
    A5 --> A6[rules written on tags by specificity] --> A7[sent as designed]
  end
```

## Why this much and no more

The cleaner exists because the email goes out under the company's name: nothing in it may run a
script or open another page. That stays exactly as it was. What changed is how much goes with a
refused piece: one declaration, never the sheet around it. A web font from the two font services
loads a style sheet of fonts, the same kind of load as an https picture, which was always allowed;
Gmail ignores it and Apple Mail shows the font. Outlook's conditional comments are read only by
Outlook's own Word engine, which runs no scripts, and the cleaner still refuses one that holds a
script, a frame or an `on...` handler.

## Impact on each part

- **Oltrem Mail, email module**: `sanitizeEmailHtml` and its new `cleanCss`, `inlineStyles` with
  `specificity`, and `isHtmlCode` in the Write check.
- **The kit's screens**: the message box's paste in `frame.js`, an info tone for its notice, and
  the message box writing its copy into the form only while it is on.
- **Workers, settings, variables, migrations, dependencies**: none new.
- **Delivery to the inbox (Primary or Promotions)**: not touched here; that work is its own.

## How it was verified

- A realistic coded email (a Google Fonts import, `@media`, Outlook comments, an id, an http link,
  a hero background picture) through the cleaner and the inliner: before, `<style></style>`; after,
  the whole sheet with each rule on its tags, nothing taken out.
- Tests: Oltrem Mail `templates.test.ts` (the design kept, only the risky rules gone, an escaped
  `expression(` caught), `template.test.ts` (an id rule beats a later tag rule), `senders.test.ts`
  (a whole email sent with Words goes as HTML with its font import, Outlook comment, id and http
  link for Ann, and stays words for Zed, who may not use code); the kit's `frame.test.ts` (code
  pasted into the message box turns it to HTML for one who may use code and the send keeps it, and
  goes in as words from the plain text for one who may not).
- Looked at on this computer with the template's portal (`dev --mail`): a coded email pasted
  into the message box turned it to HTML with the note; Preview showed the hero, the button, the
  grey footer and the widths as coded (the preview's own policy loads no outside font). The first
  try showed an empty preview: the message box's copy was written over the code at Preview, which
  is fixed and tested.
- Phone test P131 in [the Email list](../phone-tests-email.md).
