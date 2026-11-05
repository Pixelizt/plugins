# Lightbox

Use for: Click an image to view it large, with Esc, arrow keys, swipe, a counter and focus return. Built on the native `<dialog>`.
Don't use for: Video galleries, or single hero images (not worth the interaction).
Vibe: gallery / food photography  |  Motion level: subtle
Deps: none (small script)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `group` | string | `gallery` | links with `data-lightbox="<group>"` open this dialog; unique per dialog |
| `images` | `{src, alt, thumb?, caption?, width?, height?}[]` | `[]` | renders a thumbnail grid; omit to wire your own links |
| `cols` | `2 \| 3 \| 4` | `3` | |
| `label`, `closeLabel`, `prevLabel`, `nextLabel` | string | English | accessible names |

## Usage
```astro
<Lightbox group="food" images={photos} cols={4} />
<!-- or your own markup -->
<a href="/big.jpg" data-lightbox="food" data-caption="Flat white"><img src="/small.jpg" alt="Flat white" /></a>
```

## Notes
Without JS the links open the full image. Needs `img-src` to allow wherever full-size images are hosted (CSP).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
