// Booking emails (pure). Customer emails: fixed wording from config + server-generated facts only (date, time,
// party size, the space's configured name…), never the visitor's name or notes (rule 9). Team emails escape
// everything (rule 13). HTML + plain-text twin (rule 22). Recipients are decided by the caller from env (rule 10).
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { button, facts, factsText, frame, h, p, themeFrom } from "../../../kit/email/html.ts";
import { formatInstant, formatSpan } from "../lib/time.ts";
import { wordingFor, type BookingCoreConfig, type EmailKind } from "../lib/schema.ts";
import type { Status } from "../lib/capacity.ts";

export interface MailBooking {
  id: string;
  label: string; // the booking type's label, e.g. "Table"
  starts_at: number;
  ends_at: number;
  status: Status;
  hold_until: number | null;
  facts: [string, string][];
}

export const reference = (id: string) => id.replace(/-/g, "").slice(0, 8).toUpperCase();

function factRows(cfg: ClientConfig, b: MailBooking): [string, string][] {
  return [["Reference", reference(b.id)], ["Booking", b.label], ["When", formatSpan(b.starts_at, b.ends_at, cfg.client.timezone)], ...b.facts];
}

export function customerMail(cfg: ClientConfig, conf: BookingCoreConfig, kind: EmailKind, b: MailBooking, links: { cancel?: string } = {}) {
  const t = themeFrom(cfg);
  const w = wordingFor(conf, kind);
  const rows = factRows(cfg, b);
  const canCancel = links.cancel && (kind === "received" || kind === "confirmed" || kind === "reminder");
  const contact = `If anything changes, reply to this email or call ${cfg.client.contact.phone}.`;
  const body =
    h(w.heading) + w.body.map(p).join("") + facts(t, rows) +
    (canCancel ? button(t, links.cancel!, kind === "received" ? "Cancel this request" : "Cancel this booking") : "") +
    p(contact);
  const text = [w.heading, "", ...w.body, "", factsText(rows), "", ...(canCancel ? [`To cancel: ${links.cancel}`, ""] : []), contact, "", t.signOff].join("\n");
  return { subject: w.subject, html: frame(t, { title: w.subject, preheader: w.body[0], body }), text };
}

export type TeamKind = "new" | "request" | "cancelled";

export function teamMail(cfg: ClientConfig, kind: TeamKind, b: MailBooking, d: { name?: string | null; email?: string | null; phone?: string | null; notes?: string | null; fields?: Record<string, string> }, links: { admin: string }) {
  const t = themeFrom(cfg);
  const ref = reference(b.id);
  const what = b.label.toLowerCase();
  const title =
    kind === "request" ? `New ${what} request to accept or decline` : kind === "new" ? `New ${what} booking (confirmed)` : `${b.label} booking cancelled by the customer`;
  const subject = `${title} #${ref}`;
  const rows: [string, string][] = [
    ...factRows(cfg, b),
    ["Name", d.name ?? ""], ["Email", d.email ?? ""], ["Phone", d.phone ?? ""], ["Notes", d.notes ?? ""],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  const hold = b.hold_until ? `Held until ${formatInstant(b.hold_until, cfg.client.timezone)}: decide before then or the time is released.` : "";
  const next =
    kind === "request" ? `Accept or decline it in the dashboard. ${hold}` : kind === "new" ? "Nothing to do: it is confirmed and the customer has been emailed." : "The time is free again.";
  const body = h(title) + facts(t, rows) + p(next) + button(t, links.admin, "Open bookings");
  const text = [title, "", factsText(rows), "", next, `Dashboard: ${links.admin}`].join("\n");
  return { subject, html: frame(t, { title: subject, preheader: rows.slice(1, 3).map((r) => r[1]).join(" · "), body }), text };
}
