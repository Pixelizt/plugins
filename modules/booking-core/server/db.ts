// Database access for bookings: PostgREST with the service key (server only). The two writes that matter go
// through the Postgres functions create_booking / set_booking_status, which lock and re-check capacity.
import { serviceRest, type Env } from "../../../kit/server/supabase.ts";
import { oneLine } from "../../../kit/lib/text.ts";
import type { Block, Kind, Occupancy, Resource, Status } from "../lib/capacity.ts";

export const iso = (ms: number) => encodeURIComponent(new Date(ms).toISOString());
const inList = (ids: string[]) => `in.(${ids.map((i) => `"${i.replace(/["\\]/g, "")}"`).join(",")})`;

/** A booking as the server reads it back (no token hash, no IP hash). */
export interface BookingRow {
  id: string;
  created_at: string;
  kind: Kind;
  resource_id: string;
  starts_at: string;
  ends_at: string;
  party_size: number;
  units: number;
  status: Status;
  hold_until: string | null;
  source: "web" | "staff";
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  fields: Record<string, string>;
  facts: [string, string][];
  delivery: Record<string, string>;
  decided_by: string | null;
  decided_at: string | null;
  reminded_at: string | null;
}
export const BOOKING_COLUMNS = "id,created_at,kind,resource_id,starts_at,ends_at,party_size,units,status,hold_until,source,name,email,phone,notes,fields,facts,delivery,decided_by,decided_at,reminded_at";

async function json<T>(r: Response, what: string): Promise<T> {
  if (!r.ok) throw new Error(`${what}: Supabase ${r.status} ${oneLine(await r.text(), 160)}`);
  return (await r.json()) as T;
}

export async function rpc<T>(fn: string, args: Record<string, unknown>, env: Env): Promise<T> {
  return json<T>(await serviceRest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(args) }, env), fn);
}

/** Bookings that may hold capacity on these resources around [from, to). Status filtering is finished in lib/capacity. */
export async function loadOccupancy(resourceIds: string[], from: number, to: number, env: Env): Promise<Occupancy[]> {
  if (!resourceIds.length) return [];
  const q = `bookings?select=resource_id,starts_at,ends_at,units,status,hold_until&resource_id=${encodeURIComponent(inList(resourceIds))}&status=in.(pending,confirmed)&starts_at=lt.${iso(to)}&ends_at=gt.${iso(from)}&limit=5000`;
  return json<Occupancy[]>(await serviceRest(q, {}, env), "occupancy");
}

export async function loadBlocks(from: number, to: number, env: Env): Promise<Block[]> {
  const q = `booking_blocks?select=kind,resource_id,starts_at,ends_at&starts_at=lt.${iso(to)}&ends_at=gt.${iso(from)}&limit=1000`;
  return json<Block[]>(await serviceRest(q, {}, env), "blocks");
}

/** How many online bookings this hashed IP made since `since` (capped at `max`). */
export async function recentFromIp(ipHash: string, since: number, max: number, env: Env): Promise<number> {
  const q = `bookings?select=id&source=eq.web&ip_hash=eq.${ipHash}&created_at=gte.${iso(since)}&limit=${max}`;
  return (await json<unknown[]>(await serviceRest(q, {}, env), "rate limit")).length;
}

export async function getBooking(id: string, env: Env, withTokenHash = false): Promise<(BookingRow & { cancel_token_hash?: string | null }) | null> {
  if (!isUuid(id)) return null;
  const cols = BOOKING_COLUMNS + (withTokenHash ? ",cancel_token_hash" : "");
  const rows = await json<BookingRow[]>(await serviceRest(`bookings?select=${cols}&id=eq.${id}`, {}, env), "booking");
  return rows[0] ?? null;
}

/** Merge side-effect outcomes into the row's delivery column (rule 20). Never throws. */
export async function recordDelivery(id: string, current: Record<string, string>, add: Record<string, string>, env: Env, extra: Record<string, unknown> = {}) {
  try {
    const r = await serviceRest(`bookings?id=eq.${id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery: { ...current, ...add }, ...extra }) }, env);
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
  } catch (e) {
    console.error(`booking-core: could not record delivery on ${id}: ${(e as Error).message}`);
  }
}

export const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Arguments for create_booking (see the migration). */
export interface CreateArgs {
  p_id: string;
  p_kind: Kind;
  p_candidates: Resource[];
  p_units: number;
  p_starts_at: string;
  p_ends_at: string;
  p_party_size: number;
  p_status: "pending" | "confirmed";
  p_hold_until: string | null;
  p_source: "web" | "staff";
  p_name: string;
  p_email: string | null;
  p_phone: string | null;
  p_notes: string | null;
  p_fields: Record<string, string>;
  p_facts: [string, string][];
  p_cancel_token_hash: string | null;
  p_ip_hash: string | null;
  p_decided_by: string | null;
}
export type CreateResult = { ok: true; id: string; resource_id: string } | { ok: false; reason: "full" | "blocked" | "invalid" };
export type StatusResult =
  | { ok: true; changed: boolean; from: Status; booking: BookingRow }
  | { ok: false; reason: "not_found" | "invalid" | "invalid_transition" | "full" | "past"; from?: Status };
