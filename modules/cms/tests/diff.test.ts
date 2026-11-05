import { describe, expect, it } from "vitest";
import { z } from "zod";
import { canon, diffDoc, diffList, itemName } from "../lib/diff.ts";

const Menu = z.object({
  title: z.string().meta({ label: "Page title" }),
  items: z.array(z.object({ id: z.string(), name: z.string().meta({ label: "Name" }), price: z.number().meta({ label: "Price" }) })),
});
const schema = z.toJSONSchema(Menu) as Parameters<typeof diffDoc>[2];

describe("cms diff", () => {
  it("treats empty values and numeric strings as equal", () => {
    expect(canon("")).toBe(canon(null));
    expect(canon([])).toBe(canon(undefined));
    expect(canon("24")).toBe(canon(24));
    expect(canon({ a: "", b: 1 })).toBe(canon({ b: "1" }));
  });
  it("describes field and list changes with schema labels", () => {
    const before = { title: "Menu", items: [{ id: "a", name: "Latte", price: 4 }, { id: "b", name: "Mocha", price: 5 }] };
    const after = { title: "Our menu", items: [{ id: "a", name: "Latte", price: 4.5 }, { id: "c", name: "Flat white", price: 4 }] };
    expect(diffDoc(before, after, schema)).toEqual([
      'Page title: "Menu" → "Our menu"',
      "Items: Changed Latte (Price)",
      "Items: Added Flat white",
      "Items: Removed Mocha",
    ]);
  });
  it("matches items by id, so a rename is one change", () => {
    expect(diffList([{ id: "a", name: "Latte" }], [{ id: "a", name: "Caffè latte" }])).toEqual(["Changed Caffè latte (Name)"]);
  });
  it("reports pure reorders, first saves and no-ops", () => {
    expect(diffList([{ name: "A" }, { name: "B" }], [{ name: "B" }, { name: "A" }])).toEqual(["Reordered"]);
    expect(diffDoc(undefined, { a: 1 })).toEqual(["First version saved"]);
    expect(diffDoc({ a: 1 }, { a: "1" })).toEqual([]);
  });
  it("names items sensibly", () => {
    expect(itemName({ q: "Do you open on Sundays?" })).toBe("Do you open on Sundays?");
    expect(itemName({ price: 3 }, undefined, 2)).toBe("Item 3");
  });
});
