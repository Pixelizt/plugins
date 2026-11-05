// Turn a JSON Schema (from z.toJSONSchema at build time) into editor field descriptions. Pure, tested.
import { humanize } from "../../cms/lib/diff.ts";

export interface JS {
  type?: string | string[];
  label?: string; help?: string; widget?: string; itemLabel?: string;
  properties?: Record<string, JS>; required?: string[];
  items?: JS; additionalProperties?: JS | boolean; propertyNames?: JS;
  enum?: unknown[]; const?: unknown; anyOf?: JS[]; oneOf?: JS[];
  default?: unknown; minimum?: number; maximum?: number; minLength?: number; maxLength?: number; format?: string;
}

export type Kind = "text" | "textarea" | "number" | "boolean" | "select" | "image" | "date" | "datetime" | "color" | "url" | "email" | "tel" | "list" | "tags" | "object" | "record" | "json";

/** Strip optional/nullable wrappers. */
export function unwrap(s: JS | undefined): JS {
  if (!s) return {};
  const alts = s.anyOf ?? s.oneOf;
  if (alts) {
    const real = alts.filter((a) => a.type !== "null");
    if (real.length === 1) return { ...unwrap(real[0]), label: s.label ?? real[0]!.label, help: s.help ?? real[0]!.help, widget: s.widget ?? real[0]!.widget };
  }
  return s;
}

const typeOf = (s: JS) => (Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type);

export function kindOf(raw: JS): Kind {
  const s = unwrap(raw);
  if (s.widget === "image") return "image";
  if (s.widget === "textarea" || s.widget === "richtext") return "textarea";
  if (s.widget && ["date", "datetime", "color", "url", "email", "tel"].includes(s.widget)) return s.widget as Kind;
  if (s.enum) return "select";
  const t = typeOf(s);
  if (t === "string") return s.format === "email" ? "email" : s.format === "uri" ? "url" : s.format === "date" ? "date" : (s.maxLength ?? 0) > 300 ? "textarea" : "text";
  if (t === "number" || t === "integer") return "number";
  if (t === "boolean") return "boolean";
  if (t === "array") return typeOf(unwrap(s.items)) === "object" ? "list" : "tags";
  if (t === "object") {
    if (s.properties && Object.keys(s.properties).length) return s.properties.src && s.properties.alt ? "image" : "object";
    if (s.additionalProperties && typeof s.additionalProperties === "object") return "record";
  }
  return "json";
}

export const labelOf = (s: JS, key: string) => unwrap(s).label ?? s.label ?? humanize(key);

/** A sensible empty value for a new item. */
export function blank(raw: JS): unknown {
  const s = unwrap(raw);
  if (s.default !== undefined) return structuredClone(s.default);
  switch (kindOf(s)) {
    case "number": return s.minimum ?? 0;
    case "boolean": return false;
    case "select": return s.enum?.[0] ?? "";
    case "list": case "tags": return [];
    case "record": return {};
    case "image": return { src: "", alt: "" };
    case "object": return Object.fromEntries(Object.entries(s.properties ?? {}).filter(([k]) => s.required?.includes(k)).map(([k, v]) => [k, blank(v)]));
    default: return "";
  }
}

/** How a list item is named in the UI. */
export function itemTitle(item: unknown, s: JS, i: number): string {
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const f of [unwrap(s).itemLabel, "name", "title", "label", "q", "question", "alt", "id"].filter(Boolean) as string[]) {
      const v = o[f];
      if (typeof v === "string" && v.trim()) return v.length > 60 ? v.slice(0, 60) + "…" : v;
    }
  }
  return `Item ${i + 1}`;
}

/** Primitive columns of a list item, for generic CSV import/export. */
export function csvKeys(itemSchema: JS): string[] {
  const s = unwrap(itemSchema);
  return Object.entries(s.properties ?? {}).filter(([, v]) => ["text", "textarea", "number", "boolean", "select", "tags", "date", "url", "email", "tel", "color"].includes(kindOf(v))).map(([k]) => k);
}
