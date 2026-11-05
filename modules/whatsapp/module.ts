import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { WhatsappConfig } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: WhatsappConfig,
});
