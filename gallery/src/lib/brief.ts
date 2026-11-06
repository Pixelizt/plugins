// Builds a client.yaml object the kit already understands.
// Validation uses starter/src/kit/config/schema.ts so the gallery does not keep a second copy of the rules.
// Module blocks are shaped to each module's schema and checked in brief.test.ts.
// Nothing here calls Supabase, Vercel or Resend, and no secret is accepted.
import { stringify } from "yaml";
import { z } from "zod";
import { ClientConfig, type ClientConfig as ClientConfigType } from "../../../starter/src/kit/config/schema.ts";
import { buildTokens } from "../../../starter/src/kit/config/tokens.ts";

export const BUSINESS_TYPES = ["cafe", "restaurant", "bar", "bakery", "food-subscription", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const RADII = ["none", "sm", "md", "lg", "full"] as const;
export const SHADOWS = ["none", "soft", "strong"] as const;
export const MOTION_LEVELS = ["subtle", "expressive", "awwwards"] as const;
export const TIERS = ["free", "paid"] as const;
export const LIST_NAMES = ["events", "offers", "faqs", "reviews", "gallery", "posts"] as const;
export type ListName = (typeof LIST_NAMES)[number];

export const TYPE_LABEL: Record<BusinessType, string> = {
  cafe: "Café",
  restaurant: "Restaurant",
  bar: "Bar",
  bakery: "Bakery",
  "food-subscription": "Food subscription",
  other: "Other",
};

export const FONT_PAIRS = [
  { id: "editorial", label: "Editorial", heading: "Fraunces", body: "Figtree" },
  { id: "journal", label: "Journal", heading: "Newsreader", body: "Source Sans 3" },
  { id: "plain", label: "Plain", heading: "Literata", body: "Outfit" },
] as const;

export const PALETTES = [
  {
    id: "paper",
    label: "Paper",
    colors: { primary: "#1F4D3A", secondary: "#E7DCC8", accent: "#9A3412", background: "#F7F3EC", foreground: "#1C1915", muted: "#E8E2D6" },
  },
  {
    id: "ink",
    label: "Ink",
    colors: { primary: "#1C1915", secondary: "#E7E5E4", accent: "#9A3412", background: "#F6F4F1", foreground: "#1C1915", muted: "#ECEAE6" },
  },
  {
    id: "bake",
    label: "Bake",
    colors: { primary: "#7C2D12", secondary: "#F3E0D0", accent: "#1F4D3A", background: "#FFF8F3", foreground: "#2A2118", muted: "#F4E6DC" },
  },
  {
    id: "coast",
    label: "Coast",
    colors: { primary: "#0F3D4C", secondary: "#D5E4E6", accent: "#9A3412", background: "#F3F7F7", foreground: "#102027", muted: "#E3EEEE" },
  },
] as const;

export const MENU_TAGS = [
  { key: "vegetarian", label: "Vegetarian" },
  { key: "vegan", label: "Vegan" },
  { key: "gluten-free", label: "Gluten-free" },
  { key: "spicy", label: "Spicy" },
] as const;

export const VIBE_STARTS = [
  "warm, quiet, neighbourhood",
  "dark, precise, evening service",
  "bright, daytime, unfussy",
  "coastal, simple, seasonal",
] as const;

const HEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const HOURS = /^([01]\d|2[0-3]):[0-5]\d-(([01]\d|2[0-3]):[0-5]\d|24:00)$/;
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface BriefInput {
  name: string;
  slug: string;
  domain: string;
  domainPending: boolean;
  type: BusinessType;
  vibe: string;
  currency: string;
  timezone: string;
  email: string;
  phone: string;
  whatsapp: string;
  address: string;
  hoursWeekday: string;
  hoursWeekend: string;
  instagram: string;
  specialties: string;
  staffEmail: string;
  phoneRegion: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    foreground: string;
    muted: string;
  };
  headingFont: string;
  bodyFont: string;
  radius: (typeof RADII)[number];
  shadow: (typeof SHADOWS)[number];
  motion: (typeof MOTION_LEVELS)[number];
  tier: (typeof TIERS)[number];
  menu: boolean;
  menuTags: string[];
  listsOn: boolean;
  lists: ListName[];
  tableBooking: boolean;
  spaceBooking: boolean;
  mealPlans: boolean;
  whatsappAlerts: boolean;
}

export interface BriefResult {
  yaml: string;
  config: ClientConfigType;
  notes: string[];
  warnings: string[];
}

