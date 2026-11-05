// booking-core's client.yaml block, the contact fields every booking asks for, and the contract a booking type
// (table-booking, space-booking) implements. Pure: no client values in here.
import { z } from "zod";
import { FieldDef } from "../../forms/lib/schema.ts";
import type { Kind, Resource } from "./capacity.ts";
import type { SlotRules } from "./slots.ts";

/** Fixed wording of one customer email. Never visitor text (rule 9); say what it is NOT (rule 18). */
export const Wording = z.strictObject({
  subject: z.string().min(1),
  heading: z.string().min(1),
  body: z.array(z.string().min(1)).min(1),
});
export type Wording = z.infer<typeof Wording>;

export const EMAIL_KINDS = ["received", "confirmed", "declined", "cancelled", "reminder", "expired"] as const;
export type EmailKind = (typeof EMAIL_KINDS)[number];

/** Generic defaults. A client's own wording goes in client.yaml → modules.booking-core.emails. */
export const DEFAULT_WORDING: Record<EmailKind, Wording> = {
  received: {
    subject: "We've received your booking request",
    heading: "Booking request received",
    body: [
      "Thank you. This is a request only: your booking is NOT confirmed yet.",
      "We'll check and email you to confirm or decline it. Please don't treat it as booked until you hear from us.",
    ],
  },
  confirmed: {
    subject: "Your booking is confirmed",
    heading: "You're booked in",
    body: ["Your booking is confirmed. We look forward to seeing you."],
  },
  declined: {
    subject: "We can't take your booking",
    heading: "Sorry, we can't take this booking",
    body: ["We're sorry, we can't accept this booking request, so nothing has been booked.", "You're welcome to choose another time on our website or to call us."],
  },
  cancelled: {
    subject: "Your booking is cancelled",
    heading: "Booking cancelled",
    body: ["Your booking has been cancelled. There's nothing else you need to do."],
  },
  reminder: {
    subject: "See you tomorrow",
    heading: "A reminder of your booking",
    body: ["This is a friendly reminder of your booking tomorrow."],
  },
  expired: {
    subject: "Your booking request has expired",
    heading: "We couldn't confirm your request in time",
    body: [
      "We're sorry: your booking request wasn't confirmed in time, so nothing has been booked.",
      "You're welcome to choose another time on our website or to call us.",
    ],
  },
};

export const BookingCoreConfig = z
  .strictObject({
    /** D17: bookings are deleted this many days after they END. Must match the privacy policy. */
    retention_days: z.number().int().min(1).max(3650).default(100),
    /** Online bookings per visitor (hashed IP) per window. */
    rate_limit: z.strictObject({ max: z.number().int().min(1).default(5), window_minutes: z.number().int().min(1).default(10) }).prefault({}),
    /** Ask for a phone number on online bookings (email is always required: the confirmation goes there). */
    require_phone: z.boolean().default(true),
    /** Daily cron: email tomorrow's confirmed bookings a reminder. */
    reminders: z.boolean().default(true),
    /** Daily cron: tell customers whose request ran out unanswered (approve mode) that nothing was booked. */
    notify_expired: z.boolean().default(true),
    /** A customer can cancel online until this many minutes before the start; after that the link says "call us". */
    customer_cancel_minutes: z.number().int().min(0).max(43_200).default(0),
    /** Replace any customer email's wording. Whatever isn't given keeps the default. */
    emails: z.strictObject(Object.fromEntries(EMAIL_KINDS.map((k) => [k, Wording.optional()])) as Record<EmailKind, z.ZodOptional<typeof Wording>>).prefault({}),
  })
  .prefault({});
export type BookingCoreConfig = z.infer<typeof BookingCoreConfig>;

export const wordingFor = (conf: BookingCoreConfig, kind: EmailKind): Wording => conf.emails[kind] ?? DEFAULT_WORDING[kind];

// ---------- contact details: the forms module's field rules (rule 1), keys fixed forever (rule 17) ----------

export const DETAIL_KEYS = ["name", "email", "phone", "notes"] as const;
export type Details = Partial<Record<(typeof DETAIL_KEYS)[number], string>>;

/** Online: name + email (the confirmation goes there) required; phone per config. Staff: only the name. */
export function detailFields(opts: { staff?: boolean; phoneRequired?: boolean } = {}): FieldDef[] {
  return [
    FieldDef.parse({ key: "name", label: "Name", type: "text", required: true, autocomplete: "name" }),
    FieldDef.parse({ key: "email", label: "Email", type: "email", required: !opts.staff, autocomplete: "email" }),
    FieldDef.parse({ key: "phone", label: "Phone", type: "tel", required: !opts.staff && opts.phoneRequired !== false, autocomplete: "tel" }),
    FieldDef.parse({ key: "notes", label: "Anything we should know?", type: "textarea", required: false, full: true }),
  ];
}

// ---------- the booking-type contract ----------

/** What a visitor (or staff member) asked for, unvalidated. */
export interface Ask {
  date?: unknown;
  time?: unknown;
  party?: unknown;
  space?: unknown;
  duration?: unknown;
  occasion?: unknown;
  addons?: unknown;
}

export interface Resolved {
  ok: true;
  rules: SlotRules;
  /** Minutes. */
  duration: number;
  /** Tried in order; the database takes the first with room. */
  candidates: Resource[];
  /** Units the booking uses on the chosen resource (covers, 1 table, 1 space). */
  units: number;
  party_size: number;
  mode: "auto" | "approve";
  hold_minutes: number;
  /** Display rows built by the server from CONFIG text only (safe for customer emails). Stored on the booking. */
  facts: [string, string][];
  /** Extra validated answers stored on the booking (occasion, add-ons). */
  fields: Record<string, string>;
}
export interface Unresolved { ok: false; error: string; field?: string; enquiry?: string }

/** Public options of a type, for the admin's manual booking form and the widgets. */
export interface TypeInfo {
  kind: Kind;
  label: string;
  slot_minutes: number;
  party: { min: number; max: number } | null;
  spaces: { id: string; name: string; capacity: number; min_guests: number; min_minutes: number; max_minutes: number }[] | null;
}

/**
 * A booking type, provided by a module in src/modules/<m>/booking-type.ts (default export: a function returning
 * the type, or null when the module isn't enabled). booking-core finds them with import.meta.glob.
 */
export interface BookingType {
  kind: Kind;
  /** "Table", "Space": used in emails and the admin. */
  label: string;
  /** False when client.yaml doesn't give enough to take bookings (sections hide, endpoints refuse). */
  configured: boolean;
  /** Validates the request against config. Called without a time for availability. */
  resolve(ask: Ask, opts?: { staff?: boolean }): Resolved | Unresolved;
  describe(): TypeInfo;
}

/** Positive whole number from a form value, or null. */
export function intOf(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,6}$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

// ---- fields the table-booking and space-booking sections share (one definition) ----

/** A site path ("/contact") or an https link: where bigger groups and visitors without JavaScript go. */
export const SitePath = z.string().regex(/^(\/[^\s]*|https:\/\/[^\s]+)$/, 'a site path like "/contact" or an https:// link');
/** Section wording the client edits, the same in both booking sections. */
export const SmallPrint = z.string().default("").meta({ widget: "textarea" });
export const SuccessConfirmed = z.string().min(1).meta({ help: "Shown after an instant booking (auto mode)" });
export const EnquiryLink = z.string().min(1).default("Send us an enquiry");
