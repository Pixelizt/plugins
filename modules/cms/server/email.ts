// The "you published, here's what changed" email to the owner (pure).
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { esc, frame, h, p, themeFrom } from "../../../kit/email/html.ts";
import type { SectionChange } from "./changes.ts";

export function publishedEmail(cfg: ClientConfig, by: string, changes: SectionChange[], error = "") {
  const t = themeFrom(cfg);
  const subject = `${cfg.client.name} website published${changes.length ? `: ${changes.map((c) => c.label).join(", ")}` : ""}`;
  const sections = changes
    .map(
      (c) =>
        `<p style="margin:16px 0 4px;font-weight:bold;">${esc(c.label)}${c.by.length ? ` <span style="font-weight:normal;color:${t.muted};">by ${esc(c.by.join(", "))}</span>` : ""}</p>` +
        `<ul style="margin:0 0 8px;padding-inline-start:20px;">${c.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`,
    )
    .join("");
  const body =
    h("Website published") +
    p(`${by} published the website. It goes live in a few minutes.`) +
    (changes.length ? sections : p("No content changed since the last publish.")) +
    (error ? p(`(The change list could not be worked out: ${error})`) : "");
  const text = [
    `${by} published the ${cfg.client.name} website. It goes live in a few minutes.`,
    "",
    ...(changes.length ? changes.flatMap((c) => [`${c.label}${c.by.length ? ` (by ${c.by.join(", ")})` : ""}`, ...c.lines.map((l) => `  - ${l}`), ""]) : ["No content changed since the last publish."]),
    ...(error ? [`(The change list could not be worked out: ${error})`] : []),
  ].join("\n");
  return { subject, html: frame(t, { title: subject, preheader: "What changed on the website", body }), text };
}
