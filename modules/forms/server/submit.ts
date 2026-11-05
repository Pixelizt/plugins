// The submission pipeline, ported from the reference project's api/submit.js:
// validate → honeypot → rate limit → [quote hook, if the form names one] → save (Supabase decides success) →
// sheet + team email + customer email in parallel → write each outcome onto the row (rule 20).
// Extras failing never fail the visitor.
import { createHmac } from "node:crypto";
import type { ClientConfig } from "../../../kit/config/schema.ts";
import { serviceRest, supabaseEnv, type Env } from "../../../kit/server/supabase.ts";
import { attempt as attemptStep, listEnv, sendMail } from "../../../kit/email/send.ts";
import { siteUrlOf } from "../../../kit/lib/site.ts";
import { oneLine } from "../../../kit/lib/text.ts";
import type { FormDef, FormsConfig } from "../lib/schema.ts";
import { validateForm, emailOk, type Problem } from "../lib/validate.ts";
import { isQuoteError, type FormHook, type QuoteOutcome } from "../lib/hooks.ts";
import { nowIn } from "../../../kit/lib/time.ts";
import { appendRows, sheetIdOf } from "./sheets.ts";
import { customerMail, teamMail, type MailExtra, type Sub } from "./emails.ts";

const MAX_BODY = 40_000;
const BASE_COLUMNS = ["id", "time", "form", "page"];

export interface Result { status: number; body: { ok: boolean; id?: number; quoted?: boolean; error?: string; fields?: Record<string, Problem> } }

export function ipHash(request: Request, secret: string) {
  const ip = (request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "").split(",")[0]!.trim() || "unknown";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

export async function handleSubmit(
  request: Request,
  ctx: { cfg: ClientConfig; forms: Record<string, FormDef>; conf: FormsConfig; env?: Env; hooks?: Record<string, FormHook>; now?: Date },
): Promise<Result> {
  const env = ctx.env ?? process.env;
  const sb = supabaseEnv(env);
  if (!sb.configured) return { status: 503, body: { ok: false, error: "Enquiries are not set up yet" } };

  const raw = await request.text();
  if (raw.length > MAX_BODY) return { status: 413, body: { ok: false, error: "Too much data" } };
  let body: { form?: unknown; fields?: unknown; page?: unknown; quote?: unknown; _gotcha?: unknown };
  try { body = JSON.parse(raw); } catch { return { status: 400, body: { ok: false, error: "Send the enquiry as JSON" } }; }
  if (!body || typeof body !== "object") return { status: 400, body: { ok: false, error: "Send the enquiry as JSON" } };

  // the hidden field only bots fill in: answer as if all went well and keep nothing
  if (body._gotcha) return { status: 200, body: { ok: true } };

  const formId = typeof body.form === "string" && ctx.conf.forms.includes(body.form) && Object.hasOwn(ctx.forms, body.form) ? body.form : "";
  if (!formId) return { status: 400, body: { ok: false, error: "Unknown form" } };
  const def = ctx.forms[formId]!;
  const checked = validateForm(def, body.fields && typeof body.fields === "object" ? (body.fields as Record<string, unknown>) : {}, ctx.conf.phone_region);
  if (!checked.ok) return { status: 400, body: { ok: false, error: "Check these fields", fields: checked.problems } };
  const page = typeof body.page === "string" && /^\/[^\s]{0,199}$/.test(body.page) ? body.page : "/";
  const ip = ipHash(request, sb.service);

  // rate limit, counted in the table so it holds across serverless instances; if the count fails, let it through
  try {
    const since = new Date(Date.now() - ctx.conf.rate_limit.window_minutes * 60_000).toISOString();
    const r = await serviceRest(`submissions?select=id&ip_hash=eq.${ip}&created_at=gte.${encodeURIComponent(since)}&limit=${ctx.conf.rate_limit.max}`, {}, env);
    if (r.ok && ((await r.json()) as unknown[]).length >= ctx.conf.rate_limit.max)
      return { status: 429, body: { ok: false, error: "Too many enquiries. Try again in a few minutes." } };
  } catch (e) {
    console.error(`forms: rate limit check failed: ${oneLine((e as Error).message)}`);
  }

  // a form with a quote hook: the server re-works the request from its own data (rule 8) before anything is stored
  const quote = def.quote ? await runQuote(def, formId, body.quote, checked.fields, ctx, env) : null;

  const email = checked.fields.email && emailOk(checked.fields.email) ? checked.fields.email : null;
  let row: { id: number; created_at: string };
  try {
    const r = await serviceRest("submissions?select=id,created_at", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ form: formId, page, fields: checked.fields, email, ip_hash: ip, delivery: {} }),
    }, env);
    if (!r.ok) throw new Error(`Supabase ${r.status} ${oneLine(await r.text())}`);
    row = ((await r.json()) as typeof row[])[0]!;
    if (row?.id == null) throw new Error("Supabase returned no row");
  } catch (e) {
    console.error(`forms: could not save: ${oneLine((e as Error).message)}`);
    return { status: 502, body: { ok: false, error: "Could not send. Please try again or call us." } };
  }

  const sub: Sub = { id: row.id, at: new Date(row.created_at || Date.now()), form: formId, page, fields: checked.fields };
  const siteUrl = siteUrlOf(ctx.cfg);
  const sheetId = sheetIdOf(env.GOOGLE_SHEET_ID);
  const links = { admin: `${siteUrl}/admin/submissions`, ...(ctx.conf.sheets && sheetId ? { sheet: `https://docs.google.com/spreadsheets/d/${sheetId}/edit` } : {}) };
  const attempt = (name: string, fn: () => Promise<string>) => attemptStep("forms", name, fn);
  const allKeys = [...new Set(Object.values(ctx.forms).flatMap((f) => f.fields.map((x) => x.key)))];
  const extraCols = Object.keys(quote?.outcome.sheet ?? {});
  const values = { id: String(sub.id), time: nowIn(ctx.cfg.client.timezone, sub.at), form: def.name, page, ...sub.fields, ...quote?.outcome.sheet };

  const [sheet, team_email, customer_email] = await Promise.all([
    attempt("sheet", async () => (!ctx.conf.sheets ? "off" : appendRows([
      { tab: def.name, columns: [...BASE_COLUMNS, ...def.fields.map((f) => f.key), ...extraCols], values },
      { tab: "All", columns: [...BASE_COLUMNS, ...allKeys, ...extraCols], values },
    ], env))),
    attempt("team email", async () => {
      const to = listEnv(env.FORMS_EMAIL_TO);
      if (!to.length) return "off";
      return sendMail({ to, ...teamMail(ctx.cfg, def, sub, links, quote?.team), ...(email ? { replyTo: email } : {}) }, env);
    }),
    attempt("customer email", async () => {
      const m = customerMail(ctx.cfg, def, quote?.customer);
      if (!email || !m) return "none";
      return sendMail({ to: [email], ...m }, env);
    }),
  ]);
  try {
    await serviceRest(`submissions?id=eq.${sub.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ delivery: { sheet, team_email, customer_email, ...(quote ? { quote: quote.delivery } : {}) } }) }, env);
  } catch (e) {
    console.error(`forms: could not record delivery on #${sub.id}: ${(e as Error).message}`);
  }
  return { status: 200, body: quote ? { ok: true, id: sub.id, quoted: quote.priced } : { ok: true, id: sub.id } };
}

