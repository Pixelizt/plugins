// ScrollDrift: one passive scroll listener, coalesced into one frame. Layout is measured on resize, never per
// scroll tick; the per-frame work is arithmetic plus a single transform write per element.
interface Drift {
  el: HTMLElement;
  column: HTMLElement | null;
  start: number;
  swap: number;
  bob: number;
  rotate: number;
  gutter: number; // free space between the viewport edge and the content text, one side
  w: number;
  h: number;
}

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const items: Drift[] = [];
let vw = 0;
let queued = false;
let bound = false;

function widest(selector: string): HTMLElement | null {
  let best: HTMLElement | null = null;
  document.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    if (!best || el.offsetWidth > best.offsetWidth) best = el;
  });
  return best;
}

function measure() {
  vw = document.documentElement.clientWidth; // not innerWidth: the scrollbar would skew the far-side swing
  for (const d of items) {
    d.w = d.el.offsetWidth;
    d.h = d.el.offsetHeight;
    if (!d.column) { d.gutter = 0; continue; }
    const box = d.column.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(d.column).paddingInlineStart) || 0;
    d.gutter = Math.min(box.x, vw - (box.x + box.width)) + pad;
  }
}

function tick() {
  queued = false;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  const y = window.scrollY;
  const p = y / max;
  const rtl = getComputedStyle(document.documentElement).direction === "rtl";
  for (const d of items) {
    // any narrower than the rotated bounding circle and the element would clip on the viewport edge or the text
    const room = d.w > 0 && d.gutter >= Math.hypot(d.w, d.h); // w is 0 while the element is display:none (below lg)
    const on = room && y > window.innerHeight * d.start && p < 0.97;
    d.el.toggleAttribute("data-on", on);
    if (!room) continue;
    // centred in the gutter beside the content column, swapping sides every few screens
    const side = Math.floor(y / (window.innerHeight * d.swap)) % 2;
    let x = (d.gutter - d.w) / 2;
    if (side) x = vw - d.w - x;
    const dy = Math.sin(p * Math.PI * 6) * d.bob;
    const r = Math.sin(p * Math.PI * 5) * d.rotate;
    // the element is pinned with inset-inline-start, which is the far edge in RTL, so the drift mirrors too
    d.el.style.transform = `translate3d(${rtl ? -x : x}px,${dy}px,0) rotate(${r}deg)`;
  }
}

function schedule() {
  if (!queued) {
    queued = true;
    requestAnimationFrame(tick);
  }
}

function init() {
  if (reduce.matches) return;
  document.querySelectorAll<HTMLElement>("[data-scroll-drift]:not([data-ready])").forEach((el) => {
    el.setAttribute("data-ready", "");
    items.push({
      el,
      column: widest(el.dataset.column || "#main .wrap"),
      start: Number(el.dataset.start) || 0,
      swap: Number(el.dataset.swap) || 2.2,
      bob: Number(el.dataset.bob) || 0,
      rotate: Number(el.dataset.rotate) || 0,
      gutter: 0, w: 0, h: 0,
    });
  });
  if (!items.length) return;
  measure();
  tick();
  if (!bound) {
    bound = true;
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", () => { measure(); schedule(); });
    window.addEventListener("load", () => { measure(); schedule(); }, { once: true }); // late images shift the layout
  }
}

init();
document.addEventListener("astro:page-load", () => {
  items.length = 0; // after a view-transition swap the old elements are gone
  document.querySelectorAll("[data-scroll-drift][data-ready]").forEach((el) => el.removeAttribute("data-ready"));
  init();
});

export {}; // makes this file a module, so its top-level names stay private
