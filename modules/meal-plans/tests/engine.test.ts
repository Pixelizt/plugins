import { describe, expect, it } from "vitest";
import { addDays, weekdayOf } from "../../../kit/lib/time.ts";
import { formatMinor, minorDigits } from "../../../kit/lib/money.ts";
import {
  completeSets, coverage, earliestStart, mealDates, planText, priceOf, quotePlan,
  roundTo, setProblems, startProblem, type Quote,
} from "../lib/engine.ts";
import { MealPlansConfig, MealPlansDoc, PlanInput } from "../lib/schema.ts";
import seed from "../seed/meal_plans.json";
import { TODAY, conf, confRaw, customInput, data, fullSet, items } from "./fixture.ts";

const priced = (raw: unknown, d = data(), today = TODAY): Quote => {
  const r = quotePlan(raw, d, today);
  if (!r.ok) throw new Error(r.problems.map((p) => p.message).join("; "));
  return r.quote;
};

describe("calendar days (rule 21)", () => {
  it("counts calendar days without DST gaps or doubles", () => {
    expect(mealDates("2026-10-21", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], 7)).toEqual(["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-24", "2026-10-25", "2026-10-26", "2026-10-27"]);
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-05")).toBe("thu");
  });
});

describe("dates", () => {
  const wk = ["mon", "tue", "wed", "thu", "fri"] as const;
  it("delivers on the grid's weekdays only", () => {
    expect(mealDates("2026-11-06", wk, 5)).toEqual(["2026-11-06", "2026-11-09", "2026-11-10", "2026-11-11", "2026-11-12"]);
    expect(mealDates("2026-11-07", ["sat", "sun"], 3)).toEqual(["2026-11-07", "2026-11-08", "2026-11-14"]);
  });
  it("skips blackout days and runs on past them, never shortening the plan", () => {
    expect(mealDates("2026-11-06", wk, 5, ["2026-11-10"])).toEqual(["2026-11-06", "2026-11-09", "2026-11-11", "2026-11-12", "2026-11-13"]);
    // a blackout on a non-delivery day changes nothing
    expect(mealDates("2026-11-06", wk, 5, ["2026-11-07"])).toEqual(mealDates("2026-11-06", wk, 5));
  });
  it("validates the start date against today, lead time, horizon and weekdays", () => {
    const c = conf();
    expect(startProblem(c, "2026-11-04", TODAY)).toBe("in the past");
    expect(startProblem(c, TODAY, TODAY)).toMatch(/notice/);
    expect(startProblem(c, "2026-11-06", TODAY)).toBeNull();
    expect(startProblem(c, "2027-02-01", TODAY)).toMatch(/ahead/);
    expect(startProblem(c, "2026-02-30", TODAY)).toBe("not a valid date");
    const mondays = conf({ start: { lead_days: 1, max_ahead_days: 60, weekdays: ["mon"] } });
    expect(startProblem(mondays, "2026-11-10", TODAY)).toMatch(/weekday/);
    expect(earliestStart(mondays, TODAY)).toBe("2026-11-09");
    expect(earliestStart(c, TODAY)).toBe("2026-11-06");
  });
  it("prices an unchosen or invalid start from the earliest start, and says so", () => {
    const q = priced(customInput({ start: "" }));
    expect(q.start).toEqual({ chosen: false, date: "2026-11-06", problem: null });
    const past = priced(customInput({ start: "2026-11-01" }));
    expect(past.start).toEqual({ chosen: false, date: "2026-11-06", problem: "in the past" });
    expect(past.price).not.toBeNull();
  });
  it("lists the closed days a plan runs past", () => {
    const q = priced(customInput(), data({ conf: conf({ blackout_dates: ["2026-11-11", "2026-11-14", "2027-01-01"] }) }));
    expect(q.dates).toEqual(["2026-11-09", "2026-11-10", "2026-11-12", "2026-11-13", "2026-11-16"]);
    expect(q.skipped).toEqual(["2026-11-11"]); // the 14th is a Saturday, not a delivery day
  });
});

