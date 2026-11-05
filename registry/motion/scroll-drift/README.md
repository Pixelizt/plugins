# Scroll drift

Use for: A decorative object (cup, leaf, sticker) that floats down the side gutter as you scroll, bobbing and rotating, swapping sides every few screens. Shows only when the gutter is wide enough.
Don't use for: Mobile/tablet (it is hidden below `lg`), narrow layouts without side gutters, or anything meaningful (it is `aria-hidden`).
Vibe: playful / brand mascot  |  Motion level: expressive
Deps: none (one small script)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `column` | CSS selector | `#main .wrap` | the widest match defines the content column and so the gutters |
| `startAfter` | number (viewports) | 0.55 | appears after scrolling this far |
| `swapEvery` | number (viewports) | 2.2 | |
| `bob`, `rotate` | number (px, deg) | 40, 16 | |
| default slot | `<img>` or `<svg>` | | give it a width via the wrapper `class` (default `w-20`) |

## Usage
```astro
<ScrollDrift><img src={cup.src} alt="" width="84" height="120" /></ScrollDrift>
```

## Notes
One passive scroll listener coalesced with requestAnimationFrame; layout is measured on resize only. The element is `position: fixed` on the inline-start edge and mirrors in RTL. Needs `top-[40vh]` style placement from its own classes, so place it once in the layout.

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
