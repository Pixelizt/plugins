import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { validateConfig, findTodos, ConfigError } from "../src/kit/config/load.ts";

const base = () => parse(readFileSync("client.yaml", "utf8"));

describe("client.yaml validation", () => {
  it("accepts this site's client.yaml", () => {
    expect(validateConfig(base(), { allowTodo: true }).client.name).toBe(base().client.name);
  });
  it("rejects unknown keys (typos) with a readable message", () => {
    const c = base();
    c.brand.colours = c.brand.colors; // British spelling typo
    expect(() => validateConfig(c)).toThrow(/colours/);
  });
  it("rejects bad hex colors, time zones and hours", () => {
    const c = base();
    c.brand.colors.primary = "brown";
    c.client.timezone = "Mars/Olympus";
    c.client.hours = { weekdays: "8am-6pm" };
    expect(() => validateConfig(c)).toThrow(ConfigError);
  });
  it("lists TODO values and refuses them unless allowed", () => {
    const c = base();
    c.client.contact.address = "TODO";
    expect(findTodos(c)).toEqual(["client.contact.address"]);
    expect(() => validateConfig(c)).toThrow(/TODO/);
    expect(() => validateConfig(c, { allowTodo: true })).not.toThrow();
  });
  it("defaults a missing hosting tier to paid", () => {
    const c = base();
    delete c.hosting.tier;
    expect(validateConfig(c, { allowTodo: true }).hosting.tier).toBe("paid");
  });
  it("requires a home page and unique paths", () => {
    const c = base();
    c.pages = [{ path: "/a", sections: ["hero"] }, { path: "/a", sections: ["hero"] }];
    expect(() => validateConfig(c)).toThrow(/duplicate/);
  });
});
