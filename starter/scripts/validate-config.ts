// Validate client.yaml without building. Usage: npm run validate [path/to/client.yaml]
import { loadConfig, ConfigError } from "../src/kit/config/load.ts";
import { buildTokens } from "../src/kit/config/tokens.ts";
const file = process.argv[2] ?? "client.yaml";
try {
  const cfg = loadConfig(file);
  const { warnings } = buildTokens(cfg.brand);
  for (const w of warnings) console.warn(`warning: brand ${w}`);
  console.log(`${file} is valid: ${cfg.client.name}, ${cfg.pages.length} pages, modules [${Object.keys(cfg.modules).join(", ")}]`);
} catch (e) {
  console.error(e instanceof ConfigError ? e.message : e);
  process.exit(1);
}
