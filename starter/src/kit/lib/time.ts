// Calendar and clock maths in the BUSINESS time zone (client.timezone), never the server's (rule 21). Pure:
// "now" is always an argument. One home for every module (rule 1): booking, meal plans, events, forms.
// Kit code: do not edit in a client project.
//
// Dates are ISO calendar days ("2026-11-20"), handled in UTC so DST can never shift a day. Times of day are
// minutes from that day's local midnight (may exceed 1440 for windows that run past midnight).
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

/** Regex source matching one day key, for schemas that accept "mon" or "mon-fri". */
export const DAY_PATTERN = `(${DAYS.join("|")})`;
/** Regex source for one "HH:MM-HH:MM" opening range (24-hour; the end may be 24:00). */
export const TIME_RANGE_PATTERN = "([01]\\d|2[0-3]):[0-5]\\d-([01]\\d|2[0-4]):[0-5]\\d";
/** A 24-hour "HH:MM" time of day (00:00 to 23:59). */
export const HM_24 = /^([01]\d|2[0-3]):[0-5]\d$/;

export const DAY_MS = 86_400_000;
export const utcDay = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

/** True for a real calendar date written as YYYY-MM-DD ("2026-02-30" is not). */
export function isIsoDate(s: unknown): s is string {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return new Date(utcDay(s)).toISOString().slice(0, 10) === s;
}
export const addDays = (iso: string, n: number) => new Date(utcDay(iso) + n * DAY_MS).toISOString().slice(0, 10);
export const weekdayOf = (iso: string): Day => DAYS[(new Date(utcDay(iso)).getUTCDay() + 6) % 7]!;
export const daysBetween = (a: string, b: string) => Math.round((utcDay(b) - utcDay(a)) / DAY_MS);

/** "HH:MM" → minutes, or null. Accepts 24:00. */
export function parseHm(s: unknown): number | null {
  if (typeof s !== "string") return null;
  const m = /^([01]\d|2[0-4]):([0-5]\d)$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return v > 1440 ? null : v;
}
/** minutes → "HH:MM" (wraps past midnight). */
export const hm = (min: number) => {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

const fmts = new Map<string, Intl.DateTimeFormat>();
function partsFmt(tz: string) {
  let f = fmts.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
    fmts.set(tz, f);
  }
  return f;
}

/** The local calendar day and minute-of-day of an instant in a time zone. */
export function zoned(ms: number, tz: string): { date: string; minutes: number } {
  const p: Record<string, string> = {};
  for (const x of partsFmt(tz).formatToParts(new Date(ms))) p[x.type] = x.value;
  const hour = Number(p.hour) % 24; // some engines print 24 for midnight
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: hour * 60 + Number(p.minute) };
}

/** UTC offset of a time zone at an instant, in ms (local = utc + offset). */
function offsetAt(ms: number, tz: string): number {
  const z = zoned(ms, tz);
  const floor = ms - (((ms % 60_000) + 60_000) % 60_000);
  return utcDay(z.date) + z.minutes * 60_000 - floor;
}

/**
 * The instant at local `date` + `minutes` in `tz`. DST-safe:
 * - a local time that doesn't exist (the hour skipped in spring) → null (no slot then)
 * - a local time that happens twice (the hour repeated in autumn) → the first one
 */
export function localToUtc(date: string, minutes: number, tz: string): number | null {
  const wall = utcDay(date) + minutes * 60_000; // the wall-clock reading, as if it were UTC
  const want = zoned(wall, "UTC");
  const found: number[] = [];
  for (const probe of [wall - DAY_MS, wall, wall + DAY_MS]) {
    const t = wall - offsetAt(probe, tz);
    const z = zoned(t, tz);
    if (z.date === want.date && z.minutes === want.minutes && !found.includes(t)) found.push(t);
  }
  return found.length ? Math.min(...found) : null;
}

/** Today's date (YYYY-MM-DD) where the business is, e.g. `todayIn("Asia/Dubai", new Date())`. */
export const todayIn = (tz: string, now: Date | number) => zoned(typeof now === "number" ? now : now.getTime(), tz).date;

/** "Now" in the business time zone as "YYYY-MM-DD HH:MM" (sorts and compares correctly as a string). */
export function nowIn(tz: string, now: Date | number): string {
  const z = zoned(typeof now === "number" ? now : now.getTime(), tz);
  return `${z.date} ${hm(z.minutes)}`;
}

/** Midnight-to-midnight of a local day, as UTC instants. */
export function dayBounds(date: string, tz: string): { from: number; to: number } {
  // midnight always exists except in a few zones that jump at 00:00; fall back to the first minute that does
  const first = (d: string) => {
    for (let m = 0; m < 180; m += 15) {
      const t = localToUtc(d, m, tz);
      if (t !== null) return t;
    }
    return utcDay(d);
  };
  return { from: first(date), to: first(addDays(date, 1)) };
}
