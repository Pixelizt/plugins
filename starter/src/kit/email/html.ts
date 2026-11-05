// Email HTML building blocks (pure, tested). Ported from the reference project's api/_lib/emails.js.
// Email HTML is its own world: tables for layout, inline styles, no web fonts or scripts,
// absolute image URLs, and always a plain-text twin (rule 22). Kit code.
import type { ClientConfig } from "../config/schema.ts";
import { onColor } from "../config/tokens.ts";
import { siteUrlOf } from "../lib/site.ts";
import { esc } from "../lib/text.ts";

export { esc };
const FONT = "Arial,Helvetica,sans-serif";

export interface Theme {
  band: string; bandText: string; page: string; ink: string; muted: string; line: string; siteUrl: string;
  name: string; logoUrl: string; signOff: string;
}

export function themeFrom(cfg: ClientConfig): Theme {
  const c = cfg.brand.colors;
  const siteUrl = siteUrlOf(cfg);
  const logo = cfg.brand.logo.replace(/^\.\//, "").replace(/^assets\//, "");
  return {
    band: c.primary,
    bandText: onColor(c.primary, c.foreground, c.background),
    page: c.muted,
    ink: c.foreground,
    muted: "#6b6458",
    line: c.muted,
    siteUrl,
    name: cfg.client.name,
    // logos for email must be a PNG/JPG at a public absolute URL (many clients block SVG)
    logoUrl: logo && /\.(png|jpe?g)$/i.test(logo) ? `${siteUrl}/${logo}` : "",
    signOff: cfg.email.sign_off || `The ${cfg.client.name} team`,
  };
}

export function frame(t: Theme, o: { title: string; preheader?: string; body: string }): string {
  const head = t.logoUrl
    ? `<img src="${esc(t.logoUrl)}" width="120" alt="${esc(t.name)}" style="display:block;border:0;width:120px;height:auto;">`
    : `<span style="font-family:${FONT};font-size:22px;font-weight:bold;color:${t.bandText};">${esc(t.name)}</span>`;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:${t.page};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader ?? "")}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${t.page};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td align="center" style="background:${t.band};padding:20px 24px;"><a href="${esc(t.siteUrl)}" style="text-decoration:none;">${head}</a></td></tr>
<tr><td style="padding:28px 28px 8px;font-family:${FONT};font-size:15px;line-height:1.6;color:${t.ink};">
${o.body}
</td></tr>
<tr><td style="padding:16px 28px 28px;font-family:${FONT};font-size:12px;line-height:1.6;color:${t.muted};border-top:1px solid ${t.line};">
${esc(t.signOff)}<br><a href="${esc(t.siteUrl)}" style="color:${t.muted};">${esc(t.siteUrl.replace(/^https?:\/\//, ""))}</a>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export const p = (text: string) => `<p style="margin:0 0 14px;">${esc(text)}</p>`;
export const h = (text: string) => `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.3;">${esc(text)}</h1>`;
export const button = (t: Theme, href: string, label: string) =>
  `<a href="${esc(href)}" style="display:inline-block;margin:4px 6px 4px 0;padding:11px 20px;border-radius:999px;background:${t.band};color:${t.bandText};font-family:${FONT};font-size:14px;font-weight:bold;text-decoration:none;">${esc(label)}</a>`;
export const facts = (t: Theme, rows: [string, string][]) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:8px 0 16px;">${rows
    .map(([l, v]) => `<tr><td style="padding:6px 0;color:${t.muted};font-size:14px;vertical-align:top;width:40%;">${esc(l)}</td><td style="padding:6px 0 6px 12px;font-size:14px;vertical-align:top;">${esc(v).replace(/\r?\n/g, "<br>")}</td></tr>`)
    .join("")}</table>`;

/** Plain-text twin of a facts table. */
export const factsText = (rows: [string, string][]) => rows.map(([l, v]) => `${l}: ${v}`).join("\n");
