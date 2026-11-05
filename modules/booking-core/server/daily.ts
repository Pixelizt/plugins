// The daily booking jobs: mark run-out holds expired (tidy-up only: they already stopped counting), delete old
// bookings and blocks (retention, D17), and email tomorrow's confirmed bookings a reminder (business time zone).
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { serviceRest, supabaseEnv, type Env } from "../../../kit/server/supabase.ts";
import { sendMail } from "../../../kit/email/send.ts";
import type { Kind } from "../lib/capacity.ts";
import type { BookingCoreConfig, BookingType } from "../lib/schema.ts";
import { addDays, dayBounds, todayIn } from "../../../kit/lib/time.ts";
import { siteUrlOf } from "../../../kit/lib/site.ts";
import { BOOKING_COLUMNS, iso, recordDelivery, type BookingRow } from "./db.ts";
import { customerMail } from "./emails.ts";
import { cancelToken, cancelUrl, tokenSecret } from "./token.ts";

const MAX_REMINDERS = 300; // per run: keeps the function well inside its time limit

export async function runBookingDaily(ctx: { cfg: ClientConfig; conf: BookingCoreConfig; types: Partial<Record<Kind, BookingType>>; now: Date; env: Env }): Promise<string> {
  const { env, now } = ctx;
  if (!supabaseEnv(env).configured) return "off (Supabase env not set)";
  const out: string[] = [];

  const ex = await serviceRest(`bookings?select=${BOOKING_COLUMNS}&status=eq.pending&hold_until=lte.${iso(now.getTime())}`, { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify({ status: "expired" }) }, env);
  if (!ex.ok) out.push(`expired holds error ${ex.status}`);
  else {
    const text = await ex.text();
    const expired = (text ? JSON.parse(text) : []) as BookingRow[];
    out.push(`expired holds ${expired.length}${ctx.conf.notify_expired ? `, ${await notifyExpired(ctx, expired)}` : ""}`);
  }

  const cutoff = now.getTime() - ctx.conf.retention_days * 86_400_000;
  const del = await serviceRest(`bookings?ends_at=lt.${iso(cutoff)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, env);
  const delBlocks = await serviceRest(`booking_blocks?ends_at=lt.${iso(cutoff)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, env);
  out.push(`retention ${ctx.conf.retention_days}d: bookings ${del.ok ? "ok" : `error ${del.status}`}, blocks ${delBlocks.ok ? "ok" : `error ${delBlocks.status}`}`);

  if (!ctx.conf.reminders) out.push("reminders off");
  else out.push(`reminders ${await sendReminders(ctx)}`);
  return out.join("; ");
}

/** Owner decision (2026-11-05): a customer whose request ran out unanswered is told nothing was booked. */
export async function notifyExpired(ctx: { cfg: ClientConfig; conf: BookingCoreConfig; types: Partial<Record<Kind, BookingType>>; env: Env }, rows: BookingRow[]): Promise<string> {
  let sent = 0;
  let failed = 0;
  for (const b of rows.filter((r) => r.email)) {
    const m = customerMail(ctx.cfg, ctx.conf, "expired", {
      id: b.id, label: ctx.types[b.kind]?.label ?? b.kind, starts_at: Date.parse(b.starts_at), ends_at: Date.parse(b.ends_at), status: "expired", hold_until: null, facts: b.facts ?? [],
    });
    const status = await sendMail({ to: [b.email!], ...m }, ctx.env);
    if (status === "off") return "expiry emails off (email not set up)";
    if (status === "ok") sent++;
    else failed++;
    await recordDelivery(b.id, b.delivery ?? {}, { expired_email: status }, ctx.env);
  }
  return `expiry emails ${sent} sent${failed ? `, ${failed} failed` : ""}`;
}

/** Tomorrow, in the business's time zone (rule 21). Only bookings not reminded yet: safe to run twice. */
export async function sendReminders(ctx: { cfg: ClientConfig; conf: BookingCoreConfig; types: Partial<Record<Kind, BookingType>>; now: Date; env: Env }): Promise<string> {
  const { env } = ctx;
  const tz = ctx.cfg.client.timezone;
  const { from, to } = dayBounds(addDays(todayIn(tz, ctx.now), 1), tz);
  const q = `bookings?select=${BOOKING_COLUMNS}&status=eq.confirmed&reminded_at=is.null&email=not.is.null&starts_at=gte.${encodeURIComponent(new Date(from).toISOString())}&starts_at=lt.${encodeURIComponent(new Date(to).toISOString())}&order=starts_at&limit=${MAX_REMINDERS}`;
  const r = await serviceRest(q, {}, env);
  if (!r.ok) return `error ${r.status}`;
  const rows = (await r.json()) as BookingRow[];
  const secret = tokenSecret(env);
  const siteUrl = siteUrlOf(ctx.cfg);
  let sent = 0;
  let failed = 0;
  for (const b of rows) {
    const m = customerMail(ctx.cfg, ctx.conf, "reminder", {
      id: b.id, label: ctx.types[b.kind]?.label ?? b.kind, starts_at: Date.parse(b.starts_at), ends_at: Date.parse(b.ends_at), status: b.status, hold_until: null, facts: b.facts ?? [],
    }, secret ? { cancel: cancelUrl(siteUrl, b.id, cancelToken(secret, b.id)) } : {});
    const status = await sendMail({ to: [b.email!], ...m }, env);
    if (status === "off") return `off (email not set up), ${rows.length} due`;
    if (status === "ok") sent++;
    else failed++;
    // marked even on failure, so a broken address isn't retried every day; the outcome is on the row (rule 20)
    await recordDelivery(b.id, b.delivery ?? {}, { reminder_email: status }, env, { reminded_at: ctx.now.toISOString() });
  }
  return `${rows.length} due, ${sent} sent${failed ? `, ${failed} failed` : ""}`;
}
