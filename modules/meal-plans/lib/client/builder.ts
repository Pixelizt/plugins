// The plan builder in the browser: vanilla TS, bundled by Astro (strict CSP: no inline script, data via data-*).
// It runs the same engine as the server (lib/engine.ts, rule 1). It writes the plan text into the form's plan
// field and, through the forms module's "kit:before-submit" event, adds the picks (never a price) to the request.
// DOM is built with createElement/textContent only, so menu text can never become markup (rule 13).
import { todayIn } from "../../../../kit/lib/time.ts";
import { formatMinor, minorDigits } from "../../../../kit/lib/money.ts";
import { DAYS, type Day, type MealPlansConfig, type PickRef, type PlanInput, type SetMenu } from "../schema.ts";
import {
  choiceOptions, dayName, discountFor, earliestStart, formatDate, itemLabel, latestStart, pctText, pickOptions,
  planFacts, planText, priceRows, quotePlan, toMinor, type MenuItemLite, type PlanData, type Quote,
} from "../engine.ts";

export interface BuilderPayload {
  conf: MealPlansConfig;
  items: MenuItemLite[];
  categories: { id: string; name: string }[];
  /** Complete sets only. */
  sets: SetMenu[];
  currency: string;
  locale: string;
  timezone: string;
  form: string;
}

type Kid = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string | boolean | undefined> = {}, ...kids: Kid[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids) if (k !== null && k !== undefined && k !== false) el.append(k);
  return el;
}
const refValue = (r: PickRef) => JSON.stringify([r.id, r.size]);
const parseRef = (v: string): PickRef | null => {
  if (!v) return null;
  try {
    const [id, size] = JSON.parse(v) as [string, string];
    return { id: String(id), size: String(size ?? "") };
  } catch {
    return null;
  }
};

const SELECT = "mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:outline-2 focus-visible:outline-ring";

