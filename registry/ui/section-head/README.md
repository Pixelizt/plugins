# Section head

Use for: Eyebrow + title + optional accent word in the script font + lede (default slot).
Don't use for: Page `<h1>` hero titles that need custom layout (use `level={1}` only if the head is the page title).
Vibe: editorial / handwritten accent over a serif heading  |  Motion level: subtle
Deps: none (needs an accent font in `brand.fonts.accent` for the script look; falls back to the heading font)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `title` | string | required | |
| `eyebrow` | string | none | small caps label with a dot |
| `accent` | string | none | rendered in `<em>` using `font-accent` |
| `overlap` | boolean | false | accent sits on its own line, tucked into the title and tilted |
| `align` | `start \| center` | `start` | |
| `level` | `1-4` | `2` | |
| default slot | | | lede text |

## Usage
```astro
<SectionHead eyebrow="Menu" title="Our" accent="favourites" overlap>Baked daily.</SectionHead>
```

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
