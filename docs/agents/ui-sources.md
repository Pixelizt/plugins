# UI Sources — where to get components instead of building them

**Rule:** Check `registry/` first. Then pull or adapt a component from this list. Only build from scratch if nothing here fits,
and say why in your summary. Never search the open web for components before checking this list.

These libraries are **approved sources**, not the site's UI framework and not the admin's implementation.
The admin (`modules/admin`) is a custom Tailwind React app: token utilities, no animation. When a generated
admin view is not enough, adapt a plain widget from this list and retheme it. Do not rebuild `/admin` on shadcn.

Status: compiled 2026-11. The sources named by the owner (shadcn/ui, 21st.dev, Astro components, GSAP,
Aceternity, Magic UI, Awwwards, awesome-ui lists, rareui.com, kobra.systems, easyui.site, pinui.xyz, Three.js)
were checked against each site or its repo on 2026-11-05. Other rows are still not fully link-checked.
URLs and licenses change. If a link is dead or a license changed, update this file and log it in `FEEDBACK.md`.

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

## 1. Foundations (forms, dialogs, tables)

| Source | URL | Best for | License |
|---|---|---|---|
| shadcn/ui | https://ui.shadcn.com | Copy-in buttons, inputs, dialog, sheet, table, calendar, charts, sidebar. One source among many, not the admin framework | MIT (`github.com/shadcn-ui/ui`). Keep the copyright notice |
| shadcn blocks (official) | https://ui.shadcn.com/blocks | Dashboard, login and sidebar layouts to adapt | MIT |
| shadcn registry directory | https://ui.shadcn.com/docs/directory | Index of community registries installable via CLI | varies — verify license before use |
| Kobra | https://kobra.systems | Accessible React components (tables, inputs, chat, media) on Tailwind + Base UI. Free set is 11 components | Free components: **personal use only** (site terms). Paid seat license: commercial client work, no redistributing the source as a kit. Do not use the free set on a client site |
| Origin UI / coss | https://originui.com | Very polished inputs, selects, date/time pickers, steppers — great for booking forms | MIT |
| Radix Primitives | https://www.radix-ui.com | Unstyled accessible primitives when a copied component lacks one | MIT |
| TanStack Table | https://tanstack.com/table | Data tables (bookings, subscribers) when you need sorting and filters beyond the generated admin list | MIT |

**Admin:** stays custom Tailwind, plain, no animation. Speed and clarity. Pull a widget from this list only for a custom view the schema cannot generate.

## 2. Marketing sections & landing blocks

| Source | URL | Best for | License |
|---|---|---|---|
| Astro components | https://docs.astro.build/en/basics/astro-components/ and https://astro.build/themes | Static sections (zero JS). Port marketing blocks to `.astro` even when the source is React. Themes on the catalog are a starting point | The Astro framework is MIT. Each theme has its own license — verify license before use. Do not copy the astro.build site design |
| Tailark | https://tailark.com | Hero, features, pricing, testimonials, footers | MIT (check pro) |
| shadcnblocks | https://www.shadcnblocks.com | Large library of sections | free + pro — verify license before use |
| HyperUI | https://www.hyperui.dev | Plain Tailwind sections, zero deps | MIT |
| 21st.dev | https://21st.dev | Community React + Tailwind components, themes and templates. Copy, or `npx shadcn@latest add "https://21st.dev/r/author/component-name"` | Component code is generally MIT (the registry repo is MIT; keep the notice). Authors own each component: check its page. Do not copy demos, previews or media. Republishing a component needs a visible link back to its 21st.dev page (site terms) |

## 3. Animated / "wow" components

| Source | URL | Best for | License |
|---|---|---|---|
| Magic UI | https://magicui.design | Marquees, number tickers, bento grids, shimmer buttons, globe, particles | Free library: MIT (`github.com/magicuidesign/magicui`). Pro sections and templates: paid license, commercial use in client sites, no reselling or redistributing the code (`pro.magicui.design/license`) |
| Aceternity UI | https://ui.aceternity.com | Spotlight, 3D cards, parallax scroll, lamp, background beams, sticky scroll reveal | Aceternity License (`ui.aceternity.com/licence`): free and paid items may be used in unlimited personal and commercial end products (client sites). Do not redistribute the source or sell it as a template or component library. Pro blocks and templates need a license listed in `client.yaml → licenses.owned` |
| React Bits | https://reactbits.dev | Text animations (split, blur, scramble), cursor effects, WebGL backgrounds | check (MIT + Commons Clause) |
| Motion Primitives | https://motion-primitives.com | Tasteful micro-interactions: text effects, morphing dialogs, carousels | MIT |
| Animate UI | https://animate-ui.com | Animated shadcn-style components | MIT |
| Kokonut UI | https://kokonutui.com | Modern animated cards, buttons, AI-style inputs | MIT |
| Cult UI | https://www.cult-ui.com | Expandable cards, dynamic island, texture buttons | MIT |
| Skiper UI | https://skiper-ui.com | Awwwards-style interactions | free + pro |
| Animata | https://animata.design | Hand-crafted micro animations | MIT |
| Eldora UI | https://www.eldoraui.site | Animated sections | MIT |
| EasyUI | https://easyui.site | Animated React components (charts, accordions, navigation, tables) with Tailwind and Motion. shadcn-registry install | MIT (`github.com/Surajmaurya1/easyui`). A different product, easyui.pro, is not this library — verify license before use if you land there |
| Pin UI | https://pinui.xyz | Distinctive animated components and Blocx page sections (heroes, pricing, footers), rebuilt from pinned designs. `npx shadcn@latest add "https://pinui.xyz/r/<name>.json"` | Components: MIT, per the GitHub repo (`Rachit315/Pin-UI`). The Pin UI name, logo and demo media are excluded |
| Rare UI | https://rareui.com | Unusual animated React components (glass, spring, WebGL orbs) as a shadcn registry: `npx shadcn@latest add swamimalode07/rare-ui/<name>` | MIT + Commons Clause + attribution (`github.com/swamimalode07/rare-ui`). Commercial use inside a client site is allowed. Ship a visible link to rareui.com (footer, about or credits) and keep the copyright notice in the copied source. Do not sell, sublicense, redistribute, or port the components, and do not harvest them into `registry/` |

