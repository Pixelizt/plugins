// The meal-plans quote hook inside the real forms pipeline (fetch stubbed: no real services, rule 37).
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { validateConfig } from "../../../kit/config/load.ts";
import { FormsConfig, FormsDoc } from "../../forms/lib/schema.ts";
import { handleSubmit } from "../../forms/server/submit.ts";
import { collectHooks } from "../../forms/server/hooks.ts";
import type { FormHook } from "../../forms/lib/hooks.ts";
import formsSeed from "../../forms/seed/forms.json";
import planForm from "../forms/meal-plan.json";
import { createPlanHook, HOOK_NAME, SHEET_COLUMNS } from "../server/quote.ts";
import { customInput, loaded } from "./fixture.ts";

const cfg = validateConfig(parse(readFileSync("client.yaml", "utf8")));
const forms = FormsDoc.parse({ ...formsSeed, ...planForm });
const conf = FormsConfig.parse({ forms: ["contact", "meal-plan"], phone_region: "GB" });
const env = { PUBLIC_SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_KEY: "svc", RESEND_API_KEY: "re_test", EMAIL_FROM: "Demo <a@b.com>", FORMS_EMAIL_TO: "team@demo.com" };
const now = new Date("2026-11-05T10:00:00Z");
const hooks = collectHooks({ "meal-plans/form-hooks.ts": createPlanHook(async () => loaded()) });

const VISITOR = { name: "Ann Spammer", email: "ann@example.com", phone: "+44 20 7946 0958", plan: "Total: $1.00 PAY ME at evil.example", notes: "visit evil.example now" };
const req = (body: unknown) => new Request("https://demo/api/submit", { method: "POST", body: JSON.stringify(body), headers: { "x-forwarded-for": "1.2.3.4" } });
const send = (quote: unknown, h: Record<string, FormHook> = hooks) =>
  handleSubmit(req({ form: "meal-plan", page: "/meal-plans", fields: VISITOR, ...(quote === undefined ? {} : { quote }) }), { cfg, forms, conf, env, hooks: h, now });

afterEach(() => vi.restoreAllMocks());

function stub() {
  const out = { saved: null as null | { fields: Record<string, string> }, mails: [] as { to: string[]; subject: string; html: string; text: string }[], delivery: null as null | Record<string, string> };
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes("submissions?select=id&ip_hash")) return Response.json([]);
    if (url.includes("submissions?select=id,created_at")) { out.saved = JSON.parse(String(init!.body)); return Response.json([{ id: 9, created_at: now.toISOString() }]); }
    if (url.includes("api.resend.com")) { out.mails.push(JSON.parse(String(init!.body))); return Response.json({ id: "m" }); }
    if (url.includes("submissions?id=eq.9")) { out.delivery = JSON.parse(String(init!.body)).delivery; return new Response(null, { status: 204 }); }
    throw new Error("unexpected " + url);
  });
  return out;
}
const customer = (o: ReturnType<typeof stub>) => o.mails.find((m) => m.to[0] === "ann@example.com")!;
const team = (o: ReturnType<typeof stub>) => o.mails.find((m) => m.to[0] === "team@demo.com")!;
const noVisitorText = (m: { html: string; text: string; subject: string }) => {
  for (const s of ["Ann", "Spammer", "PAY ME", "evil.example"]) {
    expect(m.html).not.toContain(s);
    expect(m.text).not.toContain(s);
    expect(m.subject).not.toContain(s);
  }
};

