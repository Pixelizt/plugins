// The module contract (docs/ARCHITECTURE.md §5). Kit code: do not edit in a client project.
import { z } from "zod";
import config from "virtual:kit/config";
import { starterDocs } from "./content/docs.ts";

export * from "./module-def.ts";
import type { DocDef, ModuleDef } from "./module-def.ts";

/** Validated config block for a module. Throws (fails the build) with a readable message. */
export function moduleConfig<S extends z.ZodType>(name: string, schema: S): z.infer<S> {
  const r = schema.safeParse(config.modules[name] ?? {});
  if (!r.success) throw new Error(`client.yaml → modules.${name} is invalid:\n${z.prettifyError(r.error)}`);
  return r.data;
}

export const isEnabled = (name: string) => name in config.modules;

/** Every installed module manifest (src/modules/<name>/module.ts). */
export function installedModules(): ModuleDef[] {
  const found = import.meta.glob<ModuleDef>("/src/modules/*/module.ts", { eager: true, import: "default" });
  return Object.values(found);
}

/** Every CMS document the site knows: the starter's + each installed module's. Keys are unique. */
export function allDocs(): Record<string, DocDef> {
  const out: Record<string, DocDef> = {};
  for (const [key, schema] of Object.entries(starterDocs)) out[key] = { schema, label: (z.globalRegistry.get(schema) as { label?: string } | undefined)?.label ?? key, group: "Pages" };
  for (const m of installedModules()) {
    if (!(m.name in config.modules)) continue; // installed but not enabled in client.yaml
    const conf = m.config ? m.config.parse(config.modules[m.name] ?? {}) : {};
    for (const [key, def] of Object.entries(m.docs ?? {})) {
      if (def.when && !def.when(conf)) continue;
      if (out[key]) throw new Error(`CMS document key "${key}" is declared twice (module ${m.name})`);
      if (def.editRole === "admin" && !key.startsWith("settings_"))
        throw new Error(`Admin-only document "${key}" (module ${m.name}) must start with settings_ so the database policy protects it`);
      out[key] = def;
    }
  }
  return out;
}
