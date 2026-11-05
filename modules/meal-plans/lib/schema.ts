// This module's client.yaml block (pricing structure, owned by the agency) and its CMS document (set menus
// and copy, edited by the client). Pure: no client values here. Every number that the reference project hardcoded is a field.
import { z } from "zod";

import { slug } from "../../menu/lib/schema.ts";
import { DAYS, isIsoDate, type Day as DayKey } from "../../../kit/lib/time.ts";

export { DAYS };
export type Day = DayKey;
export const Day = z.enum(DAYS);

const key = z.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase key like lunch or two-meals");
const isoDate = z.string().refine(isIsoDate, "a real date like 2026-12-25");

// ---------- client.yaml → modules.meal-plans ----------

/** One thing the customer picks inside a meal: the dish, an optional drink… */
export const PickDef = z.strictObject({
  key,
  label: z.string().min(1),
  /** Menu category ids the customer chooses from. */
  categories: z.array(slug).min(1),
  required: z.boolean().default(true),
});

/** A meal of the day (breakfast, lunch…). */
export const SlotDef = z.strictObject({ key, label: z.string().min(1), picks: z.array(PickDef).min(1) });

/** Which slots a plan delivers. A plan with several combos asks which one (e.g. lunch + dinner). */
export const ComboDef = z.strictObject({ key, label: z.string().default(""), slots: z.array(key).min(1) });

export const PlanDef = z.strictObject({
  key,
  label: z.string().min(1),
  description: z.string().default(""),
  combos: z.array(ComboDef).min(1),
});

/** The weekdays meals are delivered on, e.g. Monday to Friday. */
export const GridDef = z.strictObject({ key, label: z.string().min(1), days: z.array(Day).min(1) });

export const LengthDef = z.strictObject({
  key,
  label: z.string().min(1),
  /** Number of delivery days (not calendar days). */
  days: z.number().int().min(1).max(366),
  grid: key,
  /** Lengths sharing a group are shown together under its name (e.g. "Monthly"). */
  group: z.string().default(""),
  /** Display text only, e.g. the pause rule. Not used for pricing. */
  note: z.string().default(""),
});

export const RateDef = z.strictObject({ plan: key, length: key, discount: z.number().min(0).max(100) });

export const Rounding = z.strictObject({
  /** Round the menu total to this step in major units (5 → nearest 5.00). 0 = no rounding. */
  step: z.number().min(0).default(0),
  mode: z.enum(["nearest", "up", "down"]).default("nearest"),
  /** "total": round the plan's sum once. "per_day": round each delivery day, then add up. Results can differ by a few units. */
  scope: z.enum(["total", "per_day"]).default("total"),
  /** Round the amount after the discount to this step (1 → whole units). 0 = to the minor unit. */
  discount_step: z.number().min(0).default(0),
});

export const Tax = z.strictObject({
  /** Percent, e.g. 5. 0 hides the tax line. */
  rate: z.number().min(0).max(100).default(0),
  label: z.string().min(1).default("Tax"),
  /** true: menu prices already include tax (the tax line shows the included part). false: tax is added on top. */
  inclusive: z.boolean().default(false),
});

export const StartRules = z.strictObject({
  /** Earliest start = today (business time zone) + this many days. */
  lead_days: z.number().int().min(0).max(60).default(1),
  max_ahead_days: z.number().int().min(1).max(366).default(90),
  /** Allowed start weekdays. Empty = any day. */
  weekdays: z.array(Day).default([]),
});

const ROUNDING_DEFAULT = { step: 0, mode: "nearest", scope: "total", discount_step: 0 } as const;

