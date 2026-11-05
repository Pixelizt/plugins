// robots.txt and llms.txt bodies (pure). Pages call these so the rules are testable without a server.
import type { ClientConfig } from "../config/schema.ts";
import { pageTitle } from "../pages.ts";
import { factLines } from "./facts.ts";

/** Crawlers that train or answer from the public web. Kept in one list so "allow" and "block" stay in sync. */
export const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "Google-Extended",
  "anthropic-ai",
  "ClaudeBot",
  "PerplexityBot",
  "CCBot",
  "Applebot-Extended",
  "Bytespider",
  "Meta-ExternalAgent",
] as const;

const PRIVATE = ["Disallow: /admin", "Disallow: /api/", "Disallow: /kit-blocks"];

export function robotsTxt(site: string | URL, mode: ClientConfig["seo"]["ai_crawlers"]): string {
  const lines = ["User-agent: *", ...PRIVATE, ""];
  for (const bot of AI_CRAWLERS) {
    lines.push(`User-agent: ${bot}`, ...(mode === "block" ? ["Disallow: /"] : PRIVATE), "");
  }
  lines.push(`Sitemap: ${new URL("sitemap-index.xml", site)}`);
  return lines.join("\n") + "\n";
}

function pageLines(cfg: ClientConfig, site: string | URL): string[] {
  return cfg.pages.map((p) => `- [${pageTitle(p)}](${new URL(p.path, site)})`);
}

/** Short index for assistants. Facts only; empty highlights add nothing. */
export function llmsTxt(cfg: ClientConfig, site: string | URL): string {
  const c = cfg.client;
  const facts = factLines(cfg.highlights).map((f) => `- ${f.label}: ${f.text}`);
  return [
    `# ${c.name}`,
    "",
    `> ${c.type} · ${c.contact.address}`,
    "",
    "This file lists only what the client put in client.yaml. It is not a menu and not a review.",
    "",
    `- Phone: ${c.contact.phone}`,
    `- Email: ${c.contact.email}`,
    ...Object.entries(c.hours).map(([d, h]) => `- Hours ${d}: ${h}`),
    ...(facts.length ? ["", "## Highlights", ...facts] : []),
    "",
    "## Pages",
    ...pageLines(cfg, site),
    "",
  ].join("\n");
}

/** Longer factual brief: contact, hours, highlights, and the page list. Still no invented dishes or ratings. */
export function llmsFullTxt(cfg: ClientConfig, site: string | URL): string {
  const c = cfg.client;
  const facts = factLines(cfg.highlights);
  const socials = Object.entries(c.socials).filter(([, url]) => url);
  const menuPage = cfg.pages.find((p) => p.path === "/menu" || p.sections.some((s) => s.startsWith("menu")));
  return [
    llmsTxt(cfg, site).trimEnd(),
    "",
    "## About this file",
    "Generated from client.yaml at build time. Awards, specialties, dietary options, ambience and parking appear only when the client filled them in. Prices, dishes and reviews live on the pages below, not here.",
    "",
    "## Visit",
    `- Address: ${c.contact.address}`,
    ...(c.contact.map_url ? [`- Map: ${c.contact.map_url}`] : []),
    `- Time zone: ${c.timezone}`,
    `- Currency: ${c.currency}`,
    ...(socials.length ? ["", "## Social", ...socials.map(([name, url]) => `- ${name}: ${url}`)] : []),
    ...(facts.length ? ["", "## Highlights in full", ...facts.map((f) => `- ${f.label}: ${f.text}`)] : ["", "## Highlights", "None supplied."]),
    "",
    menuPage ? `Menu page: ${new URL(menuPage.path, site)}` : "No menu page is configured.",
    `Full text index: ${new URL("llms.txt", site)}`,
    "",
  ].join("\n");
}
