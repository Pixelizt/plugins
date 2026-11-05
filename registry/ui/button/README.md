# Button

Use for: Every call to action: primary / secondary / ghost, three sizes, optional rotating-arrow affordance. Renders `<a>` with `href`, `<button>` without.
Don't use for: Icon-only buttons (add an `aria-label` yourself) or navigation links inside prose (use a plain link).
Vibe: friendly / bold; the arrow circle suits playful brands, drop `arrow` for minimal ones  |  Motion level: subtle (CSS hover only)
Deps: none
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `primary \| secondary \| ghost` | `primary` | uses brand color pairs, so contrast is guaranteed by the tokens |
| `size` | `sm \| md \| lg` | `md` | |
| `arrow` | boolean | false | circular arrow at the inline end, rotates on hover (CSS), mirrors in RTL |
| `shape` | `token \| pill` | `token` | `token` follows `brand.radius`; `pill` is fully rounded |
| `href` | string | none | set it to get an `<a>` |
| `type` | `button \| submit \| reset` | `button` | buttons only |
| `full` | boolean | false | full width |
| anything else | | | passed through (`target`, `rel`, `disabled`, `data-*`, `aria-*`) |

## Usage
```astro
<Button href="/book" arrow>Book a table</Button>
<Button variant="ghost" type="submit">Send</Button>
```

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