describe("price", () => {
  const c = conf();
  it("money is integer minor units, per currency", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
    expect(formatMinor(13650, "USD")).toBe("$136.50");
    expect(formatMinor(1500, "JPY")).toBe("¥1,500");
  });
  it("rounds to a step: nearest, up, down, with no float noise", () => {
    expect(roundTo(12875, 500)).toBe(13000);
    expect(roundTo(12875, 500, "up")).toBe(13000);
    expect(roundTo(12875, 500, "down")).toBe(12500);
    expect(roundTo(12750, 500)).toBe(13000); // half rounds up
    expect(roundTo(46350, 100)).toBe(46400);
    expect(roundTo(0.1 * 3 * 100, 1)).toBe(30);
  });
  it("sum → round → discount → tax, every step returned", () => {
    expect(priceOf(Array(5).fill(2575), 0, c, 2)).toEqual({
      subtotal: 12875, rounded: 13000, discountPct: 0, discount: 0, afterDiscount: 13000,
      taxRate: 5, taxLabel: "VAT", taxInclusive: false, tax: 650, total: 13650,
    });
    const m = priceOf(Array(20).fill(2575), 10, c, 2);
    expect([m.subtotal, m.rounded, m.discount, m.afterDiscount, m.tax, m.total]).toEqual([51500, 51500, 5100, 46400, 2320, 48720]);
  });
  it("rounding the sum vs each day is an explicit choice (The reference project's 1–2 unit discrepancy)", () => {
    const perDay = conf({ rounding: { ...confRaw.rounding, scope: "per_day" } });
    // 25.75 a day: the sum rounds to 130, each day rounds to 25 → 125
    expect(priceOf(Array(5).fill(2575), 0, c, 2).rounded).toBe(13000);
    expect(priceOf(Array(5).fill(2575), 0, perDay, 2).rounded).toBe(12500);
  });
  it("tax can be included in the prices", () => {
    const inc = conf({ tax: { rate: 5, label: "VAT", inclusive: true }, rounding: { step: 0 } });
    const p = priceOf([10500], 0, inc, 2);
    expect([p.afterDiscount, p.tax, p.total]).toEqual([10500, 500, 10500]);
    const none = priceOf([999], 0, conf({ tax: { rate: 0 }, rounding: {} }), 2);
    expect([none.rounded, none.tax, none.total]).toEqual([999, 0, 999]);
  });
  it("zero-decimal currencies work end to end", () => {
    const yen = data({ currency: "JPY", conf: conf({ rounding: { step: 100, discount_step: 10 } }) });
    const q = priced(customInput(), yen); // 25.75 ¥ a day is silly but proves the unit math: 26 + 13 → rounds
    expect(Number.isInteger(q.price!.total)).toBe(true);
  });
  it("prices a custom week over the actual dates, with the rate-card discount", () => {
    const q = priced(customInput());
    expect(q.dates).toHaveLength(5);
    expect(q.price!.total).toBe(13650);
    const month = priced(customInput({ length: "m20" }));
    expect(month.price!.discountPct).toBe(10);
    expect(month.price!.total).toBe(48720);
  });
  it("uses the combo's slots only, and the optional pick is optional", () => {
    const q = priced(customInput({ plan: "one", combo: "dinner" }));
    expect(q.week[0]!.slots.map((s) => s.key)).toEqual(["dinner"]);
    expect(q.price!.subtotal).toBe(5 * 1250);
    const noDrink = customInput();
    for (const d of Object.values(noDrink.picks)) delete (d as Record<string, Record<string, unknown>>).lunch!.drink;
    expect(priced(noDrink).price!.subtotal).toBe(5 * 2250);
  });
});

