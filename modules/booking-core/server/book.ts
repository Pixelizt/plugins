// Public booking endpoints. Same shape as the forms pipeline (reusing its validators and IP hash):
// validate → honeypot → rate limit → create_booking (the database decides, under a lock) → emails in parallel →
// each outcome written to the row (rule 20). Emails failing never fail the visitor; the booking stands.
import { randomUUID } from "node:crypto";
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { supabaseEnv, type Env } from "../../../kit/server/supabase.ts";
import { attempt as attemptStep, listEnv, sendMail } from "../../../kit/email/send.ts";
import { siteUrlOf } from "../../../kit/lib/site.ts";
import { oneLine } from "../../../kit/lib/text.ts";
import { ipHash } from "../../forms/server/submit.ts";
import { validateForm, type Problem } from "../../forms/lib/validate.ts";
import { freeSlots, type Kind } from "../lib/capacity.ts";
import { checkDate, slotsFor, type DateProblem } from "../lib/slots.ts";
import { detailFields, type Ask, type BookingCoreConfig, type BookingType, type Details, type Resolved } from "../lib/schema.ts";
import { loadBlocks, loadOccupancy, recentFromIp, recordDelivery, rpc, type CreateArgs, type CreateResult } from "./db.ts";
import { customerMail, reference, teamMail, type MailBooking } from "./emails.ts";
import { cancelToken, cancelUrl, tokenHash, tokenSecret } from "./token.ts";

export interface BookingCtx {
  cfg: ClientConfig;
  conf: BookingCoreConfig;
  types: Partial<Record<Kind, BookingType>>;
  /** Phone region for validation: the forms module's (one rule, one place). */
  region: string;
  env?: Env;
  now?: Date;
}

export interface Result {
  status: number;
  body: { ok: boolean; error?: string; code?: string; field?: string; enquiry?: string; fields?: Record<string, Problem>; [k: string]: unknown };
  headers?: Record<string, string>;
}

const MAX_BODY = 20_000;
export const NO_STORE = { "Cache-Control": "no-store" };
export const DATE_MESSAGES: Record<DateProblem, string> = {
  invalid: "Please choose a date.",
  past: "That date has passed. Please choose another.",
  too_far: "We don't take bookings that far ahead yet. Please choose an earlier date.",
  closed: "We're closed that day. Please choose another date.",
};
const FULL = "Sorry, that time has just been taken. Please choose another time.";
export const fail = (status: number, error: string, extra: Partial<Result["body"]> = {}): Result => ({ status, body: { ok: false, error, ...extra }, headers: NO_STORE });

export const typeOf = (ctx: BookingCtx, kind: unknown): BookingType | null => {
  const t = typeof kind === "string" && Object.hasOwn(ctx.types, kind) ? ctx.types[kind as Kind] : undefined;
  return t && t.configured ? t : null;
};

const askFrom = (o: Record<string, unknown>): Ask => ({ date: o.date, time: o.time, party: o.party, space: o.space, duration: o.duration, occasion: o.occasion, addons: o.addons });

/** GET /api/bookings/availability?type=table&date=2026-11-20&party=4 (or &space=rooftop&duration=180). No personal data. */
export async function handleAvailability(url: URL, ctx: BookingCtx): Promise<Result> {
  const env = ctx.env ?? process.env;
  const now = ctx.now ?? new Date();
  if (!supabaseEnv(env).configured) return fail(503, "Online booking isn't set up yet. Please call us.");
  const type = typeOf(ctx, url.searchParams.get("type"));
  if (!type) return fail(404, "Unknown booking type");
  const q = Object.fromEntries(url.searchParams);
  const r = type.resolve(askFrom(q));
  if (!r.ok) return fail(400, r.error, { field: r.field, enquiry: r.enquiry });
  const date = q.date;
  const problem = checkDate(r.rules, date, ctx.cfg.client.timezone, now);
  // short cache: availability is live data, but a burst of visitors on the same day shares one answer
  const headers = { "Cache-Control": "public, max-age=0, s-maxage=15, stale-while-revalidate=15" };
  if (problem) return { status: 200, body: { ok: true, date, slots: [], closed: problem, message: DATE_MESSAGES[problem] }, headers };
  const slots = slotsFor(r.rules, date!, r.duration, ctx.cfg.client.timezone, now);
  if (!slots.length) return { status: 200, body: { ok: true, date, slots: [] }, headers };
  const buf = Math.max(0, ...r.candidates.map((c) => c.buffer_minutes)) * 60_000;
  const from = slots[0]!.start - buf;
  const to = slots.at(-1)!.end + buf;
  try {
    const [occ, blocks] = await Promise.all([loadOccupancy(r.candidates.map((c) => c.id), from, to, env), loadBlocks(from, to, env)]);
    const free = freeSlots(slots, r.candidates, occ, blocks, r.units, now.getTime());
    return { status: 200, body: { ok: true, date, slots: free.map((s) => ({ time: s.time })) }, headers };
  } catch (e) {
    console.error(`booking-core: availability failed: ${oneLine((e as Error).message)}`);
    return fail(502, "Couldn't check availability. Please try again or call us.");
  }
}