export const MealPlansConfig = z
  .strictObject({
    /** The form definition (src/content/forms.json) the builder submits through. */
    form: z.string().regex(/^[a-z][a-z0-9-]*$/).default("meal-plan"),
    /** The form field that carries the plan text. */
    plan_field: z.string().regex(/^[a-z][a-z0-9_]*$/).default("plan"),
    slots: z.array(SlotDef).default([]),
    plans: z.array(PlanDef).default([]),
    grids: z.array(GridDef).default([]),
    lengths: z.array(LengthDef).default([]),
    /** Discount percent per (plan, length). Missing pairs have no discount. */
    rates: z.array(RateDef).default([]),
    rounding: Rounding.default(ROUNDING_DEFAULT),
    tax: Tax.default({ rate: 0, label: "Tax", inclusive: false }),
    start: StartRules.default({ lead_days: 1, max_ahead_days: 90, weekdays: [] }),
    /** Closed days (holidays): no meals are delivered on them; the plan runs on past them. */
    blackout_dates: z.array(isoDate).default([]),
    /** Offer the set menus from the CMS document. */
    sets: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    const dupes = (keys: string[], what: string, path: string) =>
      keys.forEach((k, i) => keys.indexOf(k) !== i && ctx.addIssue({ code: "custom", path: [path, i, "key"], message: `duplicate ${what} key "${k}"` }));
    dupes(c.slots.map((s) => s.key), "slot", "slots");
    dupes(c.plans.map((p) => p.key), "plan", "plans");
    dupes(c.grids.map((g) => g.key), "grid", "grids");
    dupes(c.lengths.map((l) => l.key), "length", "lengths");
    const slots = new Set(c.slots.map((s) => s.key));
    const grids = new Set(c.grids.map((g) => g.key));
    c.slots.forEach((s, i) => dupes(s.picks.map((p) => p.key), `pick (slot ${s.key})`, `slots.${i}.picks`));
    c.slots.forEach((s, i) => s.picks.some((p) => p.required) || ctx.addIssue({ code: "custom", path: ["slots", i, "picks"], message: `slot "${s.key}" needs at least one required pick` }));
    c.plans.forEach((p, i) => {
      dupes(p.combos.map((x) => x.key), `combo (plan ${p.key})`, `plans.${i}.combos`);
      p.combos.forEach((x, j) => x.slots.forEach((s) => slots.has(s) || ctx.addIssue({ code: "custom", path: ["plans", i, "combos", j, "slots"], message: `unknown slot "${s}"` })));
      if (p.combos.length > 1) p.combos.forEach((x, j) => x.label || ctx.addIssue({ code: "custom", path: ["plans", i, "combos", j, "label"], message: "a plan with several combos needs a label on each" }));
    });
    c.lengths.forEach((l, i) => grids.has(l.grid) || ctx.addIssue({ code: "custom", path: ["lengths", i, "grid"], message: `unknown grid "${l.grid}"` }));
    const seen = new Set<string>();
    c.rates.forEach((r, i) => {
      if (!c.plans.some((p) => p.key === r.plan)) ctx.addIssue({ code: "custom", path: ["rates", i, "plan"], message: `unknown plan "${r.plan}"` });
      if (!c.lengths.some((l) => l.key === r.length)) ctx.addIssue({ code: "custom", path: ["rates", i, "length"], message: `unknown length "${r.length}"` });
      const k = `${r.plan}|${r.length}`;
      if (seen.has(k)) ctx.addIssue({ code: "custom", path: ["rates", i], message: `rate for ${r.plan} × ${r.length} is listed twice` });
      seen.add(k);
    });
  });

export type MealPlansConfig = z.infer<typeof MealPlansConfig>;
export type SlotDef = z.infer<typeof SlotDef>;
export type PlanDef = z.infer<typeof PlanDef>;
export type LengthDef = z.infer<typeof LengthDef>;

/** True when the block has enough to offer a plan at all. Sections render nothing otherwise (rule 4). */
export const isConfigured = (c: MealPlansConfig) => c.slots.length > 0 && c.plans.length > 0 && c.lengths.length > 0;

// ---------- CMS document "meal_plans" ----------

/**
 * One row of a set menu: a menu item on a day and meal, or an "of your choice" pick-list.
 * Flat rows (not nested day → meal → items) so the generated admin gives a sortable list with CSV import.
 */
export const SetEntry = z
  .object({
    day: Day.meta({ label: "Day" }),
    slot: key.meta({ label: "Meal", help: "A slot key from client.yaml, e.g. lunch" }),
    item: z.string().default("").meta({ label: "Menu item id", help: "Leave empty for an 'of your choice' row" }),
    size: z.string().default("").meta({ label: "Size", help: "Must match a size on the menu item. Empty for single-price items" }),
    price: z.number().min(0).optional().meta({ label: "Set price", widget: "money", help: "Overrides the menu price for this set. Required for a choice row" }),
    choice_label: z.string().default("").meta({ label: "Choice label", help: "e.g. Soup of your choice" }),
    choice_category: z.string().default("").meta({ label: "Choice category", help: "Menu category id the customer picks from" }),
    choice_group: z.string().default("").meta({ label: "Choice group", help: "Optional: only items in this menu group" }),
  })
  .superRefine((e, ctx) => {
    if (e.choice_category) {
      if (e.item) ctx.addIssue({ code: "custom", path: ["item"], message: "a choice row has no fixed item" });
      if (!e.choice_label) ctx.addIssue({ code: "custom", path: ["choice_label"], message: "a choice row needs a label" });
      if (e.price === undefined) ctx.addIssue({ code: "custom", path: ["price"], message: "a choice row needs the set's price (the pick never changes it)" });
    } else if (!e.item) ctx.addIssue({ code: "custom", path: ["item"], message: "give a menu item id, or a choice category" });
  })
  .meta({ label: "Set menu row", itemLabel: "item" });

