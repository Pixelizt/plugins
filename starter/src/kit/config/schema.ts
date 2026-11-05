// The core client.yaml schema. Modules add their own blocks under `modules.<name>`,
// validated by each module's schema (see docs/ARCHITECTURE.md §5).
// Kit code: do not edit in a client project. Change it in the kit/starter and back-port.
import { z } from "zod";
import { DAY_PATTERN as DAY, TIME_RANGE_PATTERN } from "../lib/time.ts";

const hex = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, "must be a hex color like #1A2B3C");
const dayKey = z
  .string()
  .regex(new RegExp(`^${DAY}(-${DAY})?$`), 'use a day or range like "mon-fri" or "sat"');
const timeRange = z
  .string()
  .regex(new RegExp(`^${TIME_RANGE_PATTERN}$`), 'use "HH:MM-HH:MM", 24-hour');
const urlOrEmpty = z.union([z.url(), z.literal("")]);
const timezone = z.string().refine((tz) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, "must be an IANA time zone like Europe/London");

export const Hours = z.record(dayKey, timeRange);

export const PageEntry = z.strictObject({
  path: z.string().regex(/^\/[a-z0-9\-/]*$/, "must start with / and use lowercase, digits and dashes"),
  title: z.string().optional(), // nav label + <title>; defaults from the path
  description: z.string().optional(),
  nav: z.boolean().default(true),
  sections: z.array(z.string()).min(1),
});

export const ClientConfig = z.strictObject({
  client: z.strictObject({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "kebab-case only"),
    domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, "a bare domain like example.com"),
    type: z.enum(["cafe", "restaurant", "bar", "bakery", "food-subscription", "other"]),
    locale: z.literal("en"), // English only for now (D4)
    currency: z.string().regex(/^[A-Z]{3}$/, "ISO 4217 code like USD"),
    timezone,
    contact: z.strictObject({
      email: z.email(),
      phone: z.string().min(5),
      whatsapp: z.string().default(""),
      address: z.string().min(1),
      map_url: urlOrEmpty.default(""),
    }),
    hours: Hours.default({}),
    socials: z.record(z.string(), urlOrEmpty).default({}),
    delivery_apps: z.array(z.strictObject({ name: z.string(), url: z.url() })).default([]),
  }),

  brand: z.strictObject({
    vibe: z.string().min(1),
    references: z.array(z.url()).default([]),
    colors: z.strictObject({
      primary: hex,
      secondary: hex,
      accent: hex,
      background: hex,
      foreground: hex,
      muted: hex,
    }),
    fonts: z.strictObject({
      heading: z.string().min(1),
      body: z.string().min(1),
      accent: z.string().default(""),
    }),
    radius: z.enum(["none", "sm", "md", "lg", "full"]).default("md"),
    shadow: z.enum(["none", "soft", "strong"]).default("soft"), // elevation of cards, menus, dialogs
    logo: z.string().default(""),
    dark_mode: z.boolean().default(false),
    copy_rules: z.array(z.string()).default([]),
  }),

  motion: z
    .strictObject({
      level: z.enum(["subtle", "expressive", "awwwards"]).default("expressive"),
      smooth_scroll: z.boolean().default(false),
      allow_3d: z.boolean().default(false),
      hero_concept: z.string().default(""),
    })
    .default({ level: "expressive", smooth_scroll: false, allow_3d: false, hero_concept: "" }),

  hosting: z.strictObject({
    tier: z.enum(["free", "paid"]).default("paid"), // paid = Vercel Pro (paying clients). free = Hobby, demos only
    vercel_team: z.string().default(""),
    production_branch: z.string().default("main"),
    preview_branches: z.array(z.string()).default([]),
    // Web Analytics script. Off until a client opts in (it is a third-party request).
    analytics: z.boolean().default(false),
  }),

  email: z
    .strictObject({
      provider: z.enum(["resend"]).default("resend"),
      from_domain: z.string().default(""),
      sign_off: z.string().default(""),
    })
    .default({ provider: "resend", from_domain: "", sign_off: "" }),

  // Each module validates its own block (module schema). Unknown module names fail in the installer.
  modules: z.record(z.string(), z.unknown()).default({}),

  pages: z.array(PageEntry).min(1),

  admin: z
    .strictObject({
      users: z
        .array(z.strictObject({ email: z.email(), role: z.enum(["admin", "editor", "demo"]) }))
        .default([]),
      notify_on: z.array(z.string()).default([]),
    })
    .default({ users: [], notify_on: [] }),

  licenses: z.strictObject({ owned: z.array(z.string()).default([]) }).default({ owned: [] }),

  // Factual, verifiable points the client supplied. Every list defaults empty.
  // The site, JSON-LD, llms.txt and the facts FAQ omit anything left blank. Never invent a value.
  highlights: z
    .strictObject({
      awards: z.array(z.strictObject({ name: z.string().min(1), year: z.number().int().optional(), by: z.string().default("") })).default([]),
      specialties: z.array(z.string().min(1)).default([]),
      dietary: z.array(z.string().min(1)).default([]),
      ambience: z.array(z.string().min(1)).default([]),
      parking: z.string().default(""),
      other: z.array(z.strictObject({ label: z.string().min(1), text: z.string().min(1) })).default([]),
    })
    .default({ awards: [], specialties: [], dietary: [], ambience: [], parking: "", other: [] }),

  seo: z
    .strictObject({
      // Major AI crawlers. "allow" still hides /admin and /api. "block" disallows the whole site for those bots only.
      ai_crawlers: z.enum(["allow", "block"]).default("allow"),
      // Path ("/og.png") or absolute URL. Empty: no Open Graph image, Twitter card is "summary".
      share_image: z.string().default(""),
    })
    .default({ ai_crawlers: "allow", share_image: "" }),

  // Extra hosts the CSP must allow (maps, video embeds). Adding one needs owner approval (rule 14).
  csp: z
    .strictObject({
      frame_src: z.array(z.string()).default([]),
      img_src: z.array(z.string()).default([]),
      media_src: z.array(z.string()).default([]),
      connect_src: z.array(z.string()).default([]),
    })
    .default({ frame_src: [], img_src: [], media_src: [], connect_src: [] }),

  notes: z.string().default(""),
});

export type ClientConfig = z.infer<typeof ClientConfig>;
export type PageEntry = z.infer<typeof PageEntry>;
