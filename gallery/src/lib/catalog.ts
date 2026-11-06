// Reads catalog.yaml, module.json and registry READMEs at build time.
// The gallery does not keep a second copy of the module list.
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { MODULE_CATEGORY, SUMMARY, categoryLabel, displayName } from "./categories.ts";

export interface CatalogEntry {
  slug: string;
  kind: "module" | "block";
  name: string;
  description: string;
  body: string;
  briefNote: string;
  status: string;
  version: string;
  required: boolean;
  dependsOn: string[];
  origin: string;
  blockedBy: string;
  repoPath: string;
  category: string;
  categoryLabel: string;
  blockType: string;
  motionLevel: string;
  exists: boolean;
  searchable: string;
}

interface CatalogFile {
  modules?: Array<Record<string, unknown>>;
  registry?: Array<Record<string, unknown>>;
}

const FALLBACK: Record<string, string> = {
  starter: "Astro skeleton, client.yaml config, tokens, layout, SEO, security headers, CI and secret scan.",
  payments: "Online payments. Listed as later in catalog.yaml, waiting on a provider choice. No module folder yet.",
  i18n: "A second language. Listed as later in catalog.yaml. English only for now. No module folder yet.",
};

function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "catalog.yaml")) && existsSync(join(dir, "gallery", "package.json"))) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error("Could not find catalog.yaml from the gallery. Run it inside the plugins repo.");
}

function plain(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*_]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstParagraph(markdown: string): string {
  const lines = markdown.split("\n");
  const buf: string[] = [];
  let started = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!started) {
      if (!trimmed || trimmed.startsWith("#")) continue;
      started = true;
    }
    if (!trimmed && buf.length) break;
    if (trimmed.startsWith("#")) break;
    if (trimmed) buf.push(trimmed);
  }
  const text = plain(buf.join(" "));
  const cut = text.split(/Ported from|New design\b/i)[0]?.trim() ?? "";
  return cut || text;
}

function readmeUse(markdown: string): string {
  const line = markdown
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith("use for:"));
  if (!line) return firstParagraph(markdown);
  return line.replace(/^use for:\s*/i, "").split(/don't use for:/i)[0]?.trim().replace(/\.$/, "") ?? "";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function oneLine(slug: string, fallback: string): string {
  const written = SUMMARY[slug];
  if (written) return written;
  const sentence = fallback.split(". ")[0]?.replace(/\.$/, "").trim() ?? "";
  if (!sentence) return fallback;
  return sentence.length > 110 ? `${sentence.slice(0, 107).trim()}…` : sentence;
}

let cached: { root: string; entries: CatalogEntry[] } | null = null;

export function loadCatalog(): { root: string; entries: CatalogEntry[] } {
  if (cached) return cached;
  const root = repoRoot();
  const raw = parse(readFileSync(join(root, "catalog.yaml"), "utf8")) as CatalogFile;
  const entries: CatalogEntry[] = [];

  for (const mod of raw.modules ?? []) {
    const slug = asString(mod.name);
    if (!slug) continue;
    const folder = join(root, "modules", slug);
    const moduleJsonPath = join(folder, "module.json");
    const agentsPath = join(folder, "AGENTS.md");
    let description = FALLBACK[slug] ?? "";
    if (existsSync(moduleJsonPath)) {
      const json = JSON.parse(readFileSync(moduleJsonPath, "utf8")) as { description?: string };
      if (json.description) description = json.description;
    }
    const body = existsSync(agentsPath) ? firstParagraph(readFileSync(agentsPath, "utf8")) : description;
    const category = MODULE_CATEGORY[slug] ?? (asString(mod.status) === "later" ? "later" : "foundation");
    const version = asString(mod.version);
    const status = asString(mod.status) || "planned";
    entries.push({
      slug,
      kind: "module",
      name: displayName(slug),
      description: oneLine(slug, description),
      body: body || description,
      briefNote: "",
      status,
      version,
      required: asBool(mod.required),
      dependsOn: asList(mod.depends_on),
      origin: asString(mod.origin),
      blockedBy: asString(mod.blocked_by),
      repoPath: slug === "starter" ? "starter/" : existsSync(folder) ? `modules/${slug}/` : "",
      category,
      categoryLabel: categoryLabel(category),
      blockType: "",
      motionLevel: "",
      exists: slug === "starter" ? existsSync(join(root, "starter", "package.json")) : existsSync(folder),
      searchable: [slug, displayName(slug), description, body, category, status].join(" ").toLowerCase(),
    });
  }

  for (const block of raw.registry ?? []) {
    const slug = asString(block.name);
    if (!slug) continue;
    const rel = asString(block.path);
    const readmePath = rel ? join(root, rel, "README.md") : "";
    const readme = readmePath && existsSync(readmePath) ? readFileSync(readmePath, "utf8") : "";
    const description = readme ? readmeUse(readme) : "";
    const type = asString(block.type) || "ui";
    const category = type === "motion" ? "motion" : "ui";
    entries.push({
      slug,
      kind: "block",
      name: displayName(slug),
      description: oneLine(slug, description),
      body: readme ? firstParagraph(readme) : description,
      briefNote: "",
      status: "",
      version: "",
      required: false,
      dependsOn: asList(block.deps),
      origin: "",
      blockedBy: "",
      repoPath: rel,
      category,
      categoryLabel: categoryLabel(category),
      blockType: type,
      motionLevel: asString(block.motion_level),
      exists: rel ? existsSync(join(root, rel)) : false,
      searchable: [slug, displayName(slug), description, type, category].join(" ").toLowerCase(),
    });
  }

  const slugs = entries.map((e) => e.slug);
  const dupes = slugs.filter((slug, i) => slugs.indexOf(slug) !== i);
  if (dupes.length) throw new Error(`catalog slugs collide: ${[...new Set(dupes)].join(", ")}. Detail URLs would be ambiguous.`);

  cached = { root, entries };
  return cached;
}

export function modulesOf(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.filter((e) => e.kind === "module");
}

export function blocksOf(entries: CatalogEntry[]): CatalogEntry[] {
  return entries.filter((e) => e.kind === "block");
}

export function findEntry(entries: CatalogEntry[], slug: string): CatalogEntry | undefined {
  return entries.find((e) => e.slug === slug);
}

export function sketchKind(entry: CatalogEntry): string {
  if (entry.kind === "block") return entry.blockType === "motion" ? "motion" : "block";
  switch (entry.slug) {
    case "menu":
      return "menu";
    case "table-booking":
    case "space-booking":
    case "booking-core":
      return "booking";
    case "admin":
      return "admin";
    case "forms":
      return "form";
    case "cms":
      return "cms";
    case "meal-plans":
      return "plans";
    case "whatsapp":
      return "chat";
    case "content-lists":
      return "lists";
    case "payments":
    case "i18n":
      return "later";
    default:
      return "page";
  }
}
