// GET /api/cron/daily: called by Vercel Cron (vercel.json). Kit code.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { runDaily } from "../../../kit/cron/daily";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("unauthorized", { status: 401 });
  }
  const results = await runDaily({ tier: config.hosting.tier, now: new Date(), env: process.env });
  return Response.json({ ok: !results.some((r) => r.includes("error")), results });
};
