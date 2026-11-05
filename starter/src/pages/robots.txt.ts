import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { robotsTxt } from "../kit/seo/public-text";

export const GET: APIRoute = ({ site }) =>
  new Response(robotsTxt(site ?? `https://${config.client.domain}`, config.seo.ai_crawlers), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
