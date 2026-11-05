import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { SpaceBookingConfig, SpacesDoc } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: SpaceBookingConfig,
  docs: {
    spaces: { schema: SpacesDoc, label: "Spaces", group: "Content" },
  },
});
