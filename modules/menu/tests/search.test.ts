import { describe, expect, it } from "vitest";
import { buildIndex, normalize, searchItems } from "../lib/search.ts";

const item = (id: string, name: string, o: Partial<{ category: string; group: string; description: string; tags: string[]; allergens: string[]; price: number }> = {}) => ({
  id,
  category: o.category ?? "drinks",
  group: o.group,
  name,
  description: o.description,
  prices: [{ price: o.price ?? 4 }],
  allergens: o.allergens ?? [],
  tags: o.tags ?? [],
});

const index = buildIndex([
  item("a", "Iced Café Latte", { price: 5, description: "with oat milk" }),
  item("b", "Latte Art Class", { price: 20 }),
  item("c", "Chocolate Shake", { description: "thick, like a latte", tags: ["vegan"], price: 6 }),
  item("d", "Hot Mocha", { group: "Latte family", price: 4.5 }),
  item("e", "Mac & Cheese", { allergens: ["Milk"], category: "bites", price: 9 }),
  item("f", "Falafel Wrap", { tags: ["vegan", "spicy"], category: "bites", price: 7 }),
]);
const ids = (q: string, f = {}) => searchItems(index, q, f).map((e) => e.id);

describe("normalize", () => {
  it("lowercases, strips accents, turns punctuation to spaces, collapses spaces", () => {
    expect(normalize("  Café   Crème-Brûlée! ")).toBe("cafe creme brulee");
    expect(normalize("Mac & Cheese")).toBe("mac cheese");
  });
});

describe("searchItems", () => {
  it("returns everything in menu order for an empty query", () => {
    expect(ids("")).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(ids("   ")).toEqual(["a", "b", "c", "d", "e", "f"]);
  });
  it("matches accents both ways", () => {
    expect(ids("cafe")).toEqual(["a"]);
    expect(ids("CAFÉ")).toEqual(["a"]);
  });
  it("ranks name-start > name-word > name-substring > group/tags > description", () => {
    // b: name starts with latte; a: a name word; d: group; c: description
    expect(ids("latte")).toEqual(["b", "a", "d", "c"]);
    expect(ids("ocol")).toEqual(["c"]); // substring of a name word
  });
  it("matches every word, in any order, as word prefixes or substrings", () => {
    expect(ids("latte iced")).toEqual(["a"]);
    expect(ids("ice lat")).toEqual(["a"]);
    expect(ids("choc xyz")).toEqual([]);
  });
  it("finds tags and allergens", () => {
    expect(ids("vegan")).toEqual(["c", "f"]);
    expect(ids("milk")).toEqual(["e", "a"]); // e: allergen outranks a: description
  });
  it("is a stable sort by menu order on ties", () => {
    expect(ids("a l")).toEqual(searchItems(index, "a l").map((e) => e.id));
    const same = buildIndex([item("x", "Tea"), item("y", "Tea"), item("z", "Tea")]);
    expect(searchItems(same, "tea").map((e) => e.id)).toEqual(["x", "y", "z"]);
  });
  it("filters by tags (all of them), category and max price, with or without a query", () => {
    expect(ids("", { tags: ["vegan"] })).toEqual(["c", "f"]);
    expect(ids("", { tags: ["vegan", "spicy"] })).toEqual(["f"]);
    expect(ids("", { category: "bites" })).toEqual(["e", "f"]);
    expect(ids("", { maxPrice: 5 })).toEqual(["a", "d"]);
    expect(ids("latte", { maxPrice: 5 })).toEqual(["a", "d"]);
    expect(ids("", { maxPrice: 0 })).toEqual([]);
  });
  it("precomputes the index once: entries carry normalized strings and the cheapest price", () => {
    const e = index[0]!;
    expect(e.name).toBe("iced cafe latte");
    expect(e.price).toBe(5);
    expect(buildIndex([{ ...item("m", "Multi"), prices: [{ price: 5 }, { price: 3 }] }])[0]!.price).toBe(3);
  });
});
