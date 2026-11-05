#!/usr/bin/env node
// Create a client site from clients/<slug>/client.yaml. Used by /new-client.
// Usage: node scripts/new-client.mjs <slug> [target-dir]      (default target: ../<slug>-site)
// Follows docs/BOILERPLATE-BOUNDARIES.md §1: only what a client site needs is copied; kit-only files stay here.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [slug, targetArg] = process.argv.slice(2);
if (!slug) {
  console.error("Usage: node scripts/new-client.mjs <slug> [target-dir]");
  process.exit(1);
}
const brief = join(KIT, "clients", slug, "client.yaml");
if (!existsSync(brief)) {
  console.error(`No brief at clients/${slug}/client.yaml. Copy client.example.yaml there and fill it in (or run /sharpen-brief).`);
  process.exit(1);
}
const T = resolve(targetArg ?? join(KIT, "..", `${slug}-site`));
if (existsSync(T) && readdirSync(T).length) {
  console.error(`${T} already exists and isn't empty. Pick another target.`);
  process.exit(1);
}
const run = (cmd, args, cwd = T) => execFileSync(cmd, args, { cwd, stdio: "inherit" });
const step = (s) => console.log(`\n▶ ${s}`);

step("Copying the starter");
cpSync(join(KIT, "starter"), T, {
  recursive: true,
  filter: (src) => !/[/\\](node_modules|dist|\.astro|\.vercel)([/\\]|$)/.test(src) && !src.endsWith("tokens.css"),
});
cpSync(brief, join(T, "client.yaml"));
const assets = join(KIT, "clients", slug, "assets");
if (existsSync(assets)) cpSync(assets, join(T, "public", "assets"), { recursive: true });

step("Installing dependencies");
run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]);
const { parse } = createRequire(join(T, "package.json"))("yaml");
const cfg = parse(readFileSync(join(T, "client.yaml"), "utf8"));
const modules = Object.keys(cfg.modules ?? {});

// cms + admin + forms are always part of a site (docs/MODULES.md); the installer adds dependencies first.
const wanted = [...new Set(["cms", "admin", "forms", ...modules])];
step(`Installing modules: ${wanted.join(", ")}`);
run("node", [join(KIT, "scripts", "install-module.mjs"), T, ...wanted], KIT);
run("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"]);
// enable the always-on modules in the client's copy of the brief (never edits the kit's brief)
const missing = wanted.filter((m) => !modules.includes(m));
if (missing.length) {
  const y = readFileSync(join(T, "client.yaml"), "utf8");
  const add = missing.map((m) => `  ${m}: {}`).join("\n");
  writeFileSync(join(T, "client.yaml"), /^modules:\s*$/m.test(y) ? y.replace(/^modules:\s*$/m, `modules:\n${add}`) : y.replace(/^modules:\s*\{\}\s*$/m, `modules:\n${add}`) + (/^modules:/m.test(y) ? "" : `\nmodules:\n${add}\n`));
}

step("Copying client-facing agent docs, skills and registry components");
for (const f of ["ui-sources.md", "motion-and-3d.md", "reskinning-guide.md", "rules-learned.md", "skill-sources.md"]) {
  mkdirSync(join(T, "docs", "agents"), { recursive: true });
  cpSync(join(KIT, "docs", "agents", f), join(T, "docs", "agents", f));
}
// Claude Code reads .claude/skills/; Cursor reads .cursor/skills/. Same folders, both places.
for (const s of ["setup", "help-me", "setup-guide", "reskin", "add-ui", "add-motion", "unslop", "diagram", "catch-up", "sharpen-brief"]) {
  cpSync(join(KIT, "skills", s), join(T, ".claude", "skills", s), { recursive: true });
  cpSync(join(KIT, "skills", s), join(T, ".cursor", "skills", s), { recursive: true });
}
for (const kind of ["ui", "motion"]) {
  cpSync(join(KIT, "registry", kind), join(T, "src", "components", "registry", kind), {
    recursive: true,
    filter: (src) => !src.endsWith("README.md") && !src.endsWith(".gitkeep"),
  });
}

step("Writing AGENTS.md and README for this client");
const name = cfg.client?.name ?? slug;
const list = (xs) => (xs?.length ? xs.map((x) => `- ${x}`).join("\n") : "- (none)");
const thisClient = `## This client

- **Name:** ${name} (${cfg.client?.type ?? "?"}), ${cfg.client?.domain ?? "?"}, time zone ${cfg.client?.timezone ?? "?"}, currency ${cfg.client?.currency ?? "?"}
- **Vibe:** ${cfg.brand?.vibe ?? "?"} · motion level: ${cfg.motion?.level ?? "expressive"} · hosting tier: ${cfg.hosting?.tier ?? "?"}
- **Modules:** ${wanted.join(", ")}

**Copy rules from the client** (always follow):
${list(cfg.brand?.copy_rules)}

**Notes from the brief:**
${(cfg.notes ?? "").trim() || "(none)"}
`;
for (const f of ["AGENTS.md", "README.md"]) {
  let s = readFileSync(join(T, f), "utf8").replaceAll("{{CLIENT_NAME}}", name);
  if (f === "AGENTS.md") s = s.replace(/## This client[\s\S]*$/, thisClient);
  writeFileSync(join(T, f), s);
}

step("Checking client.yaml");
try {
  run("npm", ["run", "validate", "--silent"]);
} catch {
  console.log("  client.yaml has problems (listed above). Fix them before building.");
}

step("Creating a fresh git repository (nothing committed)");
run("git", ["init", "-q", "-b", cfg.hosting?.production_branch ?? "main"]);
run("git", ["config", "core.hooksPath", ".githooks"]);

const migrations = readdirSync(join(T, "supabase", "migrations")).filter((f) => f.endsWith(".sql")).sort();
console.log(`
✔ ${name} site created at ${T}

Next, for the agent: /new-client continues with theme check, pages, motion pass and content (docs/agents/new-client-workflow.md).

Human steps (not automated, see .env.example for every variable):
  1. Supabase: create a project; run the migrations in order:
${migrations.map((m) => `       supabase/migrations/${m}`).join("\n")}
     Turn off public sign-ups; create staff users with app_metadata.role = admin | editor | demo.
  2. Vercel: create the project from this repo; set the env vars from .env.example (Production + Preview).
  3. Vercel → Settings → Git → Deploy Hooks: create one, set DEPLOY_HOOK_URL (the admin's Publish button).
  4. Email: verify the sending subdomain in Resend (SPF/DKIM); set RESEND_API_KEY and EMAIL_FROM.
  5. Domain + DNS, Google Business Profile, Search Console (see the /setup Launch playbook).
`);
