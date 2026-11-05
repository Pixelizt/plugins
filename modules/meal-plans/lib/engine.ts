// The meal-plan engine: dates, set menus, picks and the price. Pure (rule 2): the clock ("today" in the business
// time zone), the menu, the config and the set menus are all arguments. The page's builder and the server's
// re-pricing both run this file (rule 1), so the emailed price is the one the page showed, worked out again.
// Ported from the reference project's plans.js engine()/price() and plan-quote.js; nothing about one client is left in it.
import type { Item } from "../../menu/lib/schema.ts";
import { addDays, isIsoDate, utcDay, weekdayOf } from "../../../kit/lib/time.ts";
import { formatMinor, minorDigits } from "../../../kit/lib/money.ts";
import { DAYS, PlanInput, type Day, type MealPlansConfig, type PickRef, type PlanDef, type LengthDef, type SetEntry, type SetMenu } from "./schema.ts";

export type MenuItemLite = Pick<Item, "id" | "name" | "category" | "available" | "prices"> & { group?: string | undefined };

export interface PlanData {
  conf: MealPlansConfig;
  items: MenuItemLite[];
  /** All set menus from the CMS document; incomplete ones are dropped by completeSets(). */
  sets: SetMenu[];
  currency: string;
  locale: string;
}

// ---------- dates: ISO strings ("2026-11-02"); the calendar maths (addDays, weekdayOf, todayIn…) is the core's (src/kit/lib/time.ts) ----------

/** "Monday 2 November 2026" style, in the site locale. The date is a calendar day, so it is formatted in UTC. */
export function formatDate(iso: string, locale = "en", style: "long" | "short" = "long"): string {
  const opts: Intl.DateTimeFormatOptions =
    style === "long" ? { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" } : { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat(locale, opts).format(new Date(utcDay(iso)));
}

export function dayName(d: Day, locale = "en", style: "long" | "short" = "long"): string {
  // 2024-01-01 was a Monday
  return new Intl.DateTimeFormat(locale, { weekday: style, timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + DAYS.indexOf(d))));
}

/** The first start date a customer may pick: today + lead days, moved on to an allowed start weekday. */
export function earliestStart(conf: MealPlansConfig, today: string): string {
  let d = addDays(today, conf.start.lead_days);
  for (let i = 0; i < 7 && conf.start.weekdays.length && !conf.start.weekdays.includes(weekdayOf(d)); i++) d = addDays(d, 1);
  return d;
}
/** The client's label for a grid key ("" when the key isn't a grid). */
export const gridLabel = (conf: Pick<MealPlansConfig, "grids">, key: string) => conf.grids.find((g) => g.key === key)?.label ?? "";
export const latestStart = (conf: MealPlansConfig, today: string) => addDays(today, conf.start.max_ahead_days);

/** Why a start date can't be used, or null when it can. */
export function startProblem(conf: MealPlansConfig, start: string, today: string): string | null {
  if (!isIsoDate(start)) return "not a valid date";
  if (start < today) return "in the past";
  if (start < addDays(today, conf.start.lead_days)) return `needs at least ${conf.start.lead_days} day(s) notice`;
  if (start > latestStart(conf, today)) return `more than ${conf.start.max_ahead_days} days ahead`;
  if (conf.start.weekdays.length && !conf.start.weekdays.includes(weekdayOf(start))) return "plans can't start on that weekday";
  return null;
}

/**
 * The delivery dates: from the start, the grid's weekdays only, closed days (blackouts) skipped, until `count`
 * meal days are reached. A blackout pushes the plan on by a day; it never shortens it.
 */
export function mealDates(start: string, gridDays: readonly Day[], count: number, blackouts: readonly string[] = []): string[] {
  const out: string[] = [];
  const closed = new Set(blackouts);
  const days = new Set(gridDays);
  if (!days.size) return out;
  let d = start;
  for (let guard = 0; out.length < count && guard < 4000; guard++, d = addDays(d, 1)) {
    if (days.has(weekdayOf(d)) && !closed.has(d)) out.push(d);
  }
  return out;
}

// ---------- money: integers in the currency's minor unit (cents), never floats ----------

export const toMinor = (major: number, digits: number) => Math.round(Number((major * 10 ** digits).toFixed(6)));

