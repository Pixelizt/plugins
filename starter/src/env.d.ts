/// <reference types="astro/client" />

declare module "virtual:kit/content-snapshot" {
  const snapshot: Record<string, unknown>;
  export default snapshot;
}

declare module "virtual:kit/config" {
  const config: import("./kit/config/schema.ts").ClientConfig;
  export default config;
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}
