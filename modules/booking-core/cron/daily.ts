// booking-core's part of the daily cron (free tier: once a day, D5). Imports the bundled config and runs runBookingDaily.
import config from "virtual:kit/config";
import type { CronContext } from "../../../kit/cron/daily.ts";
import { BookingCoreConfig } from "../lib/schema.ts";
import { runBookingDaily } from "../server/daily.ts";
import { bookingTypes } from "../server/types.ts";

export default async function (ctx: CronContext): Promise<string> {
  const conf = BookingCoreConfig.parse(config.modules["booking-core"] ?? {});
  return runBookingDaily({ cfg: config, conf, types: bookingTypes(), now: ctx.now, env: ctx.env });
}
