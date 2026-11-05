// Minimal Supabase REST + Auth helpers for server endpoints (plain fetch, no SDK: small and testable).
// Kit code: do not edit in a client project.
import { cleanEnv } from "../email/send.ts";
import { isRole, roleAtLeast, type Role } from "../lib/roles.ts";

export { roleAtLeast, type Role };

export interface Env { [k: string]: string | undefined }

export function supabaseEnv(env: Env = process.env) {
  const url = cleanEnv(env.PUBLIC_SUPABASE_URL).replace(/\/$/, "");
  const anon = cleanEnv(env.PUBLIC_SUPABASE_ANON_KEY);
  const service = cleanEnv(env.SUPABASE_SERVICE_KEY);
  return { url, anon, service, configured: Boolean(url && service) };
}

/** fetch against PostgREST with the service key (bypasses RLS; server only). */
export async function serviceRest(path: string, init: RequestInit = {}, env: Env = process.env): Promise<Response> {
  const s = supabaseEnv(env);
  if (!s.configured) throw new Error("Supabase is not configured (PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY)");
  return fetch(`${s.url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: s.service, Authorization: `Bearer ${s.service}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

export interface StaffUser { id: string; email: string; role: Role }

/** Who is calling? Verifies the bearer token with Supabase Auth (never trusts a decoded JWT alone). */
export async function staffFromRequest(request: Request, env: Env = process.env): Promise<StaffUser | null> {
  const s = supabaseEnv(env);
  const auth = request.headers.get("authorization") ?? "";
  if (!s.url || !s.anon || !/^Bearer .+/.test(auth)) return null;
  const res = await fetch(`${s.url}/auth/v1/user`, { headers: { apikey: s.anon, Authorization: auth } });
  if (!res.ok) return null;
  const u = (await res.json()) as { id: string; email: string; app_metadata?: { role?: string } };
  const role = u.app_metadata?.role;
  return isRole(role) ? { id: u.id, email: u.email, role } : null;
}

/** Returns the user, or a Response to send back (401/403). Re-check roles in every server function (rule 11). */
export async function requireRole(request: Request, min: Role, env: Env = process.env): Promise<StaffUser | Response> {
  const user = await staffFromRequest(request, env);
  if (!user) return Response.json({ error: "Sign in again" }, { status: 401 });
  if (!roleAtLeast(user.role, min)) return Response.json({ error: `This needs the ${min} role` }, { status: 403 });
  return user;
}
