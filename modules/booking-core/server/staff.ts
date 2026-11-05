// Staff endpoints (role "editor" or above, D16; re-checked here, rule 11). Status changes go through the
// set_booking_status database function, which re-checks capacity when confirming.
import { requireRole, serviceRest, supabaseEnv, type StaffUser } from "../../../kit/server/supabase.ts";
import { sendMail } from "../../../kit/email/send.ts";
import { siteUrlOf } from "../../../kit/lib/site.ts";
import { oneLine } from "../../../kit/lib/text.ts";
import { localToUtc, dayBounds, parseHm, isIsoDate } from "../../../kit/lib/time.ts";
import { checkDate, slotsFor } from "../lib/slots.ts";
import type { Kind } from "../lib/capacity.ts";
import type { TypeInfo } from "../lib/schema.ts";
import { DATE_MESSAGES, NO_STORE, checkDetails, fail, isResult, place, typeOf, type BookingCtx, type Result } from "./book.ts";
import { isUuid, recordDelivery, rpc, type StatusResult } from "./db.ts";
import { customerMail, type MailBooking } from "./emails.ts";
import { cancelToken, cancelUrl, tokenSecret } from "./token.ts";

async function staff(request: Request, ctx: BookingCtx): Promise<StaffUser | Result> {
  const env = ctx.env ?? process.env;
  if (!supabaseEnv(env).configured) return fail(503, "Bookings aren't set up yet");
  const u = await requireRole(request, "editor", env);
  if (u instanceof Response) return { status: u.status, body: (await u.json()) as Result["body"], headers: NO_STORE };
  return u;
}

async function body(request: Request): Promise<Record<string, unknown> | Result> {
  try {
    const b = JSON.parse(await request.text());
    if (b && typeof b === "object" && !Array.isArray(b)) return b;
  } catch { /* fall through */ }
  return fail(400, "Send JSON");
}

const STATUS_ERRORS: Record<string, [number, string]> = {
  not_found: [404, "That booking doesn't exist any more."],
  invalid: [400, "Unknown status."],
  invalid_transition: [409, "That change isn't possible from the booking's current status. Reload the list."],
  full: [409, "There's no room left at that time (another booking took it), so it can't be confirmed."],
  past: [409, "That booking's time has passed."],
};

/** POST /api/bookings/status { id, status: confirmed|declined|cancelled, notify?: boolean } */
export async function handleStatus(request: Request, ctx: BookingCtx): Promise<Result> {
  const env = ctx.env ?? process.env;
  const user = await staff(request, ctx);
  if (isResult(user)) return user;
  const b = await body(request);
  if (isResult(b)) return b;
  if (!isUuid(b.id)) return fail(400, "Unknown booking");
  if (b.status !== "confirmed" && b.status !== "declined" && b.status !== "cancelled") return fail(400, "Unknown status");
  let r: StatusResult;
  try {
    r = await rpc<StatusResult>("set_booking_status", { p_id: b.id, p_status: b.status, p_actor: user.email }, env);
  } catch (e) {
    console.error(`booking-core: status change failed: ${oneLine((e as Error).message)}`);
    return fail(502, "Couldn't save the change. Try again.");
  }
  if (!r.ok) {
    const [code, msg] = STATUS_ERRORS[r.reason] ?? [409, "Couldn't change it."];
    return fail(code, msg, { code: r.reason });
  }
  const bk = r.booking;
  let email = "none";
  if (r.changed && b.notify !== false && bk.email) {
    const siteUrl = siteUrlOf(ctx.cfg);
    const secret = tokenSecret(env);
    const mb: MailBooking = { id: bk.id, label: ctx.types[bk.kind]?.label ?? bk.kind, starts_at: Date.parse(bk.starts_at), ends_at: Date.parse(bk.ends_at), status: bk.status, hold_until: null, facts: bk.facts ?? [] };
    const m = customerMail(ctx.cfg, ctx.conf, b.status, mb, secret && b.status === "confirmed" ? { cancel: cancelUrl(siteUrl, bk.id, cancelToken(secret, bk.id)) } : {});
    email = await sendMail({ to: [bk.email], ...m }, env).catch((e) => `error: ${oneLine((e as Error).message)}`);
  }
  if (r.changed) await recordDelivery(bk.id, bk.delivery ?? {}, { [`${b.status}_email`]: email }, env);
  return { status: 200, body: { ok: true, changed: r.changed, status: bk.status, email }, headers: NO_STORE };
}

/** POST /api/bookings/manual: a phone booking typed in by staff. Always confirmed; capacity still applies. */
export async function handleManual(request: Request, ctx: BookingCtx): Promise<Result> {
  const now = ctx.now ?? new Date();
  const user = await staff(request, ctx);
  if (isResult(user)) return user;
  const b = await body(request);
  if (isResult(b)) return b;
  const type = typeOf(ctx, b.type);
  if (!type) return fail(400, "Unknown booking type");
  const details = checkDetails(b.details, ctx.region, { staff: true });
  if (!details.ok) return fail(400, "Check these fields", { fields: details.problems });
  const r = type.resolve({ date: b.date, time: b.time, party: b.party, space: b.space, duration: b.duration, occasion: b.occasion, addons: b.addons }, { staff: true });
  if (!r.ok) return fail(400, r.error, { field: r.field });
  const problem = checkDate(r.rules, b.date, ctx.cfg.client.timezone, now, { staff: true });
  if (problem) return fail(400, DATE_MESSAGES[problem], { field: "date" });
  const slot = slotsFor(r.rules, b.date as string, r.duration, ctx.cfg.client.timezone, now, { staff: true }).find((s) => s.time === b.time);
  if (!slot) return fail(400, "That time isn't a bookable time that day (check the opening hours and the slot length).", { field: "time" });
  return place(ctx, type, r, slot, details.fields, { source: "staff", ip: null, actor: user.email, notifyCustomer: b.notify !== false, notifyTeam: false });
}

