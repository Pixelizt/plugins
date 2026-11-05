# Card grid

Use for: A responsive 2/3/4-column grid for cards or any equal tiles.
Don't use for: Masonry layouts or content of very different heights that should not stretch (cards stretch to equal height).
Vibe: neutral  |  Motion level: subtle
Deps: none
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `div \| ul \| ol` | `div` | |
| `cols` | `2 \| 3 \| 4` | `3` | 1 column on phones, 2 from `sm`, N from `lg` |
| `gap` | `sm \| md \| lg` | `md` | |
| `stagger` | boolean | false | revealing children (card `reveal`) animate one after another |

## Usage
```astro
<CardGrid cols={3} as="ul" stagger>...</CardGrid>
```

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
