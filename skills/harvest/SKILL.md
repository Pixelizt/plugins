---
name: harvest
description: Save a great component or effect from a client project into the shared registry/ for reuse, and back-port module bug fixes. Use after a client ships or when a component turns out especially well.
argument-hint: <path to component> 
---

1. Check harvest criteria in `docs/agents/component-registry.md`. If not met, say what's missing.
2. Copy to `registry/ui/<name>/` or `registry/motion/<name>/`. Remove client copy, data, and any non-token styling.
3. Write README.md from the template (use-for, vibe, motion level, deps, origin, license, used-by, props).
4. Add a preview screenshot.
5. If this came from a module fix rather than a component, back-port it into `modules/<name>/` and update its CHANGELOG instead.
