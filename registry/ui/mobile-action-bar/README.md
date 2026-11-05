# Mobile action bar

Use for: Phone-only fixed bottom bar with up to 4 actions: call, directions, book, order (or a plain link). Hidden from `md` up.
Don't use for: Sites with no phone-first actions, or pages where a form's submit button sits at the very bottom (they would stack).
Vibe: practical / local business  |  Motion level: subtle
Deps: none
Origin: original (pattern ported from the reference project, agency-owned code)  |  License: agency-owned
Used by: reference-project (2026-11, pattern); registry seed

## Props
| Prop | Type | Default | Notes |
|---|---|---|---|
| `actions` | `{kind, label, href, external?, highlight?, track?}[]` | required | `kind`: `call \| directions \| book \| order \| link`; only the first 4 render |
| `label` | string | `Quick actions` | nav name |

## Usage
```astro
<!-- last child of <body> -->
<MobileActionBar actions={[
  { kind: "call", label: "Call", href: `tel:${phone}` },
  { kind: "directions", label: "Directions", href: mapUrl, external: true },
  { kind: "book", label: "Book", href: "/book" },
  { kind: "order", label: "Order", href: orderUrl, highlight: true },
]} />
```

## Notes
Respects `env(safe-area-inset-bottom)` and renders a spacer so the bar never covers the end of the page. `data-track` is emitted; wiring it to analytics is the site's job.

## Rules
Shared conventions and how to install: [`docs/agents/component-registry.md`](../../../docs/agents/component-registry.md).
