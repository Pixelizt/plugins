import { defineConfig } from "vitest/config";
import { loadConfig } from "./src/kit/config/load.ts";

// Tests get the same `virtual:kit/config` module the site gets (from client.yaml).
const ID = "virtual:kit/config";
const SNAP = "virtual:kit/content-snapshot";
export default defineConfig({
  plugins: [
    {
      name: "kit-config-test",
      resolveId: (id) => (id === ID || id === SNAP ? "\0" + id : undefined),
      load: (id) =>
        id === "\0" + ID ? `export default ${JSON.stringify(loadConfig("client.yaml", { allowTodo: true }))};`
        : id === "\0" + SNAP ? "export default {};" // tests use seed content
        : undefined,
    },
  ],
  test: { include: ["tests/**/*.test.ts", "src/modules/*/tests/**/*.test.ts"] },
});
