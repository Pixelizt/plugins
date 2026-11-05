// space-booking's client.yaml block (spaces, rules, occasions, add-ons) and its CMS document (descriptions,
// photos, wording). Pure: no client values here. Prices are display-only: nothing is paid online (D3).
import { z } from "zod";
import { EnquiryLink, SitePath, SmallPrint, SuccessConfirmed } from "../../booking-core/lib/schema.ts";
import { BlackoutDate, OpeningHours } from "../../booking-core/lib/slots.ts";

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase letters, digits and dashes, like rooftop or back-room");
const key = z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case key like cake or decor");
const hours = z.number().min(0.5).max(24).refine((h) => Number.isInteger(h * 4), "use quarter hours (1, 1.5, 2.25…)");

export const SpaceDef = z.strictObject({
  id,
  name: z.string().min(1),
  /** Most guests the space holds. */
  capacity: z.number().int().min(1).max(5000),
  min_guests: z.number().int().min(1).default(1),
  /** Shortest and longest booking, in hours. */
  min_hours: hours.default(2),
  max_hours: hours.default(4),
  /** Shown as a guide only: no payment is taken online (D3). */
  price_per_hour: z.number().min(0).optional(),
  /** When this space can be used, if different from the module's opening_hours. */
  opening_hours: OpeningHours.optional(),
});

export const AddonDef = z.strictObject({ key, label: z.string().min(1) });

export const SpaceBookingConfig = z
  .strictObject({
    /** D6: approve = a request held for staff (usual for spaces); auto = confirmed at once if free. */
    mode: z.enum(["auto", "approve"]).default("approve"),
    hold_minutes: z.number().int().min(5).max(20_160).default(2880),
    label: z.string().min(1).default("Space"),
    /** Gap kept free between two bookings of the same space (set-up, cleaning). */
    buffer_minutes: z.number().int().min(0).max(1440).default(30),
    /** Start times are this far apart; lengths go up in the same steps. */
    slot_minutes: z.number().int().min(15).max(240).multipleOf(15).default(30),
    lead_time_minutes: z.number().int().min(0).max(43_200).default(1440),
    max_days_ahead: z.number().int().min(0).max(730).default(180),
    /** When spaces can be used: the WHOLE booking must fit inside. Default: client.hours. */
    opening_hours: OpeningHours.optional(),
    blackout_dates: z.array(BlackoutDate).default([]),
    spaces: z.array(SpaceDef).default([]),
    /** Choices for "What's the occasion?" (empty = the question isn't asked). */
    occasions: z.array(z.string().min(1).max(60)).default([]),
    /** Extras the customer can ask for (requests only; staff confirm them). */
    addons: z.array(AddonDef).default([]),
    /** Where bigger groups and visitors without JavaScript go. */
    enquiry_url: SitePath.default("/contact"),
  })
  .superRefine((c, ctx) => {
    const ids = c.spaces.map((s) => s.id);
    ids.forEach((s, i) => ids.indexOf(s) !== i && ctx.addIssue({ code: "custom", path: ["spaces", i, "id"], message: `space id "${s}" is used twice` }));
    c.spaces.forEach((s, i) => {
      if (s.min_hours > s.max_hours) ctx.addIssue({ code: "custom", path: ["spaces", i, "max_hours"], message: "is smaller than min_hours" });
      if (s.min_guests > s.capacity) ctx.addIssue({ code: "custom", path: ["spaces", i, "min_guests"], message: "is larger than capacity" });
      for (const h of [s.min_hours, s.max_hours]) if ((h * 60) % c.slot_minutes) ctx.addIssue({ code: "custom", path: ["spaces", i], message: `hours (${h}) must be whole steps of slot_minutes (${c.slot_minutes} minutes)` });
    });
    const keys = c.addons.map((a) => a.key);
    keys.forEach((k, i) => keys.indexOf(k) !== i && ctx.addIssue({ code: "custom", path: ["addons", i, "key"], message: `add-on key "${k}" is used twice` }));
  })
  .prefault({});
export type SpaceBookingConfig = z.infer<typeof SpaceBookingConfig>;
export type SpaceDef = z.infer<typeof SpaceDef>;

/** Allowed lengths of a booking of this space, in minutes. */
export const durationsOf = (s: SpaceDef, slot: number) => {
  const out: number[] = [];
  for (let m = s.min_hours * 60; m <= s.max_hours * 60; m += slot) out.push(m);
  return out;
};

export const hoursText = (min: number) => {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(2).replace(/0$/, "")} ${h === 1 ? "hour" : "hours"}`;
};

const Image = z.strictObject({ src: z.string().min(1), alt: z.string().default("") });

/** CMS document "spaces": what the client edits. Spaces themselves (capacity, hours) are config. */
export const SpacesDoc = z.strictObject({
  title: z.string().default("Book a space"),
  intro: z.string().default(""),
  small_print: SmallPrint,
  success_confirmed: SuccessConfirmed,
  success_pending: z.string().min(1).meta({ help: "Shown after a request (approve mode). Say clearly that it is NOT confirmed yet and nothing has been paid." }),
  price_note: z.string().default("").meta({ help: "Shown under prices, e.g. that they're a guide and nothing is paid online" }),
  enquiry_link: EnquiryLink,
  no_js: z.string().min(1),
  spaces: z.array(z.strictObject({
    id: z.string().min(1).meta({ help: "Must match a space id in client.yaml → modules.space-booking.spaces" }),
    description: z.string().default("").meta({ widget: "textarea" }),
    images: z.array(Image).default([]),
    sample: z.boolean().optional(),
  }).meta({ itemLabel: "id" })).default([]),
});
export type SpacesDoc = z.infer<typeof SpacesDoc>;

export function spaceWarnings(c: SpaceBookingConfig, doc: SpacesDoc): string[] {
  const out: string[] = [];
  if (!c.spaces.length) out.push("no spaces in client.yaml → modules.space-booking.spaces: the space-booking section is hidden");
  for (const d of doc.spaces) if (!c.spaces.some((s) => s.id === d.id)) out.push(`the "spaces" document describes "${d.id}", which isn't a space in client.yaml`);
  return out;
}
