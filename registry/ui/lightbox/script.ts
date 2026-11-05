// Lightbox behavior. One delegated click handler; each dialog is wired the first time it opens.
type Session = { dialog: HTMLDialogElement; items: HTMLAnchorElement[]; index: number };
const wired = new WeakSet<HTMLDialogElement>();
const sessions = new WeakMap<HTMLDialogElement, Session>();

const q = <T extends HTMLElement>(d: HTMLElement, sel: string) => d.querySelector<T>(sel)!;
const isRtl = () => getComputedStyle(document.documentElement).direction === "rtl";

function groupItems(group: string) {
  return [...document.querySelectorAll<HTMLAnchorElement>("a[data-lightbox]")].filter((a) => (a.dataset.lightbox ?? "") === group);
}

function show(s: Session, i: number) {
  const n = s.items.length;
  s.index = ((i % n) + n) % n;
  const a = s.items[s.index]!;
  const img = q<HTMLImageElement>(s.dialog, "[data-lightbox-img]");
  img.src = a.href;
  img.alt = a.querySelector("img")?.alt ?? a.getAttribute("aria-label") ?? "";
  q(s.dialog, "[data-lightbox-caption]").textContent = a.dataset.caption ?? "";
  q(s.dialog, "[data-lightbox-count]").textContent = n > 1 ? `${s.index + 1} / ${n}` : "";
  s.dialog.querySelectorAll<HTMLElement>("[data-lightbox-prev],[data-lightbox-next]").forEach((b) => (b.hidden = n < 2));
  // warm the neighbours so stepping through feels instant
  [s.index - 1, s.index + 1].forEach((j) => {
    const href = s.items[((j % n) + n) % n]?.href;
    if (href && n > 1) new Image().src = href;
  });
}

function wire(dialog: HTMLDialogElement) {
  if (wired.has(dialog)) return;
  wired.add(dialog);
  const step = (d: number) => {
    const s = sessions.get(dialog);
    if (s && s.items.length > 1) show(s, s.index + d);
  };
  q(dialog, "[data-lightbox-close]").addEventListener("click", () => dialog.close());
  q(dialog, "[data-lightbox-prev]").addEventListener("click", () => step(-1));
  q(dialog, "[data-lightbox-next]").addEventListener("click", () => step(1));
  // a click on the dark area (the dialog element itself) closes
  dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener("keydown", (e) => {
    const fwd = isRtl() ? "ArrowLeft" : "ArrowRight";
    const back = isRtl() ? "ArrowRight" : "ArrowLeft";
    if (e.key === fwd) { e.preventDefault(); step(1); }
    else if (e.key === back) { e.preventDefault(); step(-1); }
    else if (e.key === "Home") { e.preventDefault(); const s = sessions.get(dialog); if (s) show(s, 0); }
    else if (e.key === "End") { e.preventDefault(); const s = sessions.get(dialog); if (s) show(s, s.items.length - 1); }
    else if (e.key === "Tab") {
      // keep Tab inside the dialog (modal dialogs already inert the page; this stops it escaping to browser chrome)
      const f = [...dialog.querySelectorAll<HTMLElement>("button:not([hidden])")];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    }
  });
  // touch: horizontal swipe steps through the group
  let x0 = 0;
  dialog.addEventListener("pointerdown", (e) => { x0 = e.clientX; });
  dialog.addEventListener("pointerup", (e) => {
    const dx = e.clientX - x0;
    if (e.pointerType === "touch" && Math.abs(dx) > 50) step((dx < 0 ? 1 : -1) * (isRtl() ? -1 : 1));
  });
  dialog.addEventListener("close", () => { q<HTMLImageElement>(dialog, "[data-lightbox-img]").removeAttribute("src"); });
}

document.addEventListener("click", (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-lightbox]");
  if (!a) return;
  const group = a.dataset.lightbox ?? "";
  const dialog = [...document.querySelectorAll<HTMLDialogElement>("dialog[data-lightbox-dialog]")].find((d) => (d.dataset.lightboxDialog ?? "") === group);
  if (!dialog || typeof dialog.showModal !== "function") return; // no dialog support: the link just opens the image
  e.preventDefault();
  wire(dialog);
  const items = groupItems(group);
  const s: Session = { dialog, items, index: Math.max(0, items.indexOf(a)) };
  sessions.set(dialog, s);
  show(s, s.index);
  dialog.showModal();
});

export {}; // makes this file a module, so its top-level names stay private
