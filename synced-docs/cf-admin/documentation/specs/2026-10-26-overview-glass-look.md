---
title: "The Overview in frosted glass — design"
status: active
audience: [owner, ai, technical]
last_verified: 2026-10-26
verified_against: [code]
owner: harshil
related_code: [src/pages/dashboard/index.astro, src/styles/pages/overview.css, src/components/dashboard/overview/Overview.tsx, src/components/dashboard/overview/OverviewCharts.tsx, src/components/dashboard/overview/motion.ts, src/styles/components/invite.css, src/components/admin/users/InviteUserModal.tsx, test/overview.test.ts]
related_docs: [../features/DASHBOARD.md, ../features/USER-MANAGEMENT.md, ../reference/DESIGN-SYSTEM.md, ../records/reports/2026-10-26-overview-glass.md]
tags: [dashboard, overview, design, ui, accessibility, motion]
---

# The Overview in frosted glass — design

> **TL;DR (non-technical):** The Overview and the Invite someone pop-up now look like panes of
> frosted glass over a soft blur of colour: warm sand and terracotta in the light theme, deep
> violet and blue in the dark. When the page opens, the cards rise in one after another, the
> numbers count up, the chart draws its line and the health ring sweeps round. Nothing moves for
> someone who has asked their phone for less motion, and every state is still a shape and a word,
> never colour alone.

## 1. Why

On 2026-10-26 Harshil rejected the first rebuild of the Overview as "nothing good" and asked for
something "on a whole other level", then sent a picture of a frosted-glass dashboard and asked for
that look as the top choice. Five boards drawn with the hotel's real numbers (the Overview wide and
on a phone in both themes, Invite someone on a phone and wide) were shown to him the same day; he
answered "Looks amazing! Just make sure it's animatedly loaded, amazing, provide useful stats!".
This spec is what was built from those boards.

## 2. The pieces

| Piece | Class | What it is |
|---|---|---|
| Backdrop | `.ov-scene`, `.ov-blobs` | The page paints its own background: a base colour and four large blurred circles of colour, placed down the page so the glass has something to blur from top to bottom. The page asks the layout for no padding (`noPadding`) so the backdrop reaches the edges |
| Glass | `.ov-glass` | A translucent panel (`--g-glass`) with a light edge, a soft shadow and a one-pixel highlight along its top, blurring what is behind it (`backdrop-filter: blur(22px) saturate(160%)`). A browser without `backdrop-filter` gets a solid colour instead (`--g-glass-solid`) |
| Ink tile | `.ov-ink` | The one panel that stands out of the glass: dark in the light theme, light in the dark. It holds the backups, which matter most when something goes wrong |
| Hero | `.ov-hero` | The greeting panel: an initial, the date, the greeting, the sentence, the "need you" button, the page search on a wide screen, the time it was read and refresh |
| Figures | `.ov-kpis`, `.ov-kpi` | Glass cards with an icon, a label, a large number that counts up and a pill that says what the number means |
| Chart switch | `.ov-seg` | A pill of options that scrolls sideways, the selected one in the ink colour |
| Jump bar | `.ov-jump` | A glass pill that floats at the bottom of the screen with the page's own parts; the part on screen is in the ink colour |

The rows wrap (`flex-wrap`), each card with a share and a smallest width (`.ov-c-*`), so a person
who sees fewer parts gets full rows instead of holes, and a phone gets one column without a
separate layout.

## 3. Colour

