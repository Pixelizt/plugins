---
name: reskin
description: Change a client site's look and feel (theme tokens, fonts, layout, section order, copy) without touching module backend logic. Use for any visual redesign or brand change.
argument-hint: <client-slug> [what to change]
---

1. Read `docs/agents/reskinning-guide.md` and the client's `client.yaml`.
2. If brand values changed, update `client.yaml` first, then regenerate theme tokens. Check contrast (WCAG AA).
3. Grep the project for hardcoded hex colors / font names / px radii outside the theme file and replace with tokens.
4. Apply layout/section changes. Pick components via the reuse ladder (registry → modules → `docs/agents/ui-sources.md`).
5. Run the anti-template checklist (reskinning-guide §5).
6. Screenshot home + one inner page at 1440 and 390. Look at them critically; fix spacing/hierarchy issues.
7. Never edit `modules/*/server`, DB schema, auth or payments here — if needed, stop and ask.
