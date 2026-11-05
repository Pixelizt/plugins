import { afterEach, describe, expect, it, vi } from "vitest";
import { handleBlock, handleManual, handleMeta, handleStatus } from "../server/staff.ts";
import { cancelView } from "../server/cancel.ts";
import { runBookingDaily } from "../server/daily.ts";
import { BookingCoreConfig } from "../lib/schema.ts";
import { cancelToken, tokenHash } from "../server/token.ts";
import { NOW, SECRET, cfg, ctx, env, mails, patchOk, resend, stubFetch, type Call } from "./fixture.ts";

afterEach(() => vi.restoreAllMocks());

const ID = "4f1c2a9e-0b7d-4c55-9a51-3e2f1d0c9b8a";
const row = (o: Record<string, unknown> = {}) => ({
  id: ID, created_at: "2026-11-01T10:00:00Z", kind: "table", resource_id: "table:covers", starts_at: "2026-11-06T19:00:00Z", ends_at: "2026-11-06T20:30:00Z",
  party_size: 4, units: 4, status: "pending", hold_until: "2026-11-05T12:00:00Z", source: "web", name: "Ann <b>", email: "ann@example.com", phone: "+442079460958",
  notes: "hi", fields: {}, facts: [["Guests", "4"]], delivery: { customer_email: "ok" }, decided_by: null, decided_at: null, reminded_at: null, ...o,
});
const user = (role: string): [RegExp, () => Response] => [/auth\/v1\/user/, () => Response.json({ id: "u1", email: "staff@demo.com", app_metadata: { role } })];
const staffReq = (path: string, body: unknown, token = true) =>
  new Request(`https://demo.example.com${path}`, { method: "POST", body: JSON.stringify(body), headers: token ? { authorization: "Bearer tok" } : {} });

describe("POST /api/bookings/status", () => {
  it("needs a signed-in editor (rule 11)", async () => {
    stubFetch([user("demo")]);
    expect((await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "confirmed" }, false), ctx())).status).toBe(401);
    expect((await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "confirmed" }), ctx())).status).toBe(403);
  });
  it("accepts a request through set_booking_status and emails the confirmation with a cancel link", async () => {
    const calls = stubFetch([user("editor"), resend, patchOk,
      [/rpc\/set_booking_status/, () => Response.json({ ok: true, changed: true, from: "pending", booking: row({ status: "confirmed" }) })]]);
    const r = await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "confirmed" }), ctx());
    expect(r).toMatchObject({ status: 200, body: { ok: true, changed: true, status: "confirmed", email: "ok" } });
    expect(calls.find((c) => c.url.includes("rpc/"))!.body).toEqual({ p_id: ID, p_status: "confirmed", p_actor: "staff@demo.com" });
    const [m] = mails(calls);
    expect(m.subject).toBe("Your booking is confirmed");
    expect(m.text).toContain(`t=${encodeURIComponent(cancelToken(SECRET, ID))}`);
    expect(m.html).not.toContain("Ann");
    // delivery is merged, not replaced
    expect(calls.find((c) => c.method === "PATCH")!.body.delivery).toEqual({ customer_email: "ok", confirmed_email: "ok" });
  });
  it("reports 'full' when the time was taken meanwhile, and emails nobody", async () => {
    const calls = stubFetch([user("editor"), [/rpc\/set_booking_status/, () => Response.json({ ok: false, reason: "full", from: "expired" })]]);
    const r = await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "confirmed" }), ctx());
    expect(r).toMatchObject({ status: 409, body: { code: "full" } });
    expect(mails(calls)).toEqual([]);
  });
  it("is idempotent: the same status again sends nothing", async () => {
    const calls = stubFetch([user("admin"), [/rpc\/set_booking_status/, () => Response.json({ ok: true, changed: false, from: "declined", booking: row({ status: "declined" }) })]]);
    const r = await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "declined" }), ctx());
    expect(r.body).toMatchObject({ ok: true, changed: false });
    expect(mails(calls)).toEqual([]);
  });
  it("rejects bad ids and statuses", async () => {
    stubFetch([user("editor")]);
    expect((await handleStatus(staffReq("/api/bookings/status", { id: "1", status: "confirmed" }), ctx())).status).toBe(400);
    expect((await handleStatus(staffReq("/api/bookings/status", { id: ID, status: "pending" }), ctx())).status).toBe(400);
  });
});

