import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { TableBookingConfig, TableBookingDoc } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: TableBookingConfig,
  docs: {
    table_booking: { schema: TableBookingDoc, label: "Table booking", group: "Content" },
  },
});
