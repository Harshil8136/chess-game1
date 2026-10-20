# @oltrem/core-ui

The design kit of every client portal (plan section 12): a short token list as a Tailwind v4
theme, and the phone-first primitives as Preact components on native elements. One look across
every client; a client's brand comes in through four variables, never through a rebuild.

## The tokens

`src/theme.css` is the whole vocabulary, and it is deliberately short so an agent holds it in
its head. Tailwind's default palette, type scale, radii and shadows are reset: `bg-blue-500`
does not exist here, and a test proves it.

| Group | Names | Utilities |
|---|---|---|
| Colours | `bg`, `surface`, `surface-raised`, `border`, `fg`, `fg-muted`, `primary`, `accent`, `ok`, `attention`, `danger`, `info`, `focus`; each colour text sits on has a `-fg` | `bg-primary`, `text-primary-fg`, `border-danger` |
| Brand (from the client's generated `/theme.css`) | `--brand-primary`, `--brand-primary-dark`, `--brand-accent`, `--brand-radius`, `--brand-font` | fall back to the kit's values when unset |
| Spacing | Tailwind's 4 px scale, plus `gutter` 16, `row-h` 44, `row-h-form` 56, `touch` 44 | `p-gutter`, `min-h-row-h`, `size-touch` |
| Radius | `sm` 4, `md` the brand radius (8), `lg` 12, `full` | `rounded-md` |
| Type | `xs` 12/16 to `2xl` 24/32; weights 400, 500, 600; `tabular-nums` for data | `text-sm`, `font-semibold` |
| Shadows | `sm`, `md` | `shadow-md` |
| Motion | `fast` 120 ms, `base` 200 ms, one `ease-out`; enter and exit through `@starting-style` | `duration-(--duration-fast)` |

Light and dark are the same names with different values; dark follows the system
(`prefers-color-scheme`) unless `<html data-theme="light">` or `dark` says otherwise. Every
text-on-colour pair reads at 4.5:1 or better in both, and a test computes the ratios from the
OKLCH values rather than trusting the author's eye. There are no z-index layers: dialogs,
popovers and toasts use the browser's top layer.

## The primitives

All on native elements, server-rendered by Astro, with a script only where the browser has
no built-in behaviour. None emits a `style` attribute, so the hash-based content security policy
holds (plan 12.1); a test renders every one and checks.

| Primitive | Built on | Rule it keeps |
|---|---|---|
| `Button`, `IconButton` | `<button>` | four looks, two heights (44, 56), never a fixed width; an icon button refuses an empty label |
| `ChipRow`, `CommandRow` | `<nav>` with a list of links or buttons in the `.ui-chip-row` scroller | the sideways navigation: every option visible, the current one marked for the browser and the scroller; a destructive command last and red |
| `Input`, `Textarea`, `Select`, `Switch`, `Checkbox`, `Radio` | the native controls; a switch is a checkbox with the switch role | one column, 56 px controls, 44 px choice rows, right `type` and `autocomplete` are the caller's |
| `FormField`, `FormErrors` | `<label>`, the control, `<p>` hint and error; a `role="alert"` summary | the control carries `aria-describedby` and `aria-invalid`; the summary links to each field |
| `Dialog`, `DialogButton`, `DialogClose`, `ConfirmDialog` | `<dialog>` with `closedby="any"`, opened and closed by the browser's `command` attributes | a bottom sheet on a phone, centred from 640 px; one system, never a dialog in a dialog; the confirm dialog names the object and the consequence, focuses cancel, puts the red button last, and can demand a typed word |
| `Popover` | the popover API, anchored to its trigger | dismissed by a tap outside; no script |
| `Tabs`, `Pagination` | `<nav>` with links | the current page marked; `rel="prev"` and `rel="next"`; the ends disabled |
| `Table` | `<table>` from 640 px, a card list under it, from one column definition | one title, at most three data points and one status on a card; numbers right-aligned in tabular figures; the empty state in place of no rows |
| `Badge`, `StatusPill` | `<span>` | four health states only, always an icon and a word |
| `ToastRegion`, `Toast` | a polite live region; each toast a manual popover its own button hides | one live region in the layout |
| `Skeleton`, `EmptyState` | `<div aria-hidden>`; `<section>` | shimmer off under reduced motion; one icon, two lines, one action, three kinds |

Still to come from the plan's list: the combobox, the menu with submenus and the date range,
on Zag.js state machines through its Preact adapter; the primitives gallery page; the quality
gates of plan 12.6 (axe, screenshots at 390 px, the sideways-scroll and target-size check, the
CSP smoke test) once there is an Astro app to run them against.

## Using it

```ts
// a client's global stylesheet
@import '@oltrem/core-ui/theme.css';
```

```tsx
import { Button, ChipRow, FormField, Input } from '@oltrem/core-ui';

<ChipRow label="Modules" chips={modules.map((m) => ({ label: m.name, href: m.href, current: m.id === current }))} />
<FormField id="email" label="Email" error={errors.email}>
  <Input type="email" name="email" autocomplete="email" />
</FormField>
<Button type="submit" variant="primary" size="form">Save</Button>
```

Labels, words and sentences are the caller's, in the page's language; the primitives carry no
text of their own.

## Tests

On Node: every primitive rendered to HTML with `preact-render-to-string` and its markup read
back (roles, ids, the command attributes, the order of buttons, the card list and the table);
the theme compiled with Tailwind's Node API (the semantic utilities exist, the defaults do
not); and the contrast of every text-on-colour pair in light and in dark.
