// Custom admin views (pure, tested). A module lists them in module.ts → adminViews: [{ id, label, minRole }] and
// ships the React component as src/modules/<module>/admin/<id>.tsx (default export, props: AdminViewProps).
// The dashboard links it in the sidebar under "Tools" as #/view/<id> and loads it on first open.
import { roleAtLeast } from "../../../kit/lib/roles.ts";
import type { Session } from "./session.ts";

export interface ViewMeta { id: string; label: string; minRole: "editor" | "admin"; module: string }

/** What a custom view receives. `api.token` is the signed-in user's access token (send it as a Bearer token). */
export interface AdminViewProps {
  api: { url: string; anon: string; token: string };
  session: Pick<Session, "email" | "role">;
}

export const canSee = (role: Session["role"], min: ViewMeta["minRole"]) => roleAtLeast(role, min);

/** Views this role may open, in declaration order. Ids must be unique across modules. */
export function visibleViews(views: ViewMeta[], role: Session["role"]): ViewMeta[] {
  return views.filter((v) => canSee(role, v.minRole));
}

/** The glob key of a view's component. */
export const viewFile = (v: Pick<ViewMeta, "module" | "id">) => `/src/modules/${v.module}/admin/${v.id}.tsx`;

/** Collects views from module manifests; fails the build on a duplicate or malformed id. */
export function collectViews(mods: { name: string; adminViews?: { id: string; label: string; minRole: "editor" | "admin" }[] }[]): ViewMeta[] {
  const out: ViewMeta[] = [];
  for (const m of mods) {
    for (const v of m.adminViews ?? []) {
      if (!/^[a-z][a-z0-9-]*$/.test(v.id)) throw new Error(`admin view id "${v.id}" (module ${m.name}) must be lowercase letters, digits and dashes`);
      if (out.some((x) => x.id === v.id)) throw new Error(`admin view id "${v.id}" is declared twice (module ${m.name})`);
      out.push({ id: v.id, label: v.label, minRole: v.minRole, module: m.name });
    }
  }
  return out;
}