const MAX_OVERRIDE = 20_000;

/**
 * Runs the form's quote hook (lib/hooks.ts) and applies its field overrides in place. Never throws: a missing hook,
 * a throw or an { error } all mean "price to confirm", and the enquiry is still saved (The reference project behaviour).
 */
async function runQuote(
  def: FormDef, formId: string, input: unknown, fields: Record<string, string>,
  ctx: { cfg: ClientConfig; hooks?: Record<string, FormHook>; now?: Date }, env: Env,
): Promise<{ outcome: QuoteOutcome; priced: boolean; delivery: string; team: MailExtra; customer?: MailExtra }> {
  const hook = ctx.hooks?.[def.quote!];
  let outcome: QuoteOutcome;
  try {
    outcome = hook
      ? await hook.quote(input, { cfg: ctx.cfg, formId, def, fields: { ...fields }, now: ctx.now ?? new Date(), env: env as Record<string, string | undefined> })
      : { error: `no "${def.quote}" quote hook is installed` };
    if (!outcome || typeof outcome !== "object") outcome = { error: "the quote hook returned nothing" };
  } catch (e) {
    console.error(`forms: quote hook "${def.quote}" failed: ${oneLine((e as Error).message)}`);
    outcome = { error: `error: ${oneLine((e as Error).message, 160)}` };
  }
  // only keys the form defines; the hook's text replaces what the browser sent
  const keys = new Set(def.fields.map((f) => f.key));
  for (const [k, v] of Object.entries(outcome.fields ?? {})) {
    if (!keys.has(k) || typeof v !== "string") continue;
    if (v) fields[k] = v.slice(0, MAX_OVERRIDE);
    else delete fields[k];
  }
  const sheet = Object.fromEntries(
    Object.entries(outcome.sheet ?? {}).filter(([k, v]) => /^[a-z][a-z0-9_]*$/.test(k) && typeof v === "string").map(([k, v]) => [k, oneLine(v, 500)]),
  );
  outcome = { ...outcome, sheet };
  if (isQuoteError(outcome)) {
    const reason = oneLine(outcome.error, 300);
    const note = `Price to confirm: the website could not check this request (${reason}). Read it as the customer sent it and confirm the price before quoting it.`;
    return { outcome, priced: false, delivery: `price to confirm: ${reason}`, team: { note } };
  }
  return {
    outcome, priced: true, delivery: oneLine(outcome.delivery, 200),
    team: { blocks: outcome.teamBlocks ?? [], ...(outcome.teamNote ? { note: outcome.teamNote } : {}), ...(outcome.subjectTag ? { subjectTag: outcome.subjectTag } : {}) },
    customer: { blocks: outcome.customerBlocks ?? [] },
  };
}
