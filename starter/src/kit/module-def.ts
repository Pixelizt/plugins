// Module manifest types + defineModule. Imports nothing from the kit on purpose: module.ts files import
// this, and src/kit/modules.ts imports every module.ts, so anything heavier here creates an import cycle.
import type { z } from "zod";

/** Field metadata the admin understands. Attach with `.meta({ label, widget, help })`. */
export interface FieldMeta {
  label?: string;
  help?: string;
  widget?: "text" | "textarea" | "richtext" | "image" | "video" | "money" | "date" | "datetime" | "color" | "url" | "email" | "tel";
  /** For lists: which field names an item in the admin, history and change emails. */
  itemLabel?: string;
}

export interface DocDef {
  schema: z.ZodType;
  label: string;
  /** Who can edit it in the admin (D16). Default: editor. */
  editRole?: "editor" | "admin";
  /** Admin group heading, e.g. "Content", "Settings". */
  group?: string;
  /** Show this document only when it returns true for the module's (parsed) client.yaml block. */
  when?: (moduleConfig: any) => boolean;
}

export interface TableDef {
  label: string;
  /** Columns shown in the admin list view, in order. */
  columns: string[];
  /** Order by this column, newest first. */
  orderBy?: string;
}

// name, version and dependsOn live in the module's module.json (read by the kit installer too);
// env vars it reads live in its env.example (appended to the client's .env.example on install).
export interface ModuleDef {
  name: string;
  version: string;
  dependsOn?: string[];
  /** zod schema for this module's block in client.yaml → modules.<name>. */
  config?: z.ZodType;
  /** CMS documents this module owns. The admin generates an editor for each. */
  docs?: Record<string, DocDef>;
  /** Live tables shown read-only (or with custom views) in the admin. */
  tables?: Record<string, TableDef>;
  /** Custom admin views (React components under admin/), for what a generated editor can't do. */
  adminViews?: { id: string; label: string; minRole: "editor" | "admin" }[];
}

export const defineModule = (m: ModuleDef) => m;

