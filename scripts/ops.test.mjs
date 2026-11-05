import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { adminGuide } from "./admin-guide.mjs";
import { shotsFor } from "./handover-capture.mjs";
import { applyPairs, frozenPairs, report } from "./kit-diff.mjs";
import { formatPlan, namedSteps, redact, shouldRun, stepsToOffer } from "./provision.mjs";

test("provision plans never print tokens, and --yes alone selects nothing", () => {
  const env = { SUPABASE_ACCESS_TOKEN: "super-secret-token-value", SUPABASE_ORG_ID: "org_123", RESEND_API_KEY: "re_secret_key" };
  const lines = [...formatPlan("supabase", "demo", env), ...formatPlan("resend", "demo", env), ...formatPlan("vercel", "demo", env)];
  const shown = lines.join("\n");
  assert.equal(shown.includes("super-secret-token-value"), false);
  assert.equal(shown.includes("re_secret_key"), false);
  assert.equal(redact("token super-secret-token-value", env), "token ***");
  assert.deepEqual(stepsToOffer({ argv: ["--yes"], tty: false }), []);
  assert.deepEqual(stepsToOffer({ argv: ["--supabase"], tty: false }), []);
  assert.deepEqual(stepsToOffer({ argv: ["--dry-run", "--supabase"], tty: false }), ["supabase"]);
  assert.deepEqual(namedSteps(["--yes", "--supabase", "--analytics"]), ["supabase", "analytics"]);
  assert.deepEqual(stepsToOffer({ argv: ["--yes", "--resend"], tty: false }), ["resend"]);
  assert.equal(shouldRun("resend", { offered: ["resend"], yes: false, confirmed: false }), false);
  assert.equal(shouldRun("resend", { offered: ["resend"], yes: true, confirmed: false }), true);
});

test("kit-diff copies frozen files and leaves client content alone", () => {
  const root = mkdtempSync(join(tmpdir(), "kit-diff-"));
  const kit = join(root, "kit");
  const client = join(root, "client");
  mkdirSync(join(kit, "starter", "src", "kit"), { recursive: true });
  mkdirSync(join(client, "src", "kit"), { recursive: true });
  mkdirSync(join(client, "src", "content"), { recursive: true });
  writeFileSync(join(kit, "starter", "src", "kit", "note.ts"), "from-kit\n");
  writeFileSync(join(client, "src", "kit", "note.ts"), "old\n");
  writeFileSync(join(client, "src", "content", "menu.json"), "{\"keep\":true}\n");
  writeFileSync(join(client, "client.yaml"), "client: keep\n");
  const { changed } = report(kit, client);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].rel.endsWith("note.ts"), true);
  applyPairs(changed);
  assert.equal(readFileSync(join(client, "src", "kit", "note.ts"), "utf8"), "from-kit\n");
  assert.equal(readFileSync(join(client, "src", "content", "menu.json"), "utf8"), "{\"keep\":true}\n");
  assert.equal(readFileSync(join(client, "client.yaml"), "utf8"), "client: keep\n");
  assert.equal(frozenPairs(kit, client).some((row) => row.rel.includes("client.yaml")), false);
});

test("handover shots include the public pages and say the admin shot is signed out", () => {
  const shots = shotsFor({ pages: [{ path: "/", title: "Home" }, { path: "/about", title: "Our story" }] });
  assert.equal(shots[0].path, "/");
  assert.equal(shots.at(-1).path, "/admin");
  assert.match(shots.at(-1).caption, /signed-out/);
});

test("admin guide repeats client facts and does not invent awards", () => {
  const text = adminGuide({
    client: { name: "North Cafe", domain: "north.example", hours: { mon: "08:00-16:00" } },
    modules: { "table-booking": { mode: "approve" } },
  }, ["forms", "table-booking"]);
  assert.match(text, /North Cafe/);
  assert.match(text, /08:00-16:00/);
  assert.match(text, /approve/);
  assert.match(text, /None yet/);
  assert.equal(text.includes("Michelin"), false);
});
