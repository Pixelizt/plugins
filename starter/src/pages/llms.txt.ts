// A plain-text summary for AI assistants and search tools. Facts from client.yaml only.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { llmsTxt } from "../kit/seo/public-text";

export const GET: APIRoute = ({ site }) =>
  new Response(llmsTxt(config, site ?? `https://${config.client.domain}`), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
