import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { FormsConfig } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: FormsConfig,
  tables: {
    submissions: { label: "Enquiries", columns: ["created_at", "form", "email", "fields", "delivery"], orderBy: "created_at" },
  },
});
