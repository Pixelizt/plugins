---
name: add-motion
description: Add animation, scroll effects, smooth scrolling or 3D (GSAP, Motion, Lenis, Three.js, Spline, Rive, shaders) at the client's motion level. Use for "make it feel premium/awwwards", hero scenes, scroll storytelling, hover effects.
argument-hint: <client-slug> [section or effect]
---

1. Read `docs/agents/motion-and-3d.md` fully, plus `client.yaml → motion`, `brand.vibe`, `brand.references`.
2. Propose an effect plan: 3–6 bullets — effect, where, tool, why it fits the vibe. Stay within `motion.level`. Wait for approval unless the user already specified the effect.
3. Check `registry/motion/`, then ui-sources.md §3–5 (Codrops, GSAP demos, Aceternity, React Bits, drei examples).
4. Build using the setup patterns in motion-and-3d.md §3 (useGSAP with scope, single Lenis provider, lazy 3D with poster fallback).
5. Verify: reduced-motion on/off, 390px, CPU 4x throttle, Lighthouse mobile within budget (§5). Downgrade any effect that stutters.
6. Log sources in PROVENANCE. Suggest `/harvest` for standout effects.
