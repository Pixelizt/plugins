// Helpers for config-driven pages (pure, tested). Kit code.
import type { PageEntry } from "./config/schema.ts";

/** "/private-events" → "Private events", "/" → "Home". */
export function pageTitle(p: Pick<PageEntry, "path" | "title">): string {
  if (p.title) return p.title;
  if (p.path === "/") return "Home";
  const last = p.path.split("/").filter(Boolean).pop()!;
  const words = last.replace(/-/g, " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Astro rest-param value for a path: "/" → undefined, "/menu" → "menu". */
export function slugParam(path: string): string | undefined {
  const s = path.replace(/^\/+|\/+$/g, "");
  return s === "" ? undefined : s;
}
