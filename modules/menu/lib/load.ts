// Loads the menu (CMS document or seed) and this module's config, with the currency from client.yaml.
import config from "virtual:kit/config";
import { loadDoc } from "../../../kit/content/index.ts";
import { moduleConfig } from "../../../kit/modules.ts";
import { MenuConfig, MenuDoc, configProblems } from "./schema.ts";

export async function loadMenu() {
  const menu = await loadDoc("menu", MenuDoc);
  const conf = moduleConfig("menu", MenuConfig);
  for (const p of configProblems(menu, conf)) console.warn(`[menu] ${p}`);
  return { menu, conf, currency: config.client.currency, locale: config.client.locale, siteName: config.client.name };
}