async function readJson(request: Request): Promise<Record<string, unknown> | Result> {
  const raw = await request.text();
  if (raw.length > MAX_BODY) return fail(413, "Too much data");
  try {
    const body = JSON.parse(raw);
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch { /* fall through */ }
  return fail(400, "Send the booking as JSON");
}
export const respond = (r: Result) => Response.json(r.body, { status: r.status, headers: r.headers ?? NO_STORE });
/** Wraps a handler for an Astro route: unexpected errors become a plain 500 (logged, never shown). */
export async function guarded(fn: () => Promise<Result>): Promise<Response> {
  try {
    return respond(await fn());
  } catch (e) {
    console.error(`booking-core: unexpected error: ${(e as Error).stack ?? e}`);
    return Response.json({ ok: false, error: "Something went wrong. Please try again or call us." }, { status: 500, headers: NO_STORE });
  }
}
export const isResult = (x: unknown): x is Result => Boolean(x && typeof x === "object" && "status" in x && "body" in x);

/** Validates contact details with the forms module's rules. */
export function checkDetails(input: unknown, region: string, opts: { staff?: boolean; phoneRequired?: boolean } = {}) {
  return validateForm({ fields: detailFields(opts) } as Parameters<typeof validateForm>[0], input && typeof input === "object" ? (input as Record<string, unknown>) : {}, region);
}

/** POST /api/bookings/book: an online booking. */
export async function handleBook(request: Request, ctx: BookingCtx): Promise<Result> {
  const env = ctx.env ?? process.env;
  const now = ctx.now ?? new Date();
  const sb = supabaseEnv(env);
  if (!sb.configured) return fail(503, "Online booking isn't set up yet. Please call us.");
  const body = await readJson(request);
  if (isResult(body)) return body;

  // the hidden field only bots fill in: answer as if all went well and keep nothing
  if (body._gotcha) return { status: 200, body: { ok: true, status: "pending" }, headers: NO_STORE };

  const type = typeOf(ctx, body.type);
  if (!type) return fail(400, "Unknown booking type");
  const details = checkDetails(body.details, ctx.region, { phoneRequired: ctx.conf.require_phone });
  if (!details.ok) return fail(400, "Check these fields", { fields: details.problems });
  const r = type.resolve(askFrom(body));
  if (!r.ok) return fail(400, r.error, { field: r.field, enquiry: r.enquiry });
  const problem = checkDate(r.rules, body.date, ctx.cfg.client.timezone, now);
  if (problem) return fail(400, DATE_MESSAGES[problem], { field: "date" });
  const slot = slotsFor(r.rules, body.date as string, r.duration, ctx.cfg.client.timezone, now).find((s) => s.time === body.time);
  if (!slot) return fail(409, "That time can't be booked any more. Please choose another.", { field: "time", code: "unavailable" });

  const ip = ipHash(request, sb.service);
  try {
    if ((await recentFromIp(ip, now.getTime() - ctx.conf.rate_limit.window_minutes * 60_000, ctx.conf.rate_limit.max, env)) >= ctx.conf.rate_limit.max)
      return fail(429, "Too many bookings from here. Please try again in a few minutes or call us.");
  } catch (e) {
    console.error(`booking-core: rate limit check failed: ${oneLine((e as Error).message)}`); // let it through
  }

  return place(ctx, type, r, slot, details.fields, { source: "web", ip, actor: null, notifyCustomer: true, notifyTeam: true });
}

/**
 * Creates the booking through create_booking and sends the emails. Shared by the public endpoint and the staff
 * "manual booking" endpoint. Staff bookings are always confirmed (they were agreed on the phone).
 */
export async function place(
  ctx: BookingCtx, type: BookingType, r: Resolved, slot: { start: number; end: number }, d: Details,
  o: { source: "web" | "staff"; ip: string | null; actor: string | null; notifyCustomer: boolean; notifyTeam: boolean },
): Promise<Result> {
  const env = ctx.env ?? process.env;
  const now = ctx.now ?? new Date();
  const id = randomUUID();
  const secret = tokenSecret(env);
  const token = secret ? cancelToken(secret, id) : "";
  const status = o.source === "staff" || r.mode === "auto" ? "confirmed" : "pending";
  const hold = status === "pending" ? Math.min(now.getTime() + r.hold_minutes * 60_000, slot.start) : null;
  const args: CreateArgs = {
    p_id: id, p_kind: type.kind, p_candidates: r.candidates, p_units: r.units,
    p_starts_at: new Date(slot.start).toISOString(), p_ends_at: new Date(slot.end).toISOString(), p_party_size: r.party_size,
    p_status: status, p_hold_until: hold === null ? null : new Date(hold).toISOString(), p_source: o.source,
    p_name: d.name ?? "", p_email: d.email || null, p_phone: d.phone || null, p_notes: d.notes || null,
    p_fields: r.fields, p_facts: r.facts, p_cancel_token_hash: token ? tokenHash(token) : null, p_ip_hash: o.ip, p_decided_by: o.actor,
  };
  let created: CreateResult;
  try {
    created = await rpc<CreateResult>("create_booking", args as unknown as Record<string, unknown>, env);
  } catch (e) {
    console.error(`booking-core: could not save: ${oneLine((e as Error).message)}`);
    return fail(502, "Could not book. Please try again or call us.");
  }
  if (!created.ok) {
    if (created.reason === "invalid") return fail(400, "Something about this booking isn't right. Please check it or call us.");
    return fail(409, created.reason === "blocked" ? "Sorry, we're not taking bookings at that time. Please choose another." : FULL, { code: "full", field: "time" });
  }

  const siteUrl = siteUrlOf(ctx.cfg);
  const mb: MailBooking = { id, label: type.label, starts_at: slot.start, ends_at: slot.end, status, hold_until: hold, facts: r.facts };
  const attempt = (name: string, fn: () => Promise<string>) => attemptStep("booking-core", name, fn);
  const [team_email, customer_email] = await Promise.all([
    attempt("team email", async () => {
      if (!o.notifyTeam) return "off";
      const to = teamRecipients(env);
      if (!to.length) return "off";
      const m = teamMail(ctx.cfg, status === "pending" ? "request" : "new", mb, { ...d, fields: r.fields }, { admin: `${siteUrl}/admin#/view/bookings` });
      return sendMail({ to, ...m, ...(d.email ? { replyTo: d.email } : {}) }, env);
    }),
    attempt("customer email", async () => {
      if (!o.notifyCustomer || !d.email) return "none";
      const m = customerMail(ctx.cfg, ctx.conf, status === "pending" ? "received" : "confirmed", mb, token ? { cancel: cancelUrl(siteUrl, id, token) } : {});
      return sendMail({ to: [d.email], ...m }, env);
    }),
  ]);
  await recordDelivery(id, {}, { team_email, customer_email, cancel_link: token ? "on" : "off: BOOKING_TOKEN_SECRET not set" }, env);
  return { status: 200, body: { ok: true, id, reference: reference(id), status }, headers: NO_STORE };
}

/** BOOKINGS_EMAIL_TO, else the forms module's FORMS_EMAIL_TO. Never from the request (rule 10). */
export const teamRecipients = (env: Env) => {
  const own = listEnv(env.BOOKINGS_EMAIL_TO);
  return own.length ? own : listEnv(env.FORMS_EMAIL_TO);
};
