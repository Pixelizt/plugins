import { describe, expect, it } from "vitest";
import { canMove, freeSlots, holdsCapacity, isBlocked, peakUnits, pickResource, type Occupancy, type Resource } from "../lib/capacity.ts";
import { cancelToken, tokenHash, tokenSecret, verifyCancelToken } from "../server/token.ts";

const T = (hhmm: string) => Date.parse(`2026-11-06T${hhmm}:00Z`);
const NOW = Date.parse("2026-11-05T10:00:00Z");
const occ = (start: string, end: string, units: number, extra: Partial<Occupancy> = {}): Occupancy => ({
  resource_id: "table:covers", starts_at: new Date(T(start)).toISOString(), ends_at: new Date(T(end)).toISOString(), units, status: "confirmed", hold_until: null, ...extra,
});
const covers: Resource = { id: "table:covers", kind: "table", name: "Covers", capacity: 10, buffer_minutes: 0 };

describe("which bookings hold capacity", () => {
  it("confirmed yes; pending only while its hold lasts; others no (lazy expiry)", () => {
    expect(holdsCapacity({ status: "confirmed", hold_until: null }, NOW)).toBe(true);
    expect(holdsCapacity({ status: "pending", hold_until: new Date(NOW + 60_000).toISOString() }, NOW)).toBe(true);
    expect(holdsCapacity({ status: "pending", hold_until: new Date(NOW - 1).toISOString() }, NOW)).toBe(false);
    for (const s of ["declined", "cancelled", "expired"] as const) expect(holdsCapacity({ status: s, hold_until: null }, NOW)).toBe(false);
  });
});

describe("peak units", () => {
  it("adds up only bookings that are on at the same moment", () => {
    const list = [occ("17:00", "18:30", 4), occ("19:00", "20:30", 4)];
    // 18:00-19:30 touches both, but they never overlap each other: the peak is 4, not 8
    expect(peakUnits(list, "table:covers", T("18:00"), T("19:30"), 0, NOW)).toBe(4);
    expect(peakUnits([...list, occ("18:15", "19:45", 3)], "table:covers", T("18:00"), T("19:30"), 0, NOW)).toBe(7);
  });
  it("treats end times as free (a 19:00 booking after one ending 19:00)", () => {
    expect(peakUnits([occ("17:30", "19:00", 10)], "table:covers", T("19:00"), T("20:30"), 0, NOW)).toBe(0);
  });
  it("ignores other resources, expired holds and cancelled rows", () => {
    const list = [
      occ("19:00", "20:30", 5, { resource_id: "table:2-seats" }),
      occ("19:00", "20:30", 5, { status: "pending", hold_until: new Date(NOW - 1000).toISOString() }),
      occ("19:00", "20:30", 5, { status: "cancelled" }),
      occ("19:00", "20:30", 2, { status: "pending", hold_until: new Date(NOW + 1000).toISOString() }),
    ];
    expect(peakUnits(list, "table:covers", T("19:00"), T("20:30"), 0, NOW)).toBe(2);
  });
  it("keeps a buffer between bookings of a resource", () => {
    const list = [occ("12:00", "15:00", 1, { resource_id: "space:room" })];
    expect(peakUnits(list, "space:room", T("15:00"), T("18:00"), 30, NOW)).toBe(1); // needs 30 min to turn the room
    expect(peakUnits(list, "space:room", T("15:30"), T("18:00"), 30, NOW)).toBe(0);
    expect(peakUnits(list, "space:room", T("08:30"), T("11:30"), 30, NOW)).toBe(0); // ends 11:30: exactly 30 min before 12:00
    expect(peakUnits(list, "space:room", T("08:45"), T("11:45"), 30, NOW)).toBe(1); // only 15 min to turn the room
  });
});