## 4. Motion, scroll, 3D — see `motion-and-3d.md` for rules

| Source | URL | Use for | License |
|---|---|---|---|
| GSAP (+ ScrollTrigger, SplitText, Flip, MorphSVG) | https://gsap.com | Scroll storytelling, pinned sections, text reveals, timelines. Already a starter dependency | Standard "No Charge" license (`gsap.com/standard-license`, Webflow). Free for commercial websites, including the former Club plugins. Not MIT: do not use it to build a no-code visual animation tool that competes with Webflow. Keep proprietary notices |
| Motion (formerly Framer Motion) | https://motion.dev | Component-level animation, layout animation, gestures, exit animations | MIT |
| Lenis | https://lenis.darkroom.engineering | Smooth scroll | MIT |
| Three.js | https://threejs.org | WebGL/WebGPU scenes in an island when React Three Fiber is more than you need. Examples: https://threejs.org/examples | MIT (`github.com/mrdoob/three.js`). Example *assets* (models, textures) can have a different license — verify license before use |
| React Three Fiber | https://r3f.docs.pmnd.rs | Three.js in React | MIT |
| drei | https://drei.docs.pmnd.rs | R3F helpers: environment, text, float, scroll controls, models | MIT |
| @react-three/postprocessing | https://github.com/pmndrs/react-postprocessing | Bloom, noise, chromatic aberration | MIT |
| Spline | https://spline.design | Designer-made 3D scenes, embedded via `@splinetool/react-spline` | verify license before use |
| Rive | https://rive.app | Interactive vector animations (mascots, animated icons) | verify license before use |
| LottieFiles | https://lottiefiles.com | Lightweight vector animations (`@lottiefiles/dotlottie-react`) | Player is typically open source; each animation file has its own license — verify license before use |
| Unicorn Studio | https://www.unicorn.studio | No-code WebGL effects / shader backgrounds | verify license before use |
| ShaderGradient | https://shadergradient.co | Animated mesh gradient backgrounds | verify license before use |

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

- Icons: lucide-react (ISC), Phosphor (https://phosphoricons.com), Iconify. Lucide is the usual pick; it is not tied to using shadcn
- Illustrations: unDraw, Open Peeps, Humaaans
- Fonts: Google Fonts self-hosted through Astro (no runtime CDN, CSP); Fontshare (https://www.fontshare.com) for free premium-feel faces
- Food images: client-supplied first; Unsplash/Pexels only as placeholders, flagged `TODO: replace`

## 8. Inspiration and indexes (never copy a site)

| Source | URL | Use for | License |
|---|---|---|---|
| Awwwards | https://www.awwwards.com | Direction only: motion, type, pacing that matches `brand.vibe` | Inspiration only. Designs and case-study code on the site are not licensed for reuse. Do not copy layouts, copy or code |
| Godly, Land-book, Lapa Ninja, SiteInspire, Mobbin | https://godly.website | Same: pick a direction, then build it from the sources above | Inspiration only. verify license before use — these are galleries, not component licenses |
| Awesome-ui style lists | https://github.com/aniftyco/awesome-tailwindcss (and other `awesome-*` UI lists) | Finding a library that this file does not already name. The list is an index, not code | `awesome-tailwindcss` itself is CC0. Every linked project has its own license — verify license before use |

**Never recreate a specific site's design.** Take patterns, then implement them from `registry/` or the sources above.

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

> `@kit` is a **future step**. The kit does not publish a registry yet (README roadmap). Leave `https://REPLACE-with-our-registry-url/r/{name}.json` as-is until that ships; do not invent a host.
> Verify each other registry URL against the source's docs when setting up — formats change.
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
| Admin tables | The generated admin list (custom Tailwind). A custom view that needs more: TanStack Table, or a table adapted from shadcn or Kobra (paid license for Kobra) |
