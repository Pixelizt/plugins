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

/**
 * Short factual notes for the detail page. Omitted modules get no extra claim.
 * Kept here (not in catalog.yaml) because they describe how the brief uses a module.
 */
export const BRIEF_NOTES: Record<string, string> = {
  starter: "Every client project is a copy of starter/. Brand, pages, motion and hosting in the brief are read from client.yaml at build.",
  cms: "Always installed. The brief lists modules.cms as an empty block. Staff edit documents in the dashboard; Publish rebuilds the site.",
  admin: "Always installed. The dashboard is at /admin. The brief does not collect a password. Staff accounts are created in Supabase by a person.",
  forms: "Always installed. The contact form is listed under modules.forms.forms. Phone numbers are checked for the country chosen in the brief.",
  menu: "Optional. modules.menu holds price display, allergen display and the tag vocabulary. Currency comes from client.currency, not from this block.",
  "content-lists": "Optional. modules.content-lists.enabled names which lists are live (events, offers, faqs, reviews, gallery, posts). A list that is off cannot be placed on a page.",
  "booking-core": "Installed when table booking or space booking is on. It is the shared engine (availability, capacity, emails). It has no public page of its own.",
  "table-booking": "Optional. The section stays hidden until capacity is set (covers per slot, or table groups) and opening hours are known. The gallery does not invent those numbers.",
  "space-booking": "Optional. Rooms, capacity and a guide price are filled in later with the business. Prices are display only. Nothing is charged online.",
  "meal-plans": "Optional. The builder stays hidden until slots, plans and lengths are filled from the business's own price sheet. Requests are priced again on the server. Nothing is charged online.",
  whatsapp: "The public click-to-chat link uses client.contact.whatsapp and does not need this module. The module is only the optional booking alert, which stays off until a developer sets the WhatsApp env vars.",
  payments: "Listed in catalog.yaml as later, blocked on an open provider question. There is no module folder and the brief cannot turn it on.",
  i18n: "Listed in catalog.yaml as later. The kit is English only. There is no module folder and the brief cannot turn it on.",
};

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
