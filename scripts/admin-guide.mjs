// A written admin guide from client.yaml and the installed module list.
// It repeats the client's own facts and does not invent dishes, awards or policies.
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export function adminGuide(cfg, modules = []) {
  const c = cfg.client ?? {};
  const hours = Object.entries(c.hours ?? {});
  const highlights = cfg.highlights ?? {};
  const facts = [
    ...(highlights.specialties ?? []).map((item) => `Known for: ${item}`),
    ...(highlights.dietary ?? []).map((item) => `Dietary: ${item}`),
    highlights.parking ? `Parking: ${highlights.parking}` : "",
  ].filter(Boolean);
  const booking = cfg.modules?.["table-booking"]?.mode ?? cfg.modules?.["space-booking"]?.mode;
  return [
    `# ${c.name ?? "This site"} — admin guide`,
    "",
    "How staff use the dashboard. Everything below comes from client.yaml. If a fact is missing, it was not provided.",
    "",
    "## Sign in",
    "",
    `- Open https://${c.domain ?? "the-site"}/admin`,
    "- Sign in with the staff email the agency created. Public sign-up is off.",
    "- Roles: admin can publish. editor can change content and bookings. demo can look but not save.",
    "",
    "## What this site includes",
    "",
    modules.length ? modules.map((name) => `- ${name}`).join("\n") : "- Starter pages only.",
    "",
    "## Hours shown on the site",
    "",
    hours.length ? hours.map(([day, value]) => `- ${day}: ${value}`).join("\n") : "- No hours were entered in client.yaml.",
    "",
    "## Factual highlights",
    "",
    facts.length ? facts.map((line) => `- ${line}`).join("\n") : "- None yet. Add them in client.yaml under highlights. Do not make them up.",
    "",
    booking ? `## Bookings\n\nTable or space requests use mode \`${booking}\`. New requests appear under Bookings in the dashboard.` : "",
    "",
    "## Publishing",
    "",
    "Saving in the dashboard does not update the live site. An admin presses Publish, which rebuilds the site.",
    "",
  ].filter((line) => line !== undefined).join("\n").replace(/\n{3,}/g, "\n\n");
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invoked) {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/admin-guide.mjs <client.yaml> [out.md]");
    process.exit(1);
  }
  const { createRequire } = await import("node:module");
  const { parse } = createRequire(new URL("../starter/package.json", import.meta.url))("yaml");
  const cfg = parse(readFileSync(file, "utf8"));
  const modules = Object.keys(cfg.modules ?? {});
  const text = adminGuide(cfg, modules);
  const out = process.argv[3];
  if (out) writeFileSync(out, text);
  else process.stdout.write(text);
}
