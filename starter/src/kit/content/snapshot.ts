// Content snapshot (D33): the build reads every saved CMS document ONCE and bundles it as
// `virtual:kit/content-snapshot`. Pages AND server functions read that same bundle, so a server never prices or
// validates against unpublished edits (they only go live on the next build = Publish).
// Reads the cms module's `docs` table with the SERVICE key (drafts are private, D8). Kit code.
//
// Rule 25, fail loudly: Supabase configured but unreadable → the build fails (CMS_REQUIRED=false overrides,
// local test builds only). Supabase not configured at all → empty snapshot, seed files are used.
import { supabaseEnv, type Env } from "../server/supabase.ts";

export type Snapshot = Record<string, unknown>;
type Log = { info: (m: string) => void; warn: (m: string) => void };

export async function fetchSnapshot(env: Env, log: Log = console): Promise<Snapshot> {
  const { url, service: key } = supabaseEnv(env);
  const required = (env.CMS_REQUIRED ?? "true") !== "false";
  if (!url) {
    log.info("content: Supabase not configured, using seed files from src/content/");
    return {};
  }
  const fail = (msg: string) => {
    if (required) throw new Error(`${msg} Refusing to build from seed files (CMS_REQUIRED=false overrides, local only).`);
    log.warn(`${msg} Using seed files.`);
    return {};
  };
  if (!key) return fail("content: SUPABASE_SERVICE_KEY is not set, so saved content (private drafts) can't be read.");
  try {
    const res = await fetch(`${url}/rest/v1/docs?select=key,value`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
    // "_" is a LIKE wildcard in SQL, so bookkeeping rows (_publish…) are dropped here, not in the query
    const rows = ((await res.json()) as { key: string; value: unknown }[]).filter((r) => !r.key.startsWith("_"));
    log.info(`content: snapshot of ${rows.length} saved document(s): ${rows.map((r) => r.key).join(", ") || "none yet"}`);
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  } catch (e) {
    return fail(`content: could not read saved content from Supabase (${e instanceof Error ? e.message : e}).`);
  }
}
