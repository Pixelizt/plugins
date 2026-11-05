import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { scan, scanText } from "../scripts/secret-scan.mjs";

const fakeJwt = (role: string) =>
  ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ role, iss: "supabase-demo" })).toString("base64url"), "c2lnbmF0dXJlc2lnbmF0dXJl"].join(".");

describe("secret scan", () => {
  it("flags service_role JWTs but allows the public anon key", () => {
    expect(scanText(fakeJwt("service_role"))).toContain("a Supabase service_role key");
    expect(scanText(fakeJwt("anon"))).toEqual([]);
  });
  it("flags private keys", () => {
    // built at runtime so this file itself never trips the scan
    expect(scanText(["-----BEGIN", "PRIVATE KEY-----"].join(" "))).toContain("a private key");
  });
  it("finds nothing in this repo", () => {
    let inGit = true;
    try { execFileSync("git", ["rev-parse"], { stdio: "ignore" }); } catch { inGit = false; }
    if (inGit) expect(scan(".")).toEqual([]);
  });
});
