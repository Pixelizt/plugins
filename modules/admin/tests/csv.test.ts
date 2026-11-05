import { describe, expect, it } from "vitest";
import { type ColumnSpec, boolColumn, canon, diffImport, importRows, listColumn, numberColumn, parseCsv, textColumn, toCsv } from "../lib/csv.ts";

// A small list in the shape the admin edits: a name, a price, a yes/no flag and a list of tags.
interface Item {
  id: string;
  name: string;
  price: number;
  available: boolean;
  tags: string[];
}
const columns: ColumnSpec[] = [
  textColumn("id", "id"),
  textColumn("name", "name", { required: true }),
  numberColumn("price", "price", { required: true }),
  boolColumn("available", "available"),
  listColumn("tags", "tags"),
];
const items: Item[] = [
  { id: "a", name: "Latte", price: 22, available: true, tags: ["hot", "milk"] },
  { id: "b", name: "Mocha, large", price: 24, available: false, tags: [] },
];

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, quoted line breaks, CRLF and a BOM", () => {
    const rows = parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n"two\nlines",z\n');
    expect(rows).toEqual([
      ["a", "b"],
      ["x, y", 'say "hi"'],
      ["two\nlines", "z"],
    ]);
  });

  it("drops blank lines, so a trailing newline is not an empty row", () => {
    expect(parseCsv("a,b\n1,2\n\n,\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("toCsv", () => {
  it("quotes only what needs it, writes the header from the columns, and ends with CRLF", () => {
    const csv = toCsv(items, columns);
    expect(csv).toBe('id,name,price,available,tags\r\na,Latte,22,yes,hot|milk\r\nb,"Mocha, large",24,no,\r\n');
  });

  it("escapes quotes and line breaks inside a cell", () => {
    const csv = toCsv([{ name: 'He said "hi"\nthen left' }], [textColumn("name", "name")]);
    expect(csv).toBe('name\r\n"He said ""hi""\nthen left"\r\n');
    expect(importRows(csv, [textColumn("name", "name")]).rows).toEqual([{ name: 'He said "hi"\nthen left' }]);
  });

  it("prefixes a formula start with an apostrophe, and import takes it off again", () => {
    const evil = [{ name: '=HYPERLINK("https://x.example","click")' }, { name: "+1+1" }, { name: "-2+3" }, { name: "@SUM(A1)" }, { name: "\tcmd" }];
    const cols = [textColumn("name", "name")];
    const csv = toCsv(evil, cols);
    expect(csv).toContain(`'=HYPERLINK`);
    expect(csv).toContain("'+1+1");
    expect(csv).toContain("'-2+3");
    expect(csv).toContain("'@SUM(A1)");
    const back = importRows(csv, cols);
    expect(back.errors).toEqual([]);
    expect(back.rows).toEqual(evil);
  });

  it("round trips a negative number, which is also escaped, back to the same value", () => {
    const cols = [numberColumn("price", "price")];
    const csv = toCsv([{ price: -3 }], cols);
    expect(importRows(csv, cols).rows).toEqual([{ price: -3 }]);
  });
});

describe("importRows", () => {
  it("matches headers case-insensitively and ignores columns it does not know", () => {
    const csv = "NAME,Price,Colour\nLatte,22,red\n";
    const r = importRows(csv, columns);
    expect(r.errors).toEqual([]);
    expect(r.rows).toEqual([{ name: "Latte", price: 22 }]);
  });

  it("keeps only the keys whose columns are in the file", () => {
    const r = importRows("name,price\nLatte,22\n", columns);
    expect(r.rows[0]).not.toHaveProperty("available");
    expect(r.rows[0]).not.toHaveProperty("tags");
  });

  it("reports a missing required column on line 1 and returns no rows", () => {
    const r = importRows("name,tags\nLatte,hot\n", columns);
    expect(r.rows).toEqual([]);
    expect(r.errors).toEqual([{ line: 1, column: "price", message: "Missing column: price" }]);
  });

  it("collects every bad cell with its line and column, and keeps the good rows", () => {
    const csv = "name,price,available\nLatte,22,yes\nMocha,abc,yes\n,21,no\nFlat white,24,maybe\n";
    const r = importRows(csv, columns);
    expect(r.errors).toEqual([
      { line: 3, column: "price", message: "price must be a number" },
      { line: 4, column: "name", message: "name is required" },
      { line: 5, column: "available", message: "available must be yes or no" },
    ]);
    expect(r.rows).toEqual([{ name: "Latte", price: 22, available: true }]);
  });

  it("counts lines in the file, so blank lines and quoted line breaks do not shift the numbers", () => {
    const csv = 'name,price\n\nLatte,22\n"two\nlines",abc\n';
    const r = importRows(csv, columns);
    expect(r.errors).toEqual([{ line: 4, column: "price", message: "price must be a number" }]);
  });

  it("reports a duplicate id on the row that repeats it", () => {
    const csv = "id,name,price\nx,A,1\nx,C,2\n";
    const r = importRows(csv, columns, { idKey: "id" });
    expect(r.errors).toEqual([{ line: 3, column: "id", message: 'id "x" is used twice' }]);
  });

  it("refuses an empty file", () => {
    expect(importRows("\n \n", columns).errors).toEqual([{ line: 1, column: "", message: "The file is empty." }]);
  });
});

describe("canon", () => {
  it("treats empty values, and empty lists and objects, as missing", () => {
    expect(canon("")).toBe(canon(null));
    expect(canon(undefined)).toBe(canon("   "));
    expect(canon([])).toBe(canon(undefined));
    expect(canon({})).toBe(canon(null));
  });

  it("treats a numeric string as its number, so \"24\" is 24, and ignores key order", () => {
    expect(canon("24")).toBe(canon(24));
    expect(canon(" 24.0 ")).toBe(canon(24));
    expect(canon({ a: "", b: 1 })).toBe(canon({ b: "1" }));
    expect(canon({ x: 1, y: 2 })).toBe(canon({ y: 2, x: 1 }));
  });

  it("does not treat a word that looks numeric in another way as a number", () => {
    expect(canon("0x1F")).not.toBe(canon(31));
    expect(canon("Infinity")).not.toBe(canon(Infinity));
  });
});

describe("diffImport", () => {
  it("reports added, changed, removed and unchanged items by id", () => {
    const imported = [
      { id: "a", name: "Latte", price: 22 }, // unchanged
      { id: "b", name: "Mocha", price: 25, tags: "new" }, // price and tags changed
      { id: "c", name: "Flat white", price: 23 }, // added
    ];
    const current = [
      { id: "a", name: "Latte", price: 22 },
      { id: "b", name: "Mocha", price: 24 },
      { id: "d", name: "Espresso", price: 9 }, // removed
    ];
    const d = diffImport(current, imported, "id");
    expect(d.unchanged).toBe(1);
    expect(d.added).toEqual([{ id: "c", name: "Flat white", price: 23 }]);
    expect(d.removed).toEqual([{ id: "d", name: "Espresso", price: 9 }]);
    expect(d.changed).toEqual([{ id: "b", fields: ["price", "tags"] }]);
  });

  it("does not count an empty value against a missing one, or 24 against \"24\"", () => {
    // an import hands back what the cells said, so a price can arrive as text
    const current: Record<string, unknown>[] = [{ id: "a", name: "Latte", price: 24, note: undefined }];
    const imported: Record<string, unknown>[] = [{ id: "a", name: "Latte", price: "24", note: "" }];
    const d = diffImport(current, imported, "id");
    expect(d.changed).toEqual([]);
    expect(d.unchanged).toBe(1);
  });

  it("does not count a difference in key order as a change", () => {
    const d = diffImport([{ id: "a", tags: ["x"], meta: { p: 1, q: 2 } }], [{ id: "a", meta: { q: 2, p: 1 }, tags: ["x"] }], "id");
    expect(d.changed).toEqual([]);
  });

  it("uses the first item when an id is repeated in the current list", () => {
    const d = diffImport([{ id: "a", v: 1 }, { id: "a", v: 2 }], [{ id: "a", v: 1 }], "id");
    expect(d.changed).toEqual([]);
    expect(d.unchanged).toBe(1);
  });

  it("finds no changes when a list is exported and imported again", () => {
    const d = diffImport(items, importRows(toCsv(items, columns), columns).rows as unknown as Item[], "id");
    expect(d).toEqual({ added: [], changed: [], removed: [], unchanged: 2 });
  });
});

describe("column builders", () => {
  it("parses numbers and refuses text in a number column", () => {
    const col = numberColumn("price", "Price");
    expect(col.parse("22.5")).toBe(22.5);
    expect(col.parse("")).toBeUndefined();
    expect(() => col.parse("twenty")).toThrow("Price must be a number");
  });

  it("reads yes and no, true and false, and 1 and 0", () => {
    const col = boolColumn("available", "Available");
    expect([col.parse("yes"), col.parse("TRUE"), col.parse("1"), col.parse("no"), col.parse("0")]).toEqual([true, true, true, false, false]);
    expect(() => col.parse("maybe")).toThrow("Available must be yes or no");
    expect(col.serialize(true)).toBe("yes");
    expect(col.serialize(undefined)).toBe("");
  });

  it("splits a list on | and drops blank entries", () => {
    const col = listColumn("tags", "tags");
    expect(col.parse(" hot | milk || ")).toEqual(["hot", "milk"]);
    expect(col.parse("")).toBeUndefined();
    expect(col.serialize(["hot", "milk"])).toBe("hot|milk");
  });
});
