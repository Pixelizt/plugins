// Hero entrance + image drift. gsap.matchMedia owns the reduced-motion gate and the cleanup: when the
// preference flips, or the page is swapped, everything below is reverted (tweens killed, inline styles cleared).
// gsap is imported dynamically AFTER the reduced-motion check, so those visitors never download it.
const wantsMotion = () => !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
type MM = ReturnType<(typeof import("gsap"))["gsap"]["matchMedia"]>;
let mm: MM | undefined;
let ranFor: Element | null = null; // the <body> we already set up (astro:page-load also fires on first load)

async function init() {
  const heroes = [...document.querySelectorAll<HTMLElement>("[data-hero-stagger]")];
  const frames = [...document.querySelectorAll<HTMLElement>("[data-drift-frame]")];
  if (!heroes.length && !frames.length) return;
  if (!wantsMotion()) return; // content is already visible; nothing to do
  if (ranFor === document.body) return;
  ranFor = document.body;

  const { gsap } = await import("gsap");
  const { ScrollTrigger } = frames.length ? await import("gsap/ScrollTrigger") : { ScrollTrigger: undefined };
  if (ScrollTrigger) gsap.registerPlugin(ScrollTrigger);

  mm?.revert();
  mm = gsap.matchMedia();
  mm.add("(prefers-reduced-motion: no-preference)", () => {
    for (const hero of heroes) {
      gsap.from(hero.children, {
        y: 28,
        opacity: 0,
        duration: 0.7,
        ease: "power2.out",
        stagger: Number(hero.dataset.stagger) || 0.07,
        delay: Number(hero.dataset.delay) || 0,
        clearProps: "opacity,transform", // hand the elements back to CSS (hover transforms etc.)
      });
    }
    if (ScrollTrigger) {
      for (const frame of frames) {
        const img = frame.querySelector<HTMLElement>("[data-drift]");
        if (!img) continue;
        const amount = Number(frame.dataset.amount) || 5;
        const scale = 1 + (amount * 2 + 1) / 100; // enough overscan to cover the drift
        gsap.fromTo(
          img,
          { yPercent: -amount, scale },
          {
            yPercent: amount,
            scale,
            ease: "none", // scrub maps scroll position 1:1; easing would make it feel laggy
            scrollTrigger: { trigger: frame, start: "top bottom", end: "bottom top", scrub: 0.6 },
          },
        );
      }
      // photos that land after the first measurement would otherwise start from stale positions
      window.addEventListener("load", () => ScrollTrigger.refresh(), { once: true });
    }
  });
}

void init();
// Astro view transitions: rebuild after each navigation, clean up before the swap.
document.addEventListener("astro:page-load", () => void init());
document.addEventListener("astro:before-swap", () => { mm?.revert(); mm = undefined; });

export {}; // makes this file a module, so its top-level names stay private
