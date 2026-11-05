// Browser-side CMS calls for the admin (Supabase REST with the signed-in user's token; RLS enforces roles).
// Optimistic concurrency (rule 32): an update only lands if updated_at still matches what the editor loaded.
export interface Session { url: string; anon: string; token: string }
export interface DocRow { key: string; value: unknown; updated_at: string; updated_by: string | null }
export interface HistoryRow { id: number; value: unknown; saved_at: string; saved_by: string | null }

export class ConflictError extends Error {
  constructor() { super("Someone else saved this section since you opened it. Reload to see their changes."); }
}

const headers = (s: Session, extra: Record<string, string> = {}) => ({
  apikey: s.anon, Authorization: `Bearer ${s.token}`, "Content-Type": "application/json", ...extra,
});

async function ok(r: Response): Promise<Response> {
  if (r.status === 401) throw new Error("Your session expired. Sign in again.");
  if (r.status === 403) throw new Error("Your role can't change this section.");
  if (!r.ok) throw new Error(`Save failed (${r.status}): ${(await r.text()).slice(0, 200)}`);
  return r;
}

export async function getDoc(s: Session, key: string): Promise<DocRow | null> {
  const r = await ok(await fetch(`${s.url}/rest/v1/docs?key=eq.${encodeURIComponent(key)}&select=key,value,updated_at,updated_by`, { headers: headers(s) }));
  return ((await r.json()) as DocRow[])[0] ?? null;
}

/** Save. `version` = the updated_at the editor loaded, or null for a section never saved before. */
export async function saveDoc(s: Session, key: string, value: unknown, version: string | null): Promise<DocRow> {
  if (version === null) {
    const r = await fetch(`${s.url}/rest/v1/docs`, {
      method: "POST", headers: headers(s, { Prefer: "return=representation" }), body: JSON.stringify({ key, value }),
    });
    if (r.status === 409) throw new ConflictError();
    return ((await (await ok(r)).json()) as DocRow[])[0]!;
  }
  const r = await ok(await fetch(
    `${s.url}/rest/v1/docs?key=eq.${encodeURIComponent(key)}&updated_at=eq.${encodeURIComponent(version)}`,
    { method: "PATCH", headers: headers(s, { Prefer: "return=representation" }), body: JSON.stringify({ value }) },
  ));
  const rows = (await r.json()) as DocRow[];
  if (!rows.length) throw new ConflictError();
  return rows[0]!;
}

export async function getHistory(s: Session, key: string): Promise<HistoryRow[]> {
  const r = await ok(await fetch(`${s.url}/rest/v1/docs_history?key=eq.${encodeURIComponent(key)}&select=id,value,saved_at,saved_by&order=saved_at.desc&limit=20`, { headers: headers(s) }));
  return (await r.json()) as HistoryRow[];
}

export async function publish(s: Session): Promise<{ ok: boolean; error?: string; changes?: number }> {
  const r = await fetch("/api/publish", { method: "POST", headers: { Authorization: `Bearer ${s.token}` } });
  return (await r.json()) as { ok: boolean; error?: string; changes?: number };
}
