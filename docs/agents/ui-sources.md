# UI Sources — where to get components instead of building them

**Rule:** Check `registry/` first. Then use this list. Only build from scratch if nothing here fits,
and say why in your summary. Never search the open web for components before checking this list.

Status: compiled 2026-11, NOT yet link-checked — URLs and licenses change. If a link is dead or a license changed, update
this file and log it in `FEEDBACK.md`.

---

## 0. How to take a component (applies to every source)

**Astro rule first:** our sites are static Astro (D1). Pick the lightest form that works:
1. **Static section?** Port it to an `.astro` component (plain HTML + Tailwind). Zero JS shipped.
   Most "section" blocks (pricing, features, testimonials, footers) should end up like this, even if the
   source is React: copy the markup, drop the React.
2. **Needs interactivity or animation?** Keep it as a React component and use it as an island:
   `<Thing client:visible />` (or `client:idle`). Never `client:load` unless it's above the fold and essential.
3. **Plain scroll/entrance animation?** A `<script>` in the `.astro` component with GSAP is lighter than
   a React island. See `motion-and-3d.md`.
4. **Never hydrate a whole page** just to use one component.

1. **Prefer the CLI.** If the source is a shadcn-compatible registry, install via
   `npx shadcn@latest add <url-or-@namespace/name>` — don't copy-paste from the website.
   Namespaces are configured in `components.json` → `registries` (see bottom of this file).
2. **Check license before using.** Free/MIT = OK. "Pro", "Premium", "Commons Clause", or
   "personal use only" = only if listed in `client.yaml → licenses.owned`.
3. **Retheme immediately.** Replace every hardcoded color/font/radius/shadow with theme tokens
   (`bg-primary`, `text-foreground`, `rounded-[var(--radius)]`, etc.). No raw hex values survive.
4. **Strip what you don't need.** Remove demo props, unused variants, placeholder content.
5. **Wire to real data.** Replace demo arrays with module data / CMS content.
6. **Check deps.** If it pulls a new heavy dependency, see AGENTS.md §6 (approval needed).
7. **A11y + responsive pass.** Keyboard reachable, focus visible, alt text, works at 390px.
8. **Log it** in `registry/PROVENANCE.md`.
9. **If it turned out great, harvest it** to `registry/` (`/harvest`). That's how our library grows.

---

## 1. Foundations (forms, dialogs, tables, admin UI)

| Source | URL | Best for | License |
|---|---|---|---|
| shadcn/ui | https://ui.shadcn.com | The base. Buttons, inputs, dialog, sheet, table, calendar, charts, sidebar | MIT |
| shadcn blocks (official) | https://ui.shadcn.com/blocks | Admin dashboards, login pages, sidebars | MIT |
| shadcn registry directory | https://ui.shadcn.com/docs/directory | Index of community registries installable via CLI | varies |
| Origin UI / coss | https://originui.com | Very polished inputs, selects, date/time pickers, steppers — great for booking forms | MIT |
| Radix Primitives | https://www.radix-ui.com | Unstyled accessible primitives when shadcn lacks one | MIT |
| TanStack Table | https://tanstack.com/table | Admin data tables (bookings, subscribers) | MIT |

**Admin dashboard rule:** admin UI stays plain shadcn. No fancy animation in admin. Speed + clarity.

## 2. Marketing sections & landing blocks

| Source | URL | Best for | License |
|---|---|---|---|
| Tailark | https://tailark.com | Hero, features, pricing, testimonials, footers — shadcn-based | MIT (check pro) |
| shadcnblocks | https://www.shadcnblocks.com | Large library of sections | free + pro |
| HyperUI | https://www.hyperui.dev | Plain Tailwind sections, zero deps | MIT |
| 21st.dev | https://21st.dev | Community component marketplace, CLI-installable | per component |

## 3. Animated / "wow" components

| Source | URL | Best for | License |
|---|---|---|---|
| Magic UI | https://magicui.design | Marquees, number tickers, bento grids, shimmer buttons, globe, particles | MIT + pro |
| Aceternity UI | https://ui.aceternity.com | Spotlight, 3D cards, parallax scroll, lamp, background beams, sticky scroll reveal | free + pro |
| React Bits | https://reactbits.dev | Text animations (split, blur, scramble), cursor effects, WebGL backgrounds | check (MIT + Commons Clause) |
| Motion Primitives | https://motion-primitives.com | Tasteful micro-interactions: text effects, morphing dialogs, carousels | MIT |
| Animate UI | https://animate-ui.com | Animated shadcn-style components | MIT |
| Kokonut UI | https://kokonutui.com | Modern animated cards, buttons, AI-style inputs | MIT |
| Cult UI | https://www.cult-ui.com | Expandable cards, dynamic island, texture buttons | MIT |
| Skiper UI | https://skiper-ui.com | Awwwards-style interactions | free + pro |
| Animata | https://animata.design | Hand-crafted micro animations | MIT |
| Eldora UI | https://www.eldoraui.site | Animated sections | MIT |

