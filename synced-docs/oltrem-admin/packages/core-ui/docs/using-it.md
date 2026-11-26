---
title: "@oltrem/core-ui: Using it; Tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src; split from packages/core-ui/README.md]
---

# @oltrem/core-ui: Using it; Tests

> Part of [the @oltrem/core-ui README](../README.md).

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

**Class names.** `cn()` joins class names and drops what is false (`clsx`); `cx` is the same
function under its first name. There is no class merger: tailwind-merge cost 8.4 KB and about 18 ms
of CPU on a first page, past the free plan's 10 ms, so a caller never passes a class that fights one
a primitive sets. A primitive's looks are a `cva` table instead, such as `buttonVariants({ variant,
size })` for a link or label in a button's look. The rules for a new screen are the repository's
skills, `.claude/skills/ui-design-system` and `.claude/skills/preact-ui`.

## Tests

On Node: every primitive rendered to HTML with `preact-render-to-string` and its markup read
back (roles, ids, the command attributes, the order of buttons, the card list and the table);
the theme compiled with Tailwind's Node API (the semantic utilities exist, the defaults do
not); the contrast of every text-on-colour pair in light and in dark; and the three widgets
rendered closed (no inline style, the roles, the hidden values, the locale's date format); and the Email pieces (`test/mail.test.tsx`); the report charts (`test/charts.test.tsx`): the round scale, the moves and their colours, the dashed period before, the five shades, the parts as shares, the bars as shares of the largest, and no style attribute.
