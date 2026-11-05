// Content loading: CMS document if one exists, else the seed file in src/content/<key>.json.
// The cms module plugs in by providing src/modules/cms/content-source.ts (no registration needed).
// Kit code: do not edit in a client project.
import { z } from "zod";

type Source = { load: (key: string) => Promise<unknown | undefined> };

const seeds = import.meta.glob<unknown>("/src/content/*.json", { eager: true, import: "default" });
const sources = Object.values(
  import.meta.glob<Source>("/src/modules/*/content-source.ts", { eager: true, import: "default" }),
);

/** The seed file for a content key (src/content/<key>.json), or undefined. The admin uses it as the starting content. */
export const seedOf = (key: string): unknown => seeds[`/src/content/${key}.json`];

/** Production builds drop array items flagged `sample: true` (rule 4: never ship half-finished content). */
export function stripSamples<T>(value: T, drop: boolean): T {
  if (!drop) return value;
  if (Array.isArray(value))
    return value
      .filter((v) => !(v && typeof v === "object" && (v as { sample?: boolean }).sample === true))
      .map((v) => stripSamples(v, drop)) as T;
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, stripSamples(v, drop)])) as T;
  return value;
}

export async function loadDoc<S extends z.ZodType>(key: string, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  let from = "seed";
  for (const s of sources) {
    raw = await s.load(key);
    if (raw !== undefined) {
      from = "cms";
      break;
    }
  }
  if (raw === undefined) raw = seeds[`/src/content/${key}.json`];
  if (raw === undefined) throw new Error(`content "${key}": no CMS document and no src/content/${key}.json seed file`);
  const r = schema.safeParse(raw);
  if (!r.success) throw new Error(`content "${key}" (from ${from}) is invalid:\n${z.prettifyError(r.error)}`);
  if (import.meta.env.DEV) console.info(`[kit] content "${key}" from ${from}`);
  return stripSamples(r.data, import.meta.env.PROD);
}
