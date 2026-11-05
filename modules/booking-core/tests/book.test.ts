import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAvailability, handleBook } from "../server/book.ts";
import { BookingCoreConfig } from "../lib/schema.ts";
import { tokenHash, cancelToken } from "../server/token.ts";
import { NOW, SECRET, bookReq, ctx, env, fakeType, good, mails, patchOk, resend, stubFetch, type Call } from "./fixture.ts";

afterEach(() => vi.restoreAllMocks());

const created = (c: Call) => Response.json({ ok: true, id: c.body.p_id, resource_id: "table:covers" });
function routes(o: { recent?: number; create?: (c: Call) => Response; occupancy?: unknown[]; blocks?: unknown[] } = {}): [RegExp, (c: Call) => Response][] {
  return [
    [/bookings\?select=id&source=eq\.web&ip_hash/, () => Response.json(Array.from({ length: o.recent ?? 0 }, (_, i) => ({ id: i })))],
    [/rpc\/create_booking/, o.create ?? created],
    [/bookings\?select=resource_id/, () => Response.json(o.occupancy ?? [])],
    [/booking_blocks\?select/, () => Response.json(o.blocks ?? [])],
    resend, patchOk,
  ];
}

describe("POST /api/bookings/book", () => {
  it("auto mode: confirms, emails customer and team, records delivery", async () => {
    const calls = stubFetch(routes());
    const r = await handleBook(bookReq(good), ctx());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ ok: true, status: "confirmed" });
    const rpc = calls.find((c) => c.url.includes("rpc/create_booking"))!.body;
    expect(rpc).toMatchObject({
      p_kind: "table", p_units: 4, p_party_size: 4, p_status: "confirmed", p_hold_until: null, p_source: "web",
      p_starts_at: "2026-11-06T19:00:00.000Z", p_ends_at: "2026-11-06T20:30:00.000Z",
      p_candidates: [{ id: "table:covers", capacity: 10 }], p_email: "ann@example.com",
    });
    // only the hash of the cancel token is stored, and it matches the token for this id
    expect(rpc.p_cancel_token_hash).toBe(tokenHash(cancelToken(SECRET, rpc.p_id)));
    expect(rpc.p_ip_hash).toMatch(/^[0-9a-f]{32}$/);
    const [team, customer] = mails(calls);
    expect(team.to).toEqual(["team@demo.com"]);
    expect(team.reply_to).toBe("ann@example.com");
    expect(team.html).toContain("Ann &lt;b&gt;Evil&lt;/b&gt;");
    expect(customer.to).toEqual(["ann@example.com"]);
    expect(customer.subject).toBe("Your booking is confirmed");
    expect(customer.text).toContain("Friday 6 November 2026, 19:00 to 20:30");
    expect(customer.text).toContain(`https://demo.example.com/bookings/cancel?id=${rpc.p_id}&t=`);
    // rule 9: nothing the visitor typed reaches the customer email
    for (const part of [customer.html, customer.text, customer.subject]) {
      expect(part).not.toContain("Ann");
      expect(part).not.toContain("Evil");
      expect(part).not.toContain("spam.example");
    }
    const patch = calls.find((c) => c.method === "PATCH")!;
    expect(patch.body.delivery).toEqual({ team_email: "ok", customer_email: "ok", cancel_link: "on" });
  });

  it("approve mode: pending with a hold, and the customer is told it is NOT confirmed (rule 18)", async () => {
    const calls = stubFetch(routes());
    const r = await handleBook(bookReq(good), ctx({ types: { table: fakeType("approve") } }));
    expect(r.body).toMatchObject({ ok: true, status: "pending" });
    const rpc = calls.find((c) => c.url.includes("rpc/create_booking"))!.body;
    expect(rpc.p_status).toBe("pending");
    expect(rpc.p_hold_until).toBe(new Date(NOW.getTime() + 120 * 60_000).toISOString());
    const [team, customer] = mails(calls);
    expect(team.subject).toMatch(/request to accept or decline/);
    expect(team.text).toMatch(/Held until/);
    expect(customer.subject).toBe("We've received your booking request");
    expect(customer.text).toContain("NOT confirmed yet");
    expect(customer.text).toContain("To cancel:");
    expect(customer.html).toContain("Cancel this request");
  });

  it("caps the hold at the booking's start", async () => {
    const calls = stubFetch(routes());
    await handleBook(bookReq({ ...good, date: "2026-11-05", time: "12:00" }), ctx({ types: { table: fakeType("approve") } }));
    expect(calls.find((c) => c.url.includes("rpc/create_booking"))!.body.p_hold_until).toBe("2026-11-05T12:00:00.000Z");
  });

  it("quietly accepts honeypot submissions and stores nothing", async () => {
    const calls = stubFetch(routes());
    const r = await handleBook(bookReq({ ...good, _gotcha: "bot" }), ctx());
    expect(r.status).toBe(200);
    expect(calls).toEqual([]);
  });

  it("validates details with the forms rules", async () => {
    const calls = stubFetch(routes());
    const r = await handleBook(bookReq({ ...good, details: { name: "", email: "ann@gmail.con", phone: "123" } }), ctx());
    expect(r.status).toBe(400);
    expect(r.body.fields).toEqual({ name: "required", email: "invalid", phone: "invalid" });
    expect(calls).toEqual([]);
  });

  it("phone can be made optional", async () => {
    stubFetch(routes());
    const r = await handleBook(bookReq({ ...good, details: { ...good.details, phone: "" } }), ctx({ conf: BookingCoreConfig.parse({ require_phone: false }) }));
    expect(r.status).toBe(200);
  });

  it("refuses unknown types, closed days, times that aren't slots, and sends big groups to an enquiry", async () => {
    const calls = stubFetch(routes());
    expect((await handleBook(bookReq({ ...good, type: "space" }), ctx())).status).toBe(400);
    const closed = await handleBook(bookReq({ ...good, date: "2026-11-08" }), ctx());
    expect(closed.body).toMatchObject({ ok: false, field: "date", error: "We're closed that day. Please choose another date." });
    expect((await handleBook(bookReq({ ...good, date: "2026-11-10" }), ctx())).body.error).toMatch(/closed/); // blackout
    expect((await handleBook(bookReq({ ...good, date: "2026-11-04" }), ctx())).body.error).toMatch(/passed/);
    const odd = await handleBook(bookReq({ ...good, time: "19:10" }), ctx());
    expect(odd).toMatchObject({ status: 409, body: { code: "unavailable" } });
    const lead = await handleBook(bookReq({ ...good, date: "2026-11-05", time: "10:30" }), ctx());
    expect(lead.status).toBe(409); // inside the lead time / before opening
    const big = await handleBook(bookReq({ ...good, party: 12 }), ctx());
    expect(big.body).toMatchObject({ ok: false, field: "party", enquiry: "/contact" });
    expect(calls.filter((c) => c.url.includes("rpc"))).toEqual([]);
  });

  it("rate limits per hashed address", async () => {
    const calls = stubFetch(routes({ recent: 5 }));
    expect((await handleBook(bookReq(good), ctx())).status).toBe(429);
    expect(calls.some((c) => c.url.includes("rpc"))).toBe(false);
  });

  it("full: a friendly 409 and no emails", async () => {
    const calls = stubFetch(routes({ create: () => Response.json({ ok: false, reason: "full" }) }));
    const r = await handleBook(bookReq(good), ctx());
    expect(r).toMatchObject({ status: 409, body: { ok: false, code: "full", error: "Sorry, that time has just been taken. Please choose another time." } });
    expect(mails(calls)).toEqual([]);
  });

  it("a failed save fails the visitor; failed emails don't", async () => {
    stubFetch(routes({ create: () => new Response("boom", { status: 500 }) }));
    expect((await handleBook(bookReq(good), ctx())).status).toBe(502);
    vi.restoreAllMocks();
    const calls = stubFetch([...routes().filter(([re]) => !re.test("https://api.resend.com")), [/api\.resend\.com/, () => new Response("nope", { status: 500 })]]);
    const r = await handleBook(bookReq(good), ctx());
    expect(r.status).toBe(200);
    expect(calls.find((c) => c.method === "PATCH")!.body.delivery.customer_email).toMatch(/^error: Resend 500/);
  });

  it("without a token secret the booking works but carries no cancel link", async () => {
    const calls = stubFetch(routes());
    await handleBook(bookReq(good), ctx({ env: { ...env, BOOKING_TOKEN_SECRET: "" } }));
    expect(calls.find((c) => c.url.includes("rpc/create_booking"))!.body.p_cancel_token_hash).toBeNull();
    expect(mails(calls)[1].text).not.toContain("/bookings/cancel");
  });

  it("503 when Supabase isn't configured", async () => {
    expect((await handleBook(bookReq(good), ctx({ env: {} }))).status).toBe(503);
  });
});

