#!/usr/bin/env node
// Install kit modules into a client project. Used by /new-client and /add-module.
// Usage: node scripts/install-module.mjs <client-dir> <module> [module...]   (dependencies are added first)
// What it does, per module (docs/BOILERPLATE-BOUNDARIES.md §1):
//   modules/<m>/** (minus migrations/, env.example, AGENTS.md, CHANGELOG.md) → <client>/src/modules/<m>/
//   modules/<m>/migrations/*.sql → <client>/supabase/migrations/<NN>_<m>_<file>  (NN keeps dependency order)
//   modules/<m>/env.example      → appended to <client>/.env.example (once)
//   modules/<m>/AGENTS.md        → inserted into <client>/AGENTS.md at the module-rules marker (replaced on reinstall)
//   client.yaml                  → reminds you to add modules.<m> (it does not edit the brief)
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [clientArg, ...wanted] = process.argv.slice(2);
if (!clientArg || !wanted.length) {
  console.error("Usage: node scripts/install-module.mjs <client-dir> <module> [module...]");
  process.exit(1);
}
const CLIENT = resolve(clientArg);
if (!existsSync(join(CLIENT, "astro.config.ts"))) throw new Error(`${CLIENT} doesn't look like a client site (no astro.config.ts)`);

const manifest = (m) => {
  const f = join(KIT, "modules", m, "module.json");
  if (!existsSync(f)) throw new Error(`Unknown module "${m}" (no modules/${m}/module.json)`);
  return JSON.parse(readFileSync(f, "utf8"));
};

// dependency order, depth first
const order = [];
const visit = (m, stack = []) => {
  if (order.includes(m)) return;
  if (stack.includes(m)) throw new Error(`Dependency cycle: ${[...stack, m].join(" → ")}`);
  for (const d of manifest(m).dependsOn ?? []) visit(d, [...stack, m]);
  order.push(m);
};
wanted.forEach((m) => visit(m));

const migDir = join(CLIENT, "supabase", "migrations");
mkdirSync(migDir, { recursive: true });
const existingMigs = readdirSync(migDir).filter((f) => f.endsWith(".sql"));
const nextNum = () => String(Math.max(0, ...existingMigs.map((f) => parseInt(f, 10)).filter(Number.isFinite)) + 1).padStart(2, "0");

// seed/ is copied into the module too (its tests use it), and into src/content once (below)
// AGENTS.md is copied into the module folder; the client's root AGENTS.md only gets a one-line index entry
// (keeps every session's always-loaded rules small; the full rules load when an agent opens the module).
const SKIP = new Set(["migrations", "env.example", "CHANGELOG.md"]);
const pkgPath = join(CLIENT, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
let depsAdded = false;
for (const m of order) {
  const src = join(KIT, "modules", m);
  const dest = join(CLIENT, "src", "modules", m);
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src)) if (!SKIP.has(entry)) cpSync(join(src, entry), join(dest, entry), { recursive: true });

  // migrations: copy each once (matched by module + original file name)
  const mdir = join(src, "migrations");
  if (existsSync(mdir)) {
    for (const f of readdirSync(mdir).filter((f) => f.endsWith(".sql")).sort()) {
      const tag = `_${m}_${f}`;
      if (existingMigs.some((e) => e.endsWith(tag))) continue;
      const name = `${nextNum()}${tag}`;
      cpSync(join(mdir, f), join(migDir, name));
      existingMigs.push(name);
    }
  }

  // npm dependencies declared in module.json → client package.json
  for (const [dep, range] of Object.entries(manifest(m).npm ?? {})) {
    if (!pkg.dependencies?.[dep]) { (pkg.dependencies ??= {})[dep] = range; depsAdded = true; }
  }

  // seed content: copied only if the client doesn't have that file yet (never overwrite client content)
  const seedDir = join(src, "seed");
  if (existsSync(seedDir)) {
    for (const f of readdirSync(seedDir)) {
      const to = join(CLIENT, "src", "content", f);
      if (!existsSync(to)) cpSync(join(seedDir, f), to);
    }
  }

  // env vars
  const envSrc = join(src, "env.example");
  const envDest = join(CLIENT, ".env.example");
  if (existsSync(envSrc)) {
    const cur = existsSync(envDest) ? readFileSync(envDest, "utf8") : "";
    const block = readFileSync(envSrc, "utf8").trim();
    if (!cur.includes(block.split("\n")[0])) writeFileSync(envDest, cur.trimEnd() + "\n\n" + block + "\n");
  }

  // agent rules
  const rulesSrc = join(src, "AGENTS.md");
  const agents = join(CLIENT, "AGENTS.md");
  if (existsSync(rulesSrc) && existsSync(agents)) {
    let a = readFileSync(agents, "utf8");
    const start = `<!-- module:${m}:start -->`;
    const end = `<!-- module:${m}:end -->`;
    const info = manifest(m);
    const block = `${start}\n- **${m}** ${info.version}: ${(info.description ?? "").replace(/\.?$/, ".")} Rules: \`src/modules/${m}/AGENTS.md\` (read before changing this module or its sections).\n${end}`;
    const marker = "<!-- MODULE RULES:";
    if (a.includes(start)) a = a.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block);
    else if (a.includes(marker)) {
      // keep install (dependency) order: add after the last module line, before the next section
      const from = a.indexOf(marker);
      const next = a.indexOf("\n## ", from);
      const at = next === -1 ? a.length : next;
      a = a.slice(0, at).trimEnd() + "\n\n" + block + "\n" + a.slice(at);
    } else a += "\n" + block + "\n";
    writeFileSync(agents, a);
  }
  console.log(`installed ${m}@${manifest(m).version}`);
}

if (depsAdded) {
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("package.json: new dependencies added. Run npm install.");
}

const yaml = existsSync(join(CLIENT, "client.yaml")) ? readFileSync(join(CLIENT, "client.yaml"), "utf8") : "";
const notEnabled = order.filter((m) => !new RegExp(`^\\s{2}${m}:`, "m").test(yaml));
if (notEnabled.length) console.log(`\nNext: enable in client.yaml → modules: ${notEnabled.map((m) => `${m}: {}`).join(", ")} (see each module's AGENTS.md for settings)`);
console.log("Then run the new migrations in supabase/migrations/ and set the new variables in .env.example.");
