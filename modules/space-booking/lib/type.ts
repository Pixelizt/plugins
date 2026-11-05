// The "space" booking type (booking-core contract). Pure. A space is booked whole (capacity 1 unit), with a
// buffer between bookings; the guest count is checked against the space's own limit.
import { intOf, type Ask, type BookingType, type Resolved, type Unresolved } from "../../booking-core/lib/schema.ts";
import { windowsFor, type OpeningHours, type SlotRules } from "../../booking-core/lib/slots.ts";
import { DAYS } from "../../../kit/lib/time.ts";
import { durationsOf, hoursText, type SpaceBookingConfig, type SpaceDef } from "./schema.ts";

export const spaceId = (s: Pick<SpaceDef, "id">) => `space:${s.id}`;

export function spaceRules(c: SpaceBookingConfig, s: SpaceDef, clientHours: OpeningHours): SlotRules {
  return {
    hours: s.opening_hours ?? c.opening_hours ?? clientHours,
    slot_minutes: c.slot_minutes,
    lead_time_minutes: c.lead_time_minutes,
    max_days_ahead: c.max_days_ahead,
    blackout_dates: c.blackout_dates,
    fit: "whole",
  };
}

/** Add-on keys from the request: an array or a comma list; only configured keys. null = something unknown. */
export function addonsOf(c: SpaceBookingConfig, raw: unknown): string[] | null {
  if (raw === undefined || raw === null || raw === "") return [];
  const list = Array.isArray(raw) ? raw : typeof raw === "string" ? raw.split(",") : null;
  if (!list || list.length > 50) return null;
  const keys = [...new Set(list.map((x) => (typeof x === "string" ? x.trim() : "")))];
  return keys.every((k) => c.addons.some((a) => a.key === k)) ? keys : null;
}

export function spaceType(c: SpaceBookingConfig, clientHours: OpeningHours): BookingType {
  const usable = c.spaces.filter((s) => DAYS.some((d) => windowsFor(spaceRules(c, s, clientHours).hours, d).length > 0));
  return {
    kind: "space",
    label: c.label,
    configured: usable.length > 0,
    resolve(ask: Ask, opts = {}): Resolved | Unresolved {
      const s = usable.find((x) => x.id === ask.space);
      if (!s) return { ok: false, error: "Please choose a space.", field: "space" };
      const duration = intOf(ask.duration);
      const allowed = durationsOf(s, c.slot_minutes);
      if (duration === null || !allowed.includes(duration)) return { ok: false, error: `Please choose a length from ${hoursText(allowed[0]!)} to ${hoursText(allowed.at(-1)!)}.`, field: "duration" };
      // guests are optional for availability (the times don't depend on them), required to book
      const guests = ask.party === undefined || ask.party === "" ? (ask.time === undefined ? s.min_guests : null) : intOf(ask.party);
      if (guests === null || guests < s.min_guests) return { ok: false, error: `Please enter the number of guests (from ${s.min_guests}).`, field: "party" };
      if (guests > s.capacity)
        return opts.staff
          ? { ok: false, error: `${s.name} holds up to ${s.capacity} guests.`, field: "party" }
          : { ok: false, error: `${s.name} holds up to ${s.capacity} guests. For a bigger group, please send us an enquiry.`, field: "party", enquiry: c.enquiry_url };
      const occasion = typeof ask.occasion === "string" ? ask.occasion.trim() : "";
      if (occasion && !c.occasions.includes(occasion)) return { ok: false, error: "Please choose an occasion from the list.", field: "occasion" };
      const addons = addonsOf(c, ask.addons);
      if (!addons) return { ok: false, error: "Please choose extras from the list.", field: "addons" };
      const addonLabels = addons.map((k) => c.addons.find((a) => a.key === k)!.label);
      // facts are built from config text only, so they are safe to show in the customer's email (rule 9)
      const facts: [string, string][] = [["Space", s.name], ["Guests", String(guests)], ["Length", hoursText(duration)]];
      if (occasion) facts.push(["Occasion", occasion]);
      if (addonLabels.length) facts.push(["Extras requested", addonLabels.join(", ")]);
      return {
        ok: true,
        rules: spaceRules(c, s, clientHours),
        duration,
        candidates: [{ id: spaceId(s), kind: "space", name: s.name, capacity: 1, buffer_minutes: c.buffer_minutes }],
        units: 1,
        party_size: guests,
        mode: c.mode,
        hold_minutes: c.hold_minutes,
        facts,
        fields: { ...(occasion ? { occasion } : {}), ...(addons.length ? { addons: addons.join(",") } : {}) },
      };
    },
    describe: () => ({
      kind: "space",
      label: c.label,
      slot_minutes: c.slot_minutes,
      party: null,
      spaces: usable.map((s) => ({ id: s.id, name: s.name, capacity: s.capacity, min_guests: s.min_guests, min_minutes: s.min_hours * 60, max_minutes: s.max_hours * 60 })),
    }),
  };
}
