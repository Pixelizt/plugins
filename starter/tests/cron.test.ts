import { describe, expect, it, vi } from "vitest";
import { keepAlive, runDaily } from "../src/kit/cron/daily.ts";

describe("daily cron", () => {
  it("keep-alive is off without Supabase env and never calls the network", async () => {
    const f = vi.spyOn(globalThis, "fetch");
    expect(await keepAlive({})).toMatch(/off/);
    expect(f).not.toHaveBeenCalled();
  });
  it("pings Supabase on the free tier only", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}", { status: 200 }));
    const env = { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "fake" };
    // installed modules may add their own daily jobs after the keep-alive
    expect((await runDaily({ tier: "free", now: new Date(), env }))[0]).toBe("keep-alive: ok");
    f.mockClear();
    const paid = await runDaily({ tier: "paid", now: new Date(), env });
    expect(paid.some((r) => r.startsWith("keep-alive"))).toBe(false);
    expect(f.mock.calls.some(([u]) => String(u).endsWith("/rest/v1/"))).toBe(false);
  });
});
