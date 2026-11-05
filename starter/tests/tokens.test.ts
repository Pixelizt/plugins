import { describe, expect, it } from "vitest";
import { buildTokens, contrast, onColor } from "../src/kit/config/tokens.ts";

const brand = {
  vibe: "x", references: [], logo: "", dark_mode: false, copy_rules: [], radius: "md" as const, shadow: "soft" as const,
  fonts: { heading: "A", body: "B", accent: "" },
  colors: { primary: "#7A4B2A", secondary: "#E9C46A", accent: "#2A9D8F", background: "#FBF7F1", foreground: "#1C1917", muted: "#F1E8DC" },
};

describe("tokens", () => {
  it("computes WCAG contrast", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 0);
    expect(contrast("#777777", "#777777")).toBe(1);
  });
  it("picks the more readable text color for each brand color", () => {
    expect(onColor("#7A4B2A", "#1C1917", "#FBF7F1")).toBe("#FBF7F1");
    expect(onColor("#E9C46A", "#1C1917", "#FBF7F1")).toBe("#1C1917");
  });
  it("emits every token and no warnings for a readable palette", () => {
    const { css, warnings } = buildTokens(brand);
    for (const t of ["--primary:", "--primary-foreground:", "--background:", "--radius: 0.5rem", "--kit-shadow-md:"]) expect(css).toContain(t);
    expect(buildTokens({ ...brand, shadow: "none" }).css).toContain("--kit-shadow-lg: none;");
    expect(warnings).toEqual([]);
  });
  it("warns when text would be unreadable", () => {
    const { warnings } = buildTokens({ ...brand, colors: { ...brand.colors, foreground: "#EEEEEE" } });
    expect(warnings.join()).toMatch(/foreground on background/);
  });
});
