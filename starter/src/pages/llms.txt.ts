// A plain-text summary for AI assistants and search tools.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { pageTitle } from "../kit/pages";
export const GET: APIRoute = ({ site }) => {
  const c = config.client;
  const lines = [
    `# ${c.name}`,
    "",
    `> ${c.type} · ${c.contact.address}`,
    "",
    `- Phone: ${c.contact.phone}`,
    `- Email: ${c.contact.email}`,
    ...Object.entries(c.hours).map(([d, h]) => `- Hours ${d}: ${h}`),
    "",
    "## Pages",
    ...config.pages.map((p) => `- [${pageTitle(p)}](${new URL(p.path, site)})`),
  ];
  return new Response(lines.join("\n") + "\n");
};
