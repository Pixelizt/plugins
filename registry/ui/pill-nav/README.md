# Pill nav

Use for: A floating, rounded navigation bar that stays at the top while scrolling. Works over a hero (`overlay`) or above content.
Don't use for: Sites with more than ~7 top-level links or mega-menus (no dropdown groups here), or sites that want a full-width bar.
Vibe: playful / modern / friendly  |  Motion level: subtle
Deps: none (small bundled script: toggle, Esc, outside click, scroll shadow)
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `items` | `{label, href}[]` | required | flat list |
| `brand` | string | none | or use the `brand` slot for a logo |
| `brandHref` | string | `/` | |
| `cta` | `{label, href}` | none | filled button at the inline end |
| `current` | string | `Astro.url.pathname` | exact or prefix match sets `aria-current="page"` |
| `overlay` | boolean | false | lets the next section slide under the bar |
| `label` / `menuLabel` | string | `Main` / `Menu` | accessible names (pass translated text later) |

## Usage
```astro
import PillNav from "../components/registry/ui/pill-nav/component.astro";
<PillNav items={[{ label: "Menu", href: "/menu" }]} brand={config.client.name} cta={{ label: "Book", href: "/book" }} overlay />
```

## Notes
- Below `md` the links collapse into a dropdown behind a toggle button (`aria-expanded`, `aria-controls`, Esc closes and returns focus, outside click and link click close).
- With JS off (`@media (scripting: none)`) the toggle is hidden and the links show as a list: nothing is hidden behind JS.
- Uses `rounded-full` for the bar (it is a pill by definition); the mobile panel uses the brand radius token.

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
