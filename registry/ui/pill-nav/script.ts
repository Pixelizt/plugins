// Pill nav behavior: toggle, Escape / outside click / link click to close, scroll shadow.
// One passive scroll listener, coalesced to one write per frame.
const DESKTOP = window.matchMedia("(min-width: 48rem)");
const bars = new Set<HTMLElement>();
let queued = false;

function setOpen(root: HTMLElement, open: boolean, returnFocus = false) {
  const toggle = root.querySelector<HTMLButtonElement>("[data-pill-nav-toggle]");
  const panel = root.querySelector<HTMLElement>("[data-pill-nav-panel]");
  if (!toggle || !panel) return;
  toggle.setAttribute("aria-expanded", String(open));
  if (open) panel.setAttribute("data-open", "");
  else panel.removeAttribute("data-open");
  if (!open && returnFocus) toggle.focus();
}

function init() {
  document.querySelectorAll<HTMLElement>("[data-pill-nav]").forEach((root) => {
    if (root.dataset.ready) return;
    root.dataset.ready = "";
    const bar = root.querySelector<HTMLElement>(".pill-nav-bar");
    if (bar) bars.add(bar);
    const toggle = root.querySelector<HTMLButtonElement>("[data-pill-nav-toggle]");
    toggle?.addEventListener("click", () => setOpen(root, toggle.getAttribute("aria-expanded") !== "true"));
    root.querySelectorAll("[data-pill-nav-panel] a").forEach((a) => a.addEventListener("click", () => setOpen(root, false)));
    root.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && toggle?.getAttribute("aria-expanded") === "true") {
        e.stopPropagation();
        setOpen(root, false, true);
      }
    });
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target as Node)) setOpen(root, false);
    });
    // Leaving the mobile layout while open must not leave the menu stuck open.
    DESKTOP.addEventListener("change", () => setOpen(root, false));
  });
  frame();
}

function frame() {
  queued = false;
  const scrolled = window.scrollY > 40;
  bars.forEach((b) => b.toggleAttribute("data-scrolled", scrolled));
}

window.addEventListener(
  "scroll",
  () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(frame);
    }
  },
  { passive: true },
);

init();
document.addEventListener("astro:page-load", init);

export {}; // makes this file a module, so its top-level names stay private
