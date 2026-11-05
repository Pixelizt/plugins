// Invented test data (no real client): a tiny menu and a plan config that uses every option.
import { DAYS, MealPlansConfig, PlanCopy, type SetMenu, type PlanInput } from "../lib/schema.ts";
import type { MenuItemLite, PlanData } from "../lib/engine.ts";

export const items: MenuItemLite[] = [
  { id: "dish-a", name: "Dish A", category: "mains", available: true, prices: [{ price: 10 }] },
  { id: "dish-b", name: "Dish B", category: "mains", available: true, prices: [{ price: 12.5 }] },
  { id: "dish-c", name: "Dish C", category: "mains", available: true, prices: [{ size: "Small", price: 8 }, { size: "Large", price: 11 }] },
  { id: "juice", name: "Juice", category: "drinks", group: "Cold", available: true, prices: [{ price: 3.25 }] },
  { id: "tea", name: "Tea", category: "drinks", group: "Hot", available: false, prices: [{ price: 2 }] },
];

export const confRaw = {
  slots: [
    { key: "lunch", label: "Lunch", picks: [{ key: "main", label: "Dish", categories: ["mains"] }, { key: "drink", label: "Drink", categories: ["drinks"], required: false }] },
    { key: "dinner", label: "Dinner", picks: [{ key: "main", label: "Dish", categories: ["mains"] }] },
  ],
  plans: [
    { key: "one", label: "1 meal a day", combos: [{ key: "lunch", label: "Lunch", slots: ["lunch"] }, { key: "dinner", label: "Dinner", slots: ["dinner"] }] },
    { key: "two", label: "2 meals a day", combos: [{ key: "both", slots: ["lunch", "dinner"] }] },
  ],
  grids: [
    { key: "weekdays", label: "Monday to Friday", days: ["mon", "tue", "wed", "thu", "fri"] },
    { key: "week", label: "Every day", days: [...DAYS] },
  ],
  lengths: [
    { key: "w5", label: "1 week", days: 5, grid: "weekdays" },
    { key: "w7", label: "1 week", days: 7, grid: "week" },
    { key: "m20", label: "4 weeks", days: 20, grid: "weekdays", group: "Monthly" },
  ],
  rates: [{ plan: "two", length: "m20", discount: 10 }],
  rounding: { step: 5, mode: "nearest", scope: "total", discount_step: 1 },
  tax: { rate: 5, label: "VAT", inclusive: false },
  start: { lead_days: 1, max_ahead_days: 60 },
};

export const conf = (over: Record<string, unknown> = {}) => MealPlansConfig.parse({ ...confRaw, ...over });

/** A set covering every day and both meals; Monday lunch is "a drink of your choice" at a set price of 4. */
export function fullSet(id = "set-1"): SetMenu {
  const entries: SetMenu["entries"] = [];
  for (const day of DAYS) {
    if (day === "mon") entries.push({ day, slot: "lunch", item: "", size: "", price: 4, choice_label: "Drink of your choice", choice_category: "drinks", choice_group: "" });
    entries.push({ day, slot: "lunch", item: "dish-a", size: "", choice_label: "", choice_category: "", choice_group: "" });
    entries.push({ day, slot: "dinner", item: "dish-c", size: "Large", price: day === "fri" ? 9 : undefined, choice_label: "", choice_category: "", choice_group: "" });
  }
  return { id, name: "Set One", description: "", entries };
}

export const data = (over: Partial<PlanData> = {}): PlanData => ({ conf: conf(), items, sets: [fullSet()], currency: "USD", locale: "en", ...over });
export const loaded = (over: Partial<PlanData> = {}) => ({ ...data(over), copy: PlanCopy.parse({}) });

/** Every weekday: lunch Dish A + Juice, dinner Dish B → 25.75 a day. */
export function customInput(over: Partial<PlanInput> = {}): PlanInput {
  const day = { lunch: { main: { id: "dish-a", size: "" }, drink: { id: "juice", size: "" } }, dinner: { main: { id: "dish-b", size: "" } } };
  return { v: 1, mode: "custom", plan: "two", combo: "both", length: "w5", start: "2026-11-09", set: "", picks: Object.fromEntries(DAYS.map((d) => [d, structuredClone(day)])), choices: {}, ...over };
}

/** Thursday 5 November 2026. */
export const TODAY = "2026-11-05";
