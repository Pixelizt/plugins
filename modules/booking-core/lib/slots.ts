// Bookable start times for a day, from opening hours + slot length + lead time + horizon + closed dates, in the
// business time zone. Pure and shared by the widgets (to show the calendar) and the server (to accept a time).
import { z } from "zod";
import { DAYS, DAY_PATTERN as DAY, TIME_RANGE_PATTERN as RANGE, addDays, daysBetween, hm, isIsoDate, localToUtc, parseHm, todayIn, weekdayOf, type Day } from "../../../kit/lib/time.ts";

/** `mon-fri: "12:00-15:00, 18:00-21:30"`, `sun: closed`. A later line wins for the days it names. */
export const OpeningHours = z.record(
  z.string().regex(new RegExp(`^${DAY}(-${DAY})?$`), 'use a day or a range like "mon-fri" or "sat"'),
  z.string().regex(new RegExp(`^\\s*(closed|${RANGE}(\\s*,\\s*${RANGE})*)\\s*$`), 'use "HH:MM-HH:MM" (24-hour), several separated by commas, or "closed"'),
);
export type OpeningHours = z.infer<typeof OpeningHours>;

/** "2026-12-25" or a range "2026-12-24..2026-12-26" (inclusive). */
export const BlackoutDate = z.string().refine((s) => {
  const [a, b, extra] = s.split("..");
  if (extra !== undefined || !isIsoDate(a)) return false;
  return b === undefined || (isIsoDate(b) && b >= a!);
}, 'use a date like "2026-12-25" or a range like "2026-12-24..2026-12-26"');

export interface SlotRules {
  hours: OpeningHours;
  slot_minutes: number;
  lead_time_minutes: number;
  max_days_ahead: number;
  blackout_dates: string[];
  /**
   * "start": the hours are ARRIVAL times; the last slot is the end of the range (tables: "12:00-21:30" = last seating 21:30).
   * "whole": the whole booking must fit inside the hours (spaces).
   */
  fit: "start" | "whole";
}

export interface Window { from: number; to: number } // minutes from local midnight; `to` may pass 1440

/** Expands day keys ("fri-mon" wraps) to the days they name. */
export function daysOf(key: string): Day[] {
  const [a, b] = key.split("-") as [Day, Day | undefined];
  if (!b) return [a];
  const out: Day[] = [];
  for (let i = DAYS.indexOf(a); ; i = (i + 1) % 7) {
    out.push(DAYS[i]!);
    if (DAYS[i] === b) return out;
  }
}

/** The opening windows of a weekday. An end at or before the start means "past midnight". */
export function windowsFor(hours: OpeningHours, day: Day): Window[] {
  let spec: string | undefined;
  for (const [k, v] of Object.entries(hours)) if (daysOf(k).includes(day)) spec = v; // later keys win
  if (!spec || spec.trim() === "closed") return [];
  return spec.split(",").map((r) => {
    const [a, b] = r.trim().split("-");
    const from = parseHm(a)!;
    let to = parseHm(b)!;
    if (to <= from) to += 1440;
    return { from, to };
  });
}

export function isBlackout(date: string, blackout: string[]): boolean {
  return blackout.some((s) => {
    const [a, b] = s.split("..") as [string, string | undefined];
    return b === undefined ? date === a : date >= a && date <= b;
  });
}

export type DateProblem = "invalid" | "past" | "too_far" | "closed";

/** Can this day be booked at all? (Not "are there free times", which needs the bookings.) */
export function checkDate(rules: SlotRules, date: unknown, tz: string, now: Date, opts: { staff?: boolean } = {}): DateProblem | null {
  if (!isIsoDate(date)) return "invalid";
  const today = todayIn(tz, now);
  const ahead = daysBetween(today, date);
  if (ahead < 0) return "past";
  if (!opts.staff && ahead > rules.max_days_ahead) return "too_far";
  if (isBlackout(date, rules.blackout_dates) || windowsFor(rules.hours, weekdayOf(date)).length === 0) return "closed";
  return null;
}

/** First and last bookable dates (for the date picker). */
export function dateRange(rules: SlotRules, tz: string, now: Date): { min: string; max: string } {
  const min = todayIn(tz, now);
  return { min, max: addDays(min, rules.max_days_ahead) };
}

export interface Slot { time: string; start: number; end: number }

/**
 * Start times on `date` for a booking of `duration` minutes. Times the clock skips at a DST change are left out.
 * Staff (phone bookings) skip the lead time and horizon; closed days and hours still apply.
 */
export function slotsFor(rules: SlotRules, date: string, duration: number, tz: string, now: Date, opts: { staff?: boolean } = {}): Slot[] {
  if (checkDate(rules, date, tz, now, opts)) return [];
  const earliest = now.getTime() + (opts.staff ? 0 : rules.lead_time_minutes) * 60_000;
  const out: Slot[] = [];
  const seen = new Set<number>();
  for (const w of windowsFor(rules.hours, weekdayOf(date))) {
    const last = rules.fit === "start" ? w.to : w.to - duration;
    for (let m = w.from; m <= last; m += rules.slot_minutes) {
      const start = localToUtc(date, m, tz);
      if (start === null || seen.has(start) || start < earliest) continue;
      seen.add(start);
      out.push({ time: hm(m), start, end: start + duration * 60_000 });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}
