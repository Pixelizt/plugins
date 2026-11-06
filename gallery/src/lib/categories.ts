/** Editorial groupings for the gallery. The list of modules still comes from catalog.yaml. */

export const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "foundation", label: "Foundation" },
  { id: "menu", label: "Menu" },
  { id: "booking", label: "Booking" },
  { id: "content", label: "Content" },
  { id: "messaging", label: "Messaging" },
  { id: "later", label: "Later" },
  { id: "ui", label: "UI blocks" },
  { id: "motion", label: "Motion" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const MODULE_CATEGORY: Record<string, CategoryId> = {
  starter: "foundation",
  cms: "foundation",
  admin: "foundation",
  forms: "foundation",
  menu: "menu",
  "meal-plans": "menu",
  "booking-core": "booking",
  "table-booking": "booking",
  "space-booking": "booking",
  "content-lists": "content",
  whatsapp: "messaging",
  payments: "later",
  i18n: "later",
};

/** Shown on the home page. All of these exist in catalog.yaml as stable modules. */
export const FEATURED = ["menu", "table-booking", "space-booking", "meal-plans", "content-lists", "whatsapp"] as const;

/** Always part of a generated site (docs/MODULES.md). booking-core is pulled in by the booking modules. */
export const ALWAYS_ON = ["starter", "cms", "admin", "forms"] as const;

const DISPLAY: Record<string, string> = {
  cms: "CMS",
  i18n: "Languages",
  whatsapp: "WhatsApp",
  "whatsapp-link": "WhatsApp link",
  "meal-plans": "Meal plans",
  "content-lists": "Content lists",
  "booking-core": "Booking core",
  "table-booking": "Table booking",
  "space-booking": "Space booking",
  "pill-nav": "Pill nav",
  "card-grid": "Card grid",
  "section-head": "Section head",
  "announcement-strip": "Announcement strip",
  "mobile-action-bar": "Mobile action bar",
  "menu-tabs": "Menu tabs",
  "hours-map": "Hours and map",
  "instagram-feed": "Instagram link",
  "book-bar": "Book bar",
  "hero-stagger": "Hero stagger",
  "scroll-drift": "Scroll drift",
};

export function displayName(slug: string): string {
  if (DISPLAY[slug]) return DISPLAY[slug];
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export const STATUS_LABEL: Record<string, string> = {
  stable: "Stable",
  "in-progress": "In progress",
  planned: "Planned",
  "needs-work": "Needs work",
  later: "Later",
};

/** One line for the gallery. The catalog still decides what exists. */
export const SUMMARY: Record<string, string> = {
  starter: "The base of every site.",
  cms: "Edit the words, then publish.",
  admin: "The dashboard for staff.",
  forms: "A contact form that sends email.",
  menu: "The menu, with search and tags.",
  "content-lists": "Events, offers, reviews, and photos.",
  "booking-core": "Shared booking for tables and rooms.",
  "table-booking": "Book a table.",
  "space-booking": "Book a private room.",
  "meal-plans": "Meal-plan requests. Nothing is charged.",
  whatsapp: "A WhatsApp link for guests.",
  payments: "Not available yet.",
  i18n: "Not available yet.",
  "pill-nav": "Navigation in a pill.",
  button: "A button.",
  card: "A card with a title.",
  "card-grid": "A grid of cards.",
  section: "A page section.",
  "section-head": "A section heading.",
  "announcement-strip": "A short notice along the top.",
  "mobile-action-bar": "Call, directions, and book on a phone.",
  lightbox: "A photo, opened large.",
  chip: "A small tag.",
  "menu-tabs": "Menu categories as tabs.",
  "hours-map": "Opening hours and a map.",
  reviews: "What guests said.",
  gallery: "A grid of photos.",
  "instagram-feed": "Photos, plus a link to Instagram.",
  "book-bar": "A bar that leads to booking.",
  "whatsapp-link": "A link that opens WhatsApp.",
  reveal: "A quiet fade on scroll.",
  marquee: "A slow line of text.",
  float: "A slight lift on hover.",
  "scroll-drift": "A small shift as you scroll.",
  "hero-stagger": "The hero arrives in steps.",
};

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
