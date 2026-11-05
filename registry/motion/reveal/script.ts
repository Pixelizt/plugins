// Reveal script. Safe to import from several components: ES modules run once, and init() is idempotent.
// Rules: transform/opacity only, one shared observer, nothing hidden for visitors who asked for less motion,
// nothing hidden that is already on screen (so there is no flash on load).
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
let observer: IntersectionObserver | null = null;

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        (e.target as HTMLElement).dataset.revealState = "shown";
        observer?.unobserve(e.target);
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  return observer;
}

function init() {
  if (reduce.matches || !("IntersectionObserver" in window)) return;
  const io = getObserver();
  const vh = window.innerHeight;
  document.querySelectorAll<HTMLElement>("[data-reveal]:not([data-reveal-state])").forEach((el) => {
    // stagger: index among the revealing siblings of a [data-reveal-stagger] parent (capped so late items don't wait long)
    const parent = el.parentElement;
    if (parent?.hasAttribute("data-reveal-stagger")) {
      const siblings = [...parent.children].filter((c) => c.hasAttribute("data-reveal"));
      el.style.setProperty("--reveal-i", String(Math.min(siblings.indexOf(el), 8)));
    }
    if (el.dataset.revealDelay) el.style.setProperty("--reveal-delay", `${Number(el.dataset.revealDelay) || 0}ms`);
    // already in view (or above the fold on load): leave it alone, it is visible
    const r = el.getBoundingClientRect();
    if (r.top < vh * 0.92 && r.bottom > 0) {
      el.dataset.revealState = "shown";
      return;
    }
    el.dataset.revealState = "hidden";
    io.observe(el);
  });
}

init();
// With Astro view transitions the DOM is swapped, so scan again after each navigation.
document.addEventListener("astro:page-load", init);

export {}; // makes this file a module, so its top-level names stay private