/** Scopes staff can block: everything, all tables, all spaces, or one space. */
export function blockScopes(types: BookingCtx["types"]): { value: string; label: string; kind: Kind | null; resource_id: string | null }[] {
  const out: { value: string; label: string; kind: Kind | null; resource_id: string | null }[] = [{ value: "all", label: "Everything", kind: null, resource_id: null }];
  for (const t of Object.values(types)) {
    if (!t?.configured) continue;
    out.push({ value: t.kind, label: `All ${t.label.toLowerCase()} bookings`, kind: t.kind, resource_id: null });
    for (const s of t.describe().spaces ?? []) out.push({ value: `space:${s.id}`, label: s.name, kind: "space", resource_id: `space:${s.id}` });
  }
  return out;
}

/**
 * POST /api/bookings/block
 * { action: "add", date, from?: "HH:MM", to?: "HH:MM", scope?: "all"|"table"|"space"|"space:<id>", reason? } → whole day without times
 * { action: "remove", id }
 * Existing bookings inside a new block are NOT cancelled: the answer counts them so staff can call those customers.
 */
export async function handleBlock(request: Request, ctx: BookingCtx): Promise<Result> {
  const env = ctx.env ?? process.env;
  const user = await staff(request, ctx);
  if (isResult(user)) return user;
  const b = await body(request);
  if (isResult(b)) return b;
  const tz = ctx.cfg.client.timezone;
  if (b.action === "remove") {
    if (typeof b.id !== "number" && !(typeof b.id === "string" && /^\d+$/.test(b.id))) return fail(400, "Unknown block");
    const r = await serviceRest(`booking_blocks?id=eq.${b.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, env);
    return r.ok ? { status: 200, body: { ok: true }, headers: NO_STORE } : fail(502, "Couldn't remove it. Try again.");
  }
  if (b.action !== "add") return fail(400, "Unknown action");
  if (!isIsoDate(b.date)) return fail(400, "Choose a date", { field: "date" });
  const scope = blockScopes(ctx.types).find((s) => s.value === (b.scope ?? "all"));
  if (!scope) return fail(400, "Unknown scope", { field: "scope" });
  let from: number | null;
  let to: number | null;
  if (b.from || b.to) {
    const f = parseHm(b.from);
    const t = parseHm(b.to);
    if (f === null || t === null || t <= f) return fail(400, "Give a start and an end time (HH:MM), end after start", { field: "to" });
    from = localToUtc(b.date, f, tz);
    to = localToUtc(b.date, t, tz);
    if (from === null || to === null) return fail(400, "That time doesn't exist that day (clock change)", { field: "from" });
  } else ({ from, to } = dayBounds(b.date, tz));
  const reason = oneLine(b.reason, 200);
  try {
    const r = await serviceRest("booking_blocks?select=id", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ kind: scope.kind, resource_id: scope.resource_id, starts_at: new Date(from).toISOString(), ends_at: new Date(to).toISOString(), reason, created_by: user.email }),
    }, env);
    if (!r.ok) throw new Error(`Supabase ${r.status} ${oneLine(await r.text(), 120)}`);
    const [row] = (await r.json()) as { id: number }[];
    const q = `bookings?select=id&status=in.(pending,confirmed)&starts_at=lt.${encodeURIComponent(new Date(to).toISOString())}&ends_at=gt.${encodeURIComponent(new Date(from).toISOString())}` +
      (scope.kind ? `&kind=eq.${scope.kind}` : "") + (scope.resource_id ? `&resource_id=eq.${encodeURIComponent(scope.resource_id)}` : "");
    const a = await serviceRest(q, {}, env);
    const affected = a.ok ? ((await a.json()) as unknown[]).length : null;
    return { status: 200, body: { ok: true, id: row?.id, affected }, headers: NO_STORE };
  } catch (e) {
    console.error(`booking-core: block failed: ${oneLine((e as Error).message)}`);
    return fail(502, "Couldn't save the block. Try again.");
  }
}

/** GET /api/bookings/meta: what the admin view needs to draw its forms. */
export async function handleMeta(request: Request, ctx: BookingCtx): Promise<Result> {
  const user = await staff(request, ctx);
  if (isResult(user)) return user;
  const types: TypeInfo[] = Object.values(ctx.types).filter((t) => t?.configured).map((t) => t!.describe());
  return { status: 200, body: { ok: true, timezone: ctx.cfg.client.timezone, types, scopes: blockScopes(ctx.types) }, headers: NO_STORE };
}
