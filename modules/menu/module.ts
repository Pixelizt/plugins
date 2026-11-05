import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { MenuConfig, MenuDoc } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: MenuConfig,
  docs: {
    menu: { schema: MenuDoc, label: "Menu", group: "Content" },
  },
});