/** Round an amount (minor units) to a step (minor units). Clean of float noise: 0.5 really is half. */
export function roundTo(value: number, step: number, mode: "nearest" | "up" | "down" = "nearest"): number {
  if (step <= 1 && Number.isInteger(value)) return value;
  const q = Number((value / Math.max(step, 1)).toFixed(9));
  const r = mode === "up" ? Math.ceil(q) : mode === "down" ? Math.floor(q) : Math.round(q);
  return r * Math.max(step, 1);
}

export interface Breakdown {
  /** Menu prices added up over every delivery day. */
  subtotal: number;
  /** After rounding (to `rounding.step`, once on the total or per day). */
  rounded: number;
  discountPct: number;
  /** rounded − afterDiscount. */
  discount: number;
  afterDiscount: number;
  taxRate: number;
  taxLabel: string;
  taxInclusive: boolean;
  /** Added on top when exclusive; the part already included when inclusive. */
  tax: number;
  total: number;
}

/**
 * The one price rule. `daySums` = each delivery day's menu total in minor units.
 * sum (or per-day) → round to step → less discount % → round to discount step → tax (added, or the included part).
 */
export function priceOf(daySums: readonly number[], discountPct: number, conf: Pick<MealPlansConfig, "rounding" | "tax">, digits: number): Breakdown {
  const step = toMinor(conf.rounding.step, digits);
  const subtotal = daySums.reduce((a, b) => a + b, 0);
  const rounded =
    conf.rounding.scope === "per_day"
      ? daySums.reduce((a, b) => a + roundTo(b, step, conf.rounding.mode), 0)
      : roundTo(subtotal, step, conf.rounding.mode);
  const pct = Math.min(Math.max(Number(discountPct) || 0, 0), 100);
  const afterDiscount = roundTo((rounded * (100 - pct)) / 100, toMinor(conf.rounding.discount_step, digits), "nearest");
  const r = conf.tax.rate;
  const tax = r <= 0 ? 0 : conf.tax.inclusive ? roundTo(afterDiscount - afterDiscount / (1 + r / 100), 1) : roundTo((afterDiscount * r) / 100, 1);
  return {
    subtotal, rounded, discountPct: pct, discount: rounded - afterDiscount, afterDiscount,
    taxRate: r, taxLabel: conf.tax.label, taxInclusive: conf.tax.inclusive, tax,
    total: conf.tax.inclusive ? afterDiscount : afterDiscount + tax,
  };
}

export const discountFor = (conf: MealPlansConfig, plan: string, length: string) => conf.rates.find((r) => r.plan === plan && r.length === length)?.discount ?? 0;

// ---------- menu lookups ----------

/** Index of the item's price for a size name ("" = the single, unnamed price). -1 when the item isn't sold in it. */
export function priceIndex(item: MenuItemLite, size: string): number {
  const i = item.prices.findIndex((p) => (p.size ?? "") === size);
  if (i >= 0) return i;
  return !size && item.prices.length === 1 ? 0 : -1;
}
export const itemLabel = (item: MenuItemLite, size: string) => (size && item.prices.length > 1 ? `${item.name} (${size})` : item.name);

/** The menu items a pick may be: available, in one of its categories, every size as its own option. */
export function pickOptions(categories: readonly string[], items: readonly MenuItemLite[]): PickRef[] {
  return items
    .filter((it) => it.available && categories.includes(it.category))
    .flatMap((it) => it.prices.map((p) => ({ id: it.id, size: p.size ?? "" })));
}

/** The menu items an "of your choice" row may be: available, its category (and group), sold in its size. */
export function choiceOptions(e: Pick<SetEntry, "choice_category" | "choice_group" | "size">, items: readonly MenuItemLite[]): PickRef[] {
  return items
    .filter((it) => it.available && it.category === e.choice_category && (!e.choice_group || it.group === e.choice_group) && priceIndex(it, e.size) >= 0)
    .map((it) => ({ id: it.id, size: e.size }));
}

// ---------- set menus ----------

