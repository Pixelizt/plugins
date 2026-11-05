// Supabase Auth (password grant) with plain fetch. Session in localStorage; refreshed before expiry.
export interface Session { access_token: string; refresh_token: string; expires_at: number; email: string; role: "admin" | "editor" | "demo" | "" }
const KEY = "kit-admin-session";

export function decodeRole(token: string): Session["role"] {
  try {
    const p = JSON.parse(atob(token.split(".")[1]!.replace(/-/g, "+").replace(/_/g, "/")));
    const r = p?.app_metadata?.role;
    return r === "admin" || r === "editor" || r === "demo" ? r : "";
  } catch { return ""; }
}

function toSession(j: { access_token: string; refresh_token: string; expires_in: number; user?: { email?: string } }): Session {
  return { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000, email: j.user?.email ?? "", role: decodeRole(j.access_token) };
}

export async function signIn(url: string, anon: string, email: string, password: string): Promise<Session> {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(r.status === 400 ? "Wrong email or password." : `Sign-in failed (${r.status}).`);
  const s = toSession(await r.json());
  localStorage.setItem(KEY, JSON.stringify(s));
  return s;
}

export async function current(url: string, anon: string): Promise<Session | null> {
  const raw = localStorage.getItem(KEY);
  if (!raw) return null;
  const s = JSON.parse(raw) as Session;
  if (s.expires_at - Date.now() > 60_000) return s;
  const r = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: anon, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: s.refresh_token }) });
  if (!r.ok) { localStorage.removeItem(KEY); return null; }
  const fresh = toSession(await r.json());
  localStorage.setItem(KEY, JSON.stringify(fresh));
  return fresh;
}

export function signOut() { localStorage.removeItem(KEY); }
