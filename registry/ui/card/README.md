# Card

Use for: A content card: optional image or media slot, eyebrow, title, body, footer slot. With `href` the whole card is one link (single tab stop).
Don't use for: Dense data tables, or content that needs several separate links inside one card (the stretched link would cover them).
Vibe: neutral; `raised` for soft depth, `muted` for flat tinted tiles  |  Motion level: subtle (hover lift and image zoom; optional scroll reveal)
Deps: none (imports `registry/motion/reveal/script.ts` so `reveal` works without extra setup)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `as` | `div \| li \| article` | `div` | use `li` inside `<CardGrid as="ul">` |
| `variant` | `outline \| muted \| raised` | `outline` | |
| `title`, `eyebrow` | string | none | |
| `href` | string | none | makes the whole card clickable via the title link |
| `image` | `{src, alt, width?, height?}` | none | lazy-loaded; or use the `media` slot |
| `ratio` | `square \| video \| portrait` | `video` | image frame |
| `reveal` | boolean | false | fade up on scroll |
| `level` | `2 \| 3 \| 4` | `3` | heading level |
| slots | `default`, `media`, `footer` | | |

## Usage
```astro
<CardGrid as="ul" stagger>
  <Card as="li" reveal title="Pastries" href="/menu#pastries" image={{ src, alt }}>Laminated daily.</Card>
</CardGrid>
```

## Notes
Requires the folder layout `registry/ui/card` and `registry/motion/reveal` to be copied together (relative import).

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
