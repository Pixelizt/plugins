import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SpaceBookingConfig, SpacesDoc, durationsOf, hoursText, spaceWarnings } from "../lib/schema.ts";
import { addonsOf, spaceType } from "../lib/type.ts";
import { slotsFor } from "../../booking-core/lib/slots.ts";
import { freeSlots } from "../../booking-core/lib/capacity.ts";
import seed from "../seed/spaces.json";

const HOURS = { "mon-sun": "10:00-23:00" };
const conf = SpaceBookingConfig.parse({
  occasions: ["Birthday", "Work event"],
  addons: [{ key: "cake", label: "Celebration cake" }, { key: "decor", label: "Decorations" }],
  spaces: [
    { id: "garden", name: "Garden", capacity: 40, min_guests: 10, min_hours: 2, max_hours: 4, price_per_hour: 80 },
    { id: "snug", name: "Snug", capacity: 8, min_hours: 1, max_hours: 2, opening_hours: { "fri-sat": "18:00-23:00" } },
  ],
});
const type = spaceType(conf, HOURS);
const ask = { space: "garden", duration: 180, party: 20, occasion: "Birthday", addons: ["cake"], time: "18:00" };

describe("space-booking config", () => {
  it("parses {} (hidden until spaces exist) with approve mode by default", () => {
    const c = SpaceBookingConfig.parse(undefined);
    expect(c).toMatchObject({ mode: "approve", buffer_minutes: 30, slot_minutes: 30, spaces: [] });
    expect(spaceType(c, HOURS).configured).toBe(false);
  });
  it("gives readable errors", () => {
    const bad = SpaceBookingConfig.safeParse({ spaces: [{ id: "A B", name: "x", capacity: 5 }, { id: "x", name: "x", capacity: 5, min_hours: 3, max_hours: 2, min_guests: 9 }, { id: "x", name: "y", capacity: 2, min_hours: 1.25 }] });
    expect(bad.success).toBe(false);
    const msg = z.prettifyError(bad.error!);
    expect(msg).toMatch(/lowercase letters/);
    expect(msg).toMatch(/smaller than min_hours/);
    expect(msg).toMatch(/larger than capacity/);
    expect(msg).toMatch(/used twice/);
    expect(msg).toMatch(/whole steps of slot_minutes/);
  });
  it("seed doc is valid, marked sample, and says nothing has been paid", () => {
    const d = SpacesDoc.parse(seed);
    expect(d.spaces.every((s) => s.sample)).toBe(true);
    expect(d.success_pending).toMatch(/NOT confirmed/);
    expect(d.success_pending).toMatch(/nothing has been paid/);
    expect(spaceWarnings(conf, d)).toContainEqual(expect.stringMatching(/describes "demo-room"/));
  });
  it("lists lengths", () => {
    expect(durationsOf(conf.spaces[0]!, 30)).toEqual([120, 150, 180, 210, 240]);
    expect(hoursText(150)).toBe("2.5 hours");
    expect(hoursText(60)).toBe("1 hour");
  });
});

describe("space type", () => {
  it("resolves a booking: whole space, buffer, config-only facts", () => {
    const r = type.resolve(ask);
    expect(r).toMatchObject({
      ok: true, units: 1, party_size: 20, duration: 180, mode: "approve", hold_minutes: 2880,
      candidates: [{ id: "space:garden", kind: "space", capacity: 1, buffer_minutes: 30 }],
      facts: [["Space", "Garden"], ["Guests", "20"], ["Length", "3 hours"], ["Occasion", "Birthday"], ["Extras requested", "Celebration cake"]],
      fields: { occasion: "Birthday", addons: "cake" },
      rules: { fit: "whole", hours: HOURS },
    });
  });
  it("checks the space, length, guests, occasion and extras", () => {
    expect(type.resolve({ ...ask, space: "attic" })).toMatchObject({ ok: false, field: "space" });
    expect(type.resolve({ ...ask, duration: 300 })).toMatchObject({ ok: false, field: "duration" });
    expect(type.resolve({ ...ask, duration: 100 })).toMatchObject({ ok: false, field: "duration" });
    expect(type.resolve({ ...ask, party: 5 })).toMatchObject({ ok: false, field: "party" });
    expect(type.resolve({ ...ask, party: 41 })).toMatchObject({ ok: false, field: "party", enquiry: "/contact" });
    expect(type.resolve({ ...ask, party: "" })).toMatchObject({ ok: false, field: "party" });
    expect(type.resolve({ ...ask, occasion: "<script>" })).toMatchObject({ ok: false, field: "occasion" });
    expect(type.resolve({ ...ask, addons: ["cake", "pony"] })).toMatchObject({ ok: false, field: "addons" });
    expect(addonsOf(conf, "cake, decor")).toEqual(["cake", "decor"]);
    expect(addonsOf(conf, undefined)).toEqual([]);
  });
  it("availability doesn't need the guest count", () => {
    expect(type.resolve({ space: "garden", duration: "120" })).toMatchObject({ ok: true, party_size: 10 });
  });
  it("a space's own hours win; the whole booking must fit", () => {
    const r = type.resolve({ space: "snug", duration: 120, party: 4 });
    if (!r.ok) throw new Error(r.error);
    const now = new Date("2026-11-01T00:00:00Z");
    expect(slotsFor(r.rules, "2026-11-05", r.duration, "Europe/London", now)).toEqual([]); // Thursday: closed
    const fri = slotsFor(r.rules, "2026-11-06", r.duration, "Europe/London", now);
    expect(fri[0]!.time).toBe("18:00");
    expect(fri.at(-1)!.time).toBe("21:00");
  });
  it("buffer keeps 30 minutes between two bookings of the same space", () => {
    const r = type.resolve({ space: "garden", duration: 120, party: 12 });
    if (!r.ok) throw new Error(r.error);
    const now = new Date("2026-11-01T00:00:00Z");
    const slots = slotsFor(r.rules, "2026-11-06", r.duration, "Europe/London", now);
    const occ = [{ resource_id: "space:garden", starts_at: "2026-11-06T14:00:00Z", ends_at: "2026-11-06T16:00:00Z", units: 1, status: "confirmed" as const, hold_until: null }];
    const free = freeSlots(slots, r.candidates, occ, [], 1, now.getTime()).map((s) => s.time);
    expect(free).toContain("11:30"); // ends 13:30, 30 min before 14:00
    expect(free).not.toContain("12:00");
    expect(free).not.toContain("16:00");
    expect(free).toContain("16:30");
  });
  it("describes its spaces for the admin", () => {
    expect(type.describe().spaces).toEqual([
      { id: "garden", name: "Garden", capacity: 40, min_guests: 10, min_minutes: 120, max_minutes: 240 },
      { id: "snug", name: "Snug", capacity: 8, min_guests: 1, min_minutes: 60, max_minutes: 120 },
    ]);
  });
});
