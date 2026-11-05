import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { changesSince } from "../server/changes.ts";
import { publishedEmail } from "../server/email.ts";
import { validateConfig } from "../../../kit/config/load.ts";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

const env = { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "fake", PUBLIC_SUPABASE_ANON_KEY: "anon" };
const docs = { hero: { label: "Hero", schema: z.object({ headline: z.string().meta({ label: "Headline" }) }) } };

afterEach(() => vi.restoreAllMocks());

describe("changes since last publish", () => {
  it("compares the version live at the last publish with the current one", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const u = String(input);
      if (u.includes("/docs?")) return Response.json([{ key: "hero", value: { headline: "New" }, updated_by: "ed@x.com" }, { key: "_publish", value: {}, updated_by: null }]);
      if (u.includes("saved_at=lte")) return Response.json([{ value: { headline: "Old" } }]);
      if (u.includes("saved_at=gt")) return Response.json([{ saved_by: "ann@x.com" }]);
      throw new Error("unexpected " + u);
    });
    const out = await changesSince("2026-11-01T00:00:00Z", docs, env);
    expect(out).toEqual([{ key: "hero", label: "Hero", lines: ['Headline: "Old" → "New"'], by: ["ann@x.com", "ed@x.com"] }]);
  });
  it("builds an escaped email with a plain-text twin", () => {
    const cfg = validateConfig(parse(readFileSync("client.yaml", "utf8")));
    const m = publishedEmail(cfg, "boss@x.com", [{ key: "hero", label: "Hero <b>", lines: ['Headline: "a" → "<script>"'], by: [] }]);
    expect(m.subject).toContain("Hero <b>");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
    expect(m.text).toContain('Headline: "a" → "<script>"');
  });
});
