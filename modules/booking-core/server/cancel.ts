// Customer self-cancel from the signed link in their email (no accounts). GET shows the booking and a button;
// only POST cancels (mail scanners open links, they don't submit forms). Idempotent: a second POST says
// "already cancelled" and sends nothing.
import { sendMail } from "../../../kit/email/send.ts";
import { supabaseEnv } from "../../../kit/server/supabase.ts";
import type { Status } from "../lib/capacity.ts";
import { formatSpan } from "../lib/time.ts";
import { teamRecipients, type BookingCtx } from "./book.ts";
import { siteUrlOf } from "../../../kit/lib/site.ts";
import { oneLine } from "../../../kit/lib/text.ts";
import { getBooking, isUuid, recordDelivery, rpc, type BookingRow, type StatusResult } from "./db.ts";
import { customerMail, reference, teamMail, type MailBooking } from "./emails.ts";
import { tokenSecret, verifyCancelToken } from "./token.ts";

export type CancelState = "off" | "invalid" | "confirm" | "done" | "already" | "too_late" | "closed" | "error";
export interface CancelView {
  state: CancelState;
  summary?: { reference: string; label: string; when: string; facts: [string, string][] };
}

const CANCELLABLE: Status[] = ["pending", "confirmed"];

function summary(ctx: BookingCtx, b: BookingRow): CancelView["summary"] {
  return {
    reference: reference(b.id),
    label: ctx.types[b.kind]?.label ?? b.kind,
    when: formatSpan(Date.parse(b.starts_at), Date.parse(b.ends_at), ctx.cfg.client.timezone),
    facts: b.facts ?? [],
  };
}

export async function cancelView(method: string, params: { id: unknown; t: unknown }, ctx: BookingCtx): Promise<CancelView> {
  const env = ctx.env ?? process.env;
  const now = (ctx.now ?? new Date()).getTime();
  const secret = tokenSecret(env);
  if (!secret || !supabaseEnv(env).configured) return { state: "off" };
  if (!isUuid(params.id)) return { state: "invalid" };
  let b: (BookingRow & { cancel_token_hash?: string | null }) | null;
  try {
    b = await getBooking(params.id, env, true);
  } catch (e) {
    console.error(`booking-core: cancel lookup failed: ${oneLine((e as Error).message)}`);
    return { state: "error" };
  }
  // same answer for "no such booking" and "wrong token": a link can't be used to probe for bookings
  if (!b || !verifyCancelToken(secret, b.id, params.t, b.cancel_token_hash)) return { state: "invalid" };
  const view = { summary: summary(ctx, b) };
  if (b.status === "cancelled") return { state: "already", ...view };
  if (!CANCELLABLE.includes(b.status)) return { state: "closed", ...view };
  if (Date.parse(b.starts_at) - ctx.conf.customer_cancel_minutes * 60_000 <= now) return { state: "too_late", ...view };
  if (method !== "POST") return { state: "confirm", ...view };

  let r: StatusResult;
  try {
    r = await rpc<StatusResult>("set_booking_status", { p_id: b.id, p_status: "cancelled", p_actor: "customer" }, env);
  } catch (e) {
    console.error(`booking-core: customer cancel failed: ${oneLine((e as Error).message)}`);
    return { state: "error", ...view };
  }
  if (!r.ok) return { state: r.reason === "invalid_transition" ? "closed" : "error", ...view };
  if (!r.changed) return { state: "already", ...view };

  const mb: MailBooking = { id: b.id, label: view.summary!.label, starts_at: Date.parse(b.starts_at), ends_at: Date.parse(b.ends_at), status: "cancelled", hold_until: null, facts: b.facts ?? [] };
  const siteUrl = siteUrlOf(ctx.cfg);
  const safe = (p: Promise<string>) => p.catch((e: Error) => `error: ${oneLine(e.message)}`);
  const to = teamRecipients(env);
  const [customer, team] = await Promise.all([
    b.email ? safe(sendMail({ to: [b.email], ...customerMail(ctx.cfg, ctx.conf, "cancelled", mb) }, env)) : Promise.resolve("none"),
    to.length ? safe(sendMail({ to, ...teamMail(ctx.cfg, "cancelled", mb, b, { admin: `${siteUrl}/admin#/view/bookings` }) }, env)) : Promise.resolve("off"),
  ]);
  await recordDelivery(b.id, r.booking.delivery ?? b.delivery ?? {}, { cancelled_email: customer, team_cancel_email: team }, env);
  return { state: "done", ...view };
}
