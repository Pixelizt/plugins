// Registers the "table" booking type with booking-core (found by import.meta.glob in booking-core/server/types.ts).
import config from "virtual:kit/config";
import { isEnabled, moduleConfig } from "../../kit/modules.ts";
import { TableBookingConfig } from "./lib/schema.ts";
import { tableType } from "./lib/type.ts";

export default function () {
  return isEnabled("table-booking") ? tableType(moduleConfig("table-booking", TableBookingConfig), config.client.hours) : null;
}
