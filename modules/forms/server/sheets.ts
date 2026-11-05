// Optional Google Sheets copy (D18: opt-in). Ported from the reference project's api/_lib/sheets.js.
// A tab per form plus "All", headers created on first use, new columns appended (old data never shifts).
// Signs a service-account JWT with Node's crypto: no Google SDK.
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://sheets.googleapis.com/v4/spreadsheets/";
const timed = () => AbortSignal.timeout(8000);

let cached: { email: string; token: string; until: number } | null = null;
export const _reset = () => { cached = null; };

const b64url = (b: string | Buffer) => Buffer.from(b).toString("base64url");

/** GOOGLE_SERVICE_ACCOUNT_JSON → credentials. Tolerates pasted invisible spaces and \n-escaped keys (rule 24). */
export function account(raw: string | undefined): { email: string; key: string } | null {
  if (!raw) return null;
  try {
    const j = JSON.parse(raw.replace(/[   ]/g, " ").replace(/[​‌‍﻿]/g, "").trim());
    if (!j.client_email || !j.private_key) return null;
    return { email: j.client_email, key: String(j.private_key).replace(/\\n/g, "\n") };
  } catch {
    return null;
  }
}

/** The bare id or the whole URL copied from the browser. */
export function sheetIdOf(v: string | undefined): string {
  const s = String(v ?? "").trim();
  const id = s.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/)?.[1] ?? s;
  return /^[A-Za-z0-9_-]{5,200}$/.test(id) ? id : "";
}

const range = (tab: string, cells: string) => `'${tab.replace(/'/g, "''")}'!${cells}`;

async function token(acc: { email: string; key: string }) {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.email === acc.email && cached.until > now + 60) return cached.token;
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: acc.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(acc.key);
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${head}.${claims}.${b64url(sig)}`,
    signal: timed(),
  });
  if (!r.ok) throw new Error(`Google sign-in ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in?: number };
  cached = { email: acc.email, token: j.access_token, until: now + (Number(j.expires_in) || 3600) };
  return cached.token;
}

type Call = (path: string, method?: string, body?: unknown) => Promise<any>;
async function open(env: Record<string, string | undefined>): Promise<Call | null> {
  const acc = account(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const id = sheetIdOf(env.GOOGLE_SHEET_ID);
  if (!acc || !id) return null;
  const t = await token(acc);
  return async (path, method = "GET", body) => {
    const r = await fetch(API + encodeURIComponent(id) + path, {
      method, headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined, signal: timed(),
    });
    if (!r.ok) throw new Error(`Google Sheets ${r.status} ${(await r.text()).slice(0, 160)}`);
    return r.json();
  };
}

export interface SheetRow { tab: string; columns: string[]; values: Record<string, string> }

export async function appendRows(rows: SheetRow[], env: Record<string, string | undefined>): Promise<string> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_JSON && !env.GOOGLE_SHEET_ID) return "off";
  const call = await open(env);
  if (!call) return "error: GOOGLE_SERVICE_ACCOUNT_JSON or GOOGLE_SHEET_ID is set but unusable";
  const meta = await call("?fields=sheets.properties.title");
  const have: string[] = (meta.sheets ?? []).map((s: any) => s.properties?.title);
  const missing = [...new Set(rows.map((r) => r.tab))].filter((t) => !have.includes(t));
  if (missing.length) await call(":batchUpdate", "POST", { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) });
  const heads = await call(`/values:batchGet?${rows.map((r) => `ranges=${encodeURIComponent(range(r.tab, "1:1"))}`).join("&")}`);
  const was: string[][] = rows.map((_, i) => heads.valueRanges?.[i]?.values?.[0] ?? []);
  const headers = rows.map((r, i) => [...was[i]!, ...r.columns.filter((c) => !was[i]!.includes(c))]);
  const changed = rows.map((r, i) => ({ range: range(r.tab, "A1"), values: [headers[i]] })).filter((_, i) => was[i]!.length !== headers[i]!.length);
  if (changed.length) await call("/values:batchUpdate", "POST", { valueInputOption: "RAW", data: changed });
  // RAW: a value starting with "=" is stored as text, never run as a formula
  for (const [i, r] of rows.entries()) {
    await call(`/values/${encodeURIComponent(range(r.tab, "A1"))}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, "POST", {
      values: [headers[i]!.map((c) => r.values[c] ?? "")],
    });
  }
  return "ok";
}

/** Delete rows whose "time" cell is older than `before` ("YYYY-MM-DD HH:MM"), in every tab. Matches by value. */
export async function purgeOlderThan(before: string, env: Record<string, string | undefined>): Promise<string> {
  const call = await open(env);
  if (!call) return "off";
  const meta = await call("?fields=sheets.properties(sheetId,title)");
  const tabs: { sheetId: number; title: string }[] = (meta.sheets ?? []).map((s: any) => s.properties).filter(Boolean);
  if (!tabs.length) return "ok";
  const got = await call(`/values:batchGet?${tabs.map((t) => `ranges=${encodeURIComponent(range(t.title, "A:ZZ"))}`).join("&")}`);
  const requests: unknown[] = [];
  tabs.forEach((t, i) => {
    const rows: string[][] = got.valueRanges?.[i]?.values ?? [];
    const col = (rows[0] ?? []).indexOf("time");
    if (col < 0) return;
    const runs: [number, number][] = [];
    rows.forEach((r, n) => {
      if (n === 0 || !r[col] || !(String(r[col]) < before)) return;
      const last = runs.at(-1);
      if (last && last[1] === n) last[1] = n + 1;
      else runs.push([n, n + 1]);
    });
    runs.reverse().forEach(([a, b]) => requests.push({ deleteDimension: { range: { sheetId: t.sheetId, dimension: "ROWS", startIndex: a, endIndex: b } } }));
  });
  if (requests.length) await call(":batchUpdate", "POST", { requests });
  return "ok";
}
