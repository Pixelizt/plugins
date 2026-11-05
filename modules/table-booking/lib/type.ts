// The "table" booking type (booking-core contract). Pure: config in, decisions out.
import type { Resource } from "../../booking-core/lib/capacity.ts";
import { intOf, type Ask, type BookingType, type Resolved, type Unresolved } from "../../booking-core/lib/schema.ts";
import { windowsFor, type OpeningHours, type SlotRules } from "../../booking-core/lib/slots.ts";
import { DAYS } from "../../../kit/lib/time.ts";
import { onlineMax, type TableBookingConfig } from "./schema.ts";

export const COVERS_ID = "table:covers";
export const groupId = (seats: number) => `table:${seats}-seats`;

export function tableRules(c: TableBookingConfig, clientHours: OpeningHours): SlotRules {
  return {
    hours: c.opening_hours ?? clientHours,
    slot_minutes: c.slot_minutes,
    lead_time_minutes: c.lead_time_minutes,
    max_days_ahead: c.max_days_ahead,
    blackout_dates: c.blackout_dates,
    fit: "start",
  };
}

/** Resources a party could use, in the order they're tried: the covers pool, or table groups smallest first. */
export function candidatesFor(c: TableBookingConfig, party: number): Resource[] {
  if (c.capacity_model === "covers") return [{ id: COVERS_ID, kind: "table", name: "Covers", capacity: c.covers_per_slot, buffer_minutes: 0 }];
  return c.tables
    .filter((g) => g.seats >= party)
    .sort((a, b) => a.seats - b.seats)
    .map((g) => ({ id: groupId(g.seats), kind: "table", name: g.name ?? `${g.seats}-seat tables`, capacity: g.count, buffer_minutes: 0 }));
}

export function tableType(c: TableBookingConfig, clientHours: OpeningHours): BookingType {
  const rules = tableRules(c, clientHours);
  const open = DAYS.some((d) => windowsFor(rules.hours, d).length > 0);
  const configured = open && (c.capacity_model === "covers" ? c.covers_per_slot > 0 : c.tables.length > 0);
  const max = onlineMax(c);
  // staff may book any party that fits somewhere (a phone call already handled the "big group" conversation)
  const staffMax = c.capacity_model === "covers" ? c.covers_per_slot : Math.max(0, ...c.tables.map((t) => t.seats));
  return {
    kind: "table",
    label: c.label,
    configured,
    resolve(ask: Ask, opts = {}): Resolved | Unresolved {
      const party = intOf(ask.party);
      if (party === null || party < c.party_size.min) return { ok: false, error: `Please choose the number of guests (from ${c.party_size.min}).`, field: "party" };
      if (party > (opts.staff ? staffMax : max)) {
        return opts.staff
          ? { ok: false, error: `No table or capacity for ${party} guests.`, field: "party" }
          : { ok: false, error: `For more than ${max} guests, please send us an enquiry.`, field: "party", enquiry: c.enquiry_url };
      }
      const candidates = candidatesFor(c, party);
      if (!candidates.length) return { ok: false, error: `For ${party} guests, please send us an enquiry.`, field: "party", enquiry: c.enquiry_url };
      return {
        ok: true,
        rules,
        duration: c.duration_minutes,
        candidates,
        units: c.capacity_model === "covers" ? party : 1,
        party_size: party,
        mode: c.mode,
        hold_minutes: c.hold_minutes,
        facts: [["Guests", String(party)]],
        fields: {},
      };
    },
    describe: () => ({ kind: "table", label: c.label, slot_minutes: c.slot_minutes, party: { min: c.party_size.min, max: Math.max(max, staffMax) }, spaces: null }),
  };
}
