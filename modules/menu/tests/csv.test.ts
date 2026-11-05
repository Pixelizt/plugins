import { describe, expect, it } from "vitest";
import { formatPrices, itemToRow, menuCsvColumns, parsePrices, rowToItem } from "../lib/csv-columns.ts";
import { MenuDoc } from "../lib/schema.ts";
import seed from "../seed/menu.json";

const conf = { nutrition_fields: [{ key: "calories", label: "Calories", unit: "kcal" }] };
const menu = MenuDoc.parse(seed);

describe("csv prices", () => {
  it("parses sizes and plain prices", () => {
    expect(parsePrices("Regular 4.50 | Large 5.20")).toEqual([{ size: "Regular", price: 4.5 }, { size: "Large", price: 5.2 }]);
    expect(parsePrices("4")).toEqual([{ price: 4 }]);
    expect(parsePrices("Extra Large 6.00")).toEqual([{ size: "Extra Large", price: 6 }]);
  });
  it("rejects bad input", () => {
    expect(() => parsePrices("")).toThrow();
    expect(() => parsePrices("Regular")).toThrow(/bad price/);
    expect(() => parsePrices("Regular -1")).toThrow();
  });
  it("formats and round-trips", () => {
    const p = [{ size: "Regular", price: 4.5 }, { price: 3 }];
    expect(formatPrices(p)).toBe("Regular 4.50 | 3");
    expect(parsePrices(formatPrices(p))).toEqual(p);
  });
});

describe("csv columns and rows", () => {
  it("adds one nutrition column per configured field", () => {
    expect(menuCsvColumns(conf).map((c) => c.key)).toContain("nutrition_calories");
    expect(menuCsvColumns({ nutrition_fields: [] }).some((c) => c.key.startsWith("nutrition_"))).toBe(false);
    expect(menuCsvColumns(conf).filter((c) => c.required).map((c) => c.key)).toEqual(["category", "name", "prices"]);
  });
  it("round-trips every seed item through a row", () => {
    for (const it of menu.items) {
      const row = itemToRow(it, menu.categories, conf);
      const back = rowToItem(row, menu.categories, conf);
      expect(back.errors).toEqual([]);
      expect(back.newCategory).toBeUndefined();
      const { sample: _sample, ...expected } = it;
      expect(back.item).toEqual(expected);
    }
  });
  it("writes the category name, tags and allergens as lists, sold out as no", () => {
    const row = itemToRow(menu.items.find((i) => i.id === "demo-croissant")!, menu.categories, conf);
    expect(row).toMatchObject({ category: "Bites", allergens: "Gluten | Milk", tags: "popular", available: "yes" });
    expect(itemToRow(menu.items.find((i) => i.id === "demo-mint-tea")!, menu.categories, conf).available).toBe("no");
  });
  it("creates a category for an unknown name and derives an id", () => {
    const r = rowToItem({ category: "Hot Drinks", name: "Chai", prices: "3.5", tags: "Vegan | Spicy", available: "no" }, menu.categories, conf);
    expect(r.newCategory).toEqual({ id: "hot-drinks", name: "Hot Drinks" });
    expect(r.item).toMatchObject({ id: "hot-drinks-chai", category: "hot-drinks", tags: ["vegan", "spicy"], available: false });
  });
  it("matches an existing category by name, case-insensitively", () => {
    expect(rowToItem({ category: "drinks", name: "X", prices: "1" }, menu.categories, conf).item?.category).toBe("drinks");
    expect(rowToItem({ category: "DRINKS", name: "X", prices: "1" }, menu.categories, conf).newCategory).toBeUndefined();
  });
  it("reports every problem in a row", () => {
    expect(rowToItem({ category: "", name: "", prices: "oops" }, menu.categories, conf).errors).toHaveLength(3);
  });
  it("reads nutrition numbers as numbers", () => {
    const r = rowToItem({ category: "Drinks", name: "X", prices: "1", nutrition_calories: "120" }, menu.categories, conf);
    expect(r.item?.nutrition).toEqual({ calories: 120 });
  });
});
