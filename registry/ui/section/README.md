# Section

Use for: The wrapper for every page band: tone (default / muted / inverse / primary), vertical padding, optional `wrap` container.
Don't use for: Nested sections (use plain markup inside).
Vibe: any  |  Motion level: subtle
Deps: none
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `section \| div \| article \| aside \| footer` | `section` | |
| `tone` | `default \| muted \| inverse \| primary` | `default` | colors come from token pairs; `inverse` and `primary` also fix the focus ring color |
| `pad` | `none \| sm \| md \| lg` | `md` | `py-*` (logical `padding-block`) |
| `wrap` | boolean | true | wrap children in the `wrap` container |
| anything else | | | passed to the element (`id`, `aria-labelledby`) |

## Usage
```astro
<Section tone="muted" id="menu"><SectionHead title="Menu" /></Section>
```

## Notes
Sets `--section-em`, the accent color section-head uses for its `<em>` (primary on light tones, current color on dark tones, so it never vanishes).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
