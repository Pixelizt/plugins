// POST /api/publish: the admin's Publish button. Admin role only (D16).
// Rate-limited to once a minute (a "_publish" row, so the limit holds across serverless instances),
// triggers the Vercel deploy hook (a full static rebuild, 1-3 minutes), then emails the owner what changed.
import type { APIRoute } from "astro";
import config from "virtual:kit/config";
import { requireRole, serviceRest } from "../../../../kit/server/supabase.ts";
import { allDocs } from "../../../../kit/modules.ts";
import { cleanEnv, listEnv, sendMail } from "../../../../kit/email/send.ts";
import { changesSince } from "../../server/changes.ts";
import { publishedEmail } from "../../server/email.ts";

export const prerender = false;
const WAIT_MS = 60_000;

export const POST: APIRoute = async ({ request }) => {
  const user = await requireRole(request, "admin");
  if (user instanceof Response) return user;
  const hook = cleanEnv(process.env.DEPLOY_HOOK_URL);
  if (!hook) return Response.json({ error: "DEPLOY_HOOK_URL is not set" }, { status: 500 });

  const marks = (await (await serviceRest("docs?key=eq._publish&select=value,updated_at")).json()) as { updated_at: string }[];
  const last = marks[0]?.updated_at ?? null;
  if (last && Date.now() - Date.parse(last) < WAIT_MS) {
    const s = Math.ceil((WAIT_MS - (Date.now() - Date.parse(last))) / 1000);
    return Response.json({ error: `Publish again in ${s} seconds` }, { status: 429 });
  }

  // work out the changes before the mark moves
  let changes: Awaited<ReturnType<typeof changesSince>> = [];
  let changeError = "";
  try {
    changes = await changesSince(last, allDocs());
  } catch (e) {
    changeError = e instanceof Error ? e.message : String(e);
  }

  const mark = await serviceRest("docs", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key: "_publish", value: { by: user.email } }),
  });
  if (!mark.ok) return Response.json({ error: "Could not record the publish time" }, { status: 500 });

  const deploy = await fetch(hook, { method: "POST" });
  if (!deploy.ok) return Response.json({ error: `Vercel answered ${deploy.status}` }, { status: 502 });

  const owners = listEnv(process.env.OWNER_EMAIL);
  const mail = publishedEmail(config, user.email, changes, changeError);
  const email = owners.length ? await sendMail({ to: owners, ...mail }) : "none";
  return Response.json({ ok: true, changes: changes.length, email });
};
