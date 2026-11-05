export {}; // makes this a module, so its names stay local
// Gallery lightbox on a native <dialog> (focus stays inside, Esc closes). Adds arrow keys, a Tab loop over the
// buttons, a click on the backdrop to close, and returns focus to the photo that was opened. Without JS or
// <dialog> support the links simply open the image.
const dlg = document.querySelector<HTMLDialogElement>("[data-lightbox-dialog]");

if (dlg && typeof dlg.showModal === "function") {
  const img = dlg.querySelector<HTMLImageElement>("[data-lb-img]")!;
  const cap = dlg.querySelector<HTMLElement>("[data-lb-caption]")!;
  const count = dlg.querySelector<HTMLElement>("[data-lb-count]")!;
  const buttons = Array.from(dlg.querySelectorAll<HTMLButtonElement>("button"));
  let items: HTMLAnchorElement[] = [];
  let i = 0;
  let opener: HTMLElement | null = null;

  const show = (n: number) => {
    i = (n + items.length) % items.length;
    const a = items[i]!;
    img.src = a.href;
    img.alt = a.dataset.alt ?? "";
    cap.textContent = a.dataset.caption ?? "";
    cap.hidden = !a.dataset.caption;
    count.textContent = `Image ${i + 1} of ${items.length}`; // read out by screen readers
  };
  const single = () => items.length < 2;

  document.addEventListener("click", (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>("a[data-lightbox]");
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    opener = a;
    items = Array.from((a.closest("[data-kit-list]") ?? document).querySelectorAll<HTMLAnchorElement>("a[data-lightbox]"));
    dlg.querySelectorAll<HTMLButtonElement>("[data-lb-prev], [data-lb-next]").forEach((b) => (b.hidden = single()));
    show(items.indexOf(a));
    dlg.showModal();
    dlg.querySelector<HTMLButtonElement>("[data-lb-close]")!.focus();
  });

  dlg.addEventListener("click", (e) => {
    const t = e.target as Element;
    if (t === dlg || t.closest("[data-lb-close]")) dlg.close();
    else if (t.closest("[data-lb-prev]")) show(i - 1);
    else if (t.closest("[data-lb-next]")) show(i + 1);
  });

  dlg.addEventListener("keydown", (e) => {
    const rtl = getComputedStyle(dlg).direction === "rtl";
    if (e.key === "ArrowRight" && !single()) show(rtl ? i - 1 : i + 1);
    else if (e.key === "ArrowLeft" && !single()) show(rtl ? i + 1 : i - 1);
    else if (e.key === "Tab") {
      const open = buttons.filter((b) => !b.hidden);
      const first = open[0]!;
      const last = open[open.length - 1]!;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  dlg.addEventListener("close", () => {
    img.removeAttribute("src");
    opener?.focus();
  });
}