export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug;
}

export function bareDomain(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "")
    .replace(/\.$/, "");
}

export function isTimezone(value: string): boolean {
  const tz = value.trim();
  if (!tz) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function motionBlock(level: BriefInput["motion"]) {
  if (level === "subtle") return { level, smooth_scroll: false, allow_3d: false };
  if (level === "awwwards") return { level, smooth_scroll: true, allow_3d: true };
  return { level: "expressive" as const, smooth_scroll: true, allow_3d: false };
}

function pagesFor(input: BriefInput) {
  const lists = new Set(input.listsOn ? input.lists : []);
  const home = ["hero", "highlights"];
  if (input.menu || input.mealPlans) home.push("menu-preview");
  if (lists.has("reviews")) home.push("reviews");
  if (lists.has("offers") && !lists.has("events")) home.push("offers");
  if (lists.has("gallery")) home.push("gallery");
  home.push("cta");

  const pages: { path: string; title: string; sections: string[] }[] = [{ path: "/", title: "Home", sections: home }];
  if (input.menu || input.mealPlans) pages.push({ path: "/menu", title: "Menu", sections: ["menu-full"] });
  if (input.tableBooking) pages.push({ path: "/book", title: "Book a table", sections: ["table-booking"] });
  if (input.spaceBooking) pages.push({ path: "/hire", title: "Private hire", sections: ["space-booking"] });

  const eventSections: string[] = [];
  if (lists.has("events")) eventSections.push("events");
  if (lists.has("offers") && lists.has("events")) eventSections.push("offers");
  if (lists.has("faqs") && lists.has("events")) eventSections.push("faqs");
  if (eventSections.length) pages.push({ path: "/events", title: "Events", sections: eventSections });
  else if (lists.has("faqs")) pages.push({ path: "/questions", title: "Questions", sections: ["faqs"] });

  if (lists.has("posts")) pages.push({ path: "/blog", title: "Journal", sections: ["posts-list"] });
  if (input.mealPlans) pages.push({ path: "/plans", title: "Meal plans", sections: ["meal-plan-builder", "meal-plan-rates"] });
  pages.push({ path: "/contact", title: "Contact", sections: ["contact-form", "visit"] });
  return pages;
}

function notesFor(input: BriefInput, domain: string, domainPending: boolean): string[] {
  const notes = [
    "Generated in the browser by the Pixelizt Plugins gallery. It is a brief, not a deployed site.",
    "No password, API key or payment detail belongs in this file. None were collected.",
    "CMS, admin and the contact form are included with every site.",
  ];
  if (domainPending) notes.push(`No domain yet. client.domain is the placeholder ${domain}. Replace it before launch.`);
  else notes.push(`email.from_domain is a suggested sending subdomain (${domain ? `notify.${domain}` : "empty"}). It is not verified. A person sets that up in Resend before any mail is sent.`);
  if (input.tableBooking) notes.push("Table booking is on. The section stays hidden until covers_per_slot or tables, and opening hours, are set with the business. Those numbers were not guessed.");
  if (input.spaceBooking) notes.push("Space booking is on. Add each room (id, name, capacity) with the business. price_per_hour is a guide only. Nothing is charged online.");
  if (input.mealPlans) notes.push("Meal plans are on. Fill slots, plans and lengths from the printed price sheet. The meal-plan form definition still has to be merged by a developer, and meal-plan added to modules.forms.forms. The gallery left that form off so the build is not pointed at a form that is not installed yet.");
  if (input.listsOn && input.lists.includes("events")) notes.push("Events can embed video. YouTube or Instagram embeds need client.yaml csp.frame_src added by a developer. The gallery did not add those hosts.");
  if (input.whatsappAlerts) notes.push("WhatsApp booking alerts are flagged on. Nothing is sent until WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TO are set in the environment. Those values are not in this file.");
  else if (input.whatsapp.trim()) notes.push("The WhatsApp number is the public click-to-chat link only. Booking alerts stay off.");
  if (!input.hoursWeekday && !input.hoursWeekend) notes.push("Opening hours were left blank. Add them before relying on the hours shown on the site.");
  notes.push(`A developer saves this file to clients/${input.slug}/client.yaml in the plugins repo and runs: node scripts/new-client.mjs ${input.slug}`);
  return notes;
}

/** Field-level checks used by the form before it asks the core schema. */
export function fieldErrors(input: BriefInput): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!input.name.trim()) errors.name = "Add the business name.";
  if (!BUSINESS_TYPES.includes(input.type)) errors.type = "Choose what kind of business it is.";
  const slug = input.slug.trim();
  if (!SLUG.test(slug)) errors.slug = "Use lowercase letters, numbers and single dashes.";
  if (!input.domainPending) {
    const domain = bareDomain(input.domain);
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) errors.domain = "Use a bare domain like yourcafe.com.";
  }
  if (!input.vibe.trim()) errors.vibe = "Add a few words for the feel of the place.";
  if (!/^[A-Z]{3}$/.test(input.currency.trim().toUpperCase())) errors.currency = "Use a three-letter code like GBP.";
  if (!isTimezone(input.timezone)) errors.timezone = "Use an IANA time zone like Europe/London.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) errors.email = "Add a real contact email.";
  if (input.phone.trim().length < 5) errors.phone = "Add a phone number.";
  if (!input.address.trim()) errors.address = "Add the address, or write that it will be added later.";
  if (!/^[A-Z]{2}$/.test(input.phoneRegion.trim().toUpperCase())) errors.phoneRegion = "Choose the country phone numbers belong to.";
  if (input.hoursWeekday.trim() && !HOURS.test(input.hoursWeekday.trim())) errors.hoursWeekday = "Use 24-hour times like 08:00-17:00.";
  if (input.hoursWeekend.trim() && !HOURS.test(input.hoursWeekend.trim())) errors.hoursWeekend = "Use 24-hour times like 09:00-22:00.";
  if (input.instagram.trim()) {
    try {
      const url = new URL(input.instagram.trim());
      if (url.protocol !== "https:" && url.protocol !== "http:") errors.instagram = "Paste a full https link.";
    } catch {
      errors.instagram = "Paste a full link, or leave this blank.";
    }
  }
  if (input.staffEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.staffEmail.trim())) errors.staffEmail = "That email does not look complete.";
  for (const key of ["primary", "secondary", "accent", "background", "foreground", "muted"] as const) {
    if (!HEX.test(input.colors[key].trim())) errors[`color-${key}`] = "Use a hex colour like #1F4D3A.";
  }
  if (!input.headingFont.trim() || !input.bodyFont.trim()) errors.fonts = "Choose a type pairing.";
  if (input.listsOn && input.lists.length === 0) errors.lists = "Choose at least one list, or leave content lists off.";
  if (input.lists.some((name) => !LIST_NAMES.includes(name))) errors.lists = "That list is not one the module ships.";
  return errors;
}

