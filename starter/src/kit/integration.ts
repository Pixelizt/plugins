// The kit's Astro integration: validates client.yaml, generates tokens.css, reports warnings.
// Kit code: do not edit in a client project.
import { writeFileSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, relative } from "node:path";
import type { AstroIntegration } from "astro";
import type { ClientConfig } from "./config/schema.ts";
import { buildTokens } from "./config/tokens.ts";
import { fetchSnapshot } from "./content/snapshot.ts";

export const TOKENS_PATH = "src/styles/tokens.css";
const VIRTUAL_ID = "virtual:kit/config";
const RESOLVED_ID = "\0" + VIRTUAL_ID;
const SNAPSHOT_ID = "virtual:kit/content-snapshot";
const SNAPSHOT_RESOLVED = "\0" + SNAPSHOT_ID;

const MODULES_DIR = "src/modules";

/** Installed module folder names. */
export function installedModuleNames(root = process.cwd()): string[] {
  const dir = resolve(root, MODULES_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((n) => statSync(join(dir, n)).isDirectory());
}

/** Files under src/modules/<m>/routes/ become routes: routes/api/publish.ts → /api/publish. */
export function moduleRoutes(root = process.cwd()): { pattern: string; entrypoint: string }[] {
  const out: { pattern: string; entrypoint: string }[] = [];
  const walk = (dir: string, base: string) => {
    for (const n of readdirSync(dir)) {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) walk(full, base);
      else if (/\.(ts|astro)$/.test(n) && !n.endsWith(".test.ts")) {
        const rel = relative(base, full).replace(/\\/g, "/").replace(/\.(ts|astro)$/, "").replace(/\/index$/, "");
        out.push({ pattern: "/" + rel, entrypoint: "./" + relative(root, full).replace(/\\/g, "/") });
      }
    }
  };
  for (const m of installedModuleNames(root)) {
    const r = resolve(root, MODULES_DIR, m, "routes");
    if (existsSync(r)) walk(r, r);
  }
  return out;
}

export function kitIntegration(config: ClientConfig, env: Record<string, string | undefined> = process.env): AstroIntegration {
  return {
    name: "kit",
    hooks: {
      "astro:config:setup": async ({ addWatchFile, logger, updateConfig, injectRoute }) => {
        // client.yaml may only enable modules that are installed (and vice versa, warn).
        const installed = installedModuleNames();
        const missing = Object.keys(config.modules).filter((m) => !installed.includes(m));
        if (missing.length) {
          throw new Error(
            `client.yaml enables module(s) that aren't installed in src/modules/: ${missing.join(", ")}. Install them from the kit (/add-module) or remove them from client.yaml.`,
          );
        }
        for (const m of installed.filter((m) => !(m in config.modules))) {
          logger.warn(`module "${m}" is installed but not enabled in client.yaml → modules. Its routes still exist.`);
        }
        for (const r of moduleRoutes()) injectRoute(r);
        // `import config from "virtual:kit/config"` works in pages, components, endpoints and islands.
        // It's bundled, so server functions never read client.yaml from disk at runtime.
        // Content snapshot (D33): one read of the saved CMS documents, shared by pages and server functions.
        const snapshot = installedModuleNames().includes("cms") ? await fetchSnapshot(env, logger) : {};
        updateConfig({
          vite: {
            plugins: [
              {
                name: "kit-config",
                resolveId: (id: string) => (id === VIRTUAL_ID ? RESOLVED_ID : id === SNAPSHOT_ID ? SNAPSHOT_RESOLVED : undefined),
                load: (id: string) =>
                  id === RESOLVED_ID ? `export default ${JSON.stringify(config)};`
                  : id === SNAPSHOT_RESOLVED ? `export default ${JSON.stringify(snapshot)};`
                  : undefined,
              },
            ],
          },
        });
        addWatchFile(resolve(process.cwd(), "client.yaml"));
        const { css, warnings } = buildTokens(config.brand);
        const out = resolve(process.cwd(), TOKENS_PATH);
        // only write when changed, so dev doesn't loop on its own output
        if (!existsSync(out) || readFileSync(out, "utf8") !== css) writeFileSync(out, css);
        for (const w of warnings) logger.warn(`brand ${w}. Adjust client.yaml colors or confirm with the owner.`);
        logger.info(
          `${config.client.name}: ${config.pages.length} pages, modules [${Object.keys(config.modules).join(", ") || "none"}], hosting ${config.hosting.tier}, motion ${config.motion.level}`,
        );
      },
    },
  };
}
