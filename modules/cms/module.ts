import { z } from "zod";
import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";

export default defineModule({
  ...meta,
  config: z.strictObject({}).default({}),
});
