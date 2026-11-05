// Build-time loading for the sections and blog routes: config check, CMS document, CSP check.
import config from "virtual:kit/config";
import { moduleConfig } from "../../../kit/modules.ts";
import { loadDoc } from "../../../kit/content/index.ts";
import { ListsConfig, listSchemas, type ListName } from "./schema.ts";
import { cspProblems, videoRefs, type CspRef } from "./csp.ts";

export const listsConfig = () => moduleConfig("content-lists", ListsConfig);
export const isListEnabled = (name: ListName) => listsConfig().enabled.includes(name);

const supabaseOrigin = () => {
  try {
    return import.meta.env.PUBLIC_SUPABASE_URL ? [new URL(import.meta.env.PUBLIC_SUPABASE_URL).origin] : [];
  } catch {
    return [];
  }
};

function refsOf(name: ListName, doc: { items: Record<string, unknown>[] }): CspRef[] {
  const items = doc.items as { image?: { src: string }; src?: string; videos?: Parameters<typeof videoRefs>[0] }[];
  return items.flatMap((i) => [
    ...(i.image?.src ? [{ kind: "img" as const, url: i.image.src }] : []),
    ...(name === "gallery" && i.src ? [{ kind: "img" as const, url: i.src }] : []),
    ...videoRefs(i.videos ?? []),
  ]);
}

/** Load one list's document. Fails the build if the list is switched off in client.yaml or uses a host the CSP blocks. */
export async function loadList<N extends ListName>(name: N) {
  if (!isListEnabled(name)) {
    throw new Error(`The "${name}" list is not enabled. Add "${name}" to client.yaml → modules.content-lists.enabled, or remove its section from the page.`);
  }
  const doc = await loadDoc(name, listSchemas[name]);
  const problems = cspProblems(refsOf(name, doc as never), config.csp, supabaseOrigin());
  if (problems.length) throw new Error(`content-lists "${name}" uses hosts the site's CSP blocks:\n  - ${problems.join("\n  - ")}\nAdding hosts needs owner approval (rule 14).`);
  return doc as import("zod").infer<(typeof listSchemas)[N]>;
}