describe("choosing a resource and free slots", () => {
  const groups: Resource[] = [
    { id: "table:2-seats", kind: "table", name: "2", capacity: 1, buffer_minutes: 0 },
    { id: "table:4-seats", kind: "table", name: "4", capacity: 1, buffer_minutes: 0 },
  ];
  it("takes the first candidate with room", () => {
    const busy = [occ("19:00", "20:30", 1, { resource_id: "table:2-seats" })];
    expect(pickResource(groups, [], [], T("19:00"), T("20:30"), 1, NOW)!.id).toBe("table:2-seats");
    expect(pickResource(groups, busy, [], T("19:00"), T("20:30"), 1, NOW)!.id).toBe("table:4-seats");
    expect(pickResource(groups, [...busy, occ("19:30", "21:00", 1, { resource_id: "table:4-seats" })], [], T("19:00"), T("20:30"), 1, NOW)).toBeNull();
  });
  it("covers model: full means no more seats than capacity", () => {
    const list = [occ("19:00", "20:30", 8)];
    expect(pickResource([covers], list, [], T("19:00"), T("20:30"), 2, NOW)).not.toBeNull();
    expect(pickResource([covers], list, [], T("19:00"), T("20:30"), 3, NOW)).toBeNull();
  });
  it("respects blocks by kind and resource", () => {
    const all = { kind: null, resource_id: null, starts_at: T("18:00"), ends_at: T("23:00") };
    const spaces = { kind: "space" as const, resource_id: null, starts_at: T("18:00"), ends_at: T("23:00") };
    expect(isBlocked([all], covers, T("19:00"), T("20:30"))).toBe(true);
    expect(isBlocked([spaces], covers, T("19:00"), T("20:30"))).toBe(false);
    expect(isBlocked([all], covers, T("16:00"), T("18:00"))).toBe(false);
    const slots = [{ time: "17:00", start: T("17:00"), end: T("18:30") }, { time: "19:00", start: T("19:00"), end: T("20:30") }];
    expect(freeSlots(slots, [covers], [], [all], 2, NOW).map((s) => s.time)).toEqual([]);
    expect(freeSlots(slots, [covers], [occ("19:00", "20:30", 10)], [], 2, NOW).map((s) => s.time)).toEqual(["17:00"]);
  });
  it("allows only the documented status moves", () => {
    expect(canMove("pending", "confirmed")).toBe(true);
    expect(canMove("expired", "confirmed")).toBe(true);
    expect(canMove("confirmed", "cancelled")).toBe(true);
    expect(canMove("confirmed", "declined")).toBe(false);
    expect(canMove("cancelled", "confirmed")).toBe(false);
    expect(canMove("declined", "confirmed")).toBe(false);
  });
});

describe("cancel tokens", () => {
  const secret = "s".repeat(40);
  const id = "4f1c2a9e-0b7d-4c55-9a51-3e2f1d0c9b8a";
  it("signs and verifies against the stored hash", () => {
    const t = cancelToken(secret, id);
    expect(t).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyCancelToken(secret, id, t, tokenHash(t))).toBe(true);
  });
  it("rejects another booking's token, another secret, a tampered token and a revoked hash", () => {
    const t = cancelToken(secret, id);
    const other = "00000000-0000-4000-8000-000000000000";
    expect(verifyCancelToken(secret, other, t, tokenHash(t))).toBe(false);
    expect(verifyCancelToken("x".repeat(40), id, t, tokenHash(t))).toBe(false);
    expect(verifyCancelToken(secret, id, t.slice(0, -1) + (t.endsWith("A") ? "B" : "A"), tokenHash(t))).toBe(false);
    expect(verifyCancelToken(secret, id, t, null)).toBe(false);
    expect(verifyCancelToken(secret, id, t, tokenHash("something else"))).toBe(false);
    expect(verifyCancelToken(secret, id, undefined, tokenHash(t))).toBe(false);
    expect(verifyCancelToken("", id, t, tokenHash(t))).toBe(false);
  });
  it("ignores secrets that are too short", () => {
    expect(tokenSecret({ BOOKING_TOKEN_SECRET: "short" })).toBe("");
    expect(tokenSecret({ BOOKING_TOKEN_SECRET: ` ${secret}​` })).toBe(secret);
  });
});
