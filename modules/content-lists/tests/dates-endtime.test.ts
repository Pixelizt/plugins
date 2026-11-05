import { describe, expect, it } from "vitest";
import { nowIn } from "../../../kit/lib/time.ts";
import { isPast, splitEvents } from "../lib/dates.ts";

describe("event end time", () => {
  it("formats now in the business time zone", () => {
    expect(nowIn("Asia/Dubai", new Date("2026-11-05T19:30:00Z"))).toBe("2026-11-05 23:30");
  });
  it("without end_time an event lasts its whole last day", () => {
    expect(isPast({ start: "2026-11-05" }, "2026-11-05 23:59")).toBe(false);
    expect(isPast({ start: "2026-11-05" }, "2026-11-06 00:00")).toBe(true);
  });
  it("with end_time it ends at that time on its last day", () => {
    const e = { start: "2026-11-05", end_time: "22:00" };
    expect(isPast(e, "2026-11-05 21:59")).toBe(false);
    expect(isPast(e, "2026-11-05 22:00")).toBe(true);
    expect(isPast(e, "2026-11-05")).toBe(false); // a date alone means the start of that day
    expect(splitEvents([e], "2026-11-05 22:30", 6).past).toEqual([e]);
  });
});
