// The one daily job (free tier allows one cron run a day, so everything daily runs from here).
// Modules add work by exporting `default async function (ctx)` from src/modules/<name>/cron/daily.ts.
// Kit code: do not edit in a client project.
export interface CronContext {
  tier: "free" | "paid";
  now: Date;
  env: Record<string, string | undefined>;
}
export type DailyJob = (ctx: CronContext) => Promise<string>;

const jobs = import.meta.glob<DailyJob>("/src/modules/*/cron/daily.ts", { eager: true, import: "default" });

/** Free-tier Supabase pauses idle projects; one cheap request a day keeps it awake (rule 25). */
export async function keepAlive(env: CronContext["env"]): Promise<string> {
  const url = env.PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return "keep-alive: off (Supabase env not set)";
  const res = await fetch(`${url}/rest/v1/`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
  return `keep-alive: ${res.ok ? "ok" : `error ${res.status}`}`;
}

export async function runDaily(ctx: CronContext): Promise<string[]> {
  const results: string[] = [];
  if (ctx.tier === "free") results.push(await keepAlive(ctx.env));
  for (const [path, job] of Object.entries(jobs)) {
    const name = path.split("/")[3];
    try {
      results.push(`${name}: ${await job(ctx)}`);
    } catch (e) {
      results.push(`${name}: error ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return results;
}