export const SetMenu = z
  .object({
    id: slug.meta({ label: "Key", help: "Stable id. Don't change once the site is live." }),
    name: z.string().min(1).meta({ label: "Name" }),
    description: z.string().default("").meta({ label: "Description", widget: "textarea" }),
    entries: z.array(SetEntry).default([]).meta({ label: "Rows", itemLabel: "item" }),
    sample: z.boolean().optional(),
  })
  .meta({ label: "Set menu", itemLabel: "name" });

export const PlanCopy = z
  .object({
    mode_label: z.string().default("How would you like to start?").meta({ label: "Set or custom question" }),
    mode_set: z.string().default("A set menu").meta({ label: "Set menu option" }),
    mode_custom: z.string().default("Build my own").meta({ label: "Build-your-own option" }),
    sets_label: z.string().default("Set menu").meta({ label: "Set menu heading" }),
    plan_label: z.string().default("Meals a day").meta({ label: "Plan heading" }),
    combo_label: z.string().default("Which meals?").meta({ label: "Combo heading" }),
    length_label: z.string().default("Plan length").meta({ label: "Length heading" }),
    start_label: z.string().default("Start date").meta({ label: "Start date label" }),
    week_label: z.string().default("Your week").meta({ label: "Week heading" }),
    week_note: z.string().default("The week repeats for the length of the plan.").meta({ label: "Week note" }),
    summary_label: z.string().default("Your plan").meta({ label: "Summary heading" }),
    price_note: z.string().default("The team will confirm your plan and its price before anything is paid.").meta({ label: "Price note", widget: "textarea" }),
    payment_note: z
      .string()
      .min(1)
      .default("Nothing has been paid yet. We'll contact you to confirm your plan, the start date and payment.")
      .meta({ label: "Payment note (emails)", widget: "textarea", help: "Says what the request is NOT (rule 18). Keep it." }),
    rates_title: z.string().default("Plan discounts").meta({ label: "Rate card title" }),
    rates_intro: z.string().default("").meta({ label: "Rate card intro", widget: "textarea" }),
    no_js: z.string().default("The plan builder needs JavaScript. Describe the plan you'd like in the form below and we'll price it for you.").meta({ label: "Without JavaScript" }),
  })
  .meta({ label: "Wording" });

export const MealPlansDoc = z
  .object({
    title: z.string().min(1).meta({ label: "Title" }),
    intro: z.string().default("").meta({ label: "Intro", widget: "textarea" }),
    sets: z.array(SetMenu).default([]).meta({ label: "Set menus", itemLabel: "name" }),
    copy: PlanCopy.prefault({}),
  })
  .superRefine((d, ctx) => {
    const ids = d.sets.map((s) => s.id);
    ids.forEach((id, i) => ids.indexOf(id) !== i && ctx.addIssue({ code: "custom", path: ["sets", i, "id"], message: `duplicate set id "${id}"` }));
  })
  .meta({ label: "Meal plans" });

export type SetEntry = z.infer<typeof SetEntry>;
export type SetMenu = z.infer<typeof SetMenu>;
export type PlanCopy = z.infer<typeof PlanCopy>;
export type MealPlansDoc = z.infer<typeof MealPlansDoc>;

// ---------- what the browser sends (the picks only, never a price) ----------

const PickRef = z.strictObject({ id: z.string().max(80), size: z.string().max(60).default("") });
const SlotPicks = z.record(z.string().max(40), PickRef.nullable());
const DayPicks = z.record(z.string().max(40), SlotPicks);

export const PlanInput = z.strictObject({
  v: z.literal(1),
  mode: z.enum(["custom", "set"]),
  plan: z.string().max(40),
  combo: z.string().max(40).default(""),
  length: z.string().max(40),
  /** "" = not chosen yet. */
  start: z.string().max(10).default(""),
  set: z.string().max(80).default(""),
  /** custom: day → slot → pick key → item */
  picks: z.partialRecord(Day, DayPicks).default({}),
  /** set: day → slot → row position (as text) → item chosen for an "of your choice" row */
  choices: z.partialRecord(Day, DayPicks).default({}),
  /** The total the page showed, in minor units. Never used for pricing: only compared, to flag a stale page. */
  shown_total: z.number().int().min(0).max(1e10).optional(),
});
export type PlanInput = z.infer<typeof PlanInput>;
export type PickRef = z.infer<typeof PickRef>;
