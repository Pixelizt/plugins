// Screenshots for the optional Remotion walkthrough. Does not log in and does not store passwords.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

export function shotsFor(cfg) {
  const pages = (cfg.pages ?? []).map((page) => ({
    path: page.path,
    title: page.title || (page.path === "/" ? "Home" : page.path),
    caption: page.path === "/" ? "The public home page." : `The ${page.title || page.path} page, as visitors see it.`,
  }));
  pages.push({
    path: "/admin",
    title: "Dashboard",
    caption: "Staff sign in here. Without a password this is the signed-out screen, not a live editing session.",
  });
  return pages;
}

export function propsFrom(cfg, frames) {
  const colors = cfg.brand?.colors ?? {};
  return {
    clientName: cfg.client?.name ?? "Website",
    primary: colors.primary ?? "#7A4B2A",
    background: colors.background ?? "#FBF7F1",
    foreground: colors.foreground ?? "#1C1917",
    frames,
  };
}

async function waitFor(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch { /* server still booting */ }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Dev server did not answer at ${url}`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (invoked) {
  const client = resolve(process.argv[2] ?? "");
  if (!client) {
    console.error("Usage: node scripts/handover-capture.mjs <client-dir>");
    process.exit(1);
  }
  const { parse } = createRequire(new URL("../starter/package.json", import.meta.url))("yaml");
  const { readFileSync } = await import("node:fs");
  const cfg = parse(readFileSync(join(client, "client.yaml"), "utf8"));
  const shots = shotsFor(cfg);
  const out = join(client, "handover");
  mkdirSync(out, { recursive: true });
  const server = spawn("npm", ["run", "dev", "--", "--host", "127.0.0.1", "--port", "4322"], { cwd: client, stdio: "ignore" });
  try {
    await waitFor("http://127.0.0.1:4322/");
    const { chromium } = createRequire(join(client, "package.json"))("@playwright/test");
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const frames = [];
    for (const [i, shot] of shots.entries()) {
      await page.goto(`http://127.0.0.1:4322${shot.path}`, { waitUntil: "networkidle" });
      const file = `shot-${String(i + 1).padStart(2, "0")}.png`;
      await page.screenshot({ path: join(out, file) });
      frames.push({ ...shot, src: file });
    }
    await browser.close();
    writeFileSync(join(out, "props.json"), JSON.stringify(propsFrom(cfg, frames), null, 2));
    console.log(`Wrote ${frames.length} screenshots to ${out}`);
    console.log("Render (optional, needs Remotion's own install):");
    console.log(`  cd tools/handover && npm install && npx remotion render src/index.ts Walkthrough out/walkthrough.mp4 --public-dir=${out} --props=${join(out, "props.json")}`);
  } finally {
    server.kill("SIGTERM");
  }
}