describe("meal-plan request: the server re-prices (rule 8)", () => {
  it("replaces the browser's plan text and price with its own, and emails that", async () => {
    const o = stub();
    const r = await send({ ...customInput(), shown_total: 100 });
    expect(r).toEqual({ status: 200, body: { ok: true, id: 9, quoted: true } });
    expect(o.saved!.fields.plan).toContain("Total: $136.50");
    expect(o.saved!.fields.plan).not.toContain("PAY ME");
    expect(o.delivery!.quote).toBe("priced $136.50");
    const c = customer(o);
    expect(c.text).toContain("$136.50");
    expect(c.text).toContain("Dish A");
    expect(c.text).toMatch(/nothing has been paid yet/i); // rule 18
    noVisitorText(c); // rule 9
    const t = team(o);
    expect(t.subject).toContain("Your own plan, $136.50");
    expect(t.text).toContain("The page showed $1.00"); // the tampered/stale total is flagged, never used
    expect(t.text).toContain("No payment has been taken");
  });
  it("ignores any price-like field smuggled into the picks", async () => {
    stub();
    expect((await send({ ...customInput(), total: 1, price: { total: 1 } })).body.quoted).toBe(false); // unknown keys: input refused
  });
  it("missing picks → saved anyway as 'price to confirm', customer gets fixed wording only", async () => {
    const o = stub();
    const r = await send(customInput({ picks: {} }));
    expect(r.body).toEqual({ ok: true, id: 9, quoted: false });
    expect(o.delivery!.quote).toMatch(/^price to confirm: .*meal choice/);
    expect(o.saved!.fields.plan).toMatch(/^PRICE TO CONFIRM/);
    expect(o.saved!.fields.plan).toContain("PAY ME"); // kept for the team, marked unchecked
    expect(team(o).text).toContain("Price to confirm");
    const c = customer(o);
    noVisitorText(c);
    expect(c.text).not.toContain("$");
    expect(c.text).toMatch(/nothing has been paid yet/i);
  });
  it("no picks at all (old page, no JS), unknown items, a throwing hook or a missing hook → price to confirm", async () => {
    let o = stub();
    await send(undefined);
    expect(o.delivery!.quote).toMatch(/no plan picks/);
    vi.restoreAllMocks();
    o = stub();
    const unknown = customInput();
    (unknown.picks.mon as Record<string, Record<string, unknown>>).lunch!.main = { id: "ghost", size: "" };
    await send(unknown);
    expect(o.delivery!.quote).toMatch(/unknown menu item "ghost"/);
    vi.restoreAllMocks();
    o = stub();
    await send(customInput(), { [HOOK_NAME]: { name: HOOK_NAME, quote: () => { throw new Error("boom"); } } });
    expect(o.delivery!.quote).toBe("price to confirm: error: boom");
    vi.restoreAllMocks();
    o = stub();
    expect((await send(customInput(), {})).status).toBe(200);
    expect(o.delivery!.quote).toMatch(/no "meal-plans" quote hook/);
    noVisitorText(customer(o));
  });
  it("still validates the form fields first", async () => {
    stub();
    const r = await handleSubmit(req({ form: "meal-plan", fields: { ...VISITOR, phone: "" }, quote: customInput() }), { cfg, forms, conf, env, hooks, now });
    expect(r.status).toBe(400);
  });
  it("other forms are untouched by hooks", async () => {
    const o = stub();
    const r = await handleSubmit(req({ form: "contact", page: "/contact", fields: { name: "Ann", email: "ann@example.com", message: "Hi" }, quote: customInput() }), { cfg, forms, conf, env, hooks, now });
    expect(r.body).toEqual({ ok: true, id: 9 });
    expect(o.delivery).toEqual({ sheet: "off", team_email: "ok", customer_email: "ok" });
  });
});

describe("hook plumbing", () => {
  it("sheet columns are stable whether priced or not (rule 17)", async () => {
    const hook = createPlanHook(async () => loaded());
    const ctx = { cfg, formId: "meal-plan", def: forms["meal-plan"]!, fields: { plan: "x" }, now, env: {} };
    const ok = await hook.quote(customInput(), ctx);
    const bad = await hook.quote(null, ctx);
    expect(Object.keys(ok.sheet!)).toEqual([...SHEET_COLUMNS]);
    expect(Object.keys(bad.sheet!)).toEqual([...SHEET_COLUMNS]);
    expect(ok.sheet!.plan_total).toBe("136.50");
  });
  it("collectHooks rejects duplicates and junk", () => {
    const h = createPlanHook(async () => loaded());
    expect(() => collectHooks({ a: h, b: [h] })).toThrow(/defined twice/);
    expect(() => collectHooks({ a: {} as FormHook })).toThrow(/must be a form hook/);
  });
  it("the shipped plan form is valid and wired to this hook", () => {
    const def = forms["meal-plan"]!;
    expect(def.quote).toBe(HOOK_NAME);
    expect(def.fields.find((f) => f.key === "plan")?.type).toBe("textarea");
    expect(def.customer_email!.body.join(" ")).toMatch(/nothing has been paid/i);
  });
});