/** The slots any plan can deliver and the weekdays any length can deliver on: what a set must cover. */
export function coverage(conf: MealPlansConfig): { slots: string[]; days: Day[] } {
  const slots = new Set(conf.plans.flatMap((p) => p.combos.flatMap((c) => c.slots)));
  const used = new Set(conf.lengths.map((l) => l.grid));
  const days = new Set(conf.grids.filter((g) => used.has(g.key)).flatMap((g) => g.days));
  return { slots: conf.slots.map((s) => s.key).filter((s) => slots.has(s)), days: DAYS.filter((d) => days.has(d)) };
}

/** Why a set can't be offered (empty = complete). An incomplete set is never shown (rule 4). */
export function setProblems(set: SetMenu, conf: MealPlansConfig, items: readonly MenuItemLite[]): string[] {
  const out: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));
  const slots = new Set(conf.slots.map((s) => s.key));
  set.entries.forEach((e, i) => {
    const at = `row ${i + 1} (${e.day} ${e.slot})`;
    if (!slots.has(e.slot)) out.push(`${at}: unknown meal "${e.slot}"`);
    if (e.choice_category) {
      if (!choiceOptions(e, items).length) out.push(`${at}: "${e.choice_label}" has nothing to choose from`);
    } else {
      const it = byId.get(e.item);
      if (!it) out.push(`${at}: unknown menu item "${e.item}"`);
      else if (priceIndex(it, e.size) < 0) out.push(`${at}: "${it.name}" has no size "${e.size}"`);
    }
  });
  const cov = coverage(conf);
  for (const d of cov.days) for (const s of cov.slots) if (!set.entries.some((e) => e.day === d && e.slot === s)) out.push(`nothing for ${d} ${s}`);
  return out;
}

export const completeSets = (data: Pick<PlanData, "sets" | "conf" | "items">) =>
  data.conf.sets ? data.sets.filter((s) => setProblems(s, data.conf, data.items).length === 0) : [];

// ---------- the quote ----------

export interface Line {
  name: string;
  /** Minor units. */
  price: number;
  /** For an "of your choice" row: what the customer picked, or null when not yet. */
  choice?: { label: string; picked: string | null };
}
export interface SlotLines { key: string; label: string; lines: Line[]; missing: string[] }
export interface DayTemplate { day: Day; slots: SlotLines[]; total: number }
export interface Problem { code: "invalid" | "unknown" | "incomplete" | "unavailable"; message: string }

export interface Quote {
  input: PlanInput;
  mode: "custom" | "set";
  plan: PlanDef;
  combo: PlanDef["combos"][number];
  length: LengthDef;
  gridLabel: string;
  set: SetMenu | null;
  start: { chosen: boolean; date: string; problem: string | null };
  dates: string[];
  /** Closed days the plan runs past. */
  skipped: string[];
  week: DayTemplate[];
  /** Required picks still empty. */
  missing: number;
  /** "Of your choice" rows not picked yet (still priced: the set price never depends on the pick). */
  unpicked: number;
  problems: Problem[];
  /** Null unless every meal is known and filled in. */
  price: Breakdown | null;
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; problems: Problem[] };

const bad = (code: Problem["code"], message: string): QuoteResult => ({ ok: false, problems: [{ code, message }] });

/**
 * Prices a plan from the picks. `today` is the business's date (todayIn(client.timezone, now)).
 * Structural problems (unknown plan, length or set; malformed input) → ok:false.
 * Otherwise a Quote; its `price` is null while picks are missing or name items the menu doesn't have.
 */