describe("staff tools", () => {
  it("manual booking: confirmed, inside the lead time, no team email, optional customer email", async () => {
    const calls = stubFetch([user("editor"), resend, patchOk, [/rpc\/create_booking/, (c: Call) => Response.json({ ok: true, id: c.body.p_id, resource_id: "table:covers" })]]);
    const r = await handleManual(staffReq("/api/bookings/manual", { type: "table", date: "2026-11-05", time: "12:00", party: 12, details: { name: "Bo", phone: "", email: "bo@example.com" } }), ctx());
    expect(r.body).toMatchObject({ ok: true, status: "confirmed" });
    const rpc = calls.find((c) => c.url.includes("rpc/create_booking"))!.body;
    expect(rpc).toMatchObject({ p_source: "staff", p_status: "confirmed", p_decided_by: "staff@demo.com", p_ip_hash: null, p_party_size: 12 });
    expect(mails(calls).map((m) => m.to)).toEqual([["bo@example.com"]]);
  });
  it("block: a whole day in the business time zone, and counts bookings already inside it", async () => {
    const calls = stubFetch([user("editor"),
      [/booking_blocks\?select=id/, () => Response.json([{ id: 9 }])],
      [/bookings\?select=id&status/, () => Response.json([{ id: "a" }, { id: "b" }])]]);
    const r = await handleBlock(staffReq("/api/bookings/block", { action: "add", date: "2026-07-01", scope: "table", reason: "Private party" }), ctx());
    expect(r.body).toEqual({ ok: true, id: 9, affected: 2 });
    const ins = calls.find((c) => c.url.includes("booking_blocks"))!.body;
    expect(ins).toMatchObject({ kind: "table", resource_id: null, starts_at: "2026-06-30T23:00:00.000Z", ends_at: "2026-07-01T23:00:00.000Z", created_by: "staff@demo.com" });
  });
  it("block: checks times and scopes", async () => {
    stubFetch([user("editor")]);
    expect((await handleBlock(staffReq("/api/bookings/block", { action: "add", date: "2026-07-01", from: "20:00", to: "18:00" }), ctx())).status).toBe(400);
    expect((await handleBlock(staffReq("/api/bookings/block", { action: "add", date: "2026-07-01", scope: "space:nope" }), ctx())).status).toBe(400);
  });
  it("meta lists the types for the admin", async () => {
    stubFetch([user("editor")]);
    const r = await handleMeta(staffReq("/api/bookings/meta", {}), ctx());
    expect(r.body).toMatchObject({ ok: true, timezone: "Europe/London", types: [{ kind: "table" }] });
  });
});

describe("customer cancel link", () => {
  const t = cancelToken(SECRET, ID);
  const get = (o: Record<string, unknown> = {}): [RegExp, () => Response] => [/bookings\?select=.*cancel_token_hash/, () => Response.json([{ ...row({ status: "confirmed" }), cancel_token_hash: tokenHash(t), ...o }])];

  it("GET shows the booking and changes nothing", async () => {
    const calls = stubFetch([get()]);
    const v = await cancelView("GET", { id: ID, t }, ctx());
    expect(v.state).toBe("confirm");
    expect(v.summary).toMatchObject({ reference: "4F1C2A9E", when: "Friday 6 November 2026, 19:00 to 20:30", facts: [["Guests", "4"]] });
    expect(calls.some((c) => c.url.includes("rpc/"))).toBe(false);
  });
  it("POST cancels once, emails the customer and the team; a second POST says 'already' and sends nothing", async () => {
    let calls = stubFetch([get(), resend, patchOk, [/rpc\/set_booking_status/, () => Response.json({ ok: true, changed: true, from: "confirmed", booking: row({ status: "cancelled" }) })]]);
    expect((await cancelView("POST", { id: ID, t }, ctx())).state).toBe("done");
    expect(calls.find((c) => c.url.includes("rpc/"))!.body).toEqual({ p_id: ID, p_status: "cancelled", p_actor: "customer" });
    const m = mails(calls);
    expect(m.map((x) => x.to)).toEqual([["ann@example.com"], ["team@demo.com"]]);
    expect(m[0].subject).toBe("Your booking is cancelled");
    vi.restoreAllMocks();
    // the row now says cancelled
    calls = stubFetch([get({ status: "cancelled" })]);
    expect((await cancelView("POST", { id: ID, t }, ctx())).state).toBe("already");
    expect(mails(calls)).toEqual([]);
    vi.restoreAllMocks();
    // a race: the row still read "confirmed" but the database had already cancelled it
    calls = stubFetch([get(), [/rpc\/set_booking_status/, () => Response.json({ ok: true, changed: false, from: "cancelled", booking: row({ status: "cancelled" }) })]]);
    expect((await cancelView("POST", { id: ID, t }, ctx())).state).toBe("already");
    expect(mails(calls)).toEqual([]);
  });
  it("wrong token, unknown booking and malformed ids all look the same", async () => {
    stubFetch([get()]);
    expect((await cancelView("POST", { id: ID, t: cancelToken("y".repeat(40), ID) }, ctx())).state).toBe("invalid");
    expect((await cancelView("GET", { id: "nope", t }, ctx())).state).toBe("invalid");
    vi.restoreAllMocks();
    stubFetch([[/bookings\?select=/, () => Response.json([])]]);
    expect((await cancelView("GET", { id: ID, t }, ctx())).state).toBe("invalid");
  });
  it("too late to cancel online, declined bookings, and no secret configured", async () => {
    stubFetch([get()]);
    expect((await cancelView("POST", { id: ID, t }, ctx({ now: new Date("2026-11-06T18:30:00Z"), conf: BookingCoreConfig.parse({ customer_cancel_minutes: 60 }) }))).state).toBe("too_late");
    vi.restoreAllMocks();
    stubFetch([get({ status: "declined" })]);
    expect((await cancelView("POST", { id: ID, t }, ctx())).state).toBe("closed");
    expect((await cancelView("GET", { id: ID, t }, ctx({ env: { ...env, BOOKING_TOKEN_SECRET: "" } }))).state).toBe("off");
  });
});

