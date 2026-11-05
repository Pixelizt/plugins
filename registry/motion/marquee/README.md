# Marquee

Use for: An endless horizontal ticker for taglines, ingredient lists, press logos.
Don't use for: Information people must read (it moves) or long sentences.
Vibe: playful / bold  |  Motion level: expressive
Deps: none (CSS keyframes; tiny script pauses it off-screen)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `speed` | `slow \| normal \| fast` | `normal` | 60s / 40s / 20s per loop |
| `reverse` | boolean | false | RTL pages reverse automatically |
| `separator` | boolean | true | dot between items |
| `label` | string | none | adds `role="group"` + `aria-label` |
| default slot | `<li>` items | | rendered twice; the copy is `aria-hidden` |

## Usage
```astro
<Marquee class="bg-primary py-4 font-heading text-2xl text-primary-foreground">
  <li>Single origin</li><li>Baked on site</li>
</Marquee>
```

## Notes
Pauses on hover, on keyboard focus within, and while off-screen. With reduced motion it is a static, centered, wrapping list (one copy).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
