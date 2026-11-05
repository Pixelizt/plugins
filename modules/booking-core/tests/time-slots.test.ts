import { describe, expect, it } from "vitest";
import { formatSpan } from "../lib/time.ts";
import { BlackoutDate, OpeningHours, checkDate, daysOf, isBlackout, slotsFor, windowsFor, type SlotRules } from "../lib/slots.ts";

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

describe("time formatting", () => {
  it("formats a span in the business time zone", () => {
    expect(formatSpan(Date.parse("2026-11-20T19:00:00Z"), Date.parse("2026-11-20T20:30:00Z"), "Europe/London")).toBe("Friday 20 November 2026, 19:00 to 20:30");
  });
});

const rules = (o: Partial<SlotRules> = {}): SlotRules => ({
  hours: { "mon-fri": "12:00-14:00, 18:00-21:00", sat: "12:00-22:00", sun: "closed" },
  slot_minutes: 30, lead_time_minutes: 60, max_days_ahead: 30, blackout_dates: [], fit: "start", ...o,
});
const TZ = "Europe/London";
const NOW = new Date("2026-11-05T10:00:00Z"); // Thursday

describe("opening hours", () => {
  it("validates hour strings and day keys with readable errors", () => {
    expect(OpeningHours.safeParse({ "mon-fri": "12:00-15:00, 18:00-22:00", sun: "closed" }).success).toBe(true);
    expect(OpeningHours.safeParse({ weekdays: "12:00-15:00" }).success).toBe(false);
    expect(OpeningHours.safeParse({ mon: "noon-3pm" }).success).toBe(false);
    expect(BlackoutDate.safeParse("2026-12-24..2026-12-26").success).toBe(true);
    expect(BlackoutDate.safeParse("2026-12-26..2026-12-24").success).toBe(false);
  });
  it("expands day ranges (including wrapping ones) and lets later lines win", () => {
    expect(daysOf("fri-mon")).toEqual(["fri", "sat", "sun", "mon"]);
    const h = { "mon-sun": "12:00-22:00", tue: "closed" };
    expect(windowsFor(h, "tue")).toEqual([]);
    expect(windowsFor(h, "wed")).toEqual([{ from: 720, to: 1320 }]);
    expect(windowsFor({ fri: "18:00-02:00" }, "fri")).toEqual([{ from: 1080, to: 1560 }]);
  });
  it("matches blackout dates and ranges", () => {
    expect(isBlackout("2026-12-25", ["2026-12-24..2026-12-26"])).toBe(true);
    expect(isBlackout("2026-12-27", ["2026-12-24..2026-12-26", "2026-12-31"])).toBe(false);
  });
});

describe("slot generation", () => {
  it("makes arrival slots inside each window, the end included", () => {
    const s = slotsFor(rules(), "2026-11-06", 90, TZ, NOW);
    expect(s.map((x) => x.time)).toEqual(["12:00", "12:30", "13:00", "13:30", "14:00", "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00"]);
    expect(iso(s[0]!.start)).toBe("2026-11-06T12:00:00.000Z");
    expect(s[0]!.end - s[0]!.start).toBe(90 * 60_000);
  });
  it("whole-fit keeps the booking inside the hours (spaces)", () => {
    const s = slotsFor(rules({ fit: "whole" }), "2026-11-07", 180, TZ, NOW);
    expect(s[0]!.time).toBe("12:00");
    expect(s.at(-1)!.time).toBe("19:00");
  });
  it("applies the lead time to today", () => {
    const s = slotsFor(rules(), "2026-11-05", 90, TZ, new Date("2026-11-05T12:10:00Z"));
    expect(s[0]!.time).toBe("13:30"); // 12:10 + 60 min → first slot at or after 13:10
    expect(slotsFor(rules(), "2026-11-05", 90, TZ, new Date("2026-11-05T12:10:00Z"), { staff: true })[0]!.time).toBe("12:30");
  });
  it("refuses past, closed, blackout and too-far dates", () => {
    expect(checkDate(rules(), "2026-11-04", TZ, NOW)).toBe("past");
    expect(checkDate(rules(), "2026-11-08", TZ, NOW)).toBe("closed"); // Sunday
    expect(checkDate(rules({ blackout_dates: ["2026-11-06"] }), "2026-11-06", TZ, NOW)).toBe("closed");
    expect(checkDate(rules(), "2026-12-07", TZ, NOW)).toBe("too_far");
    expect(checkDate(rules(), "2026-12-07", TZ, NOW, { staff: true })).toBeNull();
    expect(checkDate(rules(), "2026-12-05", TZ, NOW)).toBeNull(); // exactly 30 days (a Saturday)
    expect(checkDate(rules(), "nope", TZ, NOW)).toBe("invalid");
    expect(slotsFor(rules(), "2026-11-08", 90, TZ, NOW)).toEqual([]);
  });
  it("is DST-safe: skipped times vanish, the UTC instants follow the clock change", () => {
    const r = rules({ hours: { "mon-sun": "00:00-03:00" }, slot_minutes: 30, lead_time_minutes: 0 });
    const spring = slotsFor(r, "2026-03-29", 60, TZ, new Date("2026-03-01T00:00:00Z"));
    expect(spring.map((x) => x.time)).toEqual(["00:00", "00:30", "02:00", "02:30", "03:00"]);
    const autumn = slotsFor(r, "2026-10-25", 60, TZ, new Date("2026-10-01T00:00:00Z"));
    expect(autumn.map((x) => x.time)).toEqual(["00:00", "00:30", "01:00", "01:30", "02:00", "02:30", "03:00"]);
    expect(new Set(autumn.map((x) => x.start)).size).toBe(autumn.length);
    // a dinner slot across the March change keeps its wall-clock time
    const evening = rules({ hours: { "mon-sun": "19:00-19:00" } });
    expect(iso(slotsFor(evening, "2026-03-28", 90, TZ, new Date("2026-03-20T00:00:00Z"))[0]!.start)).toBe("2026-03-28T19:00:00.000Z");
    expect(iso(slotsFor(evening, "2026-03-29", 90, TZ, new Date("2026-03-20T00:00:00Z"))[0]!.start)).toBe("2026-03-29T18:00:00.000Z");
  });
  it("uses the business time zone for the slots of a far-away client", () => {
    const s = slotsFor(rules({ hours: { "mon-sun": "19:00-19:00" } }), "2026-11-06", 90, "Asia/Dubai", NOW);
    expect(iso(s[0]!.start)).toBe("2026-11-06T15:00:00.000Z");
  });
});
