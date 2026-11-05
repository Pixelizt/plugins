# Chip / pill

Use for: Small label, tag or filter toggle: dietary tags, categories, status. `span`, link or button.
Don't use for: Primary actions (use Button).
Vibe: any  |  Motion level: subtle
Deps: none
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `outline \| solid \| muted \| primary` | `outline` | |
| `size` | `sm \| md` | `sm` | |
| `dot` | boolean | false | leading dot in the current color |
| `as` | `span \| button` | `span` | `href` makes it an `<a>` |
| `selected` | boolean | none | `aria-pressed` (button) / `aria-current` (link) plus a ring |

## Usage
```astro
<Chip dot>Vegan</Chip>
<Chip as="button" selected={active}>Brunch</Chip>
```

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
