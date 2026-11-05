// The menu document (CMS key "menu") and this module's client.yaml block. Pure: no client values here.
// Currency is NOT in the document: it comes from client.yaml → client.currency (formatted with Intl).
import { z } from "zod";

export const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and dashes");

export const Price = z
  .object({
    size: z.string().optional().meta({ label: "Size", help: "Leave empty for a single price" }),
    price: z.number().min(0).meta({ label: "Price", widget: "money" }),
  })
  .meta({ label: "Price", itemLabel: "size" });

export const Category = z
  .object({
    id: slug.meta({ label: "Key", help: "Used in links. Don't change once the site is live." }),
    name: z.string().min(1).meta({ label: "Name" }),
    blurb: z.string().optional().meta({ label: "Short description", widget: "textarea" }),
  })
  .meta({ label: "Category", itemLabel: "name" });

export const Item = z
  .object({
    id: slug.meta({ label: "Key", help: "Stable id. Don't change once the site is live." }),
    category: slug.meta({ label: "Category" }),
    group: z.string().optional().meta({ label: "Group", help: "Optional sub-heading inside the category" }),
    name: z.string().min(1).meta({ label: "Name" }),
    description: z.string().optional().meta({ label: "Description", widget: "textarea" }),
    prices: z.array(Price).min(1).meta({ label: "Prices", itemLabel: "size" }),
    allergens: z.array(z.string().min(1)).default([]).meta({ label: "Allergens" }),
    tags: z.array(z.string().min(1)).default([]).meta({ label: "Tags" }),
    nutrition: z.record(z.string(), z.union([z.number(), z.string()])).optional().meta({ label: "Nutrition" }),
    available: z.boolean().default(true).meta({ label: "Available", help: "Off shows the item as sold out" }),
    image: z
      .object({ src: z.string().min(1), alt: z.string().default("") })
      .optional()
      .meta({ label: "Photo", widget: "image" }),
    sample: z.boolean().optional(), // placeholder content: dropped from production builds
  })
  .meta({ label: "Item", itemLabel: "name" });

export const Addon = z
  .object({
    name: z.string().min(1).meta({ label: "Name" }),
    prices: z.array(Price).min(1).meta({ label: "Prices", itemLabel: "size" }),
    sample: z.boolean().optional(),
  })
  .meta({ label: "Add-on", itemLabel: "name" });

export const MenuDoc = z
  .object({
    notes: z.array(z.string().min(1)).default([]).meta({ label: "Notes", help: "Shown under the menu: VAT, nutrition disclaimer…" }),
    categories: z.array(Category).default([]).meta({ label: "Categories", itemLabel: "name" }),
    items: z.array(Item).default([]).meta({ label: "Items", itemLabel: "name" }),
    addons: z.array(Addon).default([]).meta({ label: "Add-ons", itemLabel: "name" }),
  })
  .superRefine((m, ctx) => {
    const dupes = (ids: string[], what: string, path: string) =>
      ids.forEach((id, i) => ids.indexOf(id) !== i && ctx.addIssue({ code: "custom", path: [path, i, "id"], message: `duplicate ${what} id "${id}"` }));
    dupes(m.categories.map((c) => c.id), "category", "categories");
    dupes(m.items.map((i) => i.id), "item", "items");
    const cats = new Set(m.categories.map((c) => c.id));
    m.items.forEach((it, i) => cats.has(it.category) || ctx.addIssue({ code: "custom", path: ["items", i, "category"], message: `item "${it.id}" uses unknown category "${it.category}"` }));
  })
  .meta({ label: "Menu" });

const key = z.string().regex(/^[a-z][a-z0-9-]*$/, "lowercase key like vegan or high-protein");

export const MenuConfig = z.strictObject({
  show_prices: z.boolean().default(true),
  /** Allowed size names (e.g. Small, Large). Empty = any text. Items using another size trigger a build warning. */
  sizes: z.array(z.string().min(1)).default([]),
  /** Tag vocabulary. Only listed tags are shown on items; `filterable` ones get a filter pill. */
  tags: z.array(z.strictObject({ key, label: z.string().min(1), filterable: z.boolean().default(true) })).default([]),
  /** Which nutrition values exist, in display order. Items store numbers/text under these keys. */
  nutrition_fields: z.array(z.strictObject({ key, label: z.string().min(1), unit: z.string().default("") })).default([]),
  allergens: z.boolean().default(true),
  price_filter: z.boolean().default(false),
  /** Path of the page that has the full menu (used by the preview's "See the full menu" link). */
  menu_path: z.string().regex(/^\/[a-z0-9\-/]*$/).default("/menu"),
  /** menu-full's page heading (an <h1>). Set "" when the page already has its own h1 (e.g. a hero section above). */
  heading: z.string().default("Menu"),
  /** menu-preview: show items with this tag (empty = first available items), at most `count`. */
  preview: z.strictObject({ tag: z.string().default(""), count: z.number().int().min(1).max(24).default(4) }).default({ tag: "", count: 4 }),
});

export type Price = z.infer<typeof Price>;
export type Category = z.infer<typeof Category>;
export type Item = z.infer<typeof Item>;
export type Addon = z.infer<typeof Addon>;
export type MenuDoc = z.infer<typeof MenuDoc>;
export type MenuConfig = z.infer<typeof MenuConfig>;

/** Lenient checks of a menu against the client's vocabulary. Returned, never thrown: a typo shouldn't stop a publish. */
export function configProblems(menu: MenuDoc, conf: MenuConfig): string[] {
  const out: string[] = [];
  const tags = new Set(conf.tags.map((t) => t.key));
  const fields = new Set(conf.nutrition_fields.map((f) => f.key));
  const sizes = new Set(conf.sizes);
  for (const it of menu.items) {
    if (conf.tags.length) for (const t of it.tags) tags.has(t) || out.push(`"${it.name}": tag "${t}" is not in client.yaml → modules.menu.tags`);
    for (const k of Object.keys(it.nutrition ?? {})) fields.has(k) || out.push(`"${it.name}": nutrition "${k}" is not in modules.menu.nutrition_fields`);
    if (conf.sizes.length) for (const p of it.prices) p.size && !sizes.has(p.size) && out.push(`"${it.name}": size "${p.size}" is not in modules.menu.sizes`);
  }
  return out;
}