export function buildConfig(input: BriefInput): { config: unknown; notes: string[] } {
  const slug = input.slug.trim();
  const domain = input.domainPending ? `${slug}.example` : bareDomain(input.domain);
  const hours: Record<string, string> = {};
  if (input.hoursWeekday.trim()) hours["mon-fri"] = input.hoursWeekday.trim();
  if (input.hoursWeekend.trim()) hours["sat-sun"] = input.hoursWeekend.trim();

  const specialties = input.specialties
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const menuOn = input.menu || input.mealPlans;
  const tags = MENU_TAGS.filter((tag) => input.menuTags.includes(tag.key));
  const modules: Record<string, unknown> = {
    cms: {},
    admin: {},
    forms: {
      phone_region: input.phoneRegion.trim().toUpperCase(),
      forms: ["contact"],
    },
  };
  if (menuOn) {
    modules.menu = {
      show_prices: true,
      allergens: true,
      ...(tags.length ? { tags: tags.map((tag) => ({ key: tag.key, label: tag.label, filterable: true })) } : {}),
    };
  }
  if (input.listsOn && input.lists.length) modules["content-lists"] = { enabled: [...input.lists] };
  if (input.tableBooking || input.spaceBooking) modules["booking-core"] = {};
  if (input.tableBooking) modules["table-booking"] = {};
  if (input.spaceBooking) modules["space-booking"] = {};
  if (input.mealPlans) modules["meal-plans"] = {};
  if (input.whatsappAlerts) modules.whatsapp = { booking_alerts: true };

  const contact: Record<string, string> = {
    email: input.email.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
  };
  if (input.whatsapp.trim()) contact.whatsapp = input.whatsapp.trim();

  const client: Record<string, unknown> = {
    name: input.name.trim(),
    slug,
    domain,
    type: input.type,
    locale: "en",
    currency: input.currency.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    contact,
  };
  if (Object.keys(hours).length) client.hours = hours;
  if (input.instagram.trim()) client.socials = { instagram: input.instagram.trim() };

  const config: Record<string, unknown> = {
    client,
    brand: {
      vibe: input.vibe.trim(),
      colors: {
        primary: input.colors.primary.trim(),
        secondary: input.colors.secondary.trim(),
        accent: input.colors.accent.trim(),
        background: input.colors.background.trim(),
        foreground: input.colors.foreground.trim(),
        muted: input.colors.muted.trim(),
      },
      fonts: { heading: input.headingFont.trim(), body: input.bodyFont.trim() },
      radius: input.radius,
      shadow: input.shadow,
      dark_mode: false,
    },
    motion: motionBlock(input.motion),
    hosting: { tier: input.tier, analytics: false, production_branch: "main" },
    email: {
      provider: "resend",
      from_domain: input.domainPending ? "" : `notify.${domain}`,
      sign_off: `The ${input.name.trim()} team`,
    },
    modules,
    pages: pagesFor(input),
  };
  if (specialties.length) config.highlights = { specialties };
  if (input.staffEmail.trim()) config.admin = { users: [{ email: input.staffEmail.trim(), role: "admin" }] };

  const notes = notesFor(input, domain, input.domainPending);
  config.notes = notes.join("\n");
  return { config, notes };
}