describe("daily cron", () => {
  it("expires holds, applies retention and sends tomorrow's reminders once", async () => {
    const calls = stubFetch([
      [/status=eq\.pending/, () => Response.json([row({ status: "expired" })])],
      [/bookings\?ends_at=lt\./, () => new Response(null, { status: 204 })],
      [/booking_blocks\?ends_at=lt\./, () => new Response(null, { status: 204 })],
      [/bookings\?select=.*reminded_at=is\.null/, () => Response.json([row({ status: "confirmed" })])],
      resend, patchOk,
    ]);
    const out = await runBookingDaily({ cfg, conf: BookingCoreConfig.parse({}), types: {}, now: NOW, env });
    expect(out).toBe("expired holds 1, expiry emails 1 sent; retention 100d: bookings ok, blocks ok; reminders 1 due, 1 sent");
    expect(calls[0]).toMatchObject({ method: "PATCH", body: { status: "expired" } });
    expect(calls[0]!.url).toContain(`hold_until=lte.${encodeURIComponent(NOW.toISOString())}`);
    expect(calls.find((c) => c.url.includes("bookings?ends_at"))!.url).toContain(`ends_at=lt.${encodeURIComponent("2026-07-28T10:00:00.000Z")}`);
    const q = calls.find((c) => c.url.includes("reminded_at=is.null"))!.url;
    // tomorrow = Friday 6 November, midnight to midnight London time
    expect(q).toContain(`starts_at=gte.${encodeURIComponent("2026-11-06T00:00:00.000Z")}&starts_at=lt.${encodeURIComponent("2026-11-07T00:00:00.000Z")}`);
    expect(mails(calls).map((m) => m.subject)).toEqual(["Your booking request has expired", "See you tomorrow"]);
    // the expiry email states nothing was booked and never echoes the visitor's own text (rule 9)
    expect(mails(calls)[0].text).toMatch(/nothing has been booked/);
    const patch = calls.filter((c) => c.method === "PATCH").at(-1)!;
    expect(patch.body).toMatchObject({ reminded_at: NOW.toISOString(), delivery: { customer_email: "ok", reminder_email: "ok" } });
  });
  it("can switch expiry emails off", async () => {
    const calls = stubFetch([[/status=eq\.pending/, () => Response.json([row({ status: "expired" })])], [/./, () => new Response(null, { status: 204 })]]);
    const out = await runBookingDaily({ cfg, conf: BookingCoreConfig.parse({ notify_expired: false, reminders: false }), types: {}, now: NOW, env });
    expect(out).toMatch(/^expired holds 1; /);
    expect(mails(calls)).toEqual([]);
  });
  it("can switch reminders off", async () => {
    stubFetch([[/./, () => new Response(null, { status: 204 })]]);
    expect(await runBookingDaily({ cfg, conf: BookingCoreConfig.parse({ reminders: false }), types: {}, now: NOW, env })).toMatch(/reminders off$/);
  });
});
