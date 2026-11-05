// Optional cloud setup for a client site. Every step is opt-in.
// Tokens stay in the environment and are never placed on a command line or printed.
// Default is to do nothing. Non-interactive runs only steps named with flags, and only with --yes.
import { spawnSync } from "node:child_process";
import { constants } from "node:fs";
import { accessSync } from "node:fs";

export const STEPS = ["supabase", "resend", "vercel", "analytics"];
const SECRET_NAMES = ["SUPABASE_ACCESS_TOKEN", "RESEND_API_KEY", "VERCEL_TOKEN", "SUPABASE_DB_PASSWORD"];

export function redact(text, env = process.env) {
  let out = String(text);
  for (const name of SECRET_NAMES) {
    const value = env[name];
    if (typeof value === "string" && value.length >= 4) out = out.split(value).join("***");
  }
  return out;
}

/** Steps the operator named. `--yes` confirms prompts; it does not select steps by itself. */
export function namedSteps(argv) {
  return STEPS.filter((step) => argv.includes(`--${step}`));
}

/**
 * Which steps to run.
 * - A TTY with no names: ask about each step (caller does the asking).
 * - Names + `--yes`: run those steps.
 * - Names without `--yes` on a TTY: ask, limited to the named steps.
 * - No TTY and no `--yes`: run nothing, even if names were passed (a flag alone must not create projects).
 */
export function stepsToOffer({ argv, tty }) {
  const named = namedSteps(argv);
  const yes = argv.includes("--yes");
  const dry = argv.includes("--dry-run");
  if (!tty && !yes && !dry) return [];
  if (named.length) return named;
  return tty ? [...STEPS] : [];
}

export function shouldRun(step, { offered, yes, confirmed }) {
  if (!offered.includes(step)) return false;
  return yes || confirmed === true;
}

export function onPath(cmd, env = process.env) {
  const parts = (env.PATH ?? "").split(":").filter(Boolean);
  return parts.some((dir) => {
    try {
      accessSync(`${dir}/${cmd}`, constants.X_OK);
      return true;
    } catch {
      return false;
    }
  });
}

/**
 * Supabase CLI plan. Creating a project needs a database password, and this script will not put that
 * password on the command line. The create command is printed for the operator. The only command run
 * is `supabase db push`, which uses the CLI's own login and the linked project.
 */
export function supabasePlan(slug, env = process.env) {
  const org = env.SUPABASE_ORG_ID || "<SUPABASE_ORG_ID>";
  return {
    show: [
      `supabase projects create ${slug} --org-id ${org}`,
      "The CLI prompts for the database password. This script does not pass it, and does not create the project for you.",
    ],
    run: [{ cmd: "supabase", args: ["db", "push"] }],
  };
}

export function vercelPlan(slug) {
  return {
    show: [
      `vercel project add ${slug}`,
      `vercel link --yes --project ${slug}`,
      "Env values are not uploaded by this script. Set them in the Vercel dashboard from .env.example.",
    ],
    run: [
      { cmd: "vercel", args: ["project", "add", slug] },
      { cmd: "vercel", args: ["link", "--yes", "--project", slug] },
    ],
  };
}

export function analyticsNote() {
  return "Set hosting.analytics: true in client.yaml and deploy. This does not call the Vercel API. Web Analytics has no token in the repo.";
}

/** POST a sending domain to Resend. `key` is sent as a header and must not be logged. */
export async function resendDomain({ name, key, fetchImpl = fetch, dryRun = false }) {
  if (!name) return { skipped: "email.from_domain is empty" };
  if (dryRun) return { dryRun: true, method: "POST", url: "https://api.resend.com/domains", name };
  if (!key) return { skipped: "RESEND_API_KEY is not set" };
  const res = await fetchImpl("https://api.resend.com/domains", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) return { error: `Resend responded ${res.status}` };
  return { id: body.id ?? "", records: Array.isArray(body.records) ? body.records : [] };
}

export function formatPlan(step, slug, env = process.env) {
  if (step === "supabase") return supabasePlan(slug, env).show.map((line) => redact(line, env));
  if (step === "vercel") return vercelPlan(slug).show.map((line) => redact(line, env));
  if (step === "resend") return [redact("POST https://api.resend.com/domains  (Authorization header, body is the sending domain)", env)];
  if (step === "analytics") return [analyticsNote()];
  return [];
}

/** Run one planned command. Tests inject `spawn`. Stdio is inherited so secrets are not copied into argv. */
export function runCommand(action, { spawn = spawnSync, dryRun = false, env = process.env, log = console.log } = {}) {
  const shown = redact(`${action.cmd} ${action.args.join(" ")}`, env);
  if (!onPath(action.cmd, env)) {
    log(`skip ${shown}: ${action.cmd} is not installed`);
    return { skipped: true };
  }
  log(dryRun ? `dry-run ${shown}` : `run ${shown}`);
  if (dryRun) return { dryRun: true };
  const result = spawn(action.cmd, action.args, { env, stdio: "inherit" });
  return { status: result.status ?? 1 };
}
