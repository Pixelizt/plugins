// Kit-managed config. Client-specific values come from client.yaml, never from this file.
import { defineConfig, fontProviders } from "astro/config";
import { loadEnv } from "vite";
import vercel from "@astrojs/vercel";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { loadConfig } from "./src/kit/config/load.ts";
import { kitIntegration } from "./src/kit/integration.ts";

const isBuild = process.argv.includes("build");
// Production builds refuse TODO values in client.yaml. KIT_ALLOW_TODO=1 relaxes this for local test builds.
const client = loadConfig("client.yaml", { allowTodo: !isBuild || process.env.KIT_ALLOW_TODO === "1" });
const env = loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "");
const supabase = env.PUBLIC_SUPABASE_URL ? new URL(env.PUBLIC_SUPABASE_URL).origin : "";

const fontFamilies = (
  [
    ["heading", client.brand.fonts.heading],
    ["body", client.brand.fonts.body],
    ["accent", client.brand.fonts.accent],
  ] as const
)
  .filter(([, name]) => name)
  .map(([role, name]) => ({
    provider: fontProviders.google(),
    name,
    cssVariable: `--kit-font-${role}`,
    weights: [400, 500, 600, 700] as [number, ...number[]],
    // italics only where a design is likely to use them; every extra file costs load time
    styles: (role === "body" ? ["normal"] : ["normal", "italic"]) as ["normal", ...("normal" | "italic")[]],
    fallbacks: role === "heading" ? ["serif"] : ["sans-serif"],
  }));

const src = (extra: string[]) => ["'self'", ...extra].filter(Boolean).join(" ");

export default defineConfig({
  site: `https://${client.client.domain}`,
  output: "static", // static first (D1); endpoints opt out with `export const prerender = false`
  trailingSlash: "never",
  adapter: vercel(),
  integrations: [kitIntegration(client, { ...env, ...process.env }), react(), sitemap({ filter: (p) => !p.includes("/admin") })],
  fonts: fontFamilies,
  security: {
    // Strict CSP (rule 14). Astro hashes its own scripts and styles; hosts come from client.yaml → csp.
    csp: {
      directives: [
        "default-src 'self'",
        `img-src ${src(["data:", "blob:", supabase, ...client.csp.img_src])}`,
        `media-src ${src([supabase, ...client.csp.media_src])}`,
        `connect-src ${src([supabase, ...client.csp.connect_src])}`,
        `frame-src ${client.csp.frame_src.length ? client.csp.frame_src.join(" ") : "'none'"}`,
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
    },
  },
  markdown: { syntaxHighlight: false }, // Shiki uses inline styles that the strict CSP blocks
  vite: { plugins: [tailwindcss()] },
});
