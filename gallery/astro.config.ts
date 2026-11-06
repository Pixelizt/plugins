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
      name: "Fraunces",
      cssVariable: "--font-fraunces",
      weights: [500, 600],
      styles: ["normal", "italic"],
      fallbacks: ["Iowan Old Style", "Palatino", "serif"],
    },
    {
      provider: fontProviders.google(),
      name: "Figtree",
      cssVariable: "--font-figtree",
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
