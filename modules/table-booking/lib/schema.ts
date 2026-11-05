// table-booking's client.yaml block and its CMS document (the section's wording). Pure: no client values here.
import { z } from "zod";
import { EnquiryLink, SitePath, SmallPrint, SuccessConfirmed } from "../../booking-core/lib/schema.ts";
import { BlackoutDate, OpeningHours } from "../../booking-core/lib/slots.ts";

export const TableGroup = z.strictObject({
  /** Seats at each table in this group. A party is seated at the smallest table that fits. Tables aren't joined. */
  seats: z.number().int().min(1).max(50),
  count: z.number().int().min(1).max(500),
  name: z.string().min(1).optional(),
});


export const TableBookingConfig = z
  .strictObject({
    /** D6: auto = confirmed at once if there's room; approve = a request held for staff to accept or decline. */
    mode: z.enum(["auto", "approve"]).default("auto"),
    /** approve mode: how long a request holds its seats while staff decide (then the time is released). */
    hold_minutes: z.number().int().min(5).max(10_080).default(120),
    /** label in emails and the admin */
    label: z.string().min(1).default("Table"),
    /**
     * covers: one pool of seats; `covers_per_slot` = most guests booked in at the same moment (overlapping bookings add up).
     * tables: table groups; each booking takes one table that seats the party.
     */
    capacity_model: z.enum(["covers", "tables"]).default("covers"),
    covers_per_slot: z.number().int().min(0).max(5000).default(0),
    tables: z.array(TableGroup).default([]),
    /** Start times are this far apart. */
    slot_minutes: z.number().int().min(5).max(240).multipleOf(5).default(15),
    /** How long a table is kept for a booking. */
    duration_minutes: z.number().int().min(15).max(720).default(90),
    party_size: z.strictObject({ min: z.number().int().min(1).default(1), max: z.number().int().min(1).max(500).default(8) }).prefault({}),
    /** Bigger parties are sent to an enquiry instead of booking online. Default: party_size.max. */
    large_party_enquiry_over: z.number().int().min(1).optional(),
    /** Where large parties (and visitors without JavaScript) go. */
    enquiry_url: SitePath.default("/contact"),
    /** No online bookings closer than this to the start. */
    lead_time_minutes: z.number().int().min(0).max(20_160).default(60),
    max_days_ahead: z.number().int().min(0).max(730).default(60),
    /** ARRIVAL times, e.g. `mon-fri: "12:00-14:30, 18:00-21:30"` (last seating 21:30). Default: client.hours. */
    opening_hours: OpeningHours.optional(),
    blackout_dates: z.array(BlackoutDate).default([]),
  })
  .superRefine((c, ctx) => {
    if (c.party_size.min > c.party_size.max) ctx.addIssue({ code: "custom", path: ["party_size"], message: "min is larger than max" });
    if (c.large_party_enquiry_over !== undefined && c.large_party_enquiry_over > c.party_size.max)
      ctx.addIssue({ code: "custom", path: ["large_party_enquiry_over"], message: `can't be more than party_size.max (${c.party_size.max})` });
    if (c.large_party_enquiry_over !== undefined && c.large_party_enquiry_over < c.party_size.min)
      ctx.addIssue({ code: "custom", path: ["large_party_enquiry_over"], message: `can't be less than party_size.min (${c.party_size.min})` });
    const seats = c.tables.map((t) => t.seats);
    seats.forEach((s, i) => seats.indexOf(s) !== i && ctx.addIssue({ code: "custom", path: ["tables", i, "seats"], message: `two groups of ${s}-seat tables: merge them (add up the count)` }));
    if (c.capacity_model === "tables" && c.covers_per_slot) ctx.addIssue({ code: "custom", path: ["covers_per_slot"], message: "only used with capacity_model: covers" });
    if (c.capacity_model === "covers" && c.tables.length) ctx.addIssue({ code: "custom", path: ["tables"], message: "only used with capacity_model: tables" });
  })
  .prefault({});
export type TableBookingConfig = z.infer<typeof TableBookingConfig>;

/** Largest party that can book online. */
export const onlineMax = (c: TableBookingConfig) => c.large_party_enquiry_over ?? c.party_size.max;

/** Build warnings (the build still passes). */
export function tableWarnings(c: TableBookingConfig): string[] {
  const out: string[] = [];
  if (c.capacity_model === "covers" && c.covers_per_slot === 0) out.push("covers_per_slot is 0: the table-booking section is hidden until it is set");
  if (c.capacity_model === "tables" && !c.tables.length) out.push("no tables: the table-booking section is hidden until `tables` is set");
  if (c.capacity_model === "covers" && c.covers_per_slot && c.covers_per_slot < onlineMax(c)) out.push(`covers_per_slot (${c.covers_per_slot}) is smaller than the largest online party (${onlineMax(c)})`);
  const biggest = Math.max(0, ...c.tables.map((t) => t.seats));
  if (c.capacity_model === "tables" && c.tables.length && biggest < onlineMax(c)) out.push(`the largest table seats ${biggest} but parties up to ${onlineMax(c)} can book online: they will always see "no free times"`);
  if (c.duration_minutes % c.slot_minutes) out.push(`duration_minutes (${c.duration_minutes}) isn't a multiple of slot_minutes (${c.slot_minutes}): fine, but tables free up between slots`);
  return out;
}

/** CMS document "table_booking": the section's wording, edited by the client. */
export const TableBookingDoc = z.strictObject({
  title: z.string().default("Book a table"),
  intro: z.string().default(""),
  small_print: SmallPrint,
  success_confirmed: SuccessConfirmed,
  success_pending: z.string().min(1).meta({ help: "Shown after a request (approve mode). Say clearly that it is NOT confirmed yet." }),
  large_party: z.string().min(1).meta({ help: "Shown when a group is too big to book online, next to the enquiry link" }),
  enquiry_link: EnquiryLink,
  no_js: z.string().min(1).meta({ help: "Shown when the booking widget can't run: point people to the phone or the enquiry form" }),
});
export type TableBookingDoc = z.infer<typeof TableBookingDoc>;
