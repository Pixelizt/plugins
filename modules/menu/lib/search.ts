// Menu search (D23). Pure: runs at build (index) and in the browser (query). No library, no hashing.
// Menus are small, so a linear scan over a precomputed normalized index is instant.
import type { Item } from "./schema.ts";

/** Lowercase, strip accents (NFD), turn punctuation into spaces, collapse spaces. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export interface IndexEntry {
  id: string;
  /** Menu order: the stable tie-break. */
  order: number;
  category: string;
  name: string;
  /** Normalized group, tags and allergens. */
  extra: string;
  /** Normalized description. */
  desc: string;
  /** Raw tag keys, for filtering. */
  tags: string[];
  /** Lowest price, or null when the item has none. */
  price: number | null;
}

/** Built ONCE at build time; the browser receives it as JSON and never re-normalizes items. */
export function buildIndex(items: Pick<Item, "id" | "category" | "group" | "name" | "description" | "prices" | "allergens" | "tags">[]): IndexEntry[] {
  return items.map((it, order) => ({
    id: it.id,
    order,
    category: it.category,
    name: normalize(it.name),
    extra: normalize([it.group ?? "", ...it.tags, ...it.allergens].join(" ")),
    desc: normalize(it.description ?? ""),
    tags: it.tags,
    price: it.prices.length ? Math.min(...it.prices.map((p) => p.price)) : null,
  }));
}

export interface Filters {
  /** Item must have ALL of these tags. */
  tags?: string[];
  /** Cheapest price must be at most this. */
  maxPrice?: number;
  category?: string;
}

/** Lower is better. null = this word does not match. */
function tier(e: IndexEntry, w: string): number | null {
  if (e.name.startsWith(w)) return 0;
  if (e.name.split(" ").some((x) => x.startsWith(w))) return 1;
  if (e.name.includes(w)) return 2;
  if (e.extra.includes(w)) return 3;
  if (e.desc.includes(w)) return 4;
  return null;
}

/**
 * Every query word must match (AND, any order; prefix of a word or substring).
 * Ranking: name starts with it > a name word starts with it > name contains it > group/tags/allergens > description.
 * Ties keep menu order. With no query words, returns the filtered items in menu order.
 */
export function searchItems(index: IndexEntry[], query: string, f: Filters = {}): IndexEntry[] {
  const words = normalize(query).split(" ").filter(Boolean);
  const whole = words.join(" ");
  const scored: { e: IndexEntry; score: number }[] = [];
  for (const e of index) {
    if (f.category && e.category !== f.category) continue;
    if (f.tags?.length && !f.tags.every((t) => e.tags.includes(t))) continue;
    if (f.maxPrice !== undefined && (e.price === null || e.price > f.maxPrice)) continue;
    let score = 0;
    let ok = true;
    for (const w of words) {
      const t = tier(e, w);
      if (t === null) {
        ok = false;
        break;
      }
      score += t;
    }
    if (!ok) continue;
    if (words.length > 1 && e.name.startsWith(whole)) score -= 1; // the whole phrase opens the name
    scored.push({ e, score });
  }
  return scored.sort((a, b) => a.score - b.score || a.e.order - b.e.order).map((s) => s.e);
}
