// CSV column spec for the menu. DATA + pure row<->item converters only: the generic CSV engine
// (parsing files, diff preview, export) lives in modules/admin/lib/csv.ts and consumes this.
// One row per item. Lists use " | ". Prices look like "Regular 4.50 | Large 5.20" (or just "4.50").
import { slugify } from "../../../kit/lib/text.ts";
import type { Category, Item, MenuConfig, Price } from "./schema.ts";

export interface CsvColumn {
  /** Stable key in a row object. */
  key: string;
  /** Header text in the file. Import matches headers case-insensitively, by header or by key. */
  header: string;
  required: boolean;
  /** One-line help shown in the import dialog. */
  help: string;
}

/** Columns for this client: nutrition gets one column per configured field. */
export function menuCsvColumns(conf: Pick<MenuConfig, "nutrition_fields">): CsvColumn[] {
  return [
    { key: "id", header: "ID", required: false, help: "Stable key. Leave empty for new items." },
    { key: "category", header: "Category", required: true, help: "Category name (new names create a category)" },
    { key: "group", header: "Group", required: false, help: "Optional sub-heading inside the category" },
    { key: "name", header: "Name", required: true, help: "" },
    { key: "description", header: "Description", required: false, help: "" },
    { key: "prices", header: "Prices", required: true, help: 'Like "Regular 4.50 | Large 5.20", or just "4.50"' },
    { key: "tags", header: "Tags", required: false, help: 'Tag keys separated by " | "' },
    { key: "allergens", header: "Allergens", required: false, help: 'Separated by " | "' },
    ...conf.nutrition_fields.map((f) => ({ key: `nutrition_${f.key}`, header: `Nutrition: ${f.label}`, required: false, help: f.unit ? `Unit: ${f.unit}` : "" })),
    { key: "available", header: "Available", required: false, help: 'yes or no (no = sold out). Empty = yes' },
    { key: "image", header: "Photo URL", required: false, help: "" },
    { key: "image_alt", header: "Photo description", required: false, help: "" },
  ];
}

const SEP = "|";

export function parseList(text: string): string[] {
  return text.split(SEP).map((x) => x.trim()).filter(Boolean);
}
export const formatList = (list: string[]) => list.join(" | ");

/** "Regular 4.50 | Large 5.20" → prices. The number is the last word; whatever precedes it is the size. Throws on a bad part. */
export function parsePrices(text: string): Price[] {
  const parts = parseList(text);
  if (!parts.length) throw new Error("no price");
  return parts.map((part) => {
    const m = /^(?:(.*?)\s+)?(\d+(?:\.\d+)?)$/.exec(part);
    if (!m) throw new Error(`bad price "${part}"`);
    const size = m[1]?.trim();
    return { ...(size ? { size } : {}), price: Number(m[2]) };
  });
}

export const formatPrices = (prices: Price[]) =>
  prices.map((p) => `${p.size ? `${p.size} ` : ""}${Number.isInteger(p.price) ? p.price : p.price.toFixed(2)}`).join(" | ");

/** Item → flat row of strings (category by NAME so the sheet reads well). */
export function itemToRow(item: Item, categories: Category[], conf: Pick<MenuConfig, "nutrition_fields">): Record<string, string> {
  const row: Record<string, string> = {
    id: item.id,
    category: categories.find((c) => c.id === item.category)?.name ?? item.category,
    group: item.group ?? "",
    name: item.name,
    description: item.description ?? "",
    prices: formatPrices(item.prices),
    tags: formatList(item.tags),
    allergens: formatList(item.allergens),
    available: item.available ? "yes" : "no",
    image: item.image?.src ?? "",
    image_alt: item.image?.alt ?? "",
  };
  for (const f of conf.nutrition_fields) row[`nutrition_${f.key}`] = String(item.nutrition?.[f.key] ?? "");
  return row;
}

export interface RowResult {
  item?: Item;
  /** Set when the row names a category that doesn't exist yet. */
  newCategory?: Category;
  errors: string[];
}

/** Flat row → item. `categories` is the current list; unknown category names become `newCategory`. */
export function rowToItem(row: Record<string, string>, categories: Category[], conf: Pick<MenuConfig, "nutrition_fields">): RowResult {
  const get = (k: string) => (row[k] ?? "").trim();
  const errors: string[] = [];
  const name = get("name");
  const catText = get("category");
  if (!name) errors.push("name is required");
  if (!catText) errors.push("category is required");
  let prices: Price[] = [];
  try {
    prices = parsePrices(get("prices"));
  } catch (e) {
    errors.push((e as Error).message);
  }
  if (errors.length) return { errors };

  const found = categories.find((c) => c.id === catText || c.name.toLowerCase() === catText.toLowerCase());
  const newCategory = found ? undefined : { id: slugify(catText), name: catText };
  if (newCategory && !newCategory.id) return { errors: [`category "${catText}" has no usable letters or digits`] };
  const category = found?.id ?? newCategory!.id;

  const nutrition: Record<string, number | string> = {};
  for (const f of conf.nutrition_fields) {
    const v = get(`nutrition_${f.key}`);
    if (v) nutrition[f.key] = Number.isFinite(Number(v)) ? Number(v) : v;
  }
  const image = get("image");
  const group = get("group");
  const description = get("description");
  const item: Item = {
    id: slugify(get("id")) || slugify(`${category}-${name}`),
    category,
    ...(group ? { group } : {}),
    name,
    ...(description ? { description } : {}),
    prices,
    allergens: parseList(get("allergens")),
    tags: parseList(get("tags")).map((t) => t.toLowerCase()),
    ...(Object.keys(nutrition).length ? { nutrition } : {}),
    available: !/^(no|false|0)$/i.test(get("available")),
    ...(image ? { image: { src: image, alt: get("image_alt") } } : {}),
  };
  return { item, newCategory, errors: [] };
}
