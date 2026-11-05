// Finds the quote hooks of every installed module: src/modules/<m>/form-hooks.ts (default export: a hook or a list).
// Bundled by Vite (import.meta.glob), so nothing is read from disk at runtime.
import type { FormHook } from "../lib/hooks.ts";

export function collectHooks(found: Record<string, FormHook | FormHook[]>): Record<string, FormHook> {
  const out: Record<string, FormHook> = {};
  for (const [file, exp] of Object.entries(found)) {
    for (const h of Array.isArray(exp) ? exp : [exp]) {
      if (!h || typeof h.name !== "string" || typeof h.quote !== "function") throw new Error(`${file}: default export must be a form hook { name, quote }`);
      if (out[h.name]) throw new Error(`form hook "${h.name}" is defined twice (${file})`);
      out[h.name] = h;
    }
  }
  return out;
}

let cached: Record<string, FormHook> | null = null;
export function formHooks(): Record<string, FormHook> {
  return (cached ??= collectHooks(import.meta.glob<FormHook | FormHook[]>("/src/modules/*/form-hooks.ts", { eager: true, import: "default" })));
}
