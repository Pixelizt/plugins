import { describe, expect, it } from "vitest";
import { expandDays } from "../src/kit/seo/jsonld.ts";
import { pageTitle, slugParam } from "../src/kit/pages.ts";
import { stripSamples } from "../src/kit/content/index.ts";

describe("helpers", () => {
  it("expands day ranges, including wrap-around", () => {
    expect(expandDays("mon-wed")).toEqual(["Monday", "Tuesday", "Wednesday"]);
    expect(expandDays("sat")).toEqual(["Saturday"]);
    expect(expandDays("sat-mon")).toEqual(["Saturday", "Sunday", "Monday"]);
  });
  it("derives page titles and slugs", () => {
    expect(pageTitle({ path: "/" })).toBe("Home");
    expect(pageTitle({ path: "/private-events" })).toBe("Private events");
    expect(pageTitle({ path: "/x", title: "Custom" })).toBe("Custom");
    expect(slugParam("/")).toBeUndefined();
    expect(slugParam("/events/past")).toBe("events/past");
  });
  it("drops sample items only in production", () => {
    const doc = { items: [{ a: 1, sample: true }, { a: 2 }], nested: { list: [{ sample: true }] } };
    expect(stripSamples(doc, true)).toEqual({ items: [{ a: 2 }], nested: { list: [] } });
    expect(stripSamples(doc, false)).toEqual(doc);
  });
});
