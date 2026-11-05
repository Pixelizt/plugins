// Show how a client repo differs from the kit's frozen files, and optionally copy those files over.
// Default is a report. `--apply` overwrites frozen paths only. Content, sections and client.yaml are never touched.
// Migrations are reported and never copied: a released migration is not edited in place.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const SKIP = new Set(["node_modules", "dist", ".astro"]);

export function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) out.push(...walk(abs).map((rel) => join(name, rel)));
    else out.push(name);
  }
  return out;
}

function pair(from, to, rel) {
  return { from, to, rel };
}

export function frozenPairs(kit, client) {
  const pairs = walk(join(kit, "starter", "src", "kit")).map((rel) =>
    pair(join(kit, "starter", "src", "kit", rel), join(client, "src", "kit", rel), join("src", "kit", rel)),
  );
  const mods = join(client, "src", "modules");
  if (!existsSync(mods)) return pairs;
  for (const name of readdirSync(mods)) {
    for (const part of ["server", "lib", "routes", "cron", "module.ts", "module.json"]) {
      const src = join(kit, "modules", name, part);
      if (!existsSync(src)) continue;
      if (statSync(src).isDirectory()) {
        for (const rel of walk(src)) {
          pairs.push(pair(join(src, rel), join(mods, name, part, rel), join("src", "modules", name, part, rel)));
        }
      } else {
        pairs.push(pair(src, join(mods, name, part), join("src", "modules", name, part)));
      }
    }
  }
  return pairs;
}

export function classify(pairs) {
  return pairs.map((item) => {
    const kitText = existsSync(item.from) ? readFileSync(item.from, "utf8") : null;
    const clientText = existsSync(item.to) ? readFileSync(item.to, "utf8") : null;
    const status = clientText === null ? "missing" : kitText === clientText ? "same" : "differs";
    return { ...item, status };
  });
}

const FORBIDDEN = /(^|\/)(client\.yaml|src\/content\/|src\/sections\/|src\/components\/|supabase\/migrations\/)/;

export function assertSafe(rel) {
  if (FORBIDDEN.test(rel.replaceAll("\\", "/"))) throw new Error(`refusing to touch ${rel}`);
}

export function applyPairs(rows) {
  let n = 0;
  for (const row of rows) {
    if (row.status === "same") continue;
    assertSafe(row.rel);
    mkdirSync(dirname(row.to), { recursive: true });
    cpSync(row.from, row.to);
    n += 1;
  }
  return n;
}

export function report(kit, client) {
  const rows = classify(frozenPairs(resolve(kit), resolve(client)));
  const changed = rows.filter((row) => row.status !== "same");
  return { rows, changed };
}

function isClient(dir) {
  return existsSync(join(dir, "astro.config.ts")) && existsSync(join(dir, "src", "kit"));
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invoked) {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const client = args.find((arg) => !arg.startsWith("--"));
  if (!client) {
    console.error("Usage: node scripts/kit-diff.mjs <client-dir> [--apply]");
    process.exit(1);
  }
  const kit = resolve(new URL("..", import.meta.url).pathname);
  const dir = resolve(client);
  if (!isClient(dir)) {
    console.error(`${dir} does not look like a client site (needs astro.config.ts and src/kit).`);
    process.exit(1);
  }
  const { changed } = report(kit, dir);
  if (!changed.length) console.log("Frozen kit files match.");
  for (const row of changed) console.log(`${row.status}\t${row.rel}`);
  console.log("Migrations are not copied. Compare supabase/migrations yourself and add a new file if the schema changed.");
  if (apply) console.log(`Updated ${applyPairs(changed)} file(s).`);
  else if (changed.length) console.log("Report only. Re-run with --apply to copy these frozen files.");
}
