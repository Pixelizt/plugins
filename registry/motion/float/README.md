# Float

Use for: A gentle vertical bob for hero cards, stickers and badges.
Don't use for: Large blocks of text, or anything the user needs to click precisely while it moves (keep distances small).
Vibe: playful  |  Motion level: expressive
Deps: none (CSS only)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `div \| a \| span \| aside` | `div` | |
| `distance` | `sm \| md \| lg` | `md` | 6 / 10 / 16 px |
| `speed` | `slow \| normal \| fast` | `normal` | 9 / 7 / 5 s |
| `delay` | `0 \| 1 \| 2 \| 3` | `0` | seconds, desynchronises neighbours |

## Usage
```astro
<Float class="absolute top-10 end-6" delay={1}><Card ...>Flat white</Card></Float>
```

## Notes
Animates `transform` only, so give the wrapper no other transform (put hover transforms on the child). Off entirely for reduced motion.

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
