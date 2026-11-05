// Loads and validates client.yaml. Pure functions are exported for tests.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { ClientConfig } from "./schema.ts";

export class ConfigError extends Error {}

/** Paths of every string value that is exactly "TODO" (or starts with "TODO:"). */
export function findTodos(value: unknown, path: string[] = []): string[] {
  if (typeof value === "string") return /^TODO\b/.test(value.trim()) ? [path.join(".")] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findTodos(v, [...path, String(i)]));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => findTodos(v, [...path, k]));
  return [];
}

/** Validate an already-parsed object. Throws ConfigError with a readable message. */
export function validateConfig(raw: unknown, opts: { allowTodo?: boolean } = {}): ClientConfig {
  const todos = findTodos(raw);
  if (todos.length && !opts.allowTodo) {
    throw new ConfigError(
      `client.yaml still has TODO values (fill them before a production build):\n  - ${todos.join("\n  - ")}`,
    );
  }
  const result = ClientConfig.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`client.yaml is invalid:\n${z.prettifyError(result.error)}`);
  }
  const cfg = result.data;
  const paths = cfg.pages.map((p) => p.path);
  const dupes = paths.filter((p, i) => paths.indexOf(p) !== i);
  if (dupes.length) throw new ConfigError(`client.yaml pages: duplicate paths ${dupes.join(", ")}`);
  if (!paths.includes("/")) throw new ConfigError('client.yaml pages: a home page with path "/" is required');
  return cfg;
}

export function loadConfig(file = "client.yaml", opts: { allowTodo?: boolean } = {}): ClientConfig {
  const full = resolve(process.cwd(), file);
  let text: string;
  try {
    text = readFileSync(full, "utf8");
  } catch {
    throw new ConfigError(`client.yaml not found at ${full}. Copy it from the kit's clients/<slug>/client.yaml.`);
  }
  return validateConfig(parse(text), opts);
}