describe("GET /api/bookings/availability", () => {
  const url = (q: string) => new URL(`https://demo.example.com/api/bookings/availability?${q}`);
  it("lists free times only, reads no personal data, and is cacheable", async () => {
    const calls = stubFetch(routes({ occupancy: [{ resource_id: "table:covers", starts_at: "2026-11-06T19:00:00Z", ends_at: "2026-11-06T20:30:00Z", units: 8, status: "confirmed", hold_until: null }] }));
    const r = await handleAvailability(url("type=table&date=2026-11-06&party=4"), ctx());
    expect(r.status).toBe(200);
    const times = (r.body.slots as { time: string }[]).map((s) => s.time);
    expect(times).toContain("17:30");
    expect(times).not.toContain("18:00"); // 18:00-19:30 overlaps the 8-cover booking: 8 + 4 > 10
    expect(times).not.toContain("19:00");
    expect(times).toContain("20:30");
    const q = calls.find((c) => c.url.includes("bookings?select="))!.url;
    expect(q).toContain("select=resource_id,starts_at,ends_at,units,status,hold_until&");
    expect(r.headers!["Cache-Control"]).toMatch(/s-maxage=15/);
  });
  it("answers closed days without touching the database", async () => {
    const calls = stubFetch(routes());
    const r = await handleAvailability(url("type=table&date=2026-11-08&party=2"), ctx());
    expect(r.body).toMatchObject({ ok: true, slots: [], closed: "closed" });
    expect(calls).toEqual([]);
  });
  it("blocks remove times", async () => {
    stubFetch(routes({ blocks: [{ kind: null, resource_id: null, starts_at: "2026-11-06T17:00:00Z", ends_at: "2026-11-06T23:00:00Z" }] }));
    const r = await handleAvailability(url("type=table&date=2026-11-06&party=2"), ctx());
    expect((r.body.slots as { time: string }[]).map((s) => s.time).at(-1)).toBe("15:30"); // 15:30-17:00 ends as the block starts
  });
  it("rejects unknown types and bad parties", async () => {
    stubFetch(routes());
    expect((await handleAvailability(url("type=boat&date=2026-11-06"), ctx())).status).toBe(404);
    expect((await handleAvailability(url("type=table&date=2026-11-06&party=x"), ctx())).status).toBe(400);
  });
});
