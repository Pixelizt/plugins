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

const amenity = (name: string, value: string) => ({ "@type": "LocationFeatureSpecification", name, value });

/**
 * Most specific type, plus LocalBusiness so generic consumers still match.
 * On-site testimonials are not emitted as Review or aggregateRating: the business would be
 * rating itself, which search engines treat as spam. A rating only belongs here when it is
 * real third-party data the kit can point at, and this kit does not invent that.
 * Menu JSON-LD is emitted by the menu module from the real menu document, not from this object.
 */
export function businessJsonLd(cfg: ClientConfig, siteUrl: string) {
  const c = cfg.client;
  const h = cfg.highlights;
  const specific = SCHEMA_TYPE[c.type];
  const amenities = [
    ...(h.parking ? [amenity("Parking", h.parking)] : []),
    ...h.ambience.map((value) => amenity("Ambience", value)),
    ...h.dietary.map((value) => amenity("Dietary options", value)),
  ];
  const awards = h.awards.map((a) => [a.name, a.year, a.by].filter(Boolean).join(", "));
  return {
    "@context": "https://schema.org",
    "@type": specific === "LocalBusiness" ? "LocalBusiness" : [specific, "LocalBusiness"],
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
    ...(awards.length ? { award: awards } : {}),
    ...(h.specialties.length ? { knowsAbout: h.specialties } : {}),
    ...(amenities.length ? { amenityFeature: amenities } : {}),
  };
}

/** FAQPage from real question/answer pairs. Null when there is nothing to say. */
export function faqJsonLd(items: { q: string; a: string }[]) {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}

/** Serialize for a <script type="application/ld+json">: "<" and friends escaped so content can never close the tag. */
export const jsonLdString = (data: unknown): string =>
  JSON.stringify(data).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
