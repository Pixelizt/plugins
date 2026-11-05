// Loads everything the engine needs: this module's config, the menu and the "meal_plans" document, plus the
// currency, locale and time zone from client.yaml. Used by the sections (at build) and by the quote hook (on submit).
import config from "virtual:kit/config";
import { loadDoc } from "../../../kit/content/index.ts";
import { moduleConfig } from "../../../kit/modules.ts";
import { MenuDoc } from "../../menu/lib/schema.ts";
import { MealPlansConfig, MealPlansDoc, type PlanCopy } from "./schema.ts";
import { setProblems, type PlanData } from "./engine.ts";

export type LoadedPlans = PlanData & { title: string; intro: string; copy: PlanCopy; timezone: string; categories: { id: string; name: string }[] };

/** Problems worth a build warning: config that points at menu categories that don't exist, sets that won't show. */
export function planWarnings(data: Pick<LoadedPlans, "conf" | "sets" | "items" | "categories">): string[] {
  const out: string[] = [];
  const cats = new Set(data.categories.map((c) => c.id));
  for (const s of data.conf.slots) for (const p of s.picks) for (const c of p.categories) cats.has(c) || out.push(`slot "${s.key}" pick "${p.key}": menu category "${c}" doesn't exist`);
  if (data.conf.sets) for (const s of data.sets) {
    const why = setProblems(s, data.conf, data.items);
    if (why.length) out.push(`set menu "${s.name}" is hidden until it is complete: ${why.slice(0, 5).join("; ")}${why.length > 5 ? "; …" : ""}`);
  }
  return out;
}

export async function loadPlanData(): Promise<LoadedPlans> {
  const conf = moduleConfig("meal-plans", MealPlansConfig);
  const [menu, doc] = await Promise.all([loadDoc("menu", MenuDoc), loadDoc("meal_plans", MealPlansDoc)]);
  return {
    conf,
    items: menu.items.map(({ id, name, category, group, available, prices }) => ({ id, name, category, group, available, prices })),
    categories: menu.categories.map(({ id, name }) => ({ id, name })),
    sets: doc.sets,
    title: doc.title,
    intro: doc.intro,
    copy: doc.copy,
    currency: config.client.currency,
    locale: config.client.locale,
    timezone: config.client.timezone,
  };
}
