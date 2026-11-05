import { defineModule } from "../../kit/module-def.ts";
import meta from "./module.json";
import { BookingCoreConfig } from "./lib/schema.ts";

export default defineModule({
  ...meta,
  config: BookingCoreConfig,
  // The bookings table is NOT listed in `tables`: the generic list reads select=*, and staff can't read the token
  // and IP hash columns. The custom view below lists bookings and exports CSV.
  adminViews: [{ id: "bookings", label: "Bookings", minRole: "editor" }],
});
