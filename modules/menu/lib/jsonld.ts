// schema.org Menu / MenuSection / MenuItem markup. Pure. Sold-out items and empty sections are left out.
import type { MenuDoc } from "./schema.ts";

export function menuJsonLd(menu: MenuDoc, o: { name: string; url: string; currency: string; showPrices: boolean }) {
  const hasMenuSection = menu.categories
    .map((c) => ({
      "@type": "MenuSection",
      name: c.name,
      ...(c.blurb ? { description: c.blurb } : {}),
      hasMenuItem: menu.items
        .filter((i) => i.category === c.id && i.available)
        .map((i) => ({
          "@type": "MenuItem",
          name: i.name,
          ...(i.description ? { description: i.description } : {}),
          ...(i.image ? { image: i.image.src } : {}),
          ...(o.showPrices
            ? { offers: i.prices.map((p) => ({ "@type": "Offer", price: p.price.toFixed(2), priceCurrency: o.currency, ...(p.size ? { name: p.size } : {}) })) }
            : {}),
        })),
    }))
    .filter((s) => s.hasMenuItem.length);
  return { "@context": "https://schema.org", "@type": "Menu", name: o.name, url: o.url, hasMenuSection };
}
