#!/usr/bin/env node
// Build a throwaway client site in .playground/ with the starter + every module, so modules can be
// type-checked, tested and built inside a real Astro project. Usage: node scripts/playground.mjs [module...]
import { cpSync, existsSync, rmSync, readdirSync, writeFileSync, readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PG = join(KIT, ".playground");
const mods = process.argv.slice(2).length ? process.argv.slice(2) : readdirSync(join(KIT, "modules")).filter((m) => existsSync(join(KIT, "modules", m, "module.json")));

rmSync(PG, { recursive: true, force: true });
cpSync(join(KIT, "starter"), PG, {
  recursive: true,
  filter: (src) => !/[/\\](node_modules|dist|\.astro|\.vercel)([/\\]|$)/.test(src),
});
execFileSync("node", [join(KIT, "scripts", "install-module.mjs"), PG, ...mods], { stdio: "inherit" });
// a real install (modules may add dependencies); npm's cache keeps this quick after the first run
execFileSync("npm", ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: PG, stdio: "inherit" });

// enable every installed module in the demo brief
const yaml = readFileSync(join(PG, "client.yaml"), "utf8");
const block = "modules:\n" + mods.map((m) => (m === "content-lists" ? "  content-lists: { enabled: [events, offers, faqs, reviews, gallery, posts] }" : `  ${m}: {}`)).join("\n") + "\n";
let out = yaml.replace(/\npages:/, `\n${block}\npages:`);
// demo pages for module sections, so the build exercises them
if (mods.includes("forms")) out = out.replace(/(\npages:\n)/, "$1  - path: /contact\n    sections: [contact-form]\n");
if (mods.includes("content-lists")) out = out.replace(/(\npages:\n)/, "$1  - path: /events\n    sections: [events, offers]\n  - path: /faq\n    sections: [faqs]\n  - path: /blog\n    sections: [posts-list]\n").replace("sections: [about, cta]", "sections: [about, reviews, gallery, cta]");
if (mods.includes("menu")) out = out.replace(/(\npages:\n)/, "$1  - path: /menu\n    sections: [menu-full]\n").replace("sections: [hero, highlights, cta]", "sections: [hero, highlights, menu-preview, cta]");
writeFileSync(join(PG, "client.yaml"), out);
console.log(`\nPlayground ready: cd .playground && npm run check && npm test && npm run build`);
