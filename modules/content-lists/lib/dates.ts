// Dates for events and offers. Pure: "now" and the time zone are always passed in (rule 21).
// Dates are plain "YYYY-MM-DD" strings; they compare correctly as strings. The calendar and zone maths
// (todayIn, nowIn, isIsoDate) live in the core: src/kit/lib/time.ts.

export interface Dated {
  start?: string;
  end?: string;
  /** Optional "HH:MM" (24h, business time zone) the item ends on its last day. Without it, it lasts all day. */
  end_time?: string;
}

/** The last day an item is on: its end date, else its start date, else "" (never expires). */
export const lastDay = (e: Dated): string => e.end || e.start || "";

/**
 * An item is over once its last day is before today, or, with `end_time`, once that time has passed on its last day.
 * `now` is "YYYY-MM-DD" (start of that day) or "YYYY-MM-DD HH:MM" from `nowIn`. No date: never ends on its own.
 */
export const isPast = (e: Dated, now: string): boolean => {
  const last = lastDay(e);
  if (last === "") return false;
  if (e.end_time) return `${last} ${e.end_time}` <= (now.length > 10 ? now : `${now} 00:00`);
  return last < now.slice(0, 10);
};

/** Upcoming: soonest first, undated last. Past: most recently finished first, at most `pastMax`. */
export function splitEvents<E extends Dated>(list: E[], today: string, pastMax: number): { upcoming: E[]; past: E[] } {
  const upcoming = list
    .filter((e) => !isPast(e, today))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const sa = a.e.start || a.e.end || "9999";
      const sb = b.e.start || b.e.end || "9999";
      return sa < sb ? -1 : sa > sb ? 1 : a.i - b.i;
    })
    .map((x) => x.e);
  const past = list
    .filter((e) => isPast(e, today))
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const la = lastDay(a.e);
      const lb = lastDay(b.e);
      return la < lb ? 1 : la > lb ? -1 : a.i - b.i;
    })
    .map((x) => x.e)
    .slice(0, Math.max(0, pastMax));
  return { upcoming, past };
}

/** Offers: gone after `end`; not shown before `start` (the page reveals it on its start day). */
export function offerState(o: Dated, today: string): "live" | "scheduled" | "expired" {
  if (o.end && o.end < today) return "expired";
  if (o.start && o.start > today) return "scheduled";
  return "live";
}
