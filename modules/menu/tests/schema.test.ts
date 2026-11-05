import { describe, expect, it } from "vitest";
import { MenuConfig, MenuDoc, configProblems } from "../lib/schema.ts";
import { formatPrice } from "../../../kit/lib/money.ts";
import { nutritionLines } from "../lib/format.ts";
import { menuJsonLd } from "../lib/jsonld.ts";
import seed from "../seed/menu.json";

describe("menu document", () => {
  it("accepts the seed, and every seed item is flagged as sample", () => {
    const r = MenuDoc.parse(seed);
    expect(r.items.length).toBeGreaterThanOrEqual(6);
    expect(r.items.every((i) => i.sample === true)).toBe(true);
  });
  it("rejects an unknown category and duplicate ids", () => {
    const bad = structuredClone(seed) as typeof seed;
    bad.items[0]!.category = "nope";
    expect(MenuDoc.safeParse(bad).success).toBe(false);
    const dup = structuredClone(seed) as typeof seed;
    dup.items[1]!.id = dup.items[0]!.id;
    expect(MenuDoc.safeParse(dup).error?.issues[0]?.message).toContain("duplicate item id");
    const dupCat = structuredClone(seed) as typeof seed;
    dupCat.categories[1]!.id = dupCat.categories[0]!.id;
    expect(MenuDoc.safeParse(dupCat).success).toBe(false);
  });
  it("defaults available, tags and allergens", () => {
    const m = MenuDoc.parse({ categories: [{ id: "a", name: "A" }], items: [{ id: "x", category: "a", name: "X", prices: [{ price: 1 }] }] });
    expect(m.items[0]).toMatchObject({ available: true, tags: [], allergens: [] });
  });
  it("needs at least one price and no negative price", () => {
    const m = (prices: unknown) => MenuDoc.safeParse({ categories: [{ id: "a", name: "A" }], items: [{ id: "x", category: "a", name: "X", prices }] }).success;
    expect(m([])).toBe(false);
    expect(m([{ price: -1 }])).toBe(false);
    expect(m([{ price: 0 }])).toBe(true);
  });
});

describe("menu config", () => {
  it("has working defaults and rejects unknown keys", () => {
    expect(MenuConfig.parse({})).toMatchObject({ show_prices: true, allergens: true, price_filter: false, tags: [], sizes: [] });
    expect(MenuConfig.safeParse({ currency: "AED" }).success).toBe(false); // currency lives in client.client.currency
  });
  it("reports vocabulary problems without throwing", () => {
    const menu = MenuDoc.parse(seed);
    const conf = MenuConfig.parse({ tags: [{ key: "vegan", label: "Vegan" }], sizes: ["Regular"], nutrition_fields: [{ key: "protein", label: "Protein" }] });
    const p = configProblems(menu, conf);
    expect(p.some((x) => x.includes('tag "popular"'))).toBe(true);
    expect(p.some((x) => x.includes('size "Large"'))).toBe(true);
    expect(p.some((x) => x.includes('nutrition "calories"'))).toBe(true);
    expect(configProblems(menu, MenuConfig.parse({}))).toEqual([expect.stringContaining('nutrition "calories"')]);
  });
});

describe("formatting", () => {
  it("formats with the client's currency, not a hardcoded one", () => {
    expect(formatPrice(4.5, "USD", "en")).toBe("$4.50");
    expect(formatPrice(4.5, "GBP", "en")).toBe("£4.50");
  });
  it("shows only configured nutrition fields, in configured order, with units", () => {
    const fields = MenuConfig.parse({ nutrition_fields: [{ key: "protein", label: "Protein", unit: "g" }, { key: "calories", label: "Calories" }] }).nutrition_fields;
    expect(nutritionLines({ calories: 150, protein: 8, other: 1 }, fields)).toEqual([
      { label: "Protein", value: "8 g" },
      { label: "Calories", value: "150" },
    ]);
    expect(nutritionLines(undefined, fields)).toEqual([]);
  });
});

describe("json-ld", () => {
  const menu = MenuDoc.parse(seed);
  const ld = menuJsonLd(menu, { name: "Demo menu", url: "https://x.test/menu", currency: "USD", showPrices: true });
  it("builds Menu > MenuSection > MenuItem with offers, skipping sold-out items and empty sections", () => {
    expect(ld["@type"]).toBe("Menu");
    const drinks = ld.hasMenuSection[0]!;
    expect(drinks.name).toBe("Drinks");
    expect(drinks.hasMenuItem.map((i) => i.name)).toEqual(["Demo Latte", "Demo Cold Brew"]); // mint tea is sold out
    expect(drinks.hasMenuItem[0]!.offers).toEqual([
      { "@type": "Offer", price: "4.50", priceCurrency: "USD", name: "Regular" },
      { "@type": "Offer", price: "5.20", priceCurrency: "USD", name: "Large" },
    ]);
    const soldOut = MenuDoc.parse({ ...seed, items: seed.items.filter((i) => i.category !== "sides" || false).concat([{ ...seed.items[5]!, available: false }]) });
    const l2 = menuJsonLd(soldOut, { name: "n", url: "u", currency: "USD", showPrices: true });
    expect(l2.hasMenuSection.map((s) => s.name)).toEqual(["Drinks", "Bites"]); // Sides has only a sold-out item
  });
  it("omits offers when prices are hidden", () => {
    const l = menuJsonLd(menu, { name: "n", url: "u", currency: "USD", showPrices: false });
    expect(JSON.stringify(l)).not.toContain("offers");
  });
});
