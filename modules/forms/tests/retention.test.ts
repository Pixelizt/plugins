import { afterEach, describe, expect, it, vi } from "vitest";
import retention from "../cron/daily.ts";

afterEach(() => vi.restoreAllMocks());

describe("retention cron", () => {
  it("deletes submissions older than retention_days", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    const now = new Date("2026-11-04T00:00:00Z");
    const out = await retention({ tier: "free", now, env: { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" } });
    expect(out).toBe("retention 100d: table ok, sheet off");
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain(`created_at=lt.${encodeURIComponent("2026-07-27T00:00:00.000Z")}`);
    expect(init!.method).toBe("DELETE");
  });
});
