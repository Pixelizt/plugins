// "Match the client's printed prices exactly" (rule 23). TEMPLATE: before shipping pricing for a client, copy this
// file into the client project, replace CONFIG with the client's client.yaml → modules.meal-plans (or load it), set
// MENU to the dishes the printed sheet is based on, and type every figure from the client's printed rate card into
// PRINTED. Any row that fails is a real difference: report it to the client IN WRITING (rounding of the sum vs
// per day is the usual cause, see rounding.scope) and don't "fix" the test to match the code.
//
// The figures below are INVENTED demo numbers so the template runs in the kit.
import { describe, expect, it } from "vitest";
import { DAYS, MealPlansConfig, type PlanInput } from "../lib/schema.ts";
import { formatMinor } from "../../../kit/lib/money.ts";
import { quotePlan, type MenuItemLite } from "../lib/engine.ts";

const CURRENCY = "USD";
const CONFIG = MealPlansConfig.parse({
  slots: [{ key: "lunch", label: "Lunch", picks: [{ key: "main", label: "Dish", categories: ["mains"] }] }],
  plans: [{ key: "one", label: "1 meal a day", combos: [{ key: "lunch", slots: ["lunch"] }] }],
  grids: [{ key: "weekdays", label: "Monday to Friday", days: ["mon", "tue", "wed", "thu", "fri"] }],
  lengths: [
    { key: "w5", label: "1 week", days: 5, grid: "weekdays" },
    { key: "m20", label: "4 weeks", days: 20, grid: "weekdays" },
  ],
  rates: [{ plan: "one", length: "m20", discount: 8 }],
  rounding: { step: 1, mode: "nearest", scope: "total", discount_step: 1 },
  tax: { rate: 5, label: "VAT", inclusive: false },
});
const MENU: MenuItemLite[] = [{ id: "standard-meal", name: "Standard meal", category: "mains", available: true, prices: [{ price: 9.9 }] }];

/** One row per printed figure: the plan, the length, the dish picked every day, and the printed total. */
const PRINTED: { plan: string; combo?: string; length: string; dish: string; total: string }[] = [
  { plan: "one", length: "w5", dish: "standard-meal", total: "$52.50" }, // 5 × 9.90 = 49.50 → 50 → + 5% VAT
  { plan: "one", length: "m20", dish: "standard-meal", total: "$191.10" }, // 198 → less 8% = 182.16 → 182 → + 5% VAT
];

const input = (row: (typeof PRINTED)[number]): PlanInput => {
  const plan = CONFIG.plans.find((p) => p.key === row.plan)!;
  const combo = plan.combos.find((c) => c.key === row.combo) ?? plan.combos[0]!;
  const day = Object.fromEntries(combo.slots.map((s) => [s, Object.fromEntries(CONFIG.slots.find((x) => x.key === s)!.picks.filter((p) => p.required).map((p) => [p.key, { id: row.dish, size: "" }]))]));
  return { v: 1, mode: "custom", plan: row.plan, combo: combo.key, length: row.length, start: "", set: "", picks: Object.fromEntries(DAYS.map((d) => [d, day])), choices: {} };
};

describe("prices match the printed rate card (rule 23)", () => {
  for (const row of PRINTED) {
    it(`${row.plan} × ${row.length} = ${row.total}`, () => {
      const r = quotePlan(input(row), { conf: CONFIG, items: MENU, sets: [], currency: CURRENCY, locale: "en" }, "2026-11-05");
      expect(r.ok && r.quote.price ? formatMinor(r.quote.price.total, CURRENCY) : r).toBe(row.total);
    });
  }
});
