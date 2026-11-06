import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURED } from "./categories.ts";
import { loadCatalog } from "./catalog.ts";

describe("catalog", () => {
  it("lists every catalog.yaml module and registry block from the repo", () => {
    const { root, entries } = loadCatalog();
    const modules = entries.filter((entry) => entry.kind === "module");
    const blocks = entries.filter((entry) => entry.kind === "block");
    expect(modules.map((entry) => entry.slug)).toEqual(
      expect.arrayContaining(["starter", "cms", "admin", "forms", "menu", "table-booking", "payments", "i18n"]),
    );
    expect(blocks.length).toBeGreaterThan(10);
    for (const entry of entries) {
      expect(entry.name.length).toBeGreaterThan(0);
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.category.length).toBeGreaterThan(0);
      if (entry.exists && entry.repoPath) expect(existsSync(join(root, entry.repoPath))).toBe(true);
    }
    expect(modules.find((entry) => entry.slug === "payments")?.exists).toBe(false);
    expect(modules.find((entry) => entry.slug === "i18n")?.exists).toBe(false);
    expect(modules.find((entry) => entry.slug === "menu")?.exists).toBe(true);
    for (const slug of FEATURED) expect(modules.some((entry) => entry.slug === slug && entry.status === "stable")).toBe(true);
    const slugs = entries.map((entry) => entry.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
