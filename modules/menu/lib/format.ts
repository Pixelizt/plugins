// Nutrition text and price helpers. Money formatting is the core's (src/kit/lib/money.ts); currency and locale come from client.yaml.
import type { MenuConfig, Price } from "./schema.ts";

export function nutritionLines(nutrition: Record<string, number | string> | undefined, fields: MenuConfig["nutrition_fields"]): { label: string; value: string }[] {
  if (!nutrition) return [];
  return fields
    .filter((f) => nutrition[f.key] !== undefined && nutrition[f.key] !== "")
    .map((f) => ({ label: f.label, value: `${nutrition[f.key]}${f.unit ? ` ${f.unit}` : ""}` }));
}

export const minPrice = (prices: Price[]): number | null => (prices.length ? Math.min(...prices.map((p) => p.price)) : null);