export function mount(root: HTMLElement) {
  const P = JSON.parse(root.dataset.plan ?? "{}") as BuilderPayload;
  const { conf } = P;
  const data: PlanData = { conf, items: P.items, sets: P.sets, currency: P.currency, locale: P.locale };
  const byId = new Map(P.items.map((i) => [i.id, i]));
  const money = (n: number) => formatMinor(n, P.currency, P.locale);
  const digits = minorDigits(P.currency);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel);
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...root.querySelectorAll<T>(sel)];

  // the form this builder feeds (rendered by the section, outside root)
  const form = [...document.querySelectorAll<HTMLFormElement>("form[data-kit-form]")].find((f) => {
    try { return JSON.parse(f.dataset.def ?? "{}").id === P.form; } catch { return false; }
  });
  const field = form?.querySelector<HTMLTextAreaElement>(`[name="${root.dataset.planField}"]`) ?? null;

  const url = new URLSearchParams(location.search);
  const pick = <T extends { key: string }>(list: T[], want: string | null) => list.find((x) => x.key === want) ?? list[0]!;
  const state = {
    mode: (P.sets.length ? "set" : "custom") as "set" | "custom",
    set: (P.sets.find((s) => s.id === url.get("set")) ?? P.sets[0])?.id ?? "",
    plan: pick(conf.plans, url.get("plan")).key,
    combo: Object.fromEntries(conf.plans.map((p) => [p.key, p.combos[0]!.key])) as Record<string, string>,
    length: pick(conf.lengths, url.get("length")).key,
    start: "",
    day: "mon" as Day,
    picks: {} as Record<string, Record<string, Record<string, PickRef | null>>>,
    choices: {} as Record<string, Record<string, Record<string, Record<string, PickRef | null>>>>,
  };
  if (url.get("mode") === "custom") state.mode = "custom";

  const today = () => todayIn(P.timezone, new Date());
  const plan = () => conf.plans.find((p) => p.key === state.plan)!;
  const combo = () => plan().combos.find((c) => c.key === state.combo[state.plan]) ?? plan().combos[0]!;
  const length = () => conf.lengths.find((l) => l.key === state.length)!;
  const gridDays = () => DAYS.filter((d) => conf.grids.find((g) => g.key === length().grid)?.days.includes(d));
  const curSet = () => P.sets.find((s) => s.id === state.set) ?? null;

  let last: Quote | null = null;
  const input = (): PlanInput => ({
    v: 1, mode: state.mode, plan: state.plan, combo: combo().key, length: state.length, start: state.start, set: state.mode === "set" ? state.set : "",
    picks: state.mode === "custom" ? state.picks : {},
    choices: state.mode === "set" ? state.choices[state.set] ?? {} : {},
    ...(last?.price ? { shown_total: last.price.total } : {}),
  });

  // ---------- controls that are static markup: keep them in step with the state ----------
  function syncControls() {
    for (const r of $$<HTMLInputElement>("input[type=radio][data-mp]")) {
      const k = r.dataset.mp!;
      r.checked =
        k === "mode" ? r.value === state.mode : k === "set" ? r.value === state.set : k === "plan" ? r.value === state.plan :
        k === "combo" ? r.value === state.combo[r.dataset.plan!] : k === "length" ? r.value === state.length : r.checked;
    }
    const sets = $("[data-mp-sets]");
    if (sets) sets.hidden = state.mode !== "set";
    for (const c of $$("[data-mp-combos]")) c.hidden = c.dataset.mpCombos !== state.plan;
    for (const s of $$("[data-mp-save]")) {
      const d = discountFor(conf, state.plan, s.dataset.mpSave!);
      s.textContent = d ? `Save ${pctText(d)}` : "";
      s.hidden = !d;
    }
    const days = gridDays();
    if (!days.includes(state.day)) state.day = days[0]!;
    for (const b of $$<HTMLButtonElement>("[data-mp-days] [data-day]")) {
      const d = b.dataset.day as Day;
      const on = d === state.day;
      b.hidden = !days.includes(d);
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
    }
    $("#mp-day-panel")?.setAttribute("aria-labelledby", `mp-tab-${state.day}`);
    const copyBtn = $("[data-mp-copy-day]");
    if (copyBtn) copyBtn.hidden = state.mode !== "custom" || days.length < 2;
    const date = $<HTMLInputElement>("#mp-start");
    if (date) {
      date.min = earliestStart(conf, today());
      date.max = latestStart(conf, today());
    }
  }

  // ---------- the open day ----------
  function select(id: string, label: string, first: string, opts: { group: string; refs: PickRef[] }[], cur: PickRef | null | undefined, data: Record<string, string>) {
    const s = h("select", { id, class: SELECT, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [`data-${k}`, v])) }, h("option", { value: "" }, first));
    for (const g of opts) {
      if (!g.refs.length) continue;
      const og = h("optgroup", { label: g.group });
      for (const r of g.refs) {
        const it = byId.get(r.id)!;
        const price = it.prices.find((p) => (p.size ?? "") === r.size)?.price;
        // a choice keeps the set's price, so its options show no price of their own
        const o = h("option", { value: refValue(r) }, price === undefined || data.choice ? itemLabel(it, r.size) : `${itemLabel(it, r.size)} · ${money(toMinor(price, digits))}`);
        if (cur && cur.id === r.id && cur.size === r.size) o.selected = true;
        og.append(o);
      }
      s.append(og);
    }
    return h("div", { class: "mt-3" }, h("label", { for: id, class: "block text-sm font-medium" }, label), s);
  }
  const catName = (id: string) => P.categories.find((c) => c.id === id)?.name ?? id;

  function renderDay() {
    const panel = $("#mp-day-panel");
    if (!panel) return;
    const day = state.day;
    const parts: Node[] = [];
    for (const slotKey of combo().slots) {
      const slot = conf.slots.find((s) => s.key === slotKey);
      if (!slot) continue;
      const box = h("fieldset", { class: "rounded-md border border-border p-4" }, h("legend", { class: "px-1 font-heading text-lg font-semibold" }, slot.label));
      if (state.mode === "set") {
        const set = curSet();
        const list = h("ul", { class: "space-y-2" });
        set?.entries.forEach((e, pos) => {
          if (e.day !== day || e.slot !== slotKey) return;
          const it = byId.get(e.item);
          const price = e.price ?? (it ? it.prices.find((p) => (p.size ?? "") === e.size)?.price ?? it.prices[0]!.price : 0);
          const li = h("li", { class: "flex items-baseline justify-between gap-4" }, h("span", {}, e.choice_category ? e.choice_label : it ? itemLabel(it, e.size) : e.item), h("span", { class: "tabular-nums" }, money(toMinor(price, digits))));
          list.append(li);
          if (e.choice_category) {
            const cur = state.choices[state.set]?.[day]?.[slotKey]?.[String(pos)];
            list.append(h("li", {}, select(`mp-c-${day}-${slotKey}-${pos}`, e.choice_label, "Choose later", [{ group: catName(e.choice_category), refs: choiceOptions(e, P.items) }], cur, { choice: String(pos), slot: slotKey })));
          }
        });
        box.append(list);
      } else {
        for (const p of slot.picks) {
          const cur = state.picks[day]?.[slotKey]?.[p.key];
          const groups = p.categories.map((c) => ({ group: catName(c), refs: pickOptions([c], P.items) }));
          box.append(select(`mp-p-${day}-${slotKey}-${p.key}`, p.required ? p.label : `${p.label} (optional)`, p.required ? "Choose…" : "None", groups, cur, { pick: p.key, slot: slotKey }));
        }
      }
      parts.push(box);
    }
    panel.replaceChildren(h("div", { class: "space-y-4" }, ...parts));
  }

  // ---------- the summary ----------
  function renderSummary() {
    const r = quotePlan(input(), data, today());
    const box = $("[data-mp-summary]");
    if (!box) return;
    if (!r.ok) {
      box.replaceChildren(h("p", {}, "This plan can't be priced. Please reload the page."));
      last = null;
      return;
    }
    const q = r.quote;
    const dl = (rows: [string, string][], strongLast = false) =>
      h("dl", { class: "mt-3 space-y-1 text-sm" }, ...rows.map(([k, v], i) =>
        h("div", { class: `flex justify-between gap-4${strongLast && i === rows.length - 1 ? " border-t border-border pt-2 text-base font-bold" : ""}` }, h("dt", {}, k), h("dd", { class: "text-end tabular-nums" }, v))));
    const kids: Node[] = [dl(planFacts(q, P.locale))];
    if (q.price) kids.push(dl(priceRows(q.price, P.currency, P.locale, q.dates.length), true));
    else kids.push(h("p", { class: "mt-3 font-semibold" }, q.missing ? `Pick ${q.missing} more meal choice${q.missing === 1 ? "" : "s"} to see the price.` : "This plan can't be priced yet."));
    if (q.unpicked) kids.push(h("p", { class: "mt-2 text-sm" }, `${q.unpicked} "of your choice" item${q.unpicked === 1 ? "" : "s"} still to choose (the price stays the same).`));
    box.replaceChildren(...kids);
    // start date help under the date input
    const info = $("#mp-start-info");
    if (info) info.textContent = q.start.problem ? `That date can't be used (${q.start.problem}). The price is worked out from ${formatDate(q.dates[0]!, P.locale)}.` : q.start.chosen ? "" : `Not chosen yet: the price is worked out from ${formatDate(q.dates[0]!, P.locale)}.`;
    const before = last?.price?.total ?? null;
    last = q;
    const now = q.price?.total ?? null;
    if (now !== before) {
      const st = $("[data-mp-status]");
      if (st) st.textContent = now !== null ? `Total ${money(now)}` : "";
    }
    if (field) {
      field.readOnly = true;
      field.value = planText(q, data);
    }
  }

  const refresh = () => { syncControls(); renderDay(); renderSummary(); };

  // ---------- events ----------
  root.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement;
    const k = t.dataset.mp;
    if (k === "mode") state.mode = t.value as "set" | "custom";
    else if (k === "set") state.set = t.value;
    else if (k === "plan") state.plan = t.value;
    else if (k === "combo") state.combo[t.dataset.plan!] = t.value;
    else if (k === "length") state.length = t.value;
    else if (t.id === "mp-start") { state.start = t.value; renderSummary(); return; }
    else if (t.dataset.pick) {
      ((state.picks[state.day] ??= {})[t.dataset.slot!] ??= {})[t.dataset.pick] = parseRef(t.value);
      renderSummary();
      return;
    } else if (t.dataset.choice) {
      (((state.choices[state.set] ??= {})[state.day] ??= {})[t.dataset.slot!] ??= {})[t.dataset.choice] = parseRef(t.value);
      renderSummary();
      return;
    } else return;
    refresh();
  });

  const openDay = (d: Day, focus: boolean) => {
    state.day = d;
    syncControls();
    renderDay();
    if (focus) $<HTMLButtonElement>(`#mp-tab-${d}`)?.focus();
  };
  root.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b || !root.contains(b)) return;
    if (b.dataset.day) openDay(b.dataset.day as Day, false);
    else if (b.hasAttribute("data-mp-copy-day")) {
      const from = state.picks[state.day] ?? {};
      for (const d of gridDays()) if (d !== state.day) state.picks[d] = structuredClone(from);
      renderSummary();
      const st = $("[data-mp-status]");
      if (st) st.textContent = `${dayName(state.day, P.locale)} copied to every day.`;
    }
  });
  root.addEventListener("keydown", (e) => {
    const t = e.target as HTMLElement;
    if (t.getAttribute("role") !== "tab") return;
    const tabs = $$<HTMLButtonElement>("[data-mp-days] [data-day]").filter((b) => !b.hidden);
    const i = tabs.indexOf(t as HTMLButtonElement);
    const rtl = getComputedStyle(root).direction === "rtl";
    const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length - 1 : e.key === (rtl ? "ArrowLeft" : "ArrowRight") ? i + 1 : e.key === (rtl ? "ArrowRight" : "ArrowLeft") ? i - 1 : null;
    if (next === null) return;
    e.preventDefault();
    openDay(tabs[(next + tabs.length) % tabs.length]!.dataset.day as Day, true);
  });

  // the forms module asks before sending: add the picks, or stop while the plan is incomplete
  form?.addEventListener("kit:before-submit", (e) => {
    const ev = e as CustomEvent<{ payload: Record<string, unknown> }>;
    renderSummary();
    if (!last?.price) {
      ev.preventDefault();
      const st = form.querySelector<HTMLElement>("[data-status]");
      if (st) st.textContent = last?.missing ? `Your plan isn't finished: pick ${last.missing} more meal choice${last.missing === 1 ? "" : "s"} above.` : "Your plan can't be priced yet.";
      $("#mp-week-h")?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
      return;
    }
    ev.detail.payload.quote = input();
  });
  // the form clears itself after sending: put the plan text back
  form?.addEventListener("reset", () => setTimeout(renderSummary, 0));

  const nojs = $("[data-mp-nojs]");
  if (nojs) nojs.hidden = true;
  const ui = $("[data-mp-ui]");
  if (ui) ui.hidden = false;
  refresh();
}