## 4. Motion, scroll, 3D — see `motion-and-3d.md` for rules

| Source | URL | Use for |
|---|---|---|
| GSAP (+ ScrollTrigger, SplitText, Flip, MorphSVG — all free) | https://gsap.com | Scroll storytelling, pinned sections, text reveals, timelines |
| Motion (formerly Framer Motion) | https://motion.dev | Component-level animation, layout animation, gestures, exit animations |
| Lenis | https://lenis.darkroom.engineering | Smooth scroll |
| React Three Fiber | https://r3f.docs.pmnd.rs | Three.js in React |
| drei | https://drei.docs.pmnd.rs | R3F helpers: environment, text, float, scroll controls, models |
| @react-three/postprocessing | https://github.com/pmndrs/react-postprocessing | Bloom, noise, chromatic aberration |
| Spline | https://spline.design | Designer-made 3D scenes, embedded via `@splinetool/react-spline` |
| Rive | https://rive.app | Interactive vector animations (mascots, animated icons) |
| LottieFiles | https://lottiefiles.com | Lightweight vector animations (`@lottiefiles/dotlottie-react`) |
| Unicorn Studio | https://www.unicorn.studio | No-code WebGL effects / shader backgrounds |
| ShaderGradient | https://shadergradient.co | Animated mesh gradient backgrounds |

## 5. Effect recipes & tutorials (code to adapt, not install)

| Source | URL | Use for |
|---|---|---|
| Codrops | https://tympanus.net/codrops | Best source of awwwards-grade effects with demo source (image distortion, page transitions, WebGL) |
| GSAP demos / CodePen collection | https://gsap.com/demos | Official ScrollTrigger/SplitText examples |
| Three.js examples | https://threejs.org/examples | Reference for any Three feature |
| pmndrs examples | https://r3f.docs.pmnd.rs/getting-started/examples | R3F scene patterns |

Codrops demos: check each repo's license (most are MIT). Credit in PROVENANCE.

## 6. 3D assets

| Source | URL | License note |
|---|---|---|
| Poly Haven | https://polyhaven.com | HDRIs, textures, models — CC0 |
| pmndrs market | https://market.pmnd.rs | Optimized models — mostly CC0 |
| Sketchfab | https://sketchfab.com | Per-model license — CC-BY needs credit, check "downloadable" |
| Kenney | https://kenney.nl | Stylized assets — CC0 |

Always run models through `gltf-transform` / `gltfjsx --transform` (Draco/Meshopt + resized textures).
Target: < 2 MB per model.

## 7. Icons, illustrations, fonts

- Icons: lucide-react (default, comes with shadcn), Phosphor (https://phosphoricons.com), Iconify
- Illustrations: unDraw, Open Peeps, Humaaans
- Fonts: Google Fonts self-hosted through Astro (no runtime CDN, CSP); Fontshare (https://www.fontshare.com) for free premium-feel faces
- Food images: client-supplied first; Unsplash/Pexels only as placeholders, flagged `TODO: replace`

## 8. Inspiration only (never copy code, never clone a site)

Awwwards (https://www.awwwards.com), Godly (https://godly.website), Land-book, Lapa Ninja,
SiteInspire, Mobbin. Use these to pick a *direction* that matches `brand.vibe`, then build it from
the sources above. **Never recreate a specific site's design** — take patterns, not layouts.

---

## components.json registries (paste into the client project)

```json
{
  "registries": {
    "@kit": "https://REPLACE-with-our-registry-url/r/{name}.json",
    "@magicui": "https://magicui.design/r/{name}.json",
    "@aceternity": "https://ui.aceternity.com/registry/{name}.json"
  }
}
```

> Verify each registry URL against the source's docs when setting up — formats change.
> Then: `npx shadcn@latest add @magicui/marquee @kit/menu-tabs`

## Quick picker (common restaurant/cafe needs)

| Need | First choice |
|---|---|
| Menu with category tabs | `registry/` → else shadcn Tabs + Motion layout animation |
| Booking date/time picker | Origin UI date picker + shadcn Calendar |
| Pricing / subscription plans | Tailark pricing → retheme |
| Testimonials | Magic UI marquee |
| Image gallery | Aceternity parallax scroll / layout grid |
| Hero | depends on `motion.level` — see motion-and-3d.md |
| Number stats ("10k coffees served") | Magic UI number ticker |
| Instagram feed strip | Magic UI marquee with images |
| Admin tables | shadcn data-table + TanStack |
