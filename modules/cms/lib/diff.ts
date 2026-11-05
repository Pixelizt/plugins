// What changed between two versions of a CMS document, in words an owner can read.
// Used by the publish email and the admin History dialog. Pure, runs in Node and the browser.
// Ported from the reference project's src/admin/diff.js + api/notify.js; labels now come from the
// document's schema (z.toJSONSchema → `label` meta), so nothing is listed twice (rule 1).

export interface JsonSchema {
  type?: string | string[];
  label?: string;
  itemLabel?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  anyOf?: JsonSchema[];
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);

/** A plain decimal number as text ("24", "-1.5", ".5"). Not hex, not "Infinity", not "1e3". */
export const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Normalizes a value for comparison: null, undefined, "" and empty lists or objects are all "missing"; a numeric
 * string equals the number ("24" is 24); strings are trimmed; object key order does not matter.
 * Note that "007" and "7" are the same number, so a code field should not rely on leading zeros.
 * The one rule for the History diff, the publish email and the CSV import preview (admin imports it from here).
 */
export function canon(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "boolean") return String(v);
  if (typeof v === "string") {
    const s = v.trim();
    return s !== "" && NUMBER.test(s) ? String(Number(s)) : s;
  }
  if (Array.isArray(v)) {
    const parts = v.map(canon);
    return parts.every((p) => p === "") ? "" : `[${parts.join("\u0001")}]`;
  }
  if (isObj(v)) {
    const out = Object.keys(v)
      .sort()
      .map((k) => [k, canon(v[k])] as const)
      .filter(([, c]) => c !== "")
      .map(([k, c]) => `${k}=${c}`);
    return out.length ? `{${out.join("\u0001")}}` : "";
  }
  return String(v);
}

export const alike = (a: unknown, b: unknown) => a === b || canon(a) === canon(b);

/** Unwrap optional/nullable anyOf wrappers that toJSONSchema produces. */
function unwrap(s: JsonSchema | undefined): JsonSchema | undefined {
  if (!s) return s;
  if (s.anyOf) return unwrap(s.anyOf.find((x) => x.type !== "null")) ?? s;
  return s;
}

export const humanize = (key: string) => {
  const w = key.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1);
};

const fieldLabel = (schema: JsonSchema | undefined, key: string) =>
  unwrap(schema?.properties?.[key])?.label ?? humanize(key);

const short = (v: unknown, n = 60) => {
  const s = (typeof v === "object" ? JSON.stringify(v) : String(v ?? "")).replace(/\s+/g, " ").trim();
  return s.length > n ? s.slice(0, n) + "…" : s;
};
const shown = (v: unknown) => (canon(v) === "" ? "(empty)" : `"${short(v)}"`);

const NAME_FIELDS = ["name", "title", "label", "q", "question", "heading", "alt", "id"];

export function itemName(item: unknown, schema?: JsonSchema, i = 0): string {
  if (!isObj(item)) return short(item) || `Item ${i + 1}`;
  const pref = schema?.itemLabel;
  for (const f of pref ? [pref, ...NAME_FIELDS] : NAME_FIELDS) {
    if (typeof item[f] === "string" && (item[f] as string).trim()) return short(item[f]);
  }
  return `Item ${i + 1}`;
}

function itemKey(item: unknown, i: number): string {
  if (isObj(item)) {
    for (const f of ["id", "slug", "key", "name", "title", "q"]) {
      const v = item[f];
      if ((typeof v === "string" && v.trim()) || typeof v === "number") return `${f}:${v}`;
    }
  }
  return `#${i}`;
}

/** Keyed list diff: matches items by id/slug/name so a rename reads as a change, not a swap. */
export function diffList(before: unknown[], after: unknown[], itemSchema?: JsonSchema): string[] {
  const key = (list: unknown[]) => {
    const seen = new Map<string, number>();
    return list.map((x, i) => {
      const k = itemKey(x, i);
      const n = (seen.get(k) ?? 0) + 1;
      seen.set(k, n);
      return { k: n > 1 ? `${k}#${n}` : k, x, i };
    });
  };
  const a = key(before);
  const b = key(after);
  const aMap = new Map(a.map((e) => [e.k, e]));
  const bKeys = new Set(b.map((e) => e.k));
  const lines: string[] = [];
  for (const e of b) {
    const old = aMap.get(e.k);
    if (!old) lines.push(`Added ${itemName(e.x, itemSchema, e.i)}`);
    else if (!alike(old.x, e.x)) {
      const fields =
        isObj(old.x) && isObj(e.x)
          ? [...new Set([...Object.keys(old.x), ...Object.keys(e.x)])]
              .filter((f) => f !== "id" && !alike((old.x as Record<string, unknown>)[f], (e.x as Record<string, unknown>)[f]))
              .map((f) => fieldLabel(itemSchema, f))
          : [];
      lines.push(`Changed ${itemName(e.x, itemSchema, e.i)}${fields.length ? ` (${fields.join(", ")})` : ""}`);
    }
  }
  for (const e of a) if (!bKeys.has(e.k)) lines.push(`Removed ${itemName(e.x, itemSchema, e.i)}`);
  const moved = lines.length === 0 && !alike(before, after);
  return moved ? ["Reordered"] : lines;
}

/** Lines describing how a whole document changed. `before` undefined = first save. */
export function diffDoc(before: unknown, after: unknown, schema?: JsonSchema): string[] {
  if (before === undefined) return ["First version saved"];
  if (alike(before, after)) return [];
  const s = unwrap(schema);
  if (Array.isArray(before) && Array.isArray(after)) return diffList(before, after, unwrap(s?.items));
  if (isObj(before) && isObj(after)) {
    const lines: string[] = [];
    for (const k of [...new Set([...Object.keys(before), ...Object.keys(after)])]) {
      const x = before[k];
      const y = after[k];
      if (alike(x, y)) continue;
      const label = fieldLabel(s, k);
      if (Array.isArray(x) || Array.isArray(y)) {
        const sub = diffList(Array.isArray(x) ? x : [], Array.isArray(y) ? y : [], unwrap(unwrap(s?.properties?.[k])?.items));
        lines.push(...sub.map((l) => `${label}: ${l}`));
      } else if (isObj(x) || isObj(y)) lines.push(`${label} changed`);
      else lines.push(`${label}: ${shown(x)} → ${shown(y)}`);
    }
    return lines;
  }
  return [`${shown(before)} → ${shown(after)}`];
}
