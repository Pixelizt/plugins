// Capacity maths. Pure. MUST match the database functions booking_peak / create_booking in
// migrations/0001_bookings.sql: the database decides for real (under a lock); this copy only shows the visitor
// which times are free, so a mismatch shows a time that then fails with "just filled up", never a double booking.
import type { Slot } from "./slots.ts";

export type Kind = "table" | "space";
export type Status = "pending" | "confirmed" | "declined" | "cancelled" | "expired";
export const STATUSES: Status[] = ["pending", "confirmed", "declined", "cancelled", "expired"];

/**
 * Something bookable. `capacity` is in `units`: covers (seats) for the covers model, tables for a table group,
 * 1 for a space (a space is booked whole; its guest limit is checked separately).
 */
export interface Resource { id: string; kind: Kind; name: string; capacity: number; buffer_minutes: number }

/** What the availability query needs from a booking: no personal data. Times are ISO strings or ms. */
export interface Occupancy { resource_id: string; starts_at: string | number; ends_at: string | number; units: number; status: Status; hold_until: string | number | null }

/** Staff closures. A null kind/resource_id means "all". */
export interface Block { kind: Kind | null; resource_id: string | null; starts_at: string | number; ends_at: string | number }

const ms = (v: string | number) => (typeof v === "number" ? v : Date.parse(v));

/** A booking holds capacity when confirmed, or pending with a hold that hasn't run out (lazy expiry). */
export function holdsCapacity(o: Pick<Occupancy, "status" | "hold_until">, now: number): boolean {
  return o.status === "confirmed" || (o.status === "pending" && o.hold_until !== null && ms(o.hold_until) > now);
}

/**
 * The most units in use at any moment of [start, end + buffer) on one resource. Each booking occupies
 * [starts_at, ends_at + buffer): two bookings on a resource with a buffer must be `buffer` minutes apart.
 * Exact (not "sum of everything overlapping"): a 17:00 and a 19:00 booking that don't meet don't add up.
 */
export function peakUnits(occ: Occupancy[], resourceId: string, start: number, end: number, bufferMinutes: number, now: number): number {
  const buf = bufferMinutes * 60_000;
  const hits = occ
    .filter((o) => o.resource_id === resourceId && holdsCapacity(o, now))
    .map((o) => ({ s: ms(o.starts_at), e: ms(o.ends_at) + buf, u: o.units }))
    .filter((o) => o.s < end + buf && o.e > start);
  const points = [start, ...hits.map((o) => o.s).filter((s) => s > start)];
  let peak = 0;
  for (const t of points) {
    let sum = 0;
    for (const o of hits) if (o.s <= t && o.e > t) sum += o.u;
    peak = Math.max(peak, sum);
  }
  return peak;
}

export function isBlocked(blocks: Block[], res: Pick<Resource, "id" | "kind">, start: number, end: number): boolean {
  return blocks.some((b) => (b.kind === null || b.kind === res.kind) && (b.resource_id === null || b.resource_id === res.id) && ms(b.starts_at) < end && ms(b.ends_at) > start);
}

/** The first candidate (in order) with room, as create_booking chooses. */
export function pickResource(candidates: Resource[], occ: Occupancy[], blocks: Block[], start: number, end: number, units: number, now: number): Resource | null {
  for (const r of candidates) {
    if (isBlocked(blocks, r, start, end)) continue;
    if (peakUnits(occ, r.id, start, end, r.buffer_minutes, now) + units <= r.capacity) return r;
  }
  return null;
}

/** The slots at which at least one candidate has room. */
export function freeSlots(slots: Slot[], candidates: Resource[], occ: Occupancy[], blocks: Block[], units: number, now: number): Slot[] {
  return slots.filter((s) => pickResource(candidates, occ, blocks, s.start, s.end, units, now) !== null);
}

/** Allowed status changes (the database enforces the same in set_booking_status). */
export function canMove(from: Status, to: Status): boolean {
  if (from === to) return true;
  if (from === "pending" || from === "expired") return to === "confirmed" || to === "declined" || to === "cancelled";
  if (from === "confirmed") return to === "cancelled";
  return false;
}
