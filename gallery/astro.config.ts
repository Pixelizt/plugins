// The gallery is a static site. It does not use the Vercel adapter, Supabase, or the client generator.
import { defineConfig, fontProviders } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
  output: "static",
  trailingSlash: "never",
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Host Grotesk",
      cssVariable: "--font-host",
      weights: [400, 500, 600],
      styles: ["normal"],
      fallbacks: ["Avenir Next", "Segoe UI", "sans-serif"],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: [repoRoot] } },
  },
});