export function quotePlan(raw: unknown, data: PlanData, today: string): QuoteResult {
  const parsed = PlanInput.safeParse(raw);
  if (!parsed.success) return bad("invalid", "the plan data could not be read");
  const input = parsed.data;
  const { conf } = data;
  const digits = minorDigits(data.currency);
  const plan = conf.plans.find((p) => p.key === input.plan);
  if (!plan) return bad("unknown", `unknown plan "${input.plan}"`);
  const combo = plan.combos.find((c) => c.key === input.combo) ?? plan.combos[0]!;
  const length = conf.lengths.find((l) => l.key === input.length);
  if (!length) return bad("unknown", `unknown plan length "${input.length}"`);
  const grid = conf.grids.find((g) => g.key === length.grid)!;
  let set: SetMenu | null = null;
  if (input.mode === "set") {
    set = completeSets(data).find((s) => s.id === input.set) ?? null;
    if (!set) return bad("unknown", `unknown or unfinished set menu "${input.set}"`);
  }

  const problems: Problem[] = [];
  const byId = new Map(data.items.map((i) => [i.id, i]));
  const slotDefs = combo.slots.map((k) => conf.slots.find((s) => s.key === k)!).filter(Boolean);
  const days = DAYS.filter((d) => grid.days.includes(d));
  let missing = 0;
  let unpicked = 0;

  const resolve = (ref: PickRef, ok: (it: MenuItemLite) => boolean, where: string): { it: MenuItemLite; idx: number } | null => {
    const it = byId.get(ref.id);
    if (!it) return problems.push({ code: "unknown", message: `${where}: unknown menu item "${ref.id}"` }), null;
    const idx = priceIndex(it, ref.size);
    if (idx < 0) return problems.push({ code: "unknown", message: `${where}: "${it.name}" has no size "${ref.size}"` }), null;
    if (!ok(it)) return problems.push({ code: "unavailable", message: `${where}: "${itemLabel(it, ref.size)}" can't be chosen here` }), null;
    return { it, idx };
  };

  const week: DayTemplate[] = days.map((day) => {
    const slots: SlotLines[] = slotDefs.map((slot) => {
      const lines: Line[] = [];
      const missingHere: string[] = [];
      if (set) {
        set.entries.forEach((e, pos) => {
          if (e.day !== day || e.slot !== slot.key) return;
          if (e.choice_category) {
            const ref = input.choices[day]?.[slot.key]?.[String(pos)] ?? null;
            let picked: string | null = null;
            if (ref?.id) {
              const allowed = choiceOptions(e, data.items).some((o) => o.id === ref.id && o.size === ref.size);
              const r = resolve(ref, () => allowed, `${day} ${slot.label}`);
              if (r) picked = itemLabel(r.it, ref.size);
            }
            if (!picked) unpicked++;
            // the set's own price, whichever item is picked
            lines.push({ name: e.choice_label, price: toMinor(e.price ?? 0, digits), choice: { label: e.choice_label, picked } });
          } else {
            const it = byId.get(e.item)!;
            const idx = priceIndex(it, e.size);
            lines.push({ name: itemLabel(it, e.size), price: toMinor(e.price ?? it.prices[idx]!.price, digits) });
          }
        });
      } else {
        for (const pick of slot.picks) {
          const ref = input.picks[day]?.[slot.key]?.[pick.key] ?? null;
          if (!ref?.id) {
            if (pick.required) missingHere.push(pick.label);
            continue;
          }
          const r = resolve(ref, (it) => it.available && pick.categories.includes(it.category), `${day} ${slot.label}`);
          if (r) lines.push({ name: itemLabel(r.it, ref.size), price: toMinor(r.it.prices[r.idx]!.price, digits) });
        }
      }
      missing += missingHere.length;
      return { key: slot.key, label: slot.label, lines, missing: missingHere };
    });
    return { day, slots, total: slots.reduce((a, s) => a + s.lines.reduce((b, l) => b + l.price, 0), 0) };
  });
  if (missing) problems.push({ code: "incomplete", message: `${missing} meal choice(s) still to pick` });

  const sp = input.start ? startProblem(conf, input.start, today) : "not chosen";
  const chosen = sp === null;
  const startDate = chosen ? input.start : earliestStart(conf, today);
  const dates = mealDates(startDate, grid.days, length.days, conf.blackout_dates);
  if (dates.length < length.days) problems.push({ code: "invalid", message: "the delivery dates could not be worked out" });
  const last = dates[dates.length - 1] ?? startDate;
  const skipped = conf.blackout_dates.filter((b) => b >= startDate && b <= last && grid.days.includes(weekdayOf(b))).sort();

  const byDay = new Map(week.map((w) => [w.day, w.total]));
  const priced = problems.length === 0;
  return {
    ok: true,
    quote: {
      input, mode: input.mode, plan, combo, length, gridLabel: grid.label, set,
      start: { chosen, date: startDate, problem: input.start && !chosen ? sp : null },
      dates, skipped, week, missing, unpicked, problems,
      price: priced ? priceOf(dates.map((d) => byDay.get(weekdayOf(d)) ?? 0), discountFor(conf, plan.key, length.key), conf, digits) : null,
    },
  };
}

