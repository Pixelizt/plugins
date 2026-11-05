// Longer factual brief. Same rule as llms.txt: omit anything the client did not supply.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { llmsFullTxt } from "../kit/seo/public-text";

export const GET: APIRoute = ({ site }) =>
  new Response(llmsFullTxt(config, site ?? `https://${config.client.domain}`), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
