// JSON-LD for the business (pure, tested). Kit code.
import type { ClientConfig } from "../config/schema.ts";
import { DAYS } from "../lib/time.ts";

const SCHEMA_TYPE: Record<ClientConfig["client"]["type"], string> = {
  cafe: "CafeOrCoffeeShop",
  restaurant: "Restaurant",
  bar: "BarOrPub",
  bakery: "Bakery",
  "food-subscription": "FoodEstablishment",
  other: "LocalBusiness",
};

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** "mon-fri" → ["Monday", ..., "Friday"]; wraps ("fri-mon"). */
export function expandDays(key: string): string[] {
  const [a, b = a] = key.split("-") as [(typeof DAYS)[number], (typeof DAYS)[number]?];
  const out: string[] = [];
  let i = DAYS.indexOf(a);
  const end = DAYS.indexOf(b!);
  for (;;) {
    out.push(DAY_NAMES[i]!);
    if (i === end) return out;
    i = (i + 1) % 7;
  }
}

export function businessJsonLd(cfg: ClientConfig, siteUrl: string) {
  const c = cfg.client;
  return {
    "@context": "https://schema.org",
    "@type": SCHEMA_TYPE[c.type],
    name: c.name,
    url: siteUrl,
    telephone: c.contact.phone,
    email: c.contact.email,
    address: c.contact.address,
    currenciesAccepted: c.currency,
    ...(c.contact.map_url ? { hasMap: c.contact.map_url } : {}),
    sameAs: Object.values(c.socials).filter(Boolean),
    openingHoursSpecification: Object.entries(c.hours).map(([days, range]) => {
      const [opens, closes] = range.split("-");
      return { "@type": "OpeningHoursSpecification", dayOfWeek: expandDays(days), opens, closes };
    }),
  };
}

/** Serialize for a <script type="application/ld+json">: "<" and friends escaped so content can never close the tag. */
export const jsonLdString = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
