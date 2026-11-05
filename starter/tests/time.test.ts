import { describe, expect, it } from "vitest";
import { addDays, dayBounds, isIsoDate, localToUtc, nowIn, todayIn, weekdayOf, zoned } from "../src/kit/lib/time.ts";

const iso = (ms: number | null) => (ms === null ? null : new Date(ms).toISOString());

describe("time zone maths", () => {
  it("converts local times to UTC, with and without DST", () => {
    expect(iso(localToUtc("2026-07-01", 19 * 60, "Europe/London"))).toBe("2026-07-01T18:00:00.000Z"); // BST
    expect(iso(localToUtc("2026-11-20", 19 * 60, "Europe/London"))).toBe("2026-11-20T19:00:00.000Z"); // GMT
    expect(iso(localToUtc("2026-11-20", 19 * 60, "Asia/Dubai"))).toBe("2026-11-20T15:00:00.000Z");
    expect(iso(localToUtc("2026-11-20", 19 * 60, "America/New_York"))).toBe("2026-11-21T00:00:00.000Z");
    expect(iso(localToUtc("2026-11-20", 19 * 60, "Australia/Sydney"))).toBe("2026-11-20T08:00:00.000Z"); // AEDT +11
  });
  it("returns null for the hour skipped in spring, and the first of a repeated hour in autumn", () => {
    expect(localToUtc("2026-03-29", 90, "Europe/London")).toBeNull(); // 01:30 doesn't exist
    expect(iso(localToUtc("2026-03-29", 150, "Europe/London"))).toBe("2026-03-29T01:30:00.000Z");
    expect(iso(localToUtc("2026-10-25", 90, "Europe/London"))).toBe("2026-10-25T00:30:00.000Z"); // 01:30 BST, not GMT
    expect(localToUtc("2026-03-08", 150, "America/New_York")).toBeNull();
  });
  it("handles minutes past midnight", () => {
    expect(iso(localToUtc("2026-11-20", 1440 + 60, "Europe/London"))).toBe("2026-11-21T01:00:00.000Z");
  });
  it("knows today where the business is, not where the server is", () => {
    const now = new Date("2026-11-04T22:30:00Z");
    expect(todayIn("Asia/Dubai", now)).toBe("2026-11-05");
    expect(todayIn("Europe/London", now)).toBe("2026-11-04");
    expect(todayIn("America/Los_Angeles", now)).toBe("2026-11-04");
  });
  it("has calendar helpers that ignore DST", () => {
    expect(addDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(weekdayOf("2026-11-06")).toBe("fri");
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(zoned(Date.parse("2026-07-01T23:30:00Z"), "Europe/London")).toEqual({ date: "2026-07-02", minutes: 30 });
  });
  it("gives day bounds that are 23 or 25 hours long on DST days", () => {
    const spring = dayBounds("2026-03-29", "Europe/London");
    const autumn = dayBounds("2026-10-25", "Europe/London");
    expect((spring.to - spring.from) / 3_600_000).toBe(23);
    expect((autumn.to - autumn.from) / 3_600_000).toBe(25);
  });
  it("writes now as a sortable stamp in the business time zone", () => {
    expect(nowIn("Asia/Dubai", new Date("2026-11-04T22:30:00Z"))).toBe("2026-11-05 02:30");
    expect(nowIn("Europe/London", new Date("2026-11-04T22:30:00Z"))).toBe("2026-11-04 22:30");
    expect(nowIn("America/New_York", Date.parse("2026-11-05T05:00:00Z"))).toBe("2026-11-05 00:00");
  });
  it("tells real dates from impossible ones", () => {
    expect(isIsoDate("2028-02-29")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-2-3")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("todayIn (the business's date, not the server's)", () => {
  const now = new Date("2026-11-05T22:30:00Z");
  it("is already tomorrow in Dubai (UTC+4), still today in London and New York", () => {
    expect(todayIn("Asia/Dubai", now)).toBe("2026-11-06");
    expect(todayIn("Europe/London", now)).toBe("2026-11-05");
    expect(todayIn("America/New_York", now)).toBe("2026-11-05");
  });
  it("handles a time zone far ahead of UTC at the day boundary", () => {
    expect(todayIn("Pacific/Auckland", new Date("2026-11-05T11:00:00Z"))).toBe("2026-11-06");
    expect(todayIn("Pacific/Auckland", new Date("2026-11-05T10:59:00Z"))).toBe("2026-11-05");
  });
  it("follows daylight saving", () => {
    // London is UTC+1 in summer: 23:30Z is already the next day
    expect(todayIn("Europe/London", new Date("2026-07-01T23:30:00Z"))).toBe("2026-07-02");
    expect(todayIn("Europe/London", new Date("2026-12-01T23:30:00Z"))).toBe("2026-12-01");
  });
});
