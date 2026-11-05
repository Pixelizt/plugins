# Hero stagger + drift frame

Use for: Entrance stagger for the hero copy (children rise in one by one), plus a cropping frame whose image drifts as you scroll.
Don't use for: Pages without a hero, or when `motion.level` is below `expressive` for the scroll drift (the stagger alone is fine at `subtle`).
Vibe: polished / editorial  |  Motion level: expressive
Deps: `gsap` (npm) incl. `gsap/ScrollTrigger`, loaded on demand
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
**`component.astro` (HeroStagger)**

| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `div \| section \| header` | `div` | direct children are staggered |
| `stagger` | number (s) | 0.07 | |
| `delay` | number (s) | 0.05 | |

**`drift-frame.astro` (DriftFrame)**

| Prop | Type | Default | Notes |
|---|---|---|---|
| `src`, `alt`, `width?`, `height?` | | required: src, alt | |
| `amount` | number (percent) | 5 | drift each way; image is scaled `1 + (2*amount+1)/100` so no gap ever shows |
| `priority` | boolean | false | `eager` + `fetchpriority="high"` for the LCP image |
| `ratio` | `square \| video \| portrait \| wide` | `portrait` | |

## Usage
```astro
import HeroStagger from "../components/registry/motion/hero-stagger/component.astro";
import DriftFrame from "../components/registry/motion/hero-stagger/drift-frame.astro";
<HeroStagger><p>Eyebrow</p><h1>Title</h1><Button>Book</Button></HeroStagger>
<DriftFrame src={hero.src} alt={hero.alt} priority />
```

## Notes
- `gsap.matchMedia()` gates everything on `prefers-reduced-motion: no-preference` and reverts on cleanup (also on `astro:before-swap`). `gsap` is imported dynamically after the reduced-motion check, so those visitors never download it.
- The stagger uses `gsap.from` with `clearProps`, so the children are visible if JS never runs. Trade-off: for a few frames after load they can be visible before the tween starts. Never use this on the LCP text if Lighthouse flags it; use CSS-only `reveal` there.
- Do not combine with `reveal` on the same element.
- The starter must list `gsap` in `package.json` (`npm i gsap`).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