describe("picks", () => {
  it("missing required picks: no price, a count of what's missing", () => {
    const q = priced(customInput({ picks: { mon: { lunch: { main: { id: "dish-a", size: "" } } } } }));
    expect(q.price).toBeNull();
    expect(q.missing).toBe(9); // 5 dinners + 4 lunches
    expect(q.problems[0]!.code).toBe("incomplete");
  });
  it("unknown items, sizes and disallowed items fail with a clear reason", () => {
    const bad = (pick: { id: string; size: string }) => {
      const i = customInput();
      (i.picks.mon as Record<string, Record<string, unknown>>).lunch!.main = pick;
      return priced(i).problems.map((p) => p.message);
    };
    expect(bad({ id: "nope", size: "" })).toEqual(['mon Lunch: unknown menu item "nope"']);
    expect(bad({ id: "dish-c", size: "Huge" })).toEqual(['mon Lunch: "Dish C" has no size "Huge"']);
    expect(bad({ id: "juice", size: "" })[0]).toMatch(/can't be chosen here/); // a drink as the dish
    expect(bad({ id: "dish-c", size: "Large" })).toEqual([]);
  });
  it("unknown plan, length or malformed input is refused outright", () => {
    expect(quotePlan(customInput({ plan: "five" }), data(), TODAY)).toEqual({ ok: false, problems: [{ code: "unknown", message: 'unknown plan "five"' }] });
    expect(quotePlan(customInput({ length: "x" }), data(), TODAY).ok).toBe(false);
    expect(quotePlan({ v: 2 }, data(), TODAY).ok).toBe(false);
    expect(quotePlan("not json", data(), TODAY).ok).toBe(false);
    // a price sent by the browser is not even part of the input
    expect(PlanInput.safeParse({ ...customInput(), total: 1 }).success).toBe(false);
  });
});

describe("set menus", () => {
  const setInput = (over: Partial<PlanInput> = {}) => customInput({ mode: "set", set: "set-1", length: "w7", picks: {}, ...over });
  it("covers every slot of any plan on every day of any used grid", () => {
    expect(coverage(conf())).toEqual({ slots: ["lunch", "dinner"], days: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] });
  });
  it("prices set rows (with set price overrides); a choice keeps the set's price whatever is picked", () => {
    const q = priced(setInput());
    // Mon 4+10+11, Tue–Thu/Sat/Sun 10+11, Fri 10+9 → 149 → 150, + 5% = 157.50
    expect(q.price!.subtotal).toBe(14900);
    expect(q.price!.total).toBe(15750);
    expect(q.unpicked).toBe(1);
    const pos = String(fullSet().entries.findIndex((e) => e.choice_category));
    const picked = priced(setInput({ choices: { mon: { lunch: { [pos]: { id: "juice", size: "" } } } } }));
    expect(picked.price!.total).toBe(15750);
    expect(picked.unpicked).toBe(0);
    expect(picked.week[0]!.slots[0]!.lines[0]!.choice).toEqual({ label: "Drink of your choice", picked: "Juice" });
  });
  it("a choice outside its list (or sold out) is refused", () => {
    const pos = String(fullSet().entries.findIndex((e) => e.choice_category));
    expect(priced(setInput({ choices: { mon: { lunch: { [pos]: { id: "tea", size: "" } } } } })).price).toBeNull();
    expect(priced(setInput({ choices: { mon: { lunch: { [pos]: { id: "dish-a", size: "" } } } } })).price).toBeNull();
  });
  it("an incomplete set is hidden and can't be quoted (rule 4)", () => {
    const s = fullSet();
    s.entries = s.entries.filter((e) => !(e.day === "sun" && e.slot === "dinner"));
    expect(setProblems(s, conf(), items)).toEqual(["nothing for sun dinner"]);
    expect(completeSets(data({ sets: [s] }))).toEqual([]);
    expect(quotePlan(setInput(), data({ sets: [s] }), TODAY).ok).toBe(false);
    const unknown = fullSet();
    unknown.entries[1]!.item = "gone";
    expect(setProblems(unknown, conf(), items)[0]).toMatch(/unknown menu item "gone"/);
    expect(completeSets(data({ conf: conf({ sets: false }) }))).toEqual([]);
  });
});

describe("plan text", () => {
  it("lists the plan, the week and every price step", () => {
    const t = planText(priced(customInput({ length: "m20" })), data());
    expect(t).toContain("Plan: Your own plan");
    expect(t).toContain("Meals: 2 meals a day");
    expect(t).toContain("Length: Monthly: 4 weeks · Monday to Friday · 20 delivery days");
    expect(t).toContain("First day: Monday, November 9, 2026");
    expect(t).toContain("- Lunch: Dish A · $10.00 + Juice · $3.25");
    expect(t).toContain("Discount (10%): −$51.00");
    expect(t).toContain("VAT (5%): $23.20");
    expect(t).toContain("Total: $487.20");
  });
});

describe("config and seed", () => {
  it("rejects broken references in client.yaml", () => {
    const r = MealPlansConfig.safeParse({ ...confRaw, rates: [{ plan: "nine", length: "w5", discount: 5 }], lengths: [{ key: "x", label: "X", days: 3, grid: "nope" }] });
    expect(r.success).toBe(false);
    const messages = r.error!.issues.map((i) => i.message);
    expect(messages).toContain('unknown plan "nine"');
    expect(messages).toContain('unknown grid "nope"');
    expect(MealPlansConfig.safeParse({}).success).toBe(true); // empty = sections hide
  });
  it("seed document is valid, all sample", () => {
    const doc = MealPlansDoc.parse(seed);
    expect(doc.sets.length).toBeGreaterThan(0);
    expect(doc.sets.every((s) => s.sample === true)).toBe(true);
    expect(doc.copy.payment_note).toMatch(/nothing has been paid/i);
  });
});