Every colour on the page is a `--g-*` token, set once on `.ov-scene` for the dark theme (the
portal's default) and once under `:root[data-theme='light']`. The accent (orange, `--g-accent`) is
the page's identity: the chart's line, the bars, the card icons. It never marks a state.

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--g-base` | `#0a0d16` | `#e7ded2` | the backdrop |
| `--g-blob-1..4` | violet, blue, deep violet, orange | caramel, brown, sand, terracotta | the four blurred circles |
| `--g-glass` | white at 7% | white at 42% | panels |
| `--g-text`, `-2`, `-3` | `#f5f3ff`, `#d4d0e6`, `#c2bdd8` | `#1f1a16`, `#453a32`, `#4f443b` | text, from strongest to quietest |
| `--g-accent`, `--g-accent-ink` | `#ff8a4c`, `#ffb48a` | `#e8572a`, `#9a3412` | marks; text and icons in the accent |
| `--g-o1..4` | 0.55, 0.55, 0.7, 0.3 | 0.7, 0.42, 0.8, 0.3 | how strong each circle is |
| `--g-good`, `warn`, `bad`, `info` | light greens, ambers, roses and blues | dark ones | states, always beside a word or a shape |

Every text colour and state ink stays above 4.5:1 against a panel even where it sits over the
strongest part of a circle, worked out from the token values (the panel's white over the base
mixed with the circle at its strength): the quietest text is at least 6.2:1 in the light theme
and 5.3:1 in the dark, the accent text 4.8:1 and 5.5:1, the states 5.1:1 and 5.1:1. The first
values tried (`#5a4e44`, `#ada8c6`, `#b4421a`, `#fb7185` and stronger circles) fell to between
3.4 and 4.9:1 over a circle, so they were darkened or lightened and the circles softened. The
light theme's states are dark inks for the same reason System health's are
([its spec](2026-10-17-system-health-look.md)).

## 4. Motion

Motion runs only under `prefers-reduced-motion: no-preference`, and it moves only opacity and
transform (plus the SVG stroke of a line or a ring): an animated `filter` would fight the glass's
own blur and costs a phone much more.

| What | How | When |
|---|---|---|
| Backdrop | the circles grow and fade in | once, on opening |
| Loading | glass outlines of the cards in their places, a light sweeping across them | until the answer comes |
| Cards | rise 18 px and fade in, one after another (`ov-in` with `ov-d0` to `ov-d14`, 50 to 60 ms apart) | once, when the answer comes |
| Figures | count from 0 to the value in one second, fast at first (`useCountUp`, `motion.ts`); on a refresh, from the old value to the new | on opening and on every refresh |
| Line chart | the line draws itself (`pathLength` 1 and a dash offset), the area fades in after it, the last point pops | on opening and when the chart is switched |
| Bars, ring, strips | bars grow from the base, the ring's parts sweep round, the day bars and the backup strip are revealed from the left | on opening |
| Hover | a figure card lifts by 3 px with a deeper shadow | pointer devices only |
| Live dot | the dot beside "Updated" beats slowly | while the page is open |

Entrance animations use `animation-fill-mode: backwards`, so once they end nothing holds a
transform and hover still works. Screen readers get the final number at once (a hidden copy
beside the counting one).

## 5. Charts at their real size

Each chart measures its own box (`ResizeObserver`) and draws at that width in pixels, so its labels
are 11 px on a phone as on a wide screen instead of shrinking with the drawing. Touching or
hovering a chart puts a label on the chart above the point; the same sentence is read out for a
screen reader.

## 6. The Invite pop-up

Invite someone uses the same idea on the shared Dialog (`class="ck-scope iv-glass"`,
`src/styles/components/invite.css`): the pane is translucent with two faint glows of the theme's
colours and blurs the page, the backdrop is dimmed and blurred, the role cards, the page count and
the group tiles are lighter glass tiles (a tile also carries a wash of its group's colour), the
chosen role and the step numbers are in the accent (orange in the dark theme, the ink in the
light), and the buttons are pills. From 64rem wide Who and Role sit on the left and Pages beside
them (until the same day's second pass the three steps were three columns:
[USER-MANAGEMENT](../features/USER-MANAGEMENT.md) §5.2 owns the arrangement); on a phone they stay
one under the other. The steps rise in one after another when it opens.

## 7. What was decided against

- **A chart library.** Four small shapes (a line, bars, a ring, day bars) do not earn one, and
  `RULESAd.md` §7.3 keeps the whitelist short.
- **Moving blobs.** A backdrop that drifts would make every glass panel re-blur on every frame,
  which a phone pays for in battery and smoothness. The circles stay still once they have faded in.
- **A second top bar.** The board Harshil approved had a pill bar with search across the top. The
  portal already has its top bar and a sidebar search, and the phone policy keeps the sidebar as
  the only menu, so the search sits in the greeting panel on a wide screen only.

## Verification log

| Date | Checked | Not checked |
|---|---|---|
| 2026-10-26 | §6 only, after Invite someone's second pass: the glass tiles and the wide arrangement, against `src/styles/components/invite.css` | The rest of the spec; the look on a phone |
| 2026-10-26 | Written from the code as built: `src/styles/pages/overview.css` (tokens, pieces, motion), `Overview.tsx`, `OverviewCharts.tsx`, `motion.ts`, `src/styles/components/invite.css`; the contrast figures computed from the token values | The look on a phone, in both themes, and the motion (the owner's test) |
