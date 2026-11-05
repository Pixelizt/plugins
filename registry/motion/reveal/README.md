# Reveal

Use for: Fade/slide content in as it scrolls into view. One shared IntersectionObserver for the whole page.
Don't use for: Content in the first screen that must paint instantly (it is skipped there automatically), forms and booking flows (never delay a user).
Vibe: any  |  Motion level: subtle
Deps: none (script is ~1 kB)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `div \| section \| article \| li \| ul \| p \| figure` | `div` | |
| `variant` | `up \| fade \| zoom` | `up` | |
| `delay` | number (ms) | 0 | |
| `stagger` | boolean | false | this wrapper staggers its direct `[data-reveal]` children instead of revealing itself |

Any element can opt in with the plain attribute `data-reveal` (Card does this with `reveal`).

## Usage
```astro
<Reveal><SectionHead title="Hello" /></Reveal>
<Reveal stagger as="ul"><Reveal as="li">A</Reveal><Reveal as="li">B</Reveal></Reveal>
```

## Notes
How it keeps the rules: the hidden state is set by the script, only on elements below the fold and only when motion is allowed (so no JS, reduced motion and print all show everything); only `opacity` and `transform` animate. Pitfall: do not also animate a `[data-reveal]` element with GSAP, the two fight (this is why the reference project's GSAP never touched `.reveal`).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
