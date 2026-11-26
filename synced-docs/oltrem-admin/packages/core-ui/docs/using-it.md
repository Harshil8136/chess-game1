---
title: "@oltrem/core-ui: using it, tests"
status: living
owner: vendor
last_verified: 2026-11-26
sources: [packages/core-ui/src/index.ts, cx.ts, test]
---

# @oltrem/core-ui: using it, tests

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

Every word is the caller's; the primitives carry no text. `cn()` (also `cx`) joins class names
with `clsx`. There is no class merger (tailwind-merge cost 8.4 KB and about 18 ms of CPU on a first
page), so a caller never passes a class that fights a primitive's; looks are `cva` tables such as
`buttonVariants({ variant, size })`. New screens follow `.claude/skills/ui-design-system` and
`.claude/skills/preact-ui`.

## Tests

On Node: every primitive rendered with `preact-render-to-string` and read back (roles, ids,
command attributes, button order, cards and table); the theme compiled with Tailwind's Node API
(semantic utilities exist, defaults do not); every text-on-colour contrast in light and dark; the
widgets rendered closed (no inline style, roles, hidden values, locale dates); the Email pieces
(`test/mail.test.tsx`); the charts (`test/charts.test.tsx`: scale, moves and colours, the dashed
period, five shades, shares, no style attribute).
