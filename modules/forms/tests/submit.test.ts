import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { validateConfig } from "../../../kit/config/load.ts";
import { FormsConfig, FormsDoc } from "../lib/schema.ts";
import { handleSubmit } from "../server/submit.ts";
import { sheetIdOf, account } from "../server/sheets.ts";
import seed from "../seed/forms.json";

const cfg = validateConfig(parse(readFileSync("client.yaml", "utf8")));
const forms = FormsDoc.parse(seed);
const conf = FormsConfig.parse({ forms: ["contact"] });
const env = { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc", RESEND_API_KEY: "re_test", EMAIL_FROM: "Demo <a@b.com>", FORMS_EMAIL_TO: "team@demo.com" };
const req = (body: unknown) => new Request("https://demo/api/submit", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "1.2.3.4" } });
const good = { form: "contact", page: "/contact", fields: { name: "Ann <script>", email: "ann@example.com", message: "Hello" } };

afterEach(() => vi.restoreAllMocks());

function stub(opts: { recent?: number; insertOk?: boolean } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.includes("submissions?select=id&ip_hash")) return Response.json(Array.from({ length: opts.recent ?? 0 }, (_, i) => ({ id: i })));
    if (url.includes("submissions?select=id,created_at")) return opts.insertOk === false ? new Response("boom", { status: 500 }) : Response.json([{ id: 7, created_at: "2026-11-04T10:00:00Z" }]);
    if (url.includes("api.resend.com")) return Response.json({ id: "m" });
    if (url.includes("submissions?id=eq.7")) return new Response(null, { status: 204 });
    throw new Error("unexpected " + url);
  });
  return calls;
}

describe("POST /api/submit", () => {
  it("saves, emails team and customer, and records delivery", async () => {
    const calls = stub();
    const r = await handleSubmit(req(good), { cfg, forms, conf, env });
    expect(r).toEqual({ status: 200, body: { ok: true, id: 7 } });
    const mails = calls.filter((c) => c.url.includes("resend")).map((c) => JSON.parse(String(c.init!.body)));
    expect(mails.map((m) => m.to)).toEqual([["team@demo.com"], ["ann@example.com"]]);
    expect(mails[0].reply_to).toBe("ann@example.com");
    // the customer email never echoes what the visitor typed (rule 9)
    expect(mails[1].html).not.toContain("Ann");
    expect(mails[1].text).not.toContain("Ann");
    // the team email escapes it
    expect(mails[0].html).toContain("Ann &lt;script&gt;");
    const patch = calls.find((c) => c.url.includes("id=eq.7"))!;
    expect(JSON.parse(String(patch.init!.body))).toEqual({ delivery: { sheet: "off", team_email: "ok", customer_email: "ok" } });
  });
  it("quietly accepts and drops honeypot submissions", async () => {
    const calls = stub();
    expect((await handleSubmit(req({ ...good, _gotcha: "x" }), { cfg, forms, conf, env })).status).toBe(200);
    expect(calls).toEqual([]);
  });
  it("rejects unknown or disabled forms and invalid fields", async () => {
    stub();
    expect((await handleSubmit(req({ ...good, form: "feedback" }), { cfg, forms, conf, env })).body.error).toBe("Unknown form");
    const bad = await handleSubmit(req({ ...good, fields: { name: "Ann", email: "ann@gmail.con" } }), { cfg, forms, conf, env });
    expect(bad.status).toBe(400);
    expect(bad.body.fields).toEqual({ email: "invalid", message: "required" });
  });
  it("rate limits per address", async () => {
    stub({ recent: 5 });
    expect((await handleSubmit(req(good), { cfg, forms, conf, env })).status).toBe(429);
  });
  it("fails the visitor only when the save fails", async () => {
    stub({ insertOk: false });
    expect((await handleSubmit(req(good), { cfg, forms, conf, env })).status).toBe(502);
  });
  it("reports 'not set up' without Supabase", async () => {
    expect((await handleSubmit(req(good), { cfg, forms, conf, env: {} })).status).toBe(503);
  });
});

describe("sheets helpers", () => {
  it("accepts a sheet id or its URL", () => {
    expect(sheetIdOf("https://docs.google.com/spreadsheets/d/abc_DEF-123/edit#gid=0")).toBe("abc_DEF-123");
    expect(sheetIdOf("bad id!")).toBe("");
  });
  it("tolerates invisible pasted spaces in the key JSON", () => {
    expect(account('{ "client_email": "a@b", "private_key": "k\\\\nx"}')).toEqual({ email: "a@b", key: "k\nx" });
    expect(account("not json")).toBeNull();
  });
});
