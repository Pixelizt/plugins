// Display formatting (pure). English only (D4).
const fmt = new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** "2026-11-21" → "Nov 21, 2026". Dates are calendar dates, so UTC avoids any shift. */
export const formatDay = (iso: string): string => (iso ? fmt.format(new Date(`${iso}T00:00:00Z`)) : "");

/** One day, or "start – end" for a range. */
export function dateRange(start: string, end: string): string {
  if (!start && !end) return "";
  if (!end || end === start) return formatDay(start || end);
  if (!start) return formatDay(end);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** Stars as text: "★★★★☆". */
export const starsText = (n: number): string => "★".repeat(n) + "☆".repeat(5 - n);
