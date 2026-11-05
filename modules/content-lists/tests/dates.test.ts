import { describe, expect, it } from "vitest";
import { todayIn } from "../../../kit/lib/time.ts";
import { isPast, lastDay, offerState, splitEvents } from "../lib/dates.ts";
import { dateRange, formatDay, starsText } from "../lib/format.ts";

describe("isPast / lastDay", () => {
  it("an event is on through its last day", () => {
    expect(isPast({ start: "2026-11-05" }, "2026-11-05")).toBe(false);
    expect(isPast({ start: "2026-11-05" }, "2026-11-06")).toBe(true);
    expect(isPast({ start: "2026-11-03", end: "2026-11-07" }, "2026-11-07")).toBe(false);
    expect(isPast({ start: "2026-11-03", end: "2026-11-07" }, "2026-11-08")).toBe(true);
  });
  it("an event with no date never ends on its own", () => {
    expect(lastDay({})).toBe("");
    expect(isPast({}, "2999-01-01")).toBe(false);
  });
});

describe("splitEvents", () => {
  const ev = (title: string, start?: string, end?: string) => ({ title, start, end });
  const list = [ev("undated"), ev("late", "2026-12-01"), ev("soon", "2026-11-10"), ev("old1", "2026-01-01"), ev("old3", "2026-03-01"), ev("old2", "2026-02-01", "2026-02-05"), ev("running", "2026-11-01", "2026-11-09")];
  const today = "2026-11-05";

  it("splits upcoming (soonest first, undated last) from past (newest first)", () => {
    const { upcoming, past } = splitEvents(list, today, 10);
    expect(upcoming.map((e) => e.title)).toEqual(["running", "soon", "late", "undated"]);
    expect(past.map((e) => e.title)).toEqual(["old3", "old2", "old1"]);
  });
  it("keeps only the newest pastMax past events", () => {
    expect(splitEvents(list, today, 2).past.map((e) => e.title)).toEqual(["old3", "old2"]);
    expect(splitEvents(list, today, 0).past).toEqual([]);
  });
  it("uses the end date, not the start, to decide an event is over (the day after it ends)", () => {
    expect(splitEvents([ev("x", "2026-11-01", "2026-11-05")], "2026-11-05", 6).upcoming).toHaveLength(1);
    expect(splitEvents([ev("x", "2026-11-01", "2026-11-05")], "2026-11-06", 6).past).toHaveLength(1);
  });
  it("is stable for equal dates and does not mutate its input", () => {
    const same = [ev("a", "2026-11-10"), ev("b", "2026-11-10")];
    const copy = [...same];
    expect(splitEvents(same, today, 6).upcoming.map((e) => e.title)).toEqual(["a", "b"]);
    expect(same).toEqual(copy);
  });
  it("the same instant is a different split in different time zones", () => {
    const now = new Date("2026-11-05T22:30:00Z");
    const e = [ev("tonight", "2026-11-05")];
    expect(splitEvents(e, todayIn("Europe/London", now), 6).upcoming).toHaveLength(1);
    expect(splitEvents(e, todayIn("Asia/Dubai", now), 6).past).toHaveLength(1);
  });
});

describe("offerState", () => {
  it("is live between start and end, inclusive", () => {
    expect(offerState({ start: "2026-11-01", end: "2026-11-30" }, "2026-11-01")).toBe("live");
    expect(offerState({ start: "2026-11-01", end: "2026-11-30" }, "2026-11-30")).toBe("live");
    expect(offerState({}, "2026-11-30")).toBe("live");
  });
  it("is scheduled before its start and expired the day after its end", () => {
    expect(offerState({ start: "2026-11-10" }, "2026-11-09")).toBe("scheduled");
    expect(offerState({ end: "2026-11-30" }, "2026-12-01")).toBe("expired");
  });
});

describe("format", () => {
  it("formats calendar days without time zone drift", () => {
    expect(formatDay("2026-11-21")).toBe("Nov 21, 2026");
    expect(formatDay("")).toBe("");
  });
  it("formats ranges", () => {
    expect(dateRange("2026-11-21", "")).toBe("Nov 21, 2026");
    expect(dateRange("2026-11-21", "2026-11-21")).toBe("Nov 21, 2026");
    expect(dateRange("2026-12-12", "2026-12-13")).toBe("Dec 12, 2026 – Dec 13, 2026");
    expect(dateRange("", "")).toBe("");
  });
  it("draws stars", () => {
    expect(starsText(4)).toBe("★★★★☆");
  });
});