export function contrastWarnings(input: BriefInput): string[] {
  try {
    return buildTokens({
      vibe: input.vibe.trim() || "brief",
      references: [],
      colors: input.colors,
      fonts: { heading: input.headingFont || "Fraunces", body: input.bodyFont || "Figtree", accent: "" },
      radius: input.radius,
      shadow: input.shadow,
      logo: "",
      dark_mode: false,
      copy_rules: [],
    }).warnings;
  } catch {
    return [];
  }
}

export function toYaml(config: unknown, slug: string): string {
  const body = stringify(config, { lineWidth: 96 });
  return [
    "# client.yaml — a brief for the Pixelizt Plugins kit.",
    "# Written in the browser by the gallery. This file does not deploy a site.",
    "# Do not put API keys, passwords or tokens in here.",
    "# Save it to clients/<slug>/client.yaml and run:",
    `#   node scripts/new-client.mjs ${slug}`,
    "",
    body.endsWith("\n") ? body : `${body}\n`,
  ].join("\n");
}

export function formatSchemaError(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length ? issue.path.join(".") : "brief";
    return `${path}: ${issue.message}`;
  });
}

/** Parse and validate. Returns the yaml only when the core schema accepts the brief. */
export function buildBrief(input: BriefInput): { ok: true; result: BriefResult } | { ok: false; errors: string[] } {
  const fields = fieldErrors(input);
  if (Object.keys(fields).length) return { ok: false, errors: Object.values(fields) };
  const { config, notes } = buildConfig(input);
  const parsed = ClientConfig.safeParse(config);
  if (!parsed.success) return { ok: false, errors: formatSchemaError(parsed.error) };
  const slug = parsed.data.client.slug;
  return {
    ok: true,
    result: {
      yaml: toYaml(config, slug),
      config: parsed.data,
      notes,
      warnings: contrastWarnings(input),
    },
  };
}

export function sampleInput(over: Partial<BriefInput> = {}): BriefInput {
  const paper = PALETTES[0];
  const base: BriefInput = {
    name: "Harbour & Rye",
    slug: "harbour-and-rye",
    domain: "harbour-and-rye.example",
    domainPending: false,
    type: "restaurant",
    vibe: "warm, quiet, neighbourhood",
    currency: "GBP",
    timezone: "Europe/London",
    email: "hello@harbour-and-rye.example",
    phone: "+44 20 7946 0000",
    whatsapp: "",
    address: "Address to be added",
    hoursWeekday: "12:00-22:00",
    hoursWeekend: "10:00-22:30",
    instagram: "",
    specialties: "",
    staffEmail: "",
    phoneRegion: "GB",
    colors: { ...paper.colors },
    headingFont: "Fraunces",
    bodyFont: "Figtree",
    radius: "md",
    shadow: "soft",
    motion: "expressive",
    tier: "free",
    menu: true,
    menuTags: ["vegetarian", "vegan"],
    listsOn: true,
    lists: ["events", "faqs", "reviews"],
    tableBooking: true,
    spaceBooking: false,
    mealPlans: false,
    whatsappAlerts: false,
  };
  return { ...base, ...over, colors: { ...base.colors, ...over.colors } };
}
