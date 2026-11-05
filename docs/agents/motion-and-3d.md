# Motion & 3D — how to make sites feel premium without wrecking them

We want sites that feel **alive and award-worthy** — not template-y. But motion done badly is worse
than none: janky scroll, 6 MB hero, nausea on mobile. This doc is how to get the first without the second.

---

## 1. Motion levels (set in `client.yaml → motion.level`)

| Level | Feel | Allowed |
|---|---|---|
| `subtle` | Clean, professional | Motion only: fade/slide-in on scroll, hover states, layout transitions. No GSAP pinning, no 3D, no smooth scroll unless asked |
| `expressive` (default) | Memorable, playful | + GSAP ScrollTrigger reveals, SplitText headings, Lenis, marquees, parallax, magnetic buttons, one lightweight 3D/Spline/shader element |
| `awwwards` | Experimental, showpiece | + pinned scroll storytelling, full R3F hero scene, shaders/postprocessing, custom cursor, page transitions, image distortion effects |

Never exceed the level. If a client "wants something cooler", propose moving the level up in
`client.yaml` — don't silently escalate.

## 2. Tool choice — one job per tool

| Job | Use | Not |
|---|---|---|
| Component enter/exit, hover, tap, layout shifts, shared-element transitions | **Motion** (`motion/react`) | GSAP |
| Scroll-driven timelines, pinning, scrubbing, text splitting, complex sequences | **GSAP** + ScrollTrigger + SplitText | Motion `useScroll` for anything beyond simple parallax |
| Smooth scrolling | **Lenis** (synced to ScrollTrigger) | CSS `scroll-behavior`, Locomotive |
| 3D scenes in code | **React Three Fiber + drei** | raw Three.js imperative code in components |
| Designer-made 3D | **Spline** | — |
| Interactive vector / mascot | **Rive** | — |
| Simple looping vector | **Lottie** (dotLottie) | GIF / video |
| Shader backgrounds | R3F shaderMaterial, ShaderGradient, or Unicorn Studio | — |

**Never animate the same element with both GSAP and Motion.** Pick one per element.

## 3. Setup patterns (copy these)

### Lenis + GSAP ScrollTrigger: one script in the base layout (Astro)
```astro
<!-- src/components/SmoothScroll.astro, included once in the base layout -->
<script>
  import Lenis from "lenis";
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  gsap.registerPlugin(ScrollTrigger);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const lenis = new Lenis();
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
</script>
```
Astro bundles `<script>` tags as modules served from our own origin, so this works with the strict CSP.

### GSAP in an Astro component (preferred for static sections, no React needed)
```astro
<section data-reveal> ... </section>
<script>
  import gsap from "gsap";
  import { ScrollTrigger } from "gsap/ScrollTrigger";
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
    document.querySelectorAll("[data-reveal]").forEach((el) =>
      gsap.from(el.children, { y: 40, opacity: 0, stagger: 0.08,
        scrollTrigger: { trigger: el, start: "top 80%" } }));
  });
</script>
```
If the site uses Astro view transitions, re-run init on `astro:page-load` and kill triggers on `astro:before-swap`.

### GSAP inside a React island: always `useGSAP` with a scope (auto-cleanup)
```tsx
import { useGSAP } from "@gsap/react";
const ref = useRef<HTMLDivElement>(null);
useGSAP(() => {
  const mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    gsap.from(".reveal", { y: 40, opacity: 0, stagger: 0.08,
      scrollTrigger: { trigger: ref.current, start: "top 80%" } });
  });
}, { scope: ref });
```

### 3D: always an island, client-only, with a poster fallback
```astro
<div class="hero-3d">
  <img src={poster.src} alt="" class="hero-poster" />   <!-- real image, so LCP isn't blocked -->
  <HeroScene client:only="react" />                     <!-- R3F canvas mounts over the poster -->
</div>
```
- `<Canvas dpr={[1, 1.75]}>`, `frameloop="demand"` when the scene is static
- Pause rendering when off-screen (drei `<View>` / IntersectionObserver)
- Mobile: simpler scene or the static poster image
- The poster is a real image of the scene, so LCP isn't blocked by WebGL. Hide it once the canvas renders

## 4. Signature effect menu (pick 2–4 per site, matched to `brand.vibe`)

**Text:** SplitText line/char reveals · scramble text · variable-font weight on scroll · marquee headlines · text along a path
**Scroll:** pinned horizontal scroll gallery · sticky stacking cards · scrub-driven image sequence (e.g. coffee pour) · parallax layers · section color transitions
**Cursor/hover:** magnetic buttons · custom cursor with blend mode · image reveal on hover over menu items · tilt cards
**3D/WebGL:** floating product model (cup, plate, bottle) tilting with cursor · shader gradient background · image distortion on hover (Codrops style) · particles forming the logo
**Page:** route transitions (View Transitions API / Motion `AnimatePresence`) · preloader with progress → hero reveal

Food & cafe sites in particular: **the food is the hero**. Effects should make menu photos look
better (reveal, parallax, hover zoom), not compete with them.

## 5. Hard performance & accessibility rules

- **`prefers-reduced-motion`**: every animation is gated (GSAP `matchMedia`, Motion `useReducedMotion`). Content must be fully visible with motion off.
- **Animate only `transform` and `opacity`** (and CSS variables / filters sparingly). Never animate `width/height/top/left`.
- **No content hidden waiting for JS.** If JS fails, text is still visible (set initial hidden states inside the animation, not in CSS).
- **Budgets (mobile):** JS for motion+3D ≤ 250 kB gz on the home page; 3D model ≤ 2 MB; hero LCP ≤ 2.5 s.
- **One WebGL canvas per page** max (use drei `<View>` for multiple scenes).
- **Dispose** geometries/textures on unmount; kill ScrollTriggers (useGSAP handles this).
- **Test on a mid-range Android** (or Chrome CPU 4× throttle). If it stutters, downgrade the effect.
- **Forms, menus, booking flows: functional first.** No animation may delay a user from booking.

## 6. Process for any motion task

1. Read `client.yaml` → `motion`, `brand.vibe`, `brand.references`.
2. Propose the effect plan in 3–6 bullets (which effect, where, which tool) **before building**.
3. Check `registry/motion/` for an existing implementation.
4. Then check sources in `ui-sources.md` §3–5.
5. Build, then verify: screenshots, a short screen recording if possible, reduced-motion check, Lighthouse mobile.
6. If an effect turned out great → `/harvest` it into `registry/motion/`.