// ---------- wording of a quote (structural English labels only; client words come from config and the CMS) ----------

export function mealsText(q: Pick<Quote, "plan" | "combo">): string {
  return q.plan.combos.length > 1 && q.combo.label ? `${q.plan.label} (${q.combo.label})` : q.plan.label;
}
export function lengthText(q: Pick<Quote, "length" | "gridLabel">): string {
  const l = q.length;
  return [l.group && l.group !== l.label ? `${l.group}: ${l.label}` : l.label, q.gridLabel, `${l.days} delivery days`].join(" · ");
}
export const planName = (q: Pick<Quote, "set">, customLabel = "Your own plan") => (q.set ? q.set.name : customLabel);
export const pctText = (n: number) => `${Math.round(n * 100) / 100}%`;

/** Price rows for display and emails: [label, value]. */
export function priceRows(p: Breakdown, currency: string, locale = "en", days?: number): [string, string][] {
  const m = (n: number) => formatMinor(n, currency, locale);
  const rows: [string, string][] = [[days ? `Menu prices (${days} days)` : "Menu prices", m(p.subtotal)]];
  if (p.rounded !== p.subtotal) rows.push(["Rounded", m(p.rounded)]);
  if (p.discountPct) rows.push([`Discount (${pctText(p.discountPct)})`, `−${m(p.discount)}`], ["After discount", m(p.afterDiscount)]);
  if (p.taxRate) rows.push([p.taxInclusive ? `Includes ${p.taxLabel} (${pctText(p.taxRate)})` : `${p.taxLabel} (${pctText(p.taxRate)})`, m(p.tax)]);
  rows.push(["Total", m(p.total)]);
  return rows;
}

/** The plan as facts for the emails and the summary: [label, value]. */
export function planFacts(q: Quote, locale = "en"): [string, string][] {
  const rows: [string, string][] = [
    ["Plan", planName(q)],
    ["Meals", mealsText(q)],
    ["Length", lengthText(q)],
    ["First day", q.start.chosen ? formatDate(q.dates[0]!, locale) : `Not chosen yet (priced from ${formatDate(q.dates[0]!, locale)})`],
    ["Last day", formatDate(q.dates[q.dates.length - 1]!, locale)],
  ];
  if (q.skipped.length) rows.push(["Closed days skipped", q.skipped.map((d) => formatDate(d, locale, "short")).join(", ")]);
  if (q.length.note) rows.push(["Note", q.length.note]);
  return rows;
}

export function lineText(l: Line, currency: string, locale = "en"): string {
  const name = l.choice ? `${l.choice.label}: ${l.choice.picked ?? "to choose later"}` : l.name;
  return `${name} · ${formatMinor(l.price, currency, locale)}`;
}

/** The week, one line per meal: "Monday", "- Lunch: Soup · $4.00 + Bread · $1.50". */
export function weekLines(q: Quote, currency: string, locale = "en"): { day: string; meals: [string, string][] }[] {
  return q.week.map((w) => ({
    day: dayName(w.day, locale),
    meals: w.slots.map((s) => [s.label, [...s.lines.map((l) => lineText(l, currency, locale)), ...s.missing.map((m) => `${m}: not picked`)].join(" + ") || "nothing"]),
  }));
}

/** The plain-text plan written into the form's plan field (and, from the server, into the stored enquiry). */
export function planText(q: Quote, data: Pick<PlanData, "currency" | "locale">): string {
  const out: string[] = planFacts(q, data.locale).map(([k, v]) => `${k}: ${v}`);
  for (const d of weekLines(q, data.currency, data.locale)) out.push("", `${d.day}:`, ...d.meals.map(([k, v]) => `- ${k}: ${v}`));
  out.push("");
  if (q.price) out.push(...priceRows(q.price, data.currency, data.locale, q.dates.length).map(([k, v]) => `${k}: ${v}`));
  else out.push(`Price: to confirm (${q.problems.map((p) => p.message).join("; ")})`);
  if (q.unpicked) out.push(`${q.unpicked} "of your choice" item(s) to choose later; the price stays the same.`);
  return out.join("\n");
}
