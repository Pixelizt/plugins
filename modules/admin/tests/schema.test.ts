import { describe, expect, it } from "vitest";
import { z } from "zod";
import { blank, csvKeys, itemTitle, kindOf, labelOf, unwrap, type JS } from "../app/schema.ts";
import { decodeRole } from "../app/session.ts";

const Doc = z.object({
  title: z.string().meta({ label: "Page title" }),
  intro: z.string().optional().meta({ widget: "textarea" }),
  hero: z.object({ src: z.string(), alt: z.string() }).optional(),
  mode: z.enum(["a", "b"]).default("a"),
  show: z.boolean().default(true),
  nutrition: z.record(z.string(), z.number()).optional(),
  tags: z.array(z.string()).default([]),
  items: z.array(z.object({ id: z.string(), name: z.string(), price: z.number(), tags: z.array(z.string()).default([]), extra: z.object({ a: z.string() }).optional() })),
});
const js = z.toJSONSchema(Doc, { unrepresentable: "any", io: "input" }) as JS;
const p = (k: string) => js.properties![k]!;

describe("admin schema → fields", () => {
  it("picks a widget per field", () => {
    expect(kindOf(p("title"))).toBe("text");
    expect(kindOf(p("intro"))).toBe("textarea");
    expect(kindOf(p("hero"))).toBe("image");
    expect(kindOf(p("mode"))).toBe("select");
    expect(kindOf(p("show"))).toBe("boolean");
    expect(kindOf(p("nutrition"))).toBe("record");
    expect(kindOf(p("tags"))).toBe("tags");
    expect(kindOf(p("items"))).toBe("list");
    expect(kindOf(js)).toBe("object");
  });
  it("uses schema labels, else humanizes the key", () => {
    expect(labelOf(p("title"), "title")).toBe("Page title");
    expect(labelOf(p("nutrition"), "nutrition")).toBe("Nutrition");
  });
  it("makes blank items with required fields and defaults", () => {
    expect(blank(unwrap(p("items")).items!)).toEqual({ id: "", name: "", price: 0 });
    expect(blank(p("mode"))).toBe("a");
  });
  it("names list items and finds CSV columns", () => {
    const item = unwrap(p("items")).items!;
    expect(itemTitle({ id: "x", name: "Latte" }, item, 0)).toBe("Latte");
    expect(itemTitle({}, item, 2)).toBe("Item 3");
    expect(csvKeys(item)).toEqual(["id", "name", "price", "tags"]);
  });
  it("round-trips the schema for browser validation", () => {
    const v = z.fromJSONSchema(js as Parameters<typeof z.fromJSONSchema>[0]);
    expect(v.safeParse({ title: "t", items: [{ id: "1", name: "n", price: 2 }] }).success).toBe(true);
    expect(v.safeParse({ title: "t", items: [{ id: "1", name: "n", price: "free" }] }).success).toBe(false);
  });
  it("reads the role from a token for the UI only", () => {
    const tok = (role: string) => ["x", btoa(JSON.stringify({ app_metadata: { role } })).replace(/=+$/, ""), "y"].join(".");
    expect(decodeRole(tok("editor"))).toBe("editor");
    expect(decodeRole(tok("root"))).toBe("");
    expect(decodeRole("garbage")).toBe("");
  });
});
