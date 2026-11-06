import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";
import { PALETTES, buildBrief, contrastWarnings, sampleInput, slugify } from "./brief.ts";
import { moduleErrors } from "./module-check.ts";

const repoRoot = join(import.meta.dirname, "../../..");

describe("buildBrief", () => {
  it("writes a brief the core schema and every module schema accept", () => {
    const built = buildBrief(sampleInput());
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const raw = parse(built.result.yaml) as { modules: Record<string, unknown>; pages: { path: string }[]; notes: string };
    expect(raw.pages.some((page) => page.path === "/")).toBe(true);
    expect(moduleErrors(raw.modules)).toEqual([]);
    const keys: string[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") {
        for (const [key, inner] of Object.entries(value)) {
          keys.push(key);
          walk(inner);
        }
      }
    };
    walk(raw);
    expect(keys.join(" ")).not.toMatch(/password|api_key|secret|token|service_role/);
    expect(raw.notes).not.toMatch(/TODO/);
    expect(raw.modules.menu).toMatchObject({
      tags: [
        { key: "vegetarian", label: "Vegetarian", filterable: true },
        { key: "vegan", label: "Vegan", filterable: true },
      ],
    });
    expect(raw.modules["booking-core"]).toEqual({});
    expect(raw.modules["table-booking"]).toEqual({});
    expect(raw.modules["content-lists"]).toEqual({ enabled: ["events", "faqs", "reviews"] });
    expect(Object.keys(raw.modules)).not.toContain("payments");
    expect(Object.keys(raw.modules)).not.toContain("i18n");
  });

  it("passes the kit's own validate-config script", () => {
    const built = buildBrief(
      sampleInput({
        instagram: "https://instagram.com/harbourandrye",
        specialties: "wood-fired bread, lunch",
        staffEmail: "owner@harbour-and-rye.example",
        mealPlans: true,
        spaceBooking: true,
        whatsapp: "+44 7700 900000",
        whatsappAlerts: true,
        lists: ["events", "offers", "faqs", "reviews", "gallery", "posts"],
        menuTags: ["vegetarian", "gluten-free"],
      }),
    );
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const raw = parse(built.result.yaml) as {
      modules: Record<string, unknown>;
      email: { from_domain: string };
      admin: { users: unknown[] };
    };
    expect(moduleErrors(raw.modules)).toEqual([]);
    expect((raw.modules.forms as { forms: string[] }).forms).toEqual(["contact"]);
    expect(raw.modules.menu).toBeTruthy();
    expect(raw.modules["meal-plans"]).toEqual({});
    expect(raw.modules.whatsapp).toEqual({ booking_alerts: true });
    expect(raw.email.from_domain).toBe("notify.harbour-and-rye.example");
    expect(raw.admin.users).toHaveLength(1);

    const dir = mkdtempSync(join(tmpdir(), "gallery-brief-"));
    const file = join(dir, "client.yaml");
    writeFileSync(file, built.result.yaml);
    const out = execFileSync("node", ["--experimental-strip-types", join(repoRoot, "starter/scripts/validate-config.ts"), file], {
      cwd: join(repoRoot, "starter"),
      encoding: "utf8",
    });
    expect(out).toContain("is valid");
    expect(out).toContain("Harbour & Rye");
  });

  it("uses a .example domain and leaves the sending domain empty when none was given", () => {
    const built = buildBrief(sampleInput({ domainPending: true, domain: "" }));
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.result.config.client.domain).toBe("harbour-and-rye.example");
    expect(built.result.config.email.from_domain).toBe("");
    expect(built.result.yaml).toContain("placeholder");
  });

  it("rejects an incomplete brief instead of writing a file", () => {
    const built = buildBrief(sampleInput({ email: "not-an-email", name: "" }));
    expect(built.ok).toBe(false);
  });

  it("slugifies a business name without leaving a TODO", () => {
    expect(slugify("Harbour & Rye")).toBe("harbour-and-rye");
    expect(slugify("Café North")).toBe("cafe-north");
  });

  it("starting palettes meet the kit contrast check", () => {
    for (const palette of PALETTES) {
      const warnings = contrastWarnings(sampleInput({ colors: { ...palette.colors } }));
      expect(warnings, palette.id).toEqual([]);
    }
  });
});
