import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { TableBookingConfig, TableBookingDoc, onlineMax, tableWarnings } from "../lib/schema.ts";
import { candidatesFor, tableType } from "../lib/type.ts";
import { handleBook } from "../../booking-core/server/book.ts";
import { BookingCoreConfig } from "../../booking-core/lib/schema.ts";
import seed from "../seed/table_booking.json";
import { cfg, env, NOW, bookReq } from "../../booking-core/tests/fixture.ts";

afterEach(() => vi.restoreAllMocks());

const HOURS = { "mon-sat": "12:00-14:30, 18:00-21:30", sun: "closed" };
const tables = TableBookingConfig.parse({ capacity_model: "tables", tables: [{ seats: 4, count: 2 }, { seats: 2, count: 3 }], party_size: { max: 8 }, large_party_enquiry_over: 6 });
const covers = TableBookingConfig.parse({ covers_per_slot: 30, mode: "approve" });

describe("table-booking config", () => {
  it("parses {} to safe defaults that keep the section hidden", () => {
    const c = TableBookingConfig.parse(undefined);
    expect(c).toMatchObject({ mode: "auto", capacity_model: "covers", covers_per_slot: 0, slot_minutes: 15, duration_minutes: 90, party_size: { min: 1, max: 8 } });
    expect(tableType(c, HOURS).configured).toBe(false);
    expect(tableWarnings(c)[0]).toMatch(/covers_per_slot is 0/);
  });
  it("gives readable errors", () => {
    const bad = TableBookingConfig.safeParse({ party_size: { min: 6, max: 4 }, slot_minutes: 7, tables: [{ seats: 2, count: 1 }, { seats: 2, count: 3 }], capacity_model: "tables", opening_hours: { mon: "noon" } });
    expect(bad.success).toBe(false);
    const msg = z.prettifyError(bad.error!);
    expect(msg).toMatch(/min is larger than max/);
    expect(msg).toMatch(/merge them/);
    expect(msg).toMatch(/HH:MM-HH:MM/);
    expect(TableBookingConfig.safeParse({ large_party_enquiry_over: 20 }).success).toBe(false);
    expect(TableBookingConfig.safeParse({ unknown_key: 1 }).success).toBe(false);
  });
  it("the seed wording passes and says a request isn't confirmed (rule 18)", () => {
    const d = TableBookingDoc.parse(seed);
    expect(d.success_pending).toMatch(/NOT confirmed/);
  });
  it("warns when tables are too small for the online party limit", () => {
    expect(tableWarnings(TableBookingConfig.parse({ capacity_model: "tables", tables: [{ seats: 4, count: 2 }] }))).toContainEqual(expect.stringMatching(/largest table seats 4/));
  });
});

describe("table type", () => {
  it("covers model: one pool, party = units", () => {
    const r = tableType(covers, HOURS).resolve({ party: 5 });
    expect(r).toMatchObject({ ok: true, units: 5, party_size: 5, mode: "approve", duration: 90, candidates: [{ id: "table:covers", capacity: 30 }] });
  });
  it("tables model: smallest table that seats the party first, one table each", () => {
    expect(candidatesFor(tables, 2).map((c) => c.id)).toEqual(["table:2-seats", "table:4-seats"]);
    expect(candidatesFor(tables, 3).map((c) => c.id)).toEqual(["table:4-seats"]);
    const r = tableType(tables, HOURS).resolve({ party: "3" });
    expect(r).toMatchObject({ ok: true, units: 1, candidates: [{ id: "table:4-seats", capacity: 2 }] });
  });
  it("large parties go to the enquiry; staff may book any party that fits", () => {
    expect(onlineMax(tables)).toBe(6);
    expect(tableType(tables, HOURS).resolve({ party: 7 })).toMatchObject({ ok: false, enquiry: "/contact", field: "party" });
    expect(tableType(tables, HOURS).resolve({ party: 5 })).toMatchObject({ ok: false, enquiry: "/contact" }); // no 5-seat table
    expect(tableType(tables, HOURS).resolve({ party: 0 })).toMatchObject({ ok: false, field: "party" });
    expect(tableType(covers, HOURS).resolve({ party: 20 }, { staff: true })).toMatchObject({ ok: true });
    expect(tableType(covers, HOURS).resolve({ party: 31 }, { staff: true })).toMatchObject({ ok: false });
  });
  it("uses client hours unless its own are given", () => {
    expect(tableType(covers, HOURS).resolve({ party: 2 })).toMatchObject({ rules: { hours: HOURS, fit: "start" } });
    const own = TableBookingConfig.parse({ covers_per_slot: 10, opening_hours: { sat: "18:00-22:00" } });
    expect(tableType(own, HOURS).resolve({ party: 2 })).toMatchObject({ rules: { hours: { sat: "18:00-22:00" } } });
    expect(tableType(TableBookingConfig.parse({ covers_per_slot: 10 }), {}).configured).toBe(false); // no hours anywhere
  });
});

describe("end to end through booking-core", () => {
  it("books a 4-top for 3 people and never echoes visitor text to the customer", async () => {
    const calls: { url: string; body: any }[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = String(input);
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      calls.push({ url, body });
      if (url.includes("ip_hash")) return Response.json([]);
      if (url.includes("rpc/create_booking")) return Response.json({ ok: true, id: body.p_id, resource_id: body.p_candidates[0].id });
      if (url.includes("resend")) return Response.json({ id: "m" });
      return new Response(null, { status: 204 });
    });
    const r = await handleBook(bookReq({ type: "table", date: "2026-11-06", time: "18:30", party: 3, details: { name: "Zed", email: "zed@example.com", phone: "+442079460958", notes: "window seat" } }),
      { cfg, conf: BookingCoreConfig.parse({}), types: { table: tableType(tables, HOURS) }, region: "GB", env, now: NOW });
    expect(r.body).toMatchObject({ ok: true, status: "confirmed" });
    expect(calls.find((c) => c.url.includes("rpc"))!.body).toMatchObject({ p_units: 1, p_party_size: 3, p_candidates: [{ id: "table:4-seats" }] });
    const customer = calls.filter((c) => c.url.includes("resend"))[1]!.body;
    expect(customer.text).not.toMatch(/Zed|window seat/);
    expect(customer.text).toContain("Guests: 3");
  });
});
