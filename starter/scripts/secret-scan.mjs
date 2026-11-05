#!/usr/bin/env node
// Fails if any file git tracks or has staged contains a real secret, or if a .env file is tracked.
// Ported from the reference project (rules 15-16). No dependencies: runs in the pre-commit hook, CI and tests.
// Usage: node scripts/secret-scan.mjs [dir]   (default: current directory)
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

export const PATTERNS = [
  ["a private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["a Resend API key", /\bre_[A-Za-z0-9]{6,}_[A-Za-z0-9]{10,}/],
  ["a Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["a Stripe secret key", /\b(sk|rk)_live_[0-9A-Za-z]{10,}/],
  ["a GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}/],
  ["an AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["a Slack token", /\bxox[abpr]-[A-Za-z0-9-]{10,}/],
  ["a Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}/],
  ["a Vercel deploy hook", /api\.vercel\.com\/v1\/integrations\/deploy\/[A-Za-z0-9_]+\/[A-Za-z0-9]{8,}/],
];
const SKIP = /\.(png|jpe?g|webp|avif|gif|ico|svg|pdf|xlsx|mp4|webm|woff2?|ttf|otf|zip|glb|gltf|hdr)$/i;

/** A JWT is fine (the anon key is public) unless its payload says service_role. */
export function hasServiceJwt(text) {
  const all = text.match(/eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g) || [];
  return all.some((t) => {
    try { return /service_role/.test(Buffer.from(t.split(".")[1], "base64url").toString("utf8")); } catch { return false; }
  });
}

export function scanText(text) {
  const hits = PATTERNS.filter(([, re]) => re.test(text)).map(([what]) => what);
  if (hasServiceJwt(text)) hits.push("a Supabase service_role key");
  return hits;
}

export function scan(dir) {
  const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8" });
  const files = [...new Set((git(["ls-files"]) + "\n" + git(["diff", "--cached", "--name-only", "--diff-filter=ACMR"])).split("\n").filter(Boolean))];
  const problems = [];
  for (const f of files) {
    if (/(^|\/)\.env(\.|$)/.test(f) && !/\.example$/.test(f)) problems.push(`${f}: .env files must never be committed`);
    if (SKIP.test(f) || /secret-scan/.test(f)) continue;
    const p = join(dir, f);
    if (!existsSync(p) || !statSync(p).isFile() || statSync(p).size > 5e6) continue; // gitlinks/submodules are directories
    for (const what of scanText(readFileSync(p, "utf8"))) problems.push(`${f}: ${what}`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const problems = scan(resolve(process.argv[2] || "."));
  if (problems.length) {
    console.error("Secret scan FAILED. Unstage these, and rotate any key that was ever pushed:\n  " + problems.join("\n  "));
    process.exit(1);
  }
  console.log("Secret scan passed.");
}
