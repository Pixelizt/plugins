// Finds the booking types of installed modules: src/modules/<m>/booking-type.ts, whose default export is a
// function returning a BookingType (or null when that module isn't enabled in client.yaml). Bundled by Vite.
import config from "virtual:kit/config";
import { moduleConfig } from "../../../kit/modules.ts";
import { FormsConfig } from "../../forms/lib/schema.ts";
import type { Kind } from "../lib/capacity.ts";
import { BookingCoreConfig, type BookingType } from "../lib/schema.ts";
import type { BookingCtx } from "./book.ts";

export type TypeFactory = () => BookingType | null;
export type Types = Partial<Record<Kind, BookingType>>;

export function collectTypes(found: Record<string, TypeFactory>): Types {
  const out: Types = {};
  for (const [file, make] of Object.entries(found)) {
    if (typeof make !== "function") throw new Error(`${file}: default export must be a function returning a booking type (or null)`);
    const t = make();
    if (!t) continue;
    if (out[t.kind]) throw new Error(`booking type "${t.kind}" is defined twice (${file})`);
    out[t.kind] = t;
  }
  return out;
}

let cached: Types | null = null;
export function bookingTypes(): Types {
  return (cached ??= collectTypes(import.meta.glob<TypeFactory>("/src/modules/*/booking-type.ts", { eager: true, import: "default" })));
}

/** Everything the endpoints need, from the bundled client.yaml (D33: what was published, not unpublished edits). */
export function bookingCtx(): BookingCtx {
  return {
    cfg: config,
    conf: moduleConfig("booking-core", BookingCoreConfig),
    types: bookingTypes(),
    region: moduleConfig("forms", FormsConfig).phone_region,
  };
}
