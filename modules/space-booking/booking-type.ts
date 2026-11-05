// Registers the "space" booking type with booking-core (found by import.meta.glob in booking-core/server/types.ts).
import config from "virtual:kit/config";
import { isEnabled, moduleConfig } from "../../kit/modules.ts";
import { SpaceBookingConfig } from "./lib/schema.ts";
import { spaceType } from "./lib/type.ts";

export default function () {
  return isEnabled("space-booking") ? spaceType(moduleConfig("space-booking", SpaceBookingConfig), config.client.hours) : null;
}
