import { describe, expect, it } from "vitest";
import { formatMinor, formatPrice, minorDigits } from "../src/kit/lib/money.ts";
import { esc, oneLine, slugify } from "../src/kit/lib/text.ts";
import { isRole, roleAtLeast } from "../src/kit/lib/roles.ts";
import { jsonLdString } from "../src/kit/seo/jsonld.ts";

describe("money", () => {
  it("knows how many decimals a currency has", () => {
    expect(minorDigits("USD")).toBe(2);
    expect(minorDigits("JPY")).toBe(0);
    expect(minorDigits("KWD")).toBe(3);
  });
  it("formats major and minor amounts the same way", () => {
    expect(formatPrice(136.5, "USD")).toBe("$136.50");
    expect(formatMinor(13650, "USD")).toBe("$136.50");
    expect(formatMinor(1500, "JPY")).toBe("¥1,500");
  });
});

describe("text", () => {
  it("slugifies: accents out, runs of other characters become one dash, nothing left is empty", () => {
    expect(slugify("Crème Brûlée & Co.")).toBe("creme-brulee-co");
    expect(slugify("  --Hello  World-- ")).toBe("hello-world");
    expect(slugify("ﬁsh １２")).toBe("fish-12");
    expect(slugify("مرحبا")).toBe("");
  });
  it("collapses whitespace and cuts to length", () => {
    expect(oneLine("a \n  b\t c", 10)).toBe("a b c");
    expect(oneLine("abcdef", 3)).toBe("abc");
    expect(oneLine(null)).toBe("");
  });
  it("escapes HTML", () => {
    expect(esc(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    expect(esc(undefined)).toBe("");
  });
});

describe("roles", () => {
  it("orders demo < editor < admin and rejects anything else", () => {
    expect(roleAtLeast("admin", "editor")).toBe(true);
    expect(roleAtLeast("editor", "admin")).toBe(false);
    expect(roleAtLeast("demo", "demo")).toBe(true);
    expect(roleAtLeast("", "demo")).toBe(false);
    expect(roleAtLeast(undefined, "demo")).toBe(false);
    expect(roleAtLeast("constructor", "demo")).toBe(false);
    expect(isRole("toString")).toBe(false);
  });
});

describe("JSON-LD in a script tag", () => {
  it("can never close the tag early", () => {
    const s = jsonLdString({ a: "</script><b>&", c: " " });
    expect(s).not.toContain("<");
    expect(s).not.toContain(">");
    expect(JSON.parse(s)).toEqual({ a: "</script><b>&", c: " " });
  });
});
