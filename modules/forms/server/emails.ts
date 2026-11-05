// Team + customer emails for a submission (pure). Rule 9: the customer email never contains anything
// the visitor typed; rule 10: recipients come from env vars; rule 22: HTML + plain-text twin.
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { button, esc, facts, factsText, frame, h, p, themeFrom, type Theme } from "../../../kit/email/html.ts";
import type { FormDef } from "../lib/schema.ts";
import type { EmailBlock } from "../lib/hooks.ts";

export interface Sub { id: number; at: Date; form: string; page: string; fields: Record<string, string> }

export function when(at: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone, weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(at);
}

/** Extra content from a quote hook (lib/hooks.ts). Absent for ordinary forms: their emails are unchanged. */
export interface MailExtra { blocks?: EmailBlock[]; note?: string; subjectTag?: string }

const blockHtml = (t: Theme, b: EmailBlock) =>
  (b.heading ? `<h2 style="margin:18px 0 6px;font-size:17px;line-height:1.3;">${esc(b.heading)}</h2>` : "") +
  (b.rows?.length ? facts(t, b.rows) : "") +
  (b.lines ?? []).map(p).join("");
const blockText = (b: EmailBlock) => [...(b.heading ? [b.heading] : []), ...(b.rows?.length ? [factsText(b.rows)] : []), ...(b.lines ?? [])].join("\n");
const noteHtml = (t: Theme, note: string) =>
  `<p style="margin:12px 0;padding:12px 16px;border-left:4px solid ${t.band};background:${t.page};font-size:14px;">${esc(note)}</p>`;

export function teamMail(cfg: ClientConfig, def: FormDef, sub: Sub, links: { admin: string; sheet?: string }, extra?: MailExtra) {
  const t = themeFrom(cfg);
  const tagText = extra?.subjectTag ?? (def.subject_from ? sub.fields[def.subject_from] : undefined);
  const tag = tagText ? ` (${tagText.replace(/\s+/g, " ").slice(0, 40)})` : "";
  const subject = `New ${def.name.toLowerCase()} enquiry${tag} #${sub.id}`;
  const rows: [string, string][] = def.fields.filter((f) => sub.fields[f.key]).map((f) => [f.label, sub.fields[f.key]!]);
  const meta = `${when(sub.at, cfg.client.timezone)} · from ${sub.page}`;
  const blocks = extra?.blocks ?? [];
  const body =
    h(`New ${def.name.toLowerCase()} enquiry`) +
    `<p style="margin:0 0 14px;color:${t.muted};font-size:13px;">${esc(meta)}</p>` +
    (extra?.note ? noteHtml(t, extra.note) : "") +
    blocks.map((b) => blockHtml(t, b)).join("") +
    facts(t, rows) +
    p(`Next step: ${def.team_next_step}`) +
    button(t, links.admin, "Open in the dashboard") +
    (links.sheet ? button(t, links.sheet, "Open the sheet") : "");
  const text = [
    `New ${def.name.toLowerCase()} enquiry #${sub.id}`, meta, "",
    ...(extra?.note ? [extra.note, ""] : []),
    ...blocks.flatMap((b) => [blockText(b), ""]),
    factsText(rows), "", `Next step: ${def.team_next_step}`, `Dashboard: ${links.admin}`, ...(links.sheet ? [`Sheet: ${links.sheet}`] : []),
  ].join("\n");
  return { subject, html: frame(t, { title: subject, preheader: rows.slice(0, 2).map((r) => r[1]).join(" · "), body }), text };
}

/** Fixed wording only, plus server-generated blocks from a quote hook. Null when the form has no customer confirmation. */
export function customerMail(cfg: ClientConfig, def: FormDef, extra?: Pick<MailExtra, "blocks">) {
  const c = def.customer_email;
  if (!c) return null;
  const t = themeFrom(cfg);
  const blocks = extra?.blocks ?? [];
  const body = h(c.heading) + c.body.map(p).join("") + blocks.map((b) => blockHtml(t, b)).join("") + p(`If anything changes, reply to this email or call ${cfg.client.contact.phone}.`);
  const text = [c.heading, "", ...c.body, ...blocks.flatMap((b) => ["", blockText(b)]), "", `If anything changes, reply to this email or call ${cfg.client.contact.phone}.`, "", t.signOff].join("\n");
  return { subject: c.subject, html: frame(t, { title: c.subject, preheader: c.body[0], body }), text };
}
