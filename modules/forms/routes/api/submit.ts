// POST /api/submit: every website form posts here.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { moduleConfig } from "../../../../kit/modules.ts";
import { FormsConfig } from "../../lib/schema.ts";
import { forms } from "../../lib/load.ts";
import { handleSubmit } from "../../server/submit.ts";
import { formHooks } from "../../server/hooks.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    const r = await handleSubmit(request, { cfg: config, forms, conf: moduleConfig("forms", FormsConfig), hooks: formHooks() });
    return Response.json(r.body, { status: r.status });
  } catch (e) {
    console.error(`forms: unexpected error: ${(e as Error).stack ?? e}`);
    return Response.json({ ok: false, error: "Something went wrong" }, { status: 500 });
  }
};
