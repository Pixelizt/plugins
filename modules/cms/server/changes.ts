// What changed since the last publish, for the owner's email. Server only.
// For each document saved after the last publish, compare the version that was live then
// (the newest history row saved at or before that time) with the current one.
import { z } from "zod";
import { serviceRest, type Env } from "../../../kit/server/supabase.ts";
import type { DocDef } from "../../../kit/modules.ts";
import { diffDoc, humanize, type JsonSchema } from "../lib/diff.ts";

export interface SectionChange { key: string; label: string; lines: string[]; by: string[] }

const MAX_LINES = 12;

async function json<T>(r: Response): Promise<T> {
  if (!r.ok) throw new Error(`Supabase answered ${r.status}`);
  return (await r.json()) as T;
}

export async function changesSince(since: string | null, docs: Record<string, DocDef>, env: Env = process.env): Promise<SectionChange[]> {
  const filter = since ? `&updated_at=gt.${encodeURIComponent(since)}` : "";
  const rows = await json<{ key: string; value: unknown; updated_by: string | null }[]>(
    await serviceRest(`docs?select=key,value,updated_by${filter}`, {}, env),
  );
  const out: SectionChange[] = [];
  for (const row of rows.filter((r) => !r.key.startsWith("_"))) {
    let before: unknown = undefined;
    let editors: string[] = [];
    if (since) {
      const live = await json<{ value: unknown }[]>(
        await serviceRest(`docs_history?select=value&key=eq.${encodeURIComponent(row.key)}&saved_at=lte.${encodeURIComponent(since)}&order=saved_at.desc&limit=1`, {}, env),
      );
      before = live[0]?.value;
      const later = await json<{ saved_by: string | null }[]>(
        await serviceRest(`docs_history?select=saved_by&key=eq.${encodeURIComponent(row.key)}&saved_at=gt.${encodeURIComponent(since)}`, {}, env),
      );
      editors = later.map((h) => h.saved_by ?? "");
    }
    const def = docs[row.key];
    const schema = def ? (z.toJSONSchema(def.schema, { unrepresentable: "any" }) as JsonSchema) : undefined;
    const lines = diffDoc(before, row.value, schema);
    if (!lines.length) continue;
    out.push({
      key: row.key,
      label: def?.label ?? humanize(row.key),
      lines: lines.length > MAX_LINES ? [...lines.slice(0, MAX_LINES), `…and ${lines.length - MAX_LINES} more`] : lines,
      by: [...new Set([...editors, row.updated_by ?? ""].filter(Boolean))],
    });
  }
  return out;
}
