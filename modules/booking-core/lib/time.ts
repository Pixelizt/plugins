// Booking-facing date wording in the business time zone (client.timezone). The calendar and clock maths live in
// the core (src/kit/lib/time.ts); this file only turns instants into the sentences emails and widgets show.
import { hm, utcDay, zoned } from "../../../kit/lib/time.ts";

/** "Friday 20 November 2026" for a calendar day. */
export function formatDay(iso: string, locale = "en-GB"): string {
  // assembled from parts: ICU versions disagree about the comma after the weekday
  const p: Record<string, string> = {};
  for (const x of new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).formatToParts(new Date(utcDay(iso)))) p[x.type] = x.value;
  return `${p.weekday} ${p.day} ${p.month} ${p.year}`;
}

/** "Friday 20 November 2026, 19:00" in the business time zone. */
export function formatInstant(t: number, tz: string, locale = "en-GB"): string {
  const z = zoned(t, tz);
  return `${formatDay(z.date, locale)}, ${hm(z.minutes)}`;
}

/** "Friday 20 November 2026, 19:00 to 20:30" in the business time zone. */
export function formatSpan(start: number, end: number, tz: string, locale = "en-GB"): string {
  const s = zoned(start, tz);
  const e = zoned(end, tz);
  return `${formatDay(s.date, locale)}, ${hm(s.minutes)} to ${hm(e.minutes)}${e.date !== s.date ? ` (${formatDay(e.date, locale)})` : ""}`;
}
