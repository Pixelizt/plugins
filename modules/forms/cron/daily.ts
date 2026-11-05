// Retention (D17): delete submissions older than retention_days from the table and the sheet.
import config from "virtual:kit/config";
import type { CronContext } from "../../../kit/cron/daily.ts";
import { serviceRest } from "../../../kit/server/supabase.ts";
import { FormsConfig } from "../lib/schema.ts";
import { nowIn } from "../../../kit/lib/time.ts";
import { purgeOlderThan } from "../server/sheets.ts";

export default async function (ctx: CronContext): Promise<string> {
  const conf = FormsConfig.parse(config.modules.forms ?? {});
  const cutoff = new Date(ctx.now.getTime() - conf.retention_days * 86_400_000);
  const r = await serviceRest(`submissions?created_at=lt.${encodeURIComponent(cutoff.toISOString())}`, { method: "DELETE", headers: { Prefer: "return=minimal" } }, ctx.env);
  const table = r.ok ? "table ok" : `table error ${r.status}`;
  const sheet = conf.sheets ? await purgeOlderThan(nowIn(config.client.timezone, cutoff), ctx.env).catch((e) => `error ${e.message}`) : "off";
  return `retention ${conf.retention_days}d: ${table}, sheet ${sheet}`;
}
