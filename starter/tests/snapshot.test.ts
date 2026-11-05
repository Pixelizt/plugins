import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSnapshot } from "../src/kit/content/snapshot.ts";

const quiet = { info: () => {}, warn: () => {} };
const env = { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc" };
afterEach(() => vi.restoreAllMocks());

describe("content snapshot", () => {
  it("is empty (seed files) when Supabase isn't configured", async () => {
    expect(await fetchSnapshot({}, quiet)).toEqual({});
  });
  it("reads saved documents with the service key and drops bookkeeping rows", async () => {
    const f = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json([{ key: "hero", value: { a: 1 } }, { key: "_publish", value: {} }]));
    expect(await fetchSnapshot(env, quiet)).toEqual({ hero: { a: 1 } });
    expect((f.mock.calls[0]![1]!.headers as Record<string, string>).Authorization).toBe("Bearer svc");
  });
  it("fails the build when configured but unreadable, unless CMS_REQUIRED=false", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("down", { status: 503 }));
    await expect(fetchSnapshot(env, quiet)).rejects.toThrow(/Refusing to build/);
    expect(await fetchSnapshot({ ...env, CMS_REQUIRED: "false" }, quiet)).toEqual({});
  });
  it("refuses to build without the service key (drafts are private)", async () => {
    await expect(fetchSnapshot({ PUBLIC_SUPABASE_URL: "https://x.supabase.co" }, quiet)).rejects.toThrow(/SUPABASE_SERVICE_KEY/);
  });
});
