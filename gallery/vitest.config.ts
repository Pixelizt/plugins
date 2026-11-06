import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const kit = fileURLToPath(new URL("../starter/src/kit/", import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^(?:\.\.\/)+kit\//, replacement: kit }],
  },
  server: { fs: { allow: [repoRoot] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
