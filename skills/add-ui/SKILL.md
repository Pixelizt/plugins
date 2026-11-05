---
name: add-ui
description: Add a UI component or section by reusing the registry and curated sources (shadcn, Magic UI, Aceternity, Origin UI, Tailark, React Bits) before building from scratch. Use whenever a page needs a new component or section.
argument-hint: <what you need, e.g. "pricing section with 3 plans">
---

1. Search `registry/` (READMEs) for a match. If found, use it.
2. Otherwise open `docs/agents/ui-sources.md`, use the Quick picker and tables to choose 1–3 candidates. Briefly state which and why (fit with `brand.vibe` and `motion.level`).
3. Check license vs `client.yaml → licenses.owned`.
4. Install via `npx shadcn@latest add ...` when the source supports it; otherwise copy source from the official docs/repo (not from random mirrors).
5. Follow "How to take a component" (ui-sources.md §0): retheme to tokens, strip demo code, wire real data, a11y + 390px check.
6. Append a row to `registry/PROVENANCE.md`.
7. Screenshot it in place. If it's excellent and generic, suggest `/harvest`.
