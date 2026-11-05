import { moveTab } from "./logic.ts";

function show(tabs: HTMLButtonElement[], panels: HTMLElement[], index: number, focus: boolean) {
  tabs.forEach((tab, i) => {
    const on = i === index;
    tab.setAttribute("aria-selected", on ? "true" : "false");
    tab.tabIndex = on ? 0 : -1;
    const panel = panels[i];
    if (panel) panel.hidden = !on;
  });
  if (focus) tabs[index]?.focus();
}

function init(root: HTMLElement) {
  const tabs = [...root.querySelectorAll<HTMLButtonElement>("[role='tab']")];
  const panels = [...root.querySelectorAll<HTMLElement>("[role='tabpanel']")];
  if (!tabs.length) return;
  const rtl = () => getComputedStyle(root).direction === "rtl";
  tabs.forEach((tab, i) => tab.addEventListener("click", () => show(tabs, panels, i, false)));
  root.addEventListener("keydown", (event) => {
    const current = tabs.findIndex((tab) => tab === document.activeElement);
    if (current < 0) return;
    const next = moveTab(current, tabs.length, event.key, rtl());
    if (next === null) return;
    event.preventDefault();
    show(tabs, panels, next, true);
  });
  show(tabs, panels, 0, false);
}

document.querySelectorAll<HTMLElement>("[data-menu-tabs]").forEach(init);

export {};
