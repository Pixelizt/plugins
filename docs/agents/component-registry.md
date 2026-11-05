# Our component registry (`registry/`)

The registry is our private, growing library — first stop before any external source.

## Layout
```
registry/
├── PROVENANCE.md          # log of every borrowed component (all clients)
├── ui/<component>/        # sections, cards, nav, lightbox…
└── motion/<effect>/       # reveal, marquee, GSAP/3D effects
    each: component.astro (+ script.ts when interactive) + README.md
```

## Conventions (enforced by review; encode as tests when possible)
- `.astro` + bundled `script.ts`; React only when an island truly needs it.
- Every `script.ts` ends with `export {}` (otherwise `astro check` treats scripts as globals → duplicate-name errors).
- **No inline `style="…"` attributes** (strict CSP); use classes or `data-*` + CSS. Setting `el.style` from scripts is fine.
- Shadows: `shadow-sm|md|lg` (from `brand.shadow`). Pill-shaped elements (chips, pill nav, arrow bubbles) may use `rounded-full` regardless of `brand.radius`; everything else follows the radius token.
- Token utilities only; logical properties only; `prefers-reduced-motion` honored; content visible without JS.
- To use in a client: copy the `registry/ui` + `registry/motion` folders you need into `src/components/registry/`
  (`card` imports `../../motion/reveal/script.ts`). `hero-stagger` needs `gsap` (in the starter).

```
```

## Harvest criteria (`/harvest`)
Save a component when it: (a) looked great in a shipped client, (b) is fully token-themed,
(c) has no client-specific copy/data, (d) passes reduced-motion + mobile checks.

## README template
```md
# <Name>
Use for: ...            Don't use for: ...
Vibe: playful / luxe / minimal ...       Motion level: subtle | expressive | awwwards
Deps: gsap, ...         Origin: <source URL or "original">   License: MIT
Used by: reference-project (2026-11)
Props: ...
```
